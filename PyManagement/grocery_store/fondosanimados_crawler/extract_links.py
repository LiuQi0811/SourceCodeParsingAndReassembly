#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""快速提取所有壁纸链接"""
import os, re, json, requests
from urllib.parse import urljoin, urlparse
from bs4 import BeautifulSoup
from pathlib import Path

BASE = "https://fondosanimados.com"
OUT = Path("/home/user/fondosanimados/site_download")
OUT.mkdir(exist_ok=True)
HEADERS = {"User-Agent": "Mozilla/5.0 Chrome/120"}

sess = requests.Session()
sess.headers.update(HEADERS)

# 已知分类
CATEGORIES = [
    "/", "/anime/", "/series-y-peliculas/", "/videojuegos/", "/coches/", 
    "/superheroes/", "/disney/", "/aesthetic/", "/bts/", "/chainsaw-man/",
    "/dragon-ball/", "/futbol/", "/genshin-impact/", "/kimetsu-no-yaiba/",
    "/naruto/", "/naturaleza/", "/one-piece/", "/paisajes/", "/rick-y-morty/",
    "/star-wars/", "/zero-two/"
]

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
    
    # 子分类/角色链接
    for a in soup.find_all("a", href=True):
        href = a["href"]
        full = urljoin(BASE, href)
        p = urlparse(full)
        if p.netloc == urlparse(BASE).netloc:
            path = p.path
            if path and "#" not in href:
                depth = len([x for x in path.split("/") if x])
                if depth <= 3 and "." not in path.split("/")[-1]:
                    all_links.add(path)
    
    # 壁纸
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

print("Phase 1: Fetching main categories...")
for cat in CATEGORIES:
    url = BASE + cat
    if cat in visited:
        continue
    visited.add(cat)
    print(f"  {cat}", flush=True)
    html = get(url)
    extract(html)

print(f"\nFound {len(all_links)} sub-links, fetching...")
for path in list(all_links):
    if path in visited:
        continue
    visited.add(path)
    url = BASE + path
    html = get(url)
    extract(html)

# Check again for deeper links
new_links = all_links - visited
print(f"Found {len(new_links)} more links")
for path in list(new_links):
    if path in visited:
        continue
    visited.add(path)
    url = BASE + path
    html = get(url)
    extract(html)

print(f"\nTotal pages: {len(visited)}")
print(f"Total wallpapers: {len(wallpapers)}")

# Save JSON
with open(OUT / "wallpapers.json", "w", encoding="utf-8") as f:
    json.dump(wallpapers, f, ensure_ascii=False, indent=2)

# Generate download scripts
print("Generating download scripts...")

# MEGA video download script
with open(OUT / "下载全部MEGA视频.sh", "w") as f:
    f.write("#!/bin/bash\nmkdir -p videos\ncd videos\n")
    total = sum(1 for w in wallpapers if w["mp4_169"] or w["mp4_916"])
    f.write(f'echo "Starting download of {total} wallpapers..."\n\n')
    idx = 0
    for w in wallpapers:
        name = re.sub(r'[<>:"/\\|?*]', '_', w["title"])[:70]
        if w["mp4_169"]:
            idx += 1
            f.write(f'echo "[{idx}] {name} (16:9)"\n')
            f.write(f'megadl --no-progress "{w["mp4_169"]}" --path "{name}_16x9.mp4" 2>/dev/null\n')
        if w["mp4_916"]:
            idx += 1
            f.write(f'echo "[{idx}] {name} (9:16)"\n')
            f.write(f'megadl --no-progress "{w["mp4_916"]}" --path "{name}_9x16.mp4" 2>/dev/null\n')
os.chmod(OUT / "下载全部MEGA视频.sh", 0o755)

