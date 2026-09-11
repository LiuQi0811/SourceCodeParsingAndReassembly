#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
wallpapers-clan.com 全站爬虫 v2
===================================
更新：使用网站 sitemap.xml 直接获取全站所有详情页URL，彻底绕过WP Rocket分页缓存问题。
     使用 curl_cffi（模拟 Chrome 120 TLS 指纹）稳定绕过 Cloudflare。

覆盖板块（均自动从sitemap识别）：
  - desktop-wallpapers  桌面壁纸       （WPDM下载4K原图，单张JPG）
  - wallpapers          手机/综合壁纸  （直接解析主图，去-scaled取原图）
  - app-icons           App图标包      （WPDM下载ZIP包）
  - folder-icons        文件夹图标包   （WPDM下载ZIP包）
  - pfp                 头像           （直接抓GIF/PNG/JPG）
  - highlight-covers    Instagram封面  （直接抓图）
  - sticker-png         贴纸PNG包      （WPDM下载ZIP包）

特性：
  ✅ 断点续爬（state.json）  ✅ 多线程并发  ✅ 失败重试  ✅ Cloudflare自动恢复
  ✅ 详细日志                ✅ 文件去重     ✅ 速率控制
"""

import os
import re
import sys
import json
import time
import random
import logging
import hashlib
from pathlib import Path
from urllib.parse import urlparse, unquote
from concurrent.futures import ThreadPoolExecutor, as_completed
from threading import Lock

from curl_cffi import requests as curl_requests
from bs4 import BeautifulSoup

# ============ 配置 ============
BASE_URL = "https://wallpapers-clan.com"
SAVE_ROOT = Path("./wallpapers_clan_downloads")
STATE_FILE = Path("./wallpapers_clan_state.json")
MAX_WORKERS = 3
REQUEST_DELAY = (0.6, 1.8)
DOWNLOAD_DELAY = (0.3, 1.0)
MAX_RETRIES = 5
TIMEOUT = 45
BROWSER_FINGERPRINT = "chrome120"  # curl_cffi impersonate 目标

# Sitemap -> 板块配置
# section: 保存用目录名
# extract: 详情页资源提取策略 (wpdm=WordPress Download Manager按钮; direct_imgs=页面主图直链)
SECTION_SITEMAPS = {
    "desktop-wallpapers": {
        "sitemaps": [f"/dwallpapers-sitemap{i}.xml" for i in range(1, 12)],
        "extract": "wpdm",
        "url_prefix": "https://wallpapers-clan.com/desktop-wallpapers/",
    },
    "wallpapers": {
        "sitemaps": [f"/portfolio-sitemap{i}.xml" for i in range(1, 12)],
        "extract": "direct_imgs",
        "url_prefix": "https://wallpapers-clan.com/wallpapers/",
    },
    "app-icons": {
        "sitemaps": ["/appicons-sitemap.xml"],
        "extract": "wpdm",
        "url_prefix": "https://wallpapers-clan.com/app-icons/",
    },
    "folder-icons": {
        "sitemaps": ["/foldericons-sitemap.xml"],
        "extract": "wpdm",
        "url_prefix": "https://wallpapers-clan.com/folder-icons/",
    },
    "pfp": {
        "sitemaps": ["/pfp-sitemap.xml"],
        "extract": "direct_imgs",
        "url_prefix": "https://wallpapers-clan.com/pfp/",
    },
    "highlight-covers": {
        "sitemaps": ["/covers-sitemap.xml"],
        "extract": "direct_imgs",
        "url_prefix": "https://wallpapers-clan.com/highlight-covers/",
    },
    "sticker-png": {
        "sitemaps": [f"/sticker-sitemap{i}.xml" for i in range(1, 4)],
        "extract": "wpdm",
        "url_prefix": "https://wallpapers-clan.com/sticker-png/",
    },
}

# ============ 日志 ============
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%H:%M:%S",
    handlers=[
        logging.StreamHandler(sys.stdout),
        logging.FileHandler("wallpapers_clan_spider.log", encoding="utf-8"),
    ],
)
log = logging.getLogger("spider")

# ============ 全局状态 ============
state = {
    "detail_pages": {},     # url -> {title, section, files: [{url,source}]}
    "downloaded": set(),    # 已下载的文件URL
    "failed": {},           # url -> 失败次数
    "sitemaps_fetched": set(),
}
state_lock = Lock()


def load_state():
    if STATE_FILE.exists():
        try:
            with open(STATE_FILE, "r", encoding="utf-8") as f:
                d = json.load(f)
            state["detail_pages"] = d.get("detail_pages", {})
            state["downloaded"] = set(d.get("downloaded", []))
            state["failed"] = d.get("failed", {})
            state["sitemaps_fetched"] = set(d.get("sitemaps_fetched", []))
            log.info(f"已加载断点：已解析详情 {len(state['detail_pages'])}，已下载文件 {len(state['downloaded'])}")
        except Exception as e:
            log.warning(f"读取状态失败: {e}，全新启动")


def save_state():
    with state_lock:
        d = {
            "detail_pages": state["detail_pages"],
            "downloaded": list(state["downloaded"]),
            "failed": state["failed"],
            "sitemaps_fetched": list(state["sitemaps_fetched"]),
        }
        tmp = STATE_FILE.with_suffix(".tmp")
        with open(tmp, "w", encoding="utf-8") as f:
            json.dump(d, f, ensure_ascii=False, indent=1)
        tmp.replace(STATE_FILE)


def new_session():
    return curl_requests.Session(impersonate=BROWSER_FINGERPRINT)


_tls = Lock()
def request_with_retry(session, method, url, stream=False, **kwargs):
    last_err = None
    for attempt in range(1, MAX_RETRIES + 1):
        try:
            kwargs.setdefault("timeout", TIMEOUT)
            r = getattr(session, method)(url, stream=stream, allow_redirects=True, **kwargs)
            if r.status_code == 403 or (not stream and "Just a moment" in r.text[:500]):
                log.debug(f"CF拦截 {url}，重建session (try {attempt})")
                time.sleep(2 * attempt)
                session = new_session()
                continue
            if r.status_code >= 500:
                time.sleep(2 * attempt)
                continue
            if r.status_code == 404:
                return r, session
            if r.status_code == 429:
                log.warning(f"速率限制 {url}，等待 {10*attempt}s")
                time.sleep(10 * attempt)
                continue
            return r, session
        except Exception as e:
            last_err = e
            time.sleep(1.5 * attempt)
    raise RuntimeError(f"请求失败 {method} {url}: {last_err}")


# ============ Sitemap 解析 ============

def fetch_sitemap_urls(session, section_name):
    """拉取指定板块的所有详情页URL（过滤掉板块首页/分类页）"""
    cfg = SECTION_SITEMAPS[section_name]
    prefix = cfg["url_prefix"]
    urls = []
    for sm_path in cfg["sitemaps"]:
        sm_url = BASE_URL + sm_path
        if sm_url in state["sitemaps_fetched"]:
            continue
        r, session = request_with_retry(session, "get", sm_url)
        if r.status_code != 200:
            log.warning(f"sitemap获取失败 {sm_url}: {r.status_code}")
            continue
        for loc in re.findall(r"<loc>([^<]+)</loc>", r.text):
            loc = loc.strip()
            # 必须以板块prefix开头，且不是板块首页/分类页
            if not loc.startswith(prefix):
                continue
            slug = loc[len(prefix):].rstrip("/")
            if not slug:  # 板块首页本身
                continue
            if slug.startswith("category/") or slug.startswith("tag/") or slug.startswith("page/"):
                continue
            urls.append(loc.rstrip("/") + "/")
        with state_lock:
            state["sitemaps_fetched"].add(sm_url)
        time.sleep(random.uniform(0.3, 0.8))
    # 去重保序
    seen = set()
    out = []
    for u in urls:
        if u not in seen:
            seen.add(u)
            out.append(u)
    return out, session


# ============ 详情页解析 ============

def extract_wpdm(html):
    """WordPress Download Manager 下载链接（4K jpg 或 zip 包）"""
    m = re.search(r'data-downloadurl="([^"]+)"', html)
    if not m:
        return []
    return [{"url": m.group(1).replace("&amp;", "&"), "source": "wpdm"}]


def extract_direct_imgs(html):
    """直接从页面主内容区提取原图URL（去-scaled、去尺寸后缀、过滤小图/侧栏/预览）"""
    soup = BeautifulSoup(html, "html.parser")
    main = soup.find("article") or soup.find("main") or soup
    # 移除无关块
    for sel in [".related", ".sidebar", ".widget", ".related-posts", ".similar",
                ".recommended", "nav", "footer", "header", ".qodef-related-posts",
                ".wpdm-card", ".comments", ".social-share", ".author-info",
                ".instagram-feed", ".sbi", ".ad", ".advads", "script", "style", "noscript"]:
        for bad in main.select(sel):
            bad.decompose()

    results, seen = [], set()
    for img in main.find_all("img"):
        # 优先级：data-lazy-src > data-src > data-original > srcset > src
        # （svg/base64占位图常塞在 src 里，真实图在 data-* 或 srcset）
        src = ""
        for attr in ("data-lazy-src", "data-src", "data-original"):
            v = img.get(attr)
            if v and not v.startswith("data:"):
                src = v
                break
        if not src:
            ds = img.get("srcset") or img.get("data-srcset") or ""
            if ds:
                # srcset第一候选
                first = ds.split(",")[0].strip().split(" ")[0]
                if first and not first.startswith("data:"):
                    src = first
        if not src:
            s = img.get("src") or ""
            if s and not s.startswith("data:"):
                src = s
        src = src.strip()
        if not src:
            continue
        if "wallpapers-clan.com/wp-content/uploads" not in src:
            continue
        if any(skip in src for skip in [
            "w-clan-logo", "cropped-wallpapers", "/plugins/",
            "placeholder", "svg+xml",
            "/sb-instagram-feed-images/",
        ]):
            continue
        # 规范化：先去尺寸后缀
        src = re.sub(r'-\d+x\d+\.(jpg|jpeg|png|webp)$', r'.\1', src)
        # 去-scaled
        src = src.replace("-scaled.", ".")
        # 合集页预览图：-preview-N.jpg -> -N.jpg；单图 -preview.jpg -> .jpg；同理-cover
        src = re.sub(r'-preview-(\d+)\.(jpg|jpeg|png|webp)$', r'-\1.\2', src)
        src = src.replace("-preview.", ".")
        src = re.sub(r'-cover-(\d+)\.(jpg|jpeg|png|webp)$', r'-\1.\2', src)
        src = src.replace("-cover.", ".")
        # 去掉查询串
        src = src.split("?")[0]
        if src in seen:
            continue
        # 尺寸过滤：小图标跳过
        w = int(img.get("width", 0) or 0)
        h = int(img.get("height", 0) or 0)
        if w and h and w < 400 and h < 400 and "pfp" not in src:
            continue
        if re.search(r'\.(jpg|jpeg|png|webp|gif)$', src, re.I):
            seen.add(src)
            results.append({"url": src, "source": "direct"})
    return results


def parse_detail(session, section_name, url):
    """抓取并解析详情页，返回（files列表, title）"""
    if url in state["detail_pages"]:
        return state["detail_pages"][url], session
    r, session = request_with_retry(session, "get", url)
    if r.status_code != 200:
        return None, session
    soup = BeautifulSoup(r.text, "html.parser")
    h1 = soup.find("h1")
    title = h1.get_text(strip=True) if h1 else url.rstrip("/").split("/")[-1]
    cfg = SECTION_SITEMAPS[section_name]
    files = extract_wpdm(r.text) if cfg["extract"] == "wpdm" else extract_direct_imgs(r.text)
    info = {"title": title, "url": url, "section": section_name, "files": files}
    with state_lock:
        state["detail_pages"][url] = info
    return info, session


# ============ 文件下载 ============

def guess_filename(url, content_disposition="", content_type=""):
    if content_disposition:
        m = re.search(r'filename\*?=(?:UTF-8\'\')?"?([^";]+)"?', content_disposition, re.I)
        if m:
            return unquote(m.group(1).strip())
    name = os.path.basename(urlparse(url).path.split("?")[0])
    if not name or "." not in name:
        name = hashlib.md5(url.encode()).hexdigest()[:12]
        ext = ".bin"
        if "zip" in content_type: ext = ".zip"
        elif "jpeg" in content_type: ext = ".jpg"
        elif "png" in content_type: ext = ".png"
        elif "gif" in content_type: ext = ".gif"
        name += ext
    return unquote(name)


def sanitize(name):
    return re.sub(r'[\\/:*?"<>|]', "_", name).strip().rstrip(".")[:150]


def download_file(session, section, title, file_info):
    url = file_info["url"]
    if url in state["downloaded"]:
        return True, session
    sec_dir = SAVE_ROOT / sanitize(section) / sanitize(title)
    sec_dir.mkdir(parents=True, exist_ok=True)

    def _try(u):
        nonlocal session
        try:
            r, session = request_with_retry(session, "get", u, stream=True)
        except Exception as e:
            return None, session, e
        if r.status_code != 200:
            try: r.close()
            except: pass
            return None, session, f"status {r.status_code}"
        return r, session, None

    # direct 源可能需要回退到 preview 图（合集页里原图URL可能不存在）
    candidates = [url]
    if file_info.get("source") == "direct":
        # 构造回退URLs（原图 -> preview -> cover）
        for alt in [re.sub(r'-(\d+)\.(jpg|jpeg|png|webp)$', r'-preview-\1.\2', url),
                    url.replace('.jpg','-preview.jpg').replace('.png','-preview.png').replace('.jpeg','-preview.jpeg'),
                    url.replace('.jpg','-cover.jpg').replace('.png','-cover.png')]:
            if alt != url and alt not in candidates:
                candidates.append(alt)

    r = None
    last_err = None
    for cand in candidates:
        r, session, last_err = _try(cand)
        if r is not None:
            url = cand
            break
        time.sleep(0.5)

    if r is None:
        log.warning(f"下载失败（已试{len(candidates)}个URL） {url[:80]}: {last_err}")
        with state_lock:
            state["failed"][url] = state["failed"].get(url, 0) + 1
        return False, session

    cd = r.headers.get("content-disposition", "")
    ctype = r.headers.get("content-type", "")
    fname = sanitize(guess_filename(url, cd, ctype))
    fpath = sec_dir / fname
    if fpath.exists() and fpath.stat().st_size > 1000:
        with state_lock:
            state["downloaded"].add(url)
        return True, session

    tmp = fpath.with_suffix(fpath.suffix + ".part")
    total = 0
    try:
        with open(tmp, "wb") as f:
            for chunk in r.iter_content(chunk_size=128 * 1024):
                if chunk:
                    f.write(chunk)
                    total += len(chunk)
        # 关闭响应（重要：释放连接）
        r.close()
        if total < 300:
            raise RuntimeError(f"文件过小({total}B)")
        tmp.replace(fpath)
        size_str = f"{total/1024:.1f} KB" if total < 1024*1024 else f"{total/1024/1024:.2f} MB"
        log.info(f"✔ [{section}] {title[:45]}/{fname}  ({size_str})")
        with state_lock:
            state["downloaded"].add(url)
        time.sleep(random.uniform(*DOWNLOAD_DELAY))
        return True, session
    except Exception as e:
        log.warning(f"写入失败 {fname}: {e}")
        if tmp.exists():
            try: tmp.unlink()
            except: pass
        with state_lock:
            state["failed"][url] = state["failed"].get(url, 0) + 1
        return False, session


# ============ 主流程 ============

import threading
thread_local = threading.local()

def get_session():
    s = getattr(thread_local, "session", None)
    if s is None:
        s = new_session()
        thread_local.session = s
    return s


def _process_one(section_name, url):
    """线程worker：解析详情页 + 下载全部文件。返回 (url, 文件数)"""
    session = get_session()
    try:
        info, _ = parse_detail(session, section_name, url)
    except Exception as e:
        log.debug(f"解析失败 {url}: {e}")
        time.sleep(1)
        return url, 0
    if not info:
        return url, 0
    if not info["files"]:
        return url, 0
    dl_ok = 0
    for fi in info["files"]:
        try:
            ok, _ = download_file(session, section_name, info["title"], fi)
            if ok:
                dl_ok += 1
        except Exception as e:
            log.debug(f"下载异常 {url}: {e}")
    return url, dl_ok


def crawl_section(section_name):
    log.info(f"====== 板块：{section_name} ======")
    init_session = new_session()
    detail_urls, _ = fetch_sitemap_urls(init_session, section_name)
    total = len(detail_urls)
    pending = [u for u in detail_urls if u not in state["detail_pages"]
               or not state["detail_pages"][u].get("files")]
    done_cnt = total - len(pending)
    log.info(f"共 {total} 个详情页（已完成 {done_cnt}，待处理 {len(pending)}），并发={MAX_WORKERS}")

    processed = done_cnt
    success_files = len(state["downloaded"])
    save_every = 30
    with ThreadPoolExecutor(max_workers=MAX_WORKERS) as ex:
        futures = {ex.submit(_process_one, section_name, u): u for u in pending}
        for fut in as_completed(futures):
            url = futures[fut]
            try:
                _, dl = fut.result()
            except Exception as e:
                log.error(f"worker异常 {url}: {e}")
                dl = 0
            processed += 1
            if processed % save_every == 0:
                save_state()
                log.info(f"[{section_name}] 进度 {processed}/{total}  已下载文件={len(state['downloaded'])}")
    save_state()
    log.info(f"====== {section_name} 完成，共处理 {processed}/{total}，累计下载文件={len(state['downloaded'])} ======")


def crawl_all(sections=None):
    SAVE_ROOT.mkdir(exist_ok=True)
    load_state()
    targets = sections or list(SECTION_SITEMAPS.keys())
    log.info(f"开始爬取 {len(targets)} 个板块: {targets}")
    log.info(f"线程数: {MAX_WORKERS}")
    t0 = time.time()
    for sec in targets:
        try:
            crawl_section(sec)
        except KeyboardInterrupt:
            log.info("中断，保存状态...")
            save_state()
            raise
        except Exception as e:
            log.error(f"板块 {sec} 异常: {e}", exc_info=True)
            save_state()
    save_state()
    log.info(f"全部完成！用时 {(time.time()-t0)/60:.1f} 分钟")
    log.info(f"详情页总数: {len(state['detail_pages'])}，已下载文件: {len(state['downloaded'])}")
    log.info(f"失败 {sum(state['failed'].values())} 次")
    print_summary()


def print_summary():
    print("\n" + "="*60)
    print("爬取汇总")
    print("="*60)
    print(f"已解析详情页: {len(state['detail_pages'])}")
    print(f"已下载文件数: {len(state['downloaded'])}")
    from collections import Counter
    c = Counter(info['section'] for info in state['detail_pages'].values())
    for s, n in sorted(c.items()):
        print(f"  {s:25s}: {n:>6} 个详情")
    if SAVE_ROOT.exists():
        total_size = total_files = 0
        for p in SAVE_ROOT.rglob("*"):
            if p.is_file():
                total_files += 1
                total_size += p.stat().st_size
        print(f"\n磁盘文件: {total_files} 个")
        print(f"总大小: {total_size/1024/1024:.1f} MB  ({total_size/1024/1024/1024:.2f} GB)")


if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser(description="wallpapers-clan.com 全站爬虫 v2（基于sitemap）")
    parser.add_argument("--section", "-s", nargs="*", help="指定板块，如 desktop-wallpapers app-icons")
    parser.add_argument("--list", action="store_true", help="列出所有板块和规模")
    parser.add_argument("--summary", action="store_true", help="查看已爬进度")
    parser.add_argument("--workers", "-w", type=int, default=MAX_WORKERS, help=f"并发线程数（默认{MAX_WORKERS}）")
    args = parser.parse_args()

    if args.list:
        print("板块列表：")
        for k, v in SECTION_SITEMAPS.items():
            print(f"  {k:25s} sitemaps={len(v['sitemaps']):2d}  策略={v['extract']}")
        sys.exit(0)
    if args.summary:
        load_state()
        print_summary()
        sys.exit(0)
    if args.workers:
        MAX_WORKERS = args.workers
    crawl_all(args.section)
