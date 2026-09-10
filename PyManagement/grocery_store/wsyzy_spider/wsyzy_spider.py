#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
无水印资源站 (www.wsyzy.cc) 全站抓取工具
==========================================
功能说明：
  1. 通过苹果CMS官方API接口抓取全站视频数据（推荐，最快最稳定）
  2. 通过HTML页面爬取的备用方案
  3. 支持按分类、页码、关键词筛选
  4. 支持增量更新（按最新更新时间抓取）
  5. 数据可导出为 JSON / CSV / Excel / SQLite 多种格式
  6. 内置 m3u8 视频播放链接解析
  7. 多线程并发抓取，自动重试，断点续爬

使用方式：
  # 安装依赖
  pip install requests openpyxl pandas

  # 快速使用 - 抓取全站所有数据（保存为JSON）
  python wsyzy_spider.py

  # 指定输出格式
  python wsyzy_spider.py --format csv,json,excel,sqlite

  # 仅抓取指定分类（如电影、电视剧）
  python wsyzy_spider.py --type 电影,电视剧,国产剧

  # 按时间增量抓取（仅抓最近N小时更新的内容）
  python wsyzy_spider.py --recent 24

  # 指定起始页和抓取页数
  python wsyzy_spider.py --start 1 --pages 10

  # 关键词搜索抓取
  python wsyzy_spider.py --keyword 庆余年

  # 启用多线程加速
  python wsyzy_spider.py --threads 8

  # 使用HTML页面爬取方式（备用方案，API不可用时使用）
  python wsyzy_spider.py --mode html

  # 爬取图片（封面图）
  python wsyzy_spider.py --download-images

API接口说明：
  列表接口: https://api.wsyzy.net/api.php/provide/vod/?ac=list&pg={page}
  详情接口: https://api.wsyzy.net/api.php/provide/vod/?ac=detail&ids={ids}
  分类接口: https://api.wsyzy.net/api.php/provide/vod/?ac=list&t={type_id}
  搜索接口: https://api.wsyzy.net/api.php/provide/vod/?ac=list&wd={keyword}
