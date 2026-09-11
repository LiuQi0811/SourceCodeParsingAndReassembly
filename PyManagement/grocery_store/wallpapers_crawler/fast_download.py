#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Wallpapers.com 快速下载脚本
直接从列表页提取缩略图并转换为HD链接批量下载
"""

import os
import re
import time
import requests
from bs4 import BeautifulSoup
from concurrent.futures import ThreadPoolExecutor, as_completed
from urllib.parse import urljoin

def download_batch(output_dir='wallpapers_hd', pages=3, workers=8):
    """快速批量下载"""
    os.makedirs(output_dir, exist_ok=True)
    
    session = requests.Session()
    session.headers.update({
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36',
        'Referer': 'https://wallpapers.com/',
    })
    
    # 收集所有HD图片URL
    hd_urls = []
    sections = ['wallpapers', 'backgrounds', 'pictures']
    
    for section in sections:
        print(f"正在扫描 {section} 栏目...")
        for page in range(1, pages + 1):
            if page == 1:
                url = f'https://wallpapers.com/{section}'
            else:
                url = f'https://wallpapers.com/{section}/page/{page}'
            
            try:
                time.sleep(0.3)
                r = session.get(url, timeout=30)
                soup = BeautifulSoup(r.text, 'html.parser')
                
                count = 0
                for img in soup.find_all('img'):
                    src = img.get('src', '') or img.get('data-src', '') or img.get('data-lazy-src', '')
                    if not src:
                        continue
                    if not src.startswith('http'):
                        src = urljoin('https://wallpapers.com', src)
                    if '/images/thumbnail/' in src or '/images/hd/' in src:
                        hd_url = src.replace('/thumbnail/', '/hd/')
                        filename = os.path.basename(hd_url)
                        if hd_url not in [u['url'] for u in hd_urls]:
                            hd_urls.append({
                                'url': hd_url,
                                'filename': filename,
                                'section': section
                            })
                            count += 1
                
                print(f"  第{page}页: 发现 {count} 张新图片", end='\r')
            except Exception as e:
                print(f"  第{page}页出错: {e}")
        
        print()
    
    print(f"\n总共发现 {len(hd_urls)} 张高清图片，开始下载...")
    
    # 下载函数
    def download(item):
        url = item['url']
        save_dir = os.path.join(output_dir, item['section'])
        os.makedirs(save_dir, exist_ok=True)
        path = os.path.join(save_dir, item['filename'])
        
        if os.path.exists(path):
            return 'skip'
        
        try:
            time.sleep(0.2)
            r = session.get(url, timeout=60)
            if r.status_code == 200 and len(r.content) > 5000:
                with open(path, 'wb') as f:
                    f.write(r.content)
                return 'ok'
        except:
            pass
        return 'fail'
    
    # 多线程下载
    success = 0
    skipped = 0
    failed = 0
    
    with ThreadPoolExecutor(max_workers=workers) as executor:
        futures = [executor.submit(download, item) for item in hd_urls]
        
        for i, f in enumerate(as_completed(futures)):
            result = f.result()
            if result == 'ok':
                success += 1
            elif result == 'skip':
                skipped += 1
            else:
                failed += 1
            
            if (i + 1) % 10 == 0:
                print(f"  进度: {i+1}/{len(hd_urls)} 成功:{success} 跳过:{skipped} 失败:{failed}", end='\r')
    
    print(f"\n\n下载完成!")
    print(f"  成功下载: {success}")
    print(f"  已存在跳过: {skipped}")
    print(f"  失败: {failed}")
    print(f"  保存位置: {os.path.abspath(output_dir)}")

if __name__ == '__main__':
    import argparse
    parser = argparse.ArgumentParser()
    parser.add_argument('-o', '--output', default='wallpapers_hd', help='保存目录')
    parser.add_argument('-p', '--pages', type=int, default=3, help='每个栏目下载页数')
    parser.add_argument('-w', '--workers', type=int, default=8, help='并发数')
    args = parser.parse_args()
    
    download_batch(args.output, args.pages, args.workers)
