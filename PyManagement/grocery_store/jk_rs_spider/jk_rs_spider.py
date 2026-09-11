#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
jk.rs 全站爬虫
==============
站点: https://www.jk.rs/ (日式JK - WordPress Mango主题)
技术栈: Nginx + PHP + WordPress
反爬分析:
  - 无Cloudflare/JS加密挑战
  - WordPress REST API (/wp-json/wp/v2/) 完全开放，可直接获取全部文章列表与正文
  - 图片使用jQuery懒加载(data-src)，占位符为 giphy-1.gif，真实地址在 data-src 中
  - 前端HTML存在"评论可见隐藏内容"，但REST API返回的content中图片完整，无需登录/评论
  - 图片托管在 pic.imgdb.cn / pic1.imgdb.cn，302跳转到 wkphoto.cdn.bcebos.com(百度CDN)，无Referer限制
  - PHPSESSID/server_session Cookie不影响公开内容访问

功能:
  1. 通过WP REST API抓取全部文章列表(支持断点续传)
  2. 抓取分类/标签信息
  3. 逐篇获取文章详情，解析全部图片(含懒加载data-src)
  4. 多线程下载图片，按文章分目录保存
  5. 保存原始HTML副本+结构化JSON元数据
  6. 生成Markdown索引与CSV清单
  7. 完善的错误重试/限速/日志

用法:
  python3 jk_rs_spider.py                  # 默认抓取全部
  python3 jk_rs_spider.py --pages 1-3      # 只抓前3页文章列表
  python3 jk_rs_spider.py --no-images      # 仅抓取文章文本，不下载图片
  python3 jk_rs_spider.py --workers 8      # 图片下载并发数
  python3 jk_rs_spider.py --resume         # 断点续传(默认开启)
  python3 jk_rs_spider.py --reset          # 重置进度重新开始