"""

import os
import re
import sys
import json
import time
import sqlite3
import logging
import argparse
import hashlib
from datetime import datetime, timedelta
from urllib.parse import urljoin, quote, urlparse, unquote
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path

import requests
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry

# ============================================================
# 全局配置
# ============================================================
BASE_URL = "https://www.wsyzy.cc"
API_BASE = "https://api.wsyzy.net/api.php/provide/vod/"
SITE_NAME = "无水印资源站"

# 输出目录
OUTPUT_DIR = Path(__file__).parent / "output"
IMAGE_DIR = OUTPUT_DIR / "images"
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
IMAGE_DIR.mkdir(parents=True, exist_ok=True)

# 请求配置
REQUEST_TIMEOUT = 30
RETRY_TIMES = 3
RETRY_DELAY = 2
PAGE_DELAY = 0.5  # 每页之间的延迟（秒），避免给服务器造成压力
DEFAULT_THREADS = 4
PER_PAGE = 20  # API每页返回条数

# 请求头
HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
                  "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Accept": "application/json, text/html, */*",
    "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
    "Referer": BASE_URL + "/",
}

# 日志配置
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
    handlers=[
        logging.StreamHandler(sys.stdout),
        logging.FileHandler(OUTPUT_DIR / "spider.log", encoding="utf-8"),
    ]
)
logger = logging.getLogger(__name__)


# ============================================================
# 工具函数
# ============================================================
def create_session() -> requests.Session:
    """创建带重试机制的 requests Session"""
    session = requests.Session()
    retry_strategy = Retry(
        total=RETRY_TIMES,
        backoff_factor=1,
        status_forcelist=[429, 500, 502, 503, 504],
        allowed_methods=["GET"],
    )
    adapter = HTTPAdapter(max_retries=retry_strategy, pool_connections=20, pool_maxsize=20)
    session.mount("https://", adapter)
    session.mount("http://", adapter)
    session.headers.update(HEADERS)
    return session


def safe_filename(name: str) -> str:
    """将字符串转为安全的文件名"""
    name = re.sub(r'[\\/:*?"<>|\r\n\t]', "_", name)
    return name.strip()[:100]


def parse_play_urls(play_url_str: str, play_from: str = "") -> list:
    """
    解析播放链接字符串
    格式: 集名1$url1#集名2$url2#...
    """
    episodes = []
    if not play_url_str:
        return episodes
    parts = play_url_str.split("#")
    for part in parts:
        if not part.strip():
            continue
        if "$" in part:
            ep_name, ep_url = part.split("$", 1)
            episodes.append({
                "episode": ep_name.strip(),
                "url": ep_url.strip(),
                "source": play_from,
            })
        else:
            episodes.append({
                "episode": f"第{len(episodes)+1}集",
                "url": part.strip(),
                "source": play_from,
            })
    return episodes


def format_vod_item(item: dict) -> dict:
    """标准化视频数据字段"""
    play_sources = []
    play_from = item.get("vod_play_from", "")
    play_url = item.get("vod_play_url", "")

    if play_from and play_url:
        # 可能有多个播放源，用$$$分隔
        sources = play_from.split("$$$")
        url_groups = play_url.split("$$$")
        for idx, src in enumerate(sources):
            urls = url_groups[idx] if idx < len(url_groups) else ""
            episodes = parse_play_urls(urls, src.strip())
            if episodes:
                play_sources.append({
                    "source": src.strip(),
                    "episodes": episodes,
                })

    return {
        "vod_id": item.get("vod_id"),
        "type_id": item.get("type_id"),
        "type_name": item.get("type_name", ""),
        "vod_name": item.get("vod_name", "").strip(),
        "vod_sub": item.get("vod_sub", ""),
        "vod_en": item.get("vod_en", ""),
        "vod_pic": item.get("vod_pic", ""),
        "vod_actor": item.get("vod_actor", ""),
        "vod_director": item.get("vod_director", ""),
        "vod_blurb": item.get("vod_blurb", "").strip(),
        "vod_remarks": item.get("vod_remarks", ""),
        "vod_area": item.get("vod_area", ""),
        "vod_lang": item.get("vod_lang", ""),
        "vod_year": item.get("vod_year", ""),
        "vod_content": re.sub(r"<[^>]+>", "", item.get("vod_content", "")).strip(),
        "vod_score": item.get("vod_score", "0.0"),
        "vod_time": item.get("vod_time", ""),
        "vod_time_add": item.get("vod_time_add", 0),
        "vod_isend": item.get("vod_isend", 0),  # 0=连载中, 1=完结
        "play_sources": play_sources,
        "total_episodes": sum(len(s["episodes"]) for s in play_sources),
    }


# ============================================================
# API 抓取模式（推荐）
# ============================================================
class WsyzyAPISpider:
    """通过苹果CMS官方API抓取数据"""

    def __init__(self, session: requests.Session = None):
        self.session = session or create_session()
        self.categories = {}  # {type_id: type_name}
        self.total_count = 0
        self.total_pages = 0

    def fetch_page(self, pg: int = 1, t: int = None, wd: str = None,
                   ids: str = None, h: str = None) -> dict:
        """请求API单页数据"""
        params = {"ac": "list", "pg": pg}
        if t:
            params["t"] = t
        if wd:
            params["wd"] = wd
        if ids:
            params["ac"] = "detail"
            params["ids"] = ids
        if h:
            params["h"] = h

        try:
            resp = self.session.get(API_BASE, params=params, timeout=REQUEST_TIMEOUT)
            resp.raise_for_status()
            data = resp.json()
            if data.get("code") == 1:
                # 获取分类列表（仅在首页时）
                if pg == 1 and "class" in data:
                    for c in data["class"]:
                        self.categories[c["type_id"]] = c["type_name"]
                return data
            else:
                logger.warning(f"API返回错误: {data.get('msg', 'unknown')}")
                return None
        except Exception as e:
            logger.error(f"请求第{pg}页失败: {e}")
            return None

    def get_categories(self) -> dict:
        """获取全部分类"""
        if not self.categories:
            self.fetch_page(1)
        return self.categories

    def get_total_info(self, t: int = None, wd: str = None) -> tuple:
        """获取总数据量和总页数"""
        data = self.fetch_page(1, t=t, wd=wd)
        if data:
            self.total_count = data.get("total", 0)
            self.total_pages = data.get("pagecount", 0)
        return self.total_count, self.total_pages

    def fetch_all(self, type_id: int = None, keyword: str = None,
                  start_page: int = 1, max_pages: int = None,
                  recent_hours: int = None, download_images: bool = False,
                  threads: int = DEFAULT_THREADS, callback=None) -> list:
        """
        抓取所有视频数据
        :param type_id: 分类ID，为None则抓全部分类
        :param keyword: 搜索关键词
        :param start_page: 起始页码
        :param max_pages: 最大抓取页数
        :param recent_hours: 仅抓取最近N小时更新的内容
        :param download_images: 是否下载封面图
        :param threads: 并发线程数
        :param callback: 每页抓取完成的回调函数 callback(page_data, page_num, total_pages)
        :return: 视频列表
        """
        total_count, total_pages = self.get_total_info(t=type_id, wd=keyword)
        if max_pages:
            total_pages = min(total_pages, max_pages)

        logger.info(f"总数据量: {total_count} 条，共 {total_pages} 页")

        if recent_hours:
            logger.info(f"增量模式: 仅抓取最近 {recent_hours} 小时更新的内容")

        all_vods = []
        page_numbers = list(range(start_page, total_pages + 1))

        # 时间过滤阈值
        time_threshold = None
        if recent_hours:
            time_threshold = datetime.now() - timedelta(hours=recent_hours)

        # 使用线程池并发抓取
        if threads > 1:
            with ThreadPoolExecutor(max_workers=threads) as executor:
                future_to_page = {
                    executor.submit(self.fetch_page, pg, type_id, keyword): pg
                    for pg in page_numbers
                }
                for future in as_completed(future_to_page):
                    pg = future_to_page[future]
                    try:
                        data = future.result()
                        if data and data.get("list"):
                            page_vods = self._process_page_data(
                                data["list"], time_threshold, download_images
                            )
                            all_vods.extend(page_vods)
                            logger.info(f"[API] 第 {pg}/{total_pages} 页，"
                                        f"本页获取 {len(page_vods)} 条，"
                                        f"累计 {len(all_vods)} 条")
                            if callback:
                                callback(page_vods, pg, total_pages)
                    except Exception as e:
                        logger.error(f"处理第{pg}页异常: {e}")
                    time.sleep(PAGE_DELAY / threads)
        else:
            # 单线程顺序抓取
            for pg in page_numbers:
                data = self.fetch_page(pg, type_id, keyword)
                if data and data.get("list"):
                    page_vods = self._process_page_data(
                        data["list"], time_threshold, download_images
                    )
                    all_vods.extend(page_vods)
                    logger.info(f"[API] 第 {pg}/{total_pages} 页，"
                                f"本页获取 {len(page_vods)} 条，"
                                f"累计 {len(all_vods)} 条")
                    if callback:
                        callback(page_vods, pg, total_pages)
                time.sleep(PAGE_DELAY)

        logger.info(f"抓取完成! 共获取 {len(all_vods)} 条视频数据")
        return all_vods

    def _process_page_data(self, items: list, time_threshold: datetime = None,
                           download_images: bool = False) -> list:
        """处理单页数据"""
        results = []
        for item in items:
            vod = format_vod_item(item)

            # 时间过滤
            if time_threshold and vod["vod_time"]:
                try:
                    vod_time = datetime.strptime(vod["vod_time"], "%Y-%m-%d %H:%M:%S")
                    if vod_time < time_threshold:
                        continue
                except ValueError:
                    pass

            # 下载封面图
            if download_images and vod["vod_pic"]:
                self._download_image(vod["vod_pic"], vod["vod_name"])

            results.append(vod)
        return results

    def _download_image(self, url: str, vod_name: str):
        """下载封面图片"""
        try:
            ext = os.path.splitext(urlparse(url).path)[1] or ".jpg"
            filename = safe_filename(vod_name) + ext
            filepath = IMAGE_DIR / filename
            if filepath.exists():
                return
            resp = self.session.get(url, timeout=REQUEST_TIMEOUT, stream=True)
            resp.raise_for_status()
            with open(filepath, "wb") as f:
                for chunk in resp.iter_content(chunk_size=8192):
                    f.write(chunk)
            logger.debug(f"图片下载完成: {filename}")
        except Exception as e:
            logger.debug(f"图片下载失败 {url}: {e}")

    def fetch_detail(self, vod_ids: list) -> list:
        """批量获取视频详情"""
        ids_str = ",".join(str(i) for i in vod_ids)
        data = self.fetch_page(ids=ids_str)
        if data and data.get("list"):
            return [format_vod_item(item) for item in data["list"]]
        return []


# ============================================================
# HTML 页面爬取模式（备用方案）
# ============================================================
class WsyzyHTMLSpider:
    """通过HTML页面爬取数据（备用方案）"""

    def __init__(self, session: requests.Session = None):
        self.session = session or create_session()
        try:
            from bs4 import BeautifulSoup
            self.BeautifulSoup = BeautifulSoup
        except ImportError:
            logger.error("使用HTML模式需要安装bs4: pip install beautifulsoup4")
            sys.exit(1)

    def fetch_list_page(self, page: int = 1, type_id: int = None) -> list:
        """爬取列表页"""
        if type_id:
            url = f"{BASE_URL}/index.php/vod/type/id/{type_id}/page/{page}.html"
        else:
            url = f"{BASE_URL}/index.php/vod/show/page/{page}.html"
        try:
            resp = self.session.get(url, timeout=REQUEST_TIMEOUT)
            resp.raise_for_status()
            resp.encoding = "utf-8"
            soup = self.BeautifulSoup(resp.text, "html.parser")
            items = []
            # 解析列表项（需要根据实际页面结构调整选择器）
            for li in soup.select(".fed-list-info li, .fed-part-layout li, .stui-vodlist li"):
                a_tag = li.select_one("a.fed-list-title, a.stui-vodlist__thumb, h4 a, a")
                if not a_tag:
                    continue
                href = a_tag.get("href", "")
                title = a_tag.get("title") or a_tag.get_text(strip=True)
                img = li.select_one("img")
                pic = img.get("data-original") or img.get("src") if img else ""
                remarks = ""
                span_tag = li.select_one(".fed-list-remarks, .pic-text, span.pic-text")
                if span_tag:
                    remarks = span_tag.get_text(strip=True)
                items.append({
                    "title": title,
                    "url": urljoin(BASE_URL, href) if href else "",
                    "pic": pic,
                    "remarks": remarks,
                })
            return items
        except Exception as e:
            logger.error(f"爬取列表页第{page}页失败: {e}")
            return []

    def fetch_detail_page(self, url: str) -> dict:
        """爬取详情页"""
        try:
            resp = self.session.get(url, timeout=REQUEST_TIMEOUT)
            resp.raise_for_status()
            resp.encoding = "utf-8"
            soup = self.BeautifulSoup(resp.text, "html.parser")

            title = ""
            h1 = soup.select_one("h1, .fed-part-hd h1, .stui-content__detail h1")
            if h1:
                title = h1.get_text(strip=True)

            info = {}
            for p in soup.select(".fed-part-desc p, .stui-content__detail p"):
                text = p.get_text(strip=True)
                if "：" in text:
                    k, v = text.split("：", 1)
                    info[k.strip()] = v.strip()

            # 播放链接
            episodes = []
            for a in soup.select(".fed-play-item li a, .stui-content__playlist li a"):
                ep_name = a.get_text(strip=True)
                ep_href = a.get("href", "")
                if ep_href:
                    episodes.append({
                        "episode": ep_name,
                        "url": urljoin(BASE_URL, ep_href),
                    })

            # 简介
            content = ""
            desc = soup.select_one(".fed-part-desc, .stui-content__desc")
            if desc:
                content = desc.get_text(strip=True)

            return {
                "title": title,
                "url": url,
                "info": info,
                "content": content,
                "episodes": episodes,
            }
        except Exception as e:
            logger.error(f"爬取详情页失败 {url}: {e}")
            return {}


# ============================================================
# 数据导出
# ============================================================
class DataExporter:
    """数据导出器，支持多种格式"""

    def __init__(self, data: list, output_dir: Path):
        self.data = data
        self.output_dir = output_dir
        self.timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")

    def to_json(self, filename: str = None) -> str:
        """导出为JSON格式"""
        filepath = self.output_dir / (filename or f"wsyzy_{self.timestamp}.json")
        with open(filepath, "w", encoding="utf-8") as f:
            json.dump({
                "site": SITE_NAME,
                "site_url": BASE_URL,
                "crawl_time": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
                "total": len(self.data),
                "categories": list({v["type_name"] for v in self.data if v.get("type_name")}),
                "data": self.data,
            }, f, ensure_ascii=False, indent=2)
        logger.info(f"JSON导出成功: {filepath}")
        return str(filepath)

    def to_csv(self, filename: str = None) -> str:
        """导出为CSV格式"""
        import csv
        filepath = self.output_dir / (filename or f"wsyzy_{self.timestamp}.csv")
        if not self.data:
            return ""
        # 扁平化播放链接
        fieldnames = [
            "vod_id", "type_name", "vod_name", "vod_sub", "vod_actor",
            "vod_director", "vod_year", "vod_area", "vod_lang",
            "vod_remarks", "vod_score", "vod_blurb", "vod_pic",
            "vod_time", "total_episodes", "play_urls", "vod_content",
        ]
        with open(filepath, "w", encoding="utf-8-sig", newline="") as f:
            writer = csv.DictWriter(f, fieldnames=fieldnames)
            writer.writeheader()
            for item in self.data:
                row = {k: item.get(k, "") for k in fieldnames if k != "play_urls"}
                # 将播放链接展开为文本
                play_links = []
                for src in item.get("play_sources", []):
                    for ep in src["episodes"]:
                        play_links.append(f"[{src['source']}] {ep['episode']}: {ep['url']}")
                row["play_urls"] = "\n".join(play_links)
                writer.writerow(row)
        logger.info(f"CSV导出成功: {filepath}")
        return str(filepath)

    def to_excel(self, filename: str = None) -> str:
        """导出为Excel格式"""
        try:
            import pandas as pd
        except ImportError:
            logger.warning("导出Excel需要安装pandas和openpyxl: pip install pandas openpyxl")
            return ""

        filepath = self.output_dir / (filename or f"wsyzy_{self.timestamp}.xlsx")
        # 主表 - 视频列表
        rows = []
        episode_rows = []
        for item in self.data:
            rows.append({
                "ID": item.get("vod_id"),
                "分类": item.get("type_name"),
                "片名": item.get("vod_name"),
                "副标题": item.get("vod_sub"),
                "主演": item.get("vod_actor"),
                "导演": item.get("vod_director"),
                "年份": item.get("vod_year"),
                "地区": item.get("vod_area"),
                "语言": item.get("vod_lang"),
                "备注": item.get("vod_remarks"),
                "评分": item.get("vod_score"),
                "集数": item.get("total_episodes"),
                "简介": item.get("vod_blurb"),
                "封面": item.get("vod_pic"),
                "更新时间": item.get("vod_time"),
            })
            # 播放地址子表
            for src in item.get("play_sources", []):
                for idx, ep in enumerate(src["episodes"], 1):
                    episode_rows.append({
                        "片名": item.get("vod_name"),
                        "播放源": src["source"],
                        "集数": ep["episode"],
                        "播放地址": ep["url"],
                    })

        with pd.ExcelWriter(filepath, engine="openpyxl") as writer:
            pd.DataFrame(rows).to_excel(writer, sheet_name="视频列表", index=False)
            pd.DataFrame(episode_rows).to_excel(writer, sheet_name="播放地址", index=False)
            # 调整列宽
            for sheet_name in writer.sheets:
                ws = writer.sheets[sheet_name]
                for col in ws.columns:
                    max_length = 0
                    col_letter = col[0].column_letter
                    for cell in col:
                        try:
                            if cell.value:
                                max_length = max(max_length, len(str(cell.value)))
                        except Exception:
                            pass
                    ws.column_dimensions[col_letter].width = min(max_length + 2, 50)

        logger.info(f"Excel导出成功: {filepath}")
        return str(filepath)

    def to_sqlite(self, filename: str = None) -> str:
        """导出为SQLite数据库"""
        filepath = self.output_dir / (filename or f"wsyzy_{self.timestamp}.db")
        conn = sqlite3.connect(str(filepath))
        cursor = conn.cursor()

        # 创建表
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS videos (
                vod_id INTEGER PRIMARY KEY,
                type_id INTEGER,
                type_name TEXT,
                vod_name TEXT,
                vod_sub TEXT,
                vod_en TEXT,
                vod_pic TEXT,
                vod_actor TEXT,
                vod_director TEXT,
                vod_blurb TEXT,
                vod_remarks TEXT,
                vod_area TEXT,
                vod_lang TEXT,
                vod_year TEXT,
                vod_content TEXT,
                vod_score REAL,
                vod_time TEXT,
                total_episodes INTEGER
            )
        """)
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS episodes (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                vod_id INTEGER,
                vod_name TEXT,
                source TEXT,
                episode TEXT,
                url TEXT,
                FOREIGN KEY(vod_id) REFERENCES videos(vod_id)
            )
        """)

        for item in self.data:
            cursor.execute("""
                INSERT OR REPLACE INTO videos 
                (vod_id, type_id, type_name, vod_name, vod_sub, vod_en, vod_pic,
                 vod_actor, vod_director, vod_blurb, vod_remarks, vod_area,
                 vod_lang, vod_year, vod_content, vod_score, vod_time, total_episodes)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                item.get("vod_id"), item.get("type_id"), item.get("type_name"),
                item.get("vod_name"), item.get("vod_sub"), item.get("vod_en"),
                item.get("vod_pic"), item.get("vod_actor"), item.get("vod_director"),
                item.get("vod_blurb"), item.get("vod_remarks"), item.get("vod_area"),
                item.get("vod_lang"), item.get("vod_year"), item.get("vod_content"),
                float(item.get("vod_score", 0) or 0),
                item.get("vod_time"), item.get("total_episodes"),
            ))
            for src in item.get("play_sources", []):
                for ep in src["episodes"]:
                    cursor.execute("""
                        INSERT INTO episodes (vod_id, vod_name, source, episode, url)
                        VALUES (?, ?, ?, ?, ?)
                    """, (item.get("vod_id"), item.get("vod_name"),
                          src["source"], ep["episode"], ep["url"]))

        # 创建索引
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_vod_name ON videos(vod_name)")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_type ON videos(type_name)")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_time ON videos(vod_time)")

        conn.commit()
        conn.close()
        logger.info(f"SQLite导出成功: {filepath}")
        return str(filepath)

    def export(self, formats: list) -> dict:
        """按指定格式导出"""
        results = {}
        for fmt in formats:
            fmt = fmt.strip().lower()
            try:
                if fmt == "json":
                    results["json"] = self.to_json()
                elif fmt == "csv":
                    results["csv"] = self.to_csv()
                elif fmt in ("excel", "xlsx"):
                    results["excel"] = self.to_excel()
                elif fmt in ("sqlite", "db", "sql"):
                    results["sqlite"] = self.to_sqlite()
                else:
                    logger.warning(f"不支持的导出格式: {fmt}")
            except Exception as e:
                logger.error(f"导出{fmt}失败: {e}")
        return results


