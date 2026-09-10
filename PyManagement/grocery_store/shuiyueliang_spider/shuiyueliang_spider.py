#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
水月亮影视 (https://shuiyueliang.com/) 全站爬虫
基于苹果CMS(maccms) 结构
功能：
  1. 抓取所有分类页，获取视频列表
  2. 抓取详情页，获取视频信息（标题、封面、简介、演员、导演等）
  3. 抓取播放页，获取真实播放地址（m3u8/mp4）
  4. 支持断点续爬、去重、限速、随机UA
  5. 数据保存为JSON/CSV/SQLite
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
from urllib.parse import urljoin, urlparse
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime

import requests
from bs4 import BeautifulSoup

# ============ 配置 ============
BASE_URL = "https://shuiyueliang.com"
OUTPUT_DIR = "shuiyueliang_data"
IMAGES_DIR = os.path.join(OUTPUT_DIR, "images")
DB_PATH = os.path.join(OUTPUT_DIR, "shuiyueliang.db")
JSON_PATH = os.path.join(OUTPUT_DIR, "videos.json")
CSV_PATH = os.path.join(OUTPUT_DIR, "videos.csv")

# 请求配置
MAX_WORKERS = 3          # 并发线程数（不要太高，避免被封）
DELAY_MIN = 1.0          # 请求最小间隔(秒)
DELAY_MAX = 3.0          # 请求最大间隔(秒)
TIMEOUT = 20             # 超时时间(秒)
MAX_RETRIES = 3          # 最大重试次数

# 分类URL路径（从首页分析得到的所有影视分类）
CATEGORIES = [
    "/vod/ppdyp/",   # 电影片
    "/vod/pplxj/",   # 连续剧
    "/vod/ppzyp/",   # 综艺片
    "/vod/ppdmp/",   # 动漫片
    "/vod/ppdj/",    # 短剧
    "/vod/pptyss/",  # 体育赛事
    "/vod/ppaqp/",   # 爱情片
    "/vod/ppdhp/",   # 动画片
    "/vod/ppdlj/",   # 伦理剧
    "/vod/ppdlzy/",  # 伦理综艺
    "/vod/ppdzp/",   # 动作片
    "/vod/ppfzp/",   # 犯罪片
    "/vod/ppgcdm/",  # 国产动漫
    "/vod/ppgtdm/",  # 港台动漫
    "/vod/ppgtzy/",  # 港台综艺
    "/vod/ppgzp/",   # 歌舞片
    "/vod/pphgdm/",  # 韩国动漫
    "/vod/pphgj/",   # 韩剧
    "/vod/pphgzy/",  # 韩国综艺
    "/vod/pphwdm/",  # 海外动漫
    "/vod/pphwj/",   # 海外剧
    "/vod/ppjdp/",   # 纪录片
    "/vod/ppjlp/",   # 惊悚片
    "/vod/ppjqp/",   # 剧情片
    "/vod/ppjsp/",   # 惊悚片
    "/vod/ppkbp/",   # 科幻片
    "/vod/ppkhp/",   # 恐怖片
    "/vod/ppllp/",   # 历史片
    "/vod/pplq/",    # 悬疑
    "/vod/ppmxp/",   # 冒险片
    "/vod/ppomdm/",  # 欧美动漫
    "/vod/ppomj/",   # 欧美剧
    "/vod/ppomzy/",  # 欧美综艺
    "/vod/ppqhp/",   # 奇幻片
    "/vod/ppqtdm/",  # 其他动漫
    "/vod/ppqtj/",   # 其他剧
    "/vod/ppqtp/",   # 其他片
    "/vod/ppqtzy/",  # 其他综艺
    "/vod/pprbdm/",  # 日本动漫
    "/vod/pprbj/",   # 日剧
    "/vod/pprbzy/",  # 日本综艺
    "/vod/pprhdm/",  # 日韩动漫(待确认)
    "/vod/pprhzy/",  # 日韩综艺
    "/vod/ppsnk/",   # 少儿科幻
    "/vod/ppssdy/",  # 丧尸电影
    "/vod/pptgj/",   # 泰剧
    "/vod/pptwj/",   # 台剧
    "/vod/pptxp/",   # 同性片
    "/vod/ppwldj/",  # 网络剧
    "/vod/ppwldy/",  # 网络电影
    "/vod/ppwq/",    # 武侠
    "/vod/ppxgj/",   # 喜剧片
    "/vod/ppxjp/",   # 喜剧片(待确认)
    "/vod/ppxyp/",   # 悬疑片
    "/vod/ppysjs/",  # 原声解说
    "/vod/ppyxjj/",  # 选秀晋级
    "/vod/ppznp/",   # 灾难片
    "/vod/ppzq/",    # 战争
    "/vod/ppzzp/",   # 真人秀
]

USER_AGENTS = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Safari/605.1.15",
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
]

