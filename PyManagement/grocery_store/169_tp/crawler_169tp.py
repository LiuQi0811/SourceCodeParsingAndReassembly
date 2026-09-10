#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
169tp.com 全站图片爬虫
功能：全站爬取图片，支持增量更新、多线程下载、断点续爬
"""

import os
import re
import time
import random
import threading
from queue import Queue
from urllib.parse import urljoin, urlparse
import requests
from bs4 import BeautifulSoup
import json
from datetime import datetime

# 配置
CONFIG = {
    'base_url': 'https://www.169tp.com/',
    'save_dir': '169tp_images',  # 图片保存目录
    'max_threads': 5,            # 下载线程数
    'delay': (1, 3),             # 请求延迟范围(秒)
    'timeout': 30,               # 请求超时
    'retry_times': 3,            # 重试次数
    'resume': True,              # 是否断点续爬
}

# 网站栏目配置 (栏目路径: 栏目名称)
CATEGORIES = {
    'guoneimeinv/': '国内美女',
    'tupiangushi/': '图片故事',
    'ziranfengguang/': '自然风光',
    'gaoxiaotupian/': '搞笑图片',
    'shoujibizhi/': '手机壁纸',
    'diannaobizhi/': '电脑壁纸',
    'meishitupian/': '美食图片',
    'touxiangdaquan/': '头像大全',
}

# 请求头
HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
    'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
    'Referer': 'https://www.169tp.com/',
}

class Crawler169tp:
    def __init__(self):
        self.session = requests.Session()
        self.session.headers.update(HEADERS)
        
        # 创建保存目录
        os.makedirs(CONFIG['save_dir'], exist_ok=True)
        
        # 已爬取记录
        self.record_file = os.path.join(CONFIG['save_dir'], 'crawl_record.json')
        self.crawled_urls = self.load_record()
        
        # 下载队列
        self.download_queue = Queue()
        
        # 统计
        self.stats = {
            'total_albums': 0,
            'total_images': 0,
            'downloaded': 0,
            'failed': 0,
            'start_time': time.time()
        }
        
        # 线程锁
        self.lock = threading.Lock()
        
    def load_record(self):
        """加载爬取记录"""
        if CONFIG['resume'] and os.path.exists(self.record_file):
            try:
                with open(self.record_file, 'r', encoding='utf-8') as f:
                    data = json.load(f)
                print(f"[+] 加载已爬取记录: {len(data.get('albums', []))} 个图集")
                return data
            except:
                pass
        return {'albums': set(), 'images': set()}
    
    def save_record(self):
        """保存爬取记录"""
        with self.lock:
            save_data = {
                'albums': list(self.crawled_urls['albums']),
                'images': list(self.crawled_urls['images']),
                'last_update': datetime.now().strftime('%Y-%m-%d %H:%M:%S')
            }
            with open(self.record_file, 'w', encoding='utf-8') as f:
                json.dump(save_data, f, ensure_ascii=False, indent=2)
    
    def request(self, url, encoding='gb2312'):
        """发送HTTP请求"""
        for i in range(CONFIG['retry_times']):
            try:
                time.sleep(random.uniform(*CONFIG['delay']))
                resp = self.session.get(url, timeout=CONFIG['timeout'])
                resp.encoding = encoding
                if resp.status_code == 200:
                    return resp.text
                elif resp.status_code == 404:
                    return None
            except Exception as e:
                print(f"[!] 请求失败({i+1}/{CONFIG['retry_times']}): {url} - {e}")
                time.sleep(2)
        return None
    
    def download_image(self, img_url, save_path):
        """下载单张图片"""
        if os.path.exists(save_path):
            with self.lock:
                self.stats['downloaded'] += 1
            return True
            
        for i in range(CONFIG['retry_times']):
            try:
                # 构建图片请求头
                img_headers = HEADERS.copy()
                img_headers['Referer'] = CONFIG['base_url']
                
                time.sleep(random.uniform(0.5, 1.5))
                resp = self.session.get(img_url, headers=img_headers, timeout=CONFIG['timeout'], stream=True)
                
                if resp.status_code == 200:
                    os.makedirs(os.path.dirname(save_path), exist_ok=True)
                    with open(save_path, 'wb') as f:
                        for chunk in resp.iter_content(chunk_size=8192):
                            f.write(chunk)
                    
                    with self.lock:
                        self.stats['downloaded'] += 1
                        self.crawled_urls['images'].add(img_url)
                    return True
            except Exception as e:
                if i == CONFIG['retry_times'] - 1:
                    print(f"[!] 图片下载失败: {img_url} - {e}")
                    with self.lock:
                        self.stats['failed'] += 1
                time.sleep(1)
        return False
    
    def parse_album(self, album_url, category_name):
        """解析图集详情页，提取所有图片"""
        if album_url in self.crawled_urls['albums']:
            return
            
        print(f"[*] 解析图集: {album_url}")
        
        html = self.request(album_url)
        if not html:
            return
        
        soup = BeautifulSoup(html, 'html.parser')
        
        # 获取标题
        title = soup.find('h1')
        if title:
            title = title.get_text(strip=True)
        else:
            title = os.path.basename(album_url).replace('.html', '')
        
        # 清理标题中的非法字符
        title = re.sub(r'[\\/:*?"<>|]', '_', title)
        
        # 获取分类文件夹名
        category_dir = os.path.join(CONFIG['save_dir'], category_name, title)
        
        # 提取当前页图片
        content_div = soup.find('div', class_='big_img') or soup.find('div', id='content')
        if content_div:
            images = content_div.find_all('img')
            for idx, img in enumerate(images, 1):
                img_url = img.get('src', '')
                if img_url:
                    if img_url.startswith('//'):
                        img_url = 'https:' + img_url
                    elif img_url.startswith('/'):
                        img_url = urljoin(CONFIG['base_url'], img_url)
                    
                    # 获取扩展名
                    ext = os.path.splitext(urlparse(img_url).path)[1] or '.jpg'
                    img_name = f"{idx:03d}{ext}"
                    save_path = os.path.join(category_dir, img_name)
                    
                    self.download_queue.put((img_url, save_path))
        
        # 检查分页 - 获取所有分页图片
        page_links = soup.find_all('a', href=re.compile(r'_\d+\.html'))
        page_nums = set()
        for link in page_links:
            href = link.get('href', '')
            match = re.search(r'_(\d+)\.html', href)
            if match:
                page_nums.add(int(match.group(1)))
        
        # 爬取其余分页
        base_album_url = album_url.replace('.html', '')
        for page_num in sorted(page_nums):
            if page_num == 1:
                continue
            page_url = f"{base_album_url}_{page_num}.html"
            page_html = self.request(page_url)
            if page_html:
                page_soup = BeautifulSoup(page_html, 'html.parser')
                page_content = page_soup.find('div', class_='big_img') or page_soup.find('div', id='content')
                if page_content:
                    page_images = page_content.find_all('img')
                    # 计算图片序号偏移
                    offset = len(images) + (page_num - 2) * len(page_images)
                    for idx, img in enumerate(page_images, 1):
                        img_url = img.get('src', '')
                        if img_url:
                            if img_url.startswith('//'):
                                img_url = 'https:' + img_url
                            elif img_url.startswith('/'):
                                img_url = urljoin(CONFIG['base_url'], img_url)
                            
                            ext = os.path.splitext(urlparse(img_url).path)[1] or '.jpg'
                            img_name = f"{offset + idx:03d}{ext}"
                            save_path = os.path.join(category_dir, img_name)
                            self.download_queue.put((img_url, save_path))
        
        with self.lock:
            self.crawled_urls['albums'].add(album_url)
            self.stats['total_albums'] += 1
        
        # 每爬取10个图集保存一次记录
        if self.stats['total_albums'] % 10 == 0:
            self.save_record()
    
    def parse_list_page(self, list_url, category_name, category_path):
        """解析列表页，获取所有图集链接和总页数"""
        html = self.request(list_url)
        if not html:
            return []
        
        soup = BeautifulSoup(html, 'html.parser')
        
        # 获取所有图集链接
        album_links = []
        for a in soup.find_all('a', href=True):
            href = a['href']
            # 匹配详情页URL格式: /栏目/年/月日/ID.html
            if re.search(r'/\d{4}/\d{4}/\d+\.html$', href):
                full_url = urljoin(CONFIG['base_url'], href)
                album_links.append(full_url)
        
        # 去重
        album_links = list(set(album_links))
        
        return album_links
    
    def get_total_pages(self, category_url):
        """获取分类总页数"""
        html = self.request(category_url)
        if not html:
            return 1
        
        # 查找末页链接
        match = re.search(r'list_\d+_(\d+)\.html', html)
        if match:
            return int(match.group(1))
        
        # 查找分页数字
        pages = re.findall(r'list_\d+_(\d+)\.html', html)
        if pages:
            return max(map(int, pages))
        
        return 1
    
    def download_worker(self):
        """下载线程"""
        while True:
            item = self.download_queue.get()
            if item is None:
                break
            
            img_url, save_path = item
            self.download_image(img_url, save_path)
            self.download_queue.task_done()
    
    def crawl_category(self, category_path, category_name):
        """爬取单个分类"""
        print(f"\n{'='*50}")
        print(f"[+] 开始爬取分类: {category_name}")
        print(f"{'='*50}")
        
        category_url = urljoin(CONFIG['base_url'], category_path)
        
        # 获取总页数
        total_pages = self.get_total_pages(category_url)
        print(f"[+] 分类总页数: {total_pages}")
        
        # 爬取每一页列表
        for page in range(1, total_pages + 1):
            print(f"\n[*] 爬取列表页 {page}/{total_pages}")
            
            if page == 1:
                list_url = category_url
            else:
                # 查找栏目ID
                list_html = self.request(category_url)
                if list_html:
                    match = re.search(r'list_(\d+)_2\.html', list_html)
                    if match:
                        cate_id = match.group(1)
                        list_url = urljoin(category_url, f'list_{cate_id}_{page}.html')
                    else:
                        print(f"[!] 无法获取第 {page} 页URL")
                        continue
                else:
                    continue
            
            # 解析列表页获取图集链接
            album_links = self.parse_list_page(list_url, category_name, category_path)
            print(f"[+] 找到 {len(album_links)} 个图集")
            
            # 爬取每个图集
            for album_url in album_links:
                self.parse_album(album_url, category_name)
    
    def start(self):
        """启动爬虫"""
        print("""
