#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Wallpapers.com 全站爬虫 v2.0
支持栏目: wallpapers / backgrounds / pictures / free-png / free-svg
无需逆向解密 - 图片CDN完全开放直接下载
"""

import os
import re
import sys
import time
import json
import random
import requests
from bs4 import BeautifulSoup
from urllib.parse import urljoin
from concurrent.futures import ThreadPoolExecutor, as_completed
import argparse
from datetime import datetime

class WallpapersCrawler:
    def __init__(self, output_dir='wallpapers_download', max_workers=8, delay=(0.2, 1.0)):
        self.base_url = 'https://wallpapers.com'
        self.output_dir = output_dir
        self.max_workers = max_workers
        self.delay = delay
        
        self.session = requests.Session()
        self.session.headers.update({
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.5',
        })
        
        self.downloaded = 0
        self.failed = 0
        self.skipped = 0
        self.downloaded_files = set()
        self.lock = __import__('threading').Lock()
        
        # 栏目配置
        self.sections = {
            'wallpapers': {'dir': 'wallpapers', 'thumb_path': '/images/thumbnail/', 'hd_path': '/images/hd/'},
            'backgrounds': {'dir': 'backgrounds', 'thumb_path': '/images/thumbnail/', 'hd_path': '/images/hd/'},
            'pictures': {'dir': 'pictures', 'thumb_path': '/images/thumbnail/', 'hd_path': '/images/hd/'},
            'png': {'dir': 'png', 'thumb_path': '/images/thumbnail/', 'hd_path': '/images/file/'},
            'svg': {'dir': 'svg', 'thumb_path': '/images/thumbnail/', 'hd_path': '/images/file/'},
        }
        
        for cfg in self.sections.values():
            os.makedirs(os.path.join(output_dir, cfg['dir']), exist_ok=True)
        
        self.progress_file = os.path.join(output_dir, 'progress.json')
        self.load_progress()
        
        print("=" * 70)
        print("  Wallpapers.com 全站高清爬虫 v2.0")
        print("  无需逆向解密 - CDN直连下载")
        print("=" * 70)
        print(f"  保存目录: {os.path.abspath(output_dir)}")
        print(f"  并发线程: {max_workers}")
        print(f"  请求延迟: {delay[0]}-{delay[1]}秒")
        print(f"  已下载: {self.downloaded} 张")
        print("=" * 70)
    
    def load_progress(self):
        if os.path.exists(self.progress_file):
            try:
                with open(self.progress_file, 'r', encoding='utf-8') as f:
                    data = json.load(f)
                    self.downloaded_files = set(data.get('files', []))
                    self.downloaded = data.get('downloaded', 0)
            except:
                pass
    
    def save_progress(self):
        with self.lock:
            with open(self.progress_file, 'w', encoding='utf-8') as f:
                json.dump({
                    'files': list(self.downloaded_files),
                    'downloaded': self.downloaded,
                    'failed': self.failed,
                    'timestamp': datetime.now().isoformat()
                }, f)
    
    def get(self, url, retries=3):
        for i in range(retries):
            try:
                time.sleep(random.uniform(*self.delay))
                r = self.session.get(url, timeout=30)
                r.raise_for_status()
                return r
            except Exception as e:
                if i == retries - 1:
                    return None
                time.sleep(1)
    
    def get_max_page(self, soup, default=1):
        """从页面提取最大页码"""
        pages = [default]
        for a in soup.find_all('a', href=True):
            m = re.search(r'/page/(\d+)', a['href'])
            if m:
                pages.append(int(m.group(1)))
        for el in soup.find_all(['a', 'button', 'span']):
            t = el.get_text(strip=True)
            if t.isdigit() and int(t) < 100000:
                pages.append(int(t))
        return max(pages)
    
    def extract_page_images(self, soup, section_key):
        """从列表页提取所有高清图片URL"""
        cfg = self.sections[section_key]
        images = []
        seen_ids = set()
        
        # 方法1: 从img标签提取
        for img in soup.find_all('img'):
            src = img.get('src', '') or img.get('data-src', '') or img.get('data-lazy', '')
            if not src:
                continue
            if not src.startswith('http'):
                src = urljoin(self.base_url, src)
            
            if cfg['thumb_path'] in src:
                hd_url = src.replace(cfg['thumb_path'], cfg['hd_path'])
                fname = os.path.basename(hd_url)
                img_id = fname.split('-')[-1].split('.')[0] if '-' in fname else fname
                
                if img_id not in seen_ids:
                    seen_ids.add(img_id)
                    images.append({
                        'url': hd_url,
                        'filename': fname,
                        'section': section_key
                    })
        
        return images
    
    def download_one(self, item):
        url = item['url']
        fname = item['filename']
        section = item['section']
        cfg = self.sections.get(section, self.sections['wallpapers'])
        save_path = os.path.join(self.output_dir, cfg['dir'], fname)
        
        with self.lock:
            if fname in self.downloaded_files or os.path.exists(save_path):
                self.skipped += 1
                return 'skip'
        
        try:
            r = self.session.get(url, timeout=60, stream=True)
            if r.status_code != 200:
                with self.lock:
                    self.failed += 1
                return 'fail'
            
            content = r.content
            if len(content) < 5000:
                with self.lock:
                    self.failed += 1
                return 'fail'
            
            with open(save_path, 'wb') as f:
                f.write(content)
            
            with self.lock:
                self.downloaded_files.add(fname)
                self.downloaded += 1
                if self.downloaded % 20 == 0:
                    self.save_progress()
            
            return 'ok'
        except:
            with self.lock:
                self.failed += 1
            return 'fail'
    
    def crawl_section(self, section, max_pages=None, start_page=1):
        """爬取一个栏目"""
        if section == 'png':
            url_section = 'free-png'
        elif section == 'svg':
            url_section = 'free-svg'
        else:
            url_section = section
        
        print(f"\n{'─'*70}")
        print(f"  栏目: {section}")
        print(f"{'─'*70}")
        
        # 获取第一页确定总页数
        r = self.get(f'{self.base_url}/{url_section}')
        if not r:
            print(f"  ✗ 无法访问栏目首页")
            return
        
        soup = BeautifulSoup(r.text, 'html.parser')
        total_pages = self.get_max_page(soup)
        
        if max_pages:
            total_pages = min(total_pages, max_pages)
        
        print(f"  总页数: {total_pages}")
        
        all_images = []
        all_images.extend(self.extract_page_images(soup, section))
        
        # 获取剩余页面
        for page in range(2, total_pages + 1):
            print(f"  扫描第 {page}/{total_pages} 页...", end='\r')
            r = self.get(f'{self.base_url}/{url_section}/page/{page}')
            if r:
                soup = BeautifulSoup(r.text, 'html.parser')
                all_images.extend(self.extract_page_images(soup, section))
        
        # 去重
        seen = set()
        unique = []
        for img in all_images:
            if img['filename'] not in seen:
                seen.add(img['filename'])
                unique.append(img)
        
        print(f"\n  发现 {len(unique)} 张图片，开始下载...")
        
        # 多线程下载
        with ThreadPoolExecutor(max_workers=self.max_workers) as executor:
            futures = [executor.submit(self.download_one, img) for img in unique]
            done = 0
            for f in as_completed(futures):
                done += 1
                if done % 10 == 0:
                    print(f"  下载进度: {done}/{len(unique)}  成功:{self.downloaded}  跳过:{self.skipped}  失败:{self.failed}", end='\r')
        
        print(f"\n  ✓ {section} 栏目完成")
        self.save_progress()
    
    def run(self, sections=None, max_pages=None):
        if sections is None:
            sections = ['wallpapers', 'backgrounds', 'pictures']
        if 'all' in sections:
            sections = list(self.sections.keys())
        
        start = time.time()
        
        for s in sections:
            self.crawl_section(s, max_pages)
        
        self.save_progress()
        
        elapsed = time.time() - start
        print(f"\n{'='*70}")
        print(f"  全部爬取完成!")
        print(f"{'='*70}")
        print(f"  耗时: {elapsed/60:.1f} 分钟")
        print(f"  新下载: {self.downloaded} 张")
        print(f"  跳过(已存在): {self.skipped} 张")
        print(f"  失败: {self.failed} 张")
        print(f"  保存目录: {os.path.abspath(self.output_dir)}")
        print(f"{'='*70}")


def main():
    parser = argparse.ArgumentParser(description='Wallpapers.com 全站爬虫')
    parser.add_argument('-o', '--output', default='wallpapers_hd', help='保存目录')
    parser.add_argument('-w', '--workers', type=int, default=8, help='并发线程数')
    parser.add_argument('-p', '--pages', type=int, default=None, help='每个栏目最大页数(默认全部)')
    parser.add_argument('-s', '--sections', nargs='+', default=['wallpapers'],
                        choices=['wallpapers', 'backgrounds', 'pictures', 'png', 'svg', 'all'],
                        help='爬取栏目 (默认: wallpapers)')
    parser.add_argument('--delay', type=float, nargs=2, default=[0.2, 1.0], help='请求延迟(秒)')
    
    args = parser.parse_args()
    
    crawler = WallpapersCrawler(
        output_dir=args.output,
        max_workers=args.workers,
        delay=tuple(args.delay)
    )
    crawler.run(sections=args.sections, max_pages=args.pages)


if __name__ == '__main__':
    main()
