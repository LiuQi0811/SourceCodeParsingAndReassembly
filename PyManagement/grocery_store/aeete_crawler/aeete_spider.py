#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Auete影视网 (https://www.aeete.com/) 全站爬虫
================================================
功能：
  1. 抓取所有分类（电影/电视剧/综艺/动漫/其他）下的全部影片列表
  2. 进入每部影片详情页，解析：片名/别名/导演/编剧/主演/分类/语言/地区/
     上映年份/时长/备注/简介/封面图/热度/更新时间
  3. 进入每一集的播放页，用 Base64 解密出真实 m3u8 播放地址
  4. 数据保存为 JSON（每部影片一个文件）+ CSV 索引 +  SQLite 数据库
  5. 支持断点续爬、失败重试、随机延时、伪造 User-Agent、可选代理
  6. 视频资源本身(m3u8/ts)不下载（版权原因），仅保存元信息与直链

加密逆向说明：
  - 播放页中 m3u8 地址通过 var now=base64decode("xxxx") 内嵌
  - base64decode 为标准 UTF-8 Base64，使用 Python 标准库 base64 即可完美解密
  - 无 JS 混淆、无签名、无 token、无 cookie 反爬，非常简单

使用：
  pip install requests beautifulsoup4 lxml
  python aeete_spider.py                 # 默认全量抓取
  python aeete_spider.py --max-pages 5   # 每个分类最多抓5页（测试用）
  python aeete_spider.py --delay 1.5     # 请求间隔秒数
  python aeete_spider.py --proxy http://127.0.0.1:7890   # 可选代理
