#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Labubu Live Wallpaper (https://labubulivewallpaper.com/) 全站抓取与下载脚本
================================================================================
站点结构分析：
  - 前端：React/Vite SPA，部署于 Vercel
  - 资源 CDN：imgs.labubulivewallpaper.com（Cloudflare），公开直链，无鉴权/加密
  - 数据：壁纸元数据硬编码在主 JS bundle 中，无需调用加密 API
  - 视频：首页 Hero 区展示 mov/mp4
  - 静态壁纸：jpg/jpeg/png
  - 动态（Live）壁纸：HEIC（Apple Live Photo 实况照片格式，iOS 原生实时壁纸）
  - 多语言路由：/zh /ja /de /es /fr /ru（与首页共享同一 JS/CSS，仅文本替换）

脚本功能：
  1) 自动解析 JS bundle 提取壁纸元数据（无需逆向解密，URL 均明文）
  2) 下载站点静态资源：首页、多语言页、CSS、JS、favicon、logo、robots、sitemap
  3) 并发下载全部壁纸：缩略图(webp/jpeg) + 预览图 + 原图(HEIC/JPG/PNG/JPEG)
  4) 下载首页视频（5 个 mov/mp4）
  5) 断点续传、失败重试、进度日志
  6) 生成清单 JSON（wallpapers_manifest.json）与下载统计报告