# ============================================================
# 断点续爬支持
# ============================================================
class CheckpointManager:
    """断点续爬管理器"""

    def __init__(self, checkpoint_file: Path):
        self.file = checkpoint_file
        self.completed_pages = set()
        self.load()

    def load(self):
        if self.file.exists():
            try:
                with open(self.file, "r", encoding="utf-8") as f:
                    data = json.load(f)
                    self.completed_pages = set(data.get("completed_pages", []))
                logger.info(f"加载断点，已完成 {len(self.completed_pages)} 页")
            except Exception:
                self.completed_pages = set()

    def save(self, page: int):
        self.completed_pages.add(page)
        with open(self.file, "w", encoding="utf-8") as f:
            json.dump({"completed_pages": list(self.completed_pages)}, f)

    def is_completed(self, page: int) -> bool:
        return page in self.completed_pages

    def clear(self):
        if self.file.exists():
            self.file.unlink()
        self.completed_pages = set()


# ============================================================
# m3u8 视频解析工具
# ============================================================
class M3U8Parser:
    """m3u8播放链接解析"""

    # 站点提供的m3u8解析接口
    PARSE_APIS = [
        "https://wsyzy.top/m3u8/?url=",
        "https://wsyzy.vip/m3u8/?url=",
    ]

    @staticmethod
    def get_parse_url(m3u8_url: str, api_index: int = 0) -> str:
        """获取解析后的播放页URL"""
        if api_index < len(M3U8Parser.PARSE_APIS):
            return M3U8Parser.PARSE_APIS[api_index] + quote(m3u8_url)
        return m3u8_url

    @staticmethod
    def download_m3u8_segment(session: requests.Session, url: str,
                               output_path: str, headers: dict = None):
        """下载m3u8文件内容（注意：这仅下载m3u8索引文件，不是完整视频）"""
        try:
            h = headers or {}
            resp = session.get(url, headers=h, timeout=30)
            resp.raise_for_status()
            with open(output_path, "w", encoding="utf-8") as f:
                f.write(resp.text)
            logger.info(f"m3u8索引下载完成: {output_path}")
            return resp.text
        except Exception as e:
            logger.error(f"m3u8下载失败 {url}: {e}")
            return None


