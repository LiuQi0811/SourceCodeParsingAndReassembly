# -*- coding: utf-8 -*-
"""
泥视频 (nivod.vip) 全站爬虫
==========================================
功能:
  1. 遍历电影/剧集/综艺/动漫四大分类所有分页，抓取视频元数据
  2. 进入每个详情页解析所有播放线路和每一集播放页链接
  3. 请求播放页，从 player_aaaa 明文 JSON 里提取 m3u8 / mp4 直链
     (该站 player_aaaa.encrypt=0，无需任何 JS 逆向/解密)
  4. 结果保存为 JSON(完整结构化) + CSV(清单)
  5. 可选使用 --download 触发 m3u8 视频下载(依赖 ffmpeg)

用法:
  # 仅抓取全站元数据 + m3u8地址(默认)
  python nivod_spider.py

  # 指定分类/并发/起始页
  python nivod_spider.py --types 1,2 --concurrency 16

  # 抓完元数据后调用 ffmpeg 下载视频
  python nivod_spider.py --download --download-dir ./videos

  # 断点续爬(已抓详情页自动跳过)
  python nivod_spider.py --resume
"""

import argparse
import csv
import json
import os
import re
import sys
import time
import random
import logging
from collections import defaultdict
from concurrent.futures import ThreadPoolExecutor, as_completed
from urllib.parse import urljoin

import requests
from bs4 import BeautifulSoup

# ------------------------------------------------------------------
# 常量
# ------------------------------------------------------------------
BASE_URL = "https://www.nivod.vip"
HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/120.0.0.0 Safari/537.36"
    ),
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
    "Referer": BASE_URL + "/",
}
# 四大分类: 1=电影 2=剧集 3=综艺 4=动漫
TYPE_MAP = {1: "电影", 2: "剧集", 3: "综艺", 4: "动漫"}
TIMEOUT = 20
RETRY = 3

# 输出目录
OUT_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.path.join(OUT_DIR, "data")
os.makedirs(DATA_DIR, exist_ok=True)

# ------------------------------------------------------------------
# 日志
# ------------------------------------------------------------------
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%H:%M:%S",
)
log = logging.getLogger("nivod")


# ------------------------------------------------------------------
# HTTP 工具
# ------------------------------------------------------------------
class Fetcher:
    def __init__(self):
        self.s = requests.Session()
        self.s.headers.update(HEADERS)

    def get(self, url, **kwargs):
        for i in range(RETRY):
            try:
                r = self.s.get(url, timeout=TIMEOUT, **kwargs)
                r.encoding = r.apparent_encoding or "utf-8"
                if r.status_code == 200 and len(r.text) > 2000:
                    return r.text
                log.warning("异常响应 %s -> %s len=%s", url, r.status_code, len(r.text))
            except Exception as e:
                log.warning("请求失败(%d) %s: %s", i + 1, url, e)
            time.sleep(1 + random.random())
        return None


fetcher = Fetcher()


# ------------------------------------------------------------------
# 解析工具
# ------------------------------------------------------------------
def parse_list_page(html):
    """从分类列表页提取当前页所有视频详情链接及尾页页码"""
    soup = BeautifulSoup(html, "lxml")
    items = []
    for a in soup.select("a.module-poster-item, a.module-card-item, a[href*='/nivod/']"):
        href = a.get("href", "")
        m = re.match(r"/nivod/(\d+)/?", href)
        if not m:
            continue
        vid = m.group(1)
        title = a.get("title") or a.get("alt") or ""
        if not title:
            title_el = a.select_one(".module-card-item-title, .module-poster-item-title")
            if title_el:
                title = title_el.get_text(strip=True)
        if not title:
            # 兜底: 图片 alt
            img = a.find("img")
            if img:
                title = img.get("alt", "")
        items.append({"id": vid, "title": title, "url": urljoin(BASE_URL, href)})
    # 去重
    seen = set()
    unique = []
    for it in items:
        if it["id"] not in seen:
            seen.add(it["id"])
            unique.append(it)
    # 尾页页码
    total_pages = 1
    last_a = soup.select_one(".page a:contains('尾页'), a:contains('尾页')")
    if last_a:
        m = re.search(r"(\d+)---/?$", last_a.get("href", ""))
        if m:
            total_pages = int(m.group(1))
    else:
        # 无尾页则通过数字链接最大页推断
        nums = []
        for a in soup.select(".page a"):
            m = re.search(r"--------(\d+)---/?$", a.get("href", ""))
            if m:
                nums.append(int(m.group(1)))
        if nums:
            total_pages = max(nums)
    return unique, total_pages


