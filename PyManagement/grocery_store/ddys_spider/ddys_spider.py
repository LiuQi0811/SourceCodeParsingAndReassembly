#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
低端影视 (ddys.io) 全站爬虫
功能：
1. 自动绕过 Cloudflare 5秒盾验证
2. 抓取全部分类（电影/剧集/综艺/动漫）的所有影视信息
3. 提取每个影视的所有m3u8视频源和集数
4. 提取网盘资源（夸克/百度/迅雷等）
5. 支持下载m3u8视频为MP4文件
6. 数据保存为JSON/CSV格式

使用方法：
  python ddys_spider.py --list              # 仅抓取列表索引
  python ddys_spider.py --full              # 抓取完整详情
  python ddys_spider.py --download --url https://ddys.io/movie/xxx  # 下载单个视频
  python ddys_spider.py --download-all      # 下载所有视频（耗时长，占空间）
"""

import os
import re
import sys
import json
import time
import base64
import argparse
import random
from urllib.parse import urljoin, urlparse
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path

import cloudscraper
from bs4 import BeautifulSoup
from tqdm import tqdm

# ==================== 配置 ====================
BASE_URL = "https://ddys.io"
CATEGORIES = {
    "movie": "/movie",
    "series": "/series", 
    "variety": "/variety",
    "anime": "/anime",
}
OUTPUT_DIR = Path("ddys_data")
MEDIA_DIR = OUTPUT_DIR / "media"
MAX_WORKERS = 3  # 并发线程，不要太高避免被封
DELAY_MIN = 1.0  # 请求最小间隔（秒）
DELAY_MAX = 3.0  # 请求最大间隔（秒）
TIMEOUT = 30

# ==================== 工具函数 ====================
def random_delay():
    """随机延迟，避免被封"""
    time.sleep(random.uniform(DELAY_MIN, DELAY_MAX))

def create_scraper():
    """创建绕过Cloudflare的scraper会话"""
    return cloudscraper.create_scraper(
        browser={
            'browser': 'chrome',
            'platform': 'windows',
            'mobile': False
        }
    )

def get_headers(referer=None):
    """生成请求头"""
    headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
        'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
        'Accept-Encoding': 'gzip, deflate, br',
    }
    if referer:
        headers['Referer'] = referer
    return headers

def safe_filename(name):
    """清理文件名中的非法字符"""
    name = re.sub(r'[<>:"/\\|?*]', '_', name)
    name = re.sub(r'\s+', '_', name)
    return name[:100]

# ==================== 列表页抓取 ====================
def get_max_page(scraper, category_url):
    """获取分类的最大页数"""
    try:
        resp = scraper.get(
            urljoin(BASE_URL, category_url),
            headers=get_headers(),
            timeout=TIMEOUT
        )
        if resp.status_code != 200:
            return 1
        
        # 查找分页链接 /page/N
        pages = re.findall(r'/page/(\d+)', resp.text)
        if pages:
            return max(int(p) for p in pages)
        return 1
    except Exception as e:
        print(f"获取最大页数失败: {e}")
        return 1

def parse_movie_card(card):
    """解析单个电影卡片信息"""
    result = {}
    
    # 链接 - 优先h3里的链接
    title_link = card.find('h3').find('a', href=True) if card.find('h3') else None
    main_link = title_link or card.find('a', href=True)
    
    if main_link:
        href = main_link['href']
        result['url'] = href if href.startswith('http') else urljoin(BASE_URL, href)
        result['slug'] = href.strip('/').split('/')[-1]
    
    # 标题 - 从h3获取
    if title_link:
        result['title'] = title_link.get_text(strip=True)
    elif main_link:
        img = main_link.find('img', alt=True)
        if img:
            result['title'] = img['alt']
        else:
            result['title'] = main_link.get_text(strip=True)
    
    # 海报图
    img = card.find('img', src=True)
    if img:
        result['poster'] = img.get('data-src', img.get('src', ''))
    
    # 评分 - badge-top-right
    rating_badge = card.find(class_='badge-top-right')
    if rating_badge:
        rating_text = rating_badge.get_text(strip=True)
        rating_match = re.search(r'(\d+\.\d+)', rating_text)
        if rating_match:
            try:
                result['rating'] = float(rating_match.group(1))
            except:
                pass
    
    # 年份/分类/状态 - 从meta行获取
    meta_div = card.find('div', class_=re.compile(r'text-xs.*gray-500'))
    if meta_div:
        meta_text = meta_div.get_text(strip=True)
        # 年份
        year_match = re.search(r'(\d{4})', meta_text)
        if year_match:
            result['year'] = int(year_match.group(1))
        # 分类
        for cat in ['电影', '剧集', '综艺', '动漫']:
            if cat in meta_text:
                result['sub_category'] = cat
                break
    
    # 状态徽章
    new_badge = card.find(class_='badge-new')
    if new_badge:
        result['is_new'] = True
    
    return result

def fetch_page_list(scraper, category, page):
    """抓取单页列表"""
    url = f"{BASE_URL}{CATEGORIES[category]}"
    if page > 1:
        url = f"{url}/page/{page}"
    
    try:
        resp = scraper.get(url, headers=get_headers(BASE_URL + '/'), timeout=TIMEOUT)
        if resp.status_code != 200:
            return []
        
        soup = BeautifulSoup(resp.text, 'lxml')
        cards = soup.find_all('div', class_='movie-card')
        
        movies = []
        for card in cards:
            info = parse_movie_card(card)
            info['category'] = category
            info['page'] = page
            if info.get('url'):
                movies.append(info)
        
        return movies
    except Exception as e:
        print(f"抓取列表页失败 {url}: {e}")
        return []

# ==================== 详情页抓取 ====================
def parse_episodes(url_string):
    """解析多集URL字符串为列表
    格式: 第01集$URL1#第02集$URL2#...
    """
    if not url_string or ('$' not in url_string and '#' not in url_string):
        return [{'name': '正片', 'url': url_string}] if url_string else []
    
    episodes = []
    parts = url_string.split('#')
    for part in parts:
        if '$' in part:
            name, url = part.split('$', 1)
            episodes.append({'name': name.strip(), 'url': url.strip()})
        elif part.strip():
            episodes.append({'name': f'片段{len(episodes)+1}', 'url': part.strip()})
    
    return episodes if episodes else [{'name': '正片', 'url': url_string}]

def parse_detail_page(html, url):
    """解析详情页，提取完整信息"""
    result = {
        'url': url,
        'movie_id': None,
        'title': '',
        'original_title': '',
        'year': None,
        'rating': None,
        'description': '',
        'poster': '',
        'video_sources': [],
        'netdisk_resources': [],
        'metadata': {}
    }
    
    soup = BeautifulSoup(html, 'lxml')
    
    # 标题
    title_match = re.search(r'<title>([^<]+)</title>', html)
    if title_match:
        result['title'] = title_match.group(1).replace('免费在线观看_高清网盘下载 - 低端影视', '').strip()
    
    # movieId
    movie_id_match = re.search(r'const movieId = (\d+);', html)
    if movie_id_match:
        result['movie_id'] = int(movie_id_match.group(1))
    
    # 海报
    poster_match = re.search(r'property="og:image"[^>]+content="([^"]+)"', html)
    if poster_match:
        result['poster'] = poster_match.group(1)
    
    # 评分
    rating_elem = soup.find(class_='rating-display')
    if rating_elem:
        rating_text = rating_elem.get_text(strip=True)
        rating_match = re.search(r'(\d+\.\d+)', rating_text)
        if rating_match:
            try:
                result['rating'] = float(rating_match.group(1))
            except:
                pass
    else:
        # fallback: 从badge-top-right找评分
        badge = soup.find(class_='badge-top-right')
        if badge:
            rating_text = badge.get_text(strip=True)
            rating_match = re.search(r'(\d+\.\d+)', rating_text)
            if rating_match:
                try:
                    result['rating'] = float(rating_match.group(1))
                except:
                    pass
    
    # 简介/描述
    desc_match = re.search(r'name="description" content="([^"]+)"', html)
    if desc_match:
        result['description'] = desc_match.group(1)
    
    # JSON-LD 结构化数据
    jsonld_match = re.search(r'<script type="application/ld\+json">([^<]+)</script>', html)
    if jsonld_match:
        try:
            jsonld = json.loads(jsonld_match.group(1))
            if isinstance(jsonld, dict):
                result['metadata']['jsonld'] = jsonld
                if 'name' in jsonld:
                    result['title'] = jsonld['name']
                if 'datePublished' in jsonld:
                    result['year'] = jsonld['datePublished'][:4] if jsonld['datePublished'] else None
        except:
            pass
    
    # 提取所有播放源
    source_pattern = r'switchSource\((\d+),\s*["\']([^"\']+)["\'],\s*["\']([^"\']+)["\']\)'
    sources = re.findall(source_pattern, html)
    
    # 也提取 firstSource
    first_source_match = re.search(r'const firstSource = ({.*?});', html)
    first_source_id = None
    if first_source_match:
        try:
            fs = json.loads(first_source_match.group(1))
            first_source_id = fs['id']
        except:
            pass
    
    seen_source_ids = set()
    for source_id, source_url, source_fmt in sources:
        source_id = int(source_id)
        if source_id in seen_source_ids:
            continue
        seen_source_ids.add(source_id)
        
        episodes = parse_episodes(source_url)
        source_name = f"播放源{len(result['video_sources'])+1}"
        
        result['video_sources'].append({
            'source_id': source_id,
            'source_name': source_name,
            'format': source_fmt,
            'episode_count': len(episodes),
            'episodes': episodes
        })
    
    # 如果没从switchSource找到，用firstSource
    if not result['video_sources'] and first_source_match:
        try:
            fs = json.loads(first_source_match.group(1))
            episodes = parse_episodes(fs.get('url', ''))
            result['video_sources'].append({
                'source_id': fs['id'],
                'source_name': fs.get('name', '播放源1'),
                'format': fs.get('format', 'm3u8'),
                'quality': fs.get('quality', ''),
                'episode_count': len(episodes),
                'episodes': episodes
            })
        except:
            pass
    
    # 提取网盘资源 (base64编码)
    netdisk_pattern = r'atob\(["\']([A-Za-z0-9+/=]+)["\']\)'
    encoded_urls = re.findall(netdisk_pattern, html)
    seen_netdisk = set()
    
    for encoded in encoded_urls:
        try:
            decoded = base64.b64decode(encoded).decode('utf-8')
            if decoded.startswith('http') and decoded not in seen_netdisk:
                seen_netdisk.add(decoded)
                
                # 识别网盘类型
                disk_type = 'unknown'
                if 'quark.cn' in decoded:
                    disk_type = 'quark'
                elif 'pan.baidu.com' in decoded:
                    disk_type = 'baidu'
                elif 'pan.xunlei.com' in decoded:
                    disk_type = 'xunlei'
                elif 'aliyundrive' in decoded or 'alipan.com' in decoded:
                    disk_type = 'aliyun'
                
                # 提取提取码
                pwd_match = re.search(r'pwd[=:]([a-zA-Z0-9]+)', decoded)
                password = pwd_match.group(1) if pwd_match else ''
                
                result['netdisk_resources'].append({
                    'type': disk_type,
                    'url': decoded,
                    'password': password
                })
        except:
            pass
    
    return result

def fetch_detail(scraper, movie_info):
    """抓取单个影视详情页"""
    url = movie_info['url']
    try:
        resp = scraper.get(url, headers=get_headers(BASE_URL + '/'), timeout=TIMEOUT)
        if resp.status_code != 200:
            return None
        
        detail = parse_detail_page(resp.text, url)
        # 合并列表页的信息
        detail.update({k: v for k, v in movie_info.items() if k not in detail or not detail[k]})
        return detail
    except Exception as e:
        print(f"抓取详情失败 {url}: {e}")
        return None

# ==================== m3u8 下载 ====================
def download_m3u8_video(m3u8_url, output_path, referer=None):
    """下载m3u8视频并合并为MP4
    需要系统安装 ffmpeg
    """
    import subprocess
    
    output_path = Path(output_path)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    
    cmd = [
        'ffmpeg', '-y',
        '-headers', f'Referer: {referer or BASE_URL}\r\nUser-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        '-i', m3u8_url,
        '-c', 'copy',
        '-bsf:a', 'aac_adtstoasc',
        str(output_path)
    ]
    
    try:
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=3600)
        return result.returncode == 0
    except Exception as e:
        print(f"下载失败: {e}")
        return False

def download_movie(detail, output_dir=None):
    """下载一部影视的所有集数"""
    if output_dir is None:
        title = safe_filename(detail.get('title', 'unknown'))
        output_dir = MEDIA_DIR / title
    
    output_dir = Path(output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)
    
    results = []
    for source in detail.get('video_sources', []):
        source_name = safe_filename(source['source_name'])
        source_dir = output_dir / source_name
        source_dir.mkdir(exist_ok=True)
        
        for ep in source.get('episodes', []):
            ep_name = safe_filename(ep['name'])
            output_file = source_dir / f"{ep_name}.mp4"
            
            if output_file.exists() and output_file.stat().st_size > 1024:
                print(f"  已存在: {output_file.name}")
                results.append({'file': str(output_file), 'status': 'exists'})
                continue
            
            print(f"  下载: {ep['name']} -> {output_file}")
            success = download_m3u8_video(
                ep['url'],
                output_file,
                referer=detail['url']
            )
            results.append({
                'file': str(output_file),
                'status': 'success' if success else 'failed',
                'episode': ep['name']
            })
            random_delay()
    
    return results

# ==================== 主爬虫类 ====================
class DDYSSpider:
    def __init__(self):
        self.scraper = create_scraper()
        self.all_movies = []
        self.index_file = OUTPUT_DIR / "index.json"
        self.full_data_file = OUTPUT_DIR / "full_data.json"
        
        OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
        MEDIA_DIR.mkdir(parents=True, exist_ok=True)
    
    def load_existing_index(self):
        """加载已抓取的索引"""
        if self.index_file.exists():
            with open(self.index_file, 'r', encoding='utf-8') as f:
                self.all_movies = json.load(f)
            print(f"加载已有索引: {len(self.all_movies)} 部影视")
    
    def save_index(self):
        """保存索引文件"""
        with open(self.index_file, 'w', encoding='utf-8') as f:
            json.dump(self.all_movies, f, ensure_ascii=False, indent=2)
        print(f"索引已保存: {len(self.all_movies)} 部影视 -> {self.index_file}")
    
    def save_full_data(self, data):
        """保存完整数据"""
        with open(self.full_data_file, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        print(f"完整数据已保存: {len(data)} 部影视 -> {self.full_data_file}")
    
    def crawl_index(self):
        """抓取所有分类的列表索引"""
        self.load_existing_index()
        existing_urls = {m['url'] for m in self.all_movies}
        
        for category, path in CATEGORIES.items():
            print(f"\n{'='*50}")
            print(f"抓取分类: {category}")
            print('='*50)
            
            max_page = get_max_page(self.scraper, path)
            print(f"总页数: {max_page}")
            
            for page in tqdm(range(1, max_page + 1), desc=f"{category}"):
                movies = fetch_page_list(self.scraper, category, page)
                new_count = 0
                for movie in movies:
                    if movie['url'] not in existing_urls:
                        self.all_movies.append(movie)
                        existing_urls.add(movie['url'])
                        new_count += 1
                
                if page % 10 == 0:
                    self.save_index()
                random_delay()
            
            self.save_index()
        
        print(f"\n索引抓取完成! 共 {len(self.all_movies)} 部影视")
        return self.all_movies
    
    def crawl_detail(self, max_workers=MAX_WORKERS):
        """抓取所有详情页"""
        if not self.all_movies:
            self.crawl_index()
        
        # 加载已有详情
        full_data = []
        existing_details = set()
        if self.full_data_file.exists():
            with open(self.full_data_file, 'r', encoding='utf-8') as f:
                full_data = json.load(f)
            existing_details = {d['url'] for d in full_data}
            print(f"加载已有详情: {len(full_data)} 部")
        
        to_crawl = [m for m in self.all_movies if m['url'] not in existing_details]
        print(f"待抓取详情: {len(to_crawl)} 部")
        
        with ThreadPoolExecutor(max_workers=max_workers) as executor:
            futures = {}
            for movie in to_crawl:
                future = executor.submit(fetch_detail, create_scraper(), movie)
                futures[future] = movie
                random_delay()
            
            for future in tqdm(as_completed(futures), total=len(futures), desc="抓取详情"):
                movie = futures[future]
                try:
                    detail = future.result()
                    if detail:
                        full_data.append(detail)
                except Exception as e:
                    print(f"处理失败 {movie.get('url')}: {e}")
                
                if len(full_data) % 50 == 0:
                    self.save_full_data(full_data)
        
        self.save_full_data(full_data)
        return full_data
    
    def get_movie_by_url(self, url):
        """获取单个影视的完整信息"""
        # 先确保URL正确
        if not url.startswith('http'):
            url = urljoin(BASE_URL, url)
        
        print(f"获取: {url}")
        detail = fetch_detail(self.scraper, {'url': url})
        return detail

# ==================== 主函数 ====================
def main():
    parser = argparse.ArgumentParser(description='低端影视 ddys.io 全站爬虫')
    parser.add_argument('--list', action='store_true', help='仅抓取列表索引')
    parser.add_argument('--full', action='store_true', help='抓取完整详情（含视频源）')
    parser.add_argument('--url', type=str, help='指定单个影视URL抓取')
    parser.add_argument('--download', action='store_true', help='下载视频（需要ffmpeg）')
    parser.add_argument('--download-all', action='store_true', help='下载所有视频（谨慎使用）')
    parser.add_argument('--workers', type=int, default=MAX_WORKERS, help='并发线程数')
    parser.add_argument('--output', type=str, default='', help='输出目录')
    
    args = parser.parse_args()
    
    spider = DDYSSpider()
    
    if args.output:
        global OUTPUT_DIR, MEDIA_DIR
        OUTPUT_DIR = Path(args.output)
        MEDIA_DIR = OUTPUT_DIR / "media"
        OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
        MEDIA_DIR.mkdir(parents=True, exist_ok=True)
        spider.index_file = OUTPUT_DIR / "index.json"
        spider.full_data_file = OUTPUT_DIR / "full_data.json"
    
    if args.url:
        # 抓取单个URL
        detail = spider.get_movie_by_url(args.url)
        if detail:
            print(f"\n标题: {detail.get('title')}")
            print(f"ID: {detail.get('movie_id')}")
            print(f"播放源数量: {len(detail.get('video_sources', []))}")
            for source in detail.get('video_sources', []):
                print(f"  {source['source_name']} ({source['format']}): {source['episode_count']}集")
                for ep in source['episodes'][:3]:
                    print(f"    {ep['name']}: {ep['url'][:80]}...")
                if source['episode_count'] > 3:
                    print(f"    ... 共 {source['episode_count']} 集")
            
            print(f"\n网盘资源: {len(detail.get('netdisk_resources', []))}个")
            for nd in detail.get('netdisk_resources', []):
                pwd = f" 提取码:{nd['password']}" if nd['password'] else ""
                print(f"  [{nd['type']}] {nd['url']}{pwd}")
            
            # 保存单个数据
            slug = urlparse(args.url).path.strip('/').split('/')[-1]
            out_file = OUTPUT_DIR / f"{slug}.json"
            with open(out_file, 'w', encoding='utf-8') as f:
                json.dump(detail, f, ensure_ascii=False, indent=2)
            print(f"\n数据已保存: {out_file}")
            
            if args.download:
                print("\n开始下载视频...")
                results = download_movie(detail)
                success = sum(1 for r in results if r['status'] in ('success', 'exists'))
                print(f"下载完成: {success}/{len(results)}")
    
    elif args.list:
        spider.crawl_index()
    
    elif args.full or args.download_all:
        full_data = spider.crawl_detail(max_workers=args.workers)
        
        if args.download_all:
            print("\n开始下载所有视频...")
            for movie in tqdm(full_data, desc="下载影视"):
                try:
                    download_movie(movie)
                except Exception as e:
                    print(f"下载失败 {movie.get('title')}: {e}")
    
    else:
        parser.print_help()
        print("\n示例用法:")
        print("  python ddys_spider.py --list              # 抓取所有影视列表索引")
        print("  python ddys_spider.py --full              # 抓取所有影视完整信息")
        print("  python ddys_spider.py --url https://ddys.io/movie/sheep-in-the-box  # 抓取单个影视")
        print("  python ddys_spider.py --download --url https://ddys.io/movie/xxx   # 抓取并下载")
        print("\n注意: 下载视频需要系统安装 ffmpeg")

if __name__ == "__main__":
    main()
