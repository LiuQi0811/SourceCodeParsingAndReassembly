#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
动漫啦 (dongman.la) 全站漫画爬虫
功能：
1. 自动爬取所有分类下的漫画
2. 下载每个漫画的所有章节图片
3. 支持断点续传
4. 自动重试失败请求
5. 多线程加速下载
6. 保存目录结构清晰

使用方法：
    python dongmanla_spider.py                  # 爬取全站
    python dongmanla_spider.py --comic-id 5985  # 只爬取指定ID漫画
    python dongmanla_spider.py --delay 1        # 设置请求延迟(秒)
    python dongmanla_spider.py --threads 5      # 设置下载线程数
"""

import os
import re
import time
import json
import random
import argparse
import threading
from urllib.parse import urljoin, urlparse
from concurrent.futures import ThreadPoolExecutor, as_completed
from collections import deque

import requests
from bs4 import BeautifulSoup
from tqdm import tqdm


class DongmanLaSpider:
    def __init__(self, delay=0.5, threads=5, output_dir="dongmanla_downloads"):
        self.base_url = "https://www.dongman.la"
        self.img_base = "https://img.dongman.la"
        self.delay = delay
        self.threads = threads
        self.output_dir = output_dir
        self.session = requests.Session()
        self.lock = threading.Lock()
        self.visited_comics = set()
        self.visited_chapters = set()
        
        # 请求头伪装成浏览器
        self.headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
            'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
            'Accept-Encoding': 'gzip, deflate, br',
            'Connection': 'keep-alive',
            'Referer': self.base_url,
        }
        self.session.headers.update(self.headers)
        
        # 创建下载目录
        os.makedirs(output_dir, exist_ok=True)
        
        # 加载已下载记录
        self.record_file = os.path.join(output_dir, '.download_record.json')
        self.downloaded = self.load_record()
        
        # 分类URL映射（基于实际网站结构）
        self.categories = {
            '首页推荐': '/',
            '日本漫画': '/manhua/japan/',
            '港台漫画': '/manhua/hk/',
            '欧美漫画': '/manhua/west/',
            '国产漫画': '/manhua/china/',
            '韩漫': '/manhua/korea/',
        }
    
    def discover_category_urls(self):
        """自动从首页发现所有分类链接"""
        soup = self.get_page_soup(self.base_url)
        if not soup:
            return
        
        nav_links = soup.find_all('a', href=True)
        for link in nav_links:
            href = link.get('href', '')
            text = link.text.strip()
            if '/manhua/' in href and text and len(text) < 10 and 'detail' not in href and 'chapter' not in href:
                if not href.startswith('http'):
                    href = urljoin(self.base_url, href)
                if text not in self.categories:
                    self.categories[text] = href.replace(self.base_url, '')

    def load_record(self):
        """加载下载记录"""
        if os.path.exists(self.record_file):
            try:
                with open(self.record_file, 'r', encoding='utf-8') as f:
                    return set(json.load(f))
            except:
                return set()
        return set()

    def save_record(self):
        """保存下载记录"""
        with self.lock:
            with open(self.record_file, 'w', encoding='utf-8') as f:
                json.dump(list(self.downloaded), f)

    def request(self, url, retries=3, stream=False):
        """发送HTTP请求，带重试机制"""
        for i in range(retries):
            try:
                time.sleep(self.delay + random.uniform(0, 0.5))
                response = self.session.get(url, timeout=30, stream=stream)
                response.raise_for_status()
                if 'text' in response.headers.get('Content-Type', ''):
                    response.encoding = 'utf-8'
                return response
            except Exception as e:
                if i == retries - 1:
                    print(f"请求失败: {url}, 错误: {e}")
                    return None
                time.sleep(2 ** i)  # 指数退避
        return None

    def get_page_soup(self, url):
        """获取页面BeautifulSoup对象"""
        response = self.request(url)
        if response:
            return BeautifulSoup(response.text, 'html.parser')
        return None

    def get_total_pages(self, soup, base_url):
        """获取列表页总页数"""
        if not soup:
            return 1
        max_page = 1
        # 查找所有分页链接
        page_links = soup.find_all('a', href=True)
        for link in page_links:
            href = link.get('href', '')
            text = link.text.strip()
            # 匹配数字分页
            if text.isdigit():
                page_num = int(text)
                if page_num > max_page:
                    max_page = page_num
            # 匹配URL中的页码
            match = re.search(r'[?&]page=(\d+)', href)
            if match:
                page_num = int(match.group(1))
                if page_num > max_page:
                    max_page = page_num
            match = re.search(r'/(\d+)\.html', href)
            if match and 'chapter' not in href and 'detail' not in href:
                page_num = int(match.group(1))
                if page_num > max_page:
                    max_page = page_num
        return max_page

    def get_page_url(self, base_category_url, page_num):
        """构造分页URL"""
        if page_num == 1:
            return urljoin(self.base_url, base_category_url)
        # 尝试几种常见分页格式
        if base_category_url.endswith('/'):
            return f"{self.base_url}{base_category_url}page/{page_num}/"
        elif '?' in base_category_url:
            return f"{self.base_url}{base_category_url}&page={page_num}"
        else:
            return f"{self.base_url}{base_category_url}?page={page_num}"

    def get_comics_from_list(self, list_url):
        """从列表页提取漫画链接"""
        comics = []
        soup = self.get_page_soup(list_url)
        if not soup:
            return comics
        
        # 查找所有漫画详情链接
        # 匹配 /manhua/detail/数字/ 格式
        links = soup.find_all('a', href=re.compile(r'/manhua/detail/\d+/'))
        seen = set()
        for link in links:
            href = link.get('href', '')
            full_url = urljoin(self.base_url, href)
            comic_id_match = re.search(r'/manhua/detail/(\d+)/', href)
            if comic_id_match and full_url not in seen:
                comic_id = comic_id_match.group(1)
                title = link.get('title') or link.text.strip()
                if not title:
                    title = f"comic_{comic_id}"
                comics.append({
                    'id': comic_id,
                    'title': title,
                    'url': full_url
                })
                seen.add(full_url)
        
        return comics

    def get_comic_info(self, comic_url, comic_id):
        """获取漫画详情页信息：标题、作者、章节列表"""
        soup = self.get_page_soup(comic_url)
        if not soup:
            return None
        
        # 获取漫画标题
        title_tag = soup.find('h1')
        title = title_tag.text.strip() if title_tag else f"comic_{comic_id}"
        
        # 清理文件名非法字符
        title = re.sub(r'[\\/:*?"<>|]', '_', title)
        
        # 获取作者、分类等信息（可选）
        authors = []
        author_links = soup.select('a[href*="/author/"]')
        for a in author_links:
            authors.append(a.text.strip())
        
        # 提取所有章节链接
        chapters = []
        chapter_links = soup.find_all('a', href=re.compile(rf'/manhua/chapter/{comic_id}/\d+/'))
        seen_chapters = set()
        
        for link in chapter_links:
            href = link.get('href', '')
            chapter_match = re.search(rf'/manhua/chapter/{comic_id}/(\d+)/', href)
            if chapter_match:
                chapter_id = chapter_match.group(1)
                chapter_url = urljoin(self.base_url, href.rstrip('/') + '/all.html')
                chapter_title = link.get('title') or link.text.strip()
                chapter_title = re.sub(r'[\\/:*?"<>|]', '_', chapter_title)
                
                if chapter_id not in seen_chapters:
                    chapters.append({
                        'id': chapter_id,
                        'title': chapter_title,
                        'url': chapter_url
                    })
                    seen_chapters.add(chapter_id)
        
        # 按章节ID排序（通常章节ID越大越新）
        chapters.sort(key=lambda x: int(x['id']))
        
        return {
            'id': comic_id,
            'title': title,
            'authors': authors,
            'chapters': chapters
        }

    def get_chapter_images(self, chapter_url):
        """从章节阅读页提取所有图片URL"""
        soup = self.get_page_soup(chapter_url)
        if not soup:
            return []
        
        images = []
        # 查找所有带data-src的图片（懒加载）
        img_tags = soup.find_all('img', attrs={'data-src': True})
        for img in img_tags:
            src = img.get('data-src', '')
            if src and ('dongman.la' in src or src.startswith('/')):
                if not src.startswith('http'):
                    src = urljoin(self.img_base, src)
                images.append(src)
        
        # 如果没找到data-src，查找普通img标签
        if not images:
            img_tags = soup.find_all('img')
            for img in img_tags:
                src = img.get('src', '')
                if src and ('dongman.la' in src) and not any(x in src for x in ['logo', 'avatar', 'icon']):
                    if not src.startswith('http'):
                        src = urljoin(self.img_base, src)
                    images.append(src)
        
        return images

    def download_image(self, img_url, save_path):
        """下载单张图片"""
        if os.path.exists(save_path) and os.path.getsize(save_path) > 1000:
            return True  # 已下载
        
        try:
            response = self.request(img_url, stream=True)
            if response and response.status_code == 200:
                os.makedirs(os.path.dirname(save_path), exist_ok=True)
                with open(save_path, 'wb') as f:
                    for chunk in response.iter_content(chunk_size=8192):
                        f.write(chunk)
                return True
        except Exception as e:
            if os.path.exists(save_path):
                os.remove(save_path)
            return False
        return False

    def download_chapter(self, comic_title, chapter_info, comic_dir):
        """下载单个章节的所有图片"""
        chapter_id = chapter_info['id']
        chapter_title = chapter_info['title']
        chapter_url = chapter_info['url']
        
        record_key = f"{comic_title}_{chapter_id}"
        if record_key in self.downloaded:
            # print(f"跳过已下载章节: {comic_title} - {chapter_title}")
            return True
        
        # 创建章节目录
        chapter_dir = os.path.join(comic_dir, f"{chapter_title}")
        os.makedirs(chapter_dir, exist_ok=True)
        
        print(f"正在获取: {comic_title} - {chapter_title}")
        images = self.get_chapter_images(chapter_url)
        
        if not images:
            print(f"  警告: 未找到图片 {chapter_url}")
            return False
        
        print(f"  发现 {len(images)} 张图片，开始下载...")
        
        success_count = 0
        failed_urls = []
        
        # 多线程下载图片
        with ThreadPoolExecutor(max_workers=self.threads) as executor:
            futures = {}
            for idx, img_url in enumerate(images, 1):
                ext = os.path.splitext(urlparse(img_url).path)[1] or '.jpg'
                save_path = os.path.join(chapter_dir, f"{idx:04d}{ext}")
                future = executor.submit(self.download_image, img_url, save_path)
                futures[future] = (idx, img_url, save_path)
            
            for future in as_completed(futures):
                idx, img_url, save_path = futures[future]
                try:
                    if future.result():
                        success_count += 1
                    else:
                        failed_urls.append((idx, img_url))
                except Exception as e:
                    failed_urls.append((idx, img_url))
        
        # 重试失败的图片
        if failed_urls:
            print(f"  重试 {len(failed_urls)} 张失败的图片...")
            for idx, img_url in failed_urls:
                ext = os.path.splitext(urlparse(img_url).path)[1] or '.jpg'
                save_path = os.path.join(chapter_dir, f"{idx:04d}{ext}")
                if self.download_image(img_url, save_path):
                    success_count += 1
        
        if success_count == len(images):
            print(f"  ✓ {comic_title} - {chapter_title} 下载完成 ({success_count}/{len(images)})")
            self.downloaded.add(record_key)
            self.save_record()
            return True
        else:
            print(f"  ✗ {comic_title} - {chapter_title} 部分失败 ({success_count}/{len(images)})")
            return False

    def download_comic(self, comic_info):
        """下载单个漫画的所有章节"""
        comic_id = comic_info['id']
        comic_title = comic_info['title']
        
        if comic_id in self.visited_comics:
            return
        
        with self.lock:
            self.visited_comics.add(comic_id)
        
        print(f"\n{'='*60}")
        print(f"开始处理漫画: {comic_title} (ID: {comic_id})")
        print(f"{'='*60}")
        
        # 创建漫画目录
        comic_dir = os.path.join(self.output_dir, comic_title)
        os.makedirs(comic_dir, exist_ok=True)
        
        # 如果只有基础信息，重新获取完整章节列表
        if 'chapters' not in comic_info or not comic_info['chapters']:
            full_info = self.get_comic_info(comic_info['url'], comic_id)
            if full_info:
                comic_info = full_info
        
        chapters = comic_info.get('chapters', [])
        if not chapters:
            print(f"未找到章节: {comic_title}")
            return
        
        print(f"共发现 {len(chapters)} 个章节")
        
        for chapter in chapters:
            self.download_chapter(comic_title, chapter, comic_dir)

    def crawl_category(self, category_name, category_url_prefix, max_pages=None):
        """爬取某个分类下的所有漫画"""
        print(f"\n{'#'*60}")
        print(f"开始爬取分类: {category_name}")
        print(f"{'#'*60}")
        
        # 先获取第一页确定总页数
        first_page_url = urljoin(self.base_url, category_url_prefix)
        soup = self.get_page_soup(first_page_url)
        total_pages = self.get_total_pages(soup, first_page_url)
        
        if max_pages and max_pages < total_pages:
            total_pages = max_pages
        
        print(f"分类 [{category_name}] 共 {total_pages} 页")
        
        all_comics = []
        
        for page in range(1, total_pages + 1):
            page_url = self.get_page_url(category_url_prefix, page)
            print(f"\n正在获取 {category_name} 第 {page}/{total_pages} 页...")
            
            comics = self.get_comics_from_list(page_url)
            print(f"  本页发现 {len(comics)} 部漫画")
            all_comics.extend(comics)
            
            # 如果第一页就没获取到漫画，尝试直接从首页提取
            if page == 1 and len(comics) == 0 and category_name == '首页推荐':
                comics = self.get_comics_from_list(self.base_url)
                print(f"  从首页提取到 {len(comics)} 部漫画")
                all_comics.extend(comics)
        
        print(f"\n分类 [{category_name}] 共发现 {len(all_comics)} 部漫画")
        
        # 去重
        unique_comics = []
        seen_ids = set()
        for comic in all_comics:
            if comic['id'] not in seen_ids and comic['id'] not in self.visited_comics:
                unique_comics.append(comic)
                seen_ids.add(comic['id'])
        
        # 依次下载每部漫画
        for comic in unique_comics:
            self.download_comic(comic)

    def crawl_single_comic(self, comic_id):
        """只爬取指定ID的漫画"""
        comic_url = f"{self.base_url}/manhua/detail/{comic_id}/"
        comic_info = self.get_comic_info(comic_url, comic_id)
        if comic_info:
            self.download_comic(comic_info)
        else:
            print(f"未找到ID为 {comic_id} 的漫画")

    def crawl_homepage(self):
        """爬取首页推荐漫画"""
        print("爬取首页推荐漫画...")
        comics = self.get_comics_from_list(self.base_url)
        unique_comics = []
        seen_ids = set()
        for comic in comics:
            if comic['id'] not in seen_ids and comic['id'] not in self.visited_comics:
                unique_comics.append(comic)
                seen_ids.add(comic['id'])
        print(f"首页发现 {len(unique_comics)} 部推荐漫画")
        for comic in unique_comics:
            self.download_comic(comic)

    def crawl_all(self, max_pages_per_category=None):
        """爬取全站所有分类"""
        print("="*70)
        print("动漫啦全站爬虫启动")
        print(f"下载目录: {os.path.abspath(self.output_dir)}")
        print(f"请求延迟: {self.delay}秒")
        print(f"下载线程: {self.threads}")
        print("="*70)
        
        # 自动从首页发现分类链接
        print("\n正在自动发现网站分类...")
        self.discover_category_urls()
        print(f"发现 {len(self.categories)} 个分类入口")
        
        # 爬取所有分类
        for cat_name, cat_url_prefix in self.categories.items():
            self.crawl_category(cat_name, cat_url_prefix, max_pages_per_category)
        
        print("\n" + "="*70)
        print("全站爬取完成!")
        print(f"共处理 {len(self.visited_comics)} 部漫画")
        print(f"下载目录: {os.path.abspath(self.output_dir)}")
        print("="*70)

    def search_comic(self, keyword):
        """搜索漫画并返回结果"""
        search_url = f"{self.base_url}/search/?keyword={keyword}"
        soup = self.get_page_soup(search_url)
        if not soup:
            return []
        
        comics = []
        links = soup.find_all('a', href=re.compile(r'/manhua/detail/\d+/'))
        seen = set()
        for link in links:
            href = link.get('href', '')
            comic_id_match = re.search(r'/manhua/detail/(\d+)/', href)
            if comic_id_match:
                comic_id = comic_id_match.group(1)
                if comic_id not in seen:
                    title = link.get('title') or link.text.strip()
                    comics.append({
                        'id': comic_id,
                        'title': title,
                        'url': urljoin(self.base_url, href)
                    })
                    seen.add(comic_id)
        return comics


def main():
    parser = argparse.ArgumentParser(description='动漫啦(dongman.la)全站漫画爬虫')
    parser.add_argument('--comic-id', type=str, help='只爬取指定漫画ID，如 5985')
    parser.add_argument('--search', type=str, help='搜索关键词并下载搜索结果')
    parser.add_argument('--delay', type=float, default=0.5, help='请求延迟秒数(默认0.5)')
    parser.add_argument('--threads', type=int, default=5, help='图片下载线程数(默认5)')
    parser.add_argument('--output', type=str, default='dongmanla_downloads', help='下载保存目录')
    parser.add_argument('--category', type=str, help='只爬取指定分类(如: ribenmanhua)')
    parser.add_argument('--max-pages', type=int, help='每个分类最多爬取多少页')
    parser.add_argument('--homepage-only', action='store_true', help='只爬取首页推荐')
    
    args = parser.parse_args()
    
    spider = DongmanLaSpider(
        delay=args.delay,
        threads=args.threads,
        output_dir=args.output
    )
    
    if args.comic_id:
        spider.crawl_single_comic(args.comic_id)
    elif args.search:
        print(f"搜索关键词: {args.search}")
        results = spider.search_comic(args.search)
        print(f"找到 {len(results)} 部漫画")
        for comic in results:
            print(f"  - {comic['title']} (ID: {comic['id']})")
            spider.download_comic(comic)
    elif args.homepage_only:
        spider.crawl_homepage()
    elif args.category:
        # 查找匹配的分类
        category_prefix = f'/manhua/list-{args.category}-'
        found = False
        for name, prefix in spider.categories.items():
            if args.category in prefix or args.category in name:
                spider.crawl_category(name, prefix, args.max_pages)
                found = True
                break
        if not found:
            print(f"未找到分类: {args.category}")
            print("可用分类前缀: ribenmanhua, gangtaimanhua, oumeimanhua, guochanmanhua, hanman, wanjie, lianzaizhong等")
    else:
        spider.crawl_all(args.max_pages)


if __name__ == '__main__':
    main()