def parse_detail_page(vid, html):
    """解析详情页元数据 + 各线路所有剧集"""
    soup = BeautifulSoup(html, "lxml")
    info = {"id": vid, "url": f"{BASE_URL}/nivod/{vid}/"}
    # 标题
    h1 = soup.find("h1")
    info["title"] = h1.get_text(strip=True) if h1 else ""
    # 封面
    img = soup.select_one(".module-item-pic img, .module-info-pic img, .detail-pic img, img.lazyload")
    if img:
        info["cover"] = img.get("data-src") or img.get("data-original") or img.get("src", "")
        if info["cover"] and info["cover"].startswith("//"):
            info["cover"] = "https:" + info["cover"]
    # 基础字段 (class="video-info-items" 类似结构)
    text_blocks = []
    block = soup.select_one(".module-info-items, .video-info-items, .detail-info")
    meta_text = ""
    if block:
        meta_text = block.get_text(" ", strip=True)
    else:
        # 兜底: 整个详情信息区
        info_box = soup.select_one(".module-info-main, .module-info")
        if info_box:
            meta_text = info_box.get_text(" ", strip=True)
    info["meta_text"] = meta_text
    # 简介
    desc_el = soup.select_one(".module-info-introduction-content, .video-content, .detail-desc, .module-info-desc")
    info["description"] = desc_el.get_text(" ", strip=True) if desc_el else ""
    # 评分/年份/类型/地区/语言(从a标签提取)
    tag_links = soup.select(
        ".module-info-tag-link a, .module-info-items a, .video-info-items a, .detail-info a"
    )
    info["tags"] = [a.get_text(strip=True) for a in tag_links if a.get_text(strip=True)]

    # ------ 解析选集 ------
    # 该站点是 MacCMS10: 多个播放源 tab，每个 tab 下有 module-play-list-link 链接
    episodes = []
    # 方法1: 直接按 /niplay/{vid}-{sid}-{nid}/ 链接整体解析
    all_links = re.findall(
        r'href="(/niplay/(\d+)-(\d+)-(\d+)/)"[^>]*class="module-play-list-link"[^>]*title="([^"]*)"[^>]*>\s*<span>([^<]*)</span>',
        html,
    )
    if not all_links:
        # 兜底: 任意顺序
        all_links = re.findall(
            r'href="(/niplay/(\d+)-(\d+)-(\d+)/)"[^>]*title="([^"]*)"',
            html,
        )
    # 解析线路名 tab: data-dropdown-value
    source_names = re.findall(r'data-dropdown-value="([^"]+)"', html)

    # 线路按 sid 分组
    per_source = defaultdict(list)
    for href, v, sid, nid, title, *rest in all_links:
        if v != vid:
            continue
        ep_name = rest[0] if rest else title.replace(info["title"], "").strip()
        per_source[sid].append(
            {
                "nid": int(nid),
                "title": ep_name or f"第{nid}集",
                "play_url": urljoin(BASE_URL, href),
            }
        )
    # 按 nid 排序
    sources = []
    for idx, sid in enumerate(sorted(per_source.keys(), key=int)):
        lst = sorted(per_source[sid], key=lambda x: x["nid"])
        sname = source_names[idx] if idx < len(source_names) else f"线路{sid}"
        sources.append({"source_id": int(sid), "source_name": sname, "episodes": lst})
    info["sources"] = sources
    return info


def parse_play_page(html):
    """从播放页解析 player_aaaa JSON，拿到真实 m3u8/mp4 地址
    (encrypt=0 明文，无需任何解密)
    """
    m = re.search(r"var\s+player_aaaa\s*=\s*(\{.*?\})\s*<", html, re.S)
    if not m:
        m = re.search(r"var\s+player_aaaa\s*=\s*(\{.*?\})\s*;", html, re.S)
    if not m:
        return None
    try:
        # 处理转义
        raw = m.group(1).replace("\\/", "/").encode().decode("unicode_escape", errors="replace")
        # 正则直接 JSON parse 更稳
        # 重新取原始 json 字符串，避免 unicode_escape 误伤
        raw = m.group(1)
        # 把JSON里的 \/ 还原为 /，\uXXXX 通过json.loads自行处理
        data = json.loads(raw)
        return {
            "url": data.get("url"),
            "url_next": data.get("url_next"),
            "from": data.get("from"),
            "encrypt": data.get("encrypt", 0),
            "vod_name": data.get("vod_data", {}).get("vod_name") if data.get("vod_data") else None,
        }
    except Exception as e:
        log.warning("解析player_aaaa失败: %s", e)
        return None


