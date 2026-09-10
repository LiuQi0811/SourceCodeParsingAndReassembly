#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
169tp.com 全站图片爬虫 - 增强版
新增功能:
- 支持命令行参数选择爬取范围
- 进度条显示
- 爬取报告生成
- 指定ID范围爬取
- 日志记录
"""

import os
import re
import sys
import time
import random
import argparse
import threading
from queue import Queue
from urllib.parse import urljoin, urlparse
import requests
from bs4 import BeautifulSoup
import json
from datetime import datetime
from tqdm import tqdm

# 配置
BASE_CONFIG = {
    'base_url': 'https://www.169tp.com/',
    'save_dir': '169tp_images',
    'max_threads': 5,
    'delay': (0.5, 2),
    'img_delay': (0.3, 1),
    'timeout': 30,
    'retry_times': 3,
    'resume': True,
}

# 网站栏目配置
CATEGORIES = {
    'guoneimeinv/': ('国内美女', 2),   # (栏目名, 栏目ID)
    'tupiangushi/': ('图片故事', 1),
    'ziranfengguang/': ('自然风光', 5),
    'gaoxiaotupian/': ('搞笑图片', 6),
    'shoujibizhi/': ('手机壁纸', 8),
    'diannaobizhi/': ('电脑壁纸', 7),
    'meishitupian/': ('美食图片', 4),
    'touxiangdaquan/': ('头像大全', 9),
}

HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
    'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
}

class Crawler169tpPro:
    def __init__(self, config=None):
        self.config = {**BASE_CONFIG, **(config or {})}
        self.session = requests.Session()
        self.session.headers.update(HEADERS)
        
        os.makedirs(self.config['save_dir'], exist_ok=True)
        
        self.record_file = os.path.join(self.config['save_dir'], 'crawl_record.json')
        self.crawled_urls = self.load_record()
        
        self.download_queue = Queue()
        self.pbar = None
        
        self.stats = {
            'total_albums': len(self.crawled_urls['albums']),
            'total_images': len(self.crawled_urls['images']),
            'downloaded': 0,
            'failed': 0,
            'skipped': 0,
            'start_time': time.time()
        }
        
        self.lock = threading.Lock()
        self.log_file = os.path.join(self.config['save_dir'], 'crawl.log')
        self.log(f"爬虫启动: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        
    def log(self, msg):
        """写日志"""
        timestamp = datetime.now().strftime('%H:%M:%S')
        line = f"[{timestamp}] {msg}"
        print(line)
        with open(self.log_file, 'a', encoding='utf-8') as f:
            f.write(line + '\n')
    
    def load_record(self):
        if self.config['resume'] and os.path.exists(self.record_file):
            try:
                with open(self.record_file, 'r', encoding='utf-8') as f:
                    data = json.load(f)
                return {'albums': set(data.get('albums', [])), 'images': set(data.get('images', []))}
            except:
                pass
        return {'albums': set(), 'images': set()}
    
    def save_record(self):
        with self.lock:
            save_data = {
                'albums': list(self.crawled_urls['albums']),
                'images': list(self.crawled_urls['images']),
                'stats': self.stats,
                'last_update': datetime.now().strftime('%Y-%m-%d %H:%M:%S')
            }
            with open(self.record_file, 'w', encoding='utf-8') as f:
                json.dump(save_data, f, ensure_ascii=False, indent=2)
    
    def request(self, url, encoding='gb2312'):
        for i in range(self.config['retry_times']):
            try:
                time.sleep(random.uniform(*self.config['delay']))
                resp = self.session.get(url, timeout=self.config['timeout'])
                resp.encoding = encoding
                if resp.status_code == 200:
                    return resp.text
                elif resp.status_code == 404:
                    return None
            except Exception as e:
                if i == self.config['retry_times'] - 1:
                    self.log(f"请求失败: {url} - {e}")
                time.sleep(2)
        return None
    
    def download_image(self, img_url, save_path):
        if img_url in self.crawled_urls['images'] and os.path.exists(save_path):
            with self.lock:
                self.stats['skipped'] += 1
                if self.pbar:
                    self.pbar.update(1)
            return True
            
        if os.path.exists(save_path):
            with self.lock:
                self.stats['skipped'] += 1
                if self.pbar:
                    self.pbar.update(1)
            return True
            
        for i in range(self.config['retry_times']):
            try:
                img_headers = HEADERS.copy()
                img_headers['Referer'] = self.config['base_url']
                
                time.sleep(random.uniform(*self.config['img_delay']))
                resp = self.session.get(img_url, headers=img_headers, timeout=self.config['timeout'], stream=True)
                
                if resp.status_code == 200:
                    os.makedirs(os.path.dirname(save_path), exist_ok=True)
                    with open(save_path, 'wb') as f:
                        for chunk in resp.iter_content(chunk_size=8192):
                            f.write(chunk)
                    
                    with self.lock:
                        self.stats['downloaded'] += 1
                        self.stats['total_images'] += 1
                        self.crawled_urls['images'].add(img_url)
                        if self.pbar:
                            self.pbar.update(1)
                    return True
            except Exception as e:
                if i == self.config['retry_times'] - 1:
                    with self.lock:
                        self.stats['failed'] += 1
                        if self.pbar:
                            self.pbar.update(1)
                time.sleep(1)
        return False
    
    def parse_album(self, album_url, category_name, max_pages=None):
        if album_url in self.crawled_urls['albums']:
            return
            
        html = self.request(album_url)
        if not html:
            return
        
        soup = BeautifulSoup(html, 'html.parser')
        
        title_tag = soup.find('h1')
        title = title_tag.get_text(strip=True) if title_tag else os.path.basename(album_url).replace('.html', '')
        title = re.sub(r'[\\/:*?"<>|]', '_', title)[:80]
        
        category_dir = os.path.join(self.config['save_dir'], category_name, title)
        
        all_images = []
        
        content_div = soup.find('div', class_='big_img') or soup.find('div', id='content')
        if content_div:
            for img in content_div.find_all('img'):
                img_url = img.get('src', '')
                if img_url:
                    if img_url.startswith('//'):
                        img_url = 'https:' + img_url
                    elif img_url.startswith('/'):
                        img_url = urljoin(self.config['base_url'], img_url)
                    all_images.append(img_url)
        
        page_links = soup.find_all('a', href=re.compile(r'_\d+\.html'))
        page_nums = set()
        for link in page_links:
            href = link.get('href', '')
            match = re.search(r'_(\d+)\.html', href)
            if match:
                page_nums.add(int(match.group(1)))
        
        base_album_url = album_url.replace('.html', '')
        pages_to_crawl = sorted(page_nums)
        if max_pages:
            pages_to_crawl = [p for p in pages_to_crawl if p <= max_pages]
            
        for page_num in pages_to_crawl:
            if page_num == 1:
                continue
            page_url = f"{base_album_url}_{page_num}.html"
            page_html = self.request(page_url)
            if page_html:
                page_soup = BeautifulSoup(page_html, 'html.parser')
                page_content = page_soup.find('div', class_='big_img') or page_soup.find('div', id='content')
                if page_content:
                    for img in page_content.find_all('img'):
                        img_url = img.get('src', '')
                        if img_url:
                            if img_url.startswith('//'):
                                img_url = 'https:' + img_url
                            elif img_url.startswith('/'):
                                img_url = urljoin(self.config['base_url'], img_url)
                            all_images.append(img_url)
        
        # 更新进度条总数
        with self.lock:
            if self.pbar:
                self.pbar.total += len(all_images)
                self.pbar.refresh()
        
        for idx, img_url in enumerate(all_images, 1):
            ext = os.path.splitext(urlparse(img_url).path)[1] or '.jpg'
            img_name = f"{idx:03d}{ext}"
            save_path = os.path.join(category_dir, img_name)
            self.download_queue.put((img_url, save_path))
        
        with self.lock:
            self.crawled_urls['albums'].add(album_url)
            self.stats['total_albums'] += 1
        
        self.log(f"图集: {title} - {len(all_images)} 张图片")
        
        if self.stats['total_albums'] % 5 == 0:
            self.save_record()
    
    def get_total_pages(self, category_url):
        html = self.request(category_url)
        if not html:
            return 1
        
        match = re.search(r'末页.*?list_\d+_(\d+)\.html', html, re.S)
        if match:
            return int(match.group(1))
        
        pages = re.findall(r'list_\d+_(\d+)\.html', html)
        if pages:
            return max(map(int, pages))
        
        return 1
    
    def crawl_category(self, category_path, category_name, cate_id, start_page=1, max_pages=None):
        self.log(f"开始爬取分类: {category_name}")
        
        category_url = urljoin(self.config['base_url'], category_path)
        total_pages = self.get_total_pages(category_url)
        
        if max_pages:
            total_pages = min(total_pages, max_pages)
        
        self.log(f"分类总页数: {total_pages}")
        
        for page in range(start_page, total_pages + 1):
            self.log(f"列表页 {page}/{total_pages}")
            
            if page == 1:
                list_url = category_url
            else:
                list_url = urljoin(category_url, f'list_{cate_id}_{page}.html')
            
            html = self.request(list_url)
            if not html:
                continue
                
            soup = BeautifulSoup(html, 'html.parser')
            
            album_links = set()
            for a in soup.find_all('a', href=True):
                href = a['href']
                if re.search(r'/\d{4}/\d{4}/\d+\.html$', href):
                    full_url = urljoin(self.config['base_url'], href)
                    album_links.add(full_url)
            
            self.log(f"找到 {len(album_links)} 个图集")
            
            for album_url in album_links:
                self.parse_album(album_url, category_name)
    
    def crawl_homepage(self):
        """爬取首页推荐"""
        self.log("爬取首页推荐内容...")
        html = self.request(self.config['base_url'])
        if not html:
            return
            
        soup = BeautifulSoup(html, 'html.parser')
        
        album_links = set()
        for a in soup.find_all('a', href=True):
            href = a['href']
            if re.search(r'/\d{4}/\d{4}/\d+\.html$', href):
                full_url = urljoin(self.config['base_url'], href)
                album_links.add(full_url)
        
        self.log(f"首页找到 {len(album_links)} 个图集")
        
        for album_url in album_links:
            # 判断属于哪个分类
            for cate_path, (cate_name, cate_id) in CATEGORIES.items():
                if cate_path.strip('/') in album_url:
                    self.parse_album(album_url, cate_name)
                    break
            else:
                self.parse_album(album_url, '首页推荐')
    
    def download_worker(self):
        while True:
            item = self.download_queue.get()
            if item is None:
                break
            img_url, save_path = item
            self.download_image(img_url, save_path)
            self.download_queue.task_done()
    
    def generate_report(self):
        """生成爬取报告"""
        elapsed = time.time() - self.stats['start_time']
        report = f"""
