#!/usr/bin/env python3
"""
Mixkit.co 全站资源爬虫
======================
Mixkit (https://mixkit.co/) 是 Envato 旗下免费可商用素材平台。
经逆向分析，该站**无任何JS加密、无签名验证、无需登录**，所有资源直链可预测：

  视频 (Stock Video):   https://assets.mixkit.co/videos/{id}/{id}-{res}.mp4
                        res ∈ {360, 720, 1080, 2160}  ← 2160即4K
  音乐 (Stock Music):   https://assets.mixkit.co/music/{id}/{id}.mp3
  音效 (Sound Effects): https://assets.mixkit.co/active_storage/sfx/{id}/{id}.wav
                        预览: .../{id}-preview.mp3
  插画 (Stock Art):     https://assets.mixkit.co/art/{id}/{id}-{size}.png
                        size ∈ {original, phone-wallpaper, desktop-wallpaper}
  视频模板 (Templates): https://assets.mixkit.co/video-templates/{id}/mixkit-{id}.zip

策略：
  1. 下载并解析官方 sitemap 获得所有资源详情页 URL → 提取 ID
  2. 按类别并发下载资源文件，支持断点续传、失败重试、限速
  3. 支持只下载某一类别 / 某一分辨率 / 指定 ID 范围
  4. 自动生成 CSV 元数据清单

用法示例：
  python mixkit_scraper.py                          # 默认下载全部视频(1080p)+音乐+音效
  python mixkit_scraper.py --type video --res 2160  # 下载全部4K视频
  python mixkit_scraper.py --type music             # 只下载音乐
  python mixkit_scraper.py --type all --res 1080    # 下载全部资源
  python mixkit_scraper.py --type video --workers 10 --res 720  # 10并发720p
  python mixkit_scraper.py --test                   # 仅测试下载前3个资源验证可用性
"""

import os
import re
import sys
import csv
import gzip
import time
import json
import logging
import argparse
import hashlib
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor, as_completed
from urllib.parse import urlparse, unquote
from datetime import datetime

import requests
from bs4 import BeautifulSoup
from tqdm import tqdm

# ============ 配置 ============
BASE_URL = "https://mixkit.co"
ASSETS_VIDEO = "https://assets.mixkit.co/videos/{id}/{id}-{res}.mp4"
ASSETS_MUSIC = "https://assets.mixkit.co/music/{id}/{id}.mp3"
ASSETS_SFX   = "https://assets.mixkit.co/active_storage/sfx/{id}/{id}.wav"
ASSETS_SFX_PREVIEW = "https://assets.mixkit.co/active_storage/sfx/{id}/{id}-preview.mp3"
ASSETS_ART   = "https://assets.mixkit.co/art/{id}/{id}-{size}.png"
ASSETS_TPL   = "https://assets.mixkit.co/video-templates/{id}/mixkit-{id}.zip"

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
                  "(KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
    "Accept": "*/*",
    "Accept-Language": "en-US,en;q=0.9",
    "Referer": "https://mixkit.co/",
}

OUTPUT_ROOT = Path("./mixkit_downloads")
SITEMAP_CACHE = Path("./.sitemap_cache")
TIMEOUT = 60
RETRY = 3
RETRY_DELAY = 2

# ============ 日志 ============
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%H:%M:%S",
)
log = logging.getLogger("mixkit")


# ============ 工具函数 ============
def ensure_dir(p: Path):
    p.mkdir(parents=True, exist_ok=True)


def safe_name(s: str) -> str:
    """把 URL slug 转为安全文件名"""
    return re.sub(r'[\\/:*?"<>|]+', '_', s).strip('_')


def http_get(url: str, stream=False, timeout=TIMEOUT):
    """带重试的 GET 请求"""
    for i in range(RETRY):
        try:
            r = requests.get(url, headers=HEADERS, stream=stream, timeout=timeout, allow_redirects=True)
            if r.status_code == 200:
                return r
            elif r.status_code == 403:
                log.warning(f"403 Forbidden: {url}")
                return None
            elif r.status_code == 404:
                return None
            else:
                log.warning(f"HTTP {r.status_code} for {url}, retry {i+1}/{RETRY}")
        except requests.RequestException as e:
            log.warning(f"Request error for {url}: {e}, retry {i+1}/{RETRY}")
        if i < RETRY - 1:
            time.sleep(RETRY_DELAY * (i + 1))
    return None


