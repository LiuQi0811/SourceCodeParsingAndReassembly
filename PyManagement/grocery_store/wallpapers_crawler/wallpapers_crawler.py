#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Wallpapers.com 全站爬虫
支持下载: Wallpapers / Backgrounds / Pictures / Free PNG / Free SVG / Coloring Pages
无需逆向解密 - 图片CDN完全开放直接下载
"""

import os
import re
import time
import json
import random
import requests
from bs4 import BeautifulSoup
from urllib.parse import urljoin, urlparse
from concurrent.futures import ThreadPoolExecutor, as_completed
from threading import Lock
import argparse
from datetime import datetime

class WallpapersCrawler:
    def __init__(self, output_dir='wallpapers_download', max_workers=5, delay=(0.5, 2)):
        self.base_url = 'https://wallpapers.com'
        self.output_dir = output_dir
        self.max_workers = max_workers
        self.delay = delay
        
        self.session = requests.Session()
        self.session.headers.update({
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.5',
            'Referer': 'https://wallpapers.com/',
        })
        
        # 统计和去重
        self.downloaded_count = 0
        self.failed_count = 0
        self.total_images = 0
        self.processed_urls = set()
        self.lock = Lock()
        
        # 创建目录
        self.sections = {
            'wallpapers': os.path.join(output_dir, 'wallpapers'),
            'backgrounds': os.path.join(output_dir, 'backgrounds'),
            'pictures': os.path.join(output_dir, 'pictures'),
            'png': os.path.join(output_dir, 'png'),
            'svg': os.path.join(output_dir, 'svg'),
            'coloring-pages': os.path.join(output_dir, 'coloring-pages'),
        }
        for path in self.sections.values():
            os.makedirs(path, exist_ok=True)
        
        # 进度文件
        self.progress_file = os.path.join(output_dir, 'crawl_progress.json')
        self.load_progress()
        
        print("=" * 60)
        print("  Wallpapers.com 全站爬虫")
        print("=" * 60)
        print(f"  保存目录: {os.path.abspath(output_dir)}")
        print(f"  并发数: {max_workers}")
        print(f"  请求延迟: {delay[0]}-{delay[1]}秒")
        print("=" * 60)
    
    def load_progress(self):
        """加载下载进度"""
        if os.path.exists(self.progress_file):
            with open(self.progress_file, 'r', encoding='utf-8') as f:
                data = json.load(f)
                self.processed_urls = set(data.get('processed_urls', []))
                self.downloaded_count = data.get('downloaded_count', 0)
                print(f"  已恢复进度: 已下载 {self.downloaded_count} 张图片")
    
    def save_progress(self):
        """保存下载进度"""
        with self.lock:
            with open(self.progress_file, 'w', encoding='utf-8') as f:
                json.dump({
                    'processed_urls': list(self.processed_urls),
                    'downloaded_count': self.downloaded_count,
                    'failed_count': self.failed_count,
                    'last_update': datetime.now().isoformat()
                }, f, indent=2)
    
    def random_delay(self):
        """随机延迟"""
        time.sleep(random.uniform(*self.delay))
    
    def get_soup(self, url, retries=3):
        """获取页面BeautifulSoup对象"""
        for i in range(retries):
            try:
                self.random_delay()
                r = self.session.get(url, timeout=30)
                r.raise_for_status()
                return BeautifulSoup(r.text, 'html.parser')
            except Exception as e:
                if i == retries - 1:
                    print(f"  ✗ 请求失败: {url} - {e}")
                    return None
                time.sleep(2 ** i)
    
    def extract_image_id_from_url(self, url):
        """从URL中提取图片ID/文件名"""
        # 从详情页URL提取: /wallpapers/xxx-abc123.html -> abc123
        # 从缩略图URL提取: /images/thumbnail/xxx-abc123.jpg -> abc123
        match = re.search(r'-([a-z0-9]+)\.(html|jpg|png|svg)$', url)
        if match:
            return match.group(1)
        # fallback: 使用最后一段
        return os.path.basename(url).split('.')[0]
    
    def thumbnail_to_hd(self, thumb_url, section='wallpapers'):
        """将缩略图URL转换为高清URL"""
        if '/thumbnail/' in thumb_url:
            return thumb_url.replace('/thumbnail/', '/hd/')
        # 其他类型直接返回
        return thumb_url
    
    def get_page_links(self, section, page=1):
        """获取指定栏目某一页的所有壁纸链接和缩略图"""
        if page == 1:
            url = f'{self.base_url}/{section}'
        else:
            url = f'{self.base_url}/{section}/page/{page}'
        
        if section in ['free-png', 'free-svg']:
            section_key = section.replace('free-', '')
        elif section == 'coloring-pages':
            section_key = 'coloring-pages'
        else:
            section_key = section
        
        soup = self.get_soup(url)
        if not soup:
            return [], 0
        
        # 提取详情页链接和缩略图
        images = []
        detail_links = set()
        
                # 查找所有图片 - 支持src和data-src懒加载
                for img in soup.find_all('img'):
                    src = img.get('src', '') or img.get('data-src', '') or img.get('data-lazy-src', '')
                    if not src:
                        continue
                    if not src.startswith('http'):
                        src = urljoin(self.base_url, src)
                    
                    # 识别不同类型的图片
                    if any(t in src for t in ['/images/thumbnail/', '/images/hd/', '/images/png/', '/images/svg/', '/images/coloring/']):
                # 找到对应的详情页链接
                parent_a = img.find_parent('a', href=True)
                detail_url = None
                if parent_a:
                    href = parent_a['href']
                    if href.endswith('.html'):
                        detail_url = urljoin(self.base_url, href)
                        detail_links.add(detail_url)
                
                # 获取高清URL
                hd_url = self.thumbnail_to_hd(src)
                
                # 确定文件扩展名
                ext = '.jpg'
                if section == 'png' or '/png/' in src:
                    ext = '.png'
                elif section == 'svg' or '/svg/' in src:
                    ext = '.svg'
                
                # 生成文件名
                img_id = self.extract_image_id_from_url(src)
                filename = f"{img_id}{ext}"
                
                images.append({
                    'thumb_url': src,
                    'hd_url': hd_url,
                    'detail_url': detail_url,
                    'filename': filename,
                    'section': section_key
                })
        
        # 去重
        seen = set()
        unique_images = []
        for img in images:
            if img['filename'] not in seen:
                seen.add(img['filename'])
                unique_images.append(img)
        
        # 查找最大页数
        max_page = page
        for a in soup.find_all('a', href=True):
            match = re.search(r'/page/(\d+)', a['href'])
            if match:
                p = int(match.group(1))
                if p > max_page:
                    max_page = p
        
        # 也检查数字按钮
        for btn in soup.find_all(['a', 'button']):
            text = btn.get_text(strip=True)
            if text.isdigit():
                p = int(text)
                if p > max_page and p < 100000:
                    max_page = p
        
        return unique_images, max_page
    
    def download_image(self, img_info):
        """下载单张图片"""
        url = img_info['hd_url']
        filename = img_info['filename']
        section = img_info['section']
        
        save_path = os.path.join(self.sections.get(section, self.sections['wallpapers']), filename)
        
        # 检查是否已下载
        with self.lock:
            if url in self.processed_urls or os.path.exists(save_path):
                return True, 'skip'
        
        try:
            self.random_delay()
            r = self.session.get(url, timeout=60, stream=True)
            r.raise_for_status()
            
            # 检查是否是真实图片
            content_type = r.headers.get('content-type', '')
            if 'image' not in content_type and 'octet-stream' not in content_type:
                # 尝试URL变种
                return False, 'not_image'
            
            with open(save_path, 'wb') as f:
                for chunk in r.iter_content(chunk_size=8192):
                    f.write(chunk)
            
            with self.lock:
                self.processed_urls.add(url)
                self.downloaded_count += 1
                
                if self.downloaded_count % 50 == 0:
                    self.save_progress()
                    print(f"  已下载: {self.downloaded_count} 张")
            
            return True, 'success'
            
        except Exception as e:
            with self.lock:
                self.failed_count += 1
            return False, str(e)
    
    def crawl_section(self, section, max_pages=None, start_page=1):
        """爬取指定栏目"""
        print(f"\n{'='*60}")
        print(f"  开始爬取栏目: {section}")
        print(f"{'='*60}")
        
        # 先获取第一页确定总页数
        print(f"  获取第1页...")
        first_page_images, total_pages = self.get_page_links(section, 1)
        
        if max_pages:
            total_pages = min(total_pages, max_pages)
        
        print(f"  总页数: {total_pages}")
        print(f"  第1页图片数: {len(first_page_images)}")
        
        all_images = first_page_images
        
        # 获取剩余页面
        for page in range(start_page + 1, total_pages + 1):
            print(f"  获取第{page}/{total_pages}页...", end='\r')
            images, _ = self.get_page_links(section, page)
            all_images.extend(images)
            
            if page % 10 == 0:
                time.sleep(1)
        
        # 去重
        seen = set()
        unique_images = []
        for img in all_images:
            if img['filename'] not in seen:
                seen.add(img['filename'])
                unique_images.append(img)
        
        self.total_images += len(unique_images)
        print(f"\n  该栏目共发现 {len(unique_images)} 张唯一图片")
        
        # 多线程下载
        success = 0
        failed = 0
        skipped = 0
        
        with ThreadPoolExecutor(max_workers=self.max_workers) as executor:
            futures = {executor.submit(self.download_image, img): img for img in unique_images}
            
            for i, future in enumerate(as_completed(futures)):
                ok, msg = future.result()
                if ok:
                    if msg == 'skip':
                        skipped += 1
                    else:
                        success += 1
                else:
                    failed += 1
                
                if (i + 1) % 20 == 0:
                    print(f"  进度: {i+1}/{len(unique_images)} (成功:{success} 跳过:{skipped} 失败:{failed})", end='\r')
        
        print(f"\n  栏目 {section} 完成! 成功:{success} 跳过:{skipped} 失败:{failed}")
        self.save_progress()
        return success, failed
    
    def crawl_categories(self, max_categories=None):
        """爬取所有分类页面"""
        print(f"\n{'='*60}")
        print(f"  开始发现分类...")
        print(f"{'='*60}")
        
        soup = self.get_soup(self.base_url)
        if not soup:
            return []
        
        categories = set()
        for a in soup.find_all('a', href=True):
            href = a['href']
            # 分类链接格式: https://wallpapers.com/category-name
            if href.startswith('https://wallpapers.com/') or href.startswith('/'):
                path = urlparse(href).path.strip('/')
                parts = path.split('/')
                if len(parts) == 1 and parts[0] and not parts[0].startswith(('static', 'images', 'wp-', 'premium', 'tools', 'article', 'collection')):
                    if parts[0] not in ['', 'wallpapers', 'backgrounds', 'pictures', 'free-png', 'free-svg', 'coloring-pages', 'new', 'popular', 'index', 'collections', 'discover-wallpapers', 'login', 'join', 'submit-wallpapers']:
                        categories.add(parts[0])
        
        categories = sorted(list(categories))
        if max_categories:
            categories = categories[:max_categories]
        
        print(f"  发现 {len(categories)} 个分类")
        return categories
    
    def crawl_category(self, category, max_pages=None):
        """爬取单个分类"""
        print(f"\n  分类: {category}")
        
        all_images = []
        
        # 获取第一页
        images, total_pages = self.get_page_links(category, 1)
        all_images.extend(images)
        
        if max_pages:
            total_pages = min(total_pages, max_pages)
        
        for page in range(2, total_pages + 1):
            images, _ = self.get_page_links(category, page)
            all_images.extend(images)
        
        # 去重并下载
        seen = set()
        unique_images = []
        for img in all_images:
            if img['filename'] not in seen:
                seen.add(img['filename'])
                # 分类图片归入wallpapers目录
                img['section'] = 'wallpapers'
                unique_images.append(img)
        
        success = 0
        with ThreadPoolExecutor(max_workers=self.max_workers) as executor:
            futures = [executor.submit(self.download_image, img) for img in unique_images]
            for future in as_completed(futures):
                ok, _ = future.result()
                if ok:
                    success += 1
        
        print(f"    分类 {category} 下载完成: {success} 张")
        return success
    
    def run(self, sections=None, max_pages=None, crawl_categories=False, max_categories=None):
        """运行爬虫"""
        start_time = time.time()
        
        if sections is None:
            sections = ['wallpapers', 'backgrounds', 'pictures']
        
        # 爬取指定栏目
        for section in sections:
            self.crawl_section(section, max_pages=max_pages)
        
        # 是否爬取分类
        if crawl_categories:
            categories = self.crawl_categories(max_categories)
            print(f"\n  开始爬取 {len(categories)} 个分类...")
            for i, cat in enumerate(categories):
                print(f"  [{i+1}/{len(categories)}]", end='')
                self.crawl_category(cat, max_pages=max_pages)
        
        # 最终保存
        self.save_progress()
        
        elapsed = time.time() - start_time
        print(f"\n{'='*60}")
        print(f"  爬取完成!")
        print(f"{'='*60}")
        print(f"  总耗时: {elapsed/60:.1f} 分钟")
        print(f"  总下载成功: {self.downloaded_count} 张")
        print(f"  总失败: {self.failed_count} 张")
        print(f"  保存位置: {os.path.abspath(self.output_dir)}")
        print(f"{'='*60}")


def main():
    parser = argparse.ArgumentParser(description='Wallpapers.com 全站爬虫')
    parser.add_argument('-o', '--output', default='wallpapers_download', help='保存目录')
    parser.add_argument('-w', '--workers', type=int, default=5, help='并发下载数')
    parser.add_argument('-p', '--pages', type=int, default=None, help='每个栏目最大页数(默认全部)')
    parser.add_argument('-d', '--delay', type=float, nargs=2, default=[0.5, 2.0], help='请求延迟范围(秒)')
    parser.add_argument('-s', '--sections', nargs='+', default=['wallpapers', 'backgrounds', 'pictures'], 
                        choices=['wallpapers', 'backgrounds', 'pictures', 'png', 'svg', 'coloring-pages', 'all'],
                        help='要爬取的栏目')
    parser.add_argument('--categories', action='store_true', help='同时爬取所有分类页面')
    parser.add_argument('--max-categories', type=int, default=None, help='最多爬取分类数量')
    
    args = parser.parse_args()
    
    if 'all' in args.sections:
        args.sections = ['wallpapers', 'backgrounds', 'pictures', 'png', 'svg', 'coloring-pages']
    
    crawler = WallpapersCrawler(
        output_dir=args.output,
        max_workers=args.workers,
        delay=tuple(args.delay)
    )
    
    crawler.run(
        sections=args.sections,
        max_pages=args.pages,
        crawl_categories=args.categories,
        max_categories=args.max_categories
    )


if __name__ == '__main__':
    main()