╔═══════════════════════════════════════════════╗
║           169tp.com 全站图片爬虫              ║
╠═══════════════════════════════════════════════╣
║  功能说明:                                     ║
║  • 支持8个栏目全站爬取                        ║
║  • 多线程下载                                 ║
║  • 断点续爬                                   ║
║  • 自动翻页                                   ║
╚═══════════════════════════════════════════════╝
        """)
        
        # 启动下载线程
        threads = []
        for _ in range(CONFIG['max_threads']):
            t = threading.Thread(target=self.download_worker, daemon=True)
            t.start()
            threads.append(t)
        
        try:
            # 爬取所有分类
            for cate_path, cate_name in CATEGORIES.items():
                self.crawl_category(cate_path, cate_name)
            
            # 等待所有下载任务完成
            print("\n[*] 等待下载队列完成...")
            self.download_queue.join()
            
        except KeyboardInterrupt:
            print("\n[!] 用户中断爬取")
        finally:
            # 停止下载线程
            for _ in range(CONFIG['max_threads']):
                self.download_queue.put(None)
            for t in threads:
                t.join()
            
            # 保存记录
            self.save_record()
            
            # 输出统计
            elapsed = time.time() - self.stats['start_time']
            print(f"\n{'='*50}")
            print(f"爬取完成!")
            print(f"  爬取图集数: {self.stats['total_albums']}")
            print(f"  下载图片数: {self.stats['downloaded']}")
            print(f"  失败图片数: {self.stats['failed']}")
            print(f"  耗时: {elapsed/60:.1f} 分钟")
            print(f"  保存目录: {os.path.abspath(CONFIG['save_dir'])}")
            print(f"{'='*50}")

if __name__ == '__main__':
    crawler = Crawler169tp()
    crawler.start()