def download_file(url: str, dst: Path, expected_size: int = None, resume: bool = True) -> bool:
    """
    下载单个文件，支持断点续传、进度显示。
    返回 True 表示成功/已存在完整文件。
    """
    if dst.exists():
        fsize = dst.stat().st_size
        if expected_size and fsize == expected_size:
            return True
        if not expected_size and fsize > 0:
            # 无法验证大小，简单检查非空
            return True
        # 文件不完整 → 重下
        if not resume:
            dst.unlink(missing_ok=True)

    # 获取文件大小（HEAD）
    head = None
    try:
        head = requests.head(url, headers=HEADERS, timeout=15, allow_redirects=True)
    except Exception:
        pass

    total = None
    if head and head.status_code == 200:
        total = int(head.headers.get("content-length", 0)) or None

    # 断点续传
    existing = dst.stat().st_size if dst.exists() else 0
    headers = dict(HEADERS)
    if existing > 0 and total and existing < total:
        headers["Range"] = f"bytes={existing}-"
        mode = "ab"
    else:
        existing = 0
        mode = "wb"

    r = http_get(url, stream=True)
    if r is None:
        return False

    total = int(r.headers.get("content-length", 0)) + existing or None

    tmp = dst.with_suffix(dst.suffix + ".part")
    ensure_dir(tmp.parent)

    try:
        with open(tmp, mode) as f:
            with tqdm(
                total=total,
                initial=existing,
                unit='B',
                unit_scale=True,
                unit_divisor=1024,
                desc=dst.name[:40].ljust(40),
                leave=False,
                mininterval=0.5,
            ) as bar:
                for chunk in r.iter_content(chunk_size=1024 * 256):
                    if chunk:
                        f.write(chunk)
                        bar.update(len(chunk))
        tmp.rename(dst)
        return True
    except Exception as e:
        log.error(f"Download failed {url}: {e}")
        if tmp.exists() and tmp.stat().st_size == 0:
            tmp.unlink(missing_ok=True)
        return False


# ============ Sitemap 解析 ============
def fetch_sitemap(url: str, cache_name: str) -> str:
    """下载并解压 gzip sitemap，返回 XML 文本"""
    ensure_dir(SITEMAP_CACHE)
    cache_file = SITEMAP_CACHE / cache_name
    if cache_file.exists():
        return cache_file.read_text(encoding="utf-8", errors="ignore")

    log.info(f"Fetching sitemap: {url}")
    r = http_get(url)
    if r is None:
        return ""
    data = r.content
    try:
        text = gzip.decompress(data).decode("utf-8", errors="ignore")
    except OSError:
        text = data.decode("utf-8", errors="ignore")
    cache_file.write_text(text, encoding="utf-8")
    return text


def extract_urls_from_sitemap(xml_text: str):
    """从 sitemap XML 中提取 <loc>URL</loc>"""
    return re.findall(r'<loc>(https?://[^<]+)</loc>', xml_text)


def collect_video_ids() -> list:
    """从视频 sitemap 收集所有视频 ID 和 slug"""
    index_xml = fetch_sitemap(f"{BASE_URL}/sitemaps/sitemap-video.xml.gz", "sitemap_video_index.xml")
    shard_urls = extract_urls_from_sitemap(index_xml)
    videos = []
    seen = set()
    for idx, surl in enumerate(shard_urls):
        xml_text = fetch_sitemap(surl, f"video_shard_{idx}.xml")
        for page_url in extract_urls_from_sitemap(xml_text):
            m = re.match(r'https://mixkit\.co/free-stock-video/([a-z0-9-]+)-(\d+)/?$', page_url)
            if m:
                slug, vid = m.group(1), int(m.group(2))
                if vid not in seen:
                    seen.add(vid)
                    videos.append({"id": vid, "slug": slug, "url": page_url})
    log.info(f"Collected {len(videos)} videos from sitemap")
    return videos


