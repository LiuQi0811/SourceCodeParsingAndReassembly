#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
极速看剧 (https://www.jisukanju.com/) 全站爬虫
基于 MacCMS v10 结构开发，支持全站资源抓取

功能特点：
- 自动抓取所有分类下的影视列表
- 抓取详情页信息（标题、封面、简介、演员、导演、评分等）
- 提取播放/下载链接
- 支持多线程加速
- 断点续爬
- 数据导出为 CSV/JSON
- 内置请求重试与延时，避免被封

使用方法：
    pip install requests beautifulsoup4 lxml
    python jisukanju_spider.py                # 抓取全站
    python jisukanju_spider.py --type 1       # 只抓取电影分类(type=1)
    python jisukanju_spider.py --pages 5      # 每个分类最多抓5页
    python jisukanju_spider.py --export csv   # 导出为CSV
"""

import os
import re
import sys
import json
import time
import random
import argparse
import threading
from queue import Queue
from urllib.parse import urljoin, urlparse

import requests
from bs4 import BeautifulSoup
import warnings
warnings.filterwarnings('ignore')

# ======================== 配置 ========================
BASE_URL = "https://www.jisukanju.com"
# MacCMS 常见分类ID（电影1，电视剧2，综艺3，动漫4）
CATEGORY_IDS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20]
# MacCMS 列表页URL模式: /vod/show/id/{cid}/page/{page}.html
LIST_URL_PATTERN = f"{BASE_URL}/vod/show/id/{{cid}}/page/{{page}}.html"
# MacCMS 详情页URL模式: /vod/detail/id/{vid}.html
DETAIL_URL_PATTERN = f"{BASE_URL}/vod/detail/id/{{vid}}.html"
# MacCMS 分类首页
CATEGORY_URL_PATTERN = f"{BASE_URL}/vod/type/id/{{cid}}.html"

HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
    'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
    'Referer': BASE_URL,
}

# 输出目录
OUTPUT_DIR = "jisukanju_data"
os.makedirs(OUTPUT_DIR, exist_ok=True)

# 爬虫配置
MAX_WORKERS = 3          # 并发线程数
DELAY_MIN = 1            # 最小请求间隔(秒)
DELAY_MAX = 3            # 最大请求间隔(秒)
MAX_RETRIES = 3          # 失败重试次数
TIMEOUT = 30             # 请求超时时间


# ======================== 爬虫核心类 ========================
class JiSuKanJuSpider:
    def __init__(self, max_workers=MAX_WORKERS, export_format='json'):
        self.base_url = BASE_URL
        self.session = requests.Session()
        self.session.headers.update(HEADERS)
        self.session.verify = False
        
        self.max_workers = max_workers
        self.export_format = export_format
        
        # 已访问URL集合
        self.visited_urls = set()
        self.visited_lock = threading.Lock()
        
        # 数据存储
        self.videos = []
        self.videos_lock = threading.Lock()
        
        # 队列
        self.list_queue = Queue()
        self.detail_queue = Queue()
        
        # 统计
        self.stats = {
            'list_pages': 0,
            'detail_pages': 0,
            'failed': 0,
            'total_videos': 0
        }
        self.stats_lock = threading.Lock()
        
        # 断点续爬文件
        self.progress_file = os.path.join(OUTPUT_DIR, ".progress.json")
        self._load_progress()

    def _load_progress(self):
        """加载断点进度"""
        if os.path.exists(self.progress_file):
            try:
                with open(self.progress_file, 'r', encoding='utf-8') as f:
                    progress = json.load(f)
                self.visited_urls = set(progress.get('visited', []))
                print(f"[+] 加载断点进度，已访问 {len(self.visited_urls)} 个URL")
            except:
                pass

    def _save_progress(self):
        """保存断点进度"""
        try:
            with open(self.progress_file, 'w', encoding='utf-8') as f:
                json.dump({'visited': list(self.visited_urls)}, f, ensure_ascii=False)
        except:
            pass

    def _request(self, url, retry=0):
        """带重试和延时的HTTP请求"""
        # 随机延时
        time.sleep(random.uniform(DELAY_MIN, DELAY_MAX))
        
        try:
            resp = self.session.get(url, timeout=TIMEOUT)
            resp.encoding = 'utf-8'
            if resp.status_code == 200:
                return resp.text
            else:
                print(f"[-] HTTP {resp.status_code}: {url}")
        except Exception as e:
            if retry < MAX_RETRIES:
                time.sleep(2 * (retry + 1))
                return self._request(url, retry + 1)
            else:
                print(f"[-] 请求失败: {url} | {e}")
                with self.stats_lock:
                    self.stats['failed'] += 1
        return None

    def _is_visited(self, url):
        """检查URL是否已访问"""
        with self.visited_lock:
            return url in self.visited_urls

    def _mark_visited(self, url):
        """标记URL已访问"""
        with self.visited_lock:
            self.visited_urls.add(url)

    def discover_categories(self):
        """发现网站分类"""
        print("[*] 正在发现网站分类...")
        html = self._request(self.base_url)
        if not html:
            print("[!] 无法访问首页，使用默认分类ID")
            return [
                {'id': 1, 'name': '电影'},
                {'id': 2, 'name': '电视剧'},
                {'id': 3, 'name': '综艺'},
                {'id': 4, 'name': '动漫'},
            ]
        
        categories = []
        # 提取分类链接 /vod/type/id/{id}.html 或 /vod/show/id/{id}
        cat_pattern = re.compile(r'/vod/(?:type|show)/id/(\d+)')
        found_ids = cat_pattern.findall(html)
        
        # 从导航菜单提取分类名称
        soup = BeautifulSoup(html, 'lxml')
        id_name_map = {}
        for a in soup.find_all('a', href=True):
            match = cat_pattern.search(a['href'])
            if match:
                cid = int(match.group(1))
                name = a.get_text(strip=True)
                if name and cid not in id_name_map and len(name) < 10:
                    id_name_map[cid] = name
        
        for cid_str in set(found_ids):
            cid = int(cid_str)
            if cid > 0:
                categories.append({
                    'id': cid,
                    'name': id_name_map.get(cid, f'分类{cid}')
                })
        
        if not categories:
            # 默认MacCMS常见分类
            categories = [
                {'id': 1, 'name': '电影'},
                {'id': 2, 'name': '电视剧'},
                {'id': 3, 'name': '综艺'},
                {'id': 4, 'name': '动漫'},
            ]
        
        print(f"[+] 发现 {len(categories)} 个分类:")
        for cat in categories:
            print(f"    - {cat['name']} (id={cat['id']})")
        return categories

    def parse_list_page(self, html):
        """解析列表页，提取视频详情页链接和分页信息"""
        if not html:
            return [], 1
        
        soup = BeautifulSoup(html, 'lxml')
        detail_urls = []
        
        # MacCMS 详情页链接模式 /vod/detail/id/{id}.html
        detail_pattern = re.compile(r'/vod/detail/id/(\d+)\.html')
        
        # 方式1: 查找所有详情链接
        for a in soup.find_all('a', href=True):
            href = a['href']
            match = detail_pattern.search(href)
            if match:
                vid = match.group(1)
                url = urljoin(self.base_url, href)
                title = a.get('title', '') or a.get_text(strip=True)
                if url not in detail_urls:
                    detail_urls.append((url, vid, title))
        
        # 方式2: 从data属性提取
        for tag in soup.find_all(attrs={'data-id': True}):
            href = tag.get('href', '')
            if '/vod/detail/' in href:
                url = urljoin(self.base_url, href)
                vid = tag.get('data-id')
                title = tag.get('title', '')
                if (url, vid, title) not in detail_urls:
                    detail_urls.append((url, vid, title))
        
        # 获取最大页数
        max_page = 1
        # 查找分页链接
        page_links = soup.find_all('a', href=re.compile(r'/page/(\d+)'))
        for a in page_links:
            match = re.search(r'/page/(\d+)', a['href'])
            if match:
                page_num = int(match.group(1))
                if page_num > max_page:
                    max_page = page_num
        
        # 查找"共X页"或"尾页"
        page_text = re.search(r'共\s*(\d+)\s*页', html)
        if page_text:
            max_page = max(max_page, int(page_text.group(1)))
        
        # 如果没找到分页，尝试查找"下一页"判断是否有更多
        if max_page == 1 and '下一页' in html:
            max_page = 2
            
        return detail_urls, max_page

    def parse_detail_page(self, html, url, vid):
        """解析详情页，提取视频完整信息"""
        if not html:
            return None
        
        soup = BeautifulSoup(html, 'lxml')
        video = {
            'id': vid,
            'url': url,
            'title': '',
            'cover': '',
            'description': '',
            'director': '',
            'actors': '',
            'category': '',
            'area': '',
            'year': '',
            'language': '',
            'score': '',
            'update_status': '',
            'release_date': '',
            'tags': [],
            'play_sources': {},
            'download_links': []
        }
        
        # 标题
        title_tag = soup.find('h1') or soup.find('h2')
        if title_tag:
            video['title'] = title_tag.get_text(strip=True)
        if not video['title'] and soup.title:
            video['title'] = soup.title.string.split('-')[0].strip()
        
        # 封面图
        img_tag = soup.find('div', class_=re.compile('pic|poster|cover'))
        if img_tag:
            img = img_tag.find('img')
            if img:
                video['cover'] = urljoin(self.base_url, img.get('data-original', img.get('src', '')))
        
        # 简介/描述
        desc_tag = soup.find('div', class_=re.compile('desc|content|intro|plot|summary|juqing'))
        if desc_tag:
            video['description'] = desc_tag.get_text(strip=True)
        # MacCMS 常见简介位置
        if not video['description']:
            for p in soup.find_all('p', class_=re.compile('desc|intro')):
                text = p.get_text(strip=True)
                if len(text) > 20:
                    video['description'] = text
                    break
        
        # 信息项 (导演/演员/类型/地区/年份等)
        info_blocks = soup.find_all(['div', 'li', 'span', 'dd', 'p'], class_=re.compile('info|data|item|meta'))
        for block in info_blocks:
            text = block.get_text(strip=True)
            if '导演' in text:
                video['director'] = text.split('导演')[-1].replace('：', ':').split(':')[-1].strip()
            elif '主演' in text or '演员' in text:
                video['actors'] = re.split(r'主演[：:]|演员[：:]', text)[-1].strip()
            elif '类型' in text:
                video['category'] = re.split(r'类型[：:]', text)[-1].strip()
            elif '地区' in text:
                video['area'] = re.split(r'地区[：:]', text)[-1].strip()
            elif '年份' in text or '上映' in text:
                year_match = re.search(r'(\d{4})', text)
                if year_match:
                    video['year'] = year_match.group(1)
            elif '语言' in text:
                video['language'] = re.split(r'语言[：:]', text)[-1].strip()
            elif '更新' in text or '状态' in text:
                video['update_status'] = re.split(r'更新[：:]|状态[：:]', text)[-1].strip()
            elif '评分' in text:
                score_match = re.search(r'([\d.]+)', text)
                if score_match:
                    video['score'] = score_match.group(1)
        
        # 提取标签
        tag_links = soup.find_all('a', href=re.compile(r'/vod/show/id/\d+/by/tag'))
        video['tags'] = [a.get_text(strip=True) for a in tag_links if a.get_text(strip=True)]
        
        # 提取播放列表 (MacCMS 播放源格式)
        play_sources = {}
        # 查找播放源标题标签
        source_tabs = soup.find_all(['h3', 'h4', 'span', 'a'], class_=re.compile('source|tab|playlist|playfrom'))
        
        # 查找所有播放列表
        play_lists = soup.find_all('div', class_=re.compile('playlist|play_list|episodes|stab-con'))
        for i, plist in enumerate(play_lists):
            source_name = f"播放源{i+1}"
            episodes = []
            for a in plist.find_all('a', href=True):
                ep_name = a.get_text(strip=True)
                ep_href = urljoin(self.base_url, a['href'])
                if '/vod/play/' in ep_href or '/play/' in ep_href:
                    episodes.append({
                        'name': ep_name,
                        'url': ep_href
                    })
            if episodes:
                play_sources[source_name] = episodes
        
        video['play_sources'] = play_sources
        
        # 提取下载链接
        download_list = soup.find_all('div', class_=re.compile('download|downlist'))
        for dl in download_list:
            for a in dl.find_all('a', href=True):
                link = {
                    'name': a.get_text(strip=True),
                    'url': urljoin(self.base_url, a['href'])
                }
                video['download_links'].append(link)
        
        # 从script中提取播放器配置(iframes/播放地址)
        scripts = soup.find_all('script')
        for script in scripts:
            text = script.string or ''
            # MacCMS常见: var mac_play, player_aaaa等
            if 'mac_play' in text or 'player_aaaa' in text or 'url' in text:
                # 提取URL信息
                url_matches = re.findall(r'url\s*[:=]\s*[\'\"]([^\'\"]+)', text)
                for u in url_matches:
                    if u.startswith('http') and u not in [d['url'] for d in video['download_links']]:
                        # 检查是否是视频地址
                        if any(ext in u.lower() for ext in ['.m3u8', '.mp4', '.mkv', '.avi', '.rmvb']):
                            video['download_links'].append({
                                'name': '直链',
                                'url': u
                            })
        
        return video

    def crawl_list_worker(self):
        """列表页抓取线程"""
        while True:
            try:
                cid, page = self.list_queue.get_nowait()
            except:
                break
            
            url = LIST_URL_PATTERN.format(cid=cid, page=page)
            if self._is_visited(url):
                self.list_queue.task_done()
                continue
            
            self._mark_visited(url)
            print(f"[*] 抓取列表页: 分类{cid} 第{page}页 | {url}")
            
            html = self._request(url)
            detail_urls, max_page = self.parse_list_page(html)
            
            # 将详情页加入队列
            for d_url, vid, title in detail_urls:
                if not self._is_visited(d_url):
                    self.detail_queue.put((d_url, vid))
            
            with self.stats_lock:
                self.stats['list_pages'] += 1
            
            # 如果这是第1页且有更多页，加入后续页面
            if page == 1 and max_page > 1 and self.max_pages is None or page == 1 and max_page > 1 and page < (self.max_pages or max_page):
                end_page = min(max_page, self.max_pages or max_page)
                for p in range(2, end_page + 1):
                    next_url = LIST_URL_PATTERN.format(cid=cid, page=p)
                    if not self._is_visited(next_url):
                        self.list_queue.put((cid, p))
            
            time.sleep(0.1)
            self.list_queue.task_done()
    
    def crawl_detail_worker(self):
        """详情页抓取线程"""
        while True:
            try:
                url, vid = self.detail_queue.get(timeout=5)
            except:
                break
            
            if self._is_visited(url):
                self.detail_queue.task_done()
                continue
            
            self._mark_visited(url)
            print(f"[>] 抓取详情: {vid} | {url}")
            
            html = self._request(url)
            video = self.parse_detail_page(html, url, vid)
            
            if video and video.get('title'):
                with self.videos_lock:
                    self.videos.append(video)
                print(f"    [+] {video['title']}")
            
            with self.stats_lock:
                self.stats['detail_pages'] += 1
            
            # 每50个视频保存一次进度
            if self.stats['detail_pages'] % 50 == 0:
                self._save_progress()
                self.save_data(checkpoint=True)
            
            self.detail_queue.task_done()

    def crawl(self, categories=None, max_pages=None, category_id=None):
        """
        全站爬虫入口
        :param categories: 分类列表
        :param max_pages: 每个分类最多抓多少页，None表示全部
        :param category_id: 只抓某个分类ID
        """
        self.max_pages = max_pages
        
        if not categories:
            categories = self.discover_categories()
        
        if category_id:
            categories = [c for c in categories if c['id'] == category_id]
        
        print(f"\n{'='*60}")
        print(f"[*] 开始全站抓取，共 {len(categories)} 个分类")
        print(f"[*] 线程数: {self.max_workers}")
        print(f"[*] 每分类最大页数: {max_pages or '全部'}")
        print(f"{'='*60}\n")
        
        # 初始化队列: 所有分类的第1页
        for cat in categories:
            cid = cat['id']
            url = LIST_URL_PATTERN.format(cid=cid, page=1)
            if not self._is_visited(url):
                self.list_queue.put((cid, 1))
            # 同时添加分类首页
            cat_url = CATEGORY_URL_PATTERN.format(cid=cid)
            if not self._is_visited(cat_url):
                self.list_queue.put((cid, 1))  # type和show都到第一页
        
        # 启动列表抓取线程
        list_threads = []
        for _ in range(self.max_workers):
            t = threading.Thread(target=self.crawl_list_worker, daemon=True)
            t.start()
            list_threads.append(t)
        
        # 启动详情抓取线程
        detail_threads = []
        for _ in range(self.max_workers):
            t = threading.Thread(target=self.crawl_detail_worker, daemon=True)
            t.start()
            detail_threads.append(t)
        
        # 等待列表队列完成
        self.list_queue.join()
        print("\n[*] 列表页抓取完成，等待详情页...")
        
        # 等待详情队列完成
        self.detail_queue.join()
        
        # 等待所有线程结束
        for t in list_threads + detail_threads:
            t.join(timeout=5)
        
        print(f"\n{'='*60}")
        print("[!] 抓取完成!")
        print(f"    列表页: {self.stats['list_pages']}")
        print(f"    详情页: {self.stats['detail_pages']}")
        print(f"    失败: {self.stats['failed']}")
        print(f"    视频总数: {len(self.videos)}")
        print(f"{'='*60}\n")
        
        self._save_progress()
        self.save_data()

    def save_data(self, checkpoint=False):
        """保存数据到文件"""
        timestamp = time.strftime("%Y%m%d_%H%M%S")
        
        if self.export_format == 'json' or checkpoint:
            if checkpoint:
                json_file = os.path.join(OUTPUT_DIR, f"videos_checkpoint.json")
            else:
                json_file = os.path.join(OUTPUT_DIR, f"jisukanju_all_{timestamp}.json")
            with open(json_file, 'w', encoding='utf-8') as f:
                json.dump(self.videos, f, ensure_ascii=False, indent=2)
            if not checkpoint:
                print(f"[+] 数据已保存: {json_file}")
        
        if self.export_format == 'csv' and not checkpoint:
            import csv
            csv_file = os.path.join(OUTPUT_DIR, f"jisukanju_all_{timestamp}.csv")
            if self.videos:
                # 展开播放源和下载链接
                flat_videos = []
                for v in self.videos:
                    flat_v = {k: v[k] for k in v if k not in ['play_sources', 'download_links', 'tags']}
                    flat_v['tags'] = ','.join(v['tags'])
                    # 播放链接
                    play_links = []
                    for src_name, eps in v['play_sources'].items():
                        for ep in eps:
                            play_links.append(f"{src_name}-{ep['name']}: {ep['url']}")
                    flat_v['play_links'] = ' | '.join(play_links)
                    # 下载链接
                    down_links = [f"{d['name']}: {d['url']}" for d in v['download_links']]
                    flat_v['download_links_text'] = ' | '.join(down_links)
                    flat_videos.append(flat_v)
                
                keys = flat_videos[0].keys()
                with open(csv_file, 'w', encoding='utf-8-sig', newline='') as f:
                    writer = csv.DictWriter(f, fieldnames=keys)
                    writer.writeheader()
                    writer.writerows(flat_videos)
                print(f"[+] 数据已保存: {csv_file}")
        
        # 同时保存一个最新版JSON
        latest_json = os.path.join(OUTPUT_DIR, "jisukanju_latest.json")
        with open(latest_json, 'w', encoding='utf-8') as f:
            json.dump(self.videos, f, ensure_ascii=False, indent=2)


# ======================== 单页快速提取工具 ========================
def extract_video_info(url):
    """快速提取单个视频页面的信息（用于测试或单页抓取）"""
    print(f"[*] 提取单页信息: {url}")
    session = requests.Session()
    session.headers.update(HEADERS)
    session.verify = False
    
    try:
        resp = session.get(url, timeout=TIMEOUT)
        resp.encoding = 'utf-8'
        spider = JiSuKanJuSpider()
        vid_match = re.search(r'id/(\d+)', url)
        vid = vid_match.group(1) if vid_match else 'unknown'
        video = spider.parse_detail_page(resp.text, url, vid)
        print(json.dumps(video, ensure_ascii=False, indent=2))
        return video
    except Exception as e:
        print(f"[-] 提取失败: {e}")
        return None


def search_keyword(keyword):
    """搜索影视资源"""
    search_url = f"{BASE_URL}/vod/search.html?wd={keyword}"
    print(f"[*] 搜索: {keyword}")
    session = requests.Session()
    session.headers.update(HEADERS)
    session.verify = False
    
    try:
        resp = session.get(search_url, timeout=TIMEOUT)
        resp.encoding = 'utf-8'
        soup = BeautifulSoup(resp.text, 'lxml')
        results = []
        for a in soup.find_all('a', href=re.compile(r'/vod/detail/id/')):
            href = urljoin(BASE_URL, a['href'])
            title = a.get('title', '') or a.get_text(strip=True)
            if title and href not in [r['url'] for r in results]:
                results.append({'title': title, 'url': href})
        print(f"[+] 找到 {len(results)} 条结果:")
        for r in results[:20]:
            print(f"    - {r['title']}: {r['url']}")
        return results
    except Exception as e:
        print(f"[-] 搜索失败: {e}")
        return []


# ======================== 主程序 ========================
def main():
    parser = argparse.ArgumentParser(description='极速看剧全站爬虫')
    parser.add_argument('--type', type=int, help='只抓取指定分类ID (1=电影,2=电视剧,3=综艺,4=动漫)')
    parser.add_argument('--pages', type=int, help='每个分类最多抓取的页数')
    parser.add_argument('--workers', type=int, default=MAX_WORKERS, help=f'并发线程数 (默认{MAX_WORKERS})')
    parser.add_argument('--export', choices=['json', 'csv'], default='json', help='导出格式 (默认json)')
    parser.add_argument('--url', type=str, help='单个视频URL提取')
    parser.add_argument('--search', type=str, help='搜索关键词')
    
    args = parser.parse_args()
    
    print("""
╔═══════════════════════════════════════════════════╗
║           极速看剧 (jisukanju.com) 全站爬虫        ║
║                Powered by MacCMS Parser           ║
╚═══════════════════════════════════════════════════╝
    """)
    
    # 单页提取模式
    if args.url:
        extract_video_info(args.url)
        return
    
    # 搜索模式
    if args.search:
        search_keyword(args.search)
        return
    
    # 全站爬取模式
    spider = JiSuKanJuSpider(
        max_workers=args.workers,
        export_format=args.export
    )
    spider.crawl(max_pages=args.pages, category_id=args.type)


if __name__ == '__main__':
    main()
