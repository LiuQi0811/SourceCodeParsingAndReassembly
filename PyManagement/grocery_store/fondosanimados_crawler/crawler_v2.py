#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
FondosAnimados.com 全站爬虫 (优化版)
快速收集所有壁纸链接和图片，支持断点续传
"""

import os
import re
import sys
import json
import time
import requests
from urllib.parse import urljoin, urlparse
from bs4 import BeautifulSoup
from pathlib import Path

# 配置
BASE_URL = "https://fondosanimados.com"
OUTPUT_DIR = Path("/home/user/fondosanimados/site_download")
HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36",
}
TIMEOUT = 15
DELAY = 0.1

OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
(OUTPUT_DIR / "html").mkdir(exist_ok=True)
(OUTPUT_DIR / "uploads").mkdir(exist_ok=True)

session = requests.Session()
session.headers.update(HEADERS)

visited = set()
to_visit = set([BASE_URL])
all_wallpapers = []
all_jpg_urls = set()
all_categories = set()


def sanitize_path(url_path):
    if url_path in ("", "/"):
        return "index.html"
    url_path = url_path.strip("/")
    if "." not in url_path.split("/")[-1]:
        return url_path + "/index.html"
    return url_path


def fetch(url):
    try:
        r = session.get(url, timeout=TIMEOUT)
        return r.text if r.status_code == 200 else None
    except:
        return None


def download_image(url, subdir=""):
    try:
        path = urlparse(url).path
        local_path = OUTPUT_DIR / path.lstrip("/")
        if local_path.exists():
            return True
        local_path.parent.mkdir(parents=True, exist_ok=True)
        r = session.get(url, timeout=TIMEOUT)
        if r.status_code == 200:
            with open(local_path, "wb") as f:
                f.write(r.content)
            return True
    except:
        pass
    return False


def parse_page(url, html):
    soup = BeautifulSoup(html, "html.parser")
    wallpapers_found = 0
    
    # 保存HTML
    rel_path = sanitize_path(urlparse(url).path)
    html_path = OUTPUT_DIR / "html" / rel_path
    html_path.parent.mkdir(parents=True, exist_ok=True)
    with open(html_path, "w", encoding="utf-8") as f:
        f.write(html)
    
    # 提取内部链接
    for a in soup.find_all("a", href=True):
        href = a["href"]
        if href.startswith("#") or href.startswith("javascript:"):
            continue
        full = urljoin(BASE_URL, href)
        p = urlparse(full)
        if p.netloc == urlparse(BASE_URL).netloc and p.path not in visited:
            # 只爬取文章/分类路径，排除静态资源
            ext = Path(p.path).suffix.lower()
            if ext in ("", ".html", ".htm") or "." not in p.path.split("/")[-1]:
                to_visit.add(full)
                all_categories.add(p.path)
    
    # 提取壁纸块
    for block in soup.find_all("div", class_="wv-wallpaper"):
        title_tag = block.find_previous("h2")
        title = title_tag.get_text(strip=True) if title_tag else "Unknown"
        
        preview_img = block.find("img", class_="wv-preview-image")
        preview_url = urljoin(BASE_URL, preview_img["src"]) if preview_img and preview_img.get("src") else ""
        
        # 下载预览图(webp)
        if preview_url:
            download_image(preview_url)
        
        downloads = block.find("div", class_="wv-downloads")
        mp4_169 = ""
        mp4_916 = ""
        jpg_169 = ""
        jpg_916 = ""
        steam = ""
        
        if downloads:
            for a in downloads.find_all("a", href=True):
                href = a["href"]
                text = a.get_text(strip=True)
                if "mega.nz" in href:
                    if "16:9" in text:
                        mp4_169 = href
                    elif "9:16" in text:
                        mp4_916 = href
                elif href.endswith(".jpg"):
                    full_jpg = urljoin(BASE_URL, href)
                    if "16:9" in text:
                        jpg_169 = full_jpg
                    elif "9:16" in text:
                        jpg_916 = full_jpg
                    all_jpg_urls.add(full_jpg)
                elif "steamcommunity" in href:
                    steam = href
        
        if mp4_169 or mp4_916 or jpg_169:
            all_wallpapers.append({
                "title": title,
                "preview": preview_url,
                "mp4_169": mp4_169,
                "mp4_916": mp4_916,
                "jpg_169": jpg_169,
                "jpg_916": jpg_916,
                "steam": steam,
                "page": url
            })
            wallpapers_found += 1
    
    return wallpapers_found


def main():
    print("FondosAnimados 爬虫启动...")
    page_count = 0
    total_wp = 0
    
    while to_visit:
        url = to_visit.pop()
        if url in visited:
            continue
        visited.add(url)
        
        html = fetch(url)
        if not html:
            continue
        
        wp_count = parse_page(url, html)
        total_wp += wp_count
        page_count += 1
        
        if page_count % 5 == 0:
            print(f"[{page_count}页] 已发现 {total_wp} 个壁纸, {len(all_jpg_urls)} 张JPG, 队列: {len(to_visit)}")
        
        time.sleep(DELAY)
    
    print(f"\n爬取完成! 共 {page_count} 页, {total_wp} 个壁纸")
    
    # 下载所有JPG
    print(f"\n开始下载 {len(all_jpg_urls)} 张JPG图片...")
    for i, url in enumerate(all_jpg_urls, 1):
        download_image(url)
        if i % 20 == 0:
            print(f"  下载进度: {i}/{len(all_jpg_urls)}")
    
    print("JPG下载完成!")
    
    # 保存JSON
    with open(OUTPUT_DIR / "wallpapers.json", "w", encoding="utf-8") as f:
        json.dump(all_wallpapers, f, ensure_ascii=False, indent=2)
    
    # 生成MEGA下载脚本
    with open(OUTPUT_DIR / "下载全部MEGA视频.sh", "w", encoding="utf-8") as f:
        f.write("#!/bin/bash\n")
        f.write(f"cd \"{OUTPUT_DIR}/videos\"\n")
        f.write("mkdir -p videos\n")
        f.write(f"TOTAL={len([w for w in all_wallpapers if w['mp4_169'] or w['mp4_916']])}\n")
        f.write("echo \"开始下载MEGA视频，共 $TOTAL 个壁纸\"\n\n")
        
        idx = 0
        for w in all_wallpapers:
            safe = re.sub(r'[<>:"/\\|?*]', '_', w['title'])[:80]
            if w['mp4_169']:
                idx += 1
                f.write(f"echo \"[{idx}/$TOTAL] {safe} (16:9)\"\n")
                f.write(f"megadl \"{w['mp4_169']}\" --path \"./{safe}_16x9.mp4\" 2>/dev/null || echo \"  失败\"\n")
            if w['mp4_916']:
                idx += 1
                f.write(f"echo \"[{idx}/$TOTAL] {safe} (9:16)\"\n")
                f.write(f"megadl \"{w['mp4_916']}\" --path \"./{safe}_9x16.mp4\" 2>/dev/null || echo \"  失败\"\n")
    
    os.chmod(OUTPUT_DIR / "下载全部MEGA视频.sh", 0o755)
    
    # 保存MEGA链接列表
    with open(OUTPUT_DIR / "MEGA视频链接.txt", "w", encoding="utf-8") as f:
        for w in all_wallpapers:
            f.write(f"=== {w['title']} ===\n")
            if w['mp4_169']:
                f.write(f"16:9: {w['mp4_169']}\n")
            if w['mp4_916']:
                f.write(f"9:16: {w['mp4_916']}\n")
            f.write("\n")
    
    # 统计
    img_count = 0
    for ext in ("*.jpg", "*.jpeg", "*.webp", "*.png"):
        img_count += len(list(OUTPUT_DIR.rglob(ext)))
    
    print(f"\n=== 最终统计 ===")
    print(f"爬取页面: {page_count}")
    print(f"壁纸总数: {len(all_wallpapers)}")
    print(f"MEGA视频链接: {sum(1 for w in all_wallpapers if w['mp4_169'] or w['mp4_916'])}")
    print(f"已下载图片: {img_count}")
    print(f"输出目录: {OUTPUT_DIR}")


if __name__ == "__main__":
    main()