def _probe_ids(base_url_pattern: str, id_range: range, workers: int = 50) -> list:
    """并发HEAD探测连续ID，返回存在的ID列表"""
    import concurrent.futures
    found = []
    session = requests.Session()
    session.headers.update(HEADERS)

    def check(mid):
        url = base_url_pattern.format(id=mid)
        try:
            r = session.head(url, timeout=6, allow_redirects=True)
            return mid, r.status_code == 200
        except Exception:
            return mid, False

    ids = list(id_range)
    with concurrent.futures.ThreadPoolExecutor(max_workers=workers) as ex:
        futures = {ex.submit(check, i): i for i in ids}
        with tqdm(total=len(futures), desc=f"Probing IDs ({id_range.start}-{id_range.stop-1})", unit="id", leave=False) as bar:
            for fut in concurrent.futures.as_completed(futures):
                mid, ok = fut.result()
                if ok:
                    found.append(mid)
                bar.update(1)
    return sorted(found)


# 各类型ID上限（根据实测，留适当余量）
ID_LIMITS = {
    "music": 1400,
    "sfx": 3500,
    "art": 700,
    "tpl": 900,
}


def collect_music_ids() -> list:
    """音乐收集：ID连续，直接并发探测有效ID"""
    # 先从首页采样验证上限
    r = http_get(f"{BASE_URL}/free-stock-music/")
    max_seen = 0
    if r:
        ids_found = [int(x) for x in re.findall(r'assets\.mixkit\.co/music/(\d+)/\1\.mp3', r.text)]
        if ids_found:
            max_seen = max(ids_found)
    max_id = max(max_seen + 200, ID_LIMITS["music"])
    log.info(f"Probing music IDs 1-{max_id} ...")
    valid_ids = _probe_ids("https://assets.mixkit.co/music/{id}/{id}.mp3", range(1, max_id + 1))
    music_items = [{"id": mid, "slug": f"track-{mid}", "url": f"https://mixkit.co/free-stock-music/"} for mid in valid_ids]
    log.info(f"Collected {len(music_items)} music tracks")
    return music_items


def collect_sfx_ids() -> list:
    """音效收集：ID连续，并发探测"""
    xml_text = fetch_sitemap(f"{BASE_URL}/sitemaps/sitemap-sfx.xml.gz", "sitemap_sfx_index.xml")

    seen = set()
    max_seen = 0
    r = http_get(f"{BASE_URL}/free-sound-effects/")
    if r:
        ids_found = [int(x) for x in re.findall(r'assets\.mixkit\.co/active_storage/sfx/(\d+)/', r.text)]
        if ids_found:
            max_seen = max(ids_found)

    # 几个分类页采样
    cat_urls = extract_urls_from_sitemap(xml_text)[:10]
    for cat_url in cat_urls:
        resp = http_get(cat_url)
        if resp:
            ids_found = [int(x) for x in re.findall(r'assets\.mixkit\.co/active_storage/sfx/(\d+)/', resp.text)]
            if ids_found:
                max_seen = max(max_seen, max(ids_found))

    # 主sitemap补充详情页ID
    main_xml = fetch_sitemap(f"{BASE_URL}/sitemaps/sitemap.xml.gz", "sitemap_main.xml")
    for u in extract_urls_from_sitemap(main_xml):
        m = re.match(r'https://mixkit\.co/free-sound-effects/[a-z0-9-]+-(\d+)/?$', u)
        if m:
            seen.add(int(m.group(1)))

    max_id = max(max_seen + 200, ID_LIMITS["sfx"])
    log.info(f"Probing SFX IDs 1-{max_id} ...")
    valid_ids = _probe_ids("https://assets.mixkit.co/active_storage/sfx/{id}/{id}.wav", range(1, max_id + 1))
    all_ids = sorted(seen | set(valid_ids))
    sfx_items = [{"id": sid, "slug": f"sfx-{sid}", "url": f"https://mixkit.co/free-sound-effects/"} for sid in all_ids]
    log.info(f"Collected {len(sfx_items)} sound effects")
    return sfx_items


def collect_art_ids() -> list:
    """插画收集：ID连续，并发探测"""
    seen = set()
    max_seen = 0

    # 从sitemap
    xml_text = fetch_sitemap(f"{BASE_URL}/sitemaps/sitemap.xml.gz", "sitemap_main.xml")
    for u in extract_urls_from_sitemap(xml_text):
        m = re.match(r'https://mixkit\.co/free-stock-art/[a-z0-9-]+-(\d+)/?$', u)
        if m:
            aid = int(m.group(1))
            seen.add(aid)
            max_seen = max(max_seen, aid)

    # 列表页采样
    r = http_get(f"{BASE_URL}/free-stock-art/")
    if r:
        ids_found = [int(x) for x in re.findall(r'assets\.mixkit\.co/art/(\d+)/', r.text)]
        if ids_found:
            max_seen = max(max_seen, max(ids_found))

    max_id = max(max_seen + 100, ID_LIMITS["art"])
    log.info(f"Probing art IDs 1-{max_id} ...")
    valid_ids = _probe_ids("https://assets.mixkit.co/art/{id}/{id}-original.png", range(1, max_id + 1))
    all_ids = sorted(seen | set(valid_ids))
    art_items = [{"id": aid, "slug": f"art-{aid}", "url": f"https://mixkit.co/free-stock-art/"} for aid in all_ids]
    log.info(f"Collected {len(art_items)} art illustrations")
    return art_items


