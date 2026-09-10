#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
电影港 (dygang.tv) 全站爬虫
网站编码: GB2312/GBK
无复杂JS加密，下载链接直接明文输出
"""

import requests
from bs4 import BeautifulSoup
import re
import os
import json
import time
import random
import csv
from urllib.parse import urljoin, urlparse
from datetime import datetime
from concurrent.futures import ThreadPoolExecutor, as_completed
import threading
import logging

# ============ 配置区 ============
BASE_URL = 'https://www.dygang.tv'
# 所有分类频道
CATEGORIES = {
    '最新电影': '/ys/',
    '经典高清': '/bd/',
    '国配电影': '/gy/',
    '经典港片': '/gp/',
    '国剧': '/dsj/',
    '日韩剧': '/dsj1/',
    '美剧': '/yx/',
    '综艺': '/zy/',
    '动漫': '/dmq/',
    '纪录片': '/jilupian/',
    '高清原盘': '/1080p/',
    '4K高清区': '/4K/',
    '3D电影': '/3d/',
}

# 输出目录
OUTPUT_DIR = '电影港全站数据'
MOVIE_DIR = os.path.join(OUTPUT_DIR, '电影详情')
DOWNLOAD_DIR = os.path.join(OUTPUT_DIR, '下载链接')
os.makedirs(MOVIE_DIR, exist_ok=True)
os.makedirs(DOWNLOAD_DIR, exist_ok=True)

# 请求配置
HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
    'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
    'Referer': BASE_URL,
}

# 线程数
MAX_WORKERS = 5
# 请求间隔(秒)
REQUEST_DELAY = (0.5, 1.5)
# 重试次数
MAX_RETRIES = 3
# 超时
TIMEOUT = 15

# 全局计数器
lock = threading.Lock()
stats = {
    'total_movies': 0,
    'total_download_links': 0,
    'failed_pages': 0,
    'failed_movies': 0,
}
visited_movie_urls = set()
visited_movie_lock = threading.Lock()

# 日志配置
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s [%(levelname)s] %(message)s',
    handlers=[
        logging.FileHandler(os.path.join(OUTPUT_DIR, '爬虫日志.log'), encoding='utf-8'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

# ============ 工具函数 ============
def get_session():
    """创建请求会话"""
    session = requests.Session()
    session.headers.update(HEADERS)
    return session

def safe_request(url, session=None, retries=MAX_RETRIES):
    """安全请求，自动重试和编码处理"""
    if session is None:
        session = get_session()
    
    for attempt in range(retries):
        try:
            time.sleep(random.uniform(*REQUEST_DELAY))
            r = session.get(url, timeout=TIMEOUT, allow_redirects=True)
            
            # 处理编码 - 网站使用GB2312
            if 'charset=gb2312' in r.text[:500].lower() or 'charset=gbk' in r.text[:500].lower():
                r.encoding = 'gbk'
            elif r.apparent_encoding:
                r.encoding = r.apparent_encoding
            else:
                r.encoding = 'utf-8'
            
            if r.status_code == 200:
                return r
            elif r.status_code == 404:
                logger.warning(f"页面不存在(404): {url}")
                return None
            else:
                logger.warning(f"请求失败(状态码{r.status_code})，第{attempt+1}次重试: {url}")
        except Exception as e:
            if attempt < retries - 1:
                logger.warning(f"请求异常({str(e)[:50]})，第{attempt+1}次重试: {url}")
                time.sleep(2 * (attempt + 1))
            else:
                logger.error(f"请求最终失败: {url}, 错误: {e}")
                with lock:
                    stats['failed_pages'] += 1
                return None
    return None

def clean_filename(name):
    """清理非法文件名字符"""
    return re.sub(r'[\\/:*?"<>|\r\n\t]', '_', str(name)).strip()[:100]

# ============ 核心爬虫函数 ============
def get_max_page(list_url, session):
    """获取分类的最大页数"""
    r = safe_request(list_url, session)
    if not r:
        return 1
    
    soup = BeautifulSoup(r.text, 'html.parser')
    
    # 查找尾页链接，如 index_1290.htm
    max_page = 1
    for a in soup.find_all('a', href=True):
        text = a.get_text(strip=True)
        href = a['href']
        if text == '尾页' or text == '末页':
            match = re.search(r'index_(\d+)\.htm', href)
            if match:
                max_page = int(match.group(1))
                break
    
    # 如果没找到尾页，遍历找最大数字
    if max_page == 1:
        for a in soup.find_all('a', href=True):
            href = a['href']
            match = re.search(r'index_(\d+)\.htm', href)
            if match:
                page_num = int(match.group(1))
                if page_num > max_page:
                    max_page = page_num
    
    return max_page if max_page > 0 else 1

def parse_movie_list(list_url, category, session):
    """解析电影列表页，返回该页所有电影详情链接"""
    r = safe_request(list_url, session)
    if not r:
        return []
    
    soup = BeautifulSoup(r.text, 'html.parser')
    movies = []
    
    # 提取电影详情链接
    # 链接格式: /ys/20260908/60513.htm
    movie_pattern = re.compile(r'^/[a-z0-9]+/\d+/\d+\.htm$')
    seen_on_page = set()
    
    for a in soup.find_all('a', href=True):
        href = a['href']
        text = a.get_text(strip=True)
        
        # 过滤无效链接
        if not text or len(text) < 2:
            continue
        if 'dygang' in href and href.startswith('http') and 'dygang.tv' not in href:
            continue
        if href.startswith('http') and 'dygang.tv' not in href:
            # 外部链接跳过
            continue
        
        # 规范化路径
        if href.startswith('/'):
            path = href
        elif href.startswith('http'):
            parsed = urlparse(href)
            path = parsed.path
        else:
            path = '/' + href
        
        # 匹配电影详情页格式
        if movie_pattern.match(path):
            full_url = urljoin(BASE_URL, path)
            
            # 去重
            with visited_movie_lock:
                if full_url in visited_movie_urls or full_url in seen_on_page:
                    continue
                seen_on_page.add(full_url)
                visited_movie_urls.add(full_url)
            
            movies.append({
                'url': full_url,
                'title': text,
                'category': category,
            })
    
    return movies

def parse_movie_detail(movie_info, session):
    """解析电影详情页，提取完整信息和下载链接"""
    url = movie_info['url']
    category = movie_info['category']
    
    r = safe_request(url, session)
    if not r:
        with lock:
            stats['failed_movies'] += 1
        return None
    
    soup = BeautifulSoup(r.text, 'html.parser')
    
    # 获取标题
    title = movie_info['title']
    title_tag = soup.find('title')
    if title_tag:
        page_title = title_tag.get_text(strip=True)
        # 标题通常格式: 片名_免费下载_最新电影_电影港
        if '_' in page_title:
            title = page_title.split('_')[0]
    
    # 提取影片信息
    info = {
        'title': title,
        'category': category,
        'url': url,
        'cover': '',
        'year': '',
        'country': '',
        'genre': '',
        'language': '',
        'douban_rating': '',
        'douban_url': '',
        'imdb_rating': '',
        'release_date': '',
        'actors': [],
        'director': '',
        'description': '',
        'download_links': [],
        'pan_links': [],
        'crawl_time': datetime.now().strftime('%Y-%m-%d %H:%M:%S'),
    }
    
    # 提取封面图
    cover_img = soup.find('div', id='Zoom')
    if cover_img:
        img = cover_img.find('img')
        if img and img.get('src'):
            info['cover'] = img['src']
    
    # 查找所有内容区域的文本
    content_text = soup.get_text('\n', strip=True)
    
    # 提取详情页正文中的图片作为封面(备选)
    if not info['cover']:
        for img in soup.find_all('img'):
            src = img.get('src', '')
            if any(ext in src.lower() for ext in ['.jpg', '.jpeg', '.png', '.webp']):
                if 'logo' not in src.lower() and 'icon' not in src.lower():
                    info['cover'] = src if src.startswith('http') else urljoin(BASE_URL, src)
                    break
    
    # 提取豆瓣链接
    for a in soup.find_all('a', href=True):
        href = a['href']
        if 'movie.douban.com' in href:
            info['douban_url'] = href
            text = a.get_text(strip=True)
            # 尝试提取评分
            parent_text = a.parent.get_text() if a.parent else ''
            rating_match = re.search(r'(\d+\.\d+)', parent_text)
            if rating_match:
                info['douban_rating'] = rating_match.group(1)
            break
    
    # 在Zoom区域提取所有文本信息
    zoom_div = soup.find('div', id='Zoom')
    if zoom_div:
        zoom_text = zoom_div.get_text('\n', strip=True)
        zoom_html = str(zoom_div)
        
        # 提取年代
        year_match = re.search(r'年\s*代\s*[:：]\s*(\d{4})', zoom_text)
        if year_match:
            info['year'] = year_match.group(1)
        else:
            year_match2 = re.search(r'(\d{4})', title)
            if year_match2:
                info['year'] = year_match2.group(1)
        
        # 提取国家
        country_match = re.search(r'国\s*家\s*[:：]\s*([^\n]+)', zoom_text)
        if country_match:
            info['country'] = country_match.group(1).strip()
        
        # 提取类别
        genre_match = re.search(r'类\s*别\s*[:：]\s*([^\n]+)', zoom_text)
        if genre_match:
            info['genre'] = genre_match.group(1).strip()
        
        # 提取语言
        lang_match = re.search(r'语\s*言\s*[:：]\s*([^\n]+)', zoom_text)
        if lang_match:
            info['language'] = lang_match.group(1).strip()
        
        # 提取上映日期
        date_match = re.search(r'上映日期\s*[:：]\s*([^\n]+)', zoom_text)
        if date_match:
            info['release_date'] = date_match.group(1).strip()
        
        # 提取导演
        director_match = re.search(r'导\s*演\s*[:：]\s*([^\n]+)', zoom_text)
        if director_match:
            info['director'] = director_match.group(1).strip()
        
        # 提取主演
        actors_match = re.search(r'主\s*演\s*[:：]\s*([\s\S]+?)(?:\n\s*\n|简\s*介|片\s*长)', zoom_text)
        if actors_match:
            actors_text = actors_match.group(1).strip()
            # 按行分割并清理
            actors = [a.strip() for a in re.split(r'[\n,，]', actors_text) if a.strip() and len(a.strip()) > 1]
            info['actors'] = actors[:20]  # 最多20个
        
        # 提取简介
        desc_match = re.search(r'简\s*介\s*[:：]?\s*([\s\S]+?)(?:获奖情况|影片截图|幕后|【下载地址】|下载地址|$)', zoom_text)
        if desc_match:
            desc = desc_match.group(1).strip()
            # 移除多余空行
            desc = re.sub(r'\n{3,}', '\n\n', desc)
            info['description'] = desc[:2000]  # 限制长度
    
    # 提取所有下载链接
    download_count = 0
    
    # 1. 提取磁力链接
    magnet_pattern = re.compile(r'magnet:\?xt=urn:btih:[a-zA-Z0-9]+[^\s<>"\']*')
    for match in magnet_pattern.finditer(str(soup)):
        link = match.group(0)
        # 清理链接末尾的HTML实体
        link = re.sub(r'&amp;', '&', link)
        link = link.rstrip('"\'<>')
        
        # 尝试获取链接对应的描述文本
        desc = ''
        # 查找链接附近的文本作为清晰度描述
        context_start = max(0, match.start() - 200)
        context = str(soup)[context_start:match.start()]
        desc_match = re.search(r'>([^<]{3,80})<\s*$', context)
        if desc_match:
            desc = desc_match.group(1).strip()
        
        if not desc:
            desc = '磁力下载'
        
        info['download_links'].append({
            'type': 'magnet',
            'name': desc,
            'url': link,
        })
        download_count += 1
    
    # 2. 提取thunder:// 迅雷链接
    thunder_pattern = re.compile(r'thunder://[a-zA-Z0-9+/=]+')
    for match in thunder_pattern.finditer(str(soup)):
        link = match.group(0)
        link = link.rstrip('"\'<>')
        
        info['download_links'].append({
            'type': 'thunder',
            'name': '迅雷链接',
            'url': link,
        })
        download_count += 1
    
    # 3. 提取ed2k链接
    ed2k_pattern = re.compile(r'ed2k://[^\s<>"\']+')
    for match in ed2k_pattern.finditer(str(soup)):
        link = match.group(0)
        link = re.sub(r'&amp;', '&', link)
        link = link.rstrip('"\'<>')
        
        info['download_links'].append({
            'type': 'ed2k',
            'name': '电驴链接',
            'url': link,
        })
        download_count += 1
    
    # 4. 提取ftp链接
    ftp_pattern = re.compile(r'ftp://[^\s<>"\']+')
    for match in ftp_pattern.finditer(str(soup)):
        link = match.group(0)
        link = re.sub(r'&amp;', '&', link)
        link = link.rstrip('"\'<>')
        
        info['download_links'].append({
            'type': 'ftp',
            'name': 'FTP下载',
            'url': link,
        })
        download_count += 1
    
    # 5. 提取网盘链接 (百度网盘/夸克/迅雷/阿里云)
    pan_domains = ['pan.baidu.com', 'pan.quark.cn', 'pan.xunlei.com', 'pan.alipan.com', 
                   'aliyundrive.com', 'cloud.189.cn', 'pan.aliyun.com']
    
    for a in soup.find_all('a', href=True):
        href = a['href']
        text = a.get_text(strip=True)
        
        for domain in pan_domains:
            if domain in href:
                # 提取提取码
                pwd_match = re.search(r'pwd[=:]\s*([a-zA-Z0-9]{4})', href + ' ' + text)
                pwd = pwd_match.group(1) if pwd_match else ''
                
                # 判断网盘类型
                pan_type = '其他网盘'
                if 'baidu' in domain:
                    pan_type = '百度网盘'
                elif 'quark' in domain:
                    pan_type = '夸克网盘'
                elif 'xunlei' in domain:
                    pan_type = '迅雷网盘'
                elif 'ali' in domain:
                    pan_type = '阿里云盘'
                elif '189' in domain:
                    pan_type = '天翼云盘'
                
                info['pan_links'].append({
                    'type': pan_type,
                    'url': href,
                    'password': pwd,
                    'text': text[:50] if text else pan_type,
                })
                download_count += 1
                break
    
    # 6. 如果以上方式没找到磁力，尝试直接在HTML中找所有a标签的磁力
    if download_count == 0:
        for a in soup.find_all('a', href=True):
            href = a['href']
            text = a.get_text(strip=True)
            if href.startswith('magnet:'):
                href = re.sub(r'&amp;', '&', href)
                info['download_links'].append({
                    'type': 'magnet',
                    'name': text if text else '磁力下载',
                    'url': href,
                })
                download_count += 1
    
    with lock:
        stats['total_movies'] += 1
        stats['total_download_links'] += download_count
    
    return info

def save_movie_data(movie_data):
    """保存单个电影数据"""
    if not movie_data:
        return
    
    safe_title = clean_filename(movie_data['title'])
    if not safe_title:
        safe_title = f"movie_{int(time.time())}"
    
    # 保存JSON详情
    json_path = os.path.join(MOVIE_DIR, f"{safe_title}.json")
    # 处理重名
    counter = 1
    while os.path.exists(json_path):
        json_path = os.path.join(MOVIE_DIR, f"{safe_title}_{counter}.json")
        counter += 1
    
    with open(json_path, 'w', encoding='utf-8') as f:
        json.dump(movie_data, f, ensure_ascii=False, indent=2)

def save_all_download_links(all_movies):
    """保存汇总下载链接"""
    # CSV格式汇总
    csv_path = os.path.join(DOWNLOAD_DIR, '全部下载链接汇总.csv')
    with open(csv_path, 'w', encoding='utf-8-sig', newline='') as f:
        writer = csv.writer(f)
        writer.writerow(['电影名称', '分类', '年代', '国家', '类型', '链接类型', '链接名称', '下载链接', '提取码', '详情页'])
        
        for movie in all_movies:
            # 磁力/FTP等下载链接
            for dl in movie['download_links']:
                writer.writerow([
                    movie['title'],
                    movie['category'],
                    movie['year'],
                    movie['country'],
                    movie['genre'],
                    dl['type'],
                    dl['name'],
                    dl['url'],
                    '',
                    movie['url'],
                ])
            
            # 网盘链接
            for pan in movie['pan_links']:
                writer.writerow([
                    movie['title'],
                    movie['category'],
                    movie['year'],
                    movie['country'],
                    movie['genre'],
                    pan['type'],
                    pan['text'],
                    pan['url'],
                    pan['password'],
                    movie['url'],
                ])
    
    # 按分类保存TXT格式(方便复制粘贴到下载器)
    for category in CATEGORIES.keys():
        cat_movies = [m for m in all_movies if m['category'] == category]
        if not cat_movies:
            continue
        
        txt_path = os.path.join(DOWNLOAD_DIR, f'{category}_磁力链接.txt')
        with open(txt_path, 'w', encoding='utf-8') as f:
            f.write(f"===== {category} 磁力链接汇总 =====\n")
            f.write(f"抓取时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n")
            f.write(f"共计: {len(cat_movies)} 部影片\n\n")
            
            for movie in cat_movies:
                f.write(f"【{movie['title']}】 ({movie['year']} {movie['country']})\n")
                f.write(f"豆瓣: {movie['douban_rating'] or '无评分'}\n")
                if movie['genre']:
                    f.write(f"类型: {movie['genre']}\n")
                
                for dl in movie['download_links']:
                    if dl['type'] == 'magnet':
                        f.write(f"  {dl['name']}\n")
                        f.write(f"  {dl['url']}\n\n")
                
                for pan in movie['pan_links']:
                    f.write(f"  [{pan['type']}] {pan['text']}\n")
                    f.write(f"  链接: {pan['url']}\n")
                    if pan['password']:
                        f.write(f"  提取码: {pan['password']}\n")
                    f.write('\n')
                
                f.write('-' * 80 + '\n\n')
    
    # 保存电影信息总表
    info_csv_path = os.path.join(OUTPUT_DIR, '电影信息总表.csv')
    with open(info_csv_path, 'w', encoding='utf-8-sig', newline='') as f:
        writer = csv.writer(f)
        writer.writerow(['电影名称', '分类', '年代', '国家', '类型', '语言', '豆瓣评分', '导演', '主演', '简介', '详情页', '下载链接数', '网盘数'])
        
        for movie in all_movies:
            writer.writerow([
                movie['title'],
                movie['category'],
                movie['year'],
                movie['country'],
                movie['genre'],
                movie['language'],
                movie['douban_rating'],
                movie['director'],
                ' / '.join(movie['actors'][:5]),
                movie['description'][:300].replace('\n', ' '),
                movie['url'],
                len(movie['download_links']),
                len(movie['pan_links']),
            ])
    
    logger.info(f"下载链接汇总已保存到: {csv_path}")

def crawl_category(category_name, category_path, max_pages=None):
    """爬取单个分类"""
    session = get_session()
    category_movies = []
    
    list_url = urljoin(BASE_URL, category_path)
    
    # 获取总页数
    total_pages = get_max_page(list_url, session)
    if max_pages and max_pages < total_pages:
        total_pages = max_pages
    
    logger.info(f"[{category_name}] 共 {total_pages} 页")
    
    all_movie_basic = []
    
    # 第一页
    first_page_movies = parse_movie_list(list_url, category_name, session)
    all_movie_basic.extend(first_page_movies)
    logger.info(f"[{category_name}] 第1页: 找到 {len(first_page_movies)} 部电影")
    
    # 后续分页
    for page in range(2, total_pages + 1):
        page_url = urljoin(BASE_URL, f"{category_path}index_{page}.htm")
        page_movies = parse_movie_list(page_url, category_name, session)
        all_movie_basic.extend(page_movies)
        
        if page % 20 == 0 or page == total_pages:
            logger.info(f"[{category_name}] 第{page}/{total_pages}页: 找到 {len(page_movies)} 部电影")
    
    logger.info(f"[{category_name}] 列表页解析完成，共 {len(all_movie_basic)} 部电影，开始抓取详情...")
    
    # 抓取详情页 - 使用线程池
    with ThreadPoolExecutor(max_workers=MAX_WORKERS) as executor:
        futures = {executor.submit(parse_movie_detail, m, session): m for m in all_movie_basic}
        
        completed = 0
        for future in as_completed(futures):
            movie_data = future.result()
            if movie_data:
                category_movies.append(movie_data)
                save_movie_data(movie_data)
            
            completed += 1
            if completed % 50 == 0:
                logger.info(f"[{category_name}] 详情进度: {completed}/{len(all_movie_basic)}")
    
    logger.info(f"[{category_name}] 抓取完成! 成功: {len(category_movies)} 部")
    return category_movies

# ============ 主函数 ============
def main():
    print("=" * 60)
    print("  电影港 (dygang.tv) 全站爬虫")
    print("=" * 60)
    print(f"输出目录: {os.path.abspath(OUTPUT_DIR)}")
    print(f"分类数量: {len(CATEGORIES)} 个")
    print(f"线程数: {MAX_WORKERS}")
    print()
    
    start_time = time.time()
    
    # 询问爬取页数(为了测试，默认只爬前3页，可改为None爬全部)
    # 注意: 全站爬取页数很多(如最新电影有1290+页)，全量爬取耗时很长
    # 如果要全量爬取，将 MAX_PAGES_PER_CATEGORY 改为 None
    MAX_PAGES_PER_CATEGORY = 3  # 每个分类爬取前N页，改为None爬全部
    
    if MAX_PAGES_PER_CATEGORY:
        print(f"[!] 当前设置: 每个分类只爬前 {MAX_PAGES_PER_CATEGORY} 页 (测试模式)")
        print(f"[!] 如需全量爬取，请将代码中的 MAX_PAGES_PER_CATEGORY 改为 None")
        print()
    
    all_movies = []
    
    # 逐个分类爬取
    for cat_name, cat_path in CATEGORIES.items():
        logger.info(f"========== 开始爬取分类: {cat_name} ==========")
        try:
            cat_movies = crawl_category(cat_name, cat_path, max_pages=MAX_PAGES_PER_CATEGORY)
            all_movies.extend(cat_movies)
        except Exception as e:
            logger.error(f"爬取分类 {cat_name} 时出错: {e}", exc_info=True)
    
    # 保存汇总
    logger.info("正在生成汇总文件...")
    save_all_download_links(all_movies)
    
    # 保存完整JSON
    full_json_path = os.path.join(OUTPUT_DIR, '全站电影数据完整.json')
    with open(full_json_path, 'w', encoding='utf-8') as f:
        json.dump(all_movies, f, ensure_ascii=False, indent=2)
    
    # 统计
    elapsed = time.time() - start_time
    logger.info("=" * 60)
    logger.info("爬取完成! 统计信息:")
    logger.info(f"  总耗时: {elapsed/60:.1f} 分钟")
    logger.info(f"  成功抓取电影: {stats['total_movies']} 部")
    logger.info(f"  提取下载链接: {stats['total_download_links']} 条")
    logger.info(f"  列表页失败: {stats['failed_pages']}")
    logger.info(f"  详情页失败: {stats['failed_movies']}")
    logger.info(f"  数据保存位置: {os.path.abspath(OUTPUT_DIR)}")
    logger.info("=" * 60)

if __name__ == '__main__':
    main()
