#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
测试单个壁纸下载
"""
import os
import sys
import requests
from bs4 import BeautifulSoup
from pathlib import Path

HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': '*/*',
    'Accept-Language': 'en-US,en;q=0.9',
    'Referer': 'https://livewallpapers4free.com/',
    'Range': 'bytes=0-',  # 关键: 必须带Range头才能触发文件下载!
}

session = requests.Session()
session.headers.update(HEADERS)

test_dir = Path("./test_download")
test_dir.mkdir(exist_ok=True)

# 测试页面和下载链接
test_url = 'https://livewallpapers4free.com/goku-fury-of-the-saiyan/'

print("[*] 获取页面...")
resp = session.get(test_url, timeout=20)
soup = BeautifulSoup(resp.text, 'html.parser')

# 找下载链接
dl_links = soup.find_all('a', class_=lambda c: c and 'dlm-download-link' in c)
print(f"[+] 找到 {len(dl_links)} 个下载链接:")

for i, link in enumerate(dl_links):
    href = link['href']
    text = link.get_text(strip=True)
    print(f"  {i+1}. {text}")
    print(f"     URL: {href}")
    
    # 提取文件名
    filename = text.split('(')[0].strip()
    if not filename.endswith('.mp4'):
        filename += '.mp4'
    save_path = test_dir / filename
    
    print(f"     正在下载...")
    try:
        dl_resp = session.get(href, stream=True, timeout=60, allow_redirects=True)
        print(f"     状态码: {dl_resp.status_code}")
        print(f"     Content-Type: {dl_resp.headers.get('Content-Type')}")
        print(f"     Content-Length: {dl_resp.headers.get('Content-Length')}")
        
        if dl_resp.status_code == 200 and 'video' in dl_resp.headers.get('Content-Type', ''):
            total = int(dl_resp.headers.get('Content-Length', 0))
            downloaded = 0
            
            with open(save_path, 'wb') as f:
                for chunk in dl_resp.iter_content(chunk_size=65536):
                    if chunk:
                        f.write(chunk)
                        downloaded += len(chunk)
                        if downloaded % (1024*1024) < 65536:
                            mb_down = downloaded / 1024 / 1024
                            mb_total = total / 1024 / 1024
                            print(f"\r     进度: {mb_down:.1f}MB / {mb_total:.1f}MB", end='', flush=True)
            
            print(f"\n     [完成] 保存到: {save_path}")
            print(f"     文件大小: {os.path.getsize(save_path) / 1024 / 1024:.2f} MB")
            
            # 验证文件头
            with open(save_path, 'rb') as f:
                header = f.read(32)
                if b'ftyp' in header:
                    print(f"     [验证] MP4文件头正确!")
                else:
                    print(f"     [警告] 文件头可能有问题: {header[:16].hex()}")
            
            break  # 先只下一个测试
            
    except Exception as e:
        print(f"     错误: {e}")

# 同时下载预览视频
print("\n[*] 查找预览视频...")
source = soup.find('source', src=True)
if source:
    preview_url = source['src']
    print(f"[+] 预览视频: {preview_url}")
    preview_path = test_dir / "preview.mp4"
    try:
        pv_resp = session.get(preview_url, stream=True, timeout=30)
        if pv_resp.status_code == 200:
            with open(preview_path, 'wb') as f:
                for chunk in pv_resp.iter_content(65536):
                    if chunk:
                        f.write(chunk)
            print(f"[+] 预览视频已保存: {preview_path} ({os.path.getsize(preview_path)/1024:.1f}KB)")
    except Exception as e:
        print(f"预览下载失败: {e}")

print("\n[*] 测试完成!")
