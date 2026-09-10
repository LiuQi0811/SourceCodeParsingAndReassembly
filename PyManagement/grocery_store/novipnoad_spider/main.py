#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
novipnoad.net 全站爬虫 - 主入口
功能：
1. 自动绕过 Cloudflare 5秒盾（cloudscraper + undetected-chromedriver + playwright 三级回退）
2. 爬取全站分类、视频详情、播放列表
3. 自动逆向解密视频接口（AES/CryptoJS 常见加密）
4. 支持 m3u8/mp4 视频多线程下载（AES-128 分片自动解密）
5. SQLite 断点续爬、进度记录

用法:
    # 安装依赖
    pip install -r requirements.txt
    playwright install chromium  # 如需使用 playwright 绕过 CF

    # 爬取全站元数据（不下载视频）
    python main.py crawl

    # 爬取并下载视频（会占用大量带宽和磁盘）
    python main.py crawl --download

    # 只爬取指定分类
    python main.py crawl --category 美剧

    # 搜索并爬取
    python main.py search "权力的游戏"

    # 下载指定视频
    python main.py download "https://www.novipnoad.net/v/xxx.html"
"""
import os
import sys
import time
import json
import logging
import argparse
from datetime import datetime
from urllib.parse import urljoin, urlparse, quote

from config import (BASE_URL, SAVE_DIR, HTML_DIR, IMAGE_DIR, LOG_DIR,
                    DOWNLOAD_VIDEOS, PREFERRED_QUALITY, CATEGORIES, ALT_DOMAINS)
from requester import requester
from parser import parser
from decryptor import decryptor
from database import db
from downloader import downloader


def setup_logging():
    os.makedirs(LOG_DIR, exist_ok=True)
    os.makedirs(HTML_DIR, exist_ok=True)
    os.makedirs(IMAGE_DIR, exist_ok=True)

    log_file = os.path.join(LOG_DIR, f"spider_{datetime.now().strftime('%Y%m%d')}.log")
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
        handlers=[
            logging.FileHandler(log_file, encoding="utf-8"),
            logging.StreamHandler(sys.stdout)
        ]
    )


logger = logging.getLogger("novipnoad")


def save_html(url, html):
    """保存页面 HTML 到本地（全站离线镜像基础）"""
    parsed = urlparse(url)
    path = parsed.path.strip("/") or "index"
    if not path.endswith(".html"):
        path = path + ".html" if "." not in path else path
    local_path = os.path.join(HTML_DIR, path)
    os.makedirs(os.path.dirname(local_path), exist_ok=True)
    with open(local_path, "w", encoding="utf-8") as f:
        f.write(f"<!-- Original URL: {url} -->\n" + html)
    return local_path


def fetch(url, use_browser=None, label=""):
    """统一请求：带重试、日志、HTML 保存"""
    logger.info(f"[GET] {label or url}")
    try:
        resp = requester.get(url, use_browser=use_browser)
        html = resp.text
        save_html(url, html)
        return html
    except Exception as e:
        logger.error(f"请求失败 {url}: {e}")
        return None


def resolve_domain():
    """自动探测可用域名（该站常换域名）"""
    domains = [BASE_URL] + ALT_DOMAINS
    for domain in domains:
        try:
            logger.info(f"探测域名: {domain}")
            resp = requester.get(domain, use_browser=False)
            if resp and resp.status_code == 200 and "cloudflare" not in resp.text[:1000].lower():
                logger.info(f"使用域名: {domain}")
                parser.base_url = domain
                return domain
        except:
            continue
    logger.warning("所有普通请求被拦截，将使用浏览器模式尝试")
    return BASE_URL


# ======================== 爬取逻辑 ========================

def crawl_home():
    """爬取首页，发现分类和种子链接"""
    html = fetch(parser.base_url, label="首页")
    if not html:
        return None
    home_data = parser.parse_home(html)

    # 将分类页加入任务队列
    for cat_name, cat_url in home_data["categories"].items():
        db.add_task(cat_url, task_type="list", priority=10)

    # 首页直接展示的视频
    for item in home_data.get("latest_updates", []) + home_data.get("hot_movies", []):
        db.add_task(item["url"], task_type="detail", priority=5)

    return home_data


def crawl_list(url, category_name="", max_depth=50):
    """爬取分类列表页（翻页）"""
    page = 1
    current_url = url
    pages_crawled = 0

    while current_url and pages_crawled < max_depth:
        html = fetch(current_url, label=f"列表页 - {category_name} 第{page}页")
        if not html:
            break

        list_data = parser.parse_list(html)

        for item in list_data["items"]:
            db.add_task(item["url"], task_type="detail", priority=3)

        # 下一页
        next_url = list_data["pagination"].get("next_url", "")
        total_pages = list_data["pagination"].get("total_pages", 1)

        pages_crawled += 1
        page += 1

        if next_url and next_url != current_url and pages_crawled < total_pages:
            current_url = next_url
            time.sleep(1.5)
        else:
            break

    logger.info(f"列表爬取完成 {category_name}: 共爬取 {pages_crawled} 页")


def crawl_detail(url):
    """爬取视频详情页"""
    html = fetch(url, label=f"详情页 - {url}")
    if not html:
        return None

    info = parser.parse_detail(html, url=url)
    if not info.get("title"):
        logger.warning(f"详情解析失败（可能被CF拦截）: {url}")
        return None

    video_id = db.save_video(info)

    # 将所有播放页加入任务队列
    for source in info.get("play_urls", []):
        for ep in source.get("episodes", []):
            ep_url = ep.get("url", "")
            if ep_url and ep_url.startswith("http"):
                db.add_task(ep_url, task_type="play", priority=2, video_id=video_id)

    return info


def crawl_play(url):
    """
    爬取播放页，提取真实视频地址（含解密）
    核心逆向逻辑：
    1. 解析页面 JS，提取加密密钥/IV
    2. 暴力尝试常见 AES/DES/Base64 解码
    3. 解析 iframe 嵌套播放器
    4. 处理 player_aaaa 等 MacCms 配置
    """
    html = fetch(url, use_browser=True, label=f"播放页 - {url}")
    if not html:
        return None

    play_data = parser.parse_play_page(html, url=url)

    # 如果有 iframe，进入 iframe 继续解析
    iframe_url = play_data.get("iframe_url", "")
    if iframe_url and iframe_url != url:
        logger.info(f"发现 iframe 播放器，继续解析: {iframe_url}")
        iframe_html = fetch(iframe_url, use_browser=True, label=f"iframe播放器")
        if iframe_html:
            play_data.update(parser.parse_play_page(iframe_html, url=iframe_url))
            play_data["player_js"] += "\n" + iframe_html

    js_code = play_data.get("player_js", "")
    config = play_data.get("player_config", {})

    # 提取真实视频地址
    video_url = play_data.get("m3u8_url") or play_data.get("video_url", "")

    # 如果从配置中拿到 url 字段，尝试解密
    enc_url = config.get("url", "")
    if enc_url and not video_url:
        logger.info(f"尝试解密视频地址，原始长度: {len(enc_url)}")
        decrypted = decryptor.brute_decrypt(enc_url, page_js=js_code)
        if decrypted and ("m3u8" in decrypted or "mp4" in decrypted or decrypted.startswith("http")):
            video_url = decrypted
            logger.info(f"解密成功: {video_url[:80]}...")

    # 如果还没拿到，从 JS 中暴力搜索所有可能的 m3u8/mp4 链接
    if not video_url:
        import re
        # 包括被编码、转义的 URL
        patterns = [
            r'(https?://[^"\'\\\s&]+\.(?:m3u8|mp4)[^"\'\\\s&]*)',
            r'((?:https?:)?\/\/[^"\'\\\s&]+\.(?:m3u8|mp4)[^"\'\\\s&]*)',
        ]
        for pat in patterns:
            for m in re.finditer(pat, js_code):
                candidate = m.group(1).replace("\\/", "/").replace("\\u002F", "/").replace("\\", "")
                if candidate.startswith("//"):
                    candidate = "https:" + candidate
                if ("m3u8" in candidate or "mp4" in candidate) and len(candidate) < 500:
                    video_url = candidate
                    logger.info(f"从 JS 中发现视频链接: {video_url[:80]}...")
                    break
            if video_url:
                break

    # 保存到数据库
    if video_url:
        db.conn.execute(
            "UPDATE episodes SET real_video_url=?, m3u8_url=?, updated_at=? WHERE episode_url=?",
            (video_url if "mp4" in video_url else "", video_url if "m3u8" in video_url else "",
             datetime.now().isoformat(), url)
        )
        db.conn.commit()
        logger.info(f"播放页解析完成，视频地址: {video_url[:80]}...")
    else:
        logger.warning(f"未能从播放页提取视频地址: {url}")

    return {"url": url, "video_url": video_url}


def crawl_search(keyword):
    """搜索"""
    search_url = urljoin(parser.base_url, f"/search?wd={quote(keyword)}")
    html = fetch(search_url, label=f"搜索 - {keyword}")
    if not html:
        # 备选搜索路径
        search_url = urljoin(parser.base_url, f"/search/{quote(keyword)}.html")
        html = fetch(search_url, label=f"搜索(备选) - {keyword}")
    if not html:
        logger.error(f"搜索失败: {keyword}")
        return []

    results = parser.parse_search(html)
    logger.info(f"搜索 '{keyword}' 找到 {len(results['items'])} 条结果")

    # 把结果加入队列
    for item in results["items"]:
        db.add_task(item["url"], task_type="detail", priority=8)
        print(f"  [{item.get('subtitle','')}] {item['title']} - {item['url']}")

    return results["items"]


def run_spider(max_videos=None, download_videos=False, category_filter=None):
    """
    主调度循环：任务队列模式
    """
    setup_logging()
    logger.info("=" * 60)
    logger.info("novipnoad.net 全站爬虫启动")
    logger.info("=" * 60)

    # 1. 探测可用域名
    resolve_domain()

    # 2. 初始任务：首页
    db.add_task(parser.base_url, task_type="home", priority=100)

    video_count = 0
    start_time = time.time()

    while True:
        task = db.get_pending_task()
        if not task:
            logger.info("任务队列为空，爬虫结束")
            break

        url = task["url"]
        task_type = task["task_type"]

        # 分类过滤
        if category_filter and task_type == "list" and category_filter not in url:
            db.mark_task(url, "success")
            continue

        try:
            if task_type == "home":
                crawl_home()
            elif task_type == "list":
                crawl_list(url)
            elif task_type == "detail":
                info = crawl_detail(url)
                if info:
                    video_count += 1
            elif task_type == "play":
                result = crawl_play(url)
                # 如果需要下载视频
                if download_videos and result and result.get("video_url"):
                    ep_row = db.conn.execute("SELECT * FROM episodes WHERE episode_url=?", (url,)).fetchone()
                    if ep_row:
                        v_row = db.conn.execute("SELECT title FROM videos WHERE id=?", (ep_row["video_id"],)).fetchone()
                        title = f"{v_row['title']}_{ep_row['episode_name']}" if v_row else ep_row["episode_name"]
                        video_path = downloader.download(result["video_url"], title=title)
                        if video_path:
                            db.conn.execute(
                                "UPDATE episodes SET video_path=?, download_status='done', updated_at=? WHERE id=?",
                                (video_path, datetime.now().isoformat(), ep_row["id"])
                            )
                            db.conn.commit()
            elif task_type == "search":
                crawl_search(url)  # url 此处是关键词（特殊情况）

            db.mark_task(url, "success")

        except Exception as e:
            logger.error(f"任务失败 {task_type} {url}: {e}", exc_info=True)
            db.mark_task(url, "failed", error=str(e))

        # 统计
        stats = db.get_stats()
        elapsed = time.time() - start_time
        logger.info(f"进度: 视频{video_count}个 | 待处理任务{stats['pending_tasks']} | 剧集{stats['episodes']} | 用时{elapsed:.0f}s")

        if max_videos and video_count >= max_videos:
            logger.info(f"达到上限 {max_videos} 个视频，停止爬取")
            break

    logger.info(f"爬取结束，共 {video_count} 个视频，用时 {time.time()-start_time:.0f}s")


# ======================== CLI ========================
def main():
    parser_cli = argparse.ArgumentParser(description="novipnoad.net 全站爬虫")
    sub = parser_cli.add_subparsers(dest="command")

    # crawl
    p_crawl = sub.add_parser("crawl", help="爬取全站")
    p_crawl.add_argument("--max", type=int, default=None, help="最多爬取多少个视频详情页")
    p_crawl.add_argument("--download", action="store_true", help="同时下载视频")
    p_crawl.add_argument("--category", type=str, default=None, help="只爬指定分类（如 美剧、韩剧、电影）")

    # search
    p_search = sub.add_parser("search", help="搜索视频")
    p_search.add_argument("keyword", help="搜索关键词")

    # download
    p_dl = sub.add_parser("download", help="直接下载指定 URL 的视频")
    p_dl.add_argument("url", help="视频详情页或播放页 URL")

    # export
    p_exp = sub.add_parser("export", help="导出已爬取元数据为 JSON")
    p_exp.add_argument("--output", default="videos.json", help="输出文件")

    args = parser_cli.parse_args()

    if args.command == "crawl":
        run_spider(max_videos=args.max, download_videos=args.download, category_filter=args.category)

    elif args.command == "search":
        setup_logging()
        resolve_domain()
        crawl_search(args.keyword)

    elif args.command == "download":
        setup_logging()
        resolve_domain()
        # 先爬详情解析播放地址
        html = fetch(args.url, label="目标页面")
        if html:
            info = parser.parse_detail(html, url=args.url) if "/v/" in args.url or "/video/" in args.url else None
            if info:
                db.save_video(info)
                # 解析每集
                for source in info.get("play_urls", []):
                    for ep in source.get("episodes", []):
                        result = crawl_play(ep["url"])
                        if result and result.get("video_url"):
                            downloader.download(result["video_url"], title=f"{info['title']}_{ep['name']}")
            else:
                # 直接尝试当播放页解析
                result = crawl_play(args.url)
                if result and result.get("video_url"):
                    downloader.download(result["video_url"])

    elif args.command == "export":
        videos = db.get_all_videos(status="parsed")
        # 反序列化 JSON 字段
        for v in videos:
            for k in ["play_sources", "related_videos"]:
                try:
                    v[k] = json.loads(v[k])
                except:
                    v[k] = []
        with open(args.output, "w", encoding="utf-8") as f:
            json.dump(videos, f, ensure_ascii=False, indent=2)
        logger.info(f"已导出 {len(videos)} 条视频数据到 {args.output}")

    else:
        parser_cli.print_help()

    requester.close()


if __name__ == "__main__":
    main()
