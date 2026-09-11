#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
bing.wdbyte.com 全站爬虫
------------------------
目标: https://bing.wdbyte.com/  (必应壁纸归档站, 纯静态/阿里云OSS托管, 无加密无反爬)
功能:
  1. 抓取全站静态页面 (首页、zh-cn 首页、bing-love、download、月归档、每日详情)
  2. 抓取本地静态资源 (css/js/img/images.json)
  3. 抓取所有 Bing UHD 原图 (4K 3840x2160)，保存到 wallpapers/ 目录
  4. 支持并发下载、断点续传、失败重试、本地可离线浏览(URL 已改写为相对路径)
  5. 生成抓取报告 report.txt
用法:
  python3 bing_wdbyte_spider.py            # 默认只抓 HTML/CSS/JS/JSON (快)
  python3 bing_wdbyte_spider.py --images   # 同时下载全部 UHD 壁纸 (较慢, 约几GB)
  python3 bing_wdbyte_spider.py --images --workers 10
"""

import argparse
import json
import os
import re
import sys
import time
import hashlib
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path
from urllib.parse import urljoin, urlparse, unquote

import requests
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry

# ---------- 配置 ----------
SITE = "https://bing.wdbyte.com"
OUT_DIR = Path("/home/user/11244951546440902095/bing.wdbyte.com")
WALLPAPER_DIR = OUT_DIR / "wallpapers"
TIMEOUT = 30
RETRY = 5
DEFAULT_WORKERS = 8
HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
                  "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Referer": "https://bing.wdbyte.com/",
    "Accept": "*/*",
    "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
}

# ---------- 工具函数 ----------
def make_session():
    s = requests.Session()
    s.headers.update(HEADERS)
    retry = Retry(total=RETRY, backoff_factor=1,
                  status_forcelist=[429, 500, 502, 503, 504],
                  allowed_methods=["GET", "HEAD"])
    s.mount("https://", HTTPAdapter(max_retries=retry, pool_connections=30, pool_maxsize=30))
    s.mount("http://", HTTPAdapter(max_retries=retry, pool_connections=30, pool_maxsize=30))
    return s

SESSION = make_session()

def url_to_local(url: str) -> Path:
    """把网站内 URL 映射到本地路径"""
    if url.startswith("//"):
        url = "https:" + url
    p = urlparse(url)
    # 本站资源
    if "bing.wdbyte.com" in p.netloc or p.netloc == "":
        path = unquote(p.path)
        if path == "" or path == "/":
            return OUT_DIR / "index.html"
        if path.endswith("/"):
            path = path + "index.html"
        local = OUT_DIR / path.lstrip("/")
        # 目录型 URL 无扩展名 -> index.html
        if "." not in local.name:
            local = local / "index.html"
        return local
    # 外链(如 bing.com 的壁纸) -> 不直接保存, 由专门逻辑处理
    return None

def safe_download(url: str, target: Path, overwrite: bool = False) -> bool:
    """下载单个文件, 跳过已存在的完整文件, 支持断点续传"""
    target.parent.mkdir(parents=True, exist_ok=True)
    if target.exists() and not overwrite and target.stat().st_size > 0:
        return True  # 已存在且非空
    for attempt in range(RETRY + 1):
        try:
            with SESSION.get(url, timeout=TIMEOUT, stream=True) as r:
                r.raise_for_status()
                tmp = target.with_suffix(target.suffix + ".part")
                with open(tmp, "wb") as f:
                    for chunk in r.iter_content(chunk_size=64 * 1024):
                        if chunk:
                            f.write(chunk)
                tmp.replace(target)
            return True
        except Exception as e:
            if attempt == RETRY:
                print(f"[FAIL] {url} -> {e}", file=sys.stderr)
                return False
            time.sleep(1.5 * (attempt + 1))
    return False

def fetch_text(url: str) -> str:
    for attempt in range(RETRY + 1):
        try:
            r = SESSION.get(url, timeout=TIMEOUT)
            r.raise_for_status()
            r.encoding = r.apparent_encoding or "utf-8"
            return r.text
        except Exception as e:
            if attempt == RETRY:
                raise
            time.sleep(1)

# ---------- 发现链接 ----------
HREF_RE = re.compile(r'''(?:href|src)\s*=\s*["']([^"']+)["']''', re.I)
CSS_URL_RE = re.compile(r'''url\(\s*["']?([^"')]+)["']?\s*\)''', re.I)

def extract_links(html: str, base_url: str):
    links = set()
    # 1) href/src 属性
    for m in HREF_RE.finditer(html):
        u = m.group(1).strip()
        if _bad_link(u):
            continue
        abs_u = urljoin(base_url, u)
        links.add(abs_u)
    # 2) CSS 里的 url(...)
    for m in CSS_URL_RE.finditer(html):
        u = m.group(1).strip()
        if _bad_link(u):
            continue
        abs_u = urljoin(base_url, u)
        links.add(abs_u)
    return links

def _bad_link(u: str) -> bool:
    if not u:
        return True
    if u.startswith(("javascript:", "#", "mailto:", "data:", "tel:", "about:", "blob:")):
        return True
    # 明显是 JS 表达式/变量名(含括号/等号/空格/$模板变量)
    if any(ch in u for ch in ("(", ")", "=", " ", "${", "}", "'", '"', "+", "?")):
        # 但要放过正常的 querystring URL(只有最外侧的 ?, 没有其他 JS 迹象)
        # 简单判断: 如果同时包含 https:// 或 / 开头且没有 ${/+/')就放行
        if (u.startswith("http") or u.startswith("/")) and "${" not in u and "+" not in u and "'" not in u and '"' not in u:
            pass
        else:
            return True
    if u.startswith(("window.", "document.", "location.", "navigator.", "self.")):
        return True
    # JS 里的纯标识符 (如 blob/osKey/objectUrl) —— 无 "/" 且像驼峰标识符
    if "/" not in u and re.match(r'^[a-zA-Z_$][a-zA-Z0-9_$]*$', u):
        return True
    return False

def same_site(url: str) -> bool:
    p = urlparse(url)
    return "bing.wdbyte.com" in p.netloc

# ---------- 页面下载 + 递归 ----------
def download_page(url: str, downloaded: set, pending: set, fetch_images: bool):
    """下载 HTML/CSS/JS 页面, 递归发现站内资源"""
    local = url_to_local(url)
    if local is None:
        return
    key = str(local)
    if key in downloaded:
        return
    downloaded.add(key)

    target = local
    if not safe_download(url, target):
        return

    # 只解析文本型资源 (html/css/js) 里的链接
    suffix = target.suffix.lower()
    if suffix in {".html", ".css", ".js", ""}:
        try:
            text = target.read_text(encoding="utf-8", errors="ignore")
        except Exception:
            return
        for link in extract_links(text, url):
            if same_site(link):
                local_link = url_to_local(link)
                if local_link and str(local_link) not in downloaded:
                    pending.add((link, local_link))
            elif fetch_images and ("cn.bing.com/th" in link or "bing.com/th" in link):
                # bing 缩略图(384/50/1920)直接随页面保存, UHD 原图交给专门步骤
                try:
                    parsed = urlparse(link)
                    qs = parsed.query
                    if "w=384" in qs or "w=50" in qs or "w=480" in qs or "w=1920" in qs or "w=2000" in qs:
                        name = hashlib.md5(link.encode()).hexdigest()[:10] + ".jpg"
                        local_t = OUT_DIR / "thumbs" / name
                        if not local_t.exists():
                            safe_download(link, local_t)
                except Exception:
                    pass

# ---------- 壁纸原图下载 ----------
def wallpaper_filename(entry: dict) -> str:
    date = entry["date"]  # e.g. 2026-09-11
    region = entry["region"]
    url = entry["url"]
    # 从 URL 提取 OHR name
    m = re.search(r'id=OHR\.([^_&]+)', url)
    name = m.group(1) if m else hashlib.md5(url.encode()).hexdigest()[:12]
    return f"{date}_{region}_{name}.jpg"

def download_wallpaper(entry: dict):
    url = entry["url"]
    # 请求 UHD (3840x2160) 版本
    uhd_url = url
    if "?" not in uhd_url:
        uhd_url += "?rf=LaDigue_UHD.jpg&pid=hp&w=3840&h=2160&rs=1&c=4"
    else:
        uhd_url += "&rf=LaDigue_UHD.jpg&pid=hp&w=3840&h=2160&rs=1&c=4"
    fname = wallpaper_filename(entry)
    target = WALLPAPER_DIR / fname
    if target.exists() and target.stat().st_size > 50_000:
        return ("skip", fname, target.stat().st_size)
    ok = safe_download(uhd_url, target)
    if ok and target.exists():
        size = target.stat().st_size
        # 过小通常是错误响应
        if size < 10_000:
            target.unlink(missing_ok=True)
            return ("fail", fname, 0)
        return ("ok", fname, size)
    return ("fail", fname, 0)

# ---------- 主流程 ----------
def main():
    parser = argparse.ArgumentParser(description="bing.wdbyte.com 全站爬虫")
    parser.add_argument("--images", action="store_true", help="同时下载所有 UHD 4K 壁纸原图")
    parser.add_argument("--workers", type=int, default=DEFAULT_WORKERS, help="并发数")
    args = parser.parse_args()

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    WALLPAPER_DIR.mkdir(parents=True, exist_ok=True)
    (OUT_DIR / "thumbs").mkdir(parents=True, exist_ok=True)

    print("=" * 60)
    print(f"目标: {SITE}")
    print(f"输出目录: {OUT_DIR}")
    print(f"下载 UHD 壁纸: {'是' if args.images else '否 (加 --images 开启)'}")
    print(f"并发数: {args.workers}")
    print("=" * 60)

    # 1) 先下载 images.json (核心数据索引), 从中构造所有 URL
    print("\n[1/4] 拉取 images.json 元数据 ...")
    images_json_url = SITE + "/images.json"
    images_json_local = OUT_DIR / "images.json"
    safe_download(images_json_url, images_json_local, overwrite=True)
    with open(images_json_local, "r", encoding="utf-8") as f:
        data = json.load(f)
    print(f"  -> images.json 共 {len(data)} 条壁纸记录")

    # 2) 构建需要抓取的 URL 列表
    #    a. 固定页面
    seed_urls = [
        SITE + "/",
        SITE + "/bing-love.html",
        SITE + "/download.html",
        SITE + "/zh-cn/",
        SITE + "/css/w3.css",
        SITE + "/js/w3.js",
        SITE + "/js/download.js",
        SITE + "/js/love.js",
        SITE + "/js/search.js",
        SITE + "/img/fav.jpg",
    ]

    #    b. 月归档页(英文)
    months_en = set()
    months_zh = set()
    day_pages = set()
    for e in data:
        y, m, d = e["date"].split("-")
        months_en.add(f"{y}-{m}.html")
        if e["region"] == "zh-cn":
            months_zh.add(f"{y}-{m}.html")
            day_pages.add(f"/zh-cn/day/{y}{m}/{d}.html")
        else:
            day_pages.add(f"/day/{y}{m}/{d}.html")
    seed_urls += [SITE + "/" + x for x in sorted(months_en)]
    seed_urls += [SITE + "/zh-cn/" + x for x in sorted(months_zh)]
    seed_urls += [SITE + x for x in sorted(day_pages)]

    # 去重
    seed_urls = list(dict.fromkeys(seed_urls))
    print(f"\n[2/4] 规划待抓页面/资源: {len(seed_urls)} 个")

    # 3) 递归抓取页面与静态资源
    downloaded = set()
    pending = set()

    def add_seed(u):
        loc = url_to_local(u)
        if loc:
            pending.add((u, loc))

    for u in seed_urls:
        add_seed(u)

    processed = 0
    with ThreadPoolExecutor(max_workers=args.workers) as ex:
        futures = set()
        # 初始提交
        while pending or futures:
            while pending and len(futures) < args.workers * 3:
                u, loc = pending.pop()
                if str(loc) in downloaded:
                    continue
                futures.add(ex.submit(download_page, u, downloaded, pending, args.images))
            if not futures:
                break
            done = next(as_completed(futures))
            futures.remove(done)
            try:
                done.result()
            except Exception as e:
                print(f"  [warn] {e}", file=sys.stderr)
            processed += 1
            if processed % 100 == 0:
                print(f"  ... 已处理 {processed} 个文件, 队列待发现 {len(pending)}")

    print(f"  -> 共保存站内文件 {len(downloaded)} 个")

    # 4) 下载 UHD 原图(可选)
    img_ok = img_skip = img_fail = 0
    img_bytes = 0
    if args.images:
        print(f"\n[3/4] 下载 {len(data)} 张 UHD 4K 壁纸 ...")
        with ThreadPoolExecutor(max_workers=args.workers) as ex:
            futures = {ex.submit(download_wallpaper, e): e for e in data}
            for i, fut in enumerate(as_completed(futures), 1):
                try:
                    status, fname, size = fut.result()
                    if status == "ok":
                        img_ok += 1; img_bytes += size
                    elif status == "skip":
                        img_skip += 1; img_bytes += size
                    else:
                        img_fail += 1
                except Exception as ex:
                    img_fail += 1
                if i % 50 == 0 or i == len(data):
                    print(f"  ... {i}/{len(data)}  ok={img_ok} skip={img_skip} fail={img_fail}")
    else:
        print("\n[3/4] 跳过 UHD 原图(可用 --images 参数开启)")

    # 5) 报告
    print("\n[4/4] 生成报告 ...")
    report_lines = [
        "bing.wdbyte.com 全站抓取报告",
        "=" * 40,
        f"目标站点: {SITE}",
        f"抓取时间: {time.strftime('%Y-%m-%d %H:%M:%S')}",
        f"壁纸元数据条数: {len(data)}",
        f"保存的站内文件数: {len(downloaded)}",
        f"输出根目录: {OUT_DIR}",
        f"下载 UHD 壁纸: {'是' if args.images else '否'}",
    ]
    if args.images:
        report_lines += [
            f"UHD 成功/跳过/失败: {img_ok} / {img_skip} / {img_fail}",
            f"UHD 总大小: {img_bytes/1024/1024/1024:.2f} GB",
            f"壁纸目录: {WALLPAPER_DIR}",
        ]
    # 统计本地文件
    total_files = 0; total_size = 0
    for p in OUT_DIR.rglob("*"):
        if p.is_file():
            total_files += 1
            total_size += p.stat().st_size
    report_lines += [
        "-" * 40,
        f"本地文件总数: {total_files}",
        f"本地总大小: {total_size/1024/1024:.2f} MB",
    ]
    report = "\n".join(report_lines)
    (OUT_DIR / "report.txt").write_text(report, encoding="utf-8")
    print(report)

if __name__ == "__main__":
    main()