"""

import os
import re
import sys
import json
import time
import logging
import argparse
import hashlib
import csv
from pathlib import Path
from datetime import datetime
from urllib.parse import urljoin, urlparse, unquote
from concurrent.futures import ThreadPoolExecutor, as_completed
from collections import OrderedDict

import requests
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry

# ============ 配置 ============
SITE_URL = "https://www.jk.rs"
API_BASE = f"{SITE_URL}/wp-json/wp/v2"
API_POSTS = f"{API_BASE}/posts"
API_CATEGORIES = f"{API_BASE}/categories"
API_TAGS = f"{API_BASE}/tags"
API_MEDIA = f"{API_BASE}/media"

DEFAULT_HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
                  "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Accept": "application/json, text/html, */*",
    "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
    "Referer": f"{SITE_URL}/",
}

OUTPUT_DIR = Path("jk_rs_output")
IMAGES_DIR = OUTPUT_DIR / "images"
HTML_DIR = OUTPUT_DIR / "html"
META_DIR = OUTPUT_DIR / "meta"
LOGS_DIR = OUTPUT_DIR / "logs"

# 图片URL正则 (从HTML/JSON content中提取)
IMG_URL_RE = re.compile(
    r'(?:data-src|data-original|src)\s*=\s*["\']'
    r'(https?://[^"\']+\.(?:jpg|jpeg|png|webp|gif|bmp|jpe))'
    r'["\']',
    re.IGNORECASE
)
# 兜底: 抓取所有非站内静态资源的图片链接
IMG_URL_RE2 = re.compile(
    r'https?://(?:pic\d?\.imgdb\.cn|wkphoto\.cdn\.bcebos\.com|www\.jk\.rs/wp-content/uploads)/[^"\'\s<>)]+?\.(?:jpg|jpeg|png|webp|gif)',
    re.IGNORECASE
)

# 需要排除的图片(占位符、主题素材、头像等)
EXCLUDE_PATTERNS = [
    'giphy-1.gif',
    'default-avatar',
    'wp-content/themes/',
    'cropped-ICO',
    '日式JK-5',
    '日式JK-6',
]

# ============ 日志 ============
def setup_logging():
    LOGS_DIR.mkdir(parents=True, exist_ok=True)
    log_file = LOGS_DIR / f"spider_{datetime.now().strftime('%Y%m%d_%H%M%S')}.log"
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s [%(levelname)s] %(message)s",
        handlers=[
            logging.FileHandler(log_file, encoding="utf-8"),
            logging.StreamHandler(sys.stdout),
        ],
    )
    return logging.getLogger("jk_rs")

log = setup_logging()

# ============ HTTP Session ============
def make_session(retries=5, pool_size=20):
    s = requests.Session()
    s.headers.update(DEFAULT_HEADERS)
    retry = Retry(
        total=retries,
        connect=retries,
        read=retries,
        backoff_factor=1.5,
        status_forcelist=[429, 500, 502, 503, 504],
        allowed_methods=["GET", "HEAD"],
    )
    adapter = HTTPAdapter(pool_connections=pool_size, pool_maxsize=pool_size, max_retries=retry)
    s.mount("https://", adapter)
    s.mount("http://", adapter)
    return s

# ============ 工具函数 ============
def is_valid_image_url(url: str) -> bool:
    """过滤占位符和站点素材"""
    if not url or not url.startswith("http"):
        return False
    for pat in EXCLUDE_PATTERNS:
        if pat in url:
            return False
    return True

def extract_images_from_content(content: str) -> list:
    """从文章HTML内容中提取所有真实图片URL(优先data-src)"""
    urls = []
    seen = set()
    
    # 方法1: 找img标签中的data-src和src
    for m in IMG_URL_RE.finditer(content):
        u = m.group(1)
        if is_valid_image_url(u) and u not in seen:
            seen.add(u)
            urls.append(u)
    
    # 方法2: 兜底正则
    if not urls:
        for m in IMG_URL_RE2.finditer(content):
            u = m.group(0)
            if is_valid_image_url(u) and u not in seen:
                seen.add(u)
                urls.append(u)
    
    return urls

def sanitize_filename(name: str, max_len: int = 80) -> str:
    """清理文件名中的非法字符"""
    name = re.sub(r'[\\/:*?"<>|\r\n\t]+', "_", name).strip()
    name = re.sub(r'_+', '_', name)
    if len(name) > max_len:
        name = name[:max_len]
    return name or "untitled"

def url_ext(url: str) -> str:
    """获取URL中的文件扩展名"""
    path = urlparse(url).path
    ext = os.path.splitext(path)[1].lower()
    if ext in ('.jpg', '.jpeg', '.png', '.webp', '.gif', '.bmp'):
        return ext
    return '.jpg'

# ============ 爬虫核心类 ============
class JKrsSpider:
    def __init__(self, args):
        self.args = args
        self.session = make_session()
        self.posts = []           # 文章元数据列表
        self.categories = {}      # id -> cat info
        self.tags = {}            # id -> tag info
        self.post_detail_map = {} # post_id -> detail dict (持久化断点)
        
        self.progress_file = META_DIR / "progress.json"
        self.posts_file = META_DIR / "posts_list.json"
        self.cats_file = META_DIR / "categories.json"
        self.tags_file = META_DIR / "tags.json"
        
        self._init_dirs()
    
    def _init_dirs(self):
        for d in [OUTPUT_DIR, IMAGES_DIR, HTML_DIR, META_DIR, LOGS_DIR]:
            d.mkdir(parents=True, exist_ok=True)
    
    # ---------- 1. 获取分类/标签 ----------
    def fetch_categories(self):
        log.info("正在获取分类列表...")
        if self.cats_file.exists() and self.args.resume:
            self.categories = json.loads(self.cats_file.read_text(encoding="utf-8"))
            log.info(f"  已加载缓存分类 {len(self.categories)} 个")
            return self.categories
        
        cats = []
        page = 1
        while True:
            try:
                r = self.session.get(API_CATEGORIES, params={"per_page": 100, "page": page}, timeout=30)
                r.raise_for_status()
                data = r.json()
                if not data:
                    break
                cats.extend(data)
                total_pages = int(r.headers.get("X-WP-TotalPages", 1))
                log.info(f"  分类页 {page}/{total_pages}")
                if page >= total_pages:
                    break
                page += 1
                time.sleep(self.args.delay)
            except Exception as e:
                log.error(f"  获取分类页{page}失败: {e}")
                time.sleep(3)
                break
        
        self.categories = {str(c["id"]): {"name": c["name"], "slug": c["slug"], "count": c["count"]} for c in cats}
        self.cats_file.write_text(json.dumps(self.categories, ensure_ascii=False, indent=2), encoding="utf-8")
        log.info(f"  共获取分类 {len(self.categories)} 个")
        return self.categories
    
    def fetch_tags(self):
        log.info("正在获取标签列表(仅前5页，标签量极大)...")
        if self.tags_file.exists() and self.args.resume:
            self.tags = json.loads(self.tags_file.read_text(encoding="utf-8"))
            log.info(f"  已加载缓存标签 {len(self.tags)} 个")
            return self.tags
        
        tags = []
        for page in range(1, 6):
            try:
                r = self.session.get(API_TAGS, params={"per_page": 100, "page": page, "orderby": "count", "order": "desc"}, timeout=30)
                if r.status_code != 200:
                    break
                data = r.json()
                if not data:
                    break
                tags.extend(data)
                log.info(f"  标签页 {page} (累计{len(tags)})")
                time.sleep(self.args.delay)
            except Exception as e:
                log.warning(f"  标签页{page}出错: {e}")
                break
        
        self.tags = {str(t["id"]): {"name": t["name"], "slug": t["slug"], "count": t["count"]} for t in tags}
        self.tags_file.write_text(json.dumps(self.tags, ensure_ascii=False, indent=2), encoding="utf-8")
        log.info(f"  共获取热门标签 {len(self.tags)} 个")
        return self.tags
    
    # ---------- 2. 获取文章列表 ----------
    def fetch_posts_list(self):
        log.info("正在获取文章列表...")
        
        # 断点续传: 如果已存在完整列表，直接加载
        if self.posts_file.exists() and self.args.resume:
            cached = json.loads(self.posts_file.read_text(encoding="utf-8"))
            if cached:
                self.posts = cached
                log.info(f"  已加载缓存文章列表，共 {len(self.posts)} 篇")
                return self.posts
        
        posts = []
        page = 1
        max_pages = self.args.max_pages
        
        # 先获取总页数
        try:
            r = self.session.get(API_POSTS, params={"per_page": 100, "page": 1}, timeout=30)
            r.raise_for_status()
            total_pages = int(r.headers.get("X-WP-TotalPages", 1))
            total_posts = int(r.headers.get("X-WP-Total", 0))
            log.info(f"  文章总数: {total_posts} 篇, 总页数: {total_pages} 页")
            if max_pages is None:
                max_pages = total_pages
            else:
                max_pages = min(max_pages, total_pages)
        except Exception as e:
            log.error(f"  无法获取文章总数: {e}")
            max_pages = max_pages or 1
        
        while page <= max_pages:
            try:
                r = self.session.get(API_POSTS, params={"per_page": 100, "page": page, "_embed": "true"}, timeout=30)
                if r.status_code == 400:
                    log.info(f"  页{page}超出范围，停止")
                    break
                r.raise_for_status()
                data = r.json()
                if not data:
                    break
                
                for p in data:
                    posts.append({
                        "id": p["id"],
                        "date": p["date"],
                        "modified": p["modified"],
                        "slug": p["slug"],
                        "link": p["link"],
                        "title": p["title"]["rendered"],
                        "excerpt": re.sub(r'<[^>]+>', '', p["excerpt"]["rendered"]).strip(),
                        "categories": p.get("categories", []),
                        "tags": p.get("tags", []),
                        "author": p.get("author", 0),
                    })
                
                log.info(f"  文章列表页 {page}/{max_pages} - 累计 {len(posts)} 篇")
                # 增量保存进度
                self.posts_file.write_text(json.dumps(posts, ensure_ascii=False, indent=2), encoding="utf-8")
                page += 1
                time.sleep(self.args.delay)
            except KeyboardInterrupt:
                log.warning("用户中断，保存已有进度")
                break
            except Exception as e:
                log.error(f"  获取文章列表页{page}失败: {e}")
                time.sleep(3)
                continue
        
        self.posts = posts
        self.posts_file.write_text(json.dumps(posts, ensure_ascii=False, indent=2), encoding="utf-8")
        log.info(f"  文章列表获取完成，共 {len(posts)} 篇")
        return posts
    
    # ---------- 3. 获取单篇文章详情 ----------
    def fetch_post_detail(self, post_id: int) -> dict:
        """获取单篇文章完整内容(含正文HTML与图片列表)"""
        cache_file = META_DIR / "posts" / f"{post_id}.json"
        cache_file.parent.mkdir(exist_ok=True)
        
        if cache_file.exists() and self.args.resume:
            try:
                cached = json.loads(cache_file.read_text(encoding="utf-8"))
                if cached.get("images"):
                    return cached
            except:
                pass
        
        try:
            r = self.session.get(f"{API_POSTS}/{post_id}", params={
                "_embed": "true",
            }, timeout=30)
            r.raise_for_status()
            p = r.json()
            
            title = p["title"]["rendered"]
            content_html = p["content"]["rendered"]
            images = extract_images_from_content(content_html)
            
            # 封面图(featured_media)
            featured_url = None
            if p.get("featured_media"):
                try:
                    mr = self.session.get(f"{API_MEDIA}/{p['featured_media']}", timeout=15)
                    if mr.status_code == 200:
                        md = mr.json()
                        featured_url = md.get("source_url")
                except:
                    pass
            
            detail = {
                "id": post_id,
                "date": p["date"],
                "modified": p["modified"],
                "slug": p["slug"],
                "link": p["link"],
                "title": title,
                "author": p.get("author", 0),
                "categories": p.get("categories", []),
                "tags": p.get("tags", []),
                "featured_image": featured_url,
                "images": images,
                "image_count": len(images),
                "content_html": content_html,
                "fetched_at": datetime.now().isoformat(),
            }
            
            # 缓存到本地
            cache_file.write_text(json.dumps(detail, ensure_ascii=False, indent=2), encoding="utf-8")
            return detail
            
        except Exception as e:
            log.error(f"  获取文章 {post_id} 详情失败: {e}")
            return None
    
    # ---------- 4. 下载图片 ----------
    def download_image(self, url: str, save_dir: Path, prefix: str = "", idx: int = 0) -> bool:
        """
        下载单张图片 - 逆向处理百度CDN防盗链
        
        逆向要点:
          pic1.imgdb.cn / pic.imgdb.cn 会302跳转到 wkphoto.cdn.bcebos.com (百度CDN)
          百度CDN配置了Referer白名单(x-error-info: RefererWhite):
            - 允许: 空Referer、百度系域名(baike.baidu.com、image.baidu.com等)
            - 拒绝: 其他所有Referer(包括imgdb.cn自己、jk.rs等)
          浏览器正常访问时因imgdb.cn设置了Referrer-Policy: no-referrer, 
          跳转时浏览器不会发送Referer,因此能正常加载。
          但requests默认会在重定向时把上一跳URL作为Referer带上,触发403。
          
          解决方案: 两步下载法
            1) 先请求原URL,禁止自动重定向,获取Location头(CDN真实地址)
            2) 对CDN地址发起不带Referer的GET请求下载
          对于非imgdb/bcebos的URL(如站点自身wp-content),直接下载。
        """
        ext = url_ext(url)
        url_hash = hashlib.md5(url.encode()).hexdigest()[:10]
        fname = f"{prefix}_{idx:03d}_{url_hash}{ext}" if prefix else f"{idx:03d}_{url_hash}{ext}"
        fpath = save_dir / fname
        
        if fpath.exists() and fpath.stat().st_size > 1024:
            return True
        
        # 图片专用请求头(关键: 不带Referer,模拟浏览器no-referrer跳转)
        img_headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
                          "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            "Accept": "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8",
            "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
            # 显式移除Referer
        }
        
        try:
            # 判断是否需要两步法(走imgdb -> bcebos 302跳转的)
            is_imgdb = "imgdb.cn" in url or "bcebos.com" in url
            target_url = url
            
            if is_imgdb and "bcebos.com" not in url:
                # 第一步: 获取302目标,不跟随重定向
                r1 = self.session.get(url, headers=img_headers, allow_redirects=False, timeout=30)
                if r1.status_code in (301, 302, 303, 307, 308):
                    target_url = r1.headers.get("Location", url)
                    # 有些Location可能是相对路径
                    if target_url.startswith("/"):
                        target_url = urljoin(url, target_url)
                elif r1.status_code == 200 and r1.content:
                    # 有些情况已经直接返回了图片
                    target_url = None
                    content = r1.content
                else:
                    # 其他状态码,直接尝试原URL
                    pass
            
            # 第二步: 下载真实图片URL
            if target_url:
                r = requests.get(target_url, headers=img_headers, timeout=60,
                                 stream=True, allow_redirects=True)
                r.raise_for_status()
                content = r.content
            else:
                # r1已经拿到了内容
                pass
            
            content_type = r.headers.get("Content-Type", "") if target_url else r1.headers.get("Content-Type", "")
            if "html" in content_type.lower() or "text" in content_type.lower():
                log.warning(f"    返回非图片({content_type}): {url[:80]}")
                return False
            
            fpath.parent.mkdir(parents=True, exist_ok=True)
            with open(fpath, "wb") as f:
                f.write(content)
            
            size = fpath.stat().st_size
            if size < 500:
                fpath.unlink(missing_ok=True)
                log.warning(f"    文件过小({size}B)丢弃: {url[:80]}")
                return False
            
            return True
        except requests.exceptions.RequestException as e:
            log.warning(f"    下载失败: {url[:80]} -> {e}")
            return False
        except Exception as e:
            log.warning(f"    下载异常: {url[:80]} -> {e}")
            return False
    
    def download_images_for_post(self, post: dict) -> dict:
        """为一篇文章下载所有图片"""
        pid = post["id"]
        title_slug = sanitize_filename(post["title"])
        post_dir = IMAGES_DIR / f"{pid}_{title_slug}"
        
        images = post.get("images", [])
        if not images:
            return {"post_id": pid, "dir": str(post_dir), "total": 0, "success": 0}
        
        post_dir.mkdir(parents=True, exist_ok=True)
        
        # 记录图片URL->本地文件名映射
        index_file = post_dir / "_index.json"
        
        success = 0
        results = []
        
        # 多线程下载单篇文章内的图片
        with ThreadPoolExecutor(max_workers=min(self.args.img_workers, 6)) as ex:
            futures = {}
            for i, img_url in enumerate(images):
                ext = url_ext(img_url)
                url_hash = hashlib.md5(img_url.encode()).hexdigest()[:10]
                prefix = f"{pid}"
                local_name = f"{prefix}_{i:03d}_{url_hash}{ext}"
                fut = ex.submit(self.download_image, img_url, post_dir, prefix, i)
                futures[fut] = (img_url, local_name)
            
            for fut in as_completed(futures):
                img_url, local_name = futures[fut]
                ok = fut.result()
                if ok:
                    success += 1
                results.append({"url": img_url, "local": local_name, "ok": ok})
        
        index_file.write_text(json.dumps({
            "post_id": pid,
            "title": post["title"],
            "post_link": post.get("link", ""),
            "total": len(images),
            "success": success,
            "images": results,
        }, ensure_ascii=False, indent=2), encoding="utf-8")
        
        return {"post_id": pid, "dir": str(post_dir), "total": len(images), "success": success}
    
    # ---------- 5. 保存HTML副本 ----------
    def save_post_html(self, detail: dict):
        """保存文章内容为本地HTML"""
        pid = detail["id"]
        html_content = f"""<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<title>{detail['title']} - 日式JK</title>