# ------------------------------------------------------------------
# 核心爬取流程
# ------------------------------------------------------------------
def fetch_video(vid, base_title=""):
    """抓取单个视频的详情 + 所有线路的真实播放地址"""
    detail_html = fetcher.get(f"{BASE_URL}/nivod/{vid}/")
    if not detail_html:
        return None
    info = parse_detail_page(vid, detail_html)
    if base_title and not info["title"]:
        info["title"] = base_title
    # 抓取每集播放页拿真实m3u8
    total_ep = sum(len(s["episodes"]) for s in info["sources"])
    done = 0
    for src in info["sources"]:
        for ep in src["episodes"]:
            play_html = fetcher.get(ep["play_url"])
            if play_html:
                pa = parse_play_page(play_html)
                if pa:
                    ep["m3u8"] = pa["url"]
                    ep["provider"] = pa["from"]
                else:
                    ep["m3u8"] = None
            done += 1
            if done % 20 == 0:
                log.debug("%s 进度 %d/%d", info["title"], done, total_ep)
            # 限速防封
            time.sleep(0.2 + random.random() * 0.3)
    return info


def crawl_type(type_id, max_pages=0, concurrency=4, resume=False):
    """抓取某个分类"""
    type_name = TYPE_MAP.get(type_id, str(type_id))
    log.info("开始抓取分类: [%s] id=%s", type_name, type_id)
    # 先拿第一页确定总页数
    first_url = f"{BASE_URL}/k/{type_id}-----------/"
    first_html = fetcher.get(first_url)
    if not first_html:
        log.error("首页获取失败: %s", first_url)
        return []
    first_items, total_pages = parse_list_page(first_html)
    if max_pages and max_pages < total_pages:
        total_pages = max_pages
    log.info("[%s] 总页数: %s", type_name, total_pages)

    # 收集所有列表页url
    page_urls = [first_url]
    for p in range(2, total_pages + 1):
        page_urls.append(f"{BASE_URL}/k/{type_id}--------{p}---/")

    # 抓所有列表页，收集视频ID
    all_videos = {}  # id -> {title,url}
    for idx, url in enumerate(page_urls, 1):
        if idx == 1:
            items = first_items
        else:
            html = fetcher.get(url)
            if not html:
                continue
            items, _ = parse_list_page(html)
        for it in items:
            if it["id"] not in all_videos:
                all_videos[it["id"]] = it
        if idx % 10 == 0 or idx == total_pages:
            log.info("[%s] 列表进度 %d/%d, 累计视频 %d", type_name, idx, total_pages, len(all_videos))
        time.sleep(0.3 + random.random() * 0.4)
    log.info("[%s] 列表抓取完毕，共发现 %d 个视频", type_name, len(all_videos))

    # 断点续爬：加载已完成
    done_file = os.path.join(DATA_DIR, f"done_{type_id}.txt")
    done_ids = set()
    if resume and os.path.exists(done_file):
        done_ids = {x.strip() for x in open(done_file, encoding="utf-8") if x.strip()}
        log.info("[%s] 断点续爬: 已完成 %d 个", type_name, len(done_ids))

    results = []
    todo = [(vid, meta) for vid, meta in all_videos.items() if vid not in done_ids]
    log.info("[%s] 待抓详情 %d 个", type_name, len(todo))

    df = open(done_file, "a", encoding="utf-8")
    try:
        with ThreadPoolExecutor(max_workers=concurrency) as ex:
            futures = {
                ex.submit(fetch_video, vid, meta["title"]): vid
                for vid, meta in todo
            }
            for cnt, fut in enumerate(as_completed(futures), 1):
                vid = futures[fut]
                try:
                    info = fut.result()
                except Exception as e:
                    log.error("[%s] 抓视频 %s 异常: %s", type_name, vid, e)
                    continue
                if info:
                    info["type_id"] = type_id
                    info["type_name"] = type_name
                    results.append(info)
                    df.write(vid + "\n")
                    df.flush()
                if cnt % 10 == 0:
                    log.info(
                        "[%s] 详情进度 %d/%d 结果%d",
                        type_name, cnt, len(todo), len(results)
                    )
    finally:
        df.close()
    return results


