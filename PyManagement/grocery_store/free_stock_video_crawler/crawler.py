#!/usr/bin/env python3
"""
free-stock.video 全站爬虫 & 下载器
===================================
站点：https://free-stock.video/
功能：
  1. 从 sitemap.xml 获取全站所有视频详情页 URL（最可靠的方式）
  2. 分页遍历 /videos 列表页，兜底补全 sitemap 未覆盖的新视频
  3. 逐个解析详情页，提取标题、封面图、视频 mp4 直链（服务端渲染，无加密，直接正则提取）
  4. 并发下载视频文件与封面图到本地，支持断点续传、失败重试、进度显示
  5. 导出视频元数据索引 CSV / JSON

逆向分析结论：
  - 该站采用服务端渲染（SSR），<video src> 和下载按钮 <a href> 直接写在 HTML 中
  - CDN 域名为 cdn.free-stock.video，文件命名：{slug}-{内部ID}-small.mp4（视频）、{slug}-{内部ID}-cover.jpg（封面）
  - 不存在 m3u8/HLS/DASH 分片，不存在 JS 解密，不存在签名/Token 防盗链
  - 所有资源公开可访问，支持 HTTP Range（断点续传）

用法：
  python crawler.py                  # 默认：抓取元数据 + 下载全部视频
  python crawler.py --metadata-only  # 仅抓取元数据，不下载视频
  python crawler.py --workers 10     # 并发下载线程数（默认 5）
  python crawler.py --output ./videos # 输出目录（默认 ./downloads）
  python crawler.py --no-cover       # 不下载封面图
  python crawler.py --resume         # 跳过已下载文件（默认开启）
"""

import argparse
import csv
import json
import os
import re
import sys
import time
import logging
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path
from typing import Dict, List, Optional, Tuple
from urllib.parse import urljoin, urlparse

import requests
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry

# ---------------------------------------------------------------------------
# 常量配置
# ---------------------------------------------------------------------------
BASE_URL = "https://free-stock.video"
SITEMAP_URL = f"{BASE_URL}/sitemap.xml"
VIDEOS_LIST_URL = f"{BASE_URL}/videos"
CDN_PREFIX = "https://cdn.free-stock.video"

# 正则：从详情页 HTML 提取视频源、封面、标题
RE_VIDEO_SRC = re.compile(
    r'<video[^>]*\bsrc=["\'](https?://cdn\.free-stock\.video/[^"\']+\.mp4)["\']',
    re.IGNORECASE,
)
RE_POSTER = re.compile(
    r'<video[^>]*\bposter=["\'](https?://cdn\.free-stock\.video/[^"\']+\.(?:jpg|jpeg|png|webp))["\']',
    re.IGNORECASE,
)
RE_TITLE = re.compile(r"<h1[^>]*>(.*?)</h1>", re.DOTALL | re.IGNORECASE)
RE_CANONICAL = re.compile(r'<link[^>]*rel=["\']canonical["\'][^>]*href=["\']([^"\']+)["\']', re.IGNORECASE)
# 备用：直接从 HTML 全文抠出 CDN mp4
RE_CDN_MP4 = re.compile(r'https?://cdn\.free-stock\.video/[^"\'<>\s]+\.mp4')
RE_CDN_IMG = re.compile(r'https?://cdn\.free-stock\.video/[^"\'<>\s]+-cover\.(?:jpg|jpeg|png|webp)')

# 列表页提取视频详情链接
RE_VIDEO_LINK = re.compile(r'href=["\'](/v/[^"\']+)["\']', re.IGNORECASE)

DEFAULT_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/125.0.0.0 Safari/537.36"
    ),
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
    "Referer": "https://free-stock.video/",
}

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%H:%M:%S",
)
log = logging.getLogger("fsv-crawler")


# ---------------------------------------------------------------------------
# HTTP 会话（带重试 & 连接池）
# ---------------------------------------------------------------------------
def make_session(retries: int = 5, timeout: int = 30) -> requests.Session:
    s = requests.Session()
    s.headers.update(DEFAULT_HEADERS)
    retry = Retry(
        total=retries,
        connect=retries,
        read=retries,
        backoff_factor=1.0,
        status_forcelist=(429, 500, 502, 503, 504),
        allowed_methods=frozenset(["GET", "HEAD"]),
    )
    adapter = HTTPAdapter(max_retries=retry, pool_connections=32, pool_maxsize=32)
    s.mount("https://", adapter)
    s.mount("http://", adapter)
    s.timeout = timeout
    return s


