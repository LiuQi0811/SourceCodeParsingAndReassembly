#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""快速提取所有壁纸链接 - 继续爬取"""
import os, re, json, requests, pickle
from urllib.parse import urljoin, urlparse
from bs4 import BeautifulSoup
from pathlib import Path

BASE = "https://fondosanimados.com"
OUT = Path("/home/user/fondosanimados/site_download")
OUT.mkdir(exist_ok=True)
HEADERS = {"User-Agent": "Mozilla/5.0 Chrome/120"}

sess = requests.Session()
sess.headers.update(HEADERS)

# 加载之前进度
progress_file = OUT / "progress.pkl"
if progress_file.exists():
    with open(progress_file, "rb") as f:
        data = pickle.load(f)
    visited = data.get("visited", set())
    wallpapers = data.get("wallpapers", [])
    all_links = data.get("all_links", set())
    print(f"Resuming: {len(visited)} pages, {len(wallpapers)} wallpapers")
else:
    visited = set()
    wallpapers = []
    all_links = set()

def get(url):
    try:
        r = sess.get(url, timeout=15)
        return r.text if r.status_code == 200 else None
    except:
        return None

def extract(html):
    if not html:
        return
    soup = BeautifulSoup(html, "html.parser")
    
    for a in soup.find_all("a", href=True):
        href = a["href"]
        full = urljoin(BASE, href)
        p = urlparse(full)
        if p.netloc == urlparse(BASE).netloc:
            path = p.path
            if path and "#" not in href and "?" not in path:
                parts = [x for x in path.split("/") if x]
                if len(parts) <= 3 and (not parts or "." not in parts[-1]):
                    all_links.add(path)
    
    for block in soup.find_all("div", class_="wv-wallpaper"):
        h2 = block.find_previous("h2")
        title = h2.get_text(strip=True) if h2 else "Unknown"
        img = block.find("img", class_="wv-preview-image")
        preview = urljoin(BASE, img["src"]) if img and img.get("src") else ""
        
        mp4_169 = mp4_916 = jpg_169 = jpg_916 = steam = ""
        dls = block.find("div", class_="wv-downloads")
        if dls:
            for a in dls.find_all("a", href=True):
                h, t = a["href"], a.get_text(strip=True)
                if "mega.nz" in h:
                    if "16:9" in t: mp4_169 = h
                    elif "9:16" in t: mp4_916 = h
                elif h.endswith(".jpg"):
                    fu = urljoin(BASE, h)
                    if "16:9" in t: jpg_169 = fu
                    elif "9:16" in t: jpg_916 = fu
                elif "steam" in h: steam = h
        
        if mp4_169 or jpg_169:
            wallpapers.append({
                "title": title, "preview": preview,
                "mp4_169": mp4_169, "mp4_916": mp4_916,
                "jpg_169": jpg_169, "jpg_916": jpg_916, "steam": steam
            })

# BFS
queue = list(all_links - visited)
if not queue:
    # 初始分类
    CATEGORIES = ["/", "/anime/", "/series-y-peliculas/", "/videojuegos/", "/coches/", 
        "/superheroes/", "/disney/", "/aesthetic/", "/bts/", "/chainsaw-man/",
        "/dragon-ball/", "/futbol/", "/genshin-impact/", "/kimetsu-no-yaiba/",
        "/naruto/", "/naturaleza/", "/one-piece/", "/paisajes/", "/rick-y-morty/",
        "/star-wars/", "/zero-two/"]
    queue = CATEGORIES

print(f"Queue: {len(queue)}, Visited: {len(visited)}")
count = 0
while queue:
    path = queue.pop(0)
    if path in visited:
        continue
    visited.add(path)
    html = get(BASE + path)
    extract(html)
    count += 1
    
    # 发现新链接加入队列
    new = [l for l in all_links if l not in visited and l not in queue]
    queue = new + queue
    
    if count % 20 == 0:
        print(f"  [{count}] Visited:{len(visited)}, Queue:{len(queue)}, WP:{len(wallpapers)}", flush=True)
        # save progress
        with open(progress_file, "wb") as f:
            pickle.dump({"visited": visited, "wallpapers": wallpapers, "all_links": all_links}, f)
    
    if count >= 500:
        break

print(f"\nFinal: {len(visited)} pages, {len(wallpapers)} wallpapers")

# Save final
with open(progress_file, "wb") as f:
    pickle.dump({"visited": visited, "wallpapers": wallpapers, "all_links": all_links}, f)

# 去重(按mp4_169链接去重)
seen = set()
unique_wp = []
for w in wallpapers:
    key = w["mp4_169"] or w["jpg_169"]
    if key and key not in seen:
        seen.add(key)
        unique_wp.append(w)
wallpapers = unique_wp
print(f"Unique wallpapers after dedup: {len(wallpapers)}")

with open(OUT / "wallpapers.json", "w", encoding="utf-8") as f:
    json.dump(wallpapers, f, ensure_ascii=False, indent=2)

# Generate scripts
print("Generating scripts...")

with open(OUT / "下载全部MEGA视频.sh", "w") as f:
    f.write("#!/bin/bash\nmkdir -p videos\ncd videos\n")
    f.write(f'echo "Total {len(wallpapers)} wallpapers"\n\n')
    idx = 0
    for w in wallpapers:
        name = re.sub(r'[<>:"/\\|?*]', '_', w["title"])[:70]
        if w["mp4_169"]:
            idx += 1
            f.write(f'echo "[{idx}] {name} (16:9)"\n')
            f.write(f'megadl --no-progress "{w["mp4_169"]}" --path "{name}_16x9.mp4"\n')
        if w["mp4_916"]:
            idx += 1
            f.write(f'echo "[{idx}] {name} (9:16)"\n')
            f.write(f'megadl --no-progress "{w["mp4_916"]}" --path "{name}_9x16.mp4"\n')
os.chmod(OUT / "下载全部MEGA视频.sh", 0o755)

# wget JPG list
jpg_urls = set()
for w in wallpapers:
    for k in ("jpg_169", "jpg_916", "preview"):
        if w[k]:
            jpg_urls.add(w[k])
with open(OUT / "jpg_urls.txt", "w") as f:
    for url in jpg_urls:
        f.write(url + "\n")

with open(OUT / "MEGA链接列表.txt", "w", encoding="utf-8") as f:
    for w in wallpapers:
        f.write(f"=== {w['title']} ===\n")
        if w["mp4_169"]: f.write(f"MP4 16:9: {w['mp4_169']}\n")
        if w["mp4_916"]: f.write(f"MP4 9:16: {w['mp4_916']}\n")
        f.write("\n")

print(f"\nDone! Output: {OUT}")
print(f"Pages: {len(visited)}, Unique wallpapers: {len(wallpapers)}")
print(f"JPG images: {len(jpg_urls)}")