"""

import os
import re
import sys
import json
import time
import base64
import random
import sqlite3
import csv
import logging
import argparse
import threading
from urllib.parse import urljoin, urlparse
from concurrent.futures import ThreadPoolExecutor, as_completed

import requests
from bs4 import BeautifulSoup

# ============== 配置 ==============
BASE_URL = "https://www.aeete.com"
HEADERS_POOL = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:128.0) Gecko/20100101 Firefox/128.0",
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
]

# 五大一级分类及其入口
CATEGORIES = {
    "电影":   "/Movie/index.html",
    "电视剧": "/Tv/index.html",
    "综艺":   "/Zy/index.html",
    "动漫":   "/Dm/index.html",
    "其他":   "/qita/index.html",
}

OUTPUT_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "output")
os.makedirs(OUTPUT_DIR, exist_ok=True)
DB_PATH = os.path.join(OUTPUT_DIR, "aeete.db")
JSON_DIR = os.path.join(OUTPUT_DIR, "json")
os.makedirs(JSON_DIR, exist_ok=True)
CSV_PATH = os.path.join(OUTPUT_DIR, "index.csv")
COVER_DIR = os.path.join(OUTPUT_DIR, "covers")
os.makedirs(COVER_DIR, exist_ok=True)

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[
        logging.StreamHandler(sys.stdout),
        logging.FileHandler(os.path.join(OUTPUT_DIR, "spider.log"), encoding="utf-8"),
    ],
)
log = logging.getLogger("aeete")


# ============== 工具函数 ==============
def rand_headers():
    return {
        "User-Agent": random.choice(HEADERS_POOL),
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
        "Referer": BASE_URL + "/",
        "Connection": "keep-alive",
    }


def http_get(url, session=None, retries=3, timeout=20, proxy=None):
    """带重试的 GET，返回 Response；失败返回 None"""
    proxies = {"http": proxy, "https": proxy} if proxy else None
    for i in range(retries):
        try:
            s = session or requests
            r = s.get(url, headers=rand_headers(), timeout=timeout, proxies=proxies, verify=False)
            if r.status_code == 200:
                # 站点编码 utf-8
                r.encoding = r.apparent_encoding or "utf-8"
                return r
            log.warning(f"状态码 {r.status_code}：{url}")
        except Exception as e:
            log.warning(f"请求异常({i+1}/{retries}) {url}：{e}")
        time.sleep(1 + random.random())
    return None


def b64_decode(s):
    """
    还原站点 base64decode()：标准 UTF-8 Base64，自动补 '='
    """
    if not s:
        return ""
    s = s.strip()
    pad = 4 - len(s) % 4
    if pad != 4:
        s += "=" * pad
    try:
        return base64.b64decode(s).decode("utf-8", errors="ignore")
    except Exception as e:
        log.warning(f"Base64 解密失败：{s[:50]}... {e}")
        return ""


def init_db():
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    c.execute("""CREATE TABLE IF NOT EXISTS videos (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        vid TEXT UNIQUE,
        title TEXT,
        alias TEXT,
        category TEXT,
        sub_category TEXT,
        director TEXT,
        writer TEXT,
        actors TEXT,
        tags TEXT,
        language TEXT,
        area TEXT,
        year TEXT,
        duration TEXT,
        remarks TEXT,
        rating TEXT,
        hot TEXT,
        update_time TEXT,
        cover TEXT,
        description TEXT,
        detail_url TEXT,
        episodes TEXT,   -- JSON: [{name, play_url, m3u8, next_m3u8}]
        crawled_at TEXT
    )""")
    conn.commit()
    return conn


DB_LOCK = threading.Lock()


def save_video(conn, v):
    with DB_LOCK:
        c = conn.cursor()
        c.execute("SELECT vid FROM videos WHERE vid=?", (v["vid"],))
        row = c.fetchone()
        if row:
            c.execute("""UPDATE videos SET title=?,alias=?,category=?,sub_category=?,director=?,writer=?,
                actors=?,tags=?,language=?,area=?,year=?,duration=?,remarks=?,rating=?,hot=?,
                update_time=?,cover=?,description=?,detail_url=?,episodes=?,crawled_at=? WHERE vid=?""",
                (v["title"], v["alias"], v["category"], v["sub_category"], v["director"], v["writer"],
                 v["actors"], v["tags"], v["language"], v["area"], v["year"], v["duration"],
                 v["remarks"], v["rating"], v["hot"], v["update_time"], v["cover"], v["description"],
                 v["detail_url"], json.dumps(v["episodes"], ensure_ascii=False), v["crawled_at"], v["vid"]))
        else:
            c.execute("""INSERT INTO videos (vid,title,alias,category,sub_category,director,writer,
                actors,tags,language,area,year,duration,remarks,rating,hot,update_time,cover,
                description,detail_url,episodes,crawled_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)""",
                (v["vid"], v["title"], v["alias"], v["category"], v["sub_category"], v["director"],
                 v["writer"], v["actors"], v["tags"], v["language"], v["area"], v["year"],
                 v["duration"], v["remarks"], v["rating"], v["hot"], v["update_time"], v["cover"],
                 v["description"], v["detail_url"], json.dumps(v["episodes"], ensure_ascii=False), v["crawled_at"]))
        conn.commit()


# ============== 爬取列表页 ==============
def get_total_pages(html):
    """从分页区获取尾页数字"""
    m = re.search(r'href="[^"]*index(\d+)\.html"[^>]*>\s*尾页', html)
    if m:
        return int(m.group(1))
    # 找最大页码
    pages = re.findall(r'href="[^"]*index(\d+)\.html"', html)
    if pages:
        return max(int(p) for p in pages)
    return 1


def parse_list_page(html, category):
    """解析列表页，返回详情页URL列表 [(title, url)]

    站点列表结构：<ul class="threadlist"><li data-href="/Cat/sub/slug/"><a class="pic" href="...">
    <h2><a href="..." title="片名">片名</a></h2>...
    """
    soup = BeautifulSoup(html, "lxml")
    items = []
    seen = set()
    # 主结构：ul.threadlist > li > h2 > a
    for li in soup.select("ul.threadlist li"):
        a = li.select_one("h2 a") or li.select_one("a.pic") or li.find("a")
        if not a:
            continue
        href = a.get("href", "") or li.get("data-href", "")
        title = a.get("title") or a.get_text(strip=True)
        if not href or not title:
            continue
        full = urljoin(BASE_URL + "/", href)
        if not re.search(r'/(Movie|Tv|Zy|Dm|qita)/[a-z]+/[a-z0-9_]+/?$', full.split("?")[0]):
            continue
        if full in seen:
            continue
        seen.add(full)
        items.append((title, full))
    # 兜底正则
    for m in re.finditer(r'href="(/(?:Movie|Tv|Zy|Dm|qita)/[a-z]+/[a-z0-9_]+/)"[^>]*title="([^"]+)"', html):
        full = urljoin(BASE_URL + "/", m.group(1))
        title = m.group(2)
        if full not in seen:
            seen.add(full)
            items.append((title, full))
    return items


def crawl_category(category, entry, session, args):
    """抓取一个一级分类的所有子分类 + 分页，返回详情URL集合"""
    visited_pages = set()
    detail_urls = {}  # url -> title
    page_no = 1
    while True:
        if page_no == 1:
            page_url = urljoin(BASE_URL + "/", entry)
        else:
            page_url = urljoin(BASE_URL + "/", entry.replace("index.html", f"index{page_no}.html"))
        if page_url in visited_pages:
            break
        if args.max_pages and page_no > args.max_pages:
            break
        visited_pages.add(page_url)
        log.info(f"[{category}] 抓取列表页 {page_url}")
        r = http_get(page_url, session=session, proxy=args.proxy)
        if not r:
            log.warning(f"[{category}] 第{page_no}页抓取失败，停止该分类")
            break
        html = r.text
        items = parse_list_page(html, category)
        for t, u in items:
            detail_urls[u] = t
        log.info(f"[{category}] 第{page_no}页发现 {len(items)} 部影片（累计 {len(detail_urls)}）")
        # 判断是否尾页
        total = get_total_pages(html)
        if page_no >= total or not items:
            break
        page_no += 1
        time.sleep(args.delay * (0.5 + random.random()))
    return detail_urls


# ============== 爬取详情页 ==============
def parse_detail(url, html):
    """解析详情页，返回影片基本信息 dict + 播放集链接列表"""
    info = {
        "detail_url": url,
        "title": "", "alias": "", "director": "", "writer": "",
        "actors": "", "tags": "", "language": "", "area": "",
        "year": "", "duration": "", "remarks": "", "rating": "",
        "hot": "", "update_time": "", "cover": "", "description": "",
        "sub_category": "",
    }
    # 标题
    m = re.search(r'<h1[^>]*>《?([^<》\n]+)》?</h1>', html)
    if m:
        info["title"] = m.group(1).strip()

    # 封面：优先 vod_pic JS 变量，再 img.img-fluid.lazy
    m = re.search(r'''vod_pic\s*=\s*['"]([^'"]+)['"]''', html)
    if m:
        info["cover"] = m.group(1)
    if not info["cover"]:
        m = re.search(r'<img[^>]+class="[^"]*(?:img-fluid|lazy)[^"]*"[^>]+src="(https?://[^"]+)"', html)
        if m:
            info["cover"] = m.group(1)
    if not info["cover"]:
        m = re.search(r'<img[^>]+src="(https?://[^"]+\.(?:jpg|jpeg|png|webp))"[^>]*alt="', html)
        if m:
            info["cover"] = m.group(1)

    # ---- 把"影片详情"区块截出来（message.break-all），避免正则吃满整页 ----
    info_block = ""
    m = re.search(r'class="message\s+break-all"[^>]*>([\s\S]*?)</div>', html)
    if m:
        info_block = m.group(1)
    else:
        m = re.search(r'(◎影片片名[\s\S]*?)\{self:share\}', html)
        if m:
            info_block = m.group(1)
    # 去标签、统一空白
    info_text = re.sub(r'<[^>]+>', ' ', info_block)
    info_text = re.sub(r'&nbsp;', ' ', info_text)
    info_text = re.sub(r'[ \t\xa0]+', ' ', info_text)
    info_text = re.sub(r'\r', '\n', info_text)

    # 在 info_text 里以"◎"为分隔切出各字段（每段"◎KEY：VALUE"独占一段）
    field_pat = re.compile(r'◎(影片)?([^\n：:]+)[：:]\s*([\s\S]*?)(?=\s*◎|\s*影片简介|\{self:share\}|$)')
    fields = {}
    for mm in field_pat.finditer(info_text):
        key = mm.group(2).strip()
        val = mm.group(3).strip()
        val = re.sub(r'\s+', ' ', val)
        # 去除残留的 {self:share}
        val = val.replace('{self:share}', '').strip()
        fields[key] = val

    info["alias"]      = fields.get("别名", "")
    info["director"]   = fields.get("导演", "")
    info["writer"]     = fields.get("编剧", "")
    info["actors"]     = fields.get("主演", "")
    info["tags"]       = fields.get("分类", "")
    info["language"]   = fields.get("语言", "")
    info["area"]       = fields.get("地区", "")
    info["year"]       = fields.get("上映年份") or fields.get("年份", "")
    info["duration"]   = fields.get("时长", "")
    info["remarks"]    = fields.get("备注") or fields.get("状态", "")

    # 简介：在 影片简介： 之后到 {self:share}
    m = re.search(r'影片简介[：:]\s*([\s\S]*?)\{self:share\}', html)
    if m:
        desc = re.sub(r'<[^>]+>', ' ', m.group(1))
        desc = re.sub(r'&nbsp;', ' ', desc)
        desc = re.sub(r'[ \t]+', ' ', desc)
        desc = re.sub(r'\n\s*\n+', '\n', desc).strip()
        info["description"] = desc

    # 子分类（从 URL 解析）
    path = urlparse(url).path.strip("/")
    parts = path.split("/")
    if len(parts) >= 2:
        info["sub_category"] = parts[1]

    # 热度 / 更新时间 / 评分
    # 详情页顶部 .detail-status 结构：状态/更新/热度
    m = re.search(r'更新[：:]\s*</span>\s*<b[^>]*>(?:<i[^>]*></i>\s*)?([^<]+)', html)
    if not m:
        m = re.search(r'更新[：:]\s*([\d\-:\s]+)', html)
    if m:
        info["update_time"] = m.group(1).strip()
    m = re.search(r'热度[：:]\s*</span>\s*<b[^>]*>(?:<i[^>]*></i>\s*)?([\d,]+)', html)
    if not m:
        m = re.search(r'热度[：:]\s*(\d+)', html)
    if m:
        info["hot"] = m.group(1).strip()
    m = re.search(r'(\d+\.\d+)分', html)
    if m:
        info["rating"] = m.group(1)
    if not info["update_time"]:
        m = re.search(r'data-date="([^"]+)"', html)
        if m:
            info["update_time"] = m.group(1)

    # 播放集链接
    episodes = []
    seen_play = set()
    for m in re.finditer(r'href="([^"]*?play-(\d+)-(\d+)\.html)"[^>]*>([^<]+)</a>', html):
        play_url = urljoin(url, m.group(1))
        if play_url in seen_play:
            continue
        seen_play.add(play_url)
        episodes.append({
            "name": m.group(4).strip(),
            "play_url": play_url,
            "from": m.group(2),
            "part": m.group(3),
            "m3u8": "",
            "next_m3u8": "",
        })
    return info, episodes


# ============== 爬取播放页（解密 m3u8）==============
def parse_play_page(html):
    """从播放页 inline JS 中提取并解密 m3u8 地址"""
    m = re.search(r'var\s+now\s*=\s*base64decode\(\s*"([^"]+)"\s*\)', html)
    now = b64_decode(m.group(1)) if m else ""
    m = re.search(r'var\s+next\s*=\s*base64decode\(\s*"([^"]*)"\s*\)', html)
    nxt = b64_decode(m.group(1)) if m else ""
    m = re.search(r'var\s+vid\s*=\s*"([^"]+)"', html)
    vid = m.group(1) if m else ""
    # vod_xxx 元信息（兜底）
    def _v(name):
        mm = re.search(rf"var\s+vod_{name}\s*=\s*'([^']*)'", html)
        return mm.group(1) if mm else ""
    return {
        "vid": vid,
        "m3u8": now,
        "next_m3u8": nxt,
        "vod_name": _v("name"),
        "vod_pic": _v("pic"),
        "vod_part": _v("part"),
        "vod_actor": _v("actor"),
    }


def download_cover(url, name_hint, session, proxy):
    """下载封面图"""
    try:
        r = http_get(url, session=session, proxy=proxy, timeout=15)
        if not r:
            return ""
        ext = os.path.splitext(urlparse(url).path)[1] or ".jpg"
        safe_name = re.sub(r'[\\/:*?"<>|]', '_', name_hint)[:80]
        fp = os.path.join(COVER_DIR, safe_name + ext)
        with open(fp, "wb") as f:
            f.write(r.content)
        return fp
    except Exception as e:
        log.warning(f"封面下载失败 {url}: {e}")
        return ""


# ============== 主流程 ==============
def crawl_one_video(url, args, category):
    """完整爬取单部影片（详情+所有集播放页），返回 info dict（不写DB，避免SQLite跨线程问题）"""
    session = requests.Session()
    # 用 URL 做唯一键
    slug = url.rstrip("/").split("/")[-1]
    r = http_get(url, session=session, proxy=args.proxy)
    if not r:
        log.error(f"详情页抓取失败: {url}")
        return None
    info, episodes = parse_detail(url, r.text)
    if not episodes:
        log.warning(f"未找到播放集链接: {url}")
    # 逐集解密 m3u8
    for ep in episodes:
        time.sleep(args.delay * (0.3 + random.random() * 0.7))
        pr = http_get(ep["play_url"], session=session, proxy=args.proxy)
        if not pr:
            log.warning(f"播放页失败: {ep['play_url']}")
            continue
        play = parse_play_page(pr.text)
        ep["m3u8"] = play["m3u8"]
        ep["next_m3u8"] = play["next_m3u8"]
        if play["vod_pic"] and not info["cover"]:
            info["cover"] = play["vod_pic"]
        if play["vid"]:
            info["vid"] = play["vid"]
        # 去掉内部字段
        ep.pop("from", None)
        ep.pop("part", None)
    # 兜底 vid
    if not info.get("vid"):
        info["vid"] = slug
    # 下载封面
    cover_local = ""
    if info["cover"] and args.download_covers:
        cover_local = download_cover(info["cover"], info["title"] or slug, session, args.proxy)
    info["cover_local"] = cover_local
    info["episodes"] = episodes
    info["category"] = category
    info["crawled_at"] = time.strftime("%Y-%m-%d %H:%M:%S")
    # 保存 JSON（文件写入是线程安全的，各自写不同文件）
    fp = os.path.join(JSON_DIR, f"{slug}.json")
    with open(fp, "w", encoding="utf-8") as f:
        json.dump(info, f, ensure_ascii=False, indent=2)
    return info


def export_csv(conn):
    """导出索引 CSV"""
    c = conn.cursor()
    c.execute("SELECT vid,title,category,sub_category,area,year,director,actors,rating,hot,update_time,detail_url,cover FROM videos ORDER BY id")
    rows = c.fetchall()
    with open(CSV_PATH, "w", newline="", encoding="utf-8-sig") as f:
        w = csv.writer(f)
        w.writerow(["vid", "片名", "一级分类", "子分类", "地区", "年份", "导演", "主演", "评分", "热度", "更新时间", "详情页", "封面"])
        for r in rows:
            w.writerow(r)
    log.info(f"CSV 索引已导出: {CSV_PATH} （共 {len(rows)} 部）")


def main():
    # 禁用 InsecureRequestWarning
    try:
        import urllib3
        urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)
    except Exception:
        pass

    ap = argparse.ArgumentParser(description="Auete影视网全站爬虫")
    ap.add_argument("--max-pages", type=int, default=0, help="每个分类最多抓取页数（0=全部）")
    ap.add_argument("--delay", type=float, default=1.0, help="请求间隔秒数")
    ap.add_argument("--workers", type=int, default=3, help="详情页并发线程数")
    ap.add_argument("--proxy", type=str, default="", help="HTTP代理，如 http://127.0.0.1:7890")
    ap.add_argument("--no-covers", action="store_true", help="不下载封面图")
    ap.add_argument("--cats", type=str, default="", help="只抓指定分类（逗号分隔）：电影,电视剧,综艺,动漫,其他")
    args = ap.parse_args()
    args.download_covers = not args.no_covers

    conn = init_db()
    session = requests.Session()

    # 先抓各分类列表页
    all_details = {}  # url -> (category, title)
    cats_to_crawl = CATEGORIES
    if args.cats:
        cats_to_crawl = {k: v for k, v in CATEGORIES.items() if k in args.cats.split(",")}

    for cat, entry in cats_to_crawl.items():
        log.info(f"====== 开始抓取分类：{cat} ======")
        items = crawl_category(cat, entry, session, args)
        for u, t in items.items():
            if u not in all_details:
                all_details[u] = (cat, t)
        log.info(f"====== 分类《{cat}》累计 {len(items)} 部，全局累计 {len(all_details)} ======")

    log.info(f"所有分类列表收集完毕，共 {len(all_details)} 部影片，开始抓取详情...")

    # 过滤已爬过的
    c = conn.cursor()
    c.execute("SELECT detail_url FROM videos")
    done_urls = {row[0] for row in c.fetchall()}
    todo = [(u, cat, t) for u, (cat, t) in all_details.items() if u not in done_urls]
    log.info(f"待爬取 {len(todo)} 部（已跳过 {len(done_urls)} 部已爬取）")

    # 多线程爬详情（每个线程独立 session，主线程统一写DB）
    done_count = 0
    fail_count = 0
    with ThreadPoolExecutor(max_workers=args.workers) as ex:
        futs = {ex.submit(crawl_one_video, u, args, cat): (u, cat, t) for u, cat, t in todo}
        for fut in as_completed(futs):
            u, cat, t = futs[fut]
            try:
                v = fut.result()
                done_count += 1
                if v:
                    save_video(conn, v)
                    eps = len(v.get("episodes", []))
                    first_m3u8 = v['episodes'][0]['m3u8'] if eps and v['episodes'][0].get('m3u8') else '无'
                    log.info(f"[{done_count+fail_count}/{len(todo)}] ✔ {cat}/{v.get('title') or t}  集数={eps}  m3u8={first_m3u8[:70]}")
                else:
                    fail_count += 1
            except Exception as e:
                fail_count += 1
                log.error(f"抓取异常 {u}: {e}")

    export_csv(conn)
    log.info(f"====== 全部完成：成功 {done_count}，失败 {fail_count} ======")
    log.info(f"数据库: {DB_PATH}")
    log.info(f"JSON目录: {JSON_DIR}")
    log.info(f"索引CSV: {CSV_PATH}")
    conn.close()


if __name__ == "__main__":
    main()