"""

import os
import re
import sys
import json
import time
import hashlib
import logging
import argparse
from pathlib import Path
from urllib.parse import urlparse, unquote
from concurrent.futures import ThreadPoolExecutor, as_completed

import requests
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry

# -----------------------------------------------------------------------------
# 配置
# -----------------------------------------------------------------------------
BASE_URL = "https://labubulivewallpaper.com"
IMG_CDN  = "https://imgs.labubulivewallpaper.com"
HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
                  "(KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
    "Accept": "*/*",
    "Accept-Language": "en-US,en;q=0.9",
    "Referer": "https://labubulivewallpaper.com/",
}
TIMEOUT = 60
RETRY = 5
WORKERS = 8  # 并发数（Cloudflare 通常对合规并发很宽松，8 足够快且稳）

# -----------------------------------------------------------------------------
# 日志
# -----------------------------------------------------------------------------
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%H:%M:%S",
)
log = logging.getLogger("labulu")


# -----------------------------------------------------------------------------
# HTTP 会话（带重试 & 断点续传）
# -----------------------------------------------------------------------------
def make_session() -> requests.Session:
    s = requests.Session()
    s.headers.update(HEADERS)
    retry = Retry(
        total=RETRY,
        backoff_factor=1.5,
        status_forcelist=(429, 500, 502, 503, 504),
        allowed_methods=("GET", "HEAD"),
    )
    adapter = HTTPAdapter(max_retries=retry, pool_connections=WORKERS * 2, pool_maxsize=WORKERS * 2)
    s.mount("https://", adapter)
    s.mount("http://", adapter)
    return s


def md5_of_file(path: Path) -> str:
    h = hashlib.md5()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def download(url: str, out_path: Path, session: requests.Session, skip_if_exists: bool = True) -> bool:
    """
    带断点续传的下载。返回 True 表示文件已存在或下载成功。
    """
    out_path.parent.mkdir(parents=True, exist_ok=True)

    # 已存在且大小匹配：跳过（HEAD 请求拿 Content-Length 对比）
    if skip_if_exists and out_path.exists() and out_path.stat().st_size > 0:
        try:
            head = session.head(url, timeout=15, allow_redirects=True)
            cl = head.headers.get("Content-Length")
            if cl and int(cl) == out_path.stat().st_size:
                return True
        except Exception:
            pass
        # HEAD 拿不到大小也跳过（可能是分块/已下载完）
        if out_path.stat().st_size > 1024:
            return True

    tmp = out_path.with_suffix(out_path.suffix + ".part")
    downloaded = 0
    if tmp.exists():
        downloaded = tmp.stat().st_size

    headers = {}
    if downloaded > 0:
        headers["Range"] = f"bytes={downloaded}-"

    try:
        with session.get(url, headers=headers, stream=True, timeout=TIMEOUT, allow_redirects=True) as r:
            # 服务器不支持 range 则从头开始
            if downloaded > 0 and r.status_code == 200:
                downloaded = 0
                tmp.unlink(missing_ok=True)
            elif downloaded > 0 and r.status_code == 416:
                # Range 不满足，文件其实已完整
                if tmp.exists():
                    tmp.rename(out_path)
                return True
            r.raise_for_status()

            mode = "ab" if downloaded > 0 else "wb"
            with open(tmp, mode) as f:
                for chunk in r.iter_content(chunk_size=1 << 15):
                    if chunk:
                        f.write(chunk)
        tmp.rename(out_path)
        return True
    except Exception as e:
        log.warning(f"下载失败: {url} -> {e}")
        return False


# -----------------------------------------------------------------------------
# 1) 抓取首页 & 主 JS bundle，解析壁纸数据
# -----------------------------------------------------------------------------
WALLPAPER_OBJ_RE = re.compile(
    r'\{id:"(\d+)",thumbnail:"([^"]+)",preview:"([^"]+)",downloadUrl:"([^"]+)",'
    r'category:"([^"]+)",deviceType:"([^"]+)",resolution:"([^"]+)",fileSize:"([^"]+)"\}'
)


def parse_wallpapers_from_js(js_text: str) -> list:
    items = {}
    for m in WALLPAPER_OBJ_RE.finditer(js_text):
        it = {
            "id": int(m.group(1)),
            "thumbnail": m.group(2),
            "preview": m.group(3),
            "downloadUrl": m.group(4),
            "category": m.group(5),
            "deviceType": m.group(6),
            "resolution": m.group(7),
            "fileSize": m.group(8),
        }
        # 补全一个稳定的文件名（downloadUrl 末段）
        it["filename"] = unquote(urlparse(it["downloadUrl"]).path.lstrip("/"))
        items[it["id"]] = it
    return sorted(items.values(), key=lambda x: x["id"])


def extract_asset_urls(html: str) -> dict:
    """从首页 HTML 里提取 CSS/JS 资源地址"""
    js  = re.findall(r'<script[^>]+src="(/assets/[^"]+)"', html)
    css = re.findall(r'<link[^>]+href="(/assets/[^"]+)"', html)
    return {"js": js, "css": css}


# -----------------------------------------------------------------------------
# 2) 主流程
# -----------------------------------------------------------------------------
def main():
    ap = argparse.ArgumentParser(description="Labubu Live Wallpaper 全站抓取器")
    ap.add_argument("--out", default="./downloads", help="下载根目录（默认 ./downloads）")
    ap.add_argument("--workers", type=int, default=WORKERS, help="并发数")
    ap.add_argument("--no-videos", action="store_true", help="跳过首页视频（较大）")
    ap.add_argument("--no-thumbnails", action="store_true", help="跳过缩略图（仅下载原图）")
    ap.add_argument("--languages", nargs="*", default=["zh", "ja", "de", "es", "fr", "ru"],
                    help="要抓取的多语言页路径，默认全部")
    args = ap.parse_args()

    out = Path(args.out).resolve()
    out.mkdir(parents=True, exist_ok=True)
    (out / "site").mkdir(exist_ok=True)
    (out / "site" / "assets").mkdir(exist_ok=True)
    (out / "images").mkdir(exist_ok=True)        # 原图（HEIC/JPG/PNG/JPEG）
    (out / "previews").mkdir(exist_ok=True)      # 预览图
    (out / "thumbnails").mkdir(exist_ok=True)    # 缩略图（CDN 已压缩 webp/jpeg）
    (out / "videos").mkdir(exist_ok=True)
    log.info(f"下载目录：{out}")

    session = make_session()

    # ---------- 下载首页 ----------
    log.info("(1/6) 下载首页与静态资源 …")
    index_html_path = out / "site" / "index.html"
    download(BASE_URL + "/", index_html_path, session)
    html = index_html_path.read_text(encoding="utf-8", errors="ignore")

    assets = extract_asset_urls(html)
    log.info(f"  发现 JS 资源: {assets['js']}")
    log.info(f"  发现 CSS 资源: {assets['css']}")

    # 下载 JS/CSS
    for js_path in assets["js"]:
        download(BASE_URL + js_path, out / "site" / js_path.lstrip("/"), session)
    for css_path in assets["css"]:
        download(BASE_URL + css_path, out / "site" / css_path.lstrip("/"), session)

    # 下载多语言页（返回的是同一份 SPA HTML，保留为镜像）
    for lang in args.languages:
        download(f"{BASE_URL}/{lang}", out / "site" / f"{lang}.html", session)

    # 站点其它通用文件
    for p in ["robots.txt", "sitemap.xml", "favicon.ico"]:
        download(f"{BASE_URL}/{p}", out / "site" / p, session)

    # 站点 logo（首页引用 /imgs/logo.png，实际在 imgs cdn，不存在则跳过）
    try:
        r = session.head(IMG_CDN + "/logo.png", timeout=10, allow_redirects=True)
        if r.status_code == 200:
            download(IMG_CDN + "/logo.png", out / "images" / "logo.png", session)
    except Exception:
        pass
    download(BASE_URL + "/favicon.ico", out / "images" / "favicon.ico", session)

    # ---------- 解析主 JS 提取壁纸数据 ----------
    log.info("(2/6) 解析 JS bundle 提取壁纸清单 …")
    main_js_path = out / "site" / "assets" / Path(assets["js"][0]).name
    if not main_js_path.exists():
        log.error("主 JS 不存在，退出")
        sys.exit(1)
    js_text = main_js_path.read_text(encoding="utf-8", errors="ignore")
    wallpapers = parse_wallpapers_from_js(js_text)
    log.info(f"  共解析到 {len(wallpapers)} 个壁纸项")

    # 写清单
    manifest_path = out / "wallpapers_manifest.json"
    manifest_path.write_text(json.dumps(wallpapers, ensure_ascii=False, indent=2), encoding="utf-8")
    log.info(f"  清单已写入: {manifest_path}")

    # ---------- 统计任务 ----------
    tasks = []  # (url, local_path, category_label)

    # 原图
    for w in wallpapers:
        fn = w["filename"]
        tasks.append((w["downloadUrl"], out / "images" / fn, f"原图/{w['category']}"))
    # 预览图
    for w in wallpapers:
        fn = unquote(urlparse(w["preview"]).path.lstrip("/"))
        # 注意：preview 路径一般和 downloadUrl 相同，去重即可
        local = out / "previews" / fn
        if not any(t[1] == local for t in tasks):
            tasks.append((w["preview"], local, "预览图"))
    # 缩略图（Cloudflare CDN 路径包含 /cdn-cgi/image/.../ 会带 '/'，需要编码）
    if not args.no_thumbnails:
        for w in wallpapers:
            # 缩略图是 CDN 裁剪的 webp/jpeg，文件名取原图 basename 加 _thumb
            turl = w["thumbnail"]
            # 从 URL 末尾的文件名解析
            parts = turl.rsplit("/", 1)
            fn = parts[-1] if len(parts) == 2 else f"{w['id']}_thumb.jpg"
            local = out / "thumbnails" / f"{w['id']:03d}_{fn}"
            tasks.append((turl, local, "缩略图"))

    # 首页视频
    if not args.no_videos:
        videos = [
            "apple.mov",
            "labubu_video.mp4",
            "labubu_video2.mp4",
            "labubu_video3.mov",
            "labubu_video5.mov",
        ]
        for v in videos:
            tasks.append((f"{IMG_CDN}/{v}", out / "videos" / v, "视频"))

    # ---------- 并发下载 ----------
    log.info(f"(3/6) 开始下载 {len(tasks)} 个文件（并发={args.workers}） …")
    ok = 0
    fail = 0
    failed_list = []
    total = len(tasks)
    with ThreadPoolExecutor(max_workers=args.workers) as pool:
        futures = {pool.submit(download, url, lp, session): (url, lp, tag) for url, lp, tag in tasks}
        for i, fut in enumerate(as_completed(futures), 1):
            url, lp, tag = futures[fut]
            try:
                success = fut.result()
            except Exception as e:
                success = False
                log.warning(f"任务异常: {url}: {e}")
            if success:
                ok += 1
            else:
                fail += 1
                failed_list.append(url)
            if i % 20 == 0 or i == total:
                log.info(f"  进度 {i}/{total}  成功 {ok}  失败 {fail}")

    # ---------- 失败重试一次（单线程） ----------
    if failed_list:
        log.info(f"(4/6) 对 {len(failed_list)} 个失败任务做二次单线程重试 …")
        still_fail = []
        for url in failed_list:
            # 从 tasks 里找到对应 local path
            lp = next((lp for u, lp, _ in tasks if u == url), None)
            if not lp:
                continue
            time.sleep(1)
            if download(url, lp, session):
                ok += 1
                fail -= 1
            else:
                still_fail.append(url)
        failed_list = still_fail

    # ---------- 统计 ----------
    log.info("(5/6) 生成统计报告 …")
    from collections import Counter
    cat = Counter(w["category"] for w in wallpapers)
    dev = Counter(w["deviceType"] for w in wallpapers)
    ext = Counter(Path(w["filename"]).suffix.lower().lstrip(".") for w in wallpapers)

    def dir_size(p: Path) -> int:
        if not p.exists():
            return 0
        return sum(f.stat().st_size for f in p.rglob("*") if f.is_file())

    def human(n: int) -> str:
        for u in ("B", "KB", "MB", "GB"):
            if n < 1024:
                return f"{n:.2f} {u}"
            n /= 1024
        return f"{n:.2f} TB"

    report = {
        "site": BASE_URL,
        "generated_at": time.strftime("%Y-%m-%d %H:%M:%S"),
        "total_wallpapers": len(wallpapers),
        "by_category": dict(cat),
        "by_device": dict(dev),
        "by_extension": dict(ext),
        "download_results": {
            "total_tasks": total,
            "success": ok,
            "failed": fail,
            "failed_urls": failed_list,
        },
        "disk_usage": {
            "images":     human(dir_size(out / "images")),
            "previews":   human(dir_size(out / "previews")),
            "thumbnails": human(dir_size(out / "thumbnails")),
            "videos":     human(dir_size(out / "videos")),
            "site":       human(dir_size(out / "site")),
            "total":      human(dir_size(out)),
        },
        "notes": [
            "所有资源 URL 均为明文直链，CDN 无鉴权/加密，无需 JS 逆向解密。",
            "动态壁纸(category=dynamic)使用 Apple HEIC 实况照片(Live Photo)格式，iOS 可直接设置为实时壁纸。",
            "在 Windows/Android 上查看 HEIC 需安装解码器(如 VLC / HEVC 扩展 / libheif)。",
            "视频(labubu_video*.mp4 / apple.mov)用于首页 Hero 演示，可独立播放。",
        ],
    }
    report_path = out / "download_report.json"
    report_path.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")

    # ---------- 输出一个人类可读 README ----------
    readme = out / "README.txt"
    readme.write_text(f"""Labubu Live Wallpaper 全站镜像下载