# ---------------------------------------------------------------------------
# 步骤 1：从 sitemap 获取所有视频详情页 URL
# ---------------------------------------------------------------------------
def fetch_video_urls_from_sitemap(session: requests.Session) -> List[str]:
    """从 sitemap.xml 解析出所有 /v/ 开头的视频详情页 URL。"""
    log.info("正在读取 sitemap.xml …")
    resp = session.get(SITEMAP_URL, timeout=30)
    resp.raise_for_status()
    urls = re.findall(r"<loc>(https?://free-stock\.video/v/[^<]+)</loc>", resp.text)
    log.info("sitemap 中发现 %d 个视频详情页", len(urls))
    return urls


# ---------------------------------------------------------------------------
# 步骤 2（兜底）：分页遍历 /videos 列表页，补充新视频
# ---------------------------------------------------------------------------
def fetch_video_urls_from_pages(session: requests.Session, max_pages: int = 200) -> List[str]:
    """遍历 /videos?page=N 获取视频链接。"""
    all_urls = []
    page = 1
    while page <= max_pages:
        url = f"{VIDEOS_LIST_URL}?page={page}"
        log.info("扫描列表页 page=%d …", page)
        try:
            resp = session.get(url, timeout=30)
            if resp.status_code == 404:
                break
            resp.raise_for_status()
        except Exception as e:
            log.warning("列表页 page=%d 抓取失败：%s", page, e)
            break
        links = re.findall(r'href="(/v/[^"]+)"', resp.text)
        full_links = [urljoin(BASE_URL, l) for l in set(links)]
        if not full_links:
            log.info("第 %d 页无视频，停止分页。", page)
            break
        all_urls.extend(full_links)
        # 如果没有 "Next" 链接，说明到最后一页
        if "Next" not in resp.text and "next" not in resp.text.lower():
            log.info("已到最后一页（page=%d）。", page)
            break
        page += 1
        time.sleep(0.3)  # 礼貌延迟
    return list(set(all_urls))


# ---------------------------------------------------------------------------
# 步骤 3：解析单个视频详情页，返回元数据
# ---------------------------------------------------------------------------
def strip_tags(html: str) -> str:
    return re.sub(r"<[^>]+>", "", html).strip()


def parse_video_page(html: str, page_url: str) -> Optional[Dict]:
    """
    从详情页 HTML 中提取：
      - title:       视频标题
      - video_url:   mp4 直链（CDN）
      - cover_url:   封面图直链
      - page_url:    详情页 URL
      - slug:        URL slug
      - cdn_folder:  CDN 上的日期文件夹（如 1582025）
      - filename:    mp4 文件名
    """
    # 视频 mp4
    m = RE_VIDEO_SRC.search(html)
    if not m:
        # 兜底：在全文中搜索 CDN mp4
        m = RE_CDN_MP4.search(html)
    if not m:
        return None
    video_url = m.group(1) if m.lastindex else m.group(0)

    # 封面
    pm = RE_POSTER.search(html)
    if not pm:
        pm = RE_CDN_IMG.search(html)
    cover_url = pm.group(1) if pm and pm.lastindex else (pm.group(0) if pm else "")

    # 标题
    tm = RE_TITLE.search(html)
    title = strip_tags(tm.group(1)) if tm else ""
    if not title:
        # 尝试 <title> 中取
        tm2 = re.search(r"<title>([^<|]+)", html)
        title = tm2.group(1).strip() if tm2 else ""

    # 从 URL 解析 slug
    path = urlparse(page_url).path  # /v/xxx-123
    slug = path.rsplit("/", 1)[-1] if "/" in path else path

    # 从 CDN URL 解析文件夹与文件名
    cdn_path = urlparse(video_url).path  # /1582025/xxx-small.mp4
    parts = cdn_path.strip("/").split("/", 1)
    cdn_folder = parts[0] if len(parts) > 1 else ""
    filename = parts[-1]

    return {
        "title": title,
        "page_url": page_url,
        "video_url": video_url,
        "cover_url": cover_url,
        "slug": slug,
        "cdn_folder": cdn_folder,
        "filename": filename,
        "video_id": slug.rsplit("-", 1)[-1] if "-" in slug else "",
    }


