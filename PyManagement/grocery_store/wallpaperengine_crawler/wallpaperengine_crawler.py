#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Wallpaper Engine Space (https://www.wallpaperengine.space/) 全站爬虫
==============================================================
  ✅ 自动通过 Vercel Security Checkpoint JS挑战 (无需手动逆向)
  ✅ 从sitemap.xml获取全部URL (~7845壁纸 + 分类 + 合集)
  ✅ 元数据: 标题/描述/SteamID/订阅数/分辨率/分类/标签
  ✅ 自动下载: 海报(webp) + 预览图 + 预览视频(mp4)
  ✅ CDN媒体无需验证，高并发下载
  ✅ 断点续爬/自动重试/进度保存

使用:
  pip install playwright requests
  playwright install chromium
  python3 wallpaperengine_crawler.py
"""

import os, re, json, time, random, hashlib
from urllib.parse import urlparse
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor, as_completed

from playwright.sync_api import sync_playwright
import requests

# ============ 配置 ============
SAVE_ROOT       = Path("wallpaperengine_space")
HTML_DIR        = SAVE_ROOT / "html"
POSTER_DIR      = SAVE_ROOT / "posters"
PREVIEW_DIR     = SAVE_ROOT / "previews"
VIDEO_DIR       = SAVE_ROOT / "videos"
DATA_FILE       = SAVE_ROOT / "wallpapers.json"
PROGRESS_FILE   = SAVE_ROOT / "progress.json"
SITEMAP_FILE    = SAVE_ROOT / "sitemap.xml"

MEDIA_WORKERS   = 12       # 媒体并发数
PAGE_DELAY      = (0.7, 2.0)
MAX_RETRIES     = 3
SAVE_EVERY      = 20       # 每爬N个保存一次并下载媒体

# ============ 初始化 ============
for d in [SAVE_ROOT, HTML_DIR, POSTER_DIR, PREVIEW_DIR, VIDEO_DIR]:
    d.mkdir(parents=True, exist_ok=True)

wallpapers = {}
visited = set()
failed_urls = []
stats = {"success":0, "failed":0, "images":0, "videos":0, "skipped":0}

def load_progress():
    global wallpapers, visited, failed_urls, stats
    if DATA_FILE.exists():
        try:
            wallpapers = json.load(open(DATA_FILE, "r", encoding="utf-8"))
            print(f"[+] 已加载 {len(wallpapers)} 条壁纸数据")
        except: wallpapers = {}
    if PROGRESS_FILE.exists():
        try:
            p = json.load(open(PROGRESS_FILE, "r", encoding="utf-8"))
            visited = set(p.get("visited", []))
            failed_urls = p.get("failed", [])
            stats.update(p.get("stats", {}))
            print(f"[+] 已访问 {len(visited)} 个URL")
        except: pass

def save_progress():
    json.dump({"visited":list(visited),"failed":failed_urls,"stats":stats},
              open(PROGRESS_FILE,"w",encoding="utf-8"), ensure_ascii=False, indent=2)
    json.dump(wallpapers, open(DATA_FILE,"w",encoding="utf-8"), ensure_ascii=False, indent=2)

def safe_fn(name, n=100):
    name = re.sub(r'[\\/*?:"<>|]', "_", name).strip()
    if len(name) > n:
        name = name[:n-9] + "_" + hashlib.md5(name.encode()).hexdigest()[:8]
    return name

def download_media(url, path, timeout=60):
    if path.exists() and path.stat().st_size > 512:
        return True
    try:
        r = requests.get(url, headers={"User-Agent":"Mozilla/5.0","Referer":"https://www.wallpaperengine.space/"},
                         stream=True, timeout=timeout)
        if r.status_code == 200:
            tmp = path.with_suffix(path.suffix+".tmp")
            with open(tmp, "wb") as f:
                for chunk in r.iter_content(131072):
                    if chunk: f.write(chunk)
            tmp.rename(path)
            return True
    except: pass
    return False

# ============ Sitemap ============
def get_sitemap():
    if SITEMAP_FILE.exists() and SITEMAP_FILE.stat().st_size > 1000000:
        return open(SITEMAP_FILE, "r", encoding="utf-8").read()
    print("[*] 下载sitemap.xml...")
    r = requests.get("https://www.wallpaperengine.space/sitemap.xml",
                     headers={"User-Agent":"Mozilla/5.0"}, timeout=120)
    SITEMAP_FILE.write_text(r.text, encoding="utf-8")
    return r.text

def parse_sitemap(xml):
    urls = list(set(re.findall(r'<loc>(https://www\.wallpaperengine\.space/[^<]+)</loc>', xml)))
    # 清理URL尾部可能的引号
    urls = [u.strip().rstrip('"').rstrip("'") for u in urls]
    wps = [u for u in urls if '/wallpaper/' in u
           and not any(x in u for x in ['/category/','/tag/','/page/'])
           and u.count('/wallpaper/') == 1
           and not u.endswith('/wallpaper')]
    cats = [u for u in urls if '/wallpaper/category/' in u]
    cols = [u for u in urls if '/collection/' in u and u.count('/collection/') == 1
            and not u.endswith('/collection')]
    print(f"[+] Sitemap解析: 壁纸{len(wps)} 分类{len(set(cats))} 合集{len(set(cols))}")
    return sorted(wps), sorted(set(cats)), sorted(set(cols))

# ============ 页面爬取 ============
def pass_vercel_check(page):
    """等待Vercel安全验证通过"""
    for i in range(25):
        time.sleep(0.7)
        t = page.title()
        if t and "Vercel" not in t and "verifying" not in t.lower():
            return True
        if i == 4:
            try: page.mouse.move(random.randint(150,800), random.randint(150,600), steps=8)
            except: pass
        if i == 9:
            try: page.mouse.click(random.randint(200,700), random.randint(200,500))
            except: pass
    return False

def crawl_wallpaper_page(page, url, retry=0):
    if url in visited: return None
    slug = url.rstrip("/").split("/")[-1]
    
    try:
        page.goto(url, wait_until="commit", timeout=40000)
        if not pass_vercel_check(page):
            if retry < MAX_RETRIES:
                time.sleep(2)
                return crawl_wallpaper_page(page, url, retry+1)
            failed_urls.append(url); visited.add(url); stats["failed"]+=1
            return None
        
        time.sleep(1)
        
        # 提取数据
        data = page.evaluate("""() => {
            const d = {url:location.href, title:document.title, metas:{}, images:[], videos:[]};
            document.querySelectorAll('meta').forEach(m => {
                const k=m.getAttribute('property')||m.getAttribute('name'), v=m.getAttribute('content');
                if(k&&v) d.metas[k]=v;
            });
            document.querySelectorAll('img[src]').forEach(img => {
                if(img.src && img.src.includes('media.wallpaperengine.space'))
                    d.images.push({src:img.src, alt:img.alt||''});
            });
            document.querySelectorAll('video').forEach(v => {
                const srcs=[];
                if(v.src) srcs.push(v.src);
                v.querySelectorAll('source').forEach(s=>{if(s.src)srcs.push(s.src)});
                if(srcs.length) d.videos.push({poster:v.poster, sources:srcs});
            });
            // 文本里的订阅数/分辨率
            const text = document.body.innerText;
            const sm = text.match(/([\\d.]+[MKk]?)\\s*(?:subscriptions|subscribers)/i);
            if(sm) d.subscriptions = sm[1];
            const rm = text.match(/(\\d{3,4}\\s*[x×]\\s*\\d{3,4})/);
            if(rm) d.resolution = rm[1].replace(/\\s/g,'').replace('×','x');
            return d;
        }""")
        
        html = page.content()
        steam_ids = list(set(re.findall(r'steamcommunity\.com/sharedfiles/filedetails/\?id=(\d+)', html)))
        steam_urls = re.findall(r'https?://steamcommunity\.com/sharedfiles/filedetails/\?id=\d+', html)
        
        # 结构化结果
        result = {
            "url": url,
            "slug": slug,
            "title": data["metas"].get("og:title", data["title"]).replace(" Wallpaper", "").strip(),
            "description": data["metas"].get("og:description"),
            "steam_ids": steam_ids,
            "steam_url": steam_urls[0] if steam_urls else None,
            "poster": data["metas"].get("og:image"),
            "preview_images": data["images"],
            "preview_videos": data["videos"],
            "subscriptions": data.get("subscriptions"),
            "resolution": data.get("resolution"),
        }
        
        # 如果og:image为空，选最大的poster
        if not result["poster"]:
            posters = [i for i in data["images"] if "/posters/" in i["src"]]
            if posters: result["poster"] = posters[0]["src"]
            elif data["images"]: result["poster"] = data["images"][0]["src"]
        
        # 保存HTML
        html_path = HTML_DIR / f"{safe_fn(slug)}.html"
        with open(html_path, "w", encoding="utf-8") as f:
            f.write(html)
        
        wallpapers[slug] = result
        visited.add(url)
        stats["success"] += 1
        
        short_title = result["title"][:45] if result["title"] else slug
        print(f"  [✓] {short_title:<45} | Steam:{result['steam_ids'][0] if result['steam_ids'] else 'N/A':<12} | {len(result['preview_images'])}图 {len(result['preview_videos'])}视频")
        return result
        
    except Exception as e:
        if retry < MAX_RETRIES:
            time.sleep(2)
            return crawl_wallpaper_page(page, url, retry+1)
        failed_urls.append(url); visited.add(url); stats["failed"]+=1
        print(f"  [X] 失败 {slug}: {e}")
        return None

def batch_download_media(slugs):
    """批量下载一批壁纸的媒体资源"""
    tasks = []
    for slug in slugs:
        wd = wallpapers.get(slug)
        if not wd: continue
        sfn = safe_fn(slug)
        
        # 海报
        if wd.get("poster") and not wd.get("local_poster"):
            ext = Path(urlparse(wd["poster"]).path).suffix or ".webp"
            p = POSTER_DIR / f"{sfn}{ext}"
            tasks.append(("poster", slug, wd["poster"], p))
        
        # 视频 (优先mp4)
        for vi, vid in enumerate(wd.get("preview_videos", [])):
            mp4_src = next((s for s in vid.get("sources",[]) if s.endswith(".mp4")), None)
            if mp4_src and not wd.get("local_videos", {}).get(str(vi)):
                p = VIDEO_DIR / f"{sfn}_{vi}.mp4"
                tasks.append(("video", slug, mp4_src, p, vi))
        
        # 额外预览图 (跳过poster)
        for ii, img in enumerate(wd.get("preview_images", [])):
            if img["src"] == wd.get("poster"): continue
            if "/posters/" in img["src"] and img["src"] != wd.get("poster"):
                ext = Path(urlparse(img["src"]).path).suffix or ".webp"
                p = PREVIEW_DIR / f"{sfn}_{ii}{ext}"
                tasks.append(("image", slug, img["src"], p, ii))
    
    if not tasks: return
    
    def do_dl(task):
        typ, slug = task[0], task[1]
        url, path = task[2], task[3]
        ok = download_media(url, path)
        return typ, slug, ok, str(path), task[4] if len(task)>4 else None
    
    with ThreadPoolExecutor(max_workers=MEDIA_WORKERS) as ex:
        futures = [ex.submit(do_dl, t) for t in tasks]
        for fut in as_completed(futures):
            try:
                typ, slug, ok, path, idx = fut.result()
                if ok:
                    if slug not in wallpapers: continue
                    if typ == "poster":
                        wallpapers[slug]["local_poster"] = path
                        stats["images"] += 1
                    elif typ == "video":
                        wallpapers[slug].setdefault("local_videos", {})[str(idx)] = path
                        stats["videos"] += 1
                    elif typ == "image":
                        wallpapers[slug].setdefault("local_images", {})[str(idx)] = path
                        stats["images"] += 1
            except: pass

# ============ 主函数 ============
def main():
    print("="*65)
    print("  Wallpaper Engine Space 全站爬虫  (https://www.wallpaperengine.space/)")
    print("="*65)
    
    load_progress()
    
    # 1. Sitemap
    print("\n[1/5] 获取Sitemap...")
    xml = get_sitemap()
    wp_urls, cat_urls, col_urls = parse_sitemap(xml)
    
    todo = [u for u in wp_urls if u not in visited]
    print(f"[+] 待爬取壁纸: {len(todo)} / 总计: {len(wp_urls)}")
    
    # 2. 启动浏览器过验证
    print("\n[2/5] 启动浏览器...")
    with sync_playwright() as p:
        browser = p.chromium.launch(
            headless=True,
            args=["--disable-blink-features=AutomationControlled",
                  "--no-sandbox", "--disable-dev-shm-usage", "--disable-gpu"])
        ctx = browser.new_context(
            user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36",
            viewport={"width":1920,"height":1080}, locale="en-US")
        ctx.add_init_script('Object.defineProperty(navigator,"webdriver",{get:()=>undefined})')
        page = ctx.new_page()
        
        # 拦截广告/统计资源加速加载
        def block_ads(route):
            if any(x in route.request.url for x in [
                'google', 'doubleclick', 'googlesyndication', 'googletagmanager',
                'google-analytics', 'gstatic', 'facebook', 'analytics', 'hotjar',
                'adservice', 'adnxs', 'amazon-adsystem'
            ]):
                try: route.abort()
                except: pass
            else:
                route.continue_()
        page.route("**/*", block_ads)
        
        print("[*] 访问首页通过Vercel验证...")
        page.goto("https://www.wallpaperengine.space/", wait_until="commit", timeout=60000)
        if pass_vercel_check(page):
            print(f"[+] 验证通过! 标题: {page.title()}")
        else:
            print("[!] 验证可能未通过，继续尝试...")
        time.sleep(2)
        
        # 3. 爬壁纸
        print(f"\n[3/5] 开始爬取 {len(todo)} 个壁纸详情页...")
        batch_slugs = []
        for i, url in enumerate(todo):
            data = crawl_wallpaper_page(page, url)
            if data: batch_slugs.append(data["slug"])
            time.sleep(random.uniform(*PAGE_DELAY))
            
            if len(batch_slugs) >= SAVE_EVERY or i == len(todo)-1:
                print(f"\n    --- 保存进度 & 下载媒体 ({i+1}/{len(todo)}) ---")
                save_progress()
                batch_download_media(batch_slugs)
                save_progress()
                print(f"    统计: 成功{stats['success']} 失败{stats['failed']} | 图片{stats['images']} 视频{stats['videos']}")
                batch_slugs = []
        
        # 4. 爬分类/合集页
        other_todo = [u for u in (cat_urls + col_urls) if u not in visited]
        if other_todo:
            print(f"\n[4/5] 爬取分类/合集页 ({len(other_todo)}个)...")
            for url in other_todo:
                try:
                    page.goto(url, wait_until="commit", timeout=30000)
                    pass_vercel_check(page)
                    time.sleep(1)
                    visited.add(url)
                    stats["success"] += 1
                    time.sleep(random.uniform(0.5, 1.5))
                except:
                    failed_urls.append(url)
                    stats["failed"] += 1
            save_progress()
        
        # 5. 重试失败
        if failed_urls:
            print(f"\n[5/5] 重试 {len(failed_urls)} 个失败URL...")
            retry_list = [u for u in failed_urls if u not in visited or True]
            failed_urls.clear()
            for url in retry_list:
                visited.discard(url)
                crawl_wallpaper_page(page, url)
                time.sleep(1)
            save_progress()
        
        browser.close()
    
    # 最终报告
    print("\n" + "="*65)
    print("  ✓ 爬取完成!")
    print("="*65)
    print(f"  壁纸数量: {len(wallpapers)}")
    print(f"  成功页面: {stats['success']}")
    print(f"  失败URL:  {len(failed_urls)}")
    print(f"  下载图片: {stats['images']}")
    print(f"  下载视频: {stats['videos']}")
    print(f"\n  保存目录: {SAVE_ROOT.absolute()}")
    print(f"  数据文件: {DATA_FILE}")
    print(f"  海报目录: {POSTER_DIR}")
    print(f"  视频目录: {VIDEO_DIR}")
    print("="*65)
    if failed_urls:
        print("提示: 重新运行脚本可断点续爬剩余失败的URL")

if __name__ == "__main__":
    main()