def collect_template_ids() -> list:
    """视频模板收集：ID连续，并发探测"""
    tpl_types = [
        "free-video-templates",
        "free-premiere-pro-templates",
        "free-after-effects-templates",
        "free-final-cut-pro-templates",
        "free-davinci-resolve-templates",
    ]
    tpl_items = []
    seen = set()
    max_seen = 0

    # 从sitemap
    xml_text = fetch_sitemap(f"{BASE_URL}/sitemaps/sitemap.xml.gz", "sitemap_main.xml")
    for u in extract_urls_from_sitemap(xml_text):
        for ttype in tpl_types:
            m = re.match(rf'https://mixkit\.co/{ttype}/[a-z0-9-]+-(\d+)/?$', u)
            if m:
                tid = int(m.group(1))
                if tid not in seen:
                    seen.add(tid)
                    tpl_items.append({"id": tid, "slug": f"tpl-{tid}", "url": u, "tpl_type": ttype})
                    max_seen = max(max_seen, tid)

    # 列表页采样
    for ttype in tpl_types:
        resp = http_get(f"{BASE_URL}/{ttype}/")
        if resp:
            ids_found = [int(x) for x in re.findall(rf'/{ttype}/download/(\d+)/', resp.text)]
            if ids_found:
                for tid in ids_found:
                    if tid not in seen:
                        seen.add(tid)
                        tpl_items.append({"id": tid, "slug": f"tpl-{tid}",
                                          "url": f"{BASE_URL}/{ttype}/", "tpl_type": ttype})
                max_seen = max(max_seen, max(ids_found))

    max_id = max(max_seen + 200, ID_LIMITS["tpl"])
    log.info(f"Probing template IDs 1-{max_id} ...")

    session = requests.Session()
    session.headers.update(HEADERS)

    def check_tpl(tid):
        url = ASSETS_TPL.format(id=tid)
        try:
            r = session.head(url, timeout=6, allow_redirects=True)
            if r.status_code == 200:
                return tid, True
        except Exception:
            pass
        return tid, False

    import concurrent.futures
    with concurrent.futures.ThreadPoolExecutor(max_workers=50) as ex:
        futures = {ex.submit(check_tpl, i): i for i in range(1, max_id + 1)}
        with tqdm(total=len(futures), desc=f"Probing template IDs (1-{max_id})", unit="id", leave=False) as bar:
            for fut in concurrent.futures.as_completed(futures):
                tid, ok = fut.result()
                if ok and tid not in seen:
                    seen.add(tid)
                    tpl_items.append({"id": tid, "slug": f"tpl-{tid}",
                                      "url": f"{BASE_URL}/free-video-templates/", "tpl_type": "free-video-templates"})
                bar.update(1)

    log.info(f"Collected {len(tpl_items)} video templates")
    return tpl_items


# ============ 单资源下载器 ============
def dl_video(item, out_dir: Path, res: int = 1080) -> dict:
    vid = item["id"]
    slug = item["slug"]
    url = ASSETS_VIDEO.format(id=vid, res=res)
    fname = f"{slug}-{vid}-{res}p.mp4"
    dst = out_dir / safe_name(fname)
    ok = download_file(url, dst)
    return {"type": "video", "id": vid, "slug": slug, "file": str(dst) if ok else "",
            "resolution": res, "url": url, "ok": ok}


def dl_music(item, out_dir: Path) -> dict:
    mid = item["id"]
    slug = item["slug"]
    url = ASSETS_MUSIC.format(id=mid)
    fname = f"{slug}-{mid}.mp3"
    dst = out_dir / safe_name(fname)
    ok = download_file(url, dst)
    return {"type": "music", "id": mid, "slug": slug, "file": str(dst) if ok else "",
            "url": url, "ok": ok}


