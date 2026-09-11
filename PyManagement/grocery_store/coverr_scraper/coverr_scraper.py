#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Coverr.co 全站视频/图片/音乐爬虫 - 完美逆向版
逆向分析要点：
1. CDN域名为 cdn.coverr.co，视频路径模式: /videos/{video_id}/{resolution}.mp4
2. CDN防盗链: 直接GET不带Range头会返回301重定向到首页
3. 破解方法: HTTP请求必须携带 Range: bytes=0- 头，可完整下载文件
4. 必须携带 Referer: https://coverr.co/ 和浏览器 User-Agent
5. 视频分辨率: original.mp4(原始), 1080p.mp4, 720p.mp4, 480p.mp4, 360p.mp4
6. 视频列表通过sitemap.xml获取，包含全部视频链接元数据
"""

import os
import re
import sys
import time
import json
import xml.etree.ElementTree as ET
from urllib.parse import urlparse, urljoin
from concurrent.futures import ThreadPoolExecutor, as_completed
import requests
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry
from pathlib import Path
import argparse

# 配置
BASE_URL = "https://coverr.co"
CDN_URL = "https://cdn.coverr.co"
OUTPUT_DIR = "./coverr_downloads"
MAX_WORKERS = 8  # 并发下载数
TIMEOUT = 120
RESOLUTIONS = ["original", "1080p", "720p", "480p", "360p"]  # 从高到低优先级

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Accept": "*/*",
    "Accept-Language": "en-US,en;q=0.9",
    "Referer": "https://coverr.co/",
    "Origin": "https://coverr.co",
    "Sec-Fetch-Dest": "video",
    "Sec-Fetch-Mode": "no-cors",
    "Sec-Fetch-Site": "same-site",
}

SITEMAPS = {
    "videos": "https://coverr.co/sitemap/sitemap_videos.xml",
    "images": "https://coverr.co/sitemap/sitemap_images.xml",
    "collections": "https://coverr.co/sitemap/sitemap_collections.xml",
    "music_tags": "https://coverr.co/sitemap/sitemap_audio-tags.xml",
    "blog": "https://coverr.co/sitemap/sitemap_blog.xml",
}


def create_session():
    """创建带重试机制的requests会话"""
    session = requests.Session()
    retry_strategy = Retry(
        total=5,
        backoff_factor=1,
        status_forcelist=[429, 500, 502, 503, 504],
    )
    adapter = HTTPAdapter(max_retries=retry_strategy, pool_connections=20, pool_maxsize=20)
    session.mount("https://", adapter)
    session.mount("http://", adapter)
    session.headers.update(HEADERS)
    return session


def download_file(session, url, save_path, desc=""):
    """
    下载文件 - 使用Range头绕过CDN防盗链
    逆向关键: Range: bytes=0- 头可以获取完整文件而不被301重定向
    """
    if os.path.exists(save_path) and os.path.getsize(save_path) > 1024:
        print(f"  [跳过] 已存在: {os.path.basename(save_path)}")
        return True

    os.makedirs(os.path.dirname(save_path), exist_ok=True)
    tmp_path = save_path + ".part"

    try:
        # 逆向破解: 添加Range头来绕过CDN防盗链检测
        headers = dict(HEADERS)
        headers["Range"] = "bytes=0-"

        resp = session.get(url, headers=headers, stream=True, timeout=TIMEOUT)
        resp.raise_for_status()

        total_size = int(resp.headers.get("content-length", 0))
        downloaded = 0

        with open(tmp_path, "wb") as f:
            for chunk in resp.iter_content(chunk_size=1024 * 1024):  # 1MB chunks
                if chunk:
                    f.write(chunk)
                    downloaded += len(chunk)

        # 验证文件完整性
        if downloaded > 1024 and (total_size == 0 or abs(downloaded - total_size) < 1024 or downloaded >= total_size):
            os.rename(tmp_path, save_path)
            size_mb = downloaded / (1024 * 1024)
            print(f"  [完成] {desc} ({size_mb:.1f} MB)")
            return True
        else:
            if os.path.exists(tmp_path):
                os.remove(tmp_path)
            print(f"  [失败] 文件大小异常: {downloaded} bytes, 期望: {total_size}")
            return False

    except Exception as e:
        if os.path.exists(tmp_path):
            os.remove(tmp_path)
        print(f"  [错误] {desc}: {str(e)[:100]}")
        return False


def parse_video_sitemap(session, sitemap_url):
    """解析视频sitemap，提取所有视频元数据"""
    print(f"[解析] 获取视频sitemap: {sitemap_url}")
    videos = []

    try:
        resp = session.get(sitemap_url, timeout=30)
        resp.raise_for_status()

        # 解析XML sitemap
        root = ET.fromstring(resp.content)
        ns = {
            "sm": "http://www.sitemaps.org/schemas/sitemap/0.9",
            "video": "http://www.google.com/schemas/sitemap-video/1.1",
        }

        for url_elem in root.findall("sm:url", ns):
            page_url = url_elem.find("sm:loc", ns).text if url_elem.find("sm:loc", ns) is not None else ""

            video_elem = url_elem.find("video:video", ns)
            if video_elem is None:
                continue

            title = video_elem.find("video:title", ns).text if video_elem.find("video:title", ns) is not None else ""
            description = video_elem.find("video:description", ns).text if video_elem.find("video:description", ns) is not None else ""
            thumbnail_loc = video_elem.find("video:thumbnail_loc", ns).text if video_elem.find("video:thumbnail_loc", ns) is not None else ""
            content_loc = video_elem.find("video:content_loc", ns).text if video_elem.find("video:content_loc", ns) is not None else ""
            duration = video_elem.find("video:duration", ns).text if video_elem.find("video:duration", ns) is not None else "0"

            tags = []
            for tag_elem in video_elem.findall("video:tag", ns):
                if tag_elem.text:
                    tags.append(tag_elem.text.strip())

            # 从content_loc中提取CDN基础路径
            # 例如: https://cdn.coverr.co/videos/coverr-xxx-1234/360p.mp4 -> /videos/coverr-xxx-1234
            cdn_base = ""
            video_id = ""
            if content_loc:
                match = re.match(r"(https://cdn\.coverr\.co/videos/[^/]+)/", content_loc)
                if match:
                    cdn_base = match.group(1)
                    video_id = cdn_base.split("/")[-1]

            if cdn_base and title:
                # 生成安全文件名
                safe_title = re.sub(r'[<>:"/\\|?*]', '', title.strip())[:80]
                videos.append({
                    "page_url": page_url,
                    "title": title.strip(),
                    "safe_title": safe_title,
                    "description": description.strip() if description else "",
                    "thumbnail": thumbnail_loc,
                    "cdn_base": cdn_base,
                    "video_id": video_id,
                    "duration": float(duration) if duration else 0,
                    "tags": tags,
                })

        print(f"[解析] 找到 {len(videos)} 个视频")
        return videos

    except Exception as e:
        print(f"[错误] 解析sitemap失败: {e}")
        return []


def download_video(session, video, resolution="1080p", output_dir=OUTPUT_DIR):
    """下载单个视频的指定分辨率"""
    video_dir = os.path.join(output_dir, "videos", video["safe_title"][:2].upper())
    os.makedirs(video_dir, exist_ok=True)

    # 逆向分析发现: 该CDN对HEAD和无Range的GET返回301重定向
    # 但带 Range: bytes=0- 的GET请求可正常下载完整文件
    # 直接尝试下载，失败自动降级分辨率

    tried_resolutions = []
    for res in RESOLUTIONS[RESOLUTIONS.index(resolution):]:
        video_url = f"{video['cdn_base']}/{res}.mp4"
        filename = f"{video['safe_title']}_{res}.mp4"
        if len(filename) > 180:
            filename = filename[:170] + f"_{res}.mp4"
        save_path = os.path.join(video_dir, filename)

        try:
            # 使用Range头直接下载（绕过CDN防盗链）
            headers = dict(HEADERS)
            headers["Range"] = "bytes=0-"

            resp = session.get(video_url, headers=headers, stream=True, timeout=TIMEOUT, allow_redirects=False)

            # 检查是否被重定向（该分辨率不存在或需要降级）
            if resp.status_code in (301, 302, 303, 307, 308):
                tried_resolutions.append(res)
                continue

            if resp.status_code not in (200, 206):
                tried_resolutions.append(res)
                continue

            # 开始下载
            total_size = int(resp.headers.get("content-length", 0))
            if total_size < 10000:  # 文件太小，可能是错误页面
                tried_resolutions.append(res)
                continue

            success = download_file(session, video_url, save_path, desc=f"{video['safe_title'][:40]} [{res}]")
            if success:
                # 同时下载缩略图
                if video.get("thumbnail"):
                    thumb_url = video["thumbnail"].split("?")[0]
                    thumb_name = f"{video['safe_title'][:60]}_thumb.jpg"
                    if len(thumb_name) > 180:
                        thumb_name = thumb_name[:170] + "_thumb.jpg"
                    thumb_path = os.path.join(video_dir, thumb_name)
                    if not os.path.exists(thumb_path):
                        try:
                            download_file(session, thumb_url, thumb_path, desc=f"缩略图")
                        except:
                            pass

                # 保存元数据
                meta_name = f"{video['safe_title'][:60]}_meta.json"
                if len(meta_name) > 180:
                    meta_name = meta_name[:170] + "_meta.json"
                meta_path = os.path.join(video_dir, meta_name)
                if not os.path.exists(meta_path):
                    with open(meta_path, "w", encoding="utf-8") as f:
                        json.dump(video, f, ensure_ascii=False, indent=2)
                return True
        except Exception as e:
            tried_resolutions.append(res)
            continue

    print(f"  [跳过] 无可用分辨率 (尝试了: {', '.join(tried_resolutions)}): {video['safe_title'][:50]}")
    return False


def scrape_website_pages(session, output_dir):
    """抓取网站静态页面"""
    pages = [
        "/", "/about", "/blog", "/collections", "/contact-us",
        "/free-stock-music", "/free-stock-images",
        "/developers", "/contribute", "/advertise", "/faq",
    ]

    pages_dir = os.path.join(output_dir, "pages")
    os.makedirs(pages_dir, exist_ok=True)

    print(f"\n[页面] 开始抓取 {len(pages)} 个静态页面")
    for page in pages:
        url = urljoin(BASE_URL, page)
        filename = page.strip("/").replace("/", "_") or "index"
        save_path = os.path.join(pages_dir, f"{filename}.html")
        download_file(session, url, save_path, desc=f"页面: {page}")
        time.sleep(0.5)


def main():
    parser = argparse.ArgumentParser(description="Coverr.co 全站抓取工具 - 完美逆向版")
    parser.add_argument("-o", "--output", default=OUTPUT_DIR, help="输出目录")
    parser.add_argument("-r", "--resolution", default="1080p", choices=RESOLUTIONS, help="视频分辨率")
    parser.add_argument("-w", "--workers", type=int, default=MAX_WORKERS, help="并发下载数")
    parser.add_argument("-l", "--limit", type=int, default=0, help="限制下载视频数量 (0=全部)")
    parser.add_argument("--no-pages", action="store_true", help="不下载静态页面")
    parser.add_argument("--list-only", action="store_true", help="仅列出视频不下载")
    args = parser.parse_args()

    print("=" * 60)
    print("  Coverr.co 全站爬虫 - 完美逆向版")
    print("  逆向破解: CDN防盗链 (Range头绕过)")
    print("=" * 60)
    print(f"  输出目录: {args.output}")
    print(f"  分辨率: {args.resolution}")
    print(f"  并发数: {args.workers}")
    print()

    session = create_session()
    os.makedirs(args.output, exist_ok=True)

    # 1. 先访问首页建立session
    print("[初始化] 访问首页建立会话...")
    session.get(BASE_URL, timeout=30)

    # 2. 解析sitemap获取所有视频
    videos = parse_video_sitemap(session, SITEMAPS["videos"])

    if args.limit > 0:
        videos = videos[:args.limit]
        print(f"[限制] 仅下载前 {args.limit} 个视频")

    if args.list_only:
        print("\n[视频列表]")
        for i, v in enumerate(videos, 1):
            print(f"  {i}. {v['title'][:70]} - {v['cdn_base']}")
        print(f"\n共 {len(videos)} 个视频")
        return

    # 保存视频列表索引
    index_path = os.path.join(args.output, "video_index.json")
    with open(index_path, "w", encoding="utf-8") as f:
        json.dump({
            "total": len(videos),
            "scraped_at": time.strftime("%Y-%m-%d %H:%M:%S"),
            "videos": videos,
        }, f, ensure_ascii=False, indent=2)
    print(f"[索引] 视频索引已保存: {index_path}")

    # 3. 并发下载视频
    print(f"\n[下载] 开始下载 {len(videos)} 个视频 (并发: {args.workers})")
    success_count = 0
    fail_count = 0

    with ThreadPoolExecutor(max_workers=args.workers) as executor:
        futures = {
            executor.submit(download_video, session, video, args.resolution, args.output): video
            for video in videos
        }

        for i, future in enumerate(as_completed(futures), 1):
            video = futures[future]
            try:
                if future.result():
                    success_count += 1
                else:
                    fail_count += 1
            except Exception as e:
                fail_count += 1
                print(f"  [错误] {video['title'][:50]}: {e}")

            if i % 20 == 0:
                print(f"\n[进度] 已完成 {i}/{len(videos)} - 成功: {success_count}, 失败: {fail_count}\n")

    # 4. 抓取静态页面
    if not args.no_pages:
        scrape_website_pages(session, args.output)

    # 5. 汇总
    print("\n" + "=" * 60)
    print("  下载完成!")
    print(f"  总计视频: {len(videos)}")
    print(f"  成功: {success_count}")
    print(f"  失败: {fail_count}")
    print(f"  保存位置: {os.path.abspath(args.output)}")
    print("=" * 60)


if __name__ == "__main__":
    main()