# ============ 日志配置 ============
os.makedirs(OUTPUT_DIR, exist_ok=True)
os.makedirs(IMAGES_DIR, exist_ok=True)

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[
        logging.StreamHandler(sys.stdout),
        logging.FileHandler(os.path.join(OUTPUT_DIR, "spider.log"), encoding="utf-8"),
    ]
)
logger = logging.getLogger(__name__)


# ============ 工具函数 ============
def get_session():
    """创建带随机UA的请求会话"""
    session = requests.Session()
    session.headers.update({
        "User-Agent": random.choice(USER_AGENTS),
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
        "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
        "Accept-Encoding": "gzip, deflate",
        "Connection": "keep-alive",
        "Referer": BASE_URL + "/",
    })
    return session


def polite_delay():
    """礼貌延迟，避免被封"""
    time.sleep(random.uniform(DELAY_MIN, DELAY_MAX))


def safe_request(url, session=None, retries=MAX_RETRIES):
    """安全请求，带重试"""
    if session is None:
        session = get_session()
    for i in range(retries):
        try:
            resp = session.get(url, timeout=TIMEOUT, allow_redirects=True)
            resp.encoding = resp.apparent_encoding or "utf-8"
            if resp.status_code == 200:
                return resp.text
            logger.warning(f"请求 {url} 返回状态码 {resp.status_code}, 重试 {i+1}/{retries}")
        except Exception as e:
            logger.warning(f"请求 {url} 失败: {e}, 重试 {i+1}/{retries}")
        session.headers["User-Agent"] = random.choice(USER_AGENTS)
        polite_delay()
    logger.error(f"请求 {url} 最终失败")
    return None


# ============ 数据库 ============
def init_db():
    """初始化SQLite数据库"""
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    
    # 视频表
    c.execute('''CREATE TABLE IF NOT EXISTS videos (
        id INTEGER PRIMARY KEY,
        title TEXT,
        url TEXT UNIQUE,
        category TEXT,
        category_name TEXT,
        cover TEXT,
        cover_local TEXT,
        year TEXT,
        area TEXT,
        language TEXT,
        director TEXT,
        actors TEXT,
        genres TEXT,
        description TEXT,
        update_status TEXT,
        rating TEXT,
        total_episodes INTEGER DEFAULT 0,
        play_urls TEXT,
        m3u8_urls TEXT,
        crawled_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        detail_crawled INTEGER DEFAULT 0,
        play_crawled INTEGER DEFAULT 0
    )''')
    
    # 分类表
    c.execute('''CREATE TABLE IF NOT EXISTS categories (
        url TEXT PRIMARY KEY,
        name TEXT,
        total_pages INTEGER DEFAULT 0,
        crawled_pages INTEGER DEFAULT 0,
        status TEXT DEFAULT 'pending'
    )''')
    
    # 爬取进度表
    c.execute('''CREATE TABLE IF NOT EXISTS progress (
        key TEXT PRIMARY KEY,
        value TEXT
    )''')
    
    conn.commit()
    return conn


def save_video_basic(conn, video_info):
    """保存视频基本信息（从列表页获取）"""
    c = conn.cursor()
    try:
        c.execute('''INSERT OR IGNORE INTO videos 
            (id, title, url, category, category_name, cover, year, area, detail_crawled)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0)''',
            (video_info["id"], video_info["title"], video_info["url"],
             video_info["category"], video_info.get("category_name", ""),
             video_info.get("cover", ""), video_info.get("year", ""),
             video_info.get("area", "")))
        conn.commit()
    except Exception as e:
        logger.error(f"保存视频失败 {video_info.get('url')}: {e}")