# ------------------------------------------------------------------
# 保存结果
# ------------------------------------------------------------------
def save_results(all_data):
    json_path = os.path.join(DATA_DIR, "nivod_all.json")
    with open(json_path, "w", encoding="utf-8") as f:
        json.dump(all_data, f, ensure_ascii=False, indent=2)
    log.info("已保存 JSON: %s (%d 个视频)", json_path, len(all_data))

    # 明细CSV: 每集一行
    csv_path = os.path.join(DATA_DIR, "nivod_episodes.csv")
    with open(csv_path, "w", encoding="utf-8-sig", newline="") as f:
        w = csv.writer(f)
        w.writerow(
            [
                "type", "vid", "title", "source", "episode_no", "episode_title",
                "play_page", "m3u8_url",
            ]
        )
        for v in all_data:
            for s in v.get("sources", []):
                for ep in s["episodes"]:
                    w.writerow(
                        [
                            v.get("type_name", ""),
                            v["id"],
                            v.get("title", ""),
                            s["source_name"],
                            ep["nid"],
                            ep.get("title", ""),
                            ep["play_url"],
                            ep.get("m3u8", ""),
                        ]
                    )
    log.info("已保存 CSV: %s", csv_path)
    return json_path, csv_path


# ------------------------------------------------------------------
# 下载 m3u8 视频
# ------------------------------------------------------------------
def download_videos(all_data, out_dir, max_videos=0, concurrency=2):
    import subprocess
    os.makedirs(out_dir, exist_ok=True)
    jobs = []
    for v in all_data:
        for s in v["sources"]:
            for ep in s["episodes"]:
                url = ep.get("m3u8")
                if not url:
                    continue
                safe_title = re.sub(r'[\\/:*?"<>|]', "_", v.get("title", "unknown"))
                fname = f"{safe_title}_S{s['source_id']}E{ep['nid']}.mp4"
                fpath = os.path.join(out_dir, fname)
                if os.path.exists(fpath) and os.path.getsize(fpath) > 1024:
                    continue
                jobs.append((url, fpath))
                if max_videos and len(jobs) >= max_videos:
                    break
            if max_videos and len(jobs) >= max_videos:
                break
        if max_videos and len(jobs) >= max_videos:
            break
    log.info("待下载视频: %d", len(jobs))
    for i, (url, fpath) in enumerate(jobs, 1):
        log.info("[%d/%d] ffmpeg 下载: %s", i, len(jobs), os.path.basename(fpath))
        cmd = [
            "ffmpeg", "-y", "-hide_banner", "-loglevel", "warning",
            "-headers", f"Referer: {BASE_URL}/\r\nUser-Agent: {HEADERS['User-Agent']}",
            "-i", url, "-c", "copy", fpath,
        ]
        try:
            subprocess.run(cmd, check=True)
            log.info("完成: %s", fpath)
        except subprocess.CalledProcessError as e:
            log.error("下载失败 %s: %s", url, e)


# ------------------------------------------------------------------
# CLI 入口
# ------------------------------------------------------------------
def main():
    ap = argparse.ArgumentParser(description="泥视频 nivod.vip 全站爬虫 (无加密，m3u8直出)")
    ap.add_argument("--types", default="1,2,3,4", help="分类id逗号分隔 1电影 2剧集 3综艺 4动漫 (默认全部)")
    ap.add_argument("--max-pages", type=int, default=0, help="每个分类最多抓多少页 (0=全部)")
    ap.add_argument("--concurrency", type=int, default=4, help="并发线程数 (默认4，过高易被封)")
    ap.add_argument("--resume", action="store_true", help="断点续爬(跳过已完成视频)")
    ap.add_argument("--download", action="store_true", help="抓完元数据后调用ffmpeg下载视频")
    ap.add_argument("--download-dir", default="./videos", help="视频保存目录")
    ap.add_argument("--max-download", type=int, default=0, help="最多下载几个视频 (0=全部，慎用)")
    args = ap.parse_args()

    type_ids = [int(x) for x in args.types.split(",") if x.strip().isdigit()]
    all_data = []
    for tid in type_ids:
        data = crawl_type(
            tid,
            max_pages=args.max_pages,
            concurrency=args.concurrency,
            resume=args.resume,
        )
        all_data.extend(data)
        # 每抓完一个分类就保存一次中间结果
        save_results(all_data)
    json_path, csv_path = save_results(all_data)
    print("\n================ 抓取完成 ================")
    print(f"视频数: {len(all_data)}")
    print(f"JSON: {json_path}")
    print(f"CSV : {csv_path}")

    if args.download:
        # 检查ffmpeg
        import shutil
        if not shutil.which("ffmpeg"):
            log.error("未找到ffmpeg，跳过下载。请先安装ffmpeg。")
        else:
            download_videos(
                all_data,
                args.download_dir,
                max_videos=args.max_download,
            )


if __name__ == "__main__":
    main()