def dl_sfx(item, out_dir: Path, preview_only: bool = False) -> dict:
    sid = item["id"]
    slug = item["slug"]
    if preview_only:
        url = ASSETS_SFX_PREVIEW.format(id=sid)
        fname = f"{slug}-{sid}-preview.mp3"
    else:
        url = ASSETS_SFX.format(id=sid)
        fname = f"{slug}-{sid}.wav"
    dst = out_dir / safe_name(fname)
    ok = download_file(url, dst)
    # 如果wav下载失败，回退到preview
    if not ok and not preview_only:
        url = ASSETS_SFX_PREVIEW.format(id=sid)
        fname = f"{slug}-{sid}-preview.mp3"
        dst = out_dir / safe_name(fname)
        ok = download_file(url, dst)
    return {"type": "sfx", "id": sid, "slug": slug, "file": str(dst) if ok else "",
            "url": url, "ok": ok}


def dl_art(item, out_dir: Path, size: str = "original") -> dict:
    aid = item["id"]
    slug = item["slug"]
    url = ASSETS_ART.format(id=aid, size=size)
    ext = "png"
    fname = f"{slug}-{aid}-{size}.{ext}"
    dst = out_dir / safe_name(fname)
    ok = download_file(url, dst)
    return {"type": "art", "id": aid, "slug": slug, "file": str(dst) if ok else "",
            "size": size, "url": url, "ok": ok}


def dl_template(item, out_dir: Path) -> dict:
    """模板需要从详情页/下载端点获取真实URL"""
    tid = item["id"]
    slug = item["slug"]
    ttype = item["tpl_type"]

    # 先尝试直链模式
    url = ASSETS_TPL.format(id=tid)
    fname = f"{slug}-{tid}.zip"
    dst = out_dir / ttype / safe_name(fname)
    ensure_dir(dst.parent)
    ok = download_file(url, dst)
    if not ok:
        # 回退：请求下载端点获取真实URL
        dl_page_url = f"{BASE_URL}/{ttype}/download/{tid}/"
        r = http_get(dl_page_url)
        if r:
            m = re.search(r'data-download--modal-url-value="([^"]+)"', r.text)
            if m:
                real_url = m.group(1).replace("&amp;", "&")
                ok = download_file(real_url, dst)
    return {"type": f"template/{ttype}", "id": tid, "slug": slug,
            "file": str(dst) if ok else "", "url": url, "ok": ok}


# ============ 批量下载调度 ============
def run_batch(download_fn, items, workers: int, out_dir: Path, label: str,
              csv_writer=None, csv_file=None, extra_kwargs=None):
    """通用批量下载"""
    ensure_dir(out_dir)
    results = []
    failed = 0
    success = 0
    extra_kwargs = extra_kwargs or {}

    with ThreadPoolExecutor(max_workers=workers) as ex:
        futures = {ex.submit(download_fn, item, out_dir, **extra_kwargs): item for item in items}
        with tqdm(total=len(futures), desc=label, unit="file") as pbar:
            for fut in as_completed(futures):
                try:
                    res = fut.result()
                    results.append(res)
                    if res["ok"]:
                        success += 1
                    else:
                        failed += 1
                        log.warning(f"Failed: {res.get('url', '')}")
                    if csv_writer:
                        csv_writer.writerow(res)
                        if csv_file:
                            csv_file.flush()
                except Exception as e:
                    failed += 1
                    log.error(f"Exception: {e}")
                pbar.update(1)

    log.info(f"{label} done: {success} success, {failed} failed, saved to {out_dir}")
    return results


