#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
LiveWallpapers4Free.com 全站爬虫
支持:
- WordPress REST API 遍历所有文章
- 自动解析 Download Monitor 下载链接 (无需复杂逆向解密)
- 断点续传下载
- 多线程并发下载
- 自动去重
- 分类保存
"""

import os
import re
import sys
import json
import time
import requests
import threading
from bs4 import BeautifulSoup
from urllib.parse import urljoin, urlparse
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path
import logging

# ============ 配置 ============
BASE_URL = "https://livewallpapers4free.com"
API_BASE = f"{BASE_URL}/wp-json/wp/v2"
SAVE_DIR = Path("./downloads")  # 下载保存目录
MAX_WORKERS = 3                 # 并发下载线程数(不要太高避免被封)
MAX_RETRIES = 3                 # 下载重试次数
TIMEOUT = 60                    # 请求超时时间(秒)
CHUNK_SIZE = 8192               # 下载块大小
START_PAGE = 1                  # 起始页(用于断点续爬)
END_PAGE = None                 # 结束页(None=爬到最后)
DOWNLOAD_PREVIEW = True         # 是否同时下载预览视频

# ============ 日志配置 ============
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s [%(levelname)s] %(message)s',
    handlers=[
        logging.FileHandler('scraper.log', encoding='utf-8'),
        logging.StreamHandler(sys.stdout)
    ]
)
logger = logging.getLogger(__name__)

# ============ 请求头 ============
HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.9',
    'Accept-Encoding': 'gzip, deflate, br',
    'Connection': 'keep-alive',
}

# 全局Session
session = requests.Session()
session.headers.update(HEADERS)

# 已下载记录(用于去重和断点续爬)
downloaded_ids_file = Path("./downloaded_ids.json")
downloaded_ids = set()
if downloaded_ids_file.exists():
    try:
        with open(downloaded_ids_file, 'r') as f:
            downloaded_ids = set(json.load(f))
        logger.info(f"加载已下载记录: {len(downloaded_ids)} 条")
    except:
        downloaded_ids = set()

# 线程锁
lock = threading.Lock()


def save_downloaded_id(post_id):
    """保存已下载ID记录"""
    with lock:
        downloaded_ids.add(post_id)
        with open(downloaded_ids_file, 'w') as f:
            json.dump(list(downloaded_ids), f)


def sanitize_filename(name):
    """清理文件名中的非法字符"""
    name = re.sub(r'[<>:"/\\|?*]', '_', name)
    name = re.sub(r'\s+', ' ', name).strip()
    return name[:150]  # 限制长度


def get_file_size(url):
    """获取远程文件大小"""
    try:
        resp = session.head(url, timeout=15, allow_redirects=True)
        if resp.status_code == 200:
            return int(resp.headers.get('Content-Length', 0))
        # 尝试用Range头
        resp = session.get(url, headers={'Range': 'bytes=0-0'}, timeout=15, allow_redirects=True)
        cr = resp.headers.get('Content-Range', '')
        if '/' in cr:
            return int(cr.split('/')[-1])
    except:
        pass
    return 0


def download_file(url, save_path, referer=None, desc=""):
    """
    下载文件，支持断点续传
    关键逆向发现: Download Monitor插件链接 /download/ID/ 必须带Range头才会返回真实视频流
    """
    if os.path.exists(save_path) and os.path.getsize(save_path) > 0:
        # 检查是否已完整下载
        local_size = os.path.getsize(save_path)
        remote_size = get_file_size(url)
        if remote_size > 0 and local_size >= remote_size:
            logger.info(f"  [跳过] 已存在完整文件: {os.path.basename(save_path)}")
            return True
    
    # 准备请求头
    dl_headers = {}
    if referer:
        dl_headers['Referer'] = referer
    
    temp_path = save_path + '.part'
    downloaded = 0
    
    # 支持断点续传
    if os.path.exists(temp_path):
        downloaded = os.path.getsize(temp_path)
        if downloaded > 0:
            dl_headers['Range'] = f'bytes={downloaded}-'
    
    for retry in range(MAX_RETRIES):
        try:
            resp = session.get(url, headers=dl_headers, stream=True, timeout=TIMEOUT, allow_redirects=True)
            
            if resp.status_code not in [200, 206]:
                # 关键: 如果返回HTML，强制加Range头触发文件下载
                if resp.status_code == 200 and 'text/html' in resp.headers.get('Content-Type', ''):
                    dl_headers['Range'] = 'bytes=0-'
                    resp = session.get(url, headers=dl_headers, stream=True, timeout=TIMEOUT, allow_redirects=True)
                
                if resp.status_code not in [200, 206]:
                    logger.warning(f"  [重试 {retry+1}] HTTP {resp.status_code}: {desc}")
                    time.sleep(2)
                    continue
            
            # 获取总大小
            total_size = downloaded
            if 'Content-Range' in resp.headers:
                total_size = int(resp.headers['Content-Range'].split('/')[-1])
            elif 'Content-Length' in resp.headers:
                cl = int(resp.headers['Content-Length'])
                if resp.status_code == 206:
                    total_size = downloaded + cl
                else:
                    total_size = cl
            
            mode = 'ab' if downloaded > 0 and resp.status_code == 206 else 'wb'
            with open(temp_path, mode) as f:
                start_time = time.time()
                for chunk in resp.iter_content(chunk_size=CHUNK_SIZE):
                    if chunk:
                        f.write(chunk)
                        downloaded += len(chunk)
                        
                        # 下载进度(每2MB输出一次)
                        if downloaded % (2*1024*1024) < CHUNK_SIZE:
                            percent = (downloaded / total_size * 100) if total_size > 0 else 0
                            speed = downloaded / (time.time() - start_time) / 1024 / 1024 if time.time() > start_time else 0
                            logger.info(f"  [下载中] {desc} - {percent:.1f}% ({downloaded/1024/1024:.1f}MB/{total_size/1024/1024:.1f}MB) - {speed:.1f}MB/s")
            
            # 下载完成，重命名
            os.rename(temp_path, save_path)
            logger.info(f"  [完成] {os.path.basename(save_path)} ({downloaded/1024/1024:.1f}MB)")
            return True
            
        except requests.exceptions.Timeout:
            logger.warning(f"  [超时] 重试 {retry+1}/{MAX_RETRIES}: {desc}")
            time.sleep(3)
        except Exception as e:
            logger.error(f"  [错误] {type(e).__name__}: {e} - {desc}")
            time.sleep(2)
    
    logger.error(f"  [失败] 超过最大重试次数: {desc}")
    return False


def get_post_list(page=1, per_page=20):
    """通过WP REST API获取文章列表"""
    params = {
        'page': page,
        'per_page': per_page,
        '_embed': 'true',  # 包含特色图片等信息
    }
    try:
        resp = session.get(f"{API_BASE}/posts", params=params, timeout=20)
        if resp.status_code == 200:
            total_pages = int(resp.headers.get('X-WP-TotalPages', 1))
            total_posts = int(resp.headers.get('X-WP-Total', 0))
            return resp.json(), total_pages, total_posts
        else:
            logger.error(f"获取文章列表失败: HTTP {resp.status_code}")
            return None, 0, 0
    except Exception as e:
        logger.error(f"获取文章列表错误: {e}")
        return None, 0, 0


def parse_detail_page(url):
    """解析详情页获取下载链接"""
    try:
        resp = session.get(url, timeout=20)
        if resp.status_code != 200:
            return None
        
        soup = BeautifulSoup(resp.text, 'html.parser')
        
        result = {
            'downloads': [],  # 正式下载链接(HD/2K/4K等)
            'preview': None,  # 预览视频
            'thumbnail': None,  # 缩略图
        }
        
        # 1. 获取Download Monitor下载链接
        dl_links = soup.find_all('a', class_=re.compile(r'dlm-download-link'))
        for link in dl_links:
            href = link.get('href', '')
            text = link.get_text(strip=True)
            if '/download/' in href and href not in [d['url'] for d in result['downloads']]:
                # 从链接文本提取分辨率和文件名
                result['downloads'].append({
                    'url': href,
                    'text': text,
                })
        
        # 2. 获取预览视频
        preview_video = soup.find('video')
        if preview_video:
            source = preview_video.find('source')
            if source and source.get('src'):
                result['preview'] = source['src']
        
        # 如果没找到video标签，查找kgvid相关视频
        if not result['preview']:
            for source in soup.find_all('source', src=True):
                src = source['src']
                if 'VIDEO-zxcv' in src or src.endswith('.mp4'):
                    result['preview'] = src
                    break
        
        # 3. 获取缩略图
        og_image = soup.find('meta', property='og:image')
        if og_image and og_image.get('content'):
            result['thumbnail'] = og_image['content']
        
        return result
        
    except Exception as e:
        logger.error(f"解析详情页错误 {url}: {e}")
        return None


def process_post(post):
    """处理单篇文章: 解析+下载"""
    post_id = post['id']
    title = post['title']['rendered']
    link = post['link']
    slug = post.get('slug', str(post_id))
    
    if post_id in downloaded_ids:
        logger.info(f"[跳过] 已下载: ID={post_id} {title}")
        return True
    
    logger.info(f"\n[处理] ID={post_id} | {title}")
    logger.info(f"  URL: {link}")
    
    # 获取分类
    categories = []
    if '_embedded' in post and 'wp:term' in post['_embedded']:
        for terms in post['_embedded']['wp:term']:
            for term in terms:
                if term.get('taxonomy') == 'category':
                    categories.append(term['name'])
    
    # 创建保存目录 (用第一个分类或common)
    cat_name = sanitize_filename(categories[0]) if categories else "common"
    post_dir = SAVE_DIR / cat_name / sanitize_filename(title)
    post_dir.mkdir(parents=True, exist_ok=True)
    
    # 解析详情页
    detail = parse_detail_page(link)
    if not detail:
        logger.warning(f"  无法解析详情页")
        return False
    
    success_count = 0
    
    # 下载正式版本
    for dl in detail['downloads']:
        dl_url = dl['url']
        dl_text = dl['text']
        
        # 从链接文本提取文件名
        filename_match = re.match(r'(.+?)(?:\(\d+\s*downloads?\))?$', dl_text)
        if filename_match:
            filename = sanitize_filename(filename_match.group(1).strip())
        else:
            filename = f"video_{post_id}.mp4"
        
        if not filename.endswith('.mp4'):
            filename += '.mp4'
        
        save_path = str(post_dir / filename)
        
        logger.info(f"  [下载] {filename}")
        if download_file(dl_url, save_path, referer=link, desc=filename):
            success_count += 1
    
    # 下载预览视频(可选)
    if DOWNLOAD_PREVIEW and detail['preview']:
        preview_url = detail['preview']
        preview_filename = "preview_" + os.path.basename(urlparse(preview_url).path)
        preview_path = str(post_dir / preview_filename)
        logger.info(f"  [下载预览] {preview_filename}")
        if download_file(preview_url, preview_path, referer=link, desc=f"预览: {preview_filename}"):
            success_count += 1
    
    # 下载缩略图
    if detail['thumbnail']:
        thumb_url = detail['thumbnail']
        thumb_ext = os.path.splitext(urlparse(thumb_url).path)[1] or '.jpg'
        thumb_path = str(post_dir / f"thumbnail{thumb_ext}")
        try:
            resp = session.get(thumb_url, timeout=20)
            if resp.status_code == 200:
                with open(thumb_path, 'wb') as f:
                    f.write(resp.content)
        except:
            pass
    
    # 保存文章元数据
    meta = {
        'id': post_id,
        'title': title,
        'url': link,
        'categories': categories,
        'date': post.get('date'),
        'downloads': detail['downloads'],
        'preview': detail['preview'],
    }
    with open(post_dir / 'info.json', 'w', encoding='utf-8') as f:
        json.dump(meta, f, ensure_ascii=False, indent=2)
    
    if success_count > 0:
        save_downloaded_id(post_id)
        logger.info(f"  [成功] {title} 下载完成, 共 {success_count} 个文件")
        return True
    else:
        logger.warning(f"  [失败] {title} 没有成功下载的文件")
        return False


def get_categories():
    """获取所有分类"""
    try:
        resp = session.get(f"{API_BASE}/categories", params={'per_page': 100}, timeout=20)
        if resp.status_code == 200:
            cats = resp.json()
            logger.info(f"获取到 {len(cats)} 个分类:")
            for cat in cats:
                logger.info(f"  - {cat['name']} ({cat['count']} 篇) -> ID:{cat['id']}")
            return cats
    except Exception as e:
        logger.error(f"获取分类失败: {e}")
    return []


def main():
    logger.info("="*60)
    logger.info("LiveWallpapers4Free.com 全站爬虫启动")
    logger.info(f"保存目录: {SAVE_DIR.absolute()}")
    logger.info(f"并发线程: {MAX_WORKERS}")
    logger.info("="*60)
    
    SAVE_DIR.mkdir(exist_ok=True)
    
    # 获取分类
    get_categories()
    
    # 先获取第一页确定总页数
    logger.info(f"\n[*] 正在获取文章列表...")
    first_page, total_pages, total_posts = get_post_list(1, per_page=20)
    
    if not first_page:
        logger.error("无法获取文章列表，退出")
        return
    
    logger.info(f"[+] 总文章数: {total_posts}, 总页数: {total_pages}")
    
    if END_PAGE:
        total_pages = min(total_pages, END_PAGE)
    
    # 使用线程池处理
    with ThreadPoolExecutor(max_workers=MAX_WORKERS) as executor:
        futures = []
        
        # 提交第一页任务
        for post in first_page:
            futures.append(executor.submit(process_post, post))
        
        # 处理剩余页面
        for page in range(START_PAGE + 1 if START_PAGE > 1 else 2, total_pages + 1):
            logger.info(f"\n[*] 获取第 {page}/{total_pages} 页...")
            posts, _, _ = get_post_list(page, per_page=20)
            
            if not posts:
                logger.warning(f"第 {page} 页获取失败，跳过")
                time.sleep(2)
                continue
            
            for post in posts:
                futures.append(executor.submit(process_post, post))
            
            # 每页之间稍作延迟，避免请求过快
            time.sleep(1)
        
        # 等待所有任务完成并统计
        success = 0
        failed = 0
        for future in as_completed(futures):
            try:
                if future.result():
                    success += 1
                else:
                    failed += 1
            except Exception as e:
                logger.error(f"任务异常: {e}")
                failed += 1
    
    logger.info("\n" + "="*60)
    logger.info(f"爬取完成! 成功: {success}, 失败: {failed}")
    logger.info(f"文件保存在: {SAVE_DIR.absolute()}")
    logger.info("="*60)


if __name__ == '__main__':
    try:
        main()
    except KeyboardInterrupt:
        logger.info("\n用户中断，退出。已下载的记录已保存，下次运行会自动跳过已完成项。")
        sys.exit(0)
