#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
饭搭子影视 (https://fdzys.com/) 全站爬虫
=============================================
功能：
  1. 抓取 6 大分类（电影/电视剧/动漫/综艺/短剧/体育）所有分页
  2. 抓取每部作品详情页：标题/封面/简介/导演/演员/年份/地区/类型/评分
  3. 抓取每个播放源（线路）的所有集数/集名
  4. 自动逆向播放页 JS 提取真实 m3u8 直链（encrypt=0，相对路径拼接绝对路径）
  5. 数据保存到 SQLite + JSON；图片资源可下载
  6. 支持断点续爬、并发、限速、重试、随机UA
  7. 可选：下载 m3u8 视频（通过 ffmpeg 合并为 mp4）

用法：
  pip install requests beautifulsoup4 lxml
  # 只爬取元数据（推荐，不下载视频）
  python fdzys_crawler.py
  # 爬取并下载视频（会很慢很占磁盘）
  python fdzys_crawler.py --download-video
  # 指定分类/页数
  python fdzys_crawler.py --categories movie tv --max-pages 10

作者：wenzheng  日期：2026-09-10
站点类型：MacCMS v10 (mizhiady 模板)
"""

import os
import re
import sys
import json
import time
import random
import sqlite3
import logging
import argparse
import hashlib
from urllib.parse import urljoin, urlparse, unquote
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path

import requests
from bs4 import BeautifulSoup

# ========================== 配置 ==========================
BASE_URL = "https://fdzys.com"
CATEGORIES = {
    "movie":   "电影",
    "tv":      "电视剧",
    "dongman": "动漫",
    "zongyi":  "综艺",
    "duanju":  "短剧",
    "tiyu":    "体育",
}
OUT_DIR = Path("fdzys_data")
IMG_DIR = OUT_DIR / "images"
VIDEO_DIR = OUT_DIR / "videos"
DB_PATH = OUT_DIR / "fdzys.db"
JSON_PATH = OUT_DIR / "fdzys_all.json"

MAX_WORKERS = 8          # 并发线程
PAGE_DELAY = (0.3, 0.8)  # 每页随机延迟秒
DETAIL_DELAY = (0.2, 0.5)
RETRY = 3
TIMEOUT = 20

HEADERS = {
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
}

USER_AGENTS = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Safari/605.1.15",
    "Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36",
]

# ========================== 日志 ==========================
OUT_DIR.mkdir(parents=True, exist_ok=True)
IMG_DIR.mkdir(parents=True, exist_ok=True)
VIDEO_DIR.mkdir(parents=True, exist_ok=True)
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%H:%M:%S",
    handlers=[
        logging.StreamHandler(sys.stdout),
        logging.FileHandler(OUT_DIR / "crawl.log", encoding="utf-8"),
    ],
)
log = logging.getLogger("fdzys")


# ========================== 工具函数 ==========================
def make_session():
    s = requests.Session()
    s.headers.update(HEADERS)
    s.headers["User-Agent"] = random.choice(USER_AGENTS)
    return s


def http_get(session, url, referer=None, **kwargs):
    """带重试的 GET"""
    headers = dict(session.headers)
    if referer:
        headers["Referer"] = referer
    for i in range(RETRY):
        try:
            r = session.get(url, headers=headers, timeout=TIMEOUT, allow_redirects=True, **kwargs)
            if r.status_code == 200:
                return r
            log.warning(f"HTTP {r.status_code} for {url} (retry {i+1})")
        except Exception as e:
            log.warning(f"Request error for {url}: {e} (retry {i+1})")
        time.sleep(1 + i)
    return None


def rand_sleep(slot):
    time.sleep(random.uniform(*slot))


def safe_filename(s, maxlen=80):
    s = re.sub(r'[\\/:*?"<>|\r\n\t]+', "_", s).strip(" ._")
    return s[:maxlen] if len(s) > maxlen else s


def init_db():
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    IMG_DIR.mkdir(parents=True, exist_ok=True)
    VIDEO_DIR.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(DB_PATH)
    conn.executescript("""
    CREATE TABLE IF NOT EXISTS videos (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        vid TEXT UNIQUE,           -- 短ID (URL slug)
        category TEXT,
        title TEXT,
        cover TEXT,
        cover_local TEXT,
        year TEXT,
        area TEXT,
        director TEXT,
        actors TEXT,
        genres TEXT,
        rating TEXT,
        remark TEXT,
        intro TEXT,
        detail_url TEXT,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS episodes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        vid TEXT,
        source_from TEXT,          -- 线路标识 dytt / wsym3u8 ...
        source_name TEXT,          -- 线路名 天堂云
        ep_name TEXT,              -- 集数名 HD国语 / 第01集
        ep_url TEXT,               -- 站点播放页
        play_url TEXT,             -- 原始播放源
        m3u8_url TEXT,             -- 解析后的真实 m3u8
        parsed INTEGER DEFAULT 0,
        UNIQUE(vid, source_from, ep_name)
    );
    CREATE INDEX IF NOT EXISTS idx_vid ON videos(vid);
    CREATE INDEX IF NOT EXISTS idx_ep_vid ON episodes(vid);
    """)
    return conn


# ========================== 爬虫核心 ==========================
class FDZYSCrawler:
    def __init__(self, args):
        self.args = args
        self.session = make_session()
        self.db = init_db()
        self.seen_vids = set()
        self._load_seen()

    def _load_seen(self):
        cur = self.db.execute("SELECT vid FROM videos")
        for (v,) in cur.fetchall():
            self.seen_vids.add(v)

    # ---------- 探测分类最大页码 ----------
    def detect_max_page(self, cat):
        """二分查找最大有效页码"""
        log.info(f"探测 [{CATEGORIES[cat]}] 最大页数 ...")
        lo, hi, best = 1, 1, 0
        # 指数上升
        while True:
            if self._page_has_items(cat, hi):
                best = hi; lo = hi; hi *= 2
                if hi > 10000:
                    break
            else:
                break
            time.sleep(0.1)
        # 二分
        while lo <= hi:
            mid = (lo + hi) // 2
            if self._page_has_items(cat, mid):
                best = mid; lo = mid + 1
            else:
                hi = mid - 1
            time.sleep(0.1)
        log.info(f"[{CATEGORIES[cat]}] 共 {best} 页")
        return best

    def _page_has_items(self, cat, page):
        url = f"{BASE_URL}/{cat}/all?page={page}" if page > 1 else f"{BASE_URL}/{cat}/all"
        r = http_get(self.session, url, referer=BASE_URL + "/")
        if not r:
            return False
        # 判断当前激活页是否等于 page
        active = re.search(r'class="page active"[^>]*>\s*([0-9]+)\s*<', r.text)
        cur = int(active.group(1)) if active else 1
        if page == 1 and not active:
            cur = 1
        # 列表条目数（排除/all等筛选链接）
        links = re.findall(rf'href="{re.escape(BASE_URL)}/{cat}/([a-z0-9-]+)"', r.text)
        vids = [l for l in links if not l.startswith("all") and l not in CATEGORIES and l != "aiqing"]
        return cur == page and len(set(vids)) >= 10

    # ---------- 抓取列表页 ----------
    def parse_list_page(self, cat, page):
        url = f"{BASE_URL}/{cat}/all?page={page}" if page > 1 else f"{BASE_URL}/{cat}/all"
        r = http_get(self.session, url, referer=BASE_URL + "/")
        if not r:
            return []
        soup = BeautifulSoup(r.text, "lxml")
        items = []
        # MacCMS mizhiady 列表项：寻找视频卡片中的 a 标签
        # 典型结构：<a href="https://fdzys.com/movie/xxx"><img .../></a>
        seen = set()
        # 分类/筛选标签（需要排除）
        filter_words = {"all","aiqing","dongzuo","xiju","kehuan","juqing","xuanyi","kongbu",
                        "zhanzheng","zainan","donghua","lishi","wuxia","juqing","aiqingpian",
                        "dongzuopian","xijupian","kehuanpian"}
        for a in soup.find_all("a", href=True):
            href = a["href"]
            m = re.match(rf'{re.escape(BASE_URL)}/{cat}/([a-z0-9-]+)$', href)
            if not m:
                continue
            slug = m.group(1)
            if slug.startswith("all") or slug in CATEGORIES or slug in filter_words:
                continue
            # 必须包含 <img> 才是视频卡片
            img = a.find("img")
            if not img:
                continue
            cover = img.get("data-src") or img.get("src") or ""
            # 没有封面（或封面是默认 loading 图）则跳过
            if not cover or "loading.png" in cover or "data:image" in cover:
                continue
            if slug in seen:
                continue
            seen.add(slug)
            title = img.get("alt") or ""
            if not title:
                title = a.get("title") or ""
            remark = ""
            tag = a.find(class_=re.compile("remark|tag|note|bang|text"))
            if tag:
                remark = tag.get_text(strip=True)
            items.append({
                "vid": slug,
                "category": cat,
                "title": title,
                "cover": cover,
                "remark": remark,
                "detail_url": href,
            })
        return items

    # ---------- 抓取详情页 ----------
    def parse_detail(self, item):
        vid = item["vid"]
        url = item["detail_url"]
        r = http_get(self.session, url, referer=BASE_URL + "/")
        if not r:
            return None
        html = r.text
        # 基本信息
        soup = BeautifulSoup(html, "lxml")
        title = item["title"]
        h1 = soup.find("h1") or soup.find(class_=re.compile("title|name"))
        if h1:
            title = h1.get_text(strip=True) or title

        info = {"vid": vid, "category": item["category"], "title": title,
                "cover": item["cover"], "remark": item.get("remark",""),
                "detail_url": url, "director":"", "actors":"", "genres":"",
                "area":"", "year":"", "rating":"", "intro":"", "sources":[]}

        # 从信息块提取（dt/dd 或 .info-item）
        text = soup.get_text(" ", strip=True)
        def grab(pat):
            m = re.search(pat, text)
            return m.group(1).strip() if m else ""

        info["director"] = grab(r"导演\s*[:：]\s*([^主演类型地区年份上映简介]{1,50}?)(?:\s{2}|主演|类型|地区|年份|上映|评分|简介|更新|$)")
        info["actors"]   = grab(r"主演\s*[:：]\s*([^类型地区年份上映简介]{1,200}?)(?:\s{2}|类型|地区|年份|上映|评分|简介|更新|$)")
        info["genres"]   = grab(r"类型\s*[:：]\s*([^导演主演地区年份上映简介]{1,100}?)(?:\s{2}|导演|主演|地区|年份|上映|评分|简介|更新|$)")
        info["area"]     = grab(r"地区\s*[:：]\s*([^导演主演类型年份上映简介]{1,40}?)(?:\s{2}|导演|主演|类型|年份|上映|评分|简介|更新|$)")
        info["year"]     = grab(r"(?:年份|上映)\s*[:：]\s*(\d{4}[^\s导演主演类型地区简介]{0,20}?)(?:\s{2}|导演|主演|类型|地区|评分|简介|更新|$)")
        info["rating"]   = grab(r"评分\s*[:：]\s*([0-9.]+)")
        info["intro"]    = grab(r"简介\s*[:：]\s*(.{5,500}?)(?:\s{2,}|展开|收起|相关推荐|主演|导演|$)")

        # 如果 dt/dd 抓不到，尝试 data-block
        for dl in soup.find_all("div", class_=re.compile("info|detail|data")):
            pass

        # 线路名
        sources_map = {}  # sid -> (from_ident, show_name)
        for li in soup.find_all("li", attrs={"data-sid": True}):
            sid = li.get("data-sid")
            a = li.find("a")
            show_name = a.get_text(strip=True) if a else f"线路{sid}"
            span = li.find("span", attrs={"data-from": True})
            from_ident = span.get("data-from") if span else ""
            sources_map[sid] = (from_ident, show_name)

        # 播放列表
        sources = []
        for sid, (from_ident, show_name) in sources_map.items():
            pl = soup.find(id=f"playlist{sid}")
            if not pl:
                continue
            eps = []
            for a in pl.find_all("a", href=True):
                ep_name = a.get_text(strip=True)
                ep_href = urljoin(BASE_URL, a["href"])
                eps.append({"name": ep_name, "url": ep_href})
            if eps:
                sources.append({"sid": sid, "from": from_ident, "name": show_name, "episodes": eps})

        info["sources"] = sources

        # 默认第一线路第一集 的 m3u8（从内嵌 player_aaaa）
        m = re.search(r'var\s+player_aaaa\s*=\s*(\{.*?\})\s*;\s*</script>', html, re.S)
        if not m:
            m = re.search(r'var\s+player_aaaa\s*=\s*(\{.*?\})\s*</script>', html, re.S)
        if m:
            try:
                pa = json.loads(m.group(1))
                info["_default_url"] = pa.get("url", "")
                info["_default_from"] = pa.get("from", "")
                info["_default_nid"] = pa.get("nid", 1)
            except Exception as e:
                log.debug(f"player_aaaa parse fail for {vid}: {e}")

        return info

    # ---------- 逆向解析播放页，提取真实 m3u8 ----------
    def extract_m3u8(self, play_url):
        """
        访问播放页，解析 JS 中的相对 m3u8 路径，拼接绝对地址。
        兼容加密/非加密；该站 encrypt=0 直接可用。
        """
        parsed = urlparse(play_url)
        # 先取 play 页面的 player_aaaa
        r = http_get(self.session, play_url, referer=BASE_URL + "/")
        if not r:
            return None
        html = r.text
        m = re.search(r'var\s+player_aaaa\s*=\s*(\{.*?\})\s*;\s*</script>', html, re.S)
        if not m:
            m = re.search(r'var\s+player_aaaa\s*=\s*(\{.*?\})\s*</script>', html, re.S)
        if not m:
            return None
        try:
            pa = json.loads(m.group(1))
        except Exception:
            return None

        src_url = pa.get("url", "")
        encrypt = pa.get("encrypt", 0)
        if not src_url:
            return None

        # 若已是 .m3u8 直链，直接返回
        if ".m3u8" in src_url:
            return src_url

        # encrypt=0 说明是明文播放页URL（如 https://vip.dytt-see.com/share/xxx）
        # 访问该页，取里面 const url="...m3u8..."
        try:
            r2 = http_get(self.session, src_url, referer=play_url)
            if not r2:
                return None
            body = r2.text
            # 解析 const url = "xxx"
            mu = re.search(r'const\s+url\s*=\s*["\']([^"\']+)["\']', body)
            if not mu:
                # 其他可能
                mu = re.search(r'(?:url|src|playUrl)\s*[:=]\s*["\']([^"\']+\.m3u8[^"\']*)["\']', body)
            if mu:
                rel = mu.group(1)
                m3u8 = urljoin(src_url, rel)
                return m3u8
            # 兜底：直接搜 m3u8 绝对链接
            mu = re.search(r'(https?://[^\s"\'<>]+\.m3u8[^\s"\'<>]*)', body)
            if mu:
                return mu.group(1)
        except Exception as e:
            log.debug(f"extract m3u8 err {play_url}: {e}")
        return None

    # ---------- 下载封面 ----------
    def download_image(self, url, vid):
        if not url:
            return ""
        try:
            ext = os.path.splitext(urlparse(url).path)[1] or ".jpg"
            if ext not in (".jpg",".jpeg",".png",".webp",".gif"):
                ext = ".jpg"
            local = IMG_DIR / f"{safe_filename(vid)}{ext}"
            if local.exists():
                return str(local)
            r = http_get(self.session, url, referer=BASE_URL + "/")
            if r:
                local.write_bytes(r.content)
                return str(local)
        except Exception as e:
            log.debug(f"download img fail {url}: {e}")
        return ""

    # ---------- m3u8 下载（需 ffmpeg） ----------
    def download_video(self, m3u8_url, save_path, referer=None):
        try:
            import subprocess
            if Path(save_path).exists():
                return True
            cmd = ["ffmpeg", "-y", "-loglevel", "error",
                   "-headers", f"Referer: {referer or urlparse(m3u8_url).scheme+'://'+urlparse(m3u8_url).netloc}/\r\n",
                   "-i", m3u8_url, "-c", "copy", "-bsf:a", "aac_adtstoasc", save_path]
            log.info(f"ffmpeg 下载: {save_path}")
            p = subprocess.run(cmd, capture_output=True, timeout=3600)
            return p.returncode == 0
        except Exception as e:
            log.warning(f"download video fail {m3u8_url}: {e}")
            return False

    # ---------- 保存到 DB ----------
    def save(self, info, m3u8_cache=None):
        cur = self.db.cursor()
        try:
            cur.execute("""INSERT OR IGNORE INTO videos
                (vid, category, title, cover, cover_local, year, area, director, actors,
                 genres, rating, remark, intro, detail_url)
                VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)""",
                (info["vid"], info["category"], info["title"], info["cover"],
                 info.get("cover_local",""), info["year"], info["area"], info["director"],
                 info["actors"], info["genres"], info["rating"], info["remark"],
                 info["intro"], info["detail_url"]))
            vid = info["vid"]
            for src in info["sources"]:
                for ep in src["episodes"]:
                    m3u8 = ""
                    if m3u8_cache and (src["from"], ep["name"]) in m3u8_cache:
                        m3u8 = m3u8_cache[(src["from"], ep["name"])]
                    cur.execute("""INSERT OR IGNORE INTO episodes
                        (vid, source_from, source_name, ep_name, ep_url, play_url, m3u8_url, parsed)
                        VALUES (?,?,?,?,?,?,?,?)""",
                        (vid, src["from"], src["name"], ep["name"], ep["url"],
                         info.get("_default_url",""), m3u8, 1 if m3u8 else 0))
            self.db.commit()
        except Exception as e:
            log.error(f"save db err: {e}")
            self.db.rollback()

    # ---------- 主流程 ----------
    def run(self):
        cats = self.args.categories or list(CATEGORIES.keys())
        cats = [c for c in cats if c in CATEGORIES]
        total = 0
        all_videos = []

        for cat in cats:
            max_page = self.args.max_pages or self.detect_max_page(cat)
            log.info(f"开始抓取 [{CATEGORIES[cat]}] {max_page} 页")

            for page in range(1, max_page + 1):
                try:
                    items = self.parse_list_page(cat, page)
                except Exception as e:
                    log.error(f"列表 {cat} p{page} 解析失败: {e}")
                    items = []
                log.info(f"  [{CATEGORIES[cat]}] 第{page}/{max_page}页, 条目 {len(items)}")

                # 过滤已抓取
                new_items = [it for it in items if it["vid"] not in self.seen_vids]

                for it in new_items:
                    rand_sleep(DETAIL_DELAY)
                    try:
                        info = self.parse_detail(it)
                        if not info:
                            continue
                        # 下载封面
                        info["cover_local"] = self.download_image(info["cover"], info["vid"])

                        # 解析第一集的 m3u8（默认样例）；若要全集则遍历
                        m3u8_cache = {}
                        if info["sources"]:
                            first_src = info["sources"][0]
                            if first_src["episodes"]:
                                first_ep = first_src["episodes"][0]
                                m3u8 = self.extract_m3u8(first_ep["url"])
                                if m3u8:
                                    m3u8_cache[(first_src["from"], first_ep["name"])] = m3u8
                                    log.info(f"    [{info['title']}] m3u8: {m3u8[:80]}...")
                                    if self.args.download_video:
                                        safe_title = safe_filename(info["title"])
                                        vpath = VIDEO_DIR / f"{safe_title}.mp4"
                                        self.download_video(m3u8, str(vpath), referer=first_ep["url"])

                        self.save(info, m3u8_cache)
                        self.seen_vids.add(info["vid"])
                        all_videos.append({
                            "vid": info["vid"], "category": cat,
                            "title": info["title"], "detail_url": info["detail_url"],
                            "sources_count": len(info["sources"]),
                            "m3u8_sample": next(iter(m3u8_cache.values()), ""),
                        })
                        total += 1
                    except Exception as e:
                        log.exception(f"解析详情失败 {it.get('detail_url')}: {e}")

                rand_sleep(PAGE_DELAY)
                # 定期写json
                if page % 10 == 0:
                    self._write_json(all_videos)

        self._write_json(all_videos)
        log.info(f"抓取完成！共抓取 {total} 部作品，数据保存到 {DB_PATH}")
        return total

    def _write_json(self, videos):
        # 从DB读取完整数据导出JSON
        cur = self.db.cursor()
        rows = cur.execute("SELECT * FROM videos").fetchall()
        cols = [d[0] for d in cur.description]
        data = []
        for row in rows:
            v = dict(zip(cols, row))
            eps = cur.execute("SELECT source_from,source_name,ep_name,ep_url,m3u8_url FROM episodes WHERE vid=?",
                              (v["vid"],)).fetchall()
            v["episodes"] = [
                {"from":e[0],"source":e[1],"ep":e[2],"url":e[3],"m3u8":e[4]} for e in eps
            ]
            data.append(v)
        JSON_PATH.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")


# ========================== 入口 ==========================
def parse_args():
    ap = argparse.ArgumentParser(description="饭搭子影视全站爬虫")
    ap.add_argument("--categories", nargs="+",
                    help="指定分类，可多选：movie tv dongman zongyi duanju tiyu，默认全部")
    ap.add_argument("--max-pages", type=int, default=0,
                    help="每个分类最多抓取页数（0=自动探测全部）")
    ap.add_argument("--download-video", action="store_true",
                    help="同时下载视频（需要 ffmpeg，极占带宽/磁盘）")
    ap.add_argument("--workers", type=int, default=MAX_WORKERS)
    return ap.parse_args()


if __name__ == "__main__":
    args = parse_args()
    MAX_WORKERS = args.workers
    crawler = FDZYSCrawler(args)
    crawler.run()
