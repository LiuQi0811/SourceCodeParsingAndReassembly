#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
嘀嗒影视 (didahd.xyz) 全站爬虫
==============================
功能:
  1. 抓取5大分类（电影/电视剧/纪录片/动漫/综艺）的所有列表页
  2. 抓取每个视频详情：标题、豆瓣评分、地区/语言/年份、演员/导演、简介、封面
  3. 抓取所有播放源与每集播放页链接
  4. 抓取网盘下载链接（夸克网盘、百度网盘）
  5. 自动识别并解密播放页中encrypt=1/2的视频地址(m3u8/mp4)
  6. 支持断点续爬、多线程、随机UA、失败重试、请求限速
  7. 结果导出为 JSON / CSV / SQLite 三种格式，可下载封面图

URL结构分析:
  - 首页:            /
  - 分类列表:        /type/{cid}.html         第N页: /type/{cid}-{page}.html
                      cid: 1电影 2电视剧 3纪录片 4动漫 5综艺
  - 视频详情:        /detail/{vid}.html
  - 播放页:          /play/{vid}-{sid}-{nid}.html
                      sid=播放源编号, nid=集数编号
  - 网盘链接在详情页直接可见

用法示例:
  python3 didahd_spider.py                           # 全站抓取（默认）
  python3 didahd_spider.py --type 1 2                # 只抓电影+电视剧
  python3 didahd_spider.py --max-pages 3             # 每类最多3页（测试用）
  python3 didahd_spider.py --delay 2 --workers 2     # 慢速防封
  python3 didahd_spider.py --download                # 同时下载封面图片
  python3 didahd_spider.py --export-only             # 不爬新内容，只重新导出已有数据库
