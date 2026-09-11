#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Labubu Live Wallpaper 全站抓取器
站点: https://labubulivewallpaper.com/

逆向分析说明:
  - 该站点为 Vue 3 + Vite 构建的纯静态 SPA (Cloudflare Pages 托管)
  - 所有壁纸数据以硬编码数组形式内嵌在主 JS bundle 中
  - 无加密、无混淆、无API签名校验，直接正则提取即可
  - 图片CDN: imgs.labubulivewallpaper.com (Cloudflare R2 + 图片处理)
  - 共 217 张壁纸 (192静态 + 24动态动态)，覆盖手机/平板/桌面
  - 动态壁纸下载格式为 HEIC (苹果Live Photo)，同时提供JPG预览
"""

import os
import re
import json
import time
import argparse
import logging
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor, as_completed
from urllib.parse import urljoin, urlparse

import requests

# ============================================================
# 常量
# ============================================================
BASE_URL = "https://labubulivewallpaper.com"
HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
                  "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Accept": "*/*",
    "Accept-Language": "en-US,en;q=0.9,zh-CN;q=0.8",
    "Referer": BASE_URL + "/",
}
LANG_ROUTES = ["", "/zh", "/ja", "/de", "/es", "/fr", "/ru"]

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s", datefmt="%H:%M:%S")
log = logging.getLogger("labubu_scraper")


def safe_filename(url: str) -> str:
    path = urlparse(url).path
    name = os.path.basename(path)
    if "cdn-cgi/image" in path:
        name = path.split("/")[-1]
    return name


def get_ext(url: str) -> str:
    name = safe_filename(url)
    ext = os.path.splitext(name)[1].lower()
    return ext if ext else ".bin"


def download_file(url: str, save_path: Path, retries: int = 3, timeout: int = 60) -> bool:
    save_path.parent.mkdir(parents=True, exist_ok=True)
    if save_path.exists() and save_path.stat().st_size > 0:
        return True
    for attempt in range(1, retries + 1):
        try:
            resp = requests.get(url, headers=HEADERS, timeout=timeout, stream=True)
            resp.raise_for_status()
            tmp = save_path.with_suffix(save_path.suffix + ".tmp")
            with open(tmp, "wb") as f:
                for chunk in resp.iter_content(chunk_size=8192):
                    if chunk:
                        f.write(chunk)
            tmp.replace(save_path)
            size_kb = save_path.stat().st_size / 1024
            log.info(f"OK: {save_path.name} ({size_kb:.1f} KB)")
            return True
        except Exception as e:
            log.warning(f"重试 ({attempt}/{retries}) {url}: {e}")
            if attempt < retries:
                time.sleep(2 * attempt)
    log.error(f"失败: {url}")
    return False


def fetch_homepage(out: Path) -> dict:
    log.info("获取首页 HTML ...")
    resp = requests.get(BASE_URL, headers=HEADERS, timeout=30)
    resp.raise_for_status()
    html = resp.text
    pages_dir = out / "site_pages"
    pages_dir.mkdir(parents=True, exist_ok=True)
    (pages_dir / "index.html").write_text(html, encoding="utf-8")

    js_files = re.findall(r'src="(/assets/[^"]+\.js)"', html)
    css_files = re.findall(r'href="(/assets/[^"]+\.css)"', html)
    favicon = re.findall(r'href="(/favicon\.ico)"', html)
    og_image = re.findall(r'property="og:image" content="([^"]+)"', html)
    log.info(f"JS: {js_files}, CSS: {css_files}")
    return {"html": html, "js_files": js_files, "css_files": css_files,
            "favicon": favicon[0] if favicon else "/favicon.ico",
            "og_image": og_image[0] if og_image else None}


def extract_wallpapers(js_url: str, out: Path):
    log.info(f"解析 JS bundle: {js_url}")
    resp = requests.get(js_url, headers=HEADERS, timeout=30)
    resp.raise_for_status()
    js = resp.text

    assets_dir = out / "site_pages" / "assets"
    assets_dir.mkdir(parents=True, exist_ok=True)
    js_name = os.path.basename(urlparse(js_url).path)
    (assets_dir / js_name).write_text(js, encoding="utf-8")
    log.info(f"JS大小: {len(js)/1024:.1f} KB")

    # 提取壁纸对象
    # 实际字段: id, thumbnail, preview, downloadUrl, category, deviceType, resolution, fileSize
    pattern = (
        r'\{id:"(\d+)"'
        r',thumbnail:"([^"]+)"'
        r',preview:"([^"]+)"'
        r',downloadUrl:"([^"]+)"'
        r',category:"([^"]+)"'
        r',deviceType:"([^"]+)"'
        r',resolution:"([^"]+)"'
        r',fileSize:"([^"]+)"'
        r'\}'
    )
    matches = re.findall(pattern, js)
    wallpapers, seen = [], set()
    for m in matches:
        if m[0] in seen:
            continue
        seen.add(m[0])
        wallpapers.append({
            "id": m[0], "thumbnail": m[1], "preview": m[2], "downloadUrl": m[3],
            "category": m[4], "deviceType": m[5], "resolution": m[6], "fileSize": m[7],
        })

    videos = list(set(re.findall(r'"(https://imgs\.labubulivewallpaper\.com/[^"]+\.(?:mp4|mov|webm))"', js)))
    log.info(f"壁纸: {len(wallpapers)} 张, 视频: {len(videos)} 个")
    stats = {}
    for wp in wallpapers:
        k = f"{wp['category']}_{wp['deviceType']}"
        stats[k] = stats.get(k, 0) + 1
    for k, v in sorted(stats.items()):
        log.info(f"  {k}: {v}")

    meta = {"total": len(wallpapers), "videos": videos, "wallpapers": wallpapers,
            "extracted_at": time.strftime("%Y-%m-%d %H:%M:%S")}
    (out / "wallpapers_metadata.json").write_text(json.dumps(meta, indent=2, ensure_ascii=False), encoding="utf-8")
    return wallpapers, videos


def download_all(wallpapers, videos, resources, out: Path, max_workers=8, download_heic=True, download_thumbs=False):
    tasks = []
    wp_dir = out / "wallpapers"
    for wp in wallpapers:
        url = wp["downloadUrl"]
        fname = safe_filename(url)
        ext = get_ext(url)
        sub = wp_dir / wp["category"] / wp["deviceType"]
        if ext == ".heic" and not download_heic:
            url = wp["preview"]
            fname = safe_filename(url)
            ext = get_ext(url)
        save_path = sub / f"{wp['id'].zfill(3)}_{fname}"
        tasks.append((url, save_path))
        if ext == ".heic" and download_heic:
            prev_url = wp["preview"]
            prev_name = safe_filename(prev_url)
            prev_path = sub / f"{wp['id'].zfill(3)}_{os.path.splitext(fname)[0]}_preview.jpg"
            tasks.append((prev_url, prev_path))

    if download_thumbs:
        tdir = out / "thumbnails"
        for wp in wallpapers:
            u = wp["thumbnail"]
            fn = safe_filename(u)
            sp = tdir / f"{wp['id'].zfill(3)}_{fn}"
            if not sp.suffix:
                sp = sp.with_suffix(".webp")
            tasks.append((u, sp))

    vdir = out / "videos"
    for vu in videos:
        tasks.append((vu, vdir / safe_filename(vu)))

    assets_dir = out / "site_pages" / "assets"
    for css in resources["css_files"]:
        tasks.append((urljoin(BASE_URL, css), assets_dir / os.path.basename(urlparse(css).path)))
    tasks.append((urljoin(BASE_URL, resources["favicon"]), assets_dir / "favicon.ico"))
    if resources["og_image"]:
        ogu = urljoin(BASE_URL, resources["og_image"])
        tasks.append((ogu, out / "site_pages" / safe_filename(ogu)))

    pages_dir = out / "site_pages"
    for lang in LANG_ROUTES:
        pu = BASE_URL + (lang if lang else "/")
        pp = pages_dir / (f"index{lang.replace('/', '_')}.html" if lang else "index.html")
        if not pp.exists():
            try:
                r = requests.get(pu, headers=HEADERS, timeout=20)
                pp.write_text(r.text, encoding="utf-8")
                log.info(f"页面: {pu}")
            except Exception as e:
                log.warning(f"页面失败 {pu}: {e}")

    for extra in ["/robots.txt", "/sitemap.xml", "/llms.txt"]:
        try:
            r = requests.get(BASE_URL + extra, headers=HEADERS, timeout=15)
            if r.status_code == 200:
                (pages_dir / extra.lstrip("/")).write_text(r.text, encoding="utf-8")
        except:
            pass

    log.info(f"待下载: {len(tasks)} 个文件 (并发:{max_workers})")
    ok, fail = 0, 0
    with ThreadPoolExecutor(max_workers=max_workers) as ex:
        futs = {ex.submit(download_file, u, p): (u, p) for u, p in tasks}
        for i, fut in enumerate(as_completed(futs), 1):
            try:
                if fut.result():
                    ok += 1
                else:
                    fail += 1
            except Exception as e:
                log.error(f"异常: {e}")
                fail += 1
            if i % 20 == 0 or i == len(tasks):
                log.info(f"进度: {i}/{len(tasks)} (成功:{ok} 失败:{fail})")
    log.info(f"下载完成! 成功:{ok} 失败:{fail}")
    return ok, fail


def generate_index(wallpapers, out: Path):
    log.info("生成索引页面 ...")
    groups = {
        "all": wallpapers,
        "static_phone": [w for w in wallpapers if w["category"]=="static" and w["deviceType"]=="phone"],
        "dynamic_phone": [w for w in wallpapers if w["category"]=="dynamic" and w["deviceType"]=="phone"],
        "tablet": [w for w in wallpapers if w["deviceType"]=="tablet"],
        "desktop": [w for w in wallpapers if w["deviceType"]=="desktop"],
    }

    def cards(wps):
        rows = []
        for w in wps:
            fn = safe_filename(w["downloadUrl"])
            ext = get_ext(w["downloadUrl"])
            sub = f"{w['category']}/{w['deviceType']}"
            lp = f"wallpapers/{sub}/{w['id'].zfill(3)}_{fn}"
            lt = (f"wallpapers/{sub}/{w['id'].zfill(3)}_{os.path.splitext(fn)[0]}_preview.jpg"
                  if ext == ".heic" else lp)
            rows.append(f'''<div class="card"><img loading="lazy" src="{lt}"/><div class="info">
<span class="id">#{w['id']}</span><span class="tag {w['category']}">{w['category']}</span>
<span class="tag">{w['deviceType']}</span><span class="res">{w['resolution']}</span>
<a href="{lp}" download class="dl">下载</a></div></div>''')
        return "\n".join(rows)

    sections = "\n".join(
        f'<div id="{k}" class="section {"active" if k=="all" else ""}"><div class="grid">{cards(v)}</div></div>'
        for k, v in groups.items()
    )
    btns = "\n".join(
        f'<button class="btn {"active" if k=="all" else ""}" onclick="show(\'{k}\',this)">'
        f'{k.replace("_"," ")} ({len(v)})</button>'
        for k, v in groups.items()
    )

    html = f"""<!DOCTYPE html><html lang="zh-CN"><head><meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>Labubu Live Wallpaper 本地合集</title>