============================================
源站        : {BASE_URL}
抓取时间    : {report['generated_at']}
壁纸总数    : {len(wallpapers)}
  - 静态    : {cat.get('static',0)}
  - 动态    : {cat.get('dynamic',0)}  (HEIC 实况照片)
设备分布    : {dict(dev)}
文件类型    : {dict(ext)}

下载结果
  - 任务数  : {total}
  - 成功    : {ok}
  - 失败    : {fail}

磁盘占用
  - images/     (原图)        {report['disk_usage']['images']}
  - previews/   (预览图)      {report['disk_usage']['previews']}
  - thumbnails/ (缩略图)      {report['disk_usage']['thumbnails']}
  - videos/     (首页视频)    {report['disk_usage']['videos']}
  - site/       (站点HTML/CSS/JS) {report['disk_usage']['site']}
  - 合计        : {report['disk_usage']['total']}

目录结构
  downloads/
  ├── site/                    # 前端站点镜像
  │   ├── index.html           # 首页
  │   ├── zh.html ja.html ...  # 多语言页
  │   ├── assets/              # JS / CSS
  │   ├── robots.txt / sitemap.xml / favicon.ico
  ├── images/                  # 壁纸原图（HEIC/JPG/PNG/JPEG）
  ├── previews/                # 预览图（多数与原图相同）
  ├── thumbnails/              # CDN 缩放的缩略图（带 id 前缀）
  ├── videos/                  # 首页演示视频
  ├── wallpapers_manifest.json # 壁纸完整元数据清单
  ├── download_report.json     # 下载统计报告
  └── README.txt               # 本说明