def save_video_detail(conn, video_id, detail):
    """保存视频详情"""
    c = conn.cursor()
    try:
        c.execute('''UPDATE videos SET 
            director=?, actors=?, genres=?, description=?, 
            rating=?, update_status=?, language=?,
            total_episodes=?, cover=?, detail_crawled=1
            WHERE id=?''',
            (detail.get("director", ""), detail.get("actors", ""),
             detail.get("genres", ""), detail.get("description", ""),
             detail.get("rating", ""), detail.get("update_status", ""),
             detail.get("language", ""), detail.get("total_episodes", 0),
             detail.get("cover", ""), video_id))
        conn.commit()
    except Exception as e:
        logger.error(f"保存视频详情失败 {video_id}: {e}")


def save_play_urls(conn, video_id, play_urls, m3u8_urls):
    """保存播放地址"""
    c = conn.cursor()
    try:
        c.execute('''UPDATE videos SET 
            play_urls=?, m3u8_urls=?, play_crawled=1
            WHERE id=?''',
            (json.dumps(play_urls, ensure_ascii=False),
             json.dumps(m3u8_urls, ensure_ascii=False), video_id))
        conn.commit()
    except Exception as e:
        logger.error(f"保存播放地址失败 {video_id}: {e}")


# ============ 解析函数 ============
def parse_list_page(html, category_url, category_name=""):
    """解析分类列表页，提取视频信息列表"""
    videos = []
    soup = BeautifulSoup(html, "html.parser")
    
    # 匹配详情页链接 /vod/xxx/数字.html
    # 排除播放页 /vod/play/
    pattern = re.compile(r'/vod/(?!play/)[a-z]+/\d+\.html$')
    
    seen = set()
    for a in soup.find_all("a", href=pattern):
        href = a.get("href", "")
        if href in seen:
            continue
        seen.add(href)
        
        # 提取视频ID
        id_match = re.search(r'/(\d+)\.html$', href)
        if not id_match:
            continue
        video_id = int(id_match.group(1))
        
        # 提取标题
        title = a.get("title", "") or a.get_text(strip=True)
        if not title:
            img = a.find("img")
            if img:
                title = img.get("alt", "") or img.get("title", "")
        
        # 提取封面
        cover = ""
        img = a.find("img")
        if img:
            # 懒加载属性优先级: data-original > data-src > src > data-lazy-src
            for attr in ["data-original", "data-src", "data-lazy-src", "data-image", "src"]:
                cover = img.get(attr, "")
                if cover and not cover.startswith("data:"):
                    break
            if cover:
                if cover.startswith("//"):
                    cover = "https:" + cover
                elif cover.startswith("/"):
                    cover = urljoin(BASE_URL, cover)
            # 有时候在style background-image
            if not cover:
                style = a.get("style", "") or img.get("style", "")
                bg_match = re.search(r'url\(["\']?([^"\')]+)["\']?\)', style)
                if bg_match:
                    cover = bg_match.group(1)
                    if cover.startswith("//"):
                        cover = "https:" + cover
                    elif cover.startswith("/"):
                        cover = urljoin(BASE_URL, cover)
        
        # 提取其他信息（年份、地区等，从列表项中找）
        item_text = ""
        parent = a.parent
        for _ in range(3):
            if parent:
                item_text += parent.get_text(" ", strip=True) + " "
                parent = parent.parent
        
        year = ""
        year_match = re.search(r'(20\d{2}|19\d{2})', item_text)
        if year_match:
            year = year_match.group(1)
        
        full_url = urljoin(BASE_URL, href)
        videos.append({
            "id": video_id,
            "title": title.strip(),
            "url": full_url,
            "category": category_url,
            "category_name": category_name,
            "cover": cover,
            "year": year,
            "area": "",
        })
    
    return videos