# ---------------------------------------------------------------------------
# 步骤 4：下载文件（支持断点续传）
# ---------------------------------------------------------------------------
def download_file(
    session: requests.Session,
    url: str,
    out_path: Path,
    resume: bool = True,
    chunk_size: int = 1024 * 256,  # 256KB
) -> Tuple[bool, int]:
    """
    下载单个文件到 out_path。
    返回 (是否成功, 字节数)。
    """
    out_path.parent.mkdir(parents=True, exist_ok=True)

    # 已存在且大小 > 0：尝试断点续传
    existing_size = out_path.stat().st_size if out_path.exists() else 0
    headers = {}
    if resume and existing_size > 0:
        # 先 HEAD 看远端大小
        try:
            head = session.head(url, timeout=20)
            remote_size = int(head.headers.get("Content-Length", 0))
            if remote_size > 0 and existing_size >= remote_size:
                return True, existing_size  # 已完整下载
            headers["Range"] = f"bytes={existing_size}-"
        except Exception:
            pass

    try:
        resp = session.get(url, headers=headers, stream=True, timeout=(30, 300))
        if resp.status_code == 416:  # Range Not Satisfiable → 已完整
            return True, existing_size
        resp.raise_for_status()

        mode = "ab" if (resume and existing_size > 0 and resp.status_code == 206) else "wb"
        written = existing_size if mode == "ab" else 0

        with open(out_path, mode) as f:
            for chunk in resp.iter_content(chunk_size=chunk_size):
                if chunk:
                    f.write(chunk)
                    written += len(chunk)
        return True, written
    except Exception as e:
        log.debug("下载失败 %s : %s", url, e)
        return False, 0


# ---------------------------------------------------------------------------
# 主流程
# ---------------------------------------------------------------------------
def safe_filename(name: str, max_len: int = 120) -> str:
    """生成安全的文件名。"""
    name = re.sub(r'[\\/:*?"<>|]+', "_", name).strip()
    name = re.sub(r"\s+", " ", name)
    if len(name) > max_len:
        name = name[:max_len]
    return name or "untitled"


