#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
FondosAnimados.com 全站爬虫
- 爬取所有页面HTML
- 下载所有JPG/WebP预览图到本地
- 提取所有MEGA网盘MP4下载链接
- 生成下载清单
- 支持断点续传、去重
"""

import os
import re
import sys
import json
import time
import hashlib
import requests
import subprocess
from urllib.parse import urljoin, urlparse
from bs4 import BeautifulSoup
from pathlib import Path
from tqdm import tqdm
from concurrent.futures import ThreadPoolExecutor, as_completed

# 配置
BASE_URL = "https://fondosanimados.com"
OUTPUT_DIR = Path("/home/user/fondosanimados/site_download")
HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "es-ES,es;q=0.9,en;q=0.8",
}
MAX_WORKERS = 8  # 并发下载数
TIMEOUT = 30

# 初始化目录
(OUTPUT_DIR / "html").mkdir(parents=True, exist_ok=True)
(OUTPUT_DIR / "images").mkdir(parents=True, exist_ok=True)
(OUTPUT_DIR / "assets").mkdir(parents=True, exist_ok=True)
(OUTPUT_DIR / "videos").mkdir(parents=True, exist_ok=True)

# 全局状态
visited_urls = set()
all_mega_links = []
all_internal_links = set()
failed_downloads = []


def safe_filename(name):
    """生成安全的文件名"""
    name = re.sub(r'[<>:"/\\|?*]', '_', name)
    name = name.strip('. ').strip()
    return name[:100] if len(name) > 100 else name


def sanitize_path(url_path):
    """将URL路径转换为本地文件路径"""
    if url_path == "/" or url_path == "":
        return "index.html"
    url_path = url_path.strip("/")
    if "." not in url_path.split("/")[-1]:
        return url_path + "/index.html"
    return url_path


def download_file(url, local_path, desc=None):
    """下载单个文件，支持断点续传"""
    local_path = Path(local_path)
    local_path.parent.mkdir(parents=True, exist_ok=True)
    
    # 已存在且大小>0则跳过
    if local_path.exists() and local_path.stat().st_size > 0:
        return True
    
    try:
        # 尝试断点续传
        headers = HEADERS.copy()
        existing_size = local_path.stat().st_size if local_path.exists() else 0
        if existing_size > 0:
            headers["Range"] = f"bytes={existing_size}-"
        
        resp = requests.get(url, headers=headers, stream=True, timeout=TIMEOUT)
        if resp.status_code == 416:  # Range not satisfiable，文件已完整
            return True
        if resp.status_code not in (200, 206):
            failed_downloads.append((url, f"HTTP {resp.status_code}"))
            return False
        
        mode = "ab" if resp.status_code == 206 else "wb"
        total = int(resp.headers.get("content-length", 0))
        if resp.status_code == 206:
            total += existing_size
        
        with open(local_path, mode) as f:
            for chunk in resp.iter_content(chunk_size=8192):
                if chunk:
                    f.write(chunk)
        return True
    except Exception as e:
        failed_downloads.append((url, str(e)))
        return False


def parse_page(url):
    """解析页面，提取链接和资源"""
    if url in visited_urls:
        return
    visited_urls.add(url)
    
    try:
        resp = requests.get(url, headers=HEADERS, timeout=TIMEOUT)
        if resp.status_code != 200:
            return
    except Exception as e:
        print(f"Failed to fetch {url}: {e}")
        return
    
    # 保存HTML
    parsed = urlparse(url)
    rel_path = sanitize_path(parsed.path)
    html_path = OUTPUT_DIR / "html" / rel_path
    html_path.parent.mkdir(parents=True, exist_ok=True)
    with open(html_path, "wb") as f:
        f.write(resp.content)
    
    soup = BeautifulSoup(resp.text, "html.parser")
    
    # 1. 提取内部链接
    for a_tag in soup.find_all("a", href=True):
        href = a_tag["href"]
        full_url = urljoin(BASE_URL, href)
        parsed_link = urlparse(full_url)
        
        # 只处理本站链接
        if parsed_link.netloc == urlparse(BASE_URL).netloc:
            path = parsed_link.path
            # 排除锚点和查询
            if "#" in href:
                continue
            if path not in visited_urls:
                all_internal_links.add(full_url)
    
    # 2. 提取图片资源
    for img in soup.find_all(["img", "source"], src=True):
        src = img.get("src") or img.get("srcset", "").split()[0]
        full_url = urljoin(BASE_URL, src)
        if urlparse(full_url).netloc == urlparse(BASE_URL).netloc:
            ext = Path(urlparse(full_url).path).suffix.lower()
            if ext in (".jpg", ".jpeg", ".png", ".webp", ".gif", ".svg"):
                local_rel = urlparse(full_url).path.lstrip("/")
                local_path = OUTPUT_DIR / local_rel
                download_file(full_url, local_path)
    
    for img in soup.find_all("img"):
        srcset = img.get("srcset")
        if srcset:
            for src in srcset.split(","):
                src = src.strip().split()[0]
                full_url = urljoin(BASE_URL, src)
                if urlparse(full_url).netloc == urlparse(BASE_URL).netloc:
                    local_rel = urlparse(full_url).path.lstrip("/")
                    local_path = OUTPUT_DIR / local_rel
                    download_file(full_url, local_path)
    
    # 3. 提取CSS/JS资源
    for link in soup.find_all("link", href=True):
        href = link["href"]
        if link.get("rel") in (["stylesheet"], ["preload"]):
            full_url = urljoin(BASE_URL, href)
            if urlparse(full_url).netloc == urlparse(BASE_URL).netloc:
                local_rel = urlparse(full_url).path.lstrip("/")
                local_path = OUTPUT_DIR / local_rel
                download_file(full_url, local_path)
    
    for script in soup.find_all("script", src=True):
        src = script["src"]
        full_url = urljoin(BASE_URL, src)
        if urlparse(full_url).netloc == urlparse(BASE_URL).netloc:
            local_rel = urlparse(full_url).path.lstrip("/")
            local_path = OUTPUT_DIR / local_rel
            download_file(full_url, local_path)
    
    # 4. 提取MEGA下载链接和壁纸信息
    wallpaper_blocks = soup.find_all("div", class_="wv-wallpaper")
    for block in wallpaper_blocks:
        # 获取标题
        title_tag = block.find_previous("h2")
        title = title_tag.get_text(strip=True) if title_tag else "Unknown"
        
        # 获取预览图
        preview_img = block.find("img", class_="wv-preview-image")
        preview_url = urljoin(BASE_URL, preview_img["src"]) if preview_img and preview_img.get("src") else ""
        
        # 获取所有下载链接
        downloads = block.find("div", class_="wv-downloads")
        mega_links = []
        jpg_links = []
        steam_link = ""
        
        if downloads:
            for a in downloads.find_all("a", href=True):
                href = a["href"]
                text = a.get_text(strip=True)
                if "mega.nz" in href:
                    mega_links.append({"text": text, "url": href})
                    all_mega_links.append({
                        "title": title,
                        "type": text,
                        "url": href,
                        "preview": preview_url,
                        "page": url
                    })
                elif href.endswith(".jpg") or href.endswith(".jpeg"):
                    jpg_links.append({"text": text, "url": urljoin(BASE_URL, href)})
                    # 下载JPG
                    local_rel = urlparse(urljoin(BASE_URL, href)).path.lstrip("/")
                    local_path = OUTPUT_DIR / local_rel
                    download_file(urljoin(BASE_URL, href), local_path)
                elif "steamcommunity" in href:
                    steam_link = href


def bfs_crawl(start_url, max_pages=500):
    """广度优先爬取全站"""
    queue = [start_url]
    page_count = 0
    
    print(f"开始爬取 {BASE_URL} ...")
    
    with tqdm(total=max_pages, desc="爬取页面") as pbar:
        while queue and page_count < max_pages:
            # 批量处理一批页面
            batch = []
            while queue and len(batch) < 10:
                url = queue.pop(0)
                if url not in visited_urls:
                    batch.append(url)
            
            if not batch:
                break
            
            # 多线程解析页面
            with ThreadPoolExecutor(max_workers=4) as executor:
                futures = [executor.submit(parse_page, url) for url in batch]
                for future in as_completed(futures):
                    page_count += 1
                    pbar.update(1)
            
            # 把新发现的链接加入队列
            new_links = all_internal_links - visited_urls
            queue.extend(list(new_links))
            all_internal_links.clear()
            for url in queue:
                if url in visited_urls:
                    queue.remove(url)
            
            # 限速
            time.sleep(0.2)
    
    print(f"爬取完成！共处理 {page_count} 个页面")


def generate_download_script():
    """生成MEGA视频批量下载脚本"""
    # 保存MEGA链接清单
    mega_list_path = OUTPUT_DIR / "MEGA下载清单.json"
    with open(mega_list_path, "w", encoding="utf-8") as f:
        json.dump(all_mega_links, f, ensure_ascii=False, indent=2)
    
    # 生成shell下载脚本
    sh_path = OUTPUT_DIR / "批量下载MEGA视频.sh"
    with open(sh_path, "w", encoding="utf-8") as f:
        f.write("#!/bin/bash\n")
        f.write("# FondosAnimados.com 视频批量下载脚本\n")
        f.write("# 使用方法: chmod +x 批量下载MEGA视频.sh && ./批量下载MEGA视频.sh\n")
        f.write("# 需要先安装megatools: apt install megatools\n\n")
        f.write(f"cd \"{OUTPUT_DIR / 'videos'}\"\n\n")
        
        for i, item in enumerate(all_mega_links, 1):
            safe_title = safe_filename(item["title"])
            f.write(f"echo \"[{i}/{len(all_mega_links)}] 下载: {item['title']} - {item['type']}\"\n")
            f.write(f"megadl --no-progress \"{item['url']}\" 2>&1 || echo \"下载失败: {item['title']}\"\n")
            f.write("sleep 1\n\n")
    
    os.chmod(sh_path, 0o755)
    
    # 生成Python MEGA下载备用脚本
    py_path = OUTPUT_DIR / "MEGA下载器.py"
    with open(py_path, "w", encoding="utf-8") as f:
        f.write('''#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
MEGA视频批量下载备用脚本
如果megadl命令不好用，可以使用mega.py: pip install mega.py
"""
import json
import os
import subprocess
from pathlib import Path