# ============ 主函数 ============
def main():
    global OUTPUT_ROOT
    parser = argparse.ArgumentParser(description="Mixkit.co 全站素材爬虫 (无需登录/无加密/直链下载)")
    parser.add_argument("--type", default="video",
                        choices=["video", "music", "sfx", "art", "template", "all"],
                        help="下载类别 (默认 video)")
    parser.add_argument("--res", type=int, default=1080, choices=[360, 720, 1080, 2160],
                        help="视频分辨率 (默认 1080p, 2160=4K)")
    parser.add_argument("--art-size", default="original",
                        choices=["original", "phone-wallpaper", "desktop-wallpaper"],
                        help="插画尺寸 (默认 original 原图)")
    parser.add_argument("--sfx-preview-only", action="store_true",
                        help="音效只下载预览mp3（更小，不用下载wav）")
    parser.add_argument("--workers", type=int, default=5, help="并发数 (默认 5)")
    parser.add_argument("--output", default=str(OUTPUT_ROOT), help="下载根目录")
    parser.add_argument("--test", action="store_true", help="测试模式：只下载每个类别的前3个文件")
    parser.add_argument("--max-id", type=int, default=0, help="最大ID限制（0=不限制）")
    parser.add_argument("--no-resume", action="store_true", help="不使用断点续传，已存在文件重新下载")
    args = parser.parse_args()

    OUTPUT_ROOT = Path(args.output)
    ensure_dir(OUTPUT_ROOT)
    ensure_dir(SITEMAP_CACHE)

    csv_path = OUTPUT_ROOT / f"mixkit_manifest_{datetime.now():%Y%m%d_%H%M%S}.csv"
    csv_file = open(csv_path, "w", newline="", encoding="utf-8")
    csv_writer = csv.DictWriter(csv_file, fieldnames=[
        "type", "id", "slug", "resolution", "size", "file", "url", "ok"
    ])
    csv_writer.writeheader()

    log.info("=" * 60)
    log.info("Mixkit.co 全站爬虫启动")
    log.info(f"输出目录: {OUTPUT_ROOT.resolve()}")
    log.info(f"并发数: {args.workers}")
    log.info("=" * 60)

    try:
        if args.type in ("video", "all"):
            log.info("--- [1/5] 收集视频列表 ---")
            videos = collect_video_ids()
            if args.max_id:
                videos = [v for v in videos if v["id"] <= args.max_id]
            if args.test:
                videos = videos[:3]
            log.info(f"即将下载 {len(videos)} 个视频 ({args.res}p)")
            run_batch(dl_video, videos, args.workers,
                      OUTPUT_ROOT / "videos" / f"{args.res}p",
                      f"Videos {args.res}p",
                      csv_writer, csv_file, extra_kwargs={"res": args.res})

        if args.type in ("music", "all"):
            log.info("--- [2/5] 收集音乐列表 ---")
            music = collect_music_ids()
            if args.max_id:
                music = [m for m in music if m["id"] <= args.max_id]
            if args.test:
                music = music[:3]
            log.info(f"即将下载 {len(music)} 首音乐")
            run_batch(dl_music, music, args.workers,
                      OUTPUT_ROOT / "music", "Music",
                      csv_writer, csv_file)

        if args.type in ("sfx", "all"):
            log.info("--- [3/5] 收集音效列表 ---")
            sfx = collect_sfx_ids()
            if args.max_id:
                sfx = [s for s in sfx if s["id"] <= args.max_id]
            if args.test:
                sfx = sfx[:3]
            log.info(f"即将下载 {len(sfx)} 个音效")
            run_batch(dl_sfx, sfx, args.workers,
                      OUTPUT_ROOT / "sfx", "Sound Effects",
                      csv_writer, csv_file, extra_kwargs={"preview_only": args.sfx_preview_only})

        if args.type in ("art", "all"):
            log.info("--- [4/5] 收集插画列表 ---")
            art = collect_art_ids()
            if args.max_id:
                art = [a for a in art if a["id"] <= args.max_id]
            if args.test:
                art = art[:3]
            log.info(f"即将下载 {len(art)} 张插画 ({args.art_size})")
            run_batch(dl_art, art, args.workers,
                      OUTPUT_ROOT / "art" / args.art_size,
                      f"Art {args.art_size}",
                      csv_writer, csv_file, extra_kwargs={"size": args.art_size})

        if args.type in ("template", "all"):
            log.info("--- [5/5] 收集视频模板列表 ---")
            tpls = collect_template_ids()
            if args.max_id:
                tpls = [t for t in tpls if t["id"] <= args.max_id]
            if args.test:
                tpls = tpls[:3]
            log.info(f"即将下载 {len(tpls)} 个模板")
            run_batch(dl_template, tpls, args.workers,
                      OUTPUT_ROOT / "templates", "Templates",
                      csv_writer, csv_file)

    except KeyboardInterrupt:
        log.info("用户中断，已保存进度")
    finally:
        csv_file.close()
        log.info(f"清单已保存到: {csv_path}")
        log.info("全部任务结束")


if __name__ == "__main__":
    main()