def get_max_page(html):
    """从列表页获取最大页数"""
    soup = BeautifulSoup(html, "html.parser")
    max_page = 1
    
    # 查找分页区域，通常有 class 包含 page/pagination
    pagination = soup.find(class_=re.compile(r"(page|pagination|pagelist|page-box|pages)", re.I))
    search_area = pagination if pagination else soup
    
    # 查找分页链接 /vod/xxx/index数字.html 或 /vod/xxx/数字.html
    # 分页URL格式通常为 /vod/ppdyp/2.html，且分页数字一般不大（<10000）
    page_nums = []
    
    # 先在分页区域内找
    if pagination:
        for a in pagination.find_all("a", href=True):
            href = a.get("href", "")
            # 分页链接通常不包含长ID（视频ID通常>10000）
            page_match = re.search(r'/index(\d+)\.html$', href)
            if not page_match:
                page_match = re.search(r'/(\d+)\.html$', href)
            if page_match:
                pn = int(page_match.group(1))
                if pn < 10000:  # 页码不会超过10000，视频ID通常是5位数以上
                    page_nums.append(pn)
        
        # 查找"下一页""尾页""共X页"
        text = pagination.get_text()
        total_match = re.search(r'共\s*(\d+)\s*[页页]', text)
        if total_match:
            max_page = max(max_page, int(total_match.group(1)))
        
        # 找包含 "末页" "尾页" "last" "end" 的链接
        for a in pagination.find_all("a", href=True):
            txt = a.get_text(strip=True).lower()
            if any(k in txt for k in ["末", "尾", "last", "end", ">>"]):
                href = a.get("href", "")
                pm = re.search(r'/(\d+)\.html$', href)
                if pm:
                    pn = int(pm.group(1))
                    if pn < 10000:
                        page_nums.append(pn)
    else:
        # 无明显分页区域，扫描全页但过滤大数字（视频ID）
        for a in search_area.find_all("a", href=True):
            href = a.get("href", "")
            if "/play/" in href:
                continue
            page_match = re.search(r'/index(\d+)\.html$', href)
            if not page_match:
                page_match = re.search(r'/(?:page|p)(\d+)', href, re.I)
            if page_match:
                pn = int(page_match.group(1))
                if pn < 10000:
                    page_nums.append(pn)
    
    if page_nums:
        max_page = max(max_page, max(page_nums))
    
    # 检查是否是首页"load more"式分页（没有明确分页链接）
    # 如果只有1页但有很多视频，可能需要通过其他方式获取
    if max_page == 1:
        # 尝试查找 "page" 相关的JS变量
        page_count_match = re.search(r'(?:totalPage|pageCount|total_page|pages)\s*[:=]\s*(\d+)', html)
        if page_count_match:
            max_page = int(page_count_match.group(1))
    
    return max_page


def parse_detail_page(html):
    """解析视频详情页"""
    detail = {
        "director": "",
        "actors": "",
        "genres": "",
        "description": "",
        "rating": "",
        "update_status": "",
        "language": "",
        "total_episodes": 0,
        "cover": "",
        "play_urls": [],
        "m3u8_urls": [],
    }
    
    soup = BeautifulSoup(html, "html.parser")
    
    # 提取简介
    desc_elem = soup.find(class_=re.compile(r"(desc|intro|content|detail|brief|synopsis)", re.I))
    if desc_elem:
        detail["description"] = desc_elem.get_text(strip=True)
    # 备选：meta description
    if not detail["description"]:
        meta_desc = soup.find("meta", attrs={"name": "description"})
        if meta_desc:
            detail["description"] = meta_desc.get("content", "")
    
    # 提取详情信息列表（导演/主演/类型等）
    info_text = soup.get_text("\n", strip=True)
    
    director_match = re.search(r'导演[：:]\s*([^\n]+)', info_text)
    if director_match:
        detail["director"] = director_match.group(1).strip()
    
    actor_match = re.search(r'(主演|演员)[：:]\s*([^\n]+)', info_text)
    if actor_match:
        detail["actors"] = actor_match.group(2).strip()
    
    genre_match = re.search(r'(类型|分类)[：:]\s*([^\n]+)', info_text)
    if genre_match:
        detail["genres"] = genre_match.group(2).strip()
    
    lang_match = re.search(r'语言[：:]\s*([^\n]+)', info_text)
    if lang_match:
        detail["language"] = lang_match.group(1).strip()
    
    area_match = re.search(r'(地区|产地)[：:]\s*([^\n]+)', info_text)
    if area_match:
        detail["area"] = area_match.group(2).strip()
    
    status_match = re.search(r'(更新|状态)[：:]\s*([^\n]+)', info_text)
    if status_match:
        detail["update_status"] = status_match.group(2).strip()
    
    rating_match = re.search(r'(评分|豆瓣)[：:]\s*([^\n]+)', info_text)
    if rating_match:
        detail["rating"] = rating_match.group(2).strip()[:20]
    
    # 封面图
    og_img = soup.find("meta", property="og:image")
    if og_img:
        detail["cover"] = og_img.get("content", "")
    if not detail["cover"]:
        cover_img = soup.find("img", class_=re.compile(r"(cover|poster|pic|lazy)", re.I))
        if cover_img:
            detail["cover"] = cover_img.get("data-original", "") or cover_img.get("src", "")
    
    # 提取播放页链接
    play_links = []
    for a in soup.find_all("a", href=re.compile(r'/vod/play/\d+/\d+\.html')):
        href = a.get("href", "")
        epi_name = a.get_text(strip=True)
        play_links.append({
            "url": urljoin(BASE_URL, href),
            "name": epi_name
        })
    detail["play_urls"] = play_links
    detail["total_episodes"] = len(play_links)
    
    # 尝试直接从页面源码中提取m3u8/mp4地址（部分站直接内嵌）
    m3u8_urls = re.findall(r'(https?://[^\s"\'<>]+\.m3u8[^\s"\'<>]*)', html)
    mp4_urls = re.findall(r'(https?://[^\s"\'<>]+\.mp4[^\s"\'<>]*)', html)
    detail["m3u8_urls"] = list(set(m3u8_urls + mp4_urls))
    
    # 查找player_ron等变量中的播放地址
    player_match = re.search(r'(?:player_ron|var\s+play\s*=|mac_url)\s*=\s*["\']([^"\']+)["\']', html)
    if player_match:
        u = player_match.group(1)
        if u.startswith("http") and (".m3u8" in u or ".mp4" in u):
            detail["m3u8_urls"].append(u)
    
    return detail