"""

import os
import re
import sys
import json
import time
import random
import base64
import sqlite3
import argparse
import csv
import threading
import urllib.parse
from datetime import datetime
from concurrent.futures import ThreadPoolExecutor, as_completed

import requests
from bs4 import BeautifulSoup

# ============ 全局配置 ============
BASE_URL = "https://www.didahd.xyz"

DEFAULT_HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
                  "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
    "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
    "Referer": BASE_URL + "/",
}

# 分类映射
CATEGORIES = {
    1: "电影",
    2: "电视剧",
    3: "纪录片",
    4: "动漫",
    5: "综艺",
}

# 输出目录
OUTPUT_DIR = "didahd_data"
COVERS_DIR = os.path.join(OUTPUT_DIR, "covers")

# 随机UA池（防反爬）
UA_POOL = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Safari/605.1.15",
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36 Edg/119.0.0.0",
]

# 线路关键词（用于区分"线路按钮"和"集数按钮"）
SOURCE_KEYWORDS = ("超清", "高清", "蓝光", "4K", "线路", "网盘", "云盘", "MuiPlayer",
                   "BBA", "zxyy", "lbyy", "sqys", "NBY", "kuake", "quark", "baidu")
# 不是演员的关键词（过滤地区、语言、年份、分类等）
NON_ACTOR_WORDS = set(CATEGORIES.values()) | {
    "大陆", "香港", "台湾", "日本", "美国", "韩国", "英国", "法国", "德国", "印度",
    "泰国", "意大利", "西班牙", "加拿大", "澳大利亚", "俄罗斯", "其它", "其他",
    "国语", "粤语", "日语", "英语", "韩语", "法语", "德语", "俄语", "西班牙语",
    "意大利语", "汉语普通话", "闽南语", "四川乐山话", "夏威夷语", "耳其语", "印地语",
    "芬兰语", "丹麦语",
}


# ============ 辅助函数 ============
def ensure_dirs():
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    os.makedirs(COVERS_DIR, exist_ok=True)
    os.makedirs(os.path.join(OUTPUT_DIR, "videos"), exist_ok=True)


def make_session():
    s = requests.Session()
    s.headers.update(DEFAULT_HEADERS)
    return s


def fetch(session, url, retries=3, timeout=15):
    """带重试的HTTP GET，返回HTML文本或None"""
    for i in range(retries):
        try:
            session.headers["User-Agent"] = random.choice(UA_POOL)
            resp = session.get(url, timeout=timeout, allow_redirects=True)
            if resp.status_code == 200:
                resp.encoding = resp.apparent_encoding or "utf-8"
                return resp.text
            elif resp.status_code == 404:
                return None
            else:
                time.sleep((i + 1))
        except requests.RequestException as e:
            wait = (i + 1) * 2
            time.sleep(wait)
    return None


def polite_sleep(delay):
    time.sleep(delay + random.uniform(0, delay * 0.5))


def b64decode_custom(data):
    """苹果CMS自定义base64解码（见player.js中的base64decode）"""
    # 优先用标准base64（苹果CMS的base64decode与标准一致，只是自定义了字母表）
    try:
        # 标准base64
        return base64.b64decode(data).decode("utf-8", errors="replace")
    except Exception:
        pass
    # 苹果CMS自定义字母表（和标准一致，这里只是兜底）
    b64chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/"
    data = re.sub(r"[^A-Za-z0-9+/=]", "", data)
    try:
        return base64.b64decode(data).decode("utf-8", errors="replace")
    except Exception:
        return ""


def decrypt_play_url(url_enc, encrypt_type):
    """
    解密播放地址
    encrypt=1: unescape
    encrypt=2: unescape(base64decode(...))
    encrypt=3: 自定义加密（与播放线路相关，通常为hex+异或，需要对应线路JS才能解密）
    """
    if encrypt_type in (1, "1"):
        try:
            return urllib.parse.unquote(url_enc)
        except Exception:
            return url_enc
    elif encrypt_type in (2, "2"):
        try:
            decoded = b64decode_custom(url_enc)
            return urllib.parse.unquote(decoded)
        except Exception:
            return url_enc
    elif encrypt_type in (3, "3"):
        # encrypt=3 解密逻辑因线路而异（hex编码+密钥异或），不同站点密钥不同
        # 这里不做硬解密，保留加密值并标注，用户可在浏览器中播放时抓包获取
        return f"[encrypt=3]需浏览器环境解密,原始={url_enc[:80]}..."
    return url_enc


# ============ 数据库 ============
DB_PATH = os.path.join(OUTPUT_DIR, "didahd.db")
_db_lock = threading.Lock()


def init_db():
    conn = sqlite3.connect(DB_PATH, check_same_thread=False)
    c = conn.cursor()
    c.execute("""CREATE TABLE IF NOT EXISTS videos (
        id INTEGER PRIMARY KEY,
        title TEXT,
        category_id INTEGER,
        category_name TEXT,
        rating REAL,
        status TEXT,
        area TEXT,
        language TEXT,
        year TEXT,
        actors TEXT,
        director TEXT,
        tags TEXT,
        total_episodes TEXT,
        cover_url TEXT,
        description TEXT,
        detail_url TEXT UNIQUE,
        quark_url TEXT,
        baidu_url TEXT,
        play_sources TEXT,
        crawled_at TEXT
    )""")
    c.execute("""CREATE TABLE IF NOT EXISTS episodes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        video_id INTEGER,
        source_name TEXT,
        episode_name TEXT,
        play_url TEXT,
        real_video_url TEXT,
        encrypt_type INTEGER,
        FOREIGN KEY (video_id) REFERENCES videos(id)
    )""")
    c.execute("""CREATE TABLE IF NOT EXISTS crawl_progress (
        url TEXT PRIMARY KEY,
        status TEXT,
        updated_at TEXT
    )""")
    conn.commit()
    return conn


# ============ 列表页解析 ============
def parse_list_page(html, cat_id):
    """解析分类列表页 -> (详情url列表, 是否有下一页, 总页数)"""
    soup = BeautifulSoup(html, "html.parser")
    detail_urls = []
    seen = set()
    for a in soup.find_all("a", href=re.compile(r"/detail/\d+\.html")):
        href = a.get("href", "")
        full = urllib.parse.urljoin(BASE_URL, href)
        if full not in seen:
            seen.add(full)
            detail_urls.append(full)

    total_pages = 1
    has_next = False
    # 查找分页区域
    pager_links = soup.find_all("a", href=re.compile(rf"/type/{cat_id}(?:-\d+)?\.html"))
    page_nums = []
    for a in pager_links:
        text = a.get_text(strip=True)
        m = re.search(rf"/type/{cat_id}-(\d+)\.html", a.get("href", ""))
        if m:
            p = int(m.group(1))
            page_nums.append(p)
            if text in ("下一页", "尾页", ">", "»", "›"):
                has_next = True
        if text in ("下一页", "尾页"):
            has_next = True
    if page_nums:
        total_pages = max(page_nums)
    return detail_urls, has_next, total_pages


def build_list_url(cat_id, page=1):
    if page <= 1:
        return f"{BASE_URL}/type/{cat_id}.html"
    return f"{BASE_URL}/type/{cat_id}-{page}.html"


# ============ 详情页解析 ============
def extract_vid(url):
    m = re.search(r"/detail/(\d+)\.html", url)
    return int(m.group(1)) if m else None


def parse_detail_page(html, url, cat_id):
    soup = BeautifulSoup(html, "html.parser")
    vid = extract_vid(url)

    data = {
        "id": vid,
        "title": "",
        "category_id": cat_id,
        "category_name": CATEGORIES.get(cat_id, ""),
        "rating": 0.0,
        "status": "",
        "area": "",
        "language": "",
        "year": "",
        "actors": [],
        "director": "",
        "tags": [],
        "total_episodes": "",
        "cover_url": "",
        "description": "",
        "detail_url": url,
        "quark_url": "",
        "baidu_url": "",
        "play_sources": [],  # [{source_name, episodes:[{name,url,sid,nid}]}]
    }

    # ---- 标题 ----
    h1 = soup.find("h1")
    if h1:
        data["title"] = h1.get_text(strip=True)

    # ---- 评分 ----
    # 豆瓣 X.X
    m = re.search(r"豆瓣\s*([\d.]+)", html)
    if m:
        try:
            data["rating"] = float(m.group(1))
        except ValueError:
            pass
    # X.X分
    if data["rating"] == 0.0:
        m = re.search(r"([\d.]+)\s*分", html)
        if m:
            try:
                data["rating"] = float(m.group(1))
            except ValueError:
                pass

    # ---- 状态/更新信息 ----
    status_patterns = [
        r"更新至第\d+集[^<\s]*",
        r"更新至\d+期[^<\s]*",
        r"更新至第\d+话[^<\s]*",
        r"HD中字", r"HD国语", r"HD粤语", r"HD日语", r"HD",
        r"BD中字", r"BD国语", r"BD",
        r"已完结", r"完结", r"全集",
        r"共\d+集", r"共\d+期",
        r"TC中字", r"TS中字",
    ]
    for pat in status_patterns:
        m = re.search(pat, html)
        if m:
            data["status"] = m.group(0).strip()
            break

    # ---- 元信息：从 <p class="data"> 块中提取（最可靠） ----
    info_p = soup.find_all("p", class_="data")
    info_text = "\n".join(p.get_text(" ", strip=True) for p in info_p)

    # 分类
    m = re.search(r"分类[：:]\s*([^\s]+)", info_text)
    if m:
        cls = m.group(1).strip()
        if cls and cls not in data["tags"]:
            data["tags"].append(cls)

    # 地区
    m = re.search(r"地区[：:]\s*(\S+)", info_text)
    if m and m.group(1) not in ("未知", "无"):
        data["area"] = m.group(1).strip()

    # 语言
    m = re.search(r"语言[：:]\s*(\S+)", info_text)
    if m and m.group(1) not in ("未知", "无"):
        data["language"] = m.group(1).strip()

    # 年份
    m = re.search(r"年份[：:]\s*(\d{4})", info_text)
    if m:
        data["year"] = m.group(1).strip()

    # 导演
    m = re.search(r"导演[：:]\s*([^\n]+)", info_text)
    if m:
        d = m.group(1).strip()
        if d and d not in ("未知", "无"):
            data["director"] = d

    # 主演
    m = re.search(r"主演[：:]\s*([^\n]+)", info_text)
    if m:
        actors_str = m.group(1).strip()
        actors = [a.strip() for a in re.split(r"[\s,，、]+", actors_str) if a.strip() and a.strip() not in ("未知", "无")]
        if actors:
            data["actors"] = actors[:15]

    # 集数
    m = re.search(r"集数[：:]\s*(\S+)", info_text)
    if m:
        data["total_episodes"] = m.group(1).strip()

    # 又名
    m = re.search(r"又名[：:]\s*([^\n]+)", info_text)
    if m:
        aka = m.group(1).strip()
        if aka and aka not in ("无", "未知"):
            pass  # 可以扩展字段

    # ---- 播放源 & 集数（修复版：解析锚点tab + playlist容器） ----
    # 苹果CMS mytheme 模板结构：
    #   <a href="#playlistN">超清G</a>  （tab按钮，锚点链接）
    #   <div id="playlistN" class="tab-pane">  <a href="/play/vid-sid-nid.html">第01集</a> ...
    play_sources_final = []
    # 先收集所有 tab 按钮（锚点）
    tab_map = {}  # playlist_index -> tab_name
    for a in soup.find_all("a", href=re.compile(r"#playlist\d+")):
        href = a.get("href", "")
        name = a.get_text(strip=True)
        m = re.match(r"#playlist(\d+)", href)
        if m and name:
            tab_map[int(m.group(1))] = name
    # 遍历每个 playlist div
    for pidx, tab_name in sorted(tab_map.items()):
        div = soup.find("div", id=f"playlist{pidx}")
        if not div:
            continue
        eps = []
        sid_set = set()
        for a in div.find_all("a", href=re.compile(r"/play/\d+-\d+-\d+\.html")):
            href = a.get("href", "")
            text = a.get_text(strip=True)
            m = re.match(r"/play/(\d+)-(\d+)-(\d+)\.html", href)
            if not m:
                continue
            v_id, sid, nid = map(int, m.groups())
            if v_id != vid:
                continue
            sid_set.add(sid)
            eps.append({
                "name": text,
                "url": urllib.parse.urljoin(BASE_URL, href),
                "sid": sid,
                "nid": nid,
            })
        if eps:
            # 这个tab对应的sid（同一playlist里应该只有一个sid）
            sid = eps[0]["sid"]
            eps_sorted = sorted(eps, key=lambda x: x["nid"])
            play_sources_final.append({
                "source_id": sid,
                "source_name": tab_name,
                "episodes": eps_sorted,
            })
    # 如果上面没匹配到（可能模板不同），用兜底逻辑
    if not play_sources_final:
        play_links_all = []
        for a in soup.find_all("a", href=re.compile(r"/play/\d+-\d+-\d+\.html")):
            href = a.get("href", "")
            text = a.get_text(strip=True)
            m = re.match(r"/play/(\d+)-(\d+)-(\d+)\.html", href)
            if not m:
                continue
            v_id, sid, nid = map(int, m.groups())
            if v_id != vid:
                continue
            play_links_all.append({
                "sid": sid, "nid": nid, "name": text,
                "url": urllib.parse.urljoin(BASE_URL, href),
            })
        ep_by_sid = {}
        for ep in play_links_all:
            ep_by_sid.setdefault(ep["sid"], []).append(ep)
        for sid in sorted(ep_by_sid.keys()):
            eps = sorted(ep_by_sid[sid], key=lambda x: x["nid"])
            play_sources_final.append({
                "source_id": sid,
                "source_name": f"线路{sid}",
                "episodes": eps,
            })
    # 过滤掉"立即播放"等非线路按钮（已不包含）
    data["play_sources"] = play_sources_final

    # ---- 封面 ----
    cover_img = None
    # 优先从详情主图区（myui-content__thumb / content__thumb）找
    for thumb_cls in ("myui-content__thumb", "content__thumb", "detail-pic", "vod-pic"):
        thumb_div = soup.find(class_=re.compile(thumb_cls))
        if thumb_div:
            img = thumb_div.find("img")
            if img:
                cover_img = img
                break
    # 次选：查找lazyload图片（有data-original的）
    if not cover_img:
        for img in soup.find_all("img", attrs={"data-original": True}):
            src = img.get("data-original", "")
            if src and re.search(r"\.(jpg|jpeg|png|webp)", src, re.I) and \
               not re.search(r"(logo|load\.)", src, re.I):
                cover_img = img
                break
    # 再次选：找alt等于标题的图片
    if not cover_img and data["title"]:
        for img in soup.find_all("img", alt=lambda x: x and data["title"][:6] in x):
            cover_img = img
            break
    # 兜底：第一个非logo/load的图片
    if not cover_img:
        for img in soup.find_all("img"):
            src = img.get("data-original") or img.get("data-src") or img.get("src") or ""
            if src and re.search(r"\.(jpg|jpeg|png|webp)", src, re.I) and \
               not re.search(r"(logo|/load\.|/icon|/avatar|loading|share\.png)", src, re.I):
                cover_img = img
                break
    if cover_img:
        # 优先取 data-original（lazyload真实地址），其次data-src，最后src
        src = (cover_img.get("data-original") or cover_img.get("data-src")
               or cover_img.get("src") or "")
        if src and not re.search(r"(/load\.|logo)", src):
            data["cover_url"] = urllib.parse.urljoin(BASE_URL, src)

    # ---- 简介 ----
    desc_container = None
    for kw in ("desc", "summary", "intro", "plot", "synopsis", "content", "detail-text", "sketch", "bangumi"):
        desc_container = soup.find("div", class_=re.compile(kw, re.I))
        if desc_container and len(desc_container.get_text(strip=True)) > 30:
            break
        desc_container = None
    if desc_container:
        data["description"] = desc_container.get_text(" ", strip=True)[:2000]
    else:
        # 找最长的段落
        best_p = None
        best_len = 0
        for tag in soup.find_all(["p", "div", "span"]):
            t = tag.get_text(" ", strip=True)
            if 80 < len(t) < 3000 and len(t) > best_len:
                # 排除导航/列表类
                if t.count(" ") > 3 or t.count("，") > 2:
                    best_p = t
                    best_len = len(t)
        if best_p:
            data["description"] = best_p[:2000]

    # ---- 网盘下载链接 ----
    for a in soup.find_all("a", href=True):
        href = a["href"]
        if "pan.quark.cn" in href and not data["quark_url"]:
            data["quark_url"] = href
        elif "pan.baidu.com" in href and not data["baidu_url"]:
            data["baidu_url"] = href

    return data


# ============ 播放页解析：提取真实视频地址 ============
def parse_play_page(html):
    """
    返回 {"encrypt": int, "from": str, "urls": [解密后的地址列表], "raw_url": str}
    """
    result = {"encrypt": 0, "from": "", "raw_url": "", "urls": []}

    # 提取 player_aaaa JSON
    m = re.search(r"var player_aaaa\s*=\s*(\{.*?\})\s*</script>", html, re.DOTALL)
    if not m:
        m = re.search(r"var player_aaaa\s*=\s*(\{[^;]+\});", html, re.DOTALL)
    if m:
        raw = m.group(1)
        # 提取字段（避免整体JSON解析被后续内容破坏）
        def extract_field(key):
            mm = re.search(rf'"{key}"\s*:\s*"([^"]*)"', raw)
            return mm.group(1) if mm else ""
        enc_str = extract_field("encrypt")
        try:
            result["encrypt"] = int(enc_str) if enc_str else 0
        except ValueError:
            result["encrypt"] = 0
        result["from"] = extract_field("from")
        result["raw_url"] = extract_field("url")
        raw_next = extract_field("url_next")

        # 解密
        if result["raw_url"]:
            dec = decrypt_play_url(result["raw_url"], result["encrypt"])
            if dec and not dec.startswith("[encrypt=3]"):
                result["urls"].append(dec)

    # 兜底：正则直接扫 m3u8/mp4（严格过滤掉网盘链接、本站链接）
    if not result["urls"]:
        for pat in [
            r'(https?://[^\s"\'<>]+\.m3u8(?:\?[^\s"\'<>]*)?)',
            r'(https?://[^\s"\'<>]+\.mp4(?:\?[^\s"\'<>]*)?)',
        ]:
            for mm in re.findall(pat, html):
                mm = mm.replace("\\/", "/")
                # 过滤掉网盘/本站/常见非视频域名
                if any(blk in mm for blk in ("pan.quark", "pan.baidu", "didahd.xyz",
                                              "aliyundrive", "xunlei", ".jpg", ".png")):
                    continue
                if mm not in result["urls"]:
                    result["urls"].append(mm)

    return result


# ============ 主爬虫 ============
class DidaHDSpider:
    def __init__(self, delay=1.5, max_pages=None, categories=None,
                 download_covers=False, workers=3):
        self.delay = delay
        self.max_pages = max_pages
        self.categories = categories or list(CATEGORIES.keys())
        self.download_covers = download_covers
        self.workers = max(1, workers)
        self.conn = init_db()
        self.crawled_urls = set()
        self._load_progress()
        # 线程本地session
        self._thread_local = threading.local()

    def _get_session(self):
        if not hasattr(self._thread_local, "session"):
            self._thread_local.session = make_session()
        return self._thread_local.session

    def _load_progress(self):
        with _db_lock:
            c = self.conn.cursor()
            c.execute("SELECT url FROM crawl_progress WHERE status='done'")
            for row in c.fetchall():
                self.crawled_urls.add(row[0])

    def _mark_done(self, url):
        with _db_lock:
            c = self.conn.cursor()
            c.execute(
                "INSERT OR REPLACE INTO crawl_progress (url, status, updated_at) VALUES (?, 'done', ?)",
                (url, datetime.now().isoformat()),
            )
            self.conn.commit()
        self.crawled_urls.add(url)

    def is_crawled(self, url):
        return url in self.crawled_urls

    # ---- 列表抓取 ----
    def crawl_category(self, cat_id):
        """抓取某分类全部列表页，返回详情页URL列表"""
        session = self._get_session()
        all_urls = []
        page = 1
        while True:
            if self.max_pages and page > self.max_pages:
                print(f"[{CATEGORIES[cat_id]}] 达到最大页数 {self.max_pages}，停止翻页")
                break
            url = build_list_url(cat_id, page)
            print(f"[{CATEGORIES[cat_id]}] 第 {page} 页 -> {url}")
            html = fetch(session, url)
            if not html:
                print(f"[{CATEGORIES[cat_id]}] 第 {page} 页请求失败，停止分页")
                break
            urls, has_next, total_p = parse_list_page(html, cat_id)
            new_urls = [u for u in urls if u not in all_urls]
            all_urls.extend(new_urls)
            print(f"[{CATEGORIES[cat_id]}] 第 {page} 页新增 {len(new_urls)} 条 (累计 {len(all_urls)}，共约 {total_p} 页)")
            if not has_next or not urls:
                break
            page += 1
            polite_sleep(self.delay)
        return all_urls

    # ---- 单视频抓取 ----
    def crawl_one(self, detail_url, cat_id):
        if self.is_crawled(detail_url):
            return None
        session = self._get_session()
        html = fetch(session, detail_url)
        if not html:
            return None
        try:
            data = parse_detail_page(html, detail_url, cat_id)
        except Exception as e:
            print(f"[!] 解析失败 {detail_url}: {e}")
            return None

        episodes_out = []
        # 抓取每个播放页
        for src in data["play_sources"]:
            for ep in src["episodes"]:
                play_url = ep["url"]
                play_html = fetch(session, play_url)
                real_urls_str = ""
                enc_type = 0
                if play_html:
                    parsed = parse_play_page(play_html)
                    enc_type = parsed["encrypt"]
                    real_urls_str = " | ".join(parsed["urls"]) if parsed["urls"] else ""
                    polite_sleep(self.delay * 0.5)
                episodes_out.append({
                    "video_id": data["id"],
                    "source_name": src["source_name"],
                    "episode_name": ep["name"],
                    "play_url": play_url,
                    "real_video_url": real_urls_str,
                    "encrypt_type": enc_type,
                })

        data["episodes"] = episodes_out

        # 下载封面
        if self.download_covers and data["cover_url"]:
            self._download(data["cover_url"], os.path.join("covers", f"{data['id']}.jpg"))

        self._save(data)
        self._mark_done(detail_url)
        return data

    def _download(self, url, rel_path):
        try:
            full = os.path.join(OUTPUT_DIR, rel_path)
            if os.path.exists(full) and os.path.getsize(full) > 100:
                return
            session = self._get_session()
            r = session.get(url, timeout=30, stream=True)
            if r.status_code == 200:
                with open(full, "wb") as f:
                    for chunk in r.iter_content(8192):
                        f.write(chunk)
        except Exception:
            pass

    def _save(self, data):
        with _db_lock:
            c = self.conn.cursor()
            try:
                c.execute("""INSERT OR REPLACE INTO videos
                    (id, title, category_id, category_name, rating, status, area, language, year,
                     actors, director, tags, total_episodes, cover_url, description, detail_url,
                     quark_url, baidu_url, play_sources, crawled_at)
                    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)""",
                    (data["id"], data["title"], data["category_id"], data["category_name"],
                     data["rating"], data["status"], data["area"], data["language"], data["year"],
                     json.dumps(data["actors"], ensure_ascii=False),
                     data["director"],
                     json.dumps(data["tags"], ensure_ascii=False),
                     data["total_episodes"], data["cover_url"], data["description"],
                     data["detail_url"], data["quark_url"], data["baidu_url"],
                     json.dumps(data["play_sources"], ensure_ascii=False),
                     datetime.now().isoformat()))
                c.execute("DELETE FROM episodes WHERE video_id=?", (data["id"],))
                for ep in data["episodes"]:
                    c.execute("""INSERT INTO episodes
                        (video_id, source_name, episode_name, play_url, real_video_url, encrypt_type)
                        VALUES (?,?,?,?,?,?)""",
                        (ep["video_id"], ep["source_name"], ep["episode_name"],
                         ep["play_url"], ep["real_video_url"], ep["encrypt_type"]))
                self.conn.commit()
            except Exception as e:
                print(f"[!] DB写入失败 ({data['title']}): {e}")
                self.conn.rollback()

    # ---- 导出 ----
    def export_json(self):
        with _db_lock:
            c = self.conn.cursor()
            c.execute("SELECT * FROM videos ORDER BY category_id, id DESC")
            cols = [d[0] for d in c.description]
            videos = []
            for row in c.fetchall():
                v = dict(zip(cols, row))
                v["actors"] = json.loads(v["actors"]) if v["actors"] else []
                v["tags"] = json.loads(v["tags"]) if v["tags"] else []
                v["play_sources"] = json.loads(v["play_sources"]) if v["play_sources"] else []
                c2 = self.conn.cursor()
                c2.execute("SELECT source_name, episode_name, play_url, real_video_url, encrypt_type "
                           "FROM episodes WHERE video_id=?", (v["id"],))
                v["episodes"] = [{
                    "source": r[0], "episode": r[1], "play_url": r[2],
                    "real_url": r[3], "encrypt": r[4],
                } for r in c2.fetchall()]
                videos.append(v)
        out = os.path.join(OUTPUT_DIR, "didahd_all_videos.json")
        with open(out, "w", encoding="utf-8") as f:
            json.dump({
                "site": BASE_URL,
                "crawled_at": datetime.now().isoformat(),
                "total": len(videos),
                "videos": videos,
            }, f, ensure_ascii=False, indent=2)
        print(f"[✓] JSON导出 -> {out}  ({len(videos)} 条)")
        return out

    def export_csv(self):
        out = os.path.join(OUTPUT_DIR, "didahd_videos_list.csv")
        with _db_lock:
            c = self.conn.cursor()
            c.execute("""SELECT id, title, category_name, rating, status, area, language, year,
                                director, quark_url, baidu_url, detail_url
                         FROM videos ORDER BY category_id, id DESC""")
            rows = c.fetchall()
        with open(out, "w", encoding="utf-8-sig", newline="") as f:
            w = csv.writer(f)
            w.writerow(["ID", "标题", "分类", "豆瓣评分", "状态", "地区", "语言", "年份",
                        "导演", "夸克网盘", "百度网盘", "详情页"])
            w.writerows(rows)
        print(f"[✓] CSV导出  -> {out}  ({len(rows)} 条)")
        return out

    def export_readme(self, elapsed, stats):
        md = f"""# 嘀嗒影视 (didahd.xyz) 爬虫抓取报告