# ============================================================
# 主程序
# ============================================================
def main():
    parser = argparse.ArgumentParser(
        description=f"{SITE_NAME}全站抓取工具",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
示例:
  python wsyzy_spider.py                         # 抓取全站
  python wsyzy_spider.py --format json,excel     # 导出为JSON和Excel
  python wsyzy_spider.py --type 电影,国产剧      # 仅抓电影和国产剧
  python wsyzy_spider.py --keyword 庆余年        # 搜索抓取
  python wsyzy_spider.py --recent 24             # 抓最近24小时更新
  python wsyzy_spider.py --threads 8             # 8线程并发
  python wsyzy_spider.py --mode html             # 使用HTML爬取模式
        """
    )
    parser.add_argument("--format", "-f", default="json",
                        help="导出格式，逗号分隔: json,csv,excel,sqlite (默认: json)")
    parser.add_argument("--type", "-t", default=None,
                        help="指定分类名，逗号分隔（如: 电影,电视剧,国产剧）")
    parser.add_argument("--keyword", "-k", default=None, help="搜索关键词")
    parser.add_argument("--start", "-s", type=int, default=1, help="起始页码 (默认: 1)")
    parser.add_argument("--pages", "-p", type=int, default=None, help="抓取页数")
    parser.add_argument("--recent", "-r", type=int, default=None,
                        help="仅抓取最近N小时更新的内容（增量模式）")
    parser.add_argument("--threads", "-n", type=int, default=DEFAULT_THREADS,
                        help=f"并发线程数 (默认: {DEFAULT_THREADS})")
    parser.add_argument("--mode", "-m", default="api", choices=["api", "html"],
                        help="抓取模式: api(推荐), html(备用) (默认: api)")
    parser.add_argument("--download-images", "-d", action="store_true",
                        help="下载封面图片")
    parser.add_argument("--resume", action="store_true", help="断点续爬")
    parser.add_argument("--list-types", action="store_true", help="列出所有分类后退出")

    args = parser.parse_args()

    # 打印横幅
    print(f"""
╔══════════════════════════════════════════════════╗
║       {SITE_NAME} - 全站数据抓取工具       ║
║       目标站点: {BASE_URL}            ║
╚══════════════════════════════════════════════════╝
    """)

    session = create_session()

    if args.mode == "api":
        spider = WsyzyAPISpider(session)
    else:
        spider = WsyzyHTMLSpider(session)

    # 仅列出分类
    if args.list_types and isinstance(spider, WsyzyAPISpider):
        categories = spider.get_categories()
        print("\n全部分类列表:")
        print("-" * 40)
        for tid, tname in sorted(categories.items()):
            print(f"  ID: {tid:3d}  ->  {tname}")
        print("-" * 40)
        print(f"共 {len(categories)} 个分类\n")
        return

    # 解析要抓取的分类
    type_ids = []
    type_id = None
    if args.type and isinstance(spider, WsyzyAPISpider):
        categories = spider.get_categories()
        type_names = [t.strip() for t in args.type.split(",")]
        name_to_id = {v: k for k, v in categories.items()}
        for tname in type_names:
            if tname in name_to_id:
                type_ids.append(name_to_id[tname])
                logger.info(f"选择分类: {tname} (ID={name_to_id[tname]})")
            else:
                logger.warning(f"未找到分类: {tname}")

    # 开始抓取
    all_data = []

    if args.mode == "api":
        if type_ids:
            # 多分类分别抓取
            for tid in type_ids:
                logger.info(f"开始抓取分类 ID={tid} ({spider.categories.get(tid, '')})")
                data = spider.fetch_all(
                    type_id=tid,
                    keyword=args.keyword,
                    start_page=args.start,
                    max_pages=args.pages,
                    recent_hours=args.recent,
                    download_images=args.download_images,
                    threads=args.threads,
                )
                all_data.extend(data)
        else:
            all_data = spider.fetch_all(
                type_id=type_id,
                keyword=args.keyword,
                start_page=args.start,
                max_pages=args.pages,
                recent_hours=args.recent,
                download_images=args.download_images,
                threads=args.threads,
            )
    else:
        # HTML模式：简单实现列表页抓取
        logger.info("使用HTML爬取模式...")
        max_p = args.pages or 5
        for pg in range(args.start, args.start + max_p):
            items = spider.fetch_list_page(pg)
            logger.info(f"第{pg}页获取 {len(items)} 条")
            all_data.extend(items)
            time.sleep(PAGE_DELAY)

    if not all_data:
        logger.warning("未抓取到任何数据!")
        return

    # 去重
    seen = set()
    unique_data = []
    for item in all_data:
        vid = item.get("vod_id") or item.get("title")
        if vid and vid not in seen:
            seen.add(vid)
            unique_data.append(item)
    all_data = unique_data
    logger.info(f"去重后共 {len(all_data)} 条数据")

    # 导出数据
    formats = [f.strip() for f in args.format.split(",")]
    exporter = DataExporter(all_data, OUTPUT_DIR)
    results = exporter.export(formats)

    # 输出统计信息
    print(f"""
╔══════════════════════════════════════════════════╗
║                  抓取完成!                       ║
╠══════════════════════════════════════════════════╣
║  视频总数:  {len(all_data):>10,} 条                ║""")
    # 分类统计
    if args.mode == "api":
        cat_count = {}
        for v in all_data:
            tn = v.get("type_name", "未知")
            cat_count[tn] = cat_count.get(tn, 0) + 1
        for tn, cnt in sorted(cat_count.items(), key=lambda x: -x[1])[:10]:
            print(f"║    {tn:<10s}: {cnt:>8,d} 条                    ║")

    print(f"╠══════════════════════════════════════════════════╣")
    print(f"║  输出文件:                                       ║")
    for fmt, path in results.items():
        if path:
            print(f"║    [{fmt.upper():6s}] {path}  ║")
    if args.download_images:
        print(f"║    [IMAGES ] {IMAGE_DIR}/  ║")
    print(f"╚══════════════════════════════════════════════════╝")


if __name__ == "__main__":
    main()