def parse_play_page(html):
    """解析播放页，提取真实播放地址(m3u8/mp4)"""
    urls = []
    
    # 直接匹配m3u8/mp4
    patterns = [
        r'(https?://[^\s"\'<>\\]+\.m3u8[^\s"\'<>\\]*)',
        r'(https?://[^\s"\'<>\\]+\.mp4[^\s"\'<>\\]*)',
        r'(https?://[^\s"\'<>\\]+\.flv[^\s"\'<>\\]*)',
    ]
    for pat in patterns:
        found = re.findall(pat, html)
        urls.extend(found)
    
    # 匹配js变量中的地址（unescape后的）
    var_patterns = [
        r'var\s+(?:vid|url|play_url|video_url|src)\s*=\s*["\']([^"\']+)["\']',
        r'player_ron\s*=\s*["\']([^"\']+)["\']',
        r'mac_url\s*=\s*["\']([^"\']+)["\']',
        r'"url"\s*:\s*"([^"]+\.(?:m3u8|mp4)[^"]*)"',
    ]
    for pat in var_patterns:
        found = re.findall(pat, html)
        for u in found:
            if u.startswith("http"):
                urls.append(u.replace("\\/", "/"))
    
    # 去重并过滤明显无效的
    result = []
    seen = set()
    for u in urls:
        u = u.replace("\\/", "/").replace("\\u002F", "/")
        if u not in seen and (".m3u8" in u or ".mp4" in u or ".flv" in u):
            seen.add(u)
            result.append(u)
    
    return result


# ============ 核心爬虫逻辑 ============
def crawl_category_list(session, category_url, page=1):
    """爬取分类某一页"""
    # 苹果CMS分页支持多种格式，依次尝试
    if page == 1:
        urls = [urljoin(BASE_URL, category_url)]
    else:
        cat_base = category_url.rstrip("/")
        urls = [
            urljoin(BASE_URL, f"{cat_base}/{page}.html"),       # 格式1: /vod/ppdyp/2.html
            urljoin(BASE_URL, f"{cat_base}/index{page}.html"),  # 格式2: /vod/ppdyp/index2.html
            urljoin(BASE_URL, f"{cat_base}?page={page}"),       # 格式3: ?page=2
        ]
    
    for url in urls:
        html = safe_request(url, session)
        if html and len(html) > 5000:
            return html
    return None


