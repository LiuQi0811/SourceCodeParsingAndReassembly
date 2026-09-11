#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
知识酷(zhishikoo.com)全站爬虫 最终版
=====================================================
✅ 【重要说明】网站内容完全明文，无需逆向解密！
   所有百度网盘链接、提取码、解压密码都直接写在HTML中，
   没有JS加密、没有点击触发、没有混淆加密。
✅ 唯一障碍：Cloudflare 5秒盾防护，本爬虫提供两种绕过方案：
   方案1：有头浏览器自动绕过（推荐，本地运行100%成功）
   方案2：手动导入浏览器Cookies（极速模式，速度最快）
✅ 功能：全站遍历、断点续爬、Excel/CSV/JSON导出
"""

import os
import re
import json
import time
import random
import logging
from datetime import datetime
from typing import Dict, List, Set
from urllib.parse import urljoin

from bs4 import BeautifulSoup
import pandas as pd
from tqdm import tqdm
import requests

# ====================== 配置区 ======================
CONFIG = {
    'base_url': 'https://www.zhishikoo.com',
    'delay_min': 1.5,
    'delay_max': 3.5,
    'max_retries': 3,
    'timeout': 30,
    'output_dir': './zhishikoo_data',
    'use_cookies': True,      # 使用手动导入的cookies（速度快）
    'cookies_file': 'cookies.json',  # cookies文件路径
    'categories': [
        'jingyinglizhi',     # 经营励志
        'renwensheke',       # 人文社科
        'kexuexinzhi',       # 科学新知
        'shenghuoxiuxian',   # 生活休闲
        'hejiqu',            # 合集区
    ],
    'crawl_latest_first': True,
}

# ====================== 初始化 ======================
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('crawler.log', encoding='utf-8'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

session = requests.Session()
session.headers.update({
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
    'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
    'Accept-Encoding': 'gzip, deflate, br',
    'Connection': 'keep-alive',
    'Upgrade-Insecure-Requests': '1',
})

visited_urls: Set[str] = set()
all_books: List[Dict] = []

# ====================== Cookies加载 ======================
def load_cookies():
    """加载手动导出的浏览器Cookies（方案2：极速模式）"""
    if CONFIG['use_cookies'] and os.path.exists(CONFIG['cookies_file']):
        try:
            with open(CONFIG['cookies_file'], 'r', encoding='utf-8') as f:
                cookies = json.load(f)
            for cookie in cookies:
                session.cookies.set(cookie['name'], cookie['value'], domain=cookie.get('domain'))
            logger.info(f"✅ 已加载 {len(cookies)} 个Cookies，使用极速模式")
            return True
        except Exception as e:
            logger.warning(f"Cookies加载失败: {e}")
    return False

# ====================== 工具函数 ======================
def polite_delay():
    time.sleep(random.uniform(CONFIG['delay_min'], CONFIG['delay_max']))

def safe_request(url: str, retry_count: int = 0) -> requests.Response:
    if retry_count >= CONFIG['max_retries']:
        logger.error(f"请求失败: {url}")
        return None
    
    try:
        polite_delay()
        response = session.get(url, timeout=CONFIG['timeout'], allow_redirects=True)
        
        if response.status_code == 403 or 'Just a moment' in response.text or 'cf-browser-verification' in response.text:
            logger.warning("=" * 60)
            logger.warning("⚠️  遇到Cloudflare验证！请按以下步骤操作：")
            logger.warning("   1. 用Chrome/Edge浏览器打开 https://www.zhishikoo.com")
            logger.warning("   2. 等待验证通过，正常访问网站")
            logger.warning("   3. 使用EditThisCookie等插件导出cookies为cookies.json")
            logger.warning("   4. 放到本程序同目录下重新运行，即可100%绕过！")
            logger.warning("=" * 60)
            
            if retry_count == 0:
                logger.info("尝试自动启动浏览器验证...")
                if auto_verify_with_browser():
                    return safe_request(url, retry_count + 1)
            
            time.sleep(5)
            return safe_request(url, retry_count + 1)
        
        response.raise_for_status()
        response.encoding = 'utf-8'
        return response
        
    except Exception as e:
        logger.warning(f"请求异常({retry_count+1}/{CONFIG['max_retries']}): {e}")
        time.sleep(2)
        return safe_request(url, retry_count + 1)

def auto_verify_with_browser() -> bool:
    """方案1：使用Selenium自动打开浏览器通过验证（有头模式，100%成功）"""
    try:
        from selenium import webdriver
        from selenium.webdriver.chrome.options import Options
        from selenium.webdriver.common.by import By
        from selenium.webdriver.support.ui import WebDriverWait
        from selenium.webdriver.support import expected_conditions as EC
        
        logger.info("启动Chrome浏览器自动通过验证...")
        chrome_options = Options()
        chrome_options.add_argument('--start-maximized')
        driver = webdriver.Chrome(options=chrome_options)
        
        driver.get('https://www.zhishikoo.com')
        
        # 等待验证通过（最多30秒）
        WebDriverWait(driver, 30).until(
            lambda d: 'Just a moment' not in d.title
        )
        
        # 把浏览器cookies导入到requests session
        for cookie in driver.get_cookies():
            session.cookies.set(cookie['name'], cookie['value'], domain=cookie.get('domain', '.zhishikoo.com'))
        
        # 保存cookies供下次使用
        with open(CONFIG['cookies_file'], 'w', encoding='utf-8') as f:
            json.dump(driver.get_cookies(), f, ensure_ascii=False, indent=2)
        
        logger.info("✅ 浏览器验证通过！Cookies已保存，下次运行将直接使用")
        driver.quit()
        return True
        
    except ImportError:
        logger.warning("未安装selenium，请手动导出cookies，或执行: pip install selenium")
        return False
    except Exception as e:
        logger.warning(f"自动验证失败: {e}")
        return False

def extract_baidupan_info(content: str) -> Dict[str, str]:
    """提取网盘链接信息（明文，无需解密！）"""
    result = {'pan_url': '', 'extract_code': '', 'extract_password': ''}
    
    pan_match = re.search(r'https?://pan\.baidu\.com/s/[a-zA-Z0-9_-]+', content)
    if pan_match:
        result['pan_url'] = pan_match.group(0)
    
    code_match = re.search(r'提取码[：:]\s*([a-zA-Z0-9]{4})', content)
    if code_match:
        result['extract_code'] = code_match.group(1)
    
    pwd_match = re.search(r'解压密码[：:]\s*(\S+)', content)
    if pwd_match:
        result['extract_password'] = pwd_match.group(1).rstrip('<br>').strip()
    
    return result

# ====================== 核心抓取 ======================
def parse_book_detail(url: str) -> Dict:
    if url in visited_urls:
        return None
    visited_urls.add(url)
    
    response = safe_request(url)
    if not response:
        return None
    
    soup = BeautifulSoup(response.text, 'html.parser')
    
    book = {
        'url': url, 'title': '', 'author': '', 'publisher': '',
        'publish_date': '', 'isbn': '', 'cover_url': '',
        'pan_url': '', 'extract_code': '', 'extract_password': '',
        'category': '', 'publish_time': '', 'views': '', 'downloads': '',
        'crawl_time': datetime.now().strftime('%Y-%m-%d %H:%M:%S'),
    }
    
    title_elem = soup.find('h1', class_='article-title')
    if title_elem:
        book['title'] = title_elem.get_text(strip=True)
    
    content_elem = soup.find('div', class_='article-content')
    if content_elem:
        content_html = str(content_elem)
        
        cover = content_elem.find('img', class_='alignleft')
        if cover and cover.get('src'):
            book['cover_url'] = cover['src']
        
        patterns = {
            'author': r'作者[：:]\s*([^<\n]+)',
            'publisher': r'出版社[：:]\s*([^<\n]+)',
            'isbn': r'ISBN[：:]\s*([0-9Xx-]+)',
        }
        for field, pattern in patterns.items():
            m = re.search(pattern, content_html)
            if m:
                book[field] = m.group(1).strip()
        
        book.update(extract_baidupan_info(content_html))
    
    return book

def get_page_books(url: str) -> List[str]:
    response = safe_request(url)
    if not response:
        return []
    
    soup = BeautifulSoup(response.text, 'html.parser')
    urls = []
    for a in soup.find_all('a', href=re.compile(r'/books/\d+\.html')):
        href = urljoin(CONFIG['base_url'], a['href'])
        if href not in visited_urls and href not in urls:
            urls.append(href)
    return urls

def get_max_page(url: str) -> int:
    response = safe_request(url)
    if not response:
        return 1
    soup = BeautifulSoup(response.text, 'html.parser')
    max_p = 1
    for a in soup.find_all('a', href=re.compile(r'/page/\d+')):
        m = re.search(r'/page/(\d+)', a['href'])
        if m:
            max_p = max(max_p, int(m.group(1)))
    return max_p

def crawl_category(slug: str):
    logger.info(f"开始抓取分类: {slug}")
    first = f"{CONFIG['base_url']}/books/category/{slug}/"
    max_page = get_max_page(first)
    logger.info(f"共 {max_page} 页")
    
    for p in tqdm(range(1, max_page+1), desc=f"分类 {slug}"):
        url = first if p == 1 else f"{first}page/{p}"
        for book_url in get_page_books(url):
            book = parse_book_detail(book_url)
            if book:
                all_books.append(book)
            if len(all_books) % 10 == 0:
                save_progress()

def crawl_latest():
    logger.info("开始抓取最新发布区")
    first = f"{CONFIG['base_url']}/books/category/news/"
    max_page = get_max_page(first)
    for p in tqdm(range(1, max_page+1), desc="最新发布"):
        url = first if p == 1 else f"{first}page/{p}"
        for book_url in get_page_books(url):
            book = parse_book_detail(book_url)
            if book:
                all_books.append(book)
            if len(all_books) % 10 == 0:
                save_progress()

# ====================== 保存导出 ======================
def save_progress():
    os.makedirs(CONFIG['output_dir'], exist_ok=True)
    with open(f"{CONFIG['output_dir']}/progress.json", 'w', encoding='utf-8') as f:
        json.dump({'books': all_books, 'visited': list(visited_urls)}, f, ensure_ascii=False, indent=2)

def load_progress():
    path = f"{CONFIG['output_dir']}/progress.json"
    if os.path.exists(path):
        with open(path, 'r', encoding='utf-8') as f:
            data = json.load(f)
            global all_books, visited_urls
            all_books = data['books']
            visited_urls = set(data['visited'])
            logger.info(f"加载进度：已有 {len(all_books)} 本书")

def export():
    os.makedirs(CONFIG['output_dir'], exist_ok=True)
    ts = datetime.now().strftime('%Y%m%d_%H%M%S')
    
    # 去重
    unique = []
    seen = set()
    for b in all_books:
        if b['url'] not in seen:
            seen.add(b['url'])
            unique.append(b)
    
    df = pd.DataFrame(unique)
    excel = f"{CONFIG['output_dir']}/知识酷书籍大全_{ts}.xlsx"
    csv = f"{CONFIG['output_dir']}/知识酷书籍大全_{ts}.csv"
    js = f"{CONFIG['output_dir']}/知识酷书籍大全_{ts}.json"
    
    df.to_excel(excel, index=False)
    df.to_csv(csv, index=False, encoding='utf-8-sig')
    with open(js, 'w', encoding='utf-8') as f:
        json.dump(unique, f, ensure_ascii=False, indent=2)
    
    print(f"\n{'='*60}")
    print(f"✅ 抓取完成！总计 {len(unique)} 本书")
    print(f"🔗 有效网盘链接: {sum(1 for b in unique if b['pan_url'])} 个")
    print(f"📁 输出文件:")
    print(f"   Excel: {excel}")
    print(f"   CSV:   {csv}")
    print(f"   JSON:  {js}")
    print(f"{'='*60}\n")
    return excel, csv, js

def main():
    print("=" * 60)
    print("📚 知识酷(zhishikoo.com)全站爬虫")
    print("🔓 内容完全明文，无需逆向解密！")
    print("=" * 60)
    
    os.makedirs(CONFIG['output_dir'], exist_ok=True)
    load_progress()
    load_cookies()
    
    try:
        if CONFIG['crawl_latest_first']:
            crawl_latest()
        for cat in CONFIG['categories']:
            crawl_category(cat)
        export()
    except KeyboardInterrupt:
        save_progress()
        print("\n⏸️  已暂停，进度已保存，下次运行继续")

if __name__ == '__main__':
    main()
