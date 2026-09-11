#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
单本小说测试脚本 - 用于快速验证爬虫是否正常工作
爬取《无职转生》前3章作为演示
"""

import requests
from bs4 import BeautifulSoup
import os
import re
import time
import random

BASE_URL = "https://www.huanmengacg.com"
SAVE_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "novels")
os.makedirs(SAVE_DIR, exist_ok=True)

def create_session():
    session = requests.Session()
    session.headers.update({
        'User-Agent': 'Mozilla/5.0 (Linux; Android 11; Pixel 5) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'zh-CN,zh;q=0.9',
    })
    return session

def clean_filename(name):
    name = re.sub(r'[\\/:*?"<>|\r\n\t]', '_', name)
    return name.strip('. ') or "未知"

def clean_content(html):
    soup = BeautifulSoup(html, 'html.parser')
    content_div = soup.find('div', id='BookText')
    if not content_div:
        content_div = soup.find('div', class_='chaptercontent')
    if not content_div:
        return None, ""
    
    title_tag = soup.find('h2')
    ch_title = title_tag.get_text(strip=True) if title_tag else "未知章节"
    
    for tag in content_div.find_all(['script', 'style', 'iframe', 'ins']):
        tag.decompose()
    
    for tag in content_div.find_all(['div', 'p', 'a']):
        text = tag.get_text(strip=True)
        if re.search(r'http|本文来自|幻梦轻小说|书源|风月|下架|APP', text):
            tag.decompose()
    
    text = content_div.get_text('\n', strip=True)
    lines = []
    for line in text.split('\n'):
        line = line.strip()
        if not line or len(line) < 2:
            continue
        if re.search(r'http|幻梦|书源|风月|------|====', line):
            continue
        lines.append(line)
    
    return ch_title, '\n\n'.join(lines)

def main():
    print("="*50)
    print("幻梦ACG爬虫测试 - 爬取《无职转生》前3章")
    print("="*50)
    
    session = create_session()
    
    # 先访问首页
    print("\n[1] 初始化会话...")
    session.get(BASE_URL, timeout=15)
    time.sleep(1)
    
    # 访问小说详情页
    book_id = "8655"
    book_url = f"{BASE_URL}/index.php/book/info/{book_id}"
    print(f"[2] 获取小说详情...")
    resp = session.get(book_url, timeout=15)
    resp.encoding = 'utf-8'
    
    soup = BeautifulSoup(resp.text, 'html.parser')
    book_title_tag = soup.find('h1')
    book_title = book_title_tag.get_text(strip=True) if book_title_tag else "无职转生"
    print(f"    书名: {book_title}")
    
    # 提取章节链接（跳过"立即阅读"按钮，取实际章节链接）
    all_links = soup.find_all('a', href=re.compile(r'/index\.php/book_read_\d+_\d+\.html'))
    chapter_links = []
    seen = set()
    for link in all_links:
        href = link.get('href', '')
        ch_title = link.get_text(strip=True)
        if href in seen:
            continue
        if ch_title == '立即阅读':
            continue
        seen.add(href)
        chapter_links.append(link)
        if len(chapter_links) >= 3:
            break
    print(f"    准备爬取前 {len(chapter_links)} 章")
    
    # 创建文件
    book_dir = os.path.join(SAVE_DIR, clean_filename(book_title))
    os.makedirs(book_dir, exist_ok=True)
    txt_path = os.path.join(book_dir, f'{clean_filename(book_title)}_测试.txt')
    
    with open(txt_path, 'w', encoding='utf-8') as f:
        f.write(f'书名：{book_title}\n')
        f.write(f'测试爬取时间：{time.strftime("%Y-%m-%d %H:%M:%S")}\n\n')
        f.write('#'*50 + '\n\n')
    
    total_words = 0
    for i, link in enumerate(chapter_links, 1):
        href = link.get('href')
        ch_title = link.get_text(strip=True)
        ch_url = BASE_URL + href if href.startswith('/') else href
        
        print(f"\n[3.{i}] 正在爬取: {ch_title}")
        time.sleep(random.uniform(1, 2))
        
        resp = session.get(ch_url, headers={'Referer': book_url}, timeout=15)
        resp.encoding = 'utf-8'
        
        title, text = clean_content(resp.text)
        word_count = len(text)
        total_words += word_count
        
        print(f"    状态: 成功, {word_count}字")
        print(f"    预览: {text[:80]}...")
        
        with open(txt_path, 'a', encoding='utf-8') as f:
            f.write(f'\n{"="*50}\n')
            f.write(f'【{ch_title}】\n')
            f.write(f'{"="*50}\n\n')
            f.write(text)
            f.write('\n')
    
    print("\n" + "="*50)
    print("测试完成!")
    print(f"共爬取 {len(chapter_links)} 章, 合计 {total_words} 字")
    print(f"文件已保存到: {txt_path}")
    print("="*50)

if __name__ == '__main__':
    main()