def detect_max_pages_progressive(session, category_url, first_page_html, safe_limit=500):
    """渐进式探测总页数：从第2页开始尝试，直到无新内容或报错"""
    if not first_page_html:
        return 1
    
    # 先尝试从JS变量获取
    total_match = re.search(r'(?:totalPage|pageCount|total_page|total_pages|pages_count)\s*[:=]\s*(\d+)', first_page_html)
    if total_match:
        tp = int(total_match.group(1))
        if 1 < tp <= safe_limit:
            return tp
    
    # 从meta或rel=next检测
    soup = BeautifulSoup(first_page_html, "html.parser")
    next_link = soup.find("link", rel="next")
    if next_link and next_link.get("href"):
        return safe_limit
    
    # 渐进式探测：尝试第2页
    # 先提取第一页所有视频ID
    first_vids = set()
    for m in re.finditer(r'/vod/(?!play/)[a-z]+/(\d+)\.html', first_page_html):
        first_vids.add(int(m.group(1)))
    
    # 尝试访问第2页
    page2_html = crawl_category_list(session, category_url, page=2)
    if not page2_html:
        return 1
    
    # 检查第2页是否有新视频
    page2_vids = set()
    for m in re.finditer(r'/vod/(?!play/)[a-z]+/(\d+)\.html', page2_html):
        page2_vids.add(int(m.group(1)))
    
    if not page2_vids or page2_vids.issubset(first_vids):
        # 第2页没新内容，可能是单页或分页格式不对
        return 1
    
    # 继续探测，直到找不到新内容或达到安全限制
    # 为了效率，我们只验证到10页能翻就返回safe_limit让爬取流程自然翻
    max_page = 2
    for test_page in range(3, min(11, safe_limit + 1)):
        polite_delay()
        html = crawl_category_list(session, category_url, page=test_page)
        if not html:
            break
        vids = set()
        for m in re.finditer(r'/vod/(?!play/)[a-z]+/(\d+)\.html', html):
            vids.add(int(m.group(1)))
        if not vids:
            break
        # 检查是否有重复（即翻到最后一页后又回到前面）
        if vids.issubset(first_vids) and max_page > 1:
            break
        max_page = test_page
    
    return safe_limit if max_page >= 10 else max_page


def crawl_detail(session, video_url):
    """爬取视频详情页"""
    html = safe_request(video_url, session)
    if not html:
        return None
    return parse_detail_page(html)


def crawl_play(session, play_url):
    """爬取播放页"""
    html = safe_request(play_url, session)
    if not html:
        return []
    return parse_play_page(html)


def download_image(session, url, save_path):
    """下载封面图"""
    if not url:
        return
    try:
        resp = session.get(url, timeout=TIMEOUT)
        if resp.status_code == 200:
            with open(save_path, "wb") as f:
                f.write(resp.content)
            return True
    except:
        pass
    return False


