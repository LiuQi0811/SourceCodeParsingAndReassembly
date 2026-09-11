#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""测试爬虫：只爬取前3页验证功能"""

import os
import re
import time
import random
from concurrent.futures import ThreadPoolExecutor, as_completed
from urllib.parse import urlparse
import requests
from tqdm import tqdm

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Referer": "https://www.3gbizhi.com/",
}
session = requests.Session()
session.headers.update(HEADERS)

SAVE_ROOT = "3G壁纸全站下载_测试"
os.makedirs(SAVE_ROOT, exist_ok=True)


def fetch(url):
    try:
        resp = session.get(url, timeout=20)
        resp.encoding = "utf-8"
        return resp.text if resp.status_code == 200 else None
    except:
        return None


def download(img_url, save_path):
    try:
        resp = session.get(img_url, timeout=20)
        if resp.status_code == 200 and len(resp.content) > 10000:
            with open(save_path, "wb") as f:
                f.write(resp.content)
            return True
    except:
        pass
    return False


# 测试爬取手机壁纸前3页
print("测试爬取手机壁纸前3页...")
all_images = []

for page in range(1, 4):
    if page == 1:
        url = "https://www.3gbizhi.com/wallMV/"
    else:
        url = f"https://www.3gbizhi.com/wallMV/index_{page}.html"
    
    html = fetch(url)
    if html:
        pattern = r'lay-src="(https://pic\.3gbizhi\.com/uploads/[^"]+)"[^>]*alt="([^"]*)"'
        matches = re.findall(pattern, html)
        print(f"第{page}页找到 {len(matches)} 张图片")
        for img_url, title in matches:
            title = re.sub(r'[\\/*?:"<>|]', "", title)[:50]
            all_images.append((img_url, title))
    time.sleep(0.5)

print(f"\n总共找到 {len(all_images)} 张图片，开始下载...\n")

# 下载前10张测试
success = 0
for i, (img_url, title) in enumerate(all_images[:10], 1):
    ext = ".webp"
    save_path = os.path.join(SAVE_ROOT, f"{i:02d}_{title}.webp")
    if download(img_url, save_path):
        success += 1
        print(f"[{i:02d}/10] ✓ {title}")
    else:
        print(f"[{i:02d}/10] ✗ {title}")

print(f"\n测试完成！成功下载 {success}/10 张图片")
print(f"文件保存在: {os.path.abspath(SAVE_ROOT)}")
print(f"\n文件列表:")
for f in os.listdir(SAVE_ROOT):
    size = os.path.getsize(os.path.join(SAVE_ROOT, f)) // 1024
    print(f"  {f} - {size}KB")