- 抓取时间：{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}
- 目标站点：{BASE_URL}
- 耗时：{elapsed:.1f} 秒
- 请求延迟：{self.delay}s，并发：{self.workers}

## 数据统计
"""
        for k, v in stats.items():
            md += f"- **{k}**：{v} 条\n"
        md += f"""
## 文件说明
| 文件 | 说明 |
|------|------|
| `didahd_all_videos.json` | 完整数据（含所有元信息+播放源+网盘链接+每集信息） |
| `didahd_videos_list.csv` | 视频简表（可用Excel打开） |
| `didahd.db` | SQLite数据库（可用DB Browser for SQLite查看） |
| `covers/` | 封面图（需启用 --download） |

## 使用方法
```bash
# 完整全站抓取
python3 didahd_spider.py

# 只抓电影(1)和电视剧(2)，每类前3页
python3 didahd_spider.py --type 1 2 --max-pages 3

# 慢速防封（间隔2秒，单线程）
python3 didahd_spider.py --delay 2 --workers 1

# 带封面下载
python3 didahd_spider.py --download

# 重新导出（不重新爬）
python3 didahd_spider.py --export-only
```

## 字段说明
- **quark_url**：夸克网盘下载链接
- **baidu_url**：百度网盘下载链接（含提取码）
- **play_sources**：各播放线路与集数列表
- **real_video_url**：播放页解析出的真实视频地址（encrypt=1/2可自动解密，encrypt=3为加密需浏览器播放）
- **rating**：豆瓣评分
"""
        path = os.path.join(OUTPUT_DIR, "README.md")
        with open(path, "w", encoding="utf-8") as f:
            f.write(md)
        print(f"[✓] 说明文档 -> {path}")

    def run(self):
        print("=" * 62)
        print(f"  嘀嗒影视全站爬虫启动  -> {BASE_URL}")
        print(f"  分类: {[CATEGORIES[c] for c in self.categories]}")
        print(f"  每类最大页数: {self.max_pages or '不限'}")
        print(f"  请求延迟: {self.delay}s | 并发: {self.workers}")
        print("=" * 62)

        t0 = time.time()

        # 1. 收集所有详情页URL
        cat_urls = {}
        for cid in self.categories:
            urls = self.crawl_category(cid)
            cat_urls[cid] = urls
            polite_sleep(self.delay)
        total = sum(len(u) for u in cat_urls.values())
        already = sum(1 for urls in cat_urls.values() for u in urls if self.is_crawled(u))
        todo = total - already
        print(f"\n[*] 共发现 {total} 个视频（已爬过 {already}，待爬 {todo}）\n")

        # 2. 多线程抓取详情
        done = already
        fail = 0
        if todo > 0:
            with ThreadPoolExecutor(max_workers=self.workers) as pool:
                futures = {}
                for cid, urls in cat_urls.items():
                    for u in urls:
                        if not self.is_crawled(u):
                            fut = pool.submit(self.crawl_one, u, cid)
                            futures[fut] = u
                for i, fut in enumerate(as_completed(futures), 1):
                    u = futures[fut]
                    try:
                        res = fut.result()
                        if res:
                            done += 1
                            if i % 10 == 0 or done == total:
                                elapsed = time.time() - t0
                                eta = elapsed / i * (todo - i) if i > 0 else 0
                                print(f"  [进度] {done}/{total}  ({i}/{todo} 本轮) | "
                                      f"{elapsed:.0f}s已用, 预计还需{eta:.0f}s | {res['title']}")
                        else:
                            fail += 1
                    except Exception as e:
                        fail += 1
                        print(f"[!] 异常 {u}: {e}")

        elapsed = time.time() - t0

        # 3. 导出
        print()
        self.export_json()
        self.export_csv()
        # 统计
        with _db_lock:
            c = self.conn.cursor()
            stats = {}
            for cid, name in CATEGORIES.items():
                c.execute("SELECT COUNT(*) FROM videos WHERE category_id=?", (cid,))
                stats[name] = c.fetchone()[0]
            c.execute("SELECT COUNT(*) FROM videos")
            stats["总计"] = c.fetchone()[0]
            c.execute("SELECT COUNT(*) FROM episodes")
            stats["总集数"] = c.fetchone()[0]
        self.export_readme(elapsed, stats)

        print(f"\n{'='*62}")
        print(f"  完成！成功 {done}, 失败 {fail}, 耗时 {elapsed:.1f}s")
        print(f"  输出目录: {os.path.abspath(OUTPUT_DIR)}")
        print(f"{'='*62}")


# ============ 入口 ============
def main():
    parser = argparse.ArgumentParser(description="嘀嗒影视(didahd.xyz)全站爬虫")
    parser.add_argument("--type", type=int, nargs="+", default=None,
                        help="指定分类ID：1电影 2电视剧 3纪录片 4动漫 5综艺（默认全部）")
    parser.add_argument("--max-pages", type=int, default=None,
                        help="每个分类最多抓取多少页（默认不限制，全站抓取）")
    parser.add_argument("--delay", type=float, default=1.5,
                        help="请求间隔秒数（默认1.5，建议不要低于1，以免被封IP）")
    parser.add_argument("--workers", type=int, default=3,
                        help="并发线程数（默认3，建议1-5之间）")
    parser.add_argument("--download", action="store_true",
                        help="同时下载封面图片到 covers/ 目录")
    parser.add_argument("--export-only", action="store_true",
                        help="不发起新的抓取，只从已有数据库重新导出JSON/CSV")
    args = parser.parse_args()

    ensure_dirs()
    cats = args.type if args.type else list(CATEGORIES.keys())

    spider = DidaHDSpider(
        delay=args.delay,
        max_pages=args.max_pages,
        categories=cats,
        download_covers=args.download,
        workers=args.workers,
    )

    if args.export_only:
        spider.export_json()
        spider.export_csv()
        return

    spider.run()


if __name__ == "__main__":
    main()
