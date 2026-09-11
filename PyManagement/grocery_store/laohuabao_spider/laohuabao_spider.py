#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
老画报网 (www.laohuabao.com) 全站爬虫
功能：自动抓取网站所有连环画、画报内容，下载高清图片
特点：
- 自动遍历所有分类、分页
- 自动下载高清原图（自动处理thumb/smallpic缩略图路径）
- 断点续传、去重
- 多线程下载加速
- 完整错误处理与重试机制
- 无加密、无需逆向解密（图片路径规律已分析清楚）
"""

import os
import re
import time
import json
import random
import hashlib
import requests
from bs4 import BeautifulSoup
from urllib.parse import urljoin, urlparse
from concurrent.futures import ThreadPoolExecutor, as_completed
from collections import deque
import threading

# ============ 配置项 ============
BASE_URL = "http://www.laohuabao.com/"
SAVE_DIR = "老画报网全站下载"
MAX_WORKERS = 5  # 并发下载线程数
MAX_RETRY = 3   # 重试次数
DELAY_MIN = 0.5 # 请求最小延迟(秒)
DELAY_MAX = 1.5 # 请求最大延迟(秒)
TIMEOUT = 30    # 请求超时(秒)
RESUME_DOWNLOAD = True  # 是否断点续传

# ============ 全局变量 ============
visited_urls = set()
downloaded_images = set()
lock = threading.Lock()
session = requests.Session()

# 请求头 - 模拟浏览器
HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
    'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
    'Referer': BASE_URL
}

# 网站所有分类入口（从首页导航提取）
CATEGORY_URLS = [
    "/index.html",
    "/huabao/index.html",      # 文艺类
    "/zhishi/index.html",      # 知识类
    "/manhua/index.html",      # 漫画类
    "/xiaorenshu/index.html",  # 小人书
    "/zhuanti/index.html",     # 连画专题
    "/lilun/index.html",       # 技术文章
]

def init_session():
    """初始化requests session"""
    session.headers.update(HEADERS)
    
def safe_filename(name):
    """生成安全的文件名/目录名"""
    if not name:
        return "unknown"
    # 移除非法字符
    name = re.sub(r'[<>:"/\\|?*\n\r\t]', '_', name)
    name = re.sub(r'_+', '_', name)
    name = name.strip('_ .')
    # 限制长度
    if len(name) > 100:
        name = name[:100] + '_' + hashlib.md5(name.encode()).hexdigest()[:8]
    return name if name else "unknown"

def random_delay():
    """随机延迟，避免请求过快"""
    time.sleep(random.uniform(DELAY_MIN, DELAY_MAX))

def get_page(url, encoding='gb2312'):
    """获取页面内容，带重试机制"""
    for retry in range(MAX_RETRY):
        try:
            random_delay()
            r = session.get(url, timeout=TIMEOUT)
            r.encoding = encoding
            if r.status_code == 200:
                return r.text
            elif r.status_code == 404:
                return None
            else:
                print(f"[!] 获取页面失败 {url}, status={r.status_code}, retry={retry+1}")
        except Exception as e:
            print(f"[!] 请求异常 {url}: {e}, retry={retry+1}")
            time.sleep(2)
    return None

def extract_links(html, base_url):
    """提取页面中的所有站内链接"""
    if not html:
        return []
    
    soup = BeautifulSoup(html, 'html.parser')
    links = set()
    
    for a in soup.find_all('a', href=True):
        href = a['href']
        # 跳过javascript和锚点
        if href.startswith('javascript:') or href.startswith('#'):
            continue
        # 转为绝对URL
        full_url = urljoin(base_url, href)
        # 只保留本站链接
        if 'laohuabao.com' in full_url:
            # 移除fragment
            full_url = full_url.split('#')[0]
            # 标准化
            parsed = urlparse(full_url)
            links.add(f"{parsed.scheme}://{parsed.netloc}{parsed.path}")
    
    return list(links)

def get_hd_image_url(thumb_url):
    """将缩略图URL转换为高清原图URL
    经过实际测试：
    - /thumb/xxx.jpg -> /xxx.jpg (去掉thumb目录)
    - /smallpic/xxx.jpg -> /xxx.jpg (去掉smallpic目录)
    """
    hd_url = thumb_url
    # 替换各种缩略图目录为高清原图
    hd_url = re.sub(r'/thumb/', '/', hd_url)
    hd_url = re.sub(r'/smallpic/', '/', hd_url)
    hd_url = re.sub(r'/pic/', '/', hd_url)
    return hd_url

def extract_images(html, base_url):
    """提取页面中的所有连环画图片URL，返回高清原图URL列表"""
    if not html:
        return [], ""
    
    soup = BeautifulSoup(html, 'html.parser')
    
    # 提取标题
    title = ""
    title_tag = soup.find('h2') or soup.find('h1') or soup.find('title')
    if title_tag:
        title = title_tag.get_text(strip=True)
        title = re.sub(r'\s*-\s*老画报网.*$', '', title)
    
    images = []
    seen = set()
    
    for img in soup.find_all('img', src=True):
        src = img['src']
        if src.startswith('data:'):
            continue
        # 转为绝对URL
        full_url = urljoin(base_url, src)
        # 只处理网站图片目录下的内容图片
        if '/x/' in full_url and ('thumb' in full_url or 'smallpic' in full_url):
            # 转换为高清URL
            hd_url = get_hd_image_url(full_url)
            if hd_url not in seen:
                seen.add(hd_url)
                images.append(hd_url)
    
    return images, title

def get_max_page(html, base_url):
    """获取列表页或详情页的最大页码"""
    if not html:
        return 1
    
    # 匹配 _N.html 格式的分页链接
    pages = re.findall(r'_(\d+)\.html', html)
    if pages:
        return max(int(p) for p in pages)
    
    # 匹配纯数字分页链接（如 <a href="2">2</a>）
    pages = re.findall(r'>\s*(\d+)\s*<', html)
    if pages:
        nums = [int(p) for p in pages if int(p) < 1000]  # 过滤掉年份等大数字
        if nums:
            return max(nums)
    
    return 1

def download_image(url, save_path):
    """下载单张图片，支持断点续传"""
    with lock:
        if url in downloaded_images:
            return True
        if os.path.exists(save_path) and RESUME_DOWNLOAD:
            if os.path.getsize(save_path) > 1000:  # 文件大于1KB认为已下载
                downloaded_images.add(url)
                return True
    
    for retry in range(MAX_RETRY):
        try:
            # 更新referer
            headers = HEADERS.copy()
            headers['Referer'] = os.path.dirname(url) + '/'
            
            random_delay()
            r = session.get(url, headers=headers, timeout=TIMEOUT, stream=True)
            
            if r.status_code == 200:
                os.makedirs(os.path.dirname(save_path), exist_ok=True)
                with open(save_path, 'wb') as f:
                    for chunk in r.iter_content(chunk_size=8192):
                        f.write(chunk)
                
                with lock:
                    downloaded_images.add(url)
                return True
            elif r.status_code == 404:
                # print(f"[!] 图片不存在: {url}")
                return False
            else:
                # print(f"[!] 下载图片失败 {url}, status={r.status_code}")
                time.sleep(1)
        except Exception as e:
            # print(f"[!] 下载异常 {url}: {e}")
            time.sleep(1)
    
    return False

def is_detail_page(url, html):
    """判断是否为连环画详情页（包含图片的页面）"""
    if not html:
        return False
    # 详情页通常包含 /x/ 目录下的图片
    if '/x/' in html and ('thumb' in html or 'smallpic' in html):
        return True
    return False

def is_list_page(url):
    """判断是否为列表页（index.html结尾或目录形式）"""
    return url.endswith('/index.html') or url.endswith('/') or url.endswith('.html') and '_' not in url.split('/')[-1]

def crawl():
    """主爬虫函数"""
    print("=" * 60)
    print("老画报网全站爬虫启动")
    print(f"保存目录: {os.path.abspath(SAVE_DIR)}")
    print(f"并发线程: {MAX_WORKERS}")
    print("=" * 60)
    
    init_session()
    os.makedirs(SAVE_DIR, exist_ok=True)
    
    # 加载断点续传记录
    progress_file = os.path.join(SAVE_DIR, '.crawl_progress.json')
    if RESUME_DOWNLOAD and os.path.exists(progress_file):
        try:
            with open(progress_file, 'r', encoding='utf-8') as f:
                progress = json.load(f)
                visited_urls.update(progress.get('visited', []))
                downloaded_images.update(progress.get('downloaded', []))
                print(f"[*] 加载断点进度: 已访问 {len(visited_urls)} 页面, 已下载 {len(downloaded_images)} 张图片")
        except:
            print("[!] 进度文件损坏，重新开始")
    
    # BFS队列
    queue = deque()
    for cat in CATEGORY_URLS:
        queue.append(urljoin(BASE_URL, cat))
    
    stats = {
        'pages_crawled': 0,
        'books_found': 0,
        'images_downloaded': 0,
        'images_failed': 0
    }
    
    def save_progress():
        with open(progress_file, 'w', encoding='utf-8') as f:
            json.dump({
                'visited': list(visited_urls),
                'downloaded': list(downloaded_images)
            }, f, ensure_ascii=False)
    
    try:
        while queue:
            url = queue.popleft()
            
            with lock:
                if url in visited_urls:
                    continue
                visited_urls.add(url)
            
            print(f"\n[*] 抓取页面: {url}")
            html = get_page(url)
            
            if not html:
                continue
            
            stats['pages_crawled'] += 1
            
            # 判断页面类型
            if is_detail_page(url, html):
                # ====== 详情页：提取图片并下载 ======
                images, title = extract_images(html, url)
                
                if images:
                    stats['books_found'] += 1
                    print(f"[+] 发现画册: {title or '未知标题'}, 共 {len(images)} 张图片")
                    
                    # 创建保存目录：根据URL路径创建
                    parsed = urlparse(url)
                    path_parts = [p for p in parsed.path.split('/') if p and p != 'index.html']
                    if path_parts and path_parts[-1].endswith('.html'):
                        path_parts[-1] = path_parts[-1].replace('.html', '')
                    
                    book_dir = os.path.join(SAVE_DIR, *[safe_filename(p) for p in path_parts])
                    if title:
                        book_dir = os.path.join(os.path.dirname(book_dir), safe_filename(title))
                    
                    # 多线程下载图片
                    with ThreadPoolExecutor(max_workers=MAX_WORKERS) as executor:
                        futures = {}
                        for idx, img_url in enumerate(images, 1):
                            ext = os.path.splitext(urlparse(img_url).path)[1] or '.jpg'
                            img_name = f"{idx:03d}{ext}"
                            save_path = os.path.join(book_dir, img_name)
                            future = executor.submit(download_image, img_url, save_path)
                            futures[future] = img_url
                        
                        for future in as_completed(futures):
                            if future.result():
                                stats['images_downloaded'] += 1
                            else:
                                stats['images_failed'] += 1
                    
                    print(f"[✓] 画册下载完成: {title}, 成功: {stats['images_downloaded']} 张")
                    
                    # 获取该画册的所有分页
                    max_page = get_max_page(html, url)
                    if max_page > 1:
                        base_page = url.replace('.html', '')
                        for page in range(2, max_page + 1):
                            page_url = f"{base_page}_{page}.html"
                            if page_url not in visited_urls:
                                queue.append(page_url)
                    
                    # 每下载完一本书保存进度
                    save_progress()
            
            # ====== 提取页面中的链接加入队列 ======
            links = extract_links(html, url)
            for link in links:
                # 过滤非HTML资源
                if any(link.endswith(ext) for ext in ['.jpg', '.jpeg', '.png', '.gif', '.css', '.js', '.ico']):
                    continue
                with lock:
                    if link not in visited_urls:
                        queue.append(link)
            
            # 定期输出统计
            if stats['pages_crawled'] % 10 == 0:
                print(f"\n[统计] 已爬页面: {stats['pages_crawled']}, 画册数: {stats['books_found']}, 已下载图片: {stats['images_downloaded']}, 失败: {stats['images_failed']}")
                save_progress()
    
    except KeyboardInterrupt:
        print("\n\n[!] 用户中断，保存进度...")
        save_progress()
    except Exception as e:
        print(f"\n[!] 爬虫异常: {e}")
        import traceback
        traceback.print_exc()
        save_progress()
    
    finally:
        save_progress()
        print("\n" + "=" * 60)
        print("爬虫结束")
        print(f"总爬取页面: {stats['pages_crawled']}")
        print(f"发现画册数: {stats['books_found']}")
        print(f"成功下载图片: {stats['images_downloaded']}")
        print(f"下载失败图片: {stats['images_failed']}")
        print(f"文件保存位置: {os.path.abspath(SAVE_DIR)}")
        print("=" * 60)

def download_single_book(book_url, output_dir=None):
    """单独下载单本画册（便于使用）"""
    init_session()
    
    print(f"[*] 下载单本画册: {book_url}")
    html = get_page(book_url)
    if not html:
        print("[!] 无法访问页面")
        return
    
    all_images = []
    title = ""
    
    # 获取第一页
    images, title = extract_images(html, book_url)
    all_images.extend(images)
    
    # 获取所有分页
    max_page = get_max_page(html, book_url)
    if max_page > 1:
        print(f"[*] 共 {max_page} 页，正在翻页获取...")
        base_page = book_url.replace('.html', '')
        for page in range(2, max_page + 1):
            page_url = f"{base_page}_{page}.html"
            page_html = get_page(page_url)
            page_images, _ = extract_images(page_html, page_url)
            all_images.extend(page_images)
    
    print(f"[+] 画册: {title}, 共 {len(all_images)} 张图片")
    
    save_dir = output_dir or os.path.join(SAVE_DIR, "单本下载", safe_filename(title))
    os.makedirs(save_dir, exist_ok=True)
    
    success = 0
    for idx, img_url in enumerate(all_images, 1):
        ext = os.path.splitext(urlparse(img_url).path)[1] or '.jpg'
        save_path = os.path.join(save_dir, f"{idx:03d}{ext}")
        if download_image(img_url, save_path):
            success += 1
            print(f"  下载进度: {idx}/{len(all_images)}", end='\r')
    
    print(f"\n[✓] 下载完成! 成功 {success}/{len(all_images)} 张")
    print(f"[✓] 保存位置: {os.path.abspath(save_dir)}")

if __name__ == "__main__":
    import sys
    
    if len(sys.argv) > 1:
        # 命令行参数: 下载单本
        if sys.argv[1] == 'single' and len(sys.argv) > 2:
            download_single_book(sys.argv[2])
        else:
            print("用法:")
            print("  python laohuabao_spider.py          # 全站爬取")
            print("  python laohuabao_spider.py single <URL>  # 下载单本")
            print("\n示例:")
            print("  python laohuabao_spider.py single http://www.laohuabao.com/xiaorenshu/mingzhu/ymyaq/142029350.html")
    else:
        crawl()
