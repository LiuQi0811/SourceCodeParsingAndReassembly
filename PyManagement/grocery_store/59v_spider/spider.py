#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
永乐视频 (tv.59v.net) 全站爬虫
==============================
- 基于苹果CMS (MacCMS) 结构，API 关闭后走 HTML 解析路线
- 播放器配置通过正则提取页面中的 player_aaaa JSON（encrypt=0 默认明文；内置加密兼容解密）
- 支持遍历电影/剧集/综艺/动漫全部分页 → 详情页 → 所有播放源的所有集数
- 可选下载视频（m3u8 → 本地 ts 合并为 mp4），仅下载 m3u8 索引时速度很快
- 断点续爬：已完成的 vod_id 写入 data/visited.txt 不再重复抓取
- 元数据保存为 JSON，同时导出总索引 CSV

使用方法:
    python3 spider.py                  # 只爬取元数据和 m3u8 地址，不下载视频
    python3 spider.py --download       # 同时下载视频（会很耗时、很占空间）
    python3 spider.py --cat 1          # 只爬分类 1=电影 (2=剧集, 3=综艺, 4=动漫)
    python3 spider.py --max-pages 10   # 每个分类最多爬 10 页（调试用）
"""

import argparse
import base64
import csv
import json
import os
import re
import sys
import time
import random
from pathlib import Path
from urllib.parse import urljoin, urlparse

import requests
from bs4 import BeautifulSoup

try:
    from tqdm import tqdm
except ImportError:
    def tqdm(it, **kwargs):
        return it

# ---------------- 配置 ----------------
BASE_URL = "https://tv.59v.net"
HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
                  "(KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
    "Referer": BASE_URL + "/",
    "Accept-Language": "zh-CN,zh;q=0.9",
}

# 分类：MacCMS 常见 id 映射
CATEGORIES = {
    1: "电影",
    2: "剧集",
    3: "综艺",
    4: "动漫",
}

# 输出目录
OUT_DIR = Path(__file__).parent / "data"
VIDEO_DIR = Path(__file__).parent / "videos"
OUT_DIR.mkdir(exist_ok=True)
VIDEO_DIR.mkdir(exist_ok=True)

SESSION = requests.Session()
SESSION.headers.update(HEADERS)


# ---------------- 工具函数 ----------------
def safe_name(s: str) -> str:
    """文件名安全化"""
    s = re.sub(r'[\\/:*?"<>|\r\n\t]+', "_", s)
    return s.strip().strip(".")[:120]


def get(url: str, retry: int = 3, timeout: int = 20, **kwargs) -> requests.Response:
    """带重试的 GET"""
    for i in range(retry):
        try:
            r = SESSION.get(url, timeout=timeout, **kwargs)
            if r.status_code == 200:
                # 站方编码 utf-8
                r.encoding = r.apparent_encoding or "utf-8"
                return r
            time.sleep(1 + i)
        except Exception as e:
            if i == retry - 1:
                raise
            time.sleep(2 + i * 2)
    raise requests.HTTPError(f"GET {url} failed after {retry} retries")


def decrypt_player_url(url: str) -> str:
    """
    MacCMS player_aaaa.url 在 encrypt=1 时是 base64 编码。
    该站 encrypt=0 明文；为保证「完美逆向」也内置解密，兼容开启加密的线路。
    有些模板使用自定义 XOR/Unicode 混淆，这里做通用处理：
    1) 先尝试 base64 解码
    2) 如果结果是 http(s) 链接则返回
    3) 否则原样返回（即明文）
    """
    if not url:
        return url
    if url.startswith("http"):
        return url
    # base64
    try:
        raw = base64.b64decode(url, validate=False).decode("utf-8", errors="ignore")
        if raw.startswith("http"):
            return raw
    except Exception:
        pass
    return url


def parse_player_aaaa(html: str) -> dict:
    """从播放页 HTML 中提取 player_aaaa 配置 JSON"""
    m = re.search(r'var\s+player_aaaa\s*=\s*(\{.*?\})\s*</script>', html, re.S)
    if not m:
        return {}
    try:
        # 去掉可能的尾部逗号
        raw = re.sub(r',\s*}', '}', m.group(1))
        data = json.loads(raw)
    except Exception:
        # 尝试修复单引号
        try:
            fixed = re.sub(r',\s*\]', ']', m.group(1))
            data = json.loads(fixed)
        except Exception:
            return {}
    return data


# ---------------- 爬虫逻辑 ----------------
def get_list_page(cat_id: int, page: int) -> str:
    """分类列表页 URL（MacCMS 此模板分页格式: /vodshow/{id}--------{page}---/）"""
    if page == 1:
        return f"{BASE_URL}/vodshow/{cat_id}-----------/"
    return f"{BASE_URL}/vodshow/{cat_id}--------{page}---/"


def parse_list_page(html: str):
    """解析列表页，返回 (详情链接列表, 是否还有下一页)"""
    soup = BeautifulSoup(html, "lxml")
    items = []
    # 模板详情链接 /voddetail/{id}/ （本模板无 .html 后缀）
    for a in soup.select('a[href*="/voddetail/"]'):
        href = a.get("href", "")
        m = re.search(r'/voddetail/(\d+)/?', href)
        if m:
            vid = m.group(1)
            url = urljoin(BASE_URL, href).split("#")[0].split("?")[0].rstrip("/") + "/"
            items.append((vid, url))
    # 去重
    seen = set()
    uniq = []
    for vid, u in items:
        if vid not in seen:
            seen.add(vid)
            uniq.append((vid, u))
    # 下一页判断：分页里是否存在「下一页」
    has_next = bool(soup.select_one('a.page-link.page-next, a.page-next'))
    if not has_next:
        has_next = bool(soup.find("a", string=re.compile(r"^\s*下一页\s*$")))
    # 最大页：优先读尾页链接 /vodshow/...-{N}---/
    max_p = 1
    tail = soup.select_one('a[title="尾页"], a.page-link.page-last, a.page-last')
    if tail and tail.get("href"):
        m = re.search(r'--------(\d+)---/?', tail["href"])
        if m:
            max_p = int(m.group(1))
    if max_p <= 1:
        # 退化为只统计分页区 .page-link 里的数字
        for a in soup.select('a.page-link, .pagination a'):
            t = (a.get_text(strip=True) or "")
            if t.isdigit():
                max_p = max(max_p, int(t))
    return uniq, has_next, max_p


def parse_detail_page(html: str, vid: str) -> dict:
    """解析详情页，返回元数据 + 所有播放线路/集数的播放地址路径"""
    soup = BeautifulSoup(html, "lxml")
    info = {"vod_id": vid, "title": "", "cover": "", "desc": "",
            "year": "", "area": "", "director": "", "actors": "",
            "tags": [], "episodes": []}

    # 标题
    h1 = soup.find("h1")
    if h1:
        info["title"] = h1.get_text(strip=True)

    # 封面
    og = soup.find("meta", property="og:image")
    if og and og.get("content"):
        info["cover"] = og["content"]

    # 简介
    desc = soup.find("meta", attrs={"name": "description"})
    if desc:
        info["desc"] = desc.get("content", "")

    # 面包屑信息：年份/地区/类型/导演/演员
    # 该模板详情页用链接形式展示，按顺序取
    block = soup.select_one(".video-info-aux, .vod_detail, .content_detail")
    text_links = soup.select(".content_detail a, .video-info-items a, .hl-1 a, .hl a")
    # 简单提取：页面所有含链接的元信息块
    for a in soup.select('a[href*="/vodshow/"]'):
        t = a.get_text(strip=True)
        href = a.get("href", "")
        if not t:
            continue
        if re.fullmatch(r"\d{4}", t):
            info["year"] = t
        elif t in ("大陆", "香港", "台湾", "日本", "韩国", "欧美", "英国", "泰国", "印度", "美国", "其它"):
            info["area"] = t
        else:
            info["tags"].append(t)
    info["tags"] = list(dict.fromkeys(info["tags"]))

    # 导演 / 演员：在 .hl 类块中
    for span in soup.select(".hl, .video-info-header"):
        txt = span.get_text(" ", strip=True)
        dm = re.search(r"导演[:：]\s*([^ \n]+)", txt)
        if dm:
            info["director"] = dm.group(1)
        am = re.search(r"主演[:：]\s*(.+)", txt)
        if am:
            info["actors"] = am.group(1)[:200]

    # 播放源与集数：
    # 模板里「立即播放」按钮和侧边播放源都链接到 /play/{vid}-{sid}-{nid}/
    # 先用正则从整页抓，再按 (sid, nid) 去重
    source_tabs = soup.select('.anthology-tab .swiper-slide, .source-tabs .tab-item, [class*="source"] .slide, .source-item')
    sid_names = []
    for t in source_tabs:
        name = t.get_text(strip=True)
        if name and not name.isdigit():
            sid_names.append(name)
    if not sid_names:
        # 页面会有"自营1线"/"全球3线"等文本，优先匹配
        for t in soup.find_all(string=re.compile(r"(自营|全球|大陆|线路|线)\s*\d+\s*线?")):
            nm = t.strip()
            if nm and nm not in sid_names:
                sid_names.append(nm)

    episodes = []
    seen_ep = set()
    for a in soup.find_all("a", href=re.compile(rf'/play/{vid}-(\d+)-(\d+)/?')):
        href = a.get("href", "")
        m = re.match(rf'/play/{vid}-(\d+)-(\d+)/?', href)
        if not m:
            continue
        sid = int(m.group(1))
        nid = int(m.group(2))
        if (sid, nid) in seen_ep:
            continue
        # 跳过「立即播放」按钮（带 main-btn 类，nid=1 且文本是"立即播放/播放"）
        cls = a.get("class", [])
        txt = a.get_text(strip=True)
        title = a.get("title", "") or txt
        ep_name = re.sub(rf'.*?(第?\d+[集期话话部节]?|HD|正片|抢先版|高清|1080P|蓝光|上集|下集|大结局)$', r'\1', title)
        # title 形如 "播放xxx第3集"，提取最后描述集数的部分
        m2 = re.search(r'(第\s*\d+\s*[集期话部节]|[0-9]{1,4}\s*[集期话部节]?|HD|正片|抢先版|高清版?|1080P|蓝光|完结|大结局|上集|下集)$', title)
        if m2:
            ep_name = m2.group(1)
        elif txt and txt not in ("立即播放", "播放", ""):
            ep_name = txt
        else:
            ep_name = f"第{nid}集"
        seen_ep.add((sid, nid))
        episodes.append({
            "sid": sid,
            "source": sid_names[sid - 1] if 0 <= sid - 1 < len(sid_names) else f"线路{sid}",
            "nid": nid,
            "name": ep_name,
            "play_url": urljoin(BASE_URL, href),
        })
    # 按 sid,nid 排序
    episodes.sort(key=lambda x: (x["sid"], x["nid"]))
    info["episodes"] = episodes
    return info


def fetch_episode_m3u8(play_url: str) -> dict:
    """进入播放页，解析 player_aaaa 拿到真实视频地址"""
    r = get(play_url)
    cfg = parse_player_aaaa(r.text)
    if not cfg:
        return {"m3u8": "", "encrypt": None, "from": "", "error": "player_aaaa not found"}
    encrypt = cfg.get("encrypt", 0)
    raw_url = cfg.get("url", "")
    real_url = decrypt_player_url(raw_url) if encrypt else raw_url
    return {
        "m3u8": real_url,
        "encrypt": encrypt,
        "from": cfg.get("from", ""),
        "note": cfg.get("note", ""),
        "next": cfg.get("url_next", ""),
    }


# ---------------- 下载（可选） ----------------
def _aes128_decrypt(data: bytes, key: bytes, iv: bytes) -> bytes:
    from Crypto.Cipher import AES
    cipher = AES.new(key, AES.MODE_CBC, iv)
    return cipher.decrypt(data)


def download_m3u8(m3u8_url: str, out_path: Path, referer: str = ""):
    """
    下载 m3u8 为本地 mp4/ts 文件。
    - 明文 ts: 直接合并
    - AES-128: 下载密钥后解密再合并
    - 若环境中有 ffmpeg，优先 ffmpeg（兜底，能应对各种复杂情况）
    """
    headers = dict(HEADERS)
    if referer:
        headers["Referer"] = referer

    # 优先 ffmpeg（若存在），能直接复用浏览器cookie/headers，最稳
    import shutil, subprocess
    if shutil.which("ffmpeg"):
        out_path.parent.mkdir(parents=True, exist_ok=True)
        hdr = "\r\n".join([f"{k}: {v}" for k, v in headers.items()]) + "\r\n"
        cmd = ["ffmpeg", "-y", "-hide_banner", "-loglevel", "error",
               "-headers", hdr,
               "-i", m3u8_url, "-c", "copy", "-bsf:a", "aac_adtstoasc", str(out_path)]
        print(f"     使用 ffmpeg 下载...")
        ret = subprocess.run(cmd)
        if ret.returncode == 0 and out_path.exists() and out_path.stat().st_size > 1024:
            return
        print("     ffmpeg 失败，回退 Python 原生下载")

    # 原生 Python 下载
    r = SESSION.get(m3u8_url, headers=headers, timeout=30)
    r.raise_for_status()
    content = r.text

    ts_list = []
    key = None
    iv = None
    for line in content.splitlines():
        line = line.strip()
        if line.startswith("#EXT-X-KEY"):
            m_uri = re.search(r'URI="([^"]+)"', line)
            m_iv = re.search(r'IV=0x([0-9a-fA-F]+)', line)
            method_m = re.search(r'METHOD=([A-Z0-9-]+)', line)
            method = method_m.group(1) if method_m else "NONE"
            if method == "NONE":
                key = None
                continue
            if m_uri:
                key_uri = urljoin(m3u8_url, m_uri.group(1))
                kr = SESSION.get(key_uri, headers=headers, timeout=15)
                kr.raise_for_status()
                key = kr.content
            else:
                key = None
            if m_iv:
                iv = bytes.fromhex(m_iv.group(1))
            else:
                iv = b"\x00" * 16
        elif line and not line.startswith("#"):
            ts_list.append(urljoin(m3u8_url, line))

    if not ts_list:
        raise ValueError("m3u8 中未发现 ts 片段")

    out_path.parent.mkdir(parents=True, exist_ok=True)

    with open(out_path, "wb") as fout:
        for i, ts in enumerate(tqdm(ts_list, desc=f"  下载 {out_path.name}", unit="ts"), 1):
            data = None
            for tr in range(4):
                try:
                    rr = SESSION.get(ts, headers=headers, timeout=30)
                    rr.raise_for_status()
                    data = rr.content
                    break
                except Exception as e:
                    if tr == 3:
                        print(f"  [warn] ts 片段 {i}/{len(ts_list)} 下载失败: {e}")
                    time.sleep(1)
            if data is None:
                continue
            if key:
                try:
                    data = _aes128_decrypt(data, key, iv or b"\x00"*16)
                    # 去除 PKCS7 padding（最后一个包）
                    if i == len(ts_list):
                        pad = data[-1]
                        if 1 <= pad <= 16 and data[-pad:] == bytes([pad])*pad:
                            data = data[:-pad]
                except Exception as e:
                    print(f"  [warn] ts {i} 解密失败: {e}")
            fout.write(data)


# ---------------- 主流程 ----------------
def load_visited() -> set:
    p = OUT_DIR / "visited.txt"
    if p.exists():
        return set(p.read_text(encoding="utf-8").split())
    return set()


def mark_visited(vid: str):
    with open(OUT_DIR / "visited.txt", "a", encoding="utf-8") as f:
        f.write(vid + "\n")


def save_record(rec: dict):
    with open(OUT_DIR / "catalog.jsonl", "a", encoding="utf-8") as f:
        f.write(json.dumps(rec, ensure_ascii=False) + "\n")


def crawl_category(cat_id: int, do_download: bool = False, max_pages: int = 0, all_sources: bool = False):
    visited = load_visited()
    page = 1
    total_new = 0
    print(f"\n=== 开始爬取分类 [{cat_id}] {CATEGORIES.get(cat_id, '')} ===")
    while True:
        list_url = get_list_page(cat_id, page)
        print(f"[列表] {list_url}")
        try:
            r = get(list_url)
        except Exception as e:
            print(f"[!] 列表页请求失败: {e}")
            break
        items, has_next, max_p = parse_list_page(r.text)
        print(f"      解析到 {len(items)} 部视频（站点最大页={max_p}）")
        if not items:
            break

        for vid, url in items:
            if vid in visited:
                continue
            try:
                dr = get(url)
                detail = parse_detail_page(dr.text, vid)
                detail["detail_url"] = url
                detail["category_id"] = cat_id
                detail["category"] = CATEGORIES.get(cat_id, "")
                # 逐个进入播放页取 m3u8（默认只取第1条源，可 --all-sources 打开全部）
                if not all_sources:
                    detail["episodes"] = [e for e in detail["episodes"] if e["sid"] == 1]
                print(f"  -> [{cat_id}-{vid}] {detail.get('title','')} "
                      f"共 {len(detail['episodes'])} 条播放记录")
                for ep in detail["episodes"]:
                    m = fetch_episode_m3u8(ep["play_url"])
                    ep.update(m)
                    time.sleep(random.uniform(0.2, 0.5))
                # 保存
                save_record(detail)
                mark_visited(vid)
                visited.add(vid)
                total_new += 1

                # 可选：下载第一个源第一集（演示），要全量下载可改成遍历全部
                if do_download and detail["episodes"]:
                    first = next((e for e in detail["episodes"] if e.get("m3u8")), None)
                    if first:
                        title_safe = safe_name(detail["title"])
                        fname = f"{title_safe}_EP{first['nid']}_{safe_name(first['name'])}.mp4"
                        fpath = VIDEO_DIR / CATEGORIES.get(cat_id, str(cat_id)) / fname
                        try:
                            print(f"     下载: {fpath.name}")
                            download_m3u8(first["m3u8"], fpath, referer=first["play_url"])
                        except Exception as e:
                            print(f"     [warn] 下载失败: {e}")
            except Exception as e:
                print(f"  [!] 处理 {url} 失败: {e}")
                time.sleep(1)

        page += 1
        if max_pages and page > max_pages:
            break
        if page > max_p and max_p > 1:
            # 已翻到最大页
            break
        if not has_next and max_p <= 1:
            break
        time.sleep(random.uniform(0.3, 0.8))
    print(f"=== 分类 {cat_id} 完成，新增 {total_new} 部 ===")


def export_csv():
    """把 catalog.jsonl 导出成扁平 CSV，方便查看"""
    src = OUT_DIR / "catalog.jsonl"
    if not src.exists():
        return
    rows = []
    with open(src, "r", encoding="utf-8") as f:
        for line in f:
            try:
                d = json.loads(line)
            except Exception:
                continue
            for ep in d.get("episodes", []):
                rows.append({
                    "vod_id": d.get("vod_id"),
                    "title": d.get("title"),
                    "category": d.get("category"),
                    "year": d.get("year"),
                    "area": d.get("area"),
                    "tags": ",".join(d.get("tags", [])),
                    "director": d.get("director"),
                    "actors": d.get("actors"),
                    "source": ep.get("source"),
                    "ep_index": ep.get("nid"),
                    "ep_name": ep.get("name"),
                    "m3u8": ep.get("m3u8"),
                    "play_url": ep.get("play_url"),
                    "detail_url": d.get("detail_url"),
                    "cover": d.get("cover"),
                })
    csv_path = OUT_DIR / "catalog.csv"
    with open(csv_path, "w", encoding="utf-8-sig", newline="") as f:
        w = csv.DictWriter(f, fieldnames=list(rows[0].keys()) if rows else [
            "vod_id", "title", "category", "year", "area", "tags",
            "director", "actors", "source", "ep_index", "ep_name",
            "m3u8", "play_url", "detail_url", "cover"
        ])
        w.writeheader()
        w.writerows(rows)
    print(f"[+] 已导出 CSV: {csv_path} 共 {len(rows)} 条播放记录")


def main():
    ap = argparse.ArgumentParser(description="tv.59v.net 全站爬虫")
    ap.add_argument("--download", action="store_true", help="同时下载视频（默认仅抓取 m3u8 地址）")
    ap.add_argument("--cat", type=str, default="1,2,3,4",
                    help="要爬的分类id，逗号分隔；1=电影 2=剧集 3=综艺 4=动漫 (默认全部)")
    ap.add_argument("--max-pages", type=int, default=0, help="每个分类最大页数，0=全部")
    ap.add_argument("--all-sources", action="store_true",
                    help="抓取所有播放线路（默认仅抓取第1条源，速度最快）")
    args = ap.parse_args()

    cats = [int(x) for x in args.cat.split(",") if x.strip().isdigit()]

    print("=" * 60)
    print("  永乐视频 (tv.59v.net) 全站爬虫")
    print(f"  分类: {[(c, CATEGORIES.get(c)) for c in cats]}")
    print(f"  下载视频: {'是' if args.download else '否（仅抓取地址）'}")
    print("=" * 60)

    for c in cats:
        crawl_category(c, do_download=args.download, max_pages=args.max_pages,
                       all_sources=args.all_sources)

    export_csv()
    print("\n[√] 全部完成。")
    print(f"    元数据: {OUT_DIR/'catalog.jsonl'}")
    print(f"    CSV索引: {OUT_DIR/'catalog.csv'}")
    print(f"    已爬ID: {OUT_DIR/'visited.txt'}")
    if args.download:
        print(f"    视频目录: {VIDEO_DIR}")


if __name__ == "__main__":
    main()