# JPG download script
with open(OUT / "下载全部JPG图片.sh", "w") as f:
    f.write("#!/bin/bash\nmkdir -p uploads\ncd ..\n")
    jpg_urls = set()
    for w in wallpapers:
        if w["jpg_169"]: jpg_urls.add(w["jpg_169"])
        if w["jpg_916"]: jpg_urls.add(w["jpg_916"])
        if w["preview"]: jpg_urls.add(w["preview"])
    f.write(f'echo "Downloading {len(jpg_urls)} images..."\n')
    for url in jpg_urls:
        path = urlparse(url).path
        f.write(f'mkdir -p "$(dirname .{path})"\n')
        f.write(f'wget -q -nc "{url}" -O ".{path}" 2>/dev/null\n')
os.chmod(OUT / "下载全部JPG图片.sh", 0o755)

# Text list
with open(OUT / "MEGA视频链接.txt", "w", encoding="utf-8") as f:
    for w in wallpapers:
        f.write(f"=== {w['title']} ===\n")
        if w["mp4_169"]: f.write(f"16:9 MP4: {w['mp4_169']}\n")
        if w["mp4_916"]: f.write(f"9:16 MP4: {w['mp4_916']}\n")
        if w["jpg_169"]: f.write(f"16:9 JPG: {w['jpg_169']}\n")
        if w["jpg_916"]: f.write(f"9:16 JPG: {w['jpg_916']}\n")
        f.write("\n")

# HTML index
with open(OUT / "资源索引.html", "w", encoding="utf-8") as f:
    f.write("""<!DOCTYPE html><html><head><meta charset="UTF-8"><title>FondosAnimados 资源索引</title>
<style>
body{font-family:Arial;max-width:1200px;margin:0 auto;padding:20px;background:#f0f2f5}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:15px}
.card{background:#fff;border-radius:10px;padding:15px;box-shadow:0 2px 8px rgba(0,0,0,.1)}
.card img{width:100%;height:160px;object-fit:cover;border-radius:6px}
.card h3{margin:8px 0;font-size:14px}
.btn{display:inline-block;padding:4px 10px;margin:2px;font-size:12px;color:#fff;text-decoration:none;border-radius:4px}
.btn-mp4{background:#E53238}.btn-jpg{background:#2196F3}
.stats{background:#fff;padding:20px;border-radius:10px;margin:20px 0}
</style></head><body>
<h1>FondosAnimados.com 全站爬取结果</h1>
<div class="stats">
<h2>统计</h2>
<ul>""")
    f.write(f"<li>爬取页面数: {len(visited)}</li>")
    f.write(f"<li>壁纸总数: {len(wallpapers)}</li>")
    f.write(f"<li>16:9 MP4视频: {sum(1 for w in wallpapers if w['mp4_169'])}</li>")
    f.write(f"<li>9:16 MP4视频: {sum(1 for w in wallpapers if w['mp4_916'])}</li>")
    f.write("</ul>")
    f.write('<p><a href="下载全部MEGA视频.sh" class="btn btn-mp4">下载所有MP4视频</a> ')
    f.write('<a href="下载全部JPG图片.sh" class="btn btn-jpg">下载所有JPG图片</a></p></div>')
    f.write('<h2>壁纸列表</h2><div class="grid">')
    for w in wallpapers:
        f.write(f'<div class="card">')
        if w["preview"]:
            f.write(f'<img src="{w["preview"]}" loading="lazy">')
        f.write(f'<h3>{w["title"]}</h3>')
        if w["mp4_169"]:
            f.write(f'<a href="{w["mp4_169"]}" target="_blank" class="btn btn-mp4">MP4 16:9</a>')
        if w["mp4_916"]:
            f.write(f'<a href="{w["mp4_916"]}" target="_blank" class="btn btn-mp4">MP4 9:16</a>')
        if w["jpg_169"]:
            f.write(f'<a href="{w["jpg_169"]}" target="_blank" class="btn btn-jpg">JPG 16:9</a>')
        f.write('</div>')
    f.write("</div></body></html>")

print(f"\nDone! Output in: {OUT}")
print(f"Wallpapers: {len(wallpapers)}")
