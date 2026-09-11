#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
图灵社区公开信息合规爬虫
⚠️  重要声明：
1. 本爬虫仅抓取网站公开展示的图书元数据（书名、作者、定价、简介等公开可见信息）
2. 绝对不尝试抓取、破解付费电子书内容、不绕过任何版权保护措施
3. 请遵守《网络安全法》《著作权法》及网站相关规定，合理使用
4. 爬取前请确认您的行为符合网站服务条款，商用请联系图灵社区获得授权
"""

import requests
import time
import json
import csv
import random
from bs4 import BeautifulSoup
from urllib.parse import urljoin, urlparse
from collections import deque
import os

# 配置信息
BASE_URL = "https://www.ituring.com.cn"
# 请求头，模拟真实浏览器
HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
    "Accept-Language": "zh-CN,zh;q=0.8,zh-TW;q=0.7,zh-HK;q=0.5,en-US;q=0.3,en;q=0.2",
    "Accept-Encoding": "gzip, deflate, br",
    "Connection": "keep-alive",
}
# 请求间隔（秒），避免给服务器造成压力
REQUEST_DELAY = (2, 5)  # 随机延迟2-5秒
# 输出目录
OUTPUT_DIR = "turing_public_data"
# 已访问URL集合
visited_urls = set()
# 待爬取队列
url_queue = deque()
# 爬取到的图书数据
books_data = []

def init_dir():
    """初始化输出目录"""
    if not os.path.exists(OUTPUT_DIR):
        os.makedirs(OUTPUT_DIR)
        os.makedirs(os.path.join(OUTPUT_DIR, "covers"))
    print(f"[+] 输出目录初始化完成: {OUTPUT_DIR}")

def random_delay():
    """随机延迟，模拟人类访问行为"""
    delay = random.uniform(*REQUEST_DELAY)
    time.sleep(delay)

def fetch_page(url):
    """获取页面内容"""
    try:
        response = requests.get(url, headers=HEADERS, timeout=15)
        response.encoding = "utf-8"
        if response.status_code == 200:
            return response.text
        elif response.status_code == 404:
            print(f"[!] 页面不存在: {url}")
            return None
        else:
            print(f"[!] 请求失败 {url}, 状态码: {response.status_code}")
            return None
    except Exception as e:
        print(f"[!] 请求异常 {url}: {str(e)}")
        return None

def parse_book_list(html):
    """解析图书列表页，提取图书详情页链接"""
    soup = BeautifulSoup(html, "html.parser")
    book_links = []
    
    # 查找图书卡片链接（根据实际页面结构调整）
    for a_tag in soup.find_all("a", href=True):
        href = a_tag["href"]
        if "/book/" in href:
            full_url = urljoin(BASE_URL, href)
            if full_url not in visited_urls and full_url not in url_queue:
                book_links.append(full_url)
    
    return book_links

def parse_book_detail(html, url):
    """解析图书详情页，提取公开元数据"""
    soup = BeautifulSoup(html, "html.parser")
    book_info = {
        "url": url,
        "title": "",
        "subtitle": "",
        "authors": [],
        "translators": [],
        "isbn": "",
        "price": "",
        "ebook_price": "",
        "publish_date": "",
        "pages": "",
        "publisher": "人民邮电出版社",  # 图灵图书默认出版社
        "category": "",
        "summary": "",
        "cover_url": "",
        "rating": "",
    }
    
    # 提取书名
    title_tag = soup.find("h1") or soup.find("h2", class_="book-title")
    if title_tag:
        book_info["title"] = title_tag.get_text(strip=True)
    
    # 提取封面
    cover_tag = soup.find("img", class_="book-cover") or soup.find("div", class_="cover").find("img") if soup.find("div", class_="cover") else None
    if cover_tag and cover_tag.get("src"):
        book_info["cover_url"] = urljoin(BASE_URL, cover_tag["src"])
    
    # 提取基本信息
    info_div = soup.find("div", class_="book-info") or soup.find("ul", class_="book-meta")
    if info_div:
        text = info_div.get_text()
        # 简单提取规则，可根据实际页面调整
        if "作者" in text:
            authors = text.split("作者：")[-1].split("\n")[0].strip()
            book_info["authors"] = [a.strip() for a in authors.replace("等", "").split("、") if a.strip()]
        if "译者" in text:
            translators = text.split("译者：")[-1].split("\n")[0].strip()
            book_info["translators"] = [t.strip() for t in translators.replace("等", "").split("、") if t.strip()]
        if "ISBN" in text:
            book_info["isbn"] = text.split("ISBN：")[-1].split("\n")[0].strip()
        if "定价" in text:
            book_info["price"] = text.split("定价：")[-1].split("\n")[0].strip()
        if "出版日期" in text:
            book_info["publish_date"] = text.split("出版日期：")[-1].split("\n")[0].strip()
        if "页数" in text:
            book_info["pages"] = text.split("页数：")[-1].split("\n")[0].strip()
    
    # 提取内容简介
    summary_div = soup.find("div", class_="book-summary") or soup.find("div", id="summary")
    if summary_div:
        book_info["summary"] = summary_div.get_text(strip=True)[:500]  # 只保留前500字
    
    return book_info

def download_cover(cover_url, book_title):
    """下载图书封面（公开可访问的图片资源）"""
    if not cover_url:
        return
    try:
        safe_title = "".join([c for c in book_title if c.isalnum() or c in (" ", "-", "_")]).rstrip()
        if not safe_title:
            safe_title = f"book_{int(time.time())}"
        save_path = os.path.join(OUTPUT_DIR, "covers", f"{safe_title}.jpg")
        
        response = requests.get(cover_url, headers=HEADERS, timeout=15)
        if response.status_code == 200:
            with open(save_path, "wb") as f:
                f.write(response.content)
            print(f"[+] 封面下载完成: {safe_title}")
    except Exception as e:
        print(f"[!] 封面下载失败 {book_title}: {str(e)}")

def save_data():
    """保存爬取到的数据"""
    # 保存为JSON
    json_path = os.path.join(OUTPUT_DIR, "books_public_info.json")
    with open(json_path, "w", encoding="utf-8") as f:
        json.dump(books_data, f, ensure_ascii=False, indent=2)
    
    # 保存为CSV
    csv_path = os.path.join(OUTPUT_DIR, "books_public_info.csv")
    if books_data:
        keys = books_data[0].keys()
        with open(csv_path, "w", encoding="utf-8-sig", newline="") as f:
            dict_writer = csv.DictWriter(f, fieldnames=keys)
            dict_writer.writeheader()
            dict_writer.writerows(books_data)
    
    print(f"\n[✓] 数据已保存:")
    print(f"    JSON: {json_path}")
    print(f"    CSV: {csv_path}")
    print(f"    共爬取公开图书信息: {len(books_data)} 条")

def main():
    print("=" * 60)
    print("图灵社区公开信息合规爬虫")
    print("⚠️  本爬虫仅抓取公开元数据，不涉及任何付费内容破解")
    print("=" * 60)
    
    init_dir()
    
    # 从图书分类页开始爬取
    start_urls = [
        urljoin(BASE_URL, "/book"),
        urljoin(BASE_URL, "/books"),
    ]
    
    for url in start_urls:
        if url not in visited_urls:
            url_queue.append(url)
    
    max_books = 100  # 限制最多爬取100本图书做演示，可自行调整
    book_count = 0
    
    while url_queue and book_count < max_books:
        current_url = url_queue.popleft()
        
        if current_url in visited_urls:
            continue
        
        parsed = urlparse(current_url)
        if parsed.netloc != urlparse(BASE_URL).netloc:
            continue  # 只爬取本站点
        
        print(f"\n[*] 正在爬取: {current_url}")
        visited_urls.add(current_url)
        
        html = fetch_page(current_url)
        if not html:
            random_delay()
            continue
        
        # 判断是列表页还是详情页
        if "/book/" in current_url and current_url.split("/book/")[-1].isdigit():
            # 图书详情页
            book_info = parse_book_detail(html, current_url)
            if book_info["title"]:
                books_data.append(book_info)
                book_count += 1
                print(f"[+] 已获取图书信息: {book_info['title']}")
                if book_info["cover_url"]:
                    download_cover(book_info["cover_url"], book_info["title"])
        else:
            # 列表页，提取更多链接
            new_links = parse_book_list(html)
            for link in new_links:
                if link not in visited_urls and link not in url_queue:
                    url_queue.append(link)
            print(f"[+] 发现 {len(new_links)} 个新链接")
        
        random_delay()
    
    save_data()
    print("\n[!] 爬取完成，请遵守版权规定合理使用数据！")
    print("[!] 如需获取完整图书内容，请通过官方渠道购买正版：")
    print("    官网：https://www.ituring.com.cn/")

if __name__ == "__main__":
    main()