OUTPUT_DIR = Path(__file__).parent / "videos"
OUTPUT_DIR.mkdir(exist_ok=True)

with open(Path(__file__).parent / "MEGA下载清单.json", "r", encoding="utf-8") as f:
    links = json.load(f)

print(f"共找到 {len(links)} 个MEGA视频链接")
print("请使用以下任一方式下载:")
print("1. 运行同目录下的 批量下载MEGA视频.sh (推荐)")
print("2. 使用MEGA客户端手动导入链接")
print("3. 使用mega.py库:")
print("   from mega import Mega")
print("   mega = Mega()")
print("   m = mega.login()  # 匿名登录")
print("   m.download_url(url, OUTPUT_DIR)")
print()

# 导出链接列表文本
with open(OUTPUT_DIR.parent / "MEGA链接列表.txt", "w", encoding="utf-8") as out:
    for item in links:
        out.write(f"{item['title']} - {item['type']}\\n")
        out.write(f"{item['url']}\\n\\n")

print("链接列表已保存到 MEGA链接列表.txt")
''')
    
    return mega_list_path, sh_path


def generate_index():
    """生成资源索引页面"""
    index_path = OUTPUT_DIR / "资源索引.html"
    with open(index_path, "w", encoding="utf-8") as f:
        f.write(f"""<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <title>FondosAnimados.com 全站爬取资源索引</title>
    <style>
        body {{ font-family: Arial, sans-serif; max-width: 1200px; margin: 0 auto; padding: 20px; background: #f5f5f5; }}
        h1 {{ color: #333; text-align: center; }}
        .stats {{ background: #fff; padding: 20px; border-radius: 8px; margin: 20px 0; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }}
        .wallpaper {{ background: #fff; padding: 15px; margin: 10px 0; border-radius: 8px; display: flex; gap: 15px; }}
        .wallpaper img {{ width: 200px; height: auto; border-radius: 4px; }}
        .wallpaper-info {{ flex: 1; }}
        .wallpaper h3 {{ margin: 0 0 10px 0; }}
        .btn {{ display: inline-block; padding: 5px 12px; margin: 3px; background: #4CAF50; color: white; text-decoration: none; border-radius: 4px; font-size: 12px; }}
        .btn.mega {{ background: #E53238; }}
        .btn.jpg {{ background: #2196F3; }}
    </style>
</head>
<body>
    <h1>FondosAnimados.com 全站爬取资源索引</h1>
    
    <div class="stats">
        <h2>爬取统计</h2>
        <ul>
            <li>爬取页面数: {len(visited_urls)}</li>
            <li>MEGA视频链接数: {len(all_mega_links)}</li>
            <li>失败下载数: {len(failed_downloads)}</li>
            <li>JPG/图片已下载到本目录对应uploads文件夹</li>
        </ul>
        <p>
            <a href="批量下载MEGA视频.sh" class="btn mega">运行脚本下载所有MP4视频</a>
            <a href="MEGA下载清单.json" class="btn">查看JSON清单</a>
            <a href="MEGA链接列表.txt" class="btn">查看纯文本链接</a>
        </p>
    </div>
    
    <h2>壁纸列表 (共 {len(all_mega_links)} 个)</h2>
""")
        
        for item in all_mega_links:
            f.write(f"""
    <div class="wallpaper">
        <img src="{item['preview']}" alt="{item['title']}" onerror="this.src=''">
        <div class="wallpaper-info">
            <h3>{item['title']}</h3>
            <p>类型: {item['type']}</p>
            <p>
                <a href="{item['url']}" target="_blank" class="btn mega">MEGA下载</a>
            </p>
        </div>
    </div>
""")
        
        f.write("""
</body>
</html>
""")
    
    return index_path


def main():
    print("=" * 60)
    print("FondosAnimados.com 全站爬虫启动")
    print("=" * 60)
    
    # 开始爬取
    bfs_crawl(BASE_URL, max_pages=200)
    
    print(f"\n发现 {len(all_mega_links)} 个MEGA视频链接")
    
    # 生成下载脚本
    mega_list, sh_script = generate_download_script()
    print(f"MEGA链接清单已保存到: {mega_list}")
    print(f"批量下载脚本已生成: {sh_script}")
    
    # 生成索引
    index_path = generate_index()
    print(f"资源索引页面: {index_path}")
    
    # 统计图片数量
    img_count = 0
    for ext in ("*.jpg", "*.jpeg", "*.webp", "*.png"):
        img_count += len(list(OUTPUT_DIR.rglob(ext)))
    
    print(f"\n已下载图片数量: {img_count}")
    
    if failed_downloads:
        print(f"\n失败下载 ({len(failed_downloads)}):")
        for url, err in failed_downloads[:10]:
            print(f"  - {url}: {err}")
    
    print("\n" + "=" * 60)
    print("爬取完成！")
    print(f"所有文件保存在: {OUTPUT_DIR}")
    print("=" * 60)


if __name__ == "__main__":
    main()
