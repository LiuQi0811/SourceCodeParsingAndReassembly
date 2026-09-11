#!/usr/bin/env python3
# -*- coding: utf-8 -*-
import os, re, json, time, requests
from urllib.parse import urljoin, urlparse
from bs4 import BeautifulSoup
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor, as_completed

BASE = "https://fondosanimados.com"
OUT = Path("/home/user/fondosanimados/site_download")
HEADERS = {"User-Agent": "Mozilla/5.0 Chrome/120 Safari/537.36"}
OUT.mkdir(exist_ok=True)

sess = requests.Session()
sess.headers.update(HEADERS)

# 所有已知分类入口
CATEGORIES = [
    "/", "/anime/", "/series-y-peliculas/", "/videojuegos/", "/coches/", 
    "/superheroes/", "/disney/", "/aesthetic/", "/bts/", "/chainsaw-man/",
    "/dragon-ball/", "/futbol/", "/genshin-impact/", "/kimetsu-no-yaiba/",
    "/naruto/", "/naturaleza/", "/one-piece/", "/paisajes/", "/rick-y-morty/",
    "/star-wars/", "/zero-two/"
]

visited = set()
wallpapers = []
jpg_urls = set()
all_links = set()

def get(url):
    try:
        r = sess.get(url, timeout=20)
        return r.text if r.status_code == 200 else None
    except Exception as e:
        return None

def dl(url):
    try:
        path = urlparse(url).path.lstrip("/")
        if not path:
            return
        local = OUT / path
        if local.exists():
            return
        local.parent.mkdir(parents=True, exist_ok=True)
        r = sess.get(url, timeout=20)
        if r.status_code == 200:
            with open(local, "wb") as f:
                f.write(r.content)
    except:
        pass

def parse(html, page_url):
    if not html:
        return
    soup = BeautifulSoup(html, "html.parser")
    
    # 子分类链接
    for a in soup.find_all("a", href=True):
        href = a["href"]
        if href.startswith("http"):
            if "fondosanimados.com" not in href:
                continue
        full = urljoin(BASE, href)
        p = urlparse(full)
        if p.netloc == urlparse(BASE).netloc:
            ext = Path(p.path).suffix.lower()
            if ext in ("", ".html") or "." not in p.path.split("/")[-1]:
                depth = len([x for x in p.path.split("/") if x])
                if depth <= 3 and p.path not in visited:
                    all_links.add(p.path)
    
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
                    jpg_urls.add(fu)
                elif "steam" in h: steam = h
        
        if mp4_169 or jpg_169:
            wallpapers.append({
                "title": title, "preview": preview,
                "mp4_169": mp4_169, "mp4_916": mp4_916,
                "jpg_169": jpg_169, "jpg_916": jpg_916, "steam": steam
            })
        if preview:
            jpg_urls.add(preview)

print("=== 第一阶段：爬取所有分类页面 ===")
queue = [BASE + c for c in CATEGORIES]
for url in queue:
    path = urlparse(url).path
    if path in visited:
        continue
    visited.add(path)
    print(f"  爬取: {url}")
    html = get(url)
    parse(html, url)
    time.sleep(0.1)

print(f"\n发现额外链接: {len(all_links)}")
new_links = all_links - visited
print(f"新链接待爬: {len(new_links)}")

# 爬取新发现的链接
for path in list(new_links):
    if path in visited:
        continue
    visited.add(path)
    url = BASE + path
    print(f"  爬取: {path}")
    html = get(url)
    parse(html, url)
    time.sleep(0.1)

print(f"\n=== 总计发现 {len(wallpapers)} 个壁纸 ===")

# 下载图片
print(f"\n=== 下载 {len(jpg_urls)} 张图片 ===")
with ThreadPoolExecutor(max_workers=10) as ex:
    futures = [ex.submit(dl, url) for url in jpg_urls]
    done = 0
    for f in as_completed(futures):
        done += 1
        if done % 50 == 0:
            print(f"  进度: {done}/{len(jpg_urls)}")

# 保存结果
with open(OUT / "wallpapers.json", "w", encoding="utf-8") as f:
    json.dump(wallpapers, f, ensure_ascii=False, indent=2)

# 视频下载脚本
with open(OUT / "下载全部视频.sh", "w") as f:
    f.write("#!/bin/bash\nmkdir -p videos\ncd videos\n")
    total = sum(1 for w in wallpapers if w["mp4_169"] or w["mp4_916"])
    f.write(f'echo "共 {total} 个视频文件"\n')
    idx = 0
    for w in wallpapers:
        name = re.sub(r'[<>:"/\\|?*]', '_', w["title"])[:70]
        if w["mp4_169"]:
            idx += 1
            f.write(f'echo "[{idx}/{total*2}] {name} 16:9"\n')
            f.write(f'megadl "{w["mp4_169"]}" --path "{name}_16x9.mp4" 2>/dev/null || echo fail\n')
        if w["mp4_916"]:
            idx += 1
            f.write(f'echo "[{idx}/{total*2}] {name} 9:16"\n')
            f.write(f'megadl "{w["mp4_916"]}" --path "{name}_9x16.mp4" 2>/dev/null || echo fail\n')
os.chmod(OUT / "下载全部视频.sh", 0o755)

# 视频链接列表
with open(OUT / "MEGA视频链接.txt", "w", encoding="utf-8") as f:
    for w in wallpapers:
        f.write(f"=== {w['title']} ===\n")
        if w["mp4_169"]: f.write(f"16:9: {w['mp4_169']}\n")
        if w["mp4_916"]: f.write(f"9:16: {w['mp4_916']}\n")
        f.write("\n")

img_count = sum(len(list(OUT.rglob(ext))) for ext in ("*.jpg","*.jpeg","*.webp","*.png"))
print(f"\n=== 完成 ===")
print(f"页面爬取: {len(visited)} 个")
print(f"壁纸总数: {len(wallpapers)} 个")
print(f"MEGA视频链接: {sum(1 for w in wallpapers if w['mp4_169'])} x 16:9 + {sum(1 for w in wallpapers if w['mp4_916'])} x 9:16")
print(f"已下载图片: {img_count} 张")
print(f"输出目录: {OUT}")