def run_spider(crawl_detail=True, crawl_play=True, download_images=False, max_pages_per_cat=None):
    """运行全站爬虫"""
    logger.info("="*60)
    logger.info(f"开始爬取 {BASE_URL}")
    logger.info(f"配置: 并发={MAX_WORKERS}, 延迟={DELAY_MIN}-{DELAY_MAX}s")
    logger.info(f"爬取详情={crawl_detail}, 爬取播放={crawl_play}, 下载图片={download_images}")
    logger.info("="*60)
    
    conn = init_db()
    session = get_session()
    
    # ========== 第一阶段：爬取所有分类列表 ==========
    logger.info("【第一阶段】爬取分类列表页，收集视频链接...")
    all_video_ids = set()
    
    for cat_url in CATEGORIES:
        cat_name = cat_url.strip("/").split("/")[-1]
        logger.info(f"处理分类: {cat_url}")
        
        # 获取第一页
        html = crawl_category_list(session, cat_url, page=1)
        if not html:
            logger.warning(f"  跳过分类 {cat_url}，无法访问")
            continue
        
        # 解析第一页
        videos = parse_list_page(html, cat_url, cat_name)
        seen_in_cat = set(v["id"] for v in videos)
        for v in videos:
            if v["id"] not in all_video_ids:
                all_video_ids.add(v["id"])
                save_video_basic(conn, v)
        logger.info(f"  第1页获取 {len(videos)} 个视频")
        
        # 探测总页数
        if max_pages_per_cat:
            max_page = max_pages_per_cat
        else:
            max_page = detect_max_pages_progressive(session, cat_url, html)
            logger.info(f"  探测到分类总页数约: {max_page}")
        
        if max_page <= 1:
            continue
        
        # 爬取剩余页（直到无新内容或达到最大页）
        consecutive_empty = 0
        for page in range(2, max_page + 1):
            polite_delay()
            html = crawl_category_list(session, cat_url, page=page)
            if not html:
                consecutive_empty += 1
                if consecutive_empty >= 2:
                    logger.info(f"  连续{consecutive_empty}页无法访问，结束该分类")
                    break
                continue
            consecutive_empty = 0
            
            videos = parse_list_page(html, cat_url, cat_name)
            
            # 检查是否有新视频
            new_videos = [v for v in videos if v["id"] not in seen_in_cat]
            seen_in_cat.update(v["id"] for v in videos)
            
            new_count = 0
            for v in new_videos:
                if v["id"] not in all_video_ids:
                    all_video_ids.add(v["id"])
                    save_video_basic(conn, v)
                    new_count += 1
            
            logger.info(f"  第{page}页获取 {len(videos)} 个视频 (本页新 {len(new_videos)}, 全站新 {new_count})")
            
            # 如果连续2页没有新ID，说明翻到底了
            if len(new_videos) == 0:
                consecutive_empty += 1
                if consecutive_empty >= 2:
                    logger.info(f"  连续无新内容，结束该分类")
                    break
    
    logger.info(f"列表页爬取完成，共发现 {len(all_video_ids)} 个视频")
    
    # ========== 第二阶段：爬取视频详情 ==========
    if crawl_detail:
        logger.info("【第二阶段】爬取视频详情页...")
        c = conn.cursor()
        c.execute("SELECT id, url FROM videos WHERE detail_crawled=0 ORDER BY id DESC")
        todo = c.fetchall()
        logger.info(f"待爬详情: {len(todo)} 个")
        
        for idx, (vid, vurl) in enumerate(todo, 1):
            polite_delay()
            detail = crawl_detail(session, vurl)
            if detail:
                save_video_detail(conn, vid, detail)
                
                # 下载封面
                if download_images and detail.get("cover"):
                    ext = ".jpg"
                    img_path = os.path.join(IMAGES_DIR, f"{vid}{ext}")
                    download_image(session, detail["cover"], img_path)
                
                # 如果详情页已经提取到m3u8，直接保存
                if detail.get("m3u8_urls"):
                    save_play_urls(conn, vid, [], detail["m3u8_urls"])
                
                logger.info(f"  [{idx}/{len(todo)}] {vurl} - {detail.get('total_episodes',0)}集")
            else:
                logger.warning(f"  [{idx}/{len(todo)}] 详情爬取失败: {vurl}")
    
    # ========== 第三阶段：爬取播放页获取真实地址 ==========
    if crawl_play:
        logger.info("【第三阶段】爬取播放页，获取真实播放地址...")
        c = conn.cursor()
        c.execute("SELECT id, url, play_urls FROM videos WHERE play_crawled=0 AND detail_crawled=1")
        todo = c.fetchall()
        logger.info(f"待爬播放: {len(todo)} 个视频")
        
        for idx, (vid, vurl, play_urls_str) in enumerate(todo, 1):
            # 解析该视频所有播放页URL
            # 我们需要重新获取详情来得到播放页链接
            if not play_urls_str or play_urls_str == "[]":
                # 重新爬详情获取播放链接
                polite_delay()
                detail = crawl_detail(session, vurl)
                if not detail:
                    continue
                play_links = detail.get("play_urls", [])
            else:
                try:
                    play_links = json.loads(play_urls_str)
                except:
                    play_links = []
            
            all_m3u8 = []
            play_results = []
            
            # 为了效率，每个视频只爬前几集（通常第一集就能找到解析规律）
            sample_links = play_links[:5] if len(play_links) > 5 else play_links
            
            for plink in sample_links:
                polite_delay()
                m3u8s = crawl_play(session, plink["url"])
                if m3u8s:
                    play_results.append({
                        "episode": plink["name"],
                        "url": plink["url"],
                        "streams": m3u8s
                    })
                    all_m3u8.extend(m3u8s)
                    logger.info(f"    找到播放源: {plink['name']} -> {m3u8s[0][:80]}...")
                    break  # 通常找到一个就够了，其他集格式相同
            
            if all_m3u8:
                save_play_urls(conn, vid, play_results, list(set(all_m3u8)))
            
            logger.info(f"  [{idx}/{len(todo)}] {vurl} - 获取到 {len(all_m3u8)} 个播放源")
    
    # ========== 导出数据 ==========
    logger.info("【导出数据】...")
    export_data(conn)
    
    conn.close()
    logger.info("="*60)
    logger.info("爬取完成!")
    logger.info(f"数据目录: {os.path.abspath(OUTPUT_DIR)}")
    logger.info(f"数据库: {DB_PATH}")
    logger.info(f"JSON文件: {JSON_PATH}")
    logger.info(f"CSV文件: {CSV_PATH}")
    logger.info("="*60)