技术说明
  1. 站点为 React/Vite SPA（Vercel 托管），数据硬编码在主 JS bundle 中，URL 全部
     明文硬编码，Cloudflare R2/CDN 公开直链，无鉴权/加密/混淆，无需逆向解密。
  2. 动态壁纸使用 Apple HEIC 实况照片（Live Photo）格式，iOS 可在相册直接设置为
     实时壁纸；Android/Windows 需另行转换或安装 HEVC 解码器。
  3. 缩略图是 Cloudflare Image Resizing（/cdn-cgi/image/...）实时裁剪版本，
     仅用于页面预览，原图在 images/ 目录。
  4. 断点续传：脚本中断后重新运行会跳过已下载完整的文件，自动续传 .part 临时文件。
  5. 全部壁纸元数据见 wallpapers_manifest.json，字段包括：id / category /
     deviceType / resolution / fileSize / thumbnail / preview / downloadUrl。

重新下载
  python3 crawler.py --out ./downloads              # 下载全部
  python3 crawler.py --out ./downloads --no-videos  # 跳过视频
  python3 crawler.py --out ./downloads --workers 16 # 增加并发
""", encoding="utf-8")

    log.info(f"(6/6) 完成。报告: {report_path}")
    if failed_list:
        log.warning(f"仍有 {len(failed_list)} 个文件下载失败，详见 download_report.json")
    log.info(f"全部数据已保存到: {out}")


if __name__ == "__main__":
    main()