def main():
    parser = argparse.ArgumentParser(description="free-stock.video 全站爬虫 & 下载器")
    parser.add_argument("--output", "-o", default="./downloads", help="下载输出目录（默认 ./downloads）")
    parser.add_argument("--workers", "-j", type=int, default=5, help="并发下载线程数（默认 5）")
    parser.add_argument("--metadata-only", action="store_true", help="仅抓取元数据，不下载视频文件")
    parser.add_argument("--no-cover", action="store_true", help="不下载封面图")
    parser.add_argument("--no-resume", action="store_true", help="不使用断点续传，强制重新下载")
    parser.add_argument("--max-videos", type=int, default=0, help="限制最多抓取/下载的视频数（0 表示全部）")
    parser.add_argument("--pages-only", action="store_true", help="仅使用分页列表模式，不读 sitemap")
    parser.add_argument("--delay", type=float, default=0.2, help="抓取详情页之间的延迟秒数（默认 0.2）")
    args = parser.parse_args()

    out_dir = Path(args.output).resolve()
    videos_dir = out_dir / "videos"
    covers_dir = out_dir / "covers"
    out_dir.mkdir(parents=True, exist_ok=True)

    resume = not args.no_resume
    session = make_session()

    # ------- 收集所有视频详情页 URL -------
    video_page_urls: List[str] = []
    if not args.pages_only:
        try:
            video_page_urls = fetch_video_urls_from_sitemap(session)
        except Exception as e:
            log.warning("sitemap 获取失败（%s），将使用分页列表兜底。", e)

    # 分页兜底
    page_urls = fetch_video_urls_from_pages(session)
    all_urls_set = set(video_page_urls) | set(page_urls)
    video_page_urls = sorted(all_urls_set)
    log.info("合计发现 %d 个唯一视频详情页", len(video_page_urls))

    if args.max_videos > 0:
        video_page_urls = video_page_urls[: args.max_videos]
        log.info("根据 --max-videos 限制为 %d 个", len(video_page_urls))

    # ------- 逐页解析元数据 -------
    metadata: List[Dict] = []
    failed_pages: List[str] = []

    log.info("开始解析 %d 个视频详情页 …", len(video_page_urls))
    for i, page_url in enumerate(video_page_urls, 1):
        try:
            resp = session.get(page_url, timeout=30)
            if resp.status_code != 200:
                log.warning("[%d/%d] HTTP %d - %s", i, len(video_page_urls), resp.status_code, page_url)
                failed_pages.append(page_url)
                continue
            info = parse_video_page(resp.text, page_url)
            if not info:
                log.warning("[%d/%d] 未找到视频源 - %s", i, len(video_page_urls), page_url)
                failed_pages.append(page_url)
                continue
            metadata.append(info)
            if i % 50 == 0 or i == len(video_page_urls):
                log.info("[%d/%d] 已解析，当前成功 %d 条", i, len(video_page_urls), len(metadata))
        except Exception as e:
            log.warning("[%d/%d] 解析异常 %s : %s", i, len(video_page_urls), page_url, e)
            failed_pages.append(page_url)
        time.sleep(args.delay)

    log.info("元数据解析完成：成功 %d，失败 %d", len(metadata), len(failed_pages))

    # ------- 保存元数据 -------
    meta_json = out_dir / "metadata.json"
    meta_csv = out_dir / "metadata.csv"
    with open(meta_json, "w", encoding="utf-8") as f:
        json.dump(metadata, f, ensure_ascii=False, indent=2)
    if metadata:
        with open(meta_csv, "w", encoding="utf-8-sig", newline="") as f:
            writer = csv.DictWriter(f, fieldnames=list(metadata[0].keys()))
            writer.writeheader()
            writer.writerows(metadata)
    log.info("元数据已保存：%s / %s", meta_json, meta_csv)

    if failed_pages:
        fb_path = out_dir / "failed_pages.txt"
        with open(fb_path, "w", encoding="utf-8") as f:
            f.write("\n".join(failed_pages))
        log.info("失败页面列表：%s（共 %d 条）", fb_path, len(failed_pages))

    if args.metadata_only:
        log.info("--metadata-only 模式，跳过下载。")
        return

    # ------- 下载视频 & 封面 -------
    log.info("开始并发下载（workers=%d）…", args.workers)
    total = len(metadata)
    done = 0
    download_errors: List[Dict] = []

    def download_one(item: Dict) -> Tuple[str, bool, str]:
        """下载单个视频+封面，返回 (slug, ok, msg)。"""
        title = safe_filename(item["title"]) or item["video_id"] or "untitled"
        vid_id = item["video_id"] or "0"
        base_name = f"{title}__{vid_id}"
        results = []

        # 视频 mp4
        vurl = item["video_url"]
        vext = os.path.splitext(urlparse(vurl).path)[1] or ".mp4"
        vpath = videos_dir / f"{base_name}{vext}"
        ok, size = download_file(session, vurl, vpath, resume=resume)
        results.append(("video", ok, str(vpath), size))

        # 封面
        if not args.no_cover and item["cover_url"]:
            curl = item["cover_url"]
            cext = os.path.splitext(urlparse(curl).path)[1] or ".jpg"
            cpath = covers_dir / f"{base_name}{cext}"
            ok_c, _ = download_file(session, curl, cpath, resume=resume)
            results.append(("cover", ok_c, str(cpath), _))

        return item["slug"], results

    with ThreadPoolExecutor(max_workers=args.workers) as ex:
        futures = {ex.submit(download_one, item): item for item in metadata}
        for fut in as_completed(futures):
            done += 1
            try:
                slug, results = fut.result()
                ok_count = sum(1 for _, ok, _, _ in results if ok)
                fail_count = sum(1 for _, ok, _, _ in results if not ok)
                if fail_count:
                    for kind, ok, path, size in results:
                        if not ok:
                            download_errors.append({"slug": slug, "type": kind, "path": path})
                if done % 20 == 0 or done == total:
                    log.info("[下载进度 %d/%d] 本批成功 %d 个文件", done, total, ok_count)
            except Exception as e:
                item = futures[fut]
                log.error("下载异常 %s : %s", item.get("slug"), e)
                download_errors.append({"slug": item.get("slug"), "type": "exception", "error": str(e)})

    if download_errors:
        err_path = out_dir / "download_errors.json"
        with open(err_path, "w", encoding="utf-8") as f:
            json.dump(download_errors, f, ensure_ascii=False, indent=2)
        log.warning("有 %d 个文件下载失败，详见 %s", len(download_errors), err_path)

    log.info("=" * 60)
    log.info("全部完成！")
    log.info("视频目录：%s", videos_dir)
    log.info("封面目录：%s", covers_dir)
    log.info("元数据：  %s", meta_json)
    log.info("成功解析视频：%d 条", len(metadata))
    log.info("下载失败文件：%d 个", len(download_errors))


if __name__ == "__main__":
    main()
