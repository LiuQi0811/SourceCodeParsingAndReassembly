#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
影猫の仓库 (www.ymck.pro) 全站爬虫
================================================
- 基于 requests + BeautifulSoup + 并发线程池
- 自动绕过 Cloudflare 对静态HTML的防护（使用真实浏览器UA + Referer）
- 支持分类列表分页、详情页元数据、图片资源、标签页/搜索页/单页
- 数据导出为 JSON / CSV
- 支持断点续爬、限速、失败重试
- 说明：该站为影视导航聚合站，播放源由前端 Vue 动态调用第三方搜索接口
        （页面本身没有加密的播放链接/m3u8，所有可爬取的元数据均已在HTML中渲染，
         无需逆向解密；本脚本只对SSR渲染的公开HTML进行抓取）
"""

import os
import re
import sys
import json
import time
import csv
import random
import logging
import hashlib
import threading
from urllib.parse import urljoin, urlparse, unquote
from concurrent.futures import ThreadPoolExecutor, as_completed
from collections import OrderedDict

import requests
from bs4 import BeautifulSoup

# ============ 配置区 ============
BASE_URL = "https://www.ymck.pro"
SAVE_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "ymck_data")
HTML_DIR = os.path.join(SAVE_DIR, "html")          # 原始HTML
IMG_DIR  = os.path.join(SAVE_DIR, "images")        # 海报图片
ASSET_DIR= os.path.join(SAVE_DIR, "assets")        # CSS/JS等静态资源
OUT_JSON = os.path.join(SAVE_DIR, "movies.json")
OUT_CSV  = os.path.join(SAVE_DIR, "movies.csv")
PROGRESS_FILE = os.path.join(SAVE_DIR, "progress.json")

# 分类ID -> 中文名（苹果CMS常见分类）
CATEGORIES = OrderedDict([
    (1, "电影"),
    (2, "剧集"),
    (3, "综艺"),
    (4, "动漫"),
    (5, "其他"),
    (6, "选片"),
])

MAX_WORKERS = 8          # 并发线程数
DELAY_MIN = 0.3          # 请求最小间隔(秒)
DELAY_MAX = 1.0          # 请求最大间隔(秒)
TIMEOUT = 15             # 超时秒数
MAX_RETRIES = 3          # 失败重试次数
SAVE_EVERY = 50          # 每爬N条写一次磁盘
DOWNLOAD_IMAGES = True   # 是否下载海报图片
DOWNLOAD_ASSETS = False  # 是否下载静态资源(CSS/JS/字体)
MIRROR_STATIC_PAGES = True  # 是否把HTML原样保存到本地做镜像

# 日志
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%H:%M:%S",
)
log = logging.getLogger("ymck")

# ============ 工具函数 ============
THREAD_LOCAL = threading.local()

def get_session():
    """每个线程独立Session，避免cookie污染"""
    if not hasattr(THREAD_LOCAL, "sess"):
        s = requests.Session()
        s.headers.update({
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
                          "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
            "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
            "Referer": BASE_URL + "/",
            "Connection": "keep-alive",
        })
        THREAD_LOCAL.sess = s
    return THREAD_LOCAL.sess

def polite_sleep():
    time.sleep(random.uniform(DELAY_MIN, DELAY_MAX))

def safe_get(url, **kwargs):
    """带重试的GET"""
    sess = get_session()
    last_err = None
    for i in range(MAX_RETRIES):
        try:
            polite_sleep()
            r = sess.get(url, timeout=TIMEOUT, **kwargs)
            if r.status_code == 200:
                # 检测是否被CF拦截
                if "Just a moment" in r.text[:500] or "cf-chl-bypass" in r.text[:500]:
                    last_err = "Cloudflare 5s盾"
                    time.sleep(2 ** i)
                    continue
                return r
            elif r.status_code == 404:
                return None
            last_err = f"HTTP {r.status_code}"
        except Exception as e:
            last_err = str(e)
        time.sleep(1.5 ** i)
    log.warning(f"GET 失败 {url} -> {last_err}")
    return None

def mkdir_p(p):
    os.makedirs(p, exist_ok=True)

def sanitize_filename(s):
    return re.sub(r'[\\/:*?"<>|]', "_", s).strip()[:120]

def url_to_local_path(url, base_dir):
    """把URL映射为本地保存路径"""
    u = url.split("?")[0].split("#")[0]
    if u.startswith("//"):
        u = "https:" + u
    if u.startswith("http"):
        p = urlparse(u).path
    else:
        p = u
    p = unquote(p.lstrip("/"))
    if not p or p.endswith("/"):
        p = os.path.join(p, "index.html")
    return os.path.join(base_dir, p)

def download_asset(url, base_dir):
    """下载静态资源到本地，返回本地路径（若成功）"""
    try:
        local = url_to_local_path(url, base_dir)
        if os.path.exists(local) and os.path.getsize(local) > 0:
            return local
        mkdir_p(os.path.dirname(local))
        headers = {}
        # 豆瓣/图床需要Referer
        if "doubanio.com" in url or "douban.com" in url:
            headers["Referer"] = "https://movie.douban.com/"
        r = safe_get(url, stream=True, headers=headers)
        if r is None:
            return None
        with open(local, "wb") as f:
            for chunk in r.iter_content(8192):
                if chunk:
                    f.write(chunk)
        return local
    except Exception as e:
        log.debug(f"资源下载失败 {url}: {e}")
        return None

# ============ 进度持久化 ============
def load_progress():
    if os.path.exists(PROGRESS_FILE):
        with open(PROGRESS_FILE, "r", encoding="utf-8") as f:
            return json.load(f)
    return {"done_list_pages": [], "done_detail_ids": [], "last_cat_page": {}}

def save_progress(prog):
    mkdir_p(SAVE_DIR)
    with open(PROGRESS_FILE, "w", encoding="utf-8") as f:
        json.dump(prog, f, ensure_ascii=False, indent=2)

# ============ 解析函数 ============
def parse_list_page(html, cat_id):
    """解析列表页，返回 (影片链接id+标题列表, 总页数)"""
    soup = BeautifulSoup(html, "html.parser")
    movies = []
    seen = set()
    for item in soup.select(".movie-list-item"):
        a = item.find("a", href=re.compile(r'^/movie/\d+\.html$'))
        if not a:
            continue
        href = a.get("href", "")
        m = re.match(r'^/movie/(\d+)\.html$', href)
        if not m:
            continue
        mid = int(m.group(1))
        if mid in seen:
            continue
        seen.add(mid)
        # 标题取标签文本，不用title属性（title属性会带"影片信息"后缀）
        title_el = item.select_one(".movie-title")
        title = title_el.get_text(strip=True) if title_el else ""
        poster = ""
        img_el = item.select_one(".movie-post-lazyload")
        if img_el:
            poster = img_el.get("data-original", "")
        movies.append({"id": mid, "title": title, "poster": poster, "cat_id": cat_id})
    # 总页数
    total_pages = 1
    # 先找尾页链接（格式: /show/1--------2243---.html）
    tail = soup.select_one("a[title='尾页']")
    if tail:
        mm = re.search(r'-+(\d+)---\.html', tail.get("href", ""))
        if mm:
            total_pages = int(mm.group(1))
    if total_pages == 1:
        # 取最大数字页码
        nums = []
        for a in soup.select("#page a"):
            mm = re.search(r'-+(\d+)---\.html', a.get("href", ""))
            if mm:
                nums.append(int(mm.group(1)))
        if nums:
            total_pages = max(nums)
    return movies, total_pages

def parse_detail_page(html, mid):
    """解析详情页，返回影片元数据字典"""
    soup = BeautifulSoup(html, "html.parser")
    data = {"id": mid, "url": f"{BASE_URL}/movie/{mid}.html"}

    # 标题
    h1 = soup.select_one("h1.movie-title")
    data["title"] = h1.get("title", "").strip() if h1 else ""
    if not data["title"] and h1:
        data["title"] = h1.get_text(strip=True)

    # 海报
    poster_el = soup.select_one(".poster img")
    data["poster"] = poster_el.get("src", "").strip() if poster_el else ""

    # 分类 / 年份 / 语言
    scroll = soup.select_one(".scroll-content")
    cats, years, langs = [], [], []
    if scroll:
        for a in scroll.find_all("a"):
            href = a.get("href", "")
            txt = a.get_text(strip=True)
            if "/search/class/" in href:
                cats.append(txt)
            elif "/search/year/" in href:
                years.append(txt)
            else:
                langs.append(txt)
        if not years and scroll.get_text(strip=True):
            ym = re.findall(r'(19|20)\d{2}', scroll.get_text(strip=True))
            years = ["".join(y) for y in ym]
    data["categories"] = cats
    data["year"] = years[0] if years else ""
    data["language"] = "、".join(langs) if langs else ""

    # 别名
    alias_p = soup.find("p", class_="text-muted", string=re.compile("别名"))
    if not alias_p:
        alias_p = soup.find(string=re.compile("别名"))
        if alias_p:
            alias_p = alias_p.find_parent("p")
    data["alias"] = ""
    if alias_p:
        txt = alias_p.get_text(" ", strip=True)
        mm = re.search(r'别名[：:]\s*(.+)', txt)
        if mm:
            data["alias"] = mm.group(1).strip()

    # 豆瓣评分
    data["rating"] = ""
    rating_span = None
    for span in soup.find_all("span"):
        if span.get_text(strip=True).replace(".", "").isdigit():
            prev = span.find_previous("span")
            if prev and "豆瓣评分" in prev.get_text():
                rating_span = span
                break
    if rating_span:
        data["rating"] = rating_span.get_text(strip=True)

    # 导演
    data["director"] = ""
    for p in soup.select(".detailsTxt p, .summary p"):
        txt = p.get_text(" ", strip=True)
        if "导演" in txt:
            directors = [a.get_text(strip=True) for a in p.find_all("a")]
            data["director"] = "、".join(directors)
            break

    # 演员
    data["actors"] = []
    for p in soup.select(".detailsTxt p, .summary p"):
        txt = p.get_text(" ", strip=True)
        if "演员" in txt:
            data["actors"] = [a.get_text(strip=True) for a in p.find_all("a")]
            break

    # 简介
    data["intro"] = ""
    for div in soup.select(".detailsTxt, .summary"):
        txt = div.get_text(" ", strip=True)
        if "简介" in txt:
            mm = re.search(r'简介[：:]\s*(.+?)(?:展开|$)', txt)
            if mm:
                data["intro"] = mm.group(1).strip()
                # 去掉展开按钮文字
                data["intro"] = re.sub(r'\s*展开\s*$', '', data["intro"]).strip()
            break

    return data

# ============ 单页抓取 ============
def fetch_list_page(cat_id, page):
    url = f"{BASE_URL}/show/{cat_id}--------{page}---.html"
    r = safe_get(url)
    if r is None:
        return None, 0
    html = r.text
    if MIRROR_STATIC_PAGES:
        local = os.path.join(HTML_DIR, f"show_{cat_id}_page_{page}.html")
        mkdir_p(os.path.dirname(local))
        with open(local, "w", encoding="utf-8") as f:
            f.write(html)
    return parse_list_page(html, cat_id)

def fetch_detail(mid):
    url = f"{BASE_URL}/movie/{mid}.html"
    r = safe_get(url)
    if r is None:
        return None
    html = r.text
    if MIRROR_STATIC_PAGES:
        local = os.path.join(HTML_DIR, f"movie_{mid}.html")
        mkdir_p(os.path.dirname(local))
        with open(local, "w", encoding="utf-8") as f:
            f.write(html)
    data = parse_detail_page(html, mid)

    # 下载海报
    if DOWNLOAD_IMAGES and data.get("poster"):
        local = download_asset(data["poster"], IMG_DIR)
        if local:
            data["poster_local"] = local

    # 下载页面内引用的本站静态资源
    if DOWNLOAD_ASSETS:
        soup = BeautifulSoup(html, "html.parser")
        for tag in soup.find_all(["link", "script", "img"]):
            src = tag.get("href") or tag.get("src")
            if src and not src.startswith("http") and not src.startswith("//"):
                download_asset(urljoin(BASE_URL, src), ASSET_DIR)
            elif src and (BASE_URL in src or src.startswith("//www.ymck.pro")):
                download_asset(src if src.startswith("http") else "https:"+src, ASSET_DIR)

    return data

# ============ 主流程 ============
def crawl():
    mkdir_p(SAVE_DIR); mkdir_p(HTML_DIR); mkdir_p(IMG_DIR); mkdir_p(ASSET_DIR)
    progress = load_progress()
    done_ids = set(progress.get("done_detail_ids", []))
    done_lists = set(tuple(x) if isinstance(x, list) else x for x in progress.get("done_list_pages", []))
    all_movies = {}
    # 已有数据
    if os.path.exists(OUT_JSON):
        try:
            with open(OUT_JSON, "r", encoding="utf-8") as f:
                for m in json.load(f):
                    all_movies[m["id"]] = m
        except Exception:
            pass

    # 加载已完成的ID
    for mid in all_movies:
        done_ids.add(mid)

    log.info("开始抓取列表页……")
    total_new = 0
    pending_details = []

    # 先抓首页确认分类&尾页
    log.info("抓取首页")
    r0 = safe_get(BASE_URL + "/")
    if r0:
        if MIRROR_STATIC_PAGES:
            with open(os.path.join(HTML_DIR, "index.html"), "w", encoding="utf-8") as f:
                f.write(r0.text)
        # 首页的影片
        movies0, _ = parse_list_page(r0.text, 1)
        for m in movies0:
            if m["id"] not in all_movies and m["id"] not in done_ids:
                all_movies[m["id"]] = m
                pending_details.append(m["id"])

    # 遍历每个分类
    for cat_id, cat_name in CATEGORIES.items():
        log.info(f"== 分类 [{cat_id}] {cat_name} ==")
        # 第1页探测总页数
        first_page = 1
        if (cat_id, first_page) not in done_lists:
            movies, total_pages = fetch_list_page(cat_id, first_page)
            if movies is None:
                log.warning(f"分类{cat_name}第1页抓取失败，跳过")
                continue
            new_cnt = 0
            for m in movies:
                if m["id"] not in all_movies:
                    all_movies[m["id"]] = m
                    if m["id"] not in done_ids:
                        pending_details.append(m["id"])
                        new_cnt += 1
            done_lists.add((cat_id, first_page))
            log.info(f"  第1页完成，新增 {new_cnt} 部，总页数 {total_pages}")
        else:
            total_pages = progress.get("last_cat_page", {}).get(str(cat_id), 3000)
            log.info(f"  第1页已爬过，按上次记录总页数 {total_pages}")

        # 从第2页开始并发抓取
        pages_to_fetch = [p for p in range(2, total_pages+1) if (cat_id, p) not in done_lists]
        log.info(f"  待抓取分页 {len(pages_to_fetch)} 个，并发 {MAX_WORKERS}")
        with ThreadPoolExecutor(max_workers=MAX_WORKERS) as ex:
            futures = {ex.submit(fetch_list_page, cat_id, p): p for p in pages_to_fetch}
            done_count = 0
            for fut in as_completed(futures):
                p = futures[fut]
                try:
                    movies, tp = fut.result()
                    if movies is None:
                        continue
                    if tp > total_pages:
                        total_pages = tp
                    for m in movies:
                        if m["id"] not in all_movies:
                            all_movies[m["id"]] = m
                            if m["id"] not in done_ids:
                                pending_details.append(m["id"])
                    done_lists.add((cat_id, p))
                    done_count += 1
                    total_new += len(movies)
                    if done_count % 20 == 0:
                        log.info(f"  [{cat_name}] 已完成 {done_count}/{len(pages_to_fetch)} 页，累计影片 {len(all_movies)}")
                        progress["done_list_pages"] = [list(x) for x in done_lists]
                        progress["last_cat_page"] = {str(k): v for k, v in progress.get("last_cat_page", {}).items()}
                        progress["last_cat_page"][str(cat_id)] = total_pages
                        save_progress(progress)
                        flush_data(all_movies)
                except Exception as e:
                    log.error(f"  分类{cat_name}第{p}页处理异常: {e}")
        progress["done_list_pages"] = [list(x) for x in done_lists]
        progress["last_cat_page"][str(cat_id)] = total_pages
        save_progress(progress)
        flush_data(all_movies)
        log.info(f"  分类 {cat_name} 列表抓取完成，累计影片 {len(all_movies)}")

    log.info(f"列表抓取完毕，共发现 {len(all_movies)} 部影片，待抓详情 {len(pending_details)}")

    # ============ 详情页 ============
    # 补充未抓过详情的影片
    to_fetch_details = [mid for mid in all_movies if mid not in done_ids]
    log.info(f"开始抓取详情页，共 {len(to_fetch_details)} 个")
    with ThreadPoolExecutor(max_workers=MAX_WORKERS) as ex:
        futures = {ex.submit(fetch_detail, mid): mid for mid in to_fetch_details}
        done_count = 0
        for fut in as_completed(futures):
            mid = futures[fut]
            try:
                detail = fut.result()
                if detail:
                    # 合并列表已有信息（如cat_id）
                    old = all_movies.get(mid, {})
                    old.update(detail)
                    all_movies[mid] = old
                    done_ids.add(mid)
                done_count += 1
                if done_count % SAVE_EVERY == 0:
                    log.info(f"  详情进度 {done_count}/{len(to_fetch_details)}")
                    progress["done_detail_ids"] = list(done_ids)
                    save_progress(progress)
                    flush_data(all_movies)
            except Exception as e:
                log.error(f"  详情 {mid} 异常: {e}")

    progress["done_detail_ids"] = list(done_ids)
    save_progress(progress)
    flush_data(all_movies)
    write_csv(all_movies)

    log.info("=" * 50)
    log.info(f"全站抓取完成！")
    log.info(f"  影片总数: {len(all_movies)}")
    log.info(f"  数据目录: {SAVE_DIR}")
    log.info(f"  JSON: {OUT_JSON}")
    log.info(f"  CSV:  {OUT_CSV}")
    log.info(f"  HTML镜像: {HTML_DIR}")
    if DOWNLOAD_IMAGES:
        log.info(f"  图片: {IMG_DIR}")
    log.info("=" * 50)
    return all_movies

def flush_data(all_movies):
    mkdir_p(SAVE_DIR)
    # 按id排序
    items = sorted(all_movies.values(), key=lambda x: x.get("id", 0))
    with open(OUT_JSON, "w", encoding="utf-8") as f:
        json.dump(items, f, ensure_ascii=False, indent=2)

def write_csv(all_movies):
    items = sorted(all_movies.values(), key=lambda x: x.get("id", 0))
    fields = ["id", "title", "alias", "year", "rating", "categories",
              "director", "actors", "language", "intro", "poster", "url"]
    with open(OUT_CSV, "w", encoding="utf-8-sig", newline="") as f:
        w = csv.DictWriter(f, fieldnames=fields, extrasaction="ignore")
        w.writeheader()
        for m in items:
            row = dict(m)
            if isinstance(row.get("categories"), list):
                row["categories"] = "、".join(row["categories"])
            if isinstance(row.get("actors"), list):
                row["actors"] = "、".join(row["actors"])
            w.writerow(row)

# ============ 单页面/标签页补充抓取 ============
def crawl_static_pages():
    """抓取首页上的静态页面（帮助/合作/举报/免责/APP等）"""
    static_urls = [
        "/gbook.html",
        "/label/hezuo.html",
        "/label/jubao.html",
        "/label/mianze.html",
        "/label/service.html",
        "/label/app.html",
        "/label/ios-down.html",
    ]
    log.info("抓取静态单页……")
    for u in static_urls:
        r = safe_get(BASE_URL + u)
        if r and MIRROR_STATIC_PAGES:
            local = os.path.join(HTML_DIR, u.lstrip("/"))
            mkdir_p(os.path.dirname(local))
            with open(local, "w", encoding="utf-8") as f:
                f.write(r.text)
            log.info(f"  已保存 {u}")

# ============ 入口 ============
if __name__ == "__main__":
    import argparse
    p = argparse.ArgumentParser(description="ymck.pro 全站爬虫")
    p.add_argument("--no-images", action="store_true", help="不下载海报")
    p.add_argument("--no-assets", action="store_true", help="不下载CSS/JS等静态资源")
    p.add_argument("--workers", type=int, default=MAX_WORKERS, help="并发数")
    p.add_argument("--only-detail", type=str, default="", help="仅抓取指定影片ID(逗号分隔)，用于测试/补抓")
    p.add_argument("--cat", type=str, default="", help="仅抓取指定分类ID(逗号分隔)，如 1,2")
    args = p.parse_args()

    if args.no_images:
        DOWNLOAD_IMAGES = False
    if args.no_assets:
        DOWNLOAD_ASSETS = False
    if args.workers:
        MAX_WORKERS = args.workers

    mkdir_p(SAVE_DIR)
    crawl_static_pages()

    if args.only_detail:
        ids = [int(x) for x in args.only_detail.split(",") if x.strip().isdigit()]
        log.info(f"仅抓取详情: {ids}")
        results = {}
        with ThreadPoolExecutor(max_workers=MAX_WORKERS) as ex:
            for mid, d in zip(ids, ex.map(fetch_detail, ids)):
                if d:
                    results[mid] = d
                    log.info(f"  {mid} -> {d.get('title')}")
        flush_data(results)
        write_csv(results)
    else:
        if args.cat:
            cats = [int(x) for x in args.cat.split(",") if x.strip().isdigit()]
            CATEGORIES = OrderedDict((cid, CATEGORIES.get(cid, str(cid))) for cid in cats)
        crawl()
