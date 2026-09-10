#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
看片狂人 (kunzejiaoyu.net) 全站爬虫
=================================================
站点基于苹果CMS(maccms) v10搭建，视频源 player_aaaa.encrypt=0，无加密，
直接从播放页正则提取 player_aaaa JSON 获取 m3u8 地址即可。

功能：
  1. 全分类 / 分页遍历，抓取所有影片详情页元数据
  2. 解析播放页提取每条线路 / 每一集的 m3u8 直链
  3. 可选：使用 ffmpeg 或原生 m3u8 下载器将 m3u8 保存为本地 mp4
  4. 元数据保存为 JSON / CSV，已抓取 ID 断点续爬
  5. 多线程并发 + 随机 UA + 延时，降低被封风险

使用方法：
  # 仅采集元数据（不下载视频，快速跑全量索引）
  python kunzejiaoyu_spider.py --mode meta

  # 采集元数据 + 下载视频（默认使用 ffmpeg，速度最快）
  python kunzejiaoyu_spider.py --mode full --download

  # 仅下载指定 vod_id 的所有集数
  python kunzejiaoyu_spider.py --mode single --vod-id 106576 --download

  # 自定义并发 / 起始页 / 分类
  python kunzejiaoyu_spider.py --mode meta --workers 8 --delay 1