def export_data(conn):
    """导出数据为JSON和CSV"""
    import csv
    c = conn.cursor()
    c.execute("SELECT * FROM videos ORDER BY id DESC")
    columns = [desc[0] for desc in c.description]
    rows = c.fetchall()
    
    videos = []
    for row in rows:
        v = dict(zip(columns, row))
        # 解析JSON字段
        for k in ["play_urls", "m3u8_urls"]:
            if v.get(k):
                try:
                    v[k] = json.loads(v[k])
                except:
                    v[k] = []
        videos.append(v)
    
    # 导出JSON
    with open(JSON_PATH, "w", encoding="utf-8") as f:
        json.dump(videos, f, ensure_ascii=False, indent=2)
    logger.info(f"JSON导出完成: {len(videos)} 条 -> {JSON_PATH}")
    
    # 导出CSV
    csv_columns = ["id", "title", "url", "category", "category_name", "year", 
                   "director", "actors", "genres", "rating", "update_status",
                   "total_episodes", "cover", "description"]
    with open(CSV_PATH, "w", encoding="utf-8-sig", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=csv_columns)
        writer.writeheader()
        for v in videos:
            row = {k: v.get(k, "") for k in csv_columns}
            if isinstance(row.get("description"), str):
                row["description"] = row["description"][:500]
            writer.writerow(row)
    logger.info(f"CSV导出完成: {len(videos)} 条 -> {CSV_PATH}")


def show_stats():
    """显示爬取统计"""
    if not os.path.exists(DB_PATH):
        print("数据库不存在，请先运行爬虫")
        return
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    c.execute("SELECT COUNT(*) FROM videos")
    total = c.fetchone()[0]
    c.execute("SELECT COUNT(*) FROM videos WHERE detail_crawled=1")
    detailed = c.fetchone()[0]
    c.execute("SELECT COUNT(*) FROM videos WHERE play_crawled=1")
    played = c.fetchone()[0]
    c.execute("SELECT COUNT(*) FROM videos WHERE m3u8_urls IS NOT NULL AND m3u8_urls != '[]'")
    with_url = c.fetchone()[0]
    conn.close()
    
    print("\n===== 爬取统计 =====")
    print(f"总视频数: {total}")
    print(f"已爬详情: {detailed}")
    print(f"已爬播放: {played}")
    print(f"获取到播放地址: {with_url}")
    print(f"数据目录: {os.path.abspath(OUTPUT_DIR)}")


# ============ 入口 ============
def main():
    global MAX_WORKERS
    
    parser = argparse.ArgumentParser(description="水月亮影视全站爬虫")
    parser.add_argument("--list-only", action="store_true", help="只爬列表，不爬详情和播放")
    parser.add_argument("--no-detail", action="store_true", help="不爬详情页")
    parser.add_argument("--no-play", action="store_true", help="不爬播放页")
    parser.add_argument("--no-images", action="store_true", help="不下载封面图")
    parser.add_argument("--max-pages", type=int, default=None, help="每个分类最大爬取页数（测试用）")
    parser.add_argument("--workers", type=int, default=MAX_WORKERS, help="并发线程数")
    parser.add_argument("--stats", action="store_true", help="显示统计信息")
    args = parser.parse_args()
    
    if args.stats:
        show_stats()
        return
    
    MAX_WORKERS = args.workers
    
    run_spider(
        crawl_detail=not args.no_detail and not args.list_only,
        crawl_play=not args.no_play and not args.list_only,
        download_images=not args.no_images,
        max_pages_per_cat=args.max_pages,
    )


if __name__ == "__main__":
    main()
