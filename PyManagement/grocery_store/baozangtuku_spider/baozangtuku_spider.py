#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
宝藏图库全站爬虫 - baozangtuku.com
功能：自动抓取全站4K高清壁纸，无需解密，直接下载原图
作者：AI助手
版本：1.0
"""

import os
import re
import time
import random
import requests
from bs4 import BeautifulSoup
from urllib.parse import urljoin, urlparse
from concurrent.futures import ThreadPoolExecutor, as_completed
import threading
from tqdm import tqdm

# 配置
BASE_URL = "https://www.baozangtuku.com"
# 分类列表 - 根据网站实际分类
CATEGORIES = {
    "dongman": "动漫壁纸",
    "youxi": "游戏壁纸",
    "meinv": "美女壁纸",
    "fengjing": "风景壁纸",
    "yingshi": "影视壁纸",
    "qita": "其他壁纸",
    "shouji": "手机壁纸",
}

# 请求头 - 模拟浏览器
HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Referer": BASE_URL,
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
    "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
}

# 下载配置
SAVE_DIR = "宝藏图库"
MAX_WORKERS = 5  # 并发下载线程数
MAX_PAGES = 0  # 0表示抓取所有页，>0表示限制最大页数
TIMEOUT = 30
RETRY_COUNT = 3
DELAY_MIN = 0.5  # 最小延迟秒数
DELAY_MAX = 1.5  # 最大延迟秒数

# 线程锁
lock = threading.Lock()
session = requests.Session()
session.headers.update(HEADERS)


def safe_filename(name):
    """清理文件名中的非法字符"""
    name = re.sub(r'[\\/*?:"<>|]', "", name)
    name = name.replace(" ", "_")
    return name[:100]  # 限制文件名长度


def get_soup(url):
    """获取页面BeautifulSoup对象"""
    for i in range(RETRY_COUNT):
        try:
            time.sleep(random.uniform(DELAY_MIN, DELAY_MAX))
            response = session.get(url, timeout=TIMEOUT)
            response.encoding = response.apparent_encoding or "utf-8"
            if response.status_code == 200:
                return BeautifulSoup(response.text, "html.parser")
            else:
                print(f"状态码{response.status_code}: {url}")
        except Exception as e:
            if i == RETRY_COUNT - 1:
                print(f"请求失败 {url}: {e}")
            time.sleep(2)
    return None


def download_image(img_url, save_path):
    """下载单张图片"""
    if os.path.exists(save_path):
        if os.path.getsize(save_path) > 10000:  # 文件大于10KB认为已下载
            return True
    
    for i in range(RETRY_COUNT):
        try:
            time.sleep(random.uniform(DELAY_MIN, DELAY_MAX))
            response = session.get(img_url, timeout=TIMEOUT, stream=True)
            if response.status_code == 200:
                os.makedirs(os.path.dirname(save_path), exist_ok=True)
                with open(save_path, "wb") as f:
                    for chunk in response.iter_content(chunk_size=8192):
                        f.write(chunk)
                return True
        except Exception as e:
            if i == RETRY_COUNT - 1:
                with lock:
                    print(f"下载失败 {img_url}: {e}")
            time.sleep(1)
    return False


def get_total_pages(category):
    """获取分类总页数"""
    # 先尝试第一页
    url = f"{BASE_URL}/{category}/"
    soup = get_soup(url)
    if not soup:
        return 1
    
    # 查找分页信息
    page_text = soup.find(text=re.compile(r'页'))
    if page_text:
        match = re.search(r'共.*?(\d+).*?页', page_text)
        if match:
            return int(match.group(1))
    
    # 查找尾页链接
    last_page = soup.find("a", text="尾页") or soup.find("a", text="末页")
    if last_page and last_page.get("href"):
        match = re.search(r'index_(\d+)\.html', last_page["href"])
        if match:
            return int(match.group(1))
    
    # 查找分页中的最大数字
    page_links = soup.find_all("a", href=re.compile(r'index_\d+\.html'))
    max_page = 1
    for link in page_links:
        match = re.search(r'index_(\d+)\.html', link["href"])
        if match:
            page_num = int(match.group(1))
            max_page = max(max_page, page_num)
    
    # 检查第2页是否存在
    page2_url = f"{BASE_URL}/{category}/index_2.html"
    soup2 = get_soup(page2_url)
    if soup2:
        # 尝试第100页来判断规模
        return max(max_page, 10)  # 默认至少10页，实际会自动判断结束
    
    return max_page


def get_list_page(category, page_num):
    """获取列表页的所有详情页链接"""
    if page_num == 1:
        url = f"{BASE_URL}/{category}/"
    else:
        url = f"{BASE_URL}/{category}/index_{page_num}.html"
    
    soup = get_soup(url)
    if not soup:
        return []
    
    detail_links = []
    # 查找所有详情页链接 - 帝国CMS格式通常是 /xxx/数字.html
    links = soup.find_all("a", href=re.compile(rf'/{category}/\d+\.html'))
    seen = set()
    for link in links:
        href = link.get("href", "")
        if href not in seen and re.search(rf'/{category}/\d+\.html', href):
            seen.add(href)
            full_url = urljoin(BASE_URL, href)
            title = link.get("title") or link.text.strip()
            if title:
                detail_links.append((full_url, title))
    
    return detail_links


def get_detail_page(url, category_name):
    """从详情页提取原图URL"""
    soup = get_soup(url)
    if not soup:
        return None, None
    
    # 获取标题
    title_tag = soup.find("h1")
    title = title_tag.text.strip() if title_tag else "unknown"
    title = safe_filename(title)
    
    # 查找所有图片 - 提取带small前缀的缩略图
    img_urls = []
    images = soup.find_all("img", src=re.compile(r'/d/file/p/.*?small.*?\.(jpg|jpeg|png|webp)'))
    
    for img in images:
        src = img.get("src", "")
        if not src:
            continue
        # 去掉small前缀得到原图URL!
        original_src = src.replace("small", "")
        full_url = urljoin(BASE_URL, original_src)
        img_urls.append(full_url)
    
    # 如果没找到带small的，尝试找d/file/p/下的其他图片
    if not img_urls:
        images = soup.find_all("img", src=re.compile(r'/d/file/p/.*?\.(jpg|jpeg|png|webp)'))
        for img in images:
            src = img.get("src", "")
            if "small" not in src and "logo" not in src and "ad" not in src:
                full_url = urljoin(BASE_URL, src)
                img_urls.append(full_url)
    
    return title, img_urls


def process_category(category, category_name):
    """处理单个分类"""
    print(f"\n{'='*60}")
    print(f"开始抓取分类: {category_name} ({category})")
    print(f"{'='*60}")
    
    # 创建分类目录
    category_dir = os.path.join(SAVE_DIR, category_name)
    os.makedirs(category_dir, exist_ok=True)
    
    # 获取总页数
    total_pages = get_total_pages(category)
    if MAX_PAGES > 0:
        total_pages = min(total_pages, MAX_PAGES)
    print(f"检测到总页数: {total_pages}")
    
    all_tasks = []
    total_images = 0
    
    # 遍历每一页
    for page_num in range(1, total_pages + 1):
        print(f"\r正在扫描列表页: {page_num}/{total_pages}", end="", flush=True)
        
        detail_links = get_list_page(category, page_num)
        if not detail_links and page_num > 1:
            # 如果页面为空，可能已经到最后一页
            print(f"\n第{page_num}页无内容，结束本分类抓取")
            break
        
        # 处理每个详情页
        for detail_url, link_title in detail_links:
            title, img_urls = get_detail_page(detail_url, category_name)
            if not img_urls:
                continue
            
            if not title:
                title = safe_filename(link_title)
            
            # 为每张壁纸创建单独文件夹
            wallpaper_dir = os.path.join(category_dir, title)
            os.makedirs(wallpaper_dir, exist_ok=True)
            
            for idx, img_url in enumerate(img_urls):
                ext = os.path.splitext(urlparse(img_url).path)[1] or ".jpg"
                save_name = f"{title}_{idx+1}{ext}"
                save_path = os.path.join(wallpaper_dir, save_name)
                all_tasks.append((img_url, save_path))
                total_images += 1
    
    print(f"\n{category_name} 分类共发现 {total_images} 张壁纸")
    
    # 多线程下载
    success_count = 0
    failed_count = 0
    
    with ThreadPoolExecutor(max_workers=MAX_WORKERS) as executor:
        futures = {executor.submit(download_image, url, path): (url, path) for url, path in all_tasks}
        
        with tqdm(total=len(all_tasks), desc=f"下载{category_name}") as pbar:
            for future in as_completed(futures):
                result = future.result()
                if result:
                    success_count += 1
                else:
                    failed_count += 1
                pbar.update(1)
    
    print(f"{category_name} 下载完成: 成功{success_count}张, 失败{failed_count}张")
    return success_count, failed_count


def main():
    """主函数"""
    print("="*60)
    print("宝藏图库全站爬虫 v1.0")
    print("目标网站: https://www.baozangtuku.com")
    print("="*60)
    
    total_success = 0
    total_failed = 0
    
    start_time = time.time()
    
    for category, category_name in CATEGORIES.items():
        success, failed = process_category(category, category_name)
        total_success += success
        total_failed += failed
    
    elapsed = time.time() - start_time
    
    print("\n" + "="*60)
    print("全站抓取完成!")
    print(f"总计: 成功{total_success}张, 失败{total_failed}张")
    print(f"耗时: {elapsed/60:.1f}分钟")
    print(f"文件保存在: {os.path.abspath(SAVE_DIR)}")
    print("="*60)


if __name__ == "__main__":
    main()