╔══════════════════════════════════════════════════════════╗
║                    爬 取 报 告                           ║
╠══════════════════════════════════════════════════════════╣
║  完成时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}                       
║  总耗时: {elapsed/60:.1f} 分钟 ({elapsed/3600:.2f} 小时)                    
╠══════════════════════════════════════════════════════════╣
║  累计爬取图集数: {self.stats['total_albums']:<6d}                             
║  本次下载图片数: {self.stats['downloaded']:<6d}                             
║  跳过已存在: {self.stats['skipped']:<6d}                                 
║  下载失败: {self.stats['failed']:<6d}                                     
║  累计图片总数: {self.stats['total_images']:<6d}                             
╠══════════════════════════════════════════════════════════╣
║  保存目录: {os.path.abspath(self.config['save_dir'])}
╚══════════════════════════════════════════════════════════╝
        """
        print(report)
        
        report_file = os.path.join(self.config['save_dir'], 'crawl_report.txt')
        with open(report_file, 'w', encoding='utf-8') as f:
            f.write(report)
    
    def start(self, categories=None, homepage_only=False, start_page=1, max_pages=None):
        print("""
╔══════════════════════════════════════════════════════════╗
║            169tp.com 全站图片爬虫 v2.0                  ║
║  · 8大栏目全站爬取  · 多线程加速  · 断点续爬             ║
║  · 智能翻页  · 进度显示  · 自动去重                     ║
╚══════════════════════════════════════════════════════════╝
        """)
        
        # 初始化进度条
        self.pbar = tqdm(total=0, desc='下载进度', unit='张', ncols=80)
        
        # 启动下载线程
        threads = []
        for _ in range(self.config['max_threads']):
            t = threading.Thread(target=self.download_worker, daemon=True)
            t.start()
            threads.append(t)
        
        try:
            if homepage_only:
                self.crawl_homepage()
            else:
                cats_to_crawl = {}
                if categories:
                    for cat in categories:
                        if cat in CATEGORIES:
                            cats_to_crawl[cat] = CATEGORIES[cat]
                else:
                    cats_to_crawl = CATEGORIES
                
                for cate_path, (cate_name, cate_id) in cats_to_crawl.items():
                    self.crawl_category(cate_path, cate_name, cate_id, start_page, max_pages)
            
            self.log("等待下载队列完成...")
            self.download_queue.join()
            
        except KeyboardInterrupt:
            self.log("用户中断爬取")
        finally:
            for _ in range(self.config['max_threads']):
                self.download_queue.put(None)
            for t in threads:
                t.join()
            
            if self.pbar:
                self.pbar.close()
            
            self.save_record()
            self.generate_report()

def main():
    parser = argparse.ArgumentParser(description='169tp.com 图片爬虫')
    parser.add_argument('-o', '--output', default='169tp_images', help='图片保存目录')
    parser.add_argument('-t', '--threads', type=int, default=5, help='下载线程数 (默认: 5)')
    parser.add_argument('-c', '--categories', nargs='+', help='指定爬取分类，如: diannaobizhi shoujibizhi')
    parser.add_argument('--homepage', action='store_true', help='只爬取首页推荐')
    parser.add_argument('--start-page', type=int, default=1, help='从第几页开始')
    parser.add_argument('--max-pages', type=int, help='最多爬取多少页列表')
    parser.add_argument('--list-categories', action='store_true', help='列出所有可用分类')
    
    args = parser.parse_args()
    
    if args.list_categories:
        print("可用分类:")
        for path, (name, cid) in CATEGORIES.items():
            print(f"  {path:<20} -> {name}")
        return
    
    config = {
        'save_dir': args.output,
        'max_threads': args.threads,
    }
    
    crawler = Crawler169tpPro(config)
    
    crawler.start(
        categories=args.categories,
        homepage_only=args.homepage,
        start_page=args.start_page,
        max_pages=args.max_pages
    )

if __name__ == '__main__':
    main()