<style>*{{margin:0;padding:0;box-sizing:border-box}}body{{font-family:-apple-system,system-ui,sans-serif;background:#1a1a2e;color:#eee}}
header{{text-align:center;padding:40px 20px;background:linear-gradient(135deg,#667eea,#764ba2)}}
h1{{font-size:2em;margin-bottom:8px}}.stats{{display:flex;justify-content:center;gap:30px;margin-top:20px;flex-wrap:wrap}}
.stat{{text-align:center}}.stat .n{{font-size:2em;font-weight:bold}}
.tabs{{display:flex;justify-content:center;gap:10px;padding:20px;flex-wrap:wrap;position:sticky;top:0;background:#1a1a2e;z-index:10}}
.btn{{padding:10px 24px;border:2px solid #667eea;background:0;color:#eee;border-radius:25px;cursor:pointer;font-size:.95em;transition:.3s}}
.btn.active,.btn:hover{{background:#667eea}}
.grid{{display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:16px;padding:20px;max-width:1400px;margin:0 auto}}
.card{{background:#16213e;border-radius:12px;overflow:hidden;transition:.3s}}
.card:hover{{transform:translateY(-4px);box-shadow:0 8px 25px rgba(102,126,234,.3)}}
.card img{{width:100%;height:300px;object-fit:cover;display:block}}
.info{{padding:10px;display:flex;flex-wrap:wrap;gap:6px;align-items:center;font-size:.8em}}
.id{{font-weight:bold;color:#667eea}}.tag{{background:#667eea33;padding:2px 8px;border-radius:4px}}
.tag.dynamic{{background:#f7258533;color:#f72585}}.tag.static{{background:#4cc9f033;color:#4cc9f0}}
.res{{color:#aaa;margin-left:auto}}.dl{{background:#667eea;color:#fff;padding:4px 12px;border-radius:4px;text-decoration:none}}
.dl:hover{{background:#764ba2}}.section{{display:none}}.section.active{{display:block}}
footer{{text-align:center;padding:30px;color:#666;font-size:.85em}}</style></head><body>
<header><h1>🧸 Labubu Live Wallpaper 合集</h1><p>从 labubulivewallpaper.com 抓取的全部壁纸</p>
<div class="stats">{''.join(f'<div class="stat"><div class="n">{len(v)}</div><div>{k.replace("_"," ")}</div></div>' for k,v in groups.items())}</div></header>
<div class="tabs">{btns}</div>{sections}
<footer>数据来源: https://labubulivewallpaper.com/ | 仅供个人学习使用，壁纸版权归原作者所有</footer>
<script>function show(id,b){{document.querySelectorAll('.section').forEach(s=>s.classList.remove('active'));document.querySelectorAll('.btn').forEach(x=>x.classList.remove('active'));document.getElementById(id).classList.add('active');b.classList.add('active')}}</script>
</body></html>"""
    idx = out / "index.html"
    idx.write_text(html, encoding="utf-8")
    log.info(f"索引已生成: {idx}")


def main():
    ap = argparse.ArgumentParser(description="Labubu Live Wallpaper 全站抓取器")
    ap.add_argument("-o", "--output", default="labubulivewallpaper_download", help="输出目录")
    ap.add_argument("-w", "--workers", type=int, default=8, help="并发下载数")
    ap.add_argument("--no-heic", action="store_true", help="跳过HEIC格式，用JPG代替")
    ap.add_argument("--thumbnails", action="store_true", help="同时下载缩略图")
    ap.add_argument("--list-only", action="store_true", help="仅列出壁纸，不下载")
    args = ap.parse_args()

    out = Path(args.output)
    out.mkdir(parents=True, exist_ok=True)

    log.info("=" * 60)
    log.info("Labubu Live Wallpaper 全站抓取器")
    log.info(f"目标: {BASE_URL}")
    log.info(f"输出: {out.resolve()}")
    log.info("=" * 60)

    resources = fetch_homepage(out)
    js_url = urljoin(BASE_URL, resources["js_files"][0]) if resources["js_files"] else None
    if not js_url:
        log.error("未找到主JS文件!")
        return
    wallpapers, videos = extract_wallpapers(js_url, out)

    if args.list_only:
        print(f"\n{'ID':>4} {'分类':>8} {'设备':>8} {'分辨率':>10}  文件名")
        print("-" * 70)
        for wp in wallpapers:
            fn = safe_filename(wp["downloadUrl"])
            print(f"{wp['id']:>4} {wp['category']:>8} {wp['deviceType']:>8} {wp['resolution']:>10}  {fn}")
        print(f"\n视频: {videos}")
        print(f"总计: {len(wallpapers)} 张壁纸")
        return

    download_all(wallpapers, videos, resources, out,
                 max_workers=args.workers,
                 download_heic=not args.no_heic,
                 download_thumbs=args.thumbnails)
    generate_index(wallpapers, out)

    total = sum(f.stat().st_size for f in out.rglob("*") if f.is_file())
    log.info("=" * 60)
    log.info(f"全部完成! 总大小: {total/1024/1024:.1f} MB")
    log.info(f"打开 {out/'index.html'} 浏览壁纸")
    log.info("=" * 60)


if __name__ == "__main__":
    main()
