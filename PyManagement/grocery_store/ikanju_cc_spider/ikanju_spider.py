#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
ikanju.cc (云播TV) 全站爬虫
====================================
网站技术: MacCMS v10 + Cloudflare CDN
加密方式:
  - encrypt=0: 明文URL
  - encrypt=1: URL编码 (unescape)
  - encrypt=2: Base64 + URL编码 (unescape(base64decode(url)))
播放机制:
  - 源URL指向爱奇艺/腾讯视频/优酷/芒果TV/B站等官方平台
  - 通过第三方解析接口 super.one-ai.cc 嵌入iframe播放
  - m3u8源通过 super.yunbo.net 解析

功能:
  1. 抓取分类列表（电影/电视剧/动漫/综艺）
  2. 通过vod ID遍历抓取全部视频详情
  3. 抓取每个视频的所有播放源和集数
  4. 自动解密加密的播放URL
  5. 支持Cloudflare请求、Session保持、限速、断点续爬
  6. 数据保存为JSON/CSV/SQLite

用法:
  python3 ikanju_spider.py [--start START_ID] [--end END_ID] [--mode full|category|detail|range]
"""

import requests
import re
import json
import base64
import time
import sqlite3
import csv
import os
import sys
import argparse
import logging
import urllib.parse
from urllib.parse import urljoin
from concurrent.futures import ThreadPoolExecutor, as_completed
from threading import Lock
from datetime import datetime
from bs4 import BeautifulSoup

# ===================== 配置 =====================
BASE_URL = "https://www.ikanju.cc"
DEFAULT_HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
    "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
    "Accept-Encoding": "gzip, deflate, br",
    "Connection": "keep-alive",
}

# 分类URL映射
CATEGORIES = {
    "movie": {"url": "/movie.html", "name": "电影"},
    "series": {"url": "/series.html", "name": "电视剧"},
    "anime": {"url": "/anime.html", "name": "动漫"},
    "variety": {"url": "/variety.html", "name": "综艺"},
}

# 播放源名称映射（MacCMS标准）
FROM_NAMES = {
    "qq": "腾讯视频",
    "qiyi": "爱奇艺",
    "youku": "优酷",
    "mgtv": "芒果TV",
    "bilibili": "哔哩哔哩",
    "lzm3u8": "量子M3U8",
    "dnzm3u8": "dadaizi",
    "liangzi": "量子云",
    "hnm3u8": "红牛",
    "dplayer": "DPlayer",
    "videojs": "VideoJS",
    "iva": "IVA",
    "iframe": "Iframe外链",
    "link": "外链跳转",
    "flv": "FLV文件",
    "swf": "Flash文件",
}

# 解析接口配置
PARSE_APIS = {
    "default": "https://super.one-ai.cc/player/index.php?code=qw&url=",
    "m3u8": "https://super.yunbo.net/player/index.php?code=DP&url=",
}

# ===================== 日志配置 =====================
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
    handlers=[
        logging.StreamHandler(sys.stdout),
        logging.FileHandler("ikanju_spider.log", encoding="utf-8"),
    ],
)
logger = logging.getLogger(__name__)


# ===================== 解密模块 =====================
def url_unescape(s):
    """等价于JS的unescape()，处理URL编码"""
    if not s:
        return s
    try:
        return urllib.parse.unquote(s)
    except Exception:
        return s


def base64_decode(s):
    """安全的Base64解码，处理填充问题"""
    if not s:
        return s
    s = s.strip()
    # 修复padding
    padding = 4 - len(s) % 4
    if padding != 4:
        s += "=" * padding
    try:
        return base64.b64decode(s).decode("utf-8", errors="replace")
    except Exception:
        try:
            return base64.urlsafe_b64decode(s).decode("utf-8", errors="replace")
        except Exception:
            return s


def decrypt_player_url(encrypt_val, url):
    """
    根据player_aaaa中的encrypt值解密URL
    逆向自player.js:
      encrypt==='1' -> unescape(url)
      encrypt==='2' -> unescape(base64decode(url))
      else          -> 明文
    """
    try:
        enc = int(encrypt_val) if encrypt_val is not None else 0
    except (ValueError, TypeError):
        enc = 0

    if enc == 1:
        return url_unescape(url)
    elif enc == 2:
        decoded = base64_decode(url)
        return url_unescape(decoded)
    else:
        return url


def get_parse_url(from_src, raw_url):
    """根据播放源类型获取解析后的iframe播放地址"""
    if from_src in ("qq", "qiyi", "youku", "mgtv", "bilibili"):
        return PARSE_APIS["default"] + urllib.parse.quote(raw_url, safe="")
    elif from_src in ("lzm3u8", "dnzm3u8", "liangzi", "hnm3u8"):
        return PARSE_APIS["m3u8"] + urllib.parse.quote(raw_url, safe="")
    elif from_src in ("dplayer", "videojs", "iva", "flv", "swf"):
        return raw_url  # 直链，使用内置播放器
    elif from_src == "iframe":
        return raw_url
    elif from_src == "link":
        return raw_url
    return raw_url


# ===================== JSON解析修复 =====================
def extract_player_aaaa(html):
    """
    从播放页HTML中提取并解析player_aaaa对象
    MacCMS的player_aaaa由于vod_data中含中文和特殊字符，直接json.loads可能失败
    采用正则精确提取字段
    """
    m = re.search(r"var player_aaaa\s*=\s*(\{.*?\})\s*;?\s*(?:</script>|\n|$)", html, re.DOTALL)
    if not m:
        return None
    raw = m.group(1)
    result = {}
    fields = [
        "flag", "encrypt", "trysee", "points", "link", "link_next", "link_pre",
        "url", "url_next", "from", "server", "note", "id", "sid", "nid",
    ]
    for key in fields:
        # 字符串值
        km = re.search(r'"' + key + r'"\s*:\s*"((?:[^"\\]|\\.)*)"', raw)
        if km:
            val = km.group(1)
            val = val.replace("\\/", "/").replace('\\"', '"').replace("\\n", "\n")
            val = val.replace("\\r", "\r").replace("\\t", "\t")
            result[key] = val
        else:
            # 数字值
            km2 = re.search(r'"' + key + r'"\s*:\s*(\d+)', raw)
            if km2:
                result[key] = int(km2.group(1))
            else:
                # 布尔值
                km3 = re.search(r'"' + key + r'"\s*:\s*(true|false|null)', raw)
                if km3:
                    result[key] = {"true": True, "false": False, "null": None}[km3.group(1)]
    return result


# ===================== 数据库管理 =====================
class Database:
    def __init__(self, db_path="ikanju_data.db"):
        self.db_path = db_path
        self.lock = Lock()
        self._init_db()

    def _init_db(self):
        conn = sqlite3.connect(self.db_path)
        c = conn.cursor()
        c.execute("""CREATE TABLE IF NOT EXISTS videos (
            vod_id INTEGER PRIMARY KEY,
            type_id INTEGER,
            type_name TEXT,
            vod_name TEXT,
            vod_sub TEXT,
            vod_pic TEXT,
            vod_actor TEXT,
            vod_director TEXT,
            vod_blurb TEXT,
            vod_content TEXT,
            vod_class TEXT,
            vod_area TEXT,
            vod_lang TEXT,
            vod_year TEXT,
            vod_score REAL,
            vod_hits INTEGER,
            vod_pubdate TEXT,
            vod_total INTEGER,
            vod_serial TEXT,
            vod_remarks TEXT,
            vod_duration TEXT,
            detail_url TEXT,
            status INTEGER DEFAULT 0,
            crawled_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )""")
        c.execute("""CREATE TABLE IF NOT EXISTS play_sources (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            vod_id INTEGER,
            source_name TEXT,
            source_from TEXT,
            episode_name TEXT,
            episode_index INTEGER,
            sid INTEGER,
            nid INTEGER,
            raw_url TEXT,
            decrypted_url TEXT,
            parse_url TEXT,
            encrypt INTEGER,
            play_url TEXT,
            FOREIGN KEY (vod_id) REFERENCES videos(vod_id)
        )""")
        c.execute("""CREATE TABLE IF NOT EXISTS crawl_progress (
            key TEXT PRIMARY KEY,
            value TEXT
        )""")
        conn.commit()
        conn.close()

    def save_video(self, video):
        with self.lock:
            conn = sqlite3.connect(self.db_path)
            c = conn.cursor()
            try:
                c.execute("""INSERT OR REPLACE INTO videos 
                    (vod_id, type_id, type_name, vod_name, vod_sub, vod_pic, vod_actor,
                     vod_director, vod_blurb, vod_content, vod_class, vod_area, vod_lang,
                     vod_year, vod_score, vod_hits, vod_pubdate, vod_total, vod_serial,
                     vod_remarks, vod_duration, detail_url, status, crawled_at)
                    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)""",
                    (video.get("vod_id"), video.get("type_id"), video.get("type_name"),
                     video.get("vod_name"), video.get("vod_sub"), video.get("vod_pic"),
                     video.get("vod_actor"), video.get("vod_director"), video.get("vod_blurb"),
                     video.get("vod_content"), video.get("vod_class"), video.get("vod_area"),
                     video.get("vod_lang"), video.get("vod_year"), video.get("vod_score", 0),
                     video.get("vod_hits", 0), video.get("vod_pubdate"), video.get("vod_total", 0),
                     video.get("vod_serial"), video.get("vod_remarks"), video.get("vod_duration"),
                     video.get("detail_url"), video.get("status", 1),
                     datetime.now().isoformat()))
                conn.commit()
            except Exception as e:
                logger.error(f"保存视频{video.get('vod_id')}失败: {e}")
                conn.rollback()
            finally:
                conn.close()

    def save_play_sources(self, vod_id, sources):
        with self.lock:
            conn = sqlite3.connect(self.db_path)
            c = conn.cursor()
            try:
                for src in sources:
                    c.execute("""INSERT INTO play_sources 
                        (vod_id, source_name, source_from, episode_name, episode_index,
                         sid, nid, raw_url, decrypted_url, parse_url, encrypt, play_url)
                        VALUES (?,?,?,?,?,?,?,?,?,?,?,?)""",
                        (vod_id, src.get("source_name"), src.get("source_from"),
                         src.get("episode_name"), src.get("episode_index"),
                         src.get("sid"), src.get("nid"), src.get("raw_url"),
                         src.get("decrypted_url"), src.get("parse_url"),
                         src.get("encrypt"), src.get("play_url")))
                conn.commit()
            except Exception as e:
                logger.error(f"保存播放源失败(vod_id={vod_id}): {e}")
                conn.rollback()
            finally:
                conn.close()

    def delete_play_sources(self, vod_id):
        with self.lock:
            conn = sqlite3.connect(self.db_path)
            c = conn.cursor()
            c.execute("DELETE FROM play_sources WHERE vod_id=?", (vod_id,))
            conn.commit()
            conn.close()

    def is_crawled(self, vod_id):
        conn = sqlite3.connect(self.db_path)
        c = conn.cursor()
        c.execute("SELECT status FROM videos WHERE vod_id=? AND status=1", (vod_id,))
        row = c.fetchone()
        conn.close()
        return row is not None

    def get_crawled_ids(self):
        conn = sqlite3.connect(self.db_path)
        c = conn.cursor()
        c.execute("SELECT vod_id FROM videos WHERE status=1")
        ids = [r[0] for r in c.fetchall()]
        conn.close()
        return set(ids)

    def get_statistics(self):
        conn = sqlite3.connect(self.db_path)
        c = conn.cursor()
        c.execute("SELECT COUNT(*) FROM videos WHERE status=1")
        v_count = c.fetchone()[0]
        c.execute("SELECT COUNT(*) FROM play_sources")
        p_count = c.fetchone()[0]
        c.execute("SELECT type_name, COUNT(*) FROM videos WHERE status=1 GROUP BY type_name")
        by_type = c.fetchall()
        conn.close()
        return {"videos": v_count, "play_sources": p_count, "by_type": by_type}

    def get_progress(self, key):
        conn = sqlite3.connect(self.db_path)
        c = conn.cursor()
        c.execute("SELECT value FROM crawl_progress WHERE key=?", (key,))
        row = c.fetchone()
        conn.close()
        return row[0] if row else None

    def set_progress(self, key, value):
        with self.lock:
            conn = sqlite3.connect(self.db_path)
            c = conn.cursor()
            c.execute("INSERT OR REPLACE INTO crawl_progress VALUES (?,?)", (key, str(value)))
            conn.commit()
            conn.close()

    def export_json(self, filepath="ikanju_data.json"):
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        c = conn.cursor()
        c.execute("SELECT * FROM videos WHERE status=1 ORDER BY vod_id")
        videos = [dict(r) for r in c.fetchall()]
        for v in videos:
            c.execute("SELECT * FROM play_sources WHERE vod_id=? ORDER BY sid, nid", (v["vod_id"],))
            v["play_sources"] = [dict(r) for r in c.fetchall()]
        conn.close()
        with open(filepath, "w", encoding="utf-8") as f:
            json.dump(videos, f, ensure_ascii=False, indent=2, default=str)
        logger.info(f"已导出JSON到 {filepath}, 共{len(videos)}条记录")

    def export_csv(self, filepath="ikanju_videos.csv"):
        conn = sqlite3.connect(self.db_path)
        c = conn.cursor()
        c.execute("SELECT * FROM videos WHERE status=1 ORDER BY vod_id")
        rows = c.fetchall()
        cols = [desc[0] for desc in c.description]
        conn.close()
        with open(filepath, "w", encoding="utf-8-sig", newline="") as f:
            writer = csv.writer(f)
            writer.writerow(cols)
            writer.writerows(rows)
        logger.info(f"已导出CSV到 {filepath}, 共{len(rows)}条记录")


# ===================== 爬虫核心 =====================
class IkanjuSpider:
    def __init__(self, delay=1.0, max_workers=3, db_path="ikanju_data.db"):
        self.session = requests.Session()
        self.session.headers.update(DEFAULT_HEADERS)
        self.delay = delay
        self.max_workers = max_workers
        self.db = Database(db_path)
        self._init_session()

    def _init_session(self):
        """初始化Session，访问首页获取必要的Cookie"""
        try:
            r = self.session.get(BASE_URL, timeout=15)
            logger.info(f"初始化Session完成, 状态码={r.status_code}")
            time.sleep(self.delay)
        except Exception as e:
            logger.warning(f"初始化Session失败: {e}")

    def _request(self, url, method="get", retries=3, **kwargs):
        """带重试的HTTP请求"""
        if not url.startswith("http"):
            url = urljoin(BASE_URL, url)
        for attempt in range(retries):
            try:
                if method.lower() == "post":
                    r = self.session.post(url, timeout=20, **kwargs)
                else:
                    r = self.session.get(url, timeout=20, **kwargs)
                # Cloudflare 5秒盾检测
                if r.status_code == 503 or "Just a moment" in r.text[:1000]:
                    logger.warning(f"遭遇Cloudflare验证({url}), 等待重试...")
                    time.sleep(5 * (attempt + 1))
                    continue
                if r.status_code == 200:
                    return r
                else:
                    logger.warning(f"请求返回{r.status_code}: {url}")
                    time.sleep(2 * (attempt + 1))
            except requests.exceptions.RequestException as e:
                logger.warning(f"请求异常({url}, 尝试{attempt+1}/{retries}): {e}")
                time.sleep(3 * (attempt + 1))
        return None

    def get_category_vod_ids(self, category):
        """从分类页获取vod ID列表"""
        cat_info = CATEGORIES.get(category)
        if not cat_info:
            logger.error(f"未知分类: {category}")
            return []
        url = BASE_URL + cat_info["url"]
        logger.info(f"正在抓取分类: {cat_info['name']} ({url})")
        r = self._request(url)
        if not r:
            return []
        vod_links = re.findall(r'href="(/vod-(\d+)\.html)"', r.text)
        vod_ids = sorted(set(int(vid) for _, vid in vod_links))
        logger.info(f"分类[{cat_info['name']}]获取到{len(vod_ids)}个视频ID")
        return vod_ids

    def get_all_category_ids(self):
        """获取所有分类页的vod ID"""
        all_ids = set()
        for cat in CATEGORIES:
            ids = self.get_category_vod_ids(cat)
            all_ids.update(ids)
            time.sleep(self.delay)
        logger.info(f"分类页共获取{len(all_ids)}个唯一视频ID")
        return sorted(all_ids)

    def get_sitemap_ids(self):
        """从sitemap获取vod ID"""
        r = self._request(BASE_URL + "/sitemap.xml")
        if not r:
            return []
        locs = re.findall(r"<loc>(.*?)</loc>", r.text)
        vod_ids = []
        for loc in locs:
            m = re.search(r"/vod-(\d+)\.html", loc)
            if m:
                vod_ids.append(int(m.group(1)))
        vod_ids = sorted(set(vod_ids))
        logger.info(f"Sitemap获取到{len(vod_ids)}个视频ID")
        return vod_ids

    def get_ajax_max_id(self):
        """通过AJAX接口获取最大ID和总数"""
        url = BASE_URL + "/index.php/ajax/data?mid=1"
        r = self._request(url, headers={"X-Requested-With": "XMLHttpRequest"})
        if r:
            try:
                data = r.json()
                total = data.get("total", 0)
                pagecount = data.get("pagecount", 0)
                limit = data.get("limit", 10)
                logger.info(f"AJAX接口: total={total}, pagecount={pagecount}, limit={limit}")
                return total
            except Exception:
                pass
        return 0

    def parse_detail_page(self, vod_id):
        """解析视频详情页"""
        url = f"{BASE_URL}/vod-{vod_id}.html"
        r = self._request(url)
        if not r or r.status_code != 200:
            logger.debug(f"详情页请求失败: {url}")
            return None

        html = r.text
        if len(html) < 500 or "404" in html[:500] or "不存在" in html[:2000]:
            logger.debug(f"视频{vod_id}不存在或已删除")
            return {"vod_id": vod_id, "status": -1}

        video = {"vod_id": vod_id, "detail_url": url, "status": 1}

        # 标题
        title_m = re.search(r"<title>(.*?)</title>", html)
        if title_m:
            video["_page_title"] = title_m.group(1)

        # 使用BeautifulSoup解析元数据
        soup = BeautifulSoup(html, "html.parser")

        # 视频名称
        name_el = soup.select_one(".video-info-title h1, .vodh h2, h1.title, .movie-title, [class*=title] h1")
        if name_el:
            video["vod_name"] = name_el.get_text(strip=True)
        else:
            # 从title提取
            if title_m:
                t = title_m.group(1)
                t = re.split(r"[《》]", t)
                if len(t) >= 2:
                    video["vod_name"] = t[1]

        # 海报
        img_el = soup.select_one(".video-info-pic img, .vod-img img, .detail-pic img, .movie-img img")
        if img_el:
            video["vod_pic"] = img_el.get("data-src") or img_el.get("src", "")

        # 简介
        blurb_el = soup.select_one(".video-info-content, .vod-content, .movie-intro, .desc, .content")
        if blurb_el:
            video["vod_blurb"] = blurb_el.get_text(strip=True)

        # 解析信息块 - 网站使用 ul>li>em+内容 的结构化列表
        # 优先选择结构最完整的 .info-parameter ul（移动端抽屉，含完整字段）
        info_el = soup.select_one(".info-parameter ul")
        if not info_el:
            info_el = soup.select_one(".gen-search-form")
        if not info_el:
            info_el = soup.select_one(".detail-info, .vod-detail")
        info_data = {}
        if info_el:
            # 遍历所有li，每个li对应一个字段
            for li in info_el.find_all("li", recursive=True):
                em = li.find("em")
                if not em:
                    continue
                label = em.get_text(strip=True).rstrip("：:")
                if not label:
                    continue
                # 获取li中em标签后的所有内容
                value_parts = []
                # 遍历em之后的所有节点
                for node in em.next_siblings:
                    if isinstance(node, str):
                        t = node.strip()
                        if t and t not in (",", "，", "/", "、", "|"):
                            value_parts.append(t)
                    elif hasattr(node, "name"):
                        if node.name in ("a", "span"):
                            nt = node.get_text(strip=True)
                            if nt and nt not in (",", "，", "/", "、", "|"):
                                value_parts.append(nt)
                value = ", ".join(value_parts) if value_parts else ""
                # 清理尾部多余标点
                value = value.strip(" ,，/、|")
                # 如果没取到，取li中除em外的全部文本
                if not value:
                    all_text = li.get_text(strip=True)
                    label_text = em.get_text(strip=True)
                    value = all_text.replace(label_text, "").strip()
                if label and value:
                    info_data[label] = value

            # 字段映射
            field_map = {
                "导演": "vod_director",
                "主演": "vod_actor",
                "类型": "vod_class",
                "地区": "vod_area",
                "语言": "vod_lang",
                "上映": "vod_pubdate",
                "更新": "vod_update_time",
                "年份": "vod_year",
                "片名": "vod_name",
                "状态": "vod_serial",
                "频道": "vod_channel",
                "简介": "vod_blurb",
            }
            for cn_name, en_name in field_map.items():
                if cn_name in info_data:
                    val = info_data[cn_name]
                    # 简介特殊处理
                    if cn_name == "简介":
                        if not video.get("vod_blurb"):
                            video["vod_blurb"] = val
                    elif cn_name == "年份":
                        year_m = re.search(r"(\d{4})", val)
                        video["vod_year"] = year_m.group(1) if year_m else val
                    elif cn_name == "上映":
                        # 提取日期部分
                        date_m = re.search(r"(\d{4}-\d{2}-\d{2})", val)
                        video["vod_pubdate"] = date_m.group(1) if date_m else val
                        if not video.get("vod_year"):
                            year_m = re.search(r"(\d{4})", val)
                            if year_m:
                                video["vod_year"] = year_m.group(1)
                    elif cn_name == "片名":
                        if not video.get("vod_name"):
                            video["vod_name"] = val
                    else:
                        video[en_name] = val

        # 如果上面没解析到，再用detail-info兜底
        if not info_data or not video.get("vod_area"):
            detail_el = soup.select_one(".detail-info")
            if detail_el and detail_el != info_el:
                detail_text = detail_el.get_text(" ", strip=True)
                # 用正则兜底提取
                def safe_extract(pattern, text):
                    m = re.search(pattern, text)
                    return m.group(1).strip() if m else ""
                if not video.get("vod_director"):
                    video["vod_director"] = safe_extract(r"导演\s*[：:]\s*([^演演员类地区年语言更新]+)", detail_text)
                if not video.get("vod_area"):
                    video["vod_area"] = safe_extract(r"(?:地区|产地)\s*[：:]\s*([^导演主类型年语言上映更新]+)", detail_text)
                if not video.get("vod_lang"):
                    video["vod_lang"] = safe_extract(r"语言\s*[：:]\s*([^导演主演类型地区年上映更新]+)", detail_text)
                if not video.get("vod_year"):
                    ym = re.search(r"\b(19|20)\d{2}\b", detail_text)
                    if ym:
                        video["vod_year"] = ym.group(0)

        # 评分
        score_el = soup.select_one(".detail-score, .play-score, .score-data, .douban-badge-score")
        if score_el:
            score_text = score_el.get_text(strip=True)
            sm = re.search(r"([\d.]+)", score_text)
            if sm:
                try:
                    video["vod_score"] = float(sm.group(1))
                except ValueError:
                    pass

        # 分类名称 - 从面包屑或info-parameter中提取
        if info_data.get("类型"):
            pass  # 类型已提取为 vod_class
        # 从面包屑/导航获取分类（电影/电视剧/动漫/综艺）
        type_el = soup.select_one(".nav-item.active a, .nav a.active, .header-nav a.active, .breadcrumb a")
        if not type_el:
            # 查找包含当前URL的导航链接
            cat_names = {"movie": "电影", "series": "电视剧", "anime": "动漫", "variety": "综艺"}
            for cat_key, cat_name in cat_names.items():
                if soup.select_one(f'a[href="/{cat_key}.html"]'):
                    if cat_name in str(info_el):
                        video["type_name"] = cat_name
                        break
            # 从URL和标题判断
            if not video.get("type_name"):
                page_title = video.get("_page_title", "")
                for cat_key, cat_name in cat_names.items():
                    if cat_name in page_title:
                        video["type_name"] = cat_name
                        break

        # 从JSON-LD提取结构化数据
        ldjson = re.findall(r'<script type="application/ld\+json">(.*?)</script>', html, re.DOTALL)
        for lds in ldjson:
            try:
                ld = json.loads(lds)
                if "@graph" in ld:
                    for item in ld["@graph"]:
                        if item.get("@type") in ("Movie", "TVSeries"):
                            video.setdefault("vod_name", item.get("name", ""))
                            video.setdefault("vod_pic", item.get("image", ""))
                            video.setdefault("vod_blurb", item.get("description", ""))
                            if "director" in item:
                                if isinstance(item["director"], dict):
                                    video.setdefault("vod_director", item["director"].get("name", "").strip(" ,，"))
                                elif isinstance(item["director"], list):
                                    names = [d.get("name", "").strip(" ,，") for d in item["director"] if isinstance(d, dict)]
                                    video.setdefault("vod_director", ",".join(n for n in names if n))
                            if "actor" in item and isinstance(item["actor"], list):
                                names = [a.get("name", "").strip(" ,，") for a in item["actor"] if isinstance(a, dict)]
                                video.setdefault("vod_actor", ",".join(n for n in names if n))
                            if "genre" in item:
                                video["vod_class"] = item["genre"]
                            if "datePublished" in item:
                                video["vod_pubdate"] = item["datePublished"]
                            if "aggregateRating" in item:
                                try:
                                    video["vod_score"] = float(item["aggregateRating"].get("ratingValue", 0))
                                except (ValueError, TypeError):
                                    pass
                elif ld.get("@type") in ("Movie", "TVSeries"):
                    video.setdefault("vod_name", ld.get("name", ""))
                    video.setdefault("vod_blurb", ld.get("description", ""))
            except (json.JSONDecodeError, KeyError):
                pass

        # 获取所有播放链接
        play_links = re.findall(r'href="(/play/(\d+)-(\d+)-(\d+)\.html)"[^>]*>(.*?)</a>', html)
        if not play_links:
            play_links = re.findall(r'href="(/play/(\d+)-(\d+)-(\d+)\.html)"', html)
            play_links = [(l, vid, sid, nid, f"第{nid}集") for l, vid, sid, nid in play_links]

        video["_play_links"] = []
        for plink, pvid, sid, nid, ep_name in play_links:
            episode_name = re.sub(r"<[^>]+>", "", str(ep_name)).strip()
            if not episode_name:
                episode_name = f"第{nid}集"
            video["_play_links"].append({
                "play_url": plink,
                "sid": int(sid),
                "nid": int(nid),
                "episode_name": episode_name,
            })

        # 分类名称 - 从面包屑导航获取
        crumbs = soup.select(".breadcrumb a, .nav a.active, .head-nav a.active, .position a")
        if crumbs:
            for crumb in crumbs:
                ct = crumb.get_text(strip=True)
                if ct in ("电影", "电视剧", "动漫", "综艺", "动漫片", "综艺片"):
                    video["type_name"] = ct.replace("片", "")
                    break
        if not video.get("type_name"):
            cat_map = {"movie": "电影", "series": "电视剧", "anime": "动漫", "variety": "综艺"}
            page_title = video.get("_page_title", "")
            for kw, name in cat_map.items():
                if name in page_title:
                    video["type_name"] = name
                    break
            # 从info_data的类型后面提取
            if not video.get("type_name") and info_data.get("类型"):
                for name in ("电影", "电视剧", "动漫", "综艺"):
                    if name in info_data.get("类型", "") or name in str(info_el):
                        video["type_name"] = name
                        break

        # 获取更新状态/总集数/备注
        remarks_el = soup.select_one(".vod-note, .remarks, .serial, .status")
        if remarks_el:
            video["vod_remarks"] = remarks_el.get_text(strip=True)

        # 获取年代
        if not video.get("vod_year"):
            year_infos = re.findall(r"/(\d{4})/", html)
            if year_infos:
                video["vod_year"] = year_infos[0]

        # 清理空值
        for k in list(video.keys()):
            if isinstance(video[k], str):
                video[k] = video[k].strip()
            if video[k] is None or video[k] == "":
                pass  # 保留

        return video

    def parse_play_page(self, play_path, vod_id, sid, nid, episode_name):
        """解析播放页获取播放源URL"""
        url = BASE_URL + play_path
        r = self._request(url)
        if not r:
            return None

        pa = extract_player_aaaa(r.text)
        if not pa:
            logger.debug(f"播放页未找到player_aaaa: {url}")
            return None

        encrypt = pa.get("encrypt", 0)
        from_src = pa.get("from", "")
        raw_url = pa.get("url", "")
        decrypted_url = decrypt_player_url(encrypt, raw_url)
        parse_url = get_parse_url(from_src, decrypted_url)

        return {
            "vod_id": vod_id,
            "source_name": FROM_NAMES.get(from_src, from_src),
            "source_from": from_src,
            "episode_name": episode_name,
            "episode_index": nid,
            "sid": sid,
            "nid": nid,
            "raw_url": raw_url,
            "decrypted_url": decrypted_url,
            "parse_url": parse_url,
            "encrypt": int(encrypt) if encrypt else 0,
            "play_url": url,
        }

    def crawl_video(self, vod_id):
        """抓取单个视频（详情页+所有播放页）"""
        if self.db.is_crawled(vod_id):
            return False

        video = self.parse_detail_page(vod_id)
        if not video or video.get("status") == -1:
            # 标记为已爬取但不存在
            if video:
                video["vod_name"] = video.get("vod_name", f"未知视频{vod_id}")
                self.db.save_video(video)
            return False

        self.db.save_video(video)

        # 抓取所有播放源
        play_sources = []
        for pl in video.get("_play_links", []):
            src = self.parse_play_page(
                pl["play_url"], vod_id, pl["sid"], pl["nid"], pl["episode_name"]
            )
            if src:
                play_sources.append(src)
            time.sleep(self.delay * 0.5)

        if play_sources:
            self.db.delete_play_sources(vod_id)
            self.db.save_play_sources(vod_id, play_sources)

        logger.info(
            f"已抓取: [{video.get('type_name','?')}] {video.get('vod_name', vod_id)} "
            f"(ID:{vod_id}, {len(play_sources)}个播放源)"
        )
        time.sleep(self.delay)
        return True

    def crawl_range(self, start_id, end_id, skip_crawled=True):
        """按ID范围爬取"""
        total = end_id - start_id + 1
        crawled = 0
        failed = 0
        skipped = 0

        logger.info(f"开始按ID范围爬取: {start_id} - {end_id}, 共{total}个")

        ids_to_crawl = []
        for vid in range(start_id, end_id + 1):
            if skip_crawled and self.db.is_crawled(vid):
                skipped += 1
                continue
            ids_to_crawl.append(vid)

        logger.info(f"跳过{skipped}个已爬取, 实际需爬取{len(ids_to_crawl)}个")

        with ThreadPoolExecutor(max_workers=self.max_workers) as executor:
            futures = {executor.submit(self.crawl_video, vid): vid for vid in ids_to_crawl}
            for i, future in enumerate(as_completed(futures)):
                vid = futures[future]
                try:
                    result = future.result()
                    if result:
                        crawled += 1
                except Exception as e:
                    failed += 1
                    logger.error(f"爬取{vid}异常: {e}")

                if (i + 1) % 100 == 0 or (i + 1) == len(ids_to_crawl):
                    logger.info(
                        f"进度: {i+1}/{len(ids_to_crawl)} "
                        f"(成功:{crawled}, 失败:{failed})"
                    )

        logger.info(f"范围爬取完成! 成功:{crawled}, 失败:{failed}, 跳过:{skipped}")

    def crawl_from_categories(self):
        """从分类页爬取所有可见视频"""
        ids = self.get_all_category_ids()
        sitemap_ids = self.get_sitemap_ids()
        all_ids = sorted(set(ids + sitemap_ids))
        logger.info(f"分类+Sitemap共{len(all_ids)}个待爬视频")

        for i, vid in enumerate(all_ids):
            try:
                self.crawl_video(vid)
            except Exception as e:
                logger.error(f"爬取{vid}异常: {e}")
            if (i + 1) % 50 == 0:
                stats = self.db.get_statistics()
                logger.info(f"进度: {i+1}/{len(all_ids)}, 已入库:{stats['videos']}")

    def full_crawl(self, max_id=None):
        """
        全站爬取：通过ID遍历
        先通过分类页和sitemap获取已有ID，再扩展到最大ID范围
        """
        logger.info("=" * 60)
        logger.info("开始全站爬取 ikanju.cc (云播TV)")
        logger.info("=" * 60)

        # 先获取分类页和sitemap的ID
        cat_ids = self.get_all_category_ids()
        sm_ids = self.get_sitemap_ids()
        known_ids = sorted(set(cat_ids + sm_ids))
        logger.info(f"初始已知ID数: {len(known_ids)}")

        # 通过ID探测确定最大ID
        if not max_id:
            # 尝试AJAX接口获取总数
            total = self.get_ajax_max_id()
            # 探测最大ID
            max_detected = max(known_ids) if known_ids else 45000
            # 已知ID范围4 - 44898，扩展一点
            max_id = max(max_detected, 50000)
            # 尝试探测几个大ID
            test_ids = [max_id + i * 1000 for i in range(1, 6)]
            for tid in test_ids:
                r = self._request(f"{BASE_URL}/vod-{tid}.html")
                if r and len(r.text) > 5000 and "404" not in r.text[:500]:
                    max_id = tid
                time.sleep(0.5)
            logger.info(f"探测最大ID: {max_id}")

        min_id = min(known_ids) if known_ids else 1
        logger.info(f"爬取范围: {min_id} - {max_id}")

        self.crawl_range(min_id, max_id)

        # 导出数据
        self.db.export_json()
        self.db.export_csv()

        stats = self.db.get_statistics()
        logger.info("=" * 60)
        logger.info("全站爬取完成!")
        logger.info(f"  视频总数: {stats['videos']}")
        logger.info(f"  播放源总数: {stats['play_sources']}")
        for tname, cnt in stats["by_type"]:
            logger.info(f"  {tname}: {cnt}部")
        logger.info("=" * 60)


# ===================== 主入口 =====================
def main():
    parser = argparse.ArgumentParser(
        description="ikanju.cc (云播TV) 全站爬虫 - 支持MacCMS加密播放URL逆向解密",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
示例:
  python3 ikanju_spider.py --mode full                    # 全站爬取
  python3 ikanju_spider.py --mode category                # 仅爬取分类页可见视频
  python3 ikanju_spider.py --mode range --start 1 --end 1000  # 按ID范围爬取
  python3 ikanju_spider.py --mode detail --id 44117       # 爬取单个视频
  python3 ikanju_spider.py --export                       # 仅导出已有数据
        """
    )
    parser.add_argument("--mode", choices=["full", "category", "range", "detail", "export"],
                        default="full", help="爬取模式 (默认: full)")
    parser.add_argument("--start", type=int, default=1, help="范围爬取起始ID")
    parser.add_argument("--end", type=int, default=0, help="范围爬取结束ID")
    parser.add_argument("--id", type=int, default=0, help="单个视频ID")
    parser.add_argument("--delay", type=float, default=1.0, help="请求间隔秒数 (默认: 1.0)")
    parser.add_argument("--workers", type=int, default=2, help="并发线程数 (默认: 2, 建议不超过3)")
    parser.add_argument("--db", default="ikanju_data.db", help="数据库路径")
    parser.add_argument("--export", action="store_true", help="爬取后导出JSON和CSV")

    args = parser.parse_args()

    spider = IkanjuSpider(delay=args.delay, max_workers=args.workers, db_path=args.db)

    if args.mode == "full":
        spider.full_crawl(max_id=args.end if args.end > 0 else None)
        if args.export:
            spider.db.export_json()
            spider.db.export_csv()

    elif args.mode == "category":
        spider.crawl_from_categories()
        if args.export:
            spider.db.export_json()
            spider.db.export_csv()

    elif args.mode == "range":
        end = args.end if args.end > 0 else args.start + 999
        spider.crawl_range(args.start, end)
        if args.export:
            spider.db.export_json()
            spider.db.export_csv()

    elif args.mode == "detail":
        if args.id <= 0:
            logger.error("请指定 --id 参数")
            sys.exit(1)
        spider.crawl_video(args.id)
        stats = spider.db.get_statistics()
        logger.info(f"当前数据库: 视频{stats['videos']}部, 播放源{stats['play_sources']}条")

    elif args.mode == "export":
        spider.db.export_json()
        spider.db.export_csv()
        stats = spider.db.get_statistics()
        logger.info(f"数据库统计: 视频{stats['videos']}部, 播放源{stats['play_sources']}条")
        for tname, cnt in stats["by_type"]:
            logger.info(f"  {tname}: {cnt}部")


if __name__ == "__main__":
    main()