"""

import argparse
import csv
import json
import os
import random
import re
import sys
import time
import subprocess
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path
from urllib.parse import urljoin

import requests
from bs4 import BeautifulSoup


# ==================== 配置区 ====================
BASE_URL    = "https://kunzejiaoyu.net"
USER_AGENTS = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:125.0) Gecko/20100101 Firefox/125.0",
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1",
]
# 站点一级分类 path -> (slug, 中文名)，对应顶部导航；如需爬取豆瓣Top250可把 "42" 加进去
CATEGORIES = {
    "dianying":  "电影",
    "dianshiju": "电视剧",
    "zongyi":    "综艺",
    "dongman":   "动漫",
}

# 输出目录
OUT_DIR       = Path("output")
META_DIR      = OUT_DIR / "meta"
VIDEO_DIR     = OUT_DIR / "videos"
PROGRESS_FILE = OUT_DIR / "progress.json"
OUT_DIR.mkdir(exist_ok=True)
META_DIR.mkdir(exist_ok=True)
VIDEO_DIR.mkdir(exist_ok=True)


# ==================== HTTP 会话 ====================
def build_session() -> requests.Session:
    s = requests.Session()
    s.headers.update({
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
        "Referer": BASE_URL + "/",
        "Connection": "keep-alive",
    })
    return s


def get(s: requests.Session, url: str, timeout=15, retry=3):
    for i in range(retry):
        try:
            s.headers["User-Agent"] = random.choice(USER_AGENTS)
            r = s.get(url, timeout=timeout)
            if r.status_code == 200:
                # 站点默认 utf-8，requests 偶尔识别错，强制指定
                r.encoding = "utf-8"
                return r.text
            elif r.status_code == 404:
                return None
        except Exception as e:
            # print(f"[warn] get {url} failed: {e}, retry {i+1}")
            time.sleep(1 + i)
    return None


# ==================== 页面解析 ====================
def _extract_json_object(text: str, start_idx: int) -> str:
    """从 start_idx('{'处) 开始提取一个完整 JSON 对象，处理字符串中的花括号转义。"""
    assert text[start_idx] == "{"
    depth = 0
    in_str = False
    esc = False
    i = start_idx
    while i < len(text):
        ch = text[i]
        if esc:
            esc = False
        elif ch == "\\":
            esc = True
        elif ch == '"':
            in_str = not in_str
        elif not in_str:
            if ch == "{":
                depth += 1
            elif ch == "}":
                depth -= 1
                if depth == 0:
                    return text[start_idx:i + 1]
        i += 1
    return None


PLAYER_AAAA_RE = re.compile(r"player_aaaa\s*=\s*\{", re.S)

def parse_detail(html: str):
    """解析详情页：标题、封面、简介、演员、导演、分类等"""
    soup = BeautifulSoup(html, "html.parser")
    data = {}
    # 标题
    h1 = soup.find("h1")
    if h1:
        data["title"] = h1.get_text(strip=True).replace("完整版免费在线观看", "").strip("《》")
    # 提取详情区 (class=data, 类苹果CMS常见结构)
    info_block = soup.select_one(".video-info, .info, .mov_context, .movie-info")
    text = soup.get_text("\n", strip=True)
    # 简介
    desc_match = re.search(r"剧情介绍[:：]?\s*(.+?)(?:常见问题|相关搜索|$)", text, re.S)
    if desc_match:
        data["description"] = desc_match.group(1).strip()
    # 导演 / 演员
    director = re.search(r"导演[:：]\s*([^\n]+)", text)
    actor    = re.search(r"主演[:：]\s*([^\n]+)", text)
    if director: data["director"] = director.group(1).strip()
    if actor:    data["actor"]    = actor.group(1).strip()
    # 封面
    og_img = soup.find("meta", property="og:image")
    if og_img and og_img.get("content"):
        data["cover"] = og_img["content"]
    # 播放页链接（所有线路+集数）
    play_links = []
    for a in soup.select('a[href*="/kuvodplay/"]'):
        href = urljoin(BASE_URL, a["href"])
        ep_name = a.get_text(strip=True)
        if href not in [x["url"] for x in play_links]:
            play_links.append({"name": ep_name, "url": href})
    data["episodes"] = play_links
    return data


def _decrypt_maccms_url(encrypted: str, encrypt_flag: int) -> str:
    """苹果CMS player_aaaa 加密兼容解密。
    encrypt=0 : 明文，直接返回
    encrypt=1 : Unicode 转义后再编码，需 unescape(unicode_escape) 再unescape
    encrypt=2 : Base64
    encrypt=3/4/5 : 部分模板自定义解码，这里做通用 HEX/Base64/unescape 多级兜底
    """
    if not encrypted:
        return ""
    if encrypt_flag == 0:
        return encrypted
    import base64, binascii, html, urllib.parse
    cand = encrypted
    # 多重尝试，直至得到一个 http(s) 开头的合法URL
    attempts = []
    # flag=2: base64
    try:
        attempts.append(base64.b64decode(encrypted).decode("utf-8", errors="ignore"))
    except Exception:
        pass
    # flag=1: unicode_escape + unescape
    try:
        attempts.append(encrypted.encode().decode("unicode_escape"))
    except Exception:
        pass
    # 多重反转义
    for _ in range(3):
        try:
            cand = urllib.parse.unquote(html.unescape(cand))
        except Exception:
            break
    attempts.append(cand)
    # hex
    try:
        attempts.append(binascii.unhexlify(encrypted).decode("utf-8", errors="ignore"))
    except Exception:
        pass
    # 反转（部分模板尾倒序）
    attempts.append(encrypted[::-1])
    # 找第一个像URL的
    for a in attempts:
        if a and (a.startswith("http") or a.startswith("/") or ".m3u8" in a or ".mp4" in a):
            return a
    return encrypted  # 解不出就原样返回


def parse_player(html: str):
    """解析播放页，提取 player_aaaa JSON，拿到 m3u8 直链。
    站点 encrypt=0 直接返回明文；同时兼容苹果CMS常见所有 encrypt 解密。"""
    if not html:
        return None
    m = PLAYER_AAAA_RE.search(html)
    if not m:
        return None
    brace_start = m.end() - 1
    raw = _extract_json_object(html, brace_start)
    if not raw:
        return None
    try:
        obj = json.loads(raw)
    except json.JSONDecodeError:
        try:
            obj = json.loads(raw.encode().decode("unicode_escape"))
        except Exception:
            return None
    enc_flag = obj.get("encrypt", 0)
    raw_url  = obj.get("url", "")
    m3u8     = _decrypt_maccms_url(raw_url, enc_flag)
    return {
        "vod_name": obj.get("vod_data", {}).get("vod_name", ""),
        "from":     obj.get("from", ""),
        "note":     obj.get("note", ""),
        "m3u8":     m3u8,
        "raw_url":  raw_url,
        "encrypt":  enc_flag,
        "vid":      obj.get("id", ""),
        "sid":      obj.get("sid", ""),
        "nid":      obj.get("nid", ""),
    }


# ==================== 分页发现 ====================
def get_max_page(html: str) -> int:
    """从分类列表页提取最大页码"""
    if not html:
        return 1
    # 尾页通常含 total 或 link "...-page.html"
    nums = [int(x) for x in re.findall(r"/kuvodtype/[^/]+?-(?:\d+-)?(\d+)\.html", html)]
    nums = [n for n in nums if n < 100000]
    return max(nums) if nums else 1


def collect_detail_links_from_list(html: str):
    """从分类列表页提取所有详情页 URL + vod_id"""
    soup = BeautifulSoup(html, "html.parser")
    items = []
    seen = set()
    for a in soup.select('a[href*="/kuvoddetail/"]'):
        href = urljoin(BASE_URL, a["href"])
        m = re.search(r"/kuvoddetail/(\d+)\.html", href)
        if not m:
            continue
        vid = m.group(1)
        if vid in seen:
            continue
        seen.add(vid)
        items.append({"vod_id": vid, "detail_url": href})
    return items


# ==================== 视频下载 ====================
def have_ffmpeg() -> bool:
    try:
        subprocess.run(["ffmpeg", "-version"], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        return True
    except FileNotFoundError:
        return False


def download_m3u8_ffmpeg(m3u8_url: str, out_path: Path):
    """使用 ffmpeg 合并下载 m3u8 -> mp4，最简单稳定"""
    out_path.parent.mkdir(parents=True, exist_ok=True)
    cmd = [
        "ffmpeg", "-y", "-loglevel", "warning",
        "-headers", "Referer: https://kunzejiaoyu.net/\r\nUser-Agent: " + random.choice(USER_AGENTS),
        "-i", m3u8_url,
        "-c", "copy",
        "-bsf:a", "aac_adtstoasc",
        str(out_path),
    ]
    print(f"[ffmpeg] -> {out_path.name}")
    subprocess.run(cmd, check=False)
    return out_path.exists() and out_path.stat().st_size > 0


def download_m3u8_native(m3u8_url: str, out_path: Path, workers=8):
    """不依赖 ffmpeg 的原生 m3u8 下载器：解析 m3u8 -> 下载 ts -> 合并为 mp4/ts"""
    out_path.parent.mkdir(parents=True, exist_ok=True)
    s = requests.Session()
    s.headers.update({
        "User-Agent": random.choice(USER_AGENTS),
        "Referer": BASE_URL + "/",
    })
    r = s.get(m3u8_url, timeout=20)
    r.raise_for_status()
    m3u8_text = r.text
    # 处理嵌套 m3u8（多码率）：取第一个子 m3u8
    lines = [l.strip() for l in m3u8_text.splitlines() if l.strip() and not l.startswith("#")]
    if lines and lines[0].endswith(".m3u8"):
        sub = urljoin(m3u8_url, lines[0])
        r = s.get(sub, timeout=20)
        m3u8_text = r.text
        lines = [l.strip() for l in m3u8_text.splitlines() if l.strip() and not l.startswith("#")]
    ts_list = [urljoin(m3u8_url, l) for l in lines if l.endswith(".ts")]
    tmp_dir = out_path.parent / ("." + out_path.stem + "_ts")
    tmp_dir.mkdir(exist_ok=True)

    def _one(idx_url):
        idx, url = idx_url
        tp = tmp_dir / f"{idx:05d}.ts"
        if tp.exists() and tp.stat().st_size > 0:
            return tp
        for _ in range(3):
            try:
                rr = s.get(url, timeout=30)
                if rr.status_code == 200:
                    tp.write_bytes(rr.content)
                    return tp
            except Exception:
                time.sleep(1)
        return None

    print(f"[native] downloading {len(ts_list)} ts segments -> {out_path.name}")
    results = [None] * len(ts_list)
    with ThreadPoolExecutor(max_workers=workers) as ex:
        futs = {ex.submit(_one, (i, u)): i for i, u in enumerate(ts_list)}
        for f in as_completed(futs):
            i = futs[f]
            results[i] = f.result()
    # 合并
    with open(out_path, "wb") as fp:
        for tp in results:
            if tp and tp.exists():
                fp.write(tp.read_bytes())
    # 清理
    for tp in tmp_dir.glob("*.ts"):
        tp.unlink()
    try:
        tmp_dir.rmdir()
    except OSError:
        pass
    return out_path.exists() and out_path.stat().st_size > 0


# ==================== 主爬虫 ====================
class KZJYCrawler:
    def __init__(self, workers=4, delay=0.8, download=False, max_pages_per_cat=None):
        self.session  = build_session()
        self.workers  = workers
        self.delay    = delay
        self.download = download
        self.max_pages_per_cat = max_pages_per_cat
        self.use_ffmpeg = have_ffmpeg()
        # 进度
        if PROGRESS_FILE.exists():
            self.progress = json.loads(PROGRESS_FILE.read_text("utf-8"))
        else:
            self.progress = {"crawled_vids": [], "meta_count": 0}

    def save_progress(self):
        PROGRESS_FILE.write_text(json.dumps(self.progress, ensure_ascii=False, indent=2), "utf-8")

    # ---------- 全量爬取 ----------
    def crawl_all_meta(self):
        all_vids = {}
        for slug, cname in CATEGORIES.items():
            print(f"\n========== 分类：{cname} ({slug}) ==========")
            # 第一页拿最大页码
            first_url = f"{BASE_URL}/kuvodtype/{slug}.html"
            html = get(self.session, first_url)
            if not html:
                print(f"[warn] 无法访问 {first_url}")
                continue
            max_page = get_max_page(html)
            if self.max_pages_per_cat:
                max_page = min(max_page, self.max_pages_per_cat)
            print(f"最大页码：{max_page}")
            # 逐页抓取详情链接
            with ThreadPoolExecutor(max_workers=self.workers) as ex:
                urls = [f"{BASE_URL}/kuvodtype/{slug}.html"] + [
                    f"{BASE_URL}/kuvodtype/{slug}-{p}.html" for p in range(2, max_page + 1)
                ]
                fut_to_url = {ex.submit(get, self.session, u): u for u in urls}
                for fut in as_completed(fut_to_url):
                    page_html = fut.result()
                    if not page_html:
                        continue
                    for it in collect_detail_links_from_list(page_html):
                        all_vids[it["vod_id"]] = it["detail_url"]
                    time.sleep(self.delay * 0.3)
        print(f"\n共发现 {len(all_vids)} 个影片详情页")
        # 抓取详情
        todo = [(vid, url) for vid, url in all_vids.items() if vid not in self.progress["crawled_vids"]]
        print(f"待抓取详情：{len(todo)}")
        with ThreadPoolExecutor(max_workers=self.workers) as ex:
            futs = {ex.submit(self._crawl_one_meta, vid, url): vid for vid, url in todo}
            done = 0
            for fut in as_completed(futs):
                done += 1
                vid = futs[fut]
                try:
                    fut.result()
                except Exception as e:
                    print(f"[err] vod {vid}: {e}")
                if done % 20 == 0:
                    self.save_progress()
                    print(f"[progress] {done}/{len(todo)}")
        self.save_progress()
        self._write_summary()

    def _crawl_one_meta(self, vid: str, detail_url: str):
        time.sleep(self.delay * random.random())
        html = get(self.session, detail_url)
        if not html:
            return
        meta = parse_detail(html)
        meta["vod_id"] = vid
        meta["detail_url"] = detail_url
        meta["category"] = self._guess_cat_from_url(detail_url)
        # 抓每个播放页的 m3u8（先设 Referer 为详情页，防止站点返回空壳）
        episodes_info = []
        self.session.headers["Referer"] = detail_url
        for ep in meta.get("episodes", []):
            ph = get(self.session, ep["url"])
            info = parse_player(ph) if ph else None
            episodes_info.append({
                "ep_name": ep["name"],
                "play_url": ep["url"],
                "m3u8": info["m3u8"] if info else "",
                "from": info["from"] if info else "",
            })
            # 可选：下载视频
            if self.download and info and info.get("m3u8"):
                safe_title = re.sub(r'[\\/:*?"<>|]', "_", meta.get("title", vid))
                safe_ep    = re.sub(r'[\\/:*?"<>|]', "_", ep["name"]) or "play"
                out = VIDEO_DIR / safe_title / f"{safe_ep}.mp4"
                if out.exists() and out.stat().st_size > 1024:
                    pass
                else:
                    try:
                        if self.use_ffmpeg:
                            download_m3u8_ffmpeg(info["m3u8"], out)
                        else:
                            download_m3u8_native(info["m3u8"], out)
                    except Exception as e:
                        print(f"[download err] {out.name}: {e}")
            time.sleep(self.delay * random.random())
        meta["episodes"] = episodes_info
        # 写单独 JSON
        (META_DIR / f"{vid}.json").write_text(
            json.dumps(meta, ensure_ascii=False, indent=2), "utf-8"
        )
        self.progress["crawled_vids"].append(vid)
        self.progress["meta_count"] = len(self.progress["crawled_vids"])

    def _guess_cat_from_url(self, url: str) -> str:
        for slug, cname in CATEGORIES.items():
            if slug in url:
                return cname
        return ""

    def _write_summary(self):
        """汇总所有 json -> csv 索引"""
        rows = []
        for f in META_DIR.glob("*.json"):
            d = json.loads(f.read_text("utf-8"))
            for ep in d.get("episodes", []):
                rows.append({
                    "vod_id":      d.get("vod_id"),
                    "title":       d.get("title", ""),
                    "category":    d.get("category", ""),
                    "director":    d.get("director", ""),
                    "actor":       d.get("actor", ""),
                    "episode":     ep.get("ep_name", ""),
                    "play_from":   ep.get("from", ""),
                    "m3u8":        ep.get("m3u8", ""),
                    "detail_url":  d.get("detail_url", ""),
                    "play_url":    ep.get("play_url", ""),
                })
        csv_path = OUT_DIR / "vod_index.csv"
        if rows:
            with open(csv_path, "w", encoding="utf-8-sig", newline="") as f:
                w = csv.DictWriter(f, fieldnames=list(rows[0].keys()))
                w.writeheader()
                w.writerows(rows)
        print(f"\n索引文件已生成：{csv_path}（共 {len(rows)} 条播放记录）")

    # ---------- 单部影片 ----------
    def crawl_single(self, vod_id: str):
        detail_url = f"{BASE_URL}/kuvoddetail/{vod_id}.html"
        print(f"抓取单部：{detail_url}")
        self._crawl_one_meta(str(vod_id), detail_url)
        self.save_progress()
        self._write_summary()


# ==================== CLI ====================
def main():
    ap = argparse.ArgumentParser(description="kunzejiaoyu.net 全站爬虫（苹果CMS，m3u8无加密）")
    ap.add_argument("--mode", choices=["meta", "full", "single"], default="meta",
                    help="meta=仅抓元数据索引  full=元数据+下载视频  single=单部影片")
    ap.add_argument("--vod-id", type=str, help="mode=single 时指定 vod_id")
    ap.add_argument("--workers", type=int, default=6, help="并发线程数")
    ap.add_argument("--delay", type=float, default=0.8, help="请求基础延时（秒）")
    ap.add_argument("--max-pages", type=int, default=None, help="每个分类最多爬多少页（测试用）")
    ap.add_argument("--download", action="store_true", help="是否下载 m3u8 视频为本地 mp4")
    args = ap.parse_args()

    download = args.download or (args.mode == "full")
    crawler = KZJYCrawler(
        workers=args.workers,
        delay=args.delay,
        download=download,
        max_pages_per_cat=args.max_pages,
    )

    if args.mode == "single":
        if not args.vod_id:
            print("single 模式必须传 --vod-id")
            sys.exit(1)
        crawler.crawl_single(args.vod_id)
    else:
        crawler.crawl_all_meta()

    print("\n✓ 任务完成。输出目录：", OUT_DIR.resolve())


if __name__ == "__main__":
    main()