<style>
body{{max-width:900px;margin:20px auto;padding:0 20px;font-family:sans-serif;line-height:1.8;color:#333;}}
h1{{border-bottom:2px solid #e83e8c;padding-bottom:10px;}}
.meta{{color:#888;font-size:14px;margin-bottom:20px;}}
.content img{{max-width:100%;height:auto;display:block;margin:10px auto;border-radius:6px;}}
.tags a{{display:inline-block;margin:2px 4px;padding:3px 10px;background:#f0f0f0;border-radius:4px;text-decoration:none;color:#555;font-size:13px;}}
</style>
</head>
<body>
<h1>{detail['title']}</h1>
<div class="meta">日期: {detail['date']} | 文章ID: {pid} | 图片数: {detail['image_count']}</div>
<div class="content">
{detail['content_html']}
</div>
<hr>
<p><a href="{detail['link']}" target="_blank">原文链接</a></p>
</body>
</html>"""
        title_slug = sanitize_filename(detail["title"])
        fpath = HTML_DIR / f"{pid}_{title_slug}.html"
        fpath.write_text(html_content, encoding="utf-8")
    
    # ---------- 6. 主流程 ----------
    def run(self):
        start_time = time.time()
        log.info("=" * 60)
        log.info(f"jk.rs 全站爬虫启动  输出目录: {OUTPUT_DIR.resolve()}")
        log.info(f"  下载图片: {'是' if self.args.download_images else '否'}")
        log.info(f"  列表并发页: 1, 图片并发: {self.args.img_workers}")
        log.info(f"  请求间隔: {self.args.delay}s")
        log.info("=" * 60)
        
        if self.args.reset:
            log.info("重置模式: 清除已有缓存")
            import shutil
            for f in [self.posts_file, self.cats_file, self.tags_file, self.progress_file]:
                if f.exists():
                    f.unlink()
            for d in [META_DIR / "posts"]:
                if d.exists():
                    shutil.rmtree(d, ignore_errors=True)
        
        # Step 1: 元信息
        self.fetch_categories()
        self.fetch_tags()
        
        # Step 2: 文章列表
        self.fetch_posts_list()
        
        if not self.posts:
            log.error("未获取到任何文章，退出")
            return
        
        # Step 3: 加载进度
        downloaded_ids = set()
        if self.progress_file.exists() and self.args.resume:
            prog = json.loads(self.progress_file.read_text(encoding="utf-8"))
            downloaded_ids = set(prog.get("downloaded_ids", []))
            log.info(f"断点续传: 已完成 {len(downloaded_ids)} 篇文章详情")
        
        # Step 4: 逐篇抓取
        total = len(self.posts)
        total_images = 0
        success_images = 0
        failed_posts = []
        
        for i, post_meta in enumerate(self.posts, 1):
            pid = post_meta["id"]
            title = post_meta["title"]
            
            if pid in downloaded_ids:
                continue
            
            log.info(f"[{i}/{total}] 抓取文章 #{pid}: {title}")
            
            # 获取详情
            detail = self.fetch_post_detail(pid)
            if not detail:
                failed_posts.append(pid)
                time.sleep(1)
                continue
            
            total_images += detail["image_count"]
            
            # 保存HTML副本
            try:
                self.save_post_html(detail)
            except Exception as e:
                log.warning(f"  保存HTML失败: {e}")
            
            # 下载图片
            if self.args.download_images and detail["images"]:
                log.info(f"  下载 {len(detail['images'])} 张图片...")
                dl_result = self.download_images_for_post(detail)
                success_images += dl_result["success"]
                log.info(f"  图片下载完成: {dl_result['success']}/{dl_result['total']}")
                time.sleep(self.args.delay)
            
            downloaded_ids.add(pid)
            
            # 每10篇保存一次进度
            if i % 10 == 0:
                self._save_progress(downloaded_ids, total_images, success_images, failed_posts)
        
        # Step 5: 保存最终进度与报告
        self._save_progress(downloaded_ids, total_images, success_images, failed_posts)
        self._generate_report(total, total_images, success_images, failed_posts)
        
        elapsed = time.time() - start_time
        log.info("=" * 60)
        log.info(f"抓取完成! 耗时: {elapsed/60:.1f} 分钟")
        log.info(f"  文章总数: {total}")
        log.info(f"  成功处理: {len(downloaded_ids)}")
        log.info(f"  失败: {len(failed_posts)}")
        if self.args.download_images:
            log.info(f"  图片总数: {total_images}, 成功下载: {success_images}")
        log.info(f"输出目录: {OUTPUT_DIR.resolve()}")
        log.info("=" * 60)
    
    def _save_progress(self, downloaded_ids, total_images, success_images, failed_posts):
        self.progress_file.write_text(json.dumps({
            "downloaded_ids": list(downloaded_ids),
            "total_images_seen": total_images,
            "success_images": success_images,
            "failed_posts": failed_posts,
            "updated_at": datetime.now().isoformat(),
        }, ensure_ascii=False, indent=2), encoding="utf-8")
    
    def _generate_report(self, total_posts, total_images, success_images, failed_posts):
        """生成CSV清单和Markdown报告"""
        # CSV - 文章清单
        csv_path = OUTPUT_DIR / "文章清单.csv"
        with open(csv_path, "w", encoding="utf-8-sig", newline="") as f:
            w = csv.writer(f)
            w.writerow(["ID", "发布日期", "标题", "分类", "图片数", "原文链接"])
            for pm in self.posts:
                cat_names = []
                for cid in pm.get("categories", []):
                    c = self.categories.get(str(cid))
                    if c:
                        cat_names.append(c["name"])
                pid = pm["id"]
                detail_file = META_DIR / "posts" / f"{pid}.json"
                img_count = 0
                if detail_file.exists():
                    try:
                        img_count = json.loads(detail_file.read_text(encoding="utf-8")).get("image_count", 0)
                    except:
                        pass
                w.writerow([pid, pm["date"], pm["title"], "/".join(cat_names), img_count, pm["link"]])
        log.info(f"文章清单已保存: {csv_path}")
        
        # Markdown报告
        cat_summary = "\n".join(
            f"- {c['name']}: {c['count']} 篇"
            for c in sorted(self.categories.values(), key=lambda x: -x['count'])
        )
        report = f"""# jk.rs 全站抓取报告

**抓取时间**: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}
**站点**: {SITE_URL}
**主题**: 日式JK (WordPress Mango主题)

## 抓取统计

| 指标 | 数值 |
|------|------|
| 文章总数 | {total_posts} |
| 图片总数 | {total_images} |
| 图片下载成功 | {success_images} |
| 图片下载成功率 | {(success_images/total_images*100):.1f}% （若启用了图片下载） |
| 失败文章数 | {len(failed_posts)} |

## 分类统计

{cat_summary}

## 目录结构

```
{OUTPUT_DIR.name}/
├── images/          # 图片文件（按文章分目录）
│   └── {{ID}}_{{标题}}/
│       ├── {{ID}}_001_xxx.jpg
│       └── _index.json   # 图片索引
├── html/            # 文章本地HTML副本
├── meta/
│   ├── posts/       # 每篇文章的结构化JSON详情
│   ├── posts_list.json     # 全部文章列表
│   ├── categories.json     # 分类
│   ├── tags.json           # 标签
│   └── progress.json       # 抓取进度
├── logs/            # 运行日志
└── 文章清单.csv     # 文章清单(Excel可打开)
```

## 技术说明

- 通过 WordPress REST API (`/wp-json/wp/v2/posts`) 获取文章，无需解析HTML分页
- 图片URL从文章正文HTML中正则提取（支持data-src懒加载）
- 隐藏内容（"评论可见"）通过REST API可直接获取完整图片，无需登录
- 图片CDN (imgdb.cn -> 百度CDN) 无Referer防盗链限制，直接下载即可
- 支持断点续传（`--resume`），中断后重新运行会从断点继续

## 失败文章

{f'共 {len(failed_posts)} 篇: {failed_posts}' if failed_posts else '无'}
"""
        (OUTPUT_DIR / "抓取报告.md").write_text(report, encoding="utf-8")
        log.info(f"抓取报告已保存: {OUTPUT_DIR / '抓取报告.md'}")


# ============ 入口 ============
def parse_args():
    p = argparse.ArgumentParser(description="jk.rs 全站爬虫")
    p.add_argument("--pages", type=int, default=None, help="仅抓取文章列表前N页(每页100篇)，默认全部")
    p.add_argument("--max-pages", type=int, default=None, dest="max_pages", help=argparse.SUPPRESS)
    p.add_argument("--workers", type=int, default=4, help="图片下载并发线程数(默认4)")
    p.add_argument("--img-workers", type=int, default=None, dest="img_workers", help=argparse.SUPPRESS)
    p.add_argument("--delay", type=float, default=0.5, help="请求间隔秒数(默认0.5)")
    p.add_argument("--no-images", action="store_false", dest="download_images", help="不下载图片，仅抓取文本")
    p.add_argument("--reset", action="store_true", help="重置进度，从头开始抓取")
    p.add_argument("--no-resume", action="store_false", dest="resume", help="不使用断点续传")
    args = p.parse_args()
    args.max_pages = args.pages
    if args.img_workers is None:
        args.img_workers = args.workers
    return args

if __name__ == "__main__":
    args = parse_args()
    spider = JKrsSpider(args)
    spider.run()
