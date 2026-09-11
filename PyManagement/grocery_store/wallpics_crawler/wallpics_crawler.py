#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Wallpics.app 全站壁纸爬虫
功能：
  1. 抓取所有分类（Regular/Live/Double/Matching/Desktop/Hot/New 及40+主题分类）
  2. 自动分页，获取每个壁纸详情页
  3. 解析 RSC 数据，提取原图/各分辨率/AI增强版/动态视频直链
  4. 多线程下载，自动跳过已下载文件
  5. 保存元数据 JSON，支持断点续爬
"""

import os
import re
import sys
import json
import time
import argparse
import threading
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor, as_completed
from urllib.parse import urljoin, urlparse

import requests

# ========== 配置 ==========
BASE_URL = "https://wallpics.app"
MEDIA_BASE = "https://media.wallpics.app"
HEADERS = {
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
                  "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
    "Referer": "https://wallpics.app/",
}
TIMEOUT = 30
RETRY = 3

# 全站分类（来自导航栏 + 横向分类标签）
CATEGORIES = [
    # 主导航
    "/",                    # Regular 首页
    "/live-wallpapers",     # Live 动态壁纸
    "/double-wallpapers",   # Double 双层壁纸
    "/matching-wallpapers", # Matching 情侣配对
    "/desktop-wallpapers",  # Desktop 桌面壁纸
    "/hot",                 # Hot 热门
    "/new",                 # New 最新
    "/profile-pictures",    # PFP 头像
    "/pets",                # Pets 宠物
    # 主题分类
    "/3d-spatial",
    "/luxury",
    "/leopard-4145",
    "/aesthetic",
    "/cars",
    "/sports",
    "/music",
    "/animals-4047",
    "/memes",
    "/space",
    "/devices",
    "/4k",
    "/anime-3",
    "/apple",
    "/cartoon",
    "/gaming-165",
    "/abstract",
    "/tv-shows",
    "/jesus",
    "/amoled",
    "/unlock-live",
    "/movies",
    "/cute",
    "/painting",
    "/dynamic-island",
    "/ai-wallpapers",
    "/motivational",
    "/nature",
    "/ipad",
    "/christmas",
    "/halloween",
]

# ========== 工具函数 ==========
def safe_slug(s):
    """清理文件名中的非法字符"""
    return re.sub(r'[\\/:*?"<>|]', '_', s).strip()[:120]

def requests_get(url, **kwargs):
    """带重试的GET请求"""
    for i in range(RETRY):
        try:
            r = requests.get(url, headers=HEADERS, timeout=TIMEOUT, **kwargs)
            r.raise_for_status()
            return r
        except Exception as e:
            if i == RETRY - 1:
                raise
            time.sleep(1.5 * (i + 1))

def decode_rsc_chunks(html):
    """解码 Next.js RSC (React Server Components) 流数据"""
    chunks = re.findall(r'self\.__next_f\.push\(\[1,"(.*?)"\]\)', html, re.DOTALL)
    full_parts = []
    for c in chunks:
        # The captured group is the content inside a JS string literal "...",
        # wrap in quotes and use json.loads for proper unescaping
        try:
            decoded = json.loads('"' + c + '"')
        except json.JSONDecodeError:
            decoded = c.replace('\\"', '"').replace('\\n', '\n').replace('\\\\', '\\')
        full_parts.append(decoded)
    return '\n'.join(full_parts)

def extract_wallpaper_data(rsc_text):
    """从RSC文本中提取 wallpaperData JSON 对象"""
    marker = '"wallpaperData":{'
    idx = rsc_text.find(marker)
    if idx < 0:
        return None
    # marker 长度17，最后一个字符是 '{'，位置为 idx + 16
    start = idx + len(marker) - 1  # 指向 {
    depth = 0
    end = start
    for i in range(start, min(len(rsc_text), start + 200000)):
        ch = rsc_text[i]
        if ch == '{':
            depth += 1
        elif ch == '}':
            depth -= 1
            if depth == 0:
                end = i + 1
                break
    obj_str = rsc_text[start:end]
    try:
        return json.loads(obj_str)
    except json.JSONDecodeError:
        # 尝试修复 - 尾部可能有多余字符
        for back in range(0, 2000):
            try:
                return json.loads(obj_str[:len(obj_str)-back])
            except:
                continue
        return None

def extract_list_links(html):
    """从列表页提取壁纸详情链接和是否有下一页"""
    links = re.findall(r'href="(/wallpaper/[^"]+)"', html)
    links = list(dict.fromkeys(links))  # 去重保序
    has_next = 'rel="next"' in html
    next_page_match = re.search(r'rel="next"\s+href="([^"]+)"', html)
    next_page = next_page_match.group(1) if next_page_match else None
    return links, has_next, next_page

# ========== 核心爬虫 ==========
class WallpicsCrawler:
    def __init__(self, output_dir="wallpics_download", max_workers=4, download_videos=True, download_upscaled=True):
        self.output_dir = Path(output_dir)
        self.images_dir = self.output_dir / "wallpapers"
        self.videos_dir = self.output_dir / "videos"
        self.meta_dir = self.output_dir / "metadata"
        self.max_workers = max_workers
        self.download_videos = download_videos
        self.download_upscaled = download_upscaled
        self.session = requests.Session()
        self.session.headers.update(HEADERS)
        self.lock = threading.Lock()
        self.downloaded_set = set()
        self.failed_slugs = set()
        self.processed_slugs = set()
        
        # 创建目录
        for d in [self.output_dir, self.images_dir, self.videos_dir, self.meta_dir]:
            d.mkdir(parents=True, exist_ok=True)
        
        # 加载已下载记录
        self.record_file = self.output_dir / "downloaded.json"
        self._load_record()
    
    def _load_record(self):
        if self.record_file.exists():
            try:
                with open(self.record_file, 'r', encoding='utf-8') as f:
                    data = json.load(f)
                    self.downloaded_set = set(data.get("downloaded", []))
                    self.failed_slugs = set(data.get("failed", []))
                    self.processed_slugs = set(data.get("processed", []))
                print(f"[INFO] 已完成壁纸: {len(self.downloaded_set)}, 失败: {len(self.failed_slugs)}")
            except:
                pass
    
    def _save_record(self):
        with self.lock:
            with open(self.record_file, 'w', encoding='utf-8') as f:
                json.dump({
                    "downloaded": list(self.downloaded_set),
                    "failed": list(self.failed_slugs),
                    "processed": list(self.processed_slugs),
                }, f, ensure_ascii=False, indent=2)
    
    def fetch_list_pages(self, category_path):
        """抓取某个分类的所有分页，返回所有壁纸slug"""
        all_slugs = []
        page = 1
        while True:
            url = f"{BASE_URL}{category_path}" if page == 1 else f"{BASE_URL}{category_path}?page={page}"
            if category_path == "/" and page > 1:
                url = f"{BASE_URL}/?page={page}"
            print(f"[LIST] {url}")
            try:
                r = requests_get(url)
                links, has_next, next_href = extract_list_links(r.text)
                if not links:
                    print(f"[LIST] 第{page}页无数据，停止")
                    break
                for link in links:
                    slug = link.replace("/wallpaper/", "").strip("/")
                    if slug not in self.processed_slugs:
                        all_slugs.append(slug)
                print(f"[LIST] 第{page}页获取 {len(links)} 个壁纸，累计 {len(all_slugs)} 个待处理")
                if not has_next:
                    break
                page += 1
                time.sleep(0.5)
            except Exception as e:
                print(f"[LIST] 获取失败: {e}")
                break
        return all_slugs
    
    def download_file(self, url, save_path, category="image"):
        """下载文件，支持断点续传"""
        if save_path.exists() and save_path.stat().st_size > 1024:
            return True  # 已下载
        tmp_path = save_path.with_suffix(save_path.suffix + ".tmp")
        try:
            r = self.session.get(url, stream=True, timeout=TIMEOUT)
            r.raise_for_status()
            with open(tmp_path, 'wb') as f:
                for chunk in r.iter_content(chunk_size=1024 * 64):
                    if chunk:
                        f.write(chunk)
            tmp_path.rename(save_path)
            return True
        except Exception as e:
            if tmp_path.exists():
                tmp_path.unlink()
            print(f"[DL] 下载失败 {url}: {e}")
            return False
    
    def process_wallpaper(self, slug):
        """处理单个壁纸：抓取详情页、解析数据、下载资源"""
        if slug in self.downloaded_set:
            return True
        try:
            url = f"{BASE_URL}/wallpaper/{slug}"
            r = requests_get(url)
            rsc_text = decode_rsc_chunks(r.text)
            wdata = extract_wallpaper_data(rsc_text)
            if not wdata:
                print(f"[WP] 无法解析壁纸数据: {slug}")
                self.failed_slugs.add(slug)
                return False
            
            wp_id = wdata.get("id", 0)
            name = wdata.get("name", slug)
            folder_name = safe_slug(f"{wp_id}_{name}")
            wp_dir = self.images_dir / folder_name
            wp_dir.mkdir(parents=True, exist_ok=True)
            
            # 保存元数据
            meta_path = wp_dir / "meta.json"
            with open(meta_path, 'w', encoding='utf-8') as f:
                json.dump(wdata, f, ensure_ascii=False, indent=2)
            
            # 下载主壁纸（默认最高分辨率）
            main_url = wdata.get("wallpaper")
            downloaded_files = []
            if main_url:
                ext = os.path.splitext(urlparse(main_url).path)[1] or ".png"
                main_path = wp_dir / f"original{ext}"
                ok = self.download_file(main_url, main_path)
                if ok:
                    downloaded_files.append(f"original{ext}")
            
            # 下载AI增强版
            if self.download_upscaled:
                upscaled_url = wdata.get("upscaled")
                if upscaled_url:
                    ext = os.path.splitext(urlparse(upscaled_url).path)[1] or ".webp"
                    up_path = wp_dir / f"upscaled{ext}"
                    self.download_file(upscaled_url, up_path)
            
            # 下载各分辨率版本（跳过is_default的，因为和wallpaper字段重复）
            resolutions = wdata.get("resolutions", [])
            downloaded_urls = set()
            if main_url:
                downloaded_urls.add(main_url)
            for res in resolutions:
                res_url = res.get("image")
                res_slug = res.get("slug", "unknown")
                is_default = res.get("is_default", False)
                if res_url and not is_default and res_url not in downloaded_urls:
                    downloaded_urls.add(res_url)
                    ext = os.path.splitext(urlparse(res_url).path)[1] or ".jpg"
                    res_path = wp_dir / f"{res_slug}{ext}"
                    self.download_file(res_url, res_path)
            
            # 下载动态壁纸视频（Live wallpaper）
            if self.download_videos:
                video_url = wdata.get("thumbnail_video")
                if video_url:
                    ext = os.path.splitext(urlparse(video_url).path)[1] or ".mp4"
                    video_path = self.videos_dir / f"{folder_name}{ext}"
                    self.download_file(video_url, video_path)
            
            self.downloaded_set.add(slug)
            self.processed_slugs.add(slug)
            
            # 每20个保存一次记录
            if len(self.downloaded_set) % 20 == 0:
                self._save_record()
            
            print(f"[OK] {wp_id}: {name}")
            return True
        except Exception as e:
            print(f"[ERR] 处理 {slug} 失败: {e}")
            self.failed_slugs.add(slug)
            return False
    
    def run(self, categories=None, max_pages=None):
        """运行全站爬虫"""
        cats = categories if categories else CATEGORIES
        
        # 第一步：收集所有壁纸slug
        all_slugs = []
        print("=" * 60)
        print("第一步：收集所有壁纸列表...")
        print("=" * 60)
        for cat in cats:
            cat_name = cat.strip("/") or "home"
            print(f"\n[分类] {cat_name}")
            slugs = self.fetch_list_pages(cat)
            all_slugs.extend(slugs)
            time.sleep(0.3)
        
        # 去重
        all_slugs = list(dict.fromkeys(all_slugs))
        # 过滤已完成的
        todo = [s for s in all_slugs if s not in self.downloaded_set and s not in self.failed_slugs]
        print(f"\n{'='*60}")
        print(f"共发现 {len(all_slugs)} 个壁纸，待处理 {len(todo)} 个")
        print(f"{'='*60}\n")
        
        # 第二步：多线程下载详情和资源
        if not todo:
            print("没有新壁纸需要下载！")
            return
        
        with ThreadPoolExecutor(max_workers=self.max_workers) as executor:
            futures = {executor.submit(self.process_wallpaper, slug): slug for slug in todo}
            done_count = 0
            for fut in as_completed(futures):
                done_count += 1
                if done_count % 10 == 0:
                    print(f"[进度] {done_count}/{len(todo)} (完成{len(self.downloaded_set)}, 失败{len(self.failed_slugs)})")
                    self._save_record()
        
        self._save_record()
        print(f"\n{'='*60}")
        print(f"抓取完成！")
        print(f"  成功: {len(self.downloaded_set)}")
        print(f"  失败: {len(self.failed_slugs)}")
        print(f"  保存目录: {self.output_dir.absolute()}")
        print(f"{'='*60}")

# ========== 入口 ==========
def main():
    parser = argparse.ArgumentParser(description="Wallpics.app 全站壁纸爬虫")
    parser.add_argument("-o", "--output", default="wallpics_download", help="输出目录 (默认: wallpics_download)")
    parser.add_argument("-w", "--workers", type=int, default=4, help="并发线程数 (默认: 4)")
    parser.add_argument("--no-video", action="store_true", help="不下载动态壁纸视频")
    parser.add_argument("--no-upscaled", action="store_true", help="不下载AI增强版")
    parser.add_argument("--category", type=str, default=None, help="仅抓取指定分类 (如 /anime-3, /cars)")
    args = parser.parse_args()
    
    cats = None
    if args.category:
        cats = [args.category if args.category.startswith("/") else "/" + args.category]
    
    crawler = WallpicsCrawler(
        output_dir=args.output,
        max_workers=args.workers,
        download_videos=not args.no_video,
        download_upscaled=not args.no_upscaled,
    )
    crawler.run(categories=cats)

if __name__ == "__main__":
    main()
