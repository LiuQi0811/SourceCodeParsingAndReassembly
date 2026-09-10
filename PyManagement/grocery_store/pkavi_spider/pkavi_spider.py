#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
七味网 (pkavi.com) 全站爬虫
功能：
  1. 自动爬取电影/剧集/综艺/动漫/短剧 全部分类
  2. 解析详情页（标题、演员、导演、简介、评分、封面等）
  3. 自动解析播放页视频源（完美处理三种加密：0=明文/1=unescape/2=base64+unescape）
  4. 支持断点续爬、数据去重
  5. 支持限速/代理/随机UA
  6. 结果保存为 JSON + CSV 格式
  7. 可选：下载m3u8视频（需ffmpeg）

使用方法：
  pip install requests beautifulsoup4 lxml
  python pkavi_spider.py                  # 默认爬取全部
  python pkavi_spider.py --types 1        # 只爬电影
  python pkavi_spider.py --max-page 10    # 每个分类最多10页
  python pkavi_spider.py --download       # 同时下载视频(需ffmpeg)
  python pkavi_spider.py --delay 2        # 请求间隔2秒
"""

import argparse
import base64
import csv
import json
import os
import random
import re
import sys
import time
import subprocess
from concurrent.futures import ThreadPoolExecutor, as_completed
from urllib.parse import urljoin, urlparse

try:
    import requests
    from bs4 import BeautifulSoup
except ImportError:
    print("正在安装依赖...")
    os.system(f"{sys.executable} -m pip install requests beautifulsoup4 lxml")
    import requests
    from bs4 import BeautifulSoup


# ============ 配置 ============
BASE_URL = "https://www.pkavi.com"
HEADERS_LIST = [
    {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
        "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
        "Referer": BASE_URL + "/",
    },
    {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "zh-CN,zh;q=0.9",
        "Referer": BASE_URL + "/",
    },
    {
        "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "zh-CN,zh;q=0.9",
        "Referer": BASE_URL + "/",
    },
]

CATEGORIES = {
    1: "电影",
    2: "剧集",
    3: "综艺",
    4: "动漫",
    30: "短剧",
}

OUTPUT_DIR = "pkavi_data"
os.makedirs(OUTPUT_DIR, exist_ok=True)


# ============ 工具函数 ============
def get_session(proxies=None):
    """创建requests Session"""
    session = requests.Session()
    session.headers.update(random.choice(HEADERS_LIST))
    if proxies:
        session.proxies.update(proxies)
    return session


def safe_request(session, url, method="get", max_retries=3, timeout=15, **kwargs):
    """安全请求，带重试"""
    for i in range(max_retries):
        try:
            if method.lower() == "get":
                resp = session.get(url, timeout=timeout, **kwargs)
            else:
                resp = session.post(url, timeout=timeout, **kwargs)
            resp.raise_for_status()
            resp.encoding = resp.apparent_encoding or "utf-8"
            return resp
        except Exception as e:
            if i < max_retries - 1:
                time.sleep(random.uniform(1, 3))
                session.headers.update(random.choice(HEADERS_LIST))
            else:
                print(f"[!] 请求失败 {url}: {e}")
                return None


# ============ 逆向解密模块 ============
def base64_decode_custom(encoded_str):
    """
    自定义base64解码（还原网站JS中的base64decode函数）
    网站使用标准base64，但有自定义的字符映射表处理
    """
    try:
        # 补全padding
        missing_padding = len(encoded_str) % 4
        if missing_padding:
            encoded_str += "=" * (4 - missing_padding)
        decoded_bytes = base64.b64decode(encoded_str)
        # 网站使用utf16to8/utf8to16，实际是标准utf-8解码
        return decoded_bytes.decode("utf-8", errors="replace")
    except Exception:
        try:
            return base64.b64decode(encoded_str).decode("latin-1", errors="replace")
        except Exception:
            return encoded_str


def decrypt_player_url(encrypt_level, url_str):
    """
    完美还原MacPlayer.Init()中的解密逻辑：
      encrypt == 0: 明文，直接使用
      encrypt == 1: unescape(url)
      encrypt == 2: unescape(base64decode(url))
    """
    if url_str is None:
        return ""

    # 处理转义
    url_str = url_str.replace("\\/", "/")

    try:
        if str(encrypt_level) == "0":
            # 明文
            result = url_str
        elif str(encrypt_level) == "1":
            # unescape编码
            result = url_str.encode("utf-8").decode("unicode_escape", errors="replace")
            # Python的unicode_escape可能需要额外处理URL编码
            try:
                from urllib.parse import unquote
                result = unquote(result)
            except Exception:
                pass
        elif str(encrypt_level) == "2":
            # base64decode + unescape
            decoded = base64_decode_custom(url_str)
            try:
                from urllib.parse import unquote
                result = unquote(decoded)
            except Exception:
                result = decoded.encode("utf-8").decode("unicode_escape", errors="replace")
        else:
            # 未知加密，尝试逐层解码
            result = url_str
            try:
                result = base64_decode_custom(result)
                from urllib.parse import unquote
                result = unquote(result)
            except Exception:
                pass
    except Exception as e:
        print(f"[!] 解密失败 (encrypt={encrypt_level}): {e}")
        result = url_str

    return result


def extract_player_aaaa(html):
    """
    从播放页HTML中提取player_aaaa对象，完美解析加密视频URL
    使用括号匹配法而非贪婪正则，避免被JSON内部}截断
    """
    result = {
        "encrypt": 0,
        "url": "",
        "url_next": "",
        "from": "",
        "sid": 0,
        "nid": 1,
        "play_from_name": "",
    }

    # 定位 player_aaaa={...}
    idx = html.find("player_aaaa=")
    if idx < 0:
        idx = html.find("player_aaaa =")
    if idx < 0:
        # 尝试正则匹配（兼容带var的情况）
        match = re.search(r"(?:var\s+)?player_aaaa\s*=\s*\{", html)
        if match:
            idx = match.start()
        else:
            return result

    # 找到第一个 {
    brace_start = html.find("{", idx)
    if brace_start < 0:
        return result

    # 括号匹配找到完整JSON对象
    brace_count = 0
    brace_end = brace_start
    in_string = False
    escape_next = False
    for i in range(brace_start, len(html)):
        ch = html[i]
        if escape_next:
            escape_next = False
            continue
        if ch == "\\":
            escape_next = True
            continue
        if ch == '"' or ch == "'":
            in_string = not in_string
            continue
        if in_string:
            continue
        if ch == "{":
            brace_count += 1
        elif ch == "}":
            brace_count -= 1
            if brace_count == 0:
                brace_end = i + 1
                break

    json_str = html[brace_start:brace_end]

    try:
        data = json.loads(json_str)
    except json.JSONDecodeError:
        # 尝试处理转义斜杠
        try:
            json_str = json_str.replace("\\/", "/")
            data = json.loads(json_str)
        except Exception:
            return result

    encrypt = data.get("encrypt", 0)
    raw_url = data.get("url", "")
    raw_url_next = data.get("url_next", "")

    result["encrypt"] = encrypt
    result["url"] = decrypt_player_url(encrypt, raw_url)
    result["url_next"] = decrypt_player_url(encrypt, raw_url_next)
    result["from"] = data.get("from", "")
    result["sid"] = data.get("sid", 0)
    result["nid"] = data.get("nid", 1)
    result["vod_name"] = data.get("vod_data", {}).get("vod_name", "")

    # 解析播放源名称（from字段映射）
    from_names = {
        "xiguam3u8": "西瓜",
        "tiantangm3u8": "天堂",
        "baofengm3u8": "暴风",
        "feifanm3u8": "非凡",
        "ruyim3u8": "如意",
        "ikunm3u8": "ikun",
        "liangzim3u8": "量子",
        "qiyim3u8": "奇异",
        "niunium3u8": "牛牛",
        "maoyanm3u8": "猫眼",
        "wujinm3u8": "无尽",
        "guangsum3u8": "光速",
        "hongnium3u8": "红牛",
    }
    result["play_from_name"] = from_names.get(result["from"], result["from"])

    return result


# ============ 爬取模块 ============
def get_max_page(session, list_url):
    """获取分类列表最大页数"""
    resp = safe_request(session, list_url)
    if not resp:
        return 1

    soup = BeautifulSoup(resp.text, "lxml")
    page_links = soup.select("a[href*='-']")
    max_page = 1
    for a in page_links:
        href = a.get("href", "")
        m = re.search(r"-(\d+)\.html", href)
        if m:
            page_num = int(m.group(1))
            if page_num > max_page:
                max_page = page_num
    return max_page


def parse_list_page(session, cat_id, page):
    """解析列表页，返回该页所有影片ID"""
    url = f"{BASE_URL}/vt/{cat_id}-{page}.html" if page > 1 else f"{BASE_URL}/vt/{cat_id}.html"
    resp = safe_request(session, url)
    if not resp:
        return []

    soup = BeautifulSoup(resp.text, "lxml")
    movie_ids = set()
    for a in soup.select("a[href*='/mv/']"):
        href = a.get("href", "")
        m = re.search(r"/mv/(\d+)\.html", href)
        if m:
            movie_ids.add(int(m.group(1)))
    return list(movie_ids)


def parse_detail_page(session, movie_id):
    """解析详情页，返回影片信息"""
    url = f"{BASE_URL}/mv/{movie_id}.html"
    resp = safe_request(session, url)
    if not resp:
        return None

    soup = BeautifulSoup(resp.text, "lxml")
    html_text = resp.text

    info = {
        "id": movie_id,
        "url": url,
        "title": "",
        "year": "",
        "director": [],
        "writer": [],
        "actors": [],
        "category": [],
        "area": [],
        "language": [],
        "douban_rating": "",
        "imdb_rating": "",
        "description": "",
        "cover": "",
        "update_time": "",
        "play_sources": [],
        "magnet_links": [],
        "pan_links": [],
    }

    # 标题
    title_tag = soup.find("h1")
    if title_tag:
        title_text = title_tag.get_text(strip=True)
        year_m = re.search(r"\((\d{4})\)", title_text)
        if year_m:
            info["year"] = year_m.group(1)
            info["title"] = re.sub(r"\(\d{4}\)", "", title_text).strip()
        else:
            info["title"] = title_text
        # 也检查 .year span
        year_span = title_tag.find("span", class_="year")
        if year_span:
            info["year"] = year_span.get_text(strip=True).strip("()")

    # 通过结构化标签解析（导演/编剧/主演/类型/地区/语言）
    # 网站结构: <div><span>导演：</span><a>...</a></div>
    for div in soup.select("h1 ~ div, .info > div, .detail > div"):
        span = div.find("span")
        if not span:
            continue
        label = span.get_text(strip=True)
        links = [a.get_text(strip=True) for a in div.find_all("a") if a.get_text(strip=True)]

        if "导演" in label:
            info["director"] = links
        elif "编剧" in label:
            info["writer"] = links
        elif "主演" in label:
            info["actors"] = links
        elif "类型" in label:
            info["category"] = links
        elif "地区" in label:
            info["area"] = links
        elif "语言" in label:
            info["language"] = links
        elif "更新" in label or "最后" in label:
            ems = [em.get_text(strip=True) for em in div.find_all("em")]
            if ems:
                info["update_time"] = ems[-1]

    # 如果结构化解析没取到，用通用方法补充
    all_detail_links = []
    # 找h1附近的所有a标签（在详情信息区）
    info_container = title_tag.parent if title_tag else None
    if info_container:
        for a in info_container.find_all("a"):
            text = a.get_text(strip=True)
            href = a.get("href", "")
            if not text or text in ["更多", "全部", "展开全部"]:
                continue
            all_detail_links.append((text, href))

    # 分类/地区/语言通过href模式识别（用于补充）
    if not info["category"]:
        for text, href in all_detail_links:
            if "/class/" in href or "/type/" in href:
                if text not in info["category"]:
                    info["category"].append(text)
    if not info["area"]:
        for text, href in all_detail_links:
            if "/area/" in href:
                if text not in info["area"]:
                    info["area"].append(text)
    if not info["language"]:
        for text, href in all_detail_links:
            if "/language/" in href or "/lang/" in href:
                if text not in info["language"]:
                    info["language"].append(text)

    # 评分
    for a in soup.find_all("a"):
        text = a.get_text(strip=True)
        if "豆瓣" in text:
            rm = re.search(r"([\d.]+)", text)
            if rm:
                info["douban_rating"] = rm.group(1)
        elif "IMDB" in text.upper():
            rm = re.search(r"([\d.]+)", text)
            if rm:
                info["imdb_rating"] = rm.group(1)

    # 简介 - 在"剧集介绍"标题之后的内容
    intro_heading = soup.find(string=re.compile("剧集介绍|剧情介绍|简介|剧情简介"))
    if intro_heading:
        parent = intro_heading.find_parent()
        if parent:
            # 取该标题后面的兄弟节点文本
            desc_parts = []
            for sib in parent.next_siblings:
                if sib.name in ["h2", "h3", "div"] and (sib.find("h2") or sib.find(string=re.compile("在线播放|迅雷下载|网盘下载"))):
                    break
                if hasattr(sib, "get_text"):
                    t = sib.get_text(strip=True)
                    if t and "展开全部" not in t:
                        desc_parts.append(t)
            info["description"] = " ".join(desc_parts)

    # 备用简介提取
    if not info["description"]:
        desc_tag = soup.select_one(".content, .desc, .movie-detail, .detail-content, .juqing, .sketch, .text-overflow ~ *")
        if desc_tag:
            info["description"] = desc_tag.get_text(strip=True)

    # 封面 - 找og:image或详情页图片
    og_img = soup.find("meta", property="og:image")
    if og_img and og_img.get("content"):
        info["cover"] = og_img["content"]
    if not info["cover"]:
        cover_tag = soup.select_one(".poster img, .movie-pic img, .detail-pic img, .lazy, .pic img")
        if cover_tag:
            info["cover"] = cover_tag.get("data-original") or cover_tag.get("src") or ""

    # 解析播放源列表 - 从播放源tab获取名称
    source_names_ordered = []
    # 从 py-tabs > li 获取源名称
    tab_lis = soup.select("ul.py-tabs > li, .hd li, .play-source-tab li")
    for li in tab_lis:
        # 获取li的直接文本（排除子div的数字）
        li_text = li.get_text(strip=True)
        # 去掉尾部的数字（集数）
        name = re.sub(r'\d+$', '', li_text).strip()
        if name and name not in ["换一换", "更多", "在线播放"]:
            source_names_ordered.append(name)

    # 如果没取到，从h2标题文本提取
    if not source_names_ordered:
        play_heading = soup.find(string=re.compile("在线播放"))
        if play_heading:
            heading_parent = play_heading.find_parent()
            if heading_parent:
                heading_text = heading_parent.get_text(strip=True)
                parts = re.findall(r"([^\d\s]+)\s+(\d+)", heading_text.replace("在线播放", ""))
                for name, count in parts:
                    if name and name not in ["换一换", "更多"]:
                        source_names_ordered.append(name)

    # 提取所有播放链接
    play_links = soup.select("a[href*='/py/']")
    source_map = {}

    for a in play_links:
        href = a.get("href", "")
        ep_name = a.get_text(strip=True)
        m = re.search(r"/py/(\d+)-(\d+)-(\d+)\.html", href)
        if m:
            vid, sid, nid = int(m.group(1)), int(m.group(2)), int(m.group(3))
            full_url = urljoin(BASE_URL, href)
            if sid not in source_map:
                source_map[sid] = {"source_id": sid, "source_name": f"源{sid}", "episodes": []}
            # 去重
            exists = any(e["ep_id"] == nid for e in source_map[sid]["episodes"])
            if not exists:
                source_map[sid]["episodes"].append({
                    "ep_name": ep_name,
                    "ep_url": full_url,
                    "ep_id": nid,
                })

    # 分配播放源名称
    sorted_sids = sorted(source_map.keys())
    for idx, sid in enumerate(sorted_sids):
        if idx < len(source_names_ordered):
            source_map[sid]["source_name"] = source_names_ordered[idx]
        info["play_sources"].append(source_map[sid])

    # 磁力链接
    for a in soup.select("a[href*='magnet:']"):
        mag_url = a.get("href", "")
        name = a.get_text(strip=True)
        if mag_url and not any(m["url"] == mag_url for m in info["magnet_links"]):
            info["magnet_links"].append({"name": name, "url": mag_url})

    mag_matches = re.findall(r'magnet:\?xt=urn:btih:[a-zA-Z0-9]+(?:&[^\s"\'<>]+)?', html_text)
    for mag in mag_matches:
        if not any(m["url"] == mag for m in info["magnet_links"]):
            info["magnet_links"].append({"name": "磁力链接", "url": mag})

    return info


def parse_play_page(session, play_url):
    """
    解析播放页，使用完美逆向解密提取真实视频播放地址
    """
    resp = safe_request(session, play_url)
    if not resp:
        return None

    player_data = extract_player_aaaa(resp.text)
    player_data["page_url"] = play_url
    return player_data


def download_m3u8(url, output_path, session=None):
    """
    使用ffmpeg下载m3u8视频
    """
    if not session:
        session = get_session()

    print(f"[*] 正在下载: {url}")
    print(f"[*] 保存到: {output_path}")

    cmd = [
        "ffmpeg",
        "-user_agent", random.choice(HEADERS_LIST)["User-Agent"],
        "-headers", f"Referer: {BASE_URL}/\r\n",
        "-i", url,
        "-c", "copy",
        "-bsf:a", "aac_adtstoasc",
        "-y",
        output_path
    ]

    try:
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=3600)
        if result.returncode == 0:
            print(f"[+] 下载完成: {output_path}")
            return True
        else:
            print(f"[!] 下载失败: {result.stderr[-200:] if result.stderr else 'unknown error'}")
            return False
    except FileNotFoundError:
        print("[!] 未找到ffmpeg，请先安装ffmpeg才能下载视频")
        return False
    except subprocess.TimeoutExpired:
        print(f"[!] 下载超时: {url}")
        return False
    except Exception as e:
        print(f"[!] 下载出错: {e}")
        return False


# ============ 主爬虫类 ============
class PkaviSpider:
    def __init__(self, types=None, max_page=None, delay=1.5, max_workers=3,
                 download_video=False, proxies=None, output_dir=OUTPUT_DIR):
        self.types = types or list(CATEGORIES.keys())
        self.max_page = max_page
        self.delay = delay
        self.max_workers = max_workers
        self.download_video = download_video
        self.proxies = proxies
        self.output_dir = output_dir
        self.session = get_session(proxies)
        self.all_movies = {}
        self.progress_file = os.path.join(output_dir, "progress.json")
        self.result_json = os.path.join(output_dir, "all_movies.json")
        self.result_csv = os.path.join(output_dir, "all_movies.csv")

        # 加载已爬数据
        self._load_progress()

    def _load_progress(self):
        """加载断点续爬数据"""
        if os.path.exists(self.progress_file):
            try:
                with open(self.progress_file, "r", encoding="utf-8") as f:
                    self.all_movies = json.load(f)
                print(f"[*] 已加载 {len(self.all_movies)} 条历史数据")
            except Exception:
                self.all_movies = {}

    def _save_progress(self):
        """保存进度"""
        with open(self.progress_file, "w", encoding="utf-8") as f:
            json.dump(self.all_movies, f, ensure_ascii=False, indent=2)

    def _save_results(self):
        """保存最终结果"""
        movies_list = list(self.all_movies.values())

        # JSON
        with open(self.result_json, "w", encoding="utf-8") as f:
            json.dump(movies_list, f, ensure_ascii=False, indent=2)
        print(f"[+] JSON结果已保存: {self.result_json}")

        # CSV
        if movies_list:
            keys = ["id", "title", "year", "director", "actors", "category", "area",
                    "language", "douban_rating", "imdb_rating", "description",
                    "cover", "url", "play_sources_count", "video_urls"]
            with open(self.result_csv, "w", encoding="utf-8-sig", newline="") as f:
                writer = csv.DictWriter(f, fieldnames=keys)
                writer.writeheader()
                for m in movies_list:
                    video_urls = []
                    for src in m.get("play_sources", []):
                        for ep in src.get("episodes", []):
                            if ep.get("video_url"):
                                video_urls.append(ep["video_url"])
                    writer.writerow({
                        "id": m.get("id", ""),
                        "title": m.get("title", ""),
                        "year": m.get("year", ""),
                        "director": "/".join(m.get("director", [])),
                        "actors": "/".join(m.get("actors", [])),
                        "category": "/".join(m.get("category", [])),
                        "area": "/".join(m.get("area", [])),
                        "language": "/".join(m.get("language", [])),
                        "douban_rating": m.get("douban_rating", ""),
                        "imdb_rating": m.get("imdb_rating", ""),
                        "description": m.get("description", ""),
                        "cover": m.get("cover", ""),
                        "url": m.get("url", ""),
                        "play_sources_count": len(m.get("play_sources", [])),
                        "video_urls": " | ".join(video_urls),
                    })
            print(f"[+] CSV结果已保存: {self.result_csv}")

    def crawl_movie(self, movie_id):
        """爬取单个影片（详情页+所有播放源解析）"""
        if str(movie_id) in self.all_movies:
            return self.all_movies[str(movie_id)]

        time.sleep(random.uniform(self.delay * 0.5, self.delay * 1.5))
        session = get_session(self.proxies)

        # 1. 爬详情页
        detail = parse_detail_page(session, movie_id)
        if not detail:
            return None

        # 2. 解析每个播放源每个集数的真实视频地址
        for source in detail["play_sources"]:
            for ep in source["episodes"]:
                time.sleep(random.uniform(self.delay * 0.3, self.delay))
                play_data = parse_play_page(session, ep["ep_url"])
                if play_data:
                    ep["video_url"] = play_data.get("url", "")
                    ep["encrypt_level"] = play_data.get("encrypt", 0)
                    ep["player_from"] = play_data.get("from", "")
                    if play_data.get("url_next"):
                        ep["video_url_next"] = play_data["url_next"]
                else:
                    ep["video_url"] = ""

        self.all_movies[str(movie_id)] = detail
        return detail

    def crawl_category(self, cat_id):
        """爬取单个分类"""
        cat_name = CATEGORIES.get(cat_id, f"分类{cat_id}")
        print(f"\n{'='*60}")
        print(f"[*] 开始爬取分类: {cat_name} (ID={cat_id})")
        print(f"{'='*60}")

        # 获取总页数
        first_url = f"{BASE_URL}/vt/{cat_id}.html"
        max_p = self.max_page or get_max_page(self.session, first_url)
        print(f"[*] 总页数: {max_p}")

        all_ids = set()
        for page in range(1, max_p + 1):
            print(f"[*] 正在解析 {cat_name} 第 {page}/{max_p} 页...")
            ids = parse_list_page(self.session, cat_id, page)
            new_ids = [mid for mid in ids if str(mid) not in self.all_movies]
            all_ids.update(new_ids)
            print(f"    本页 {len(ids)} 部影片，新增 {len(new_ids)} 部")
            time.sleep(self.delay)

        print(f"[*] {cat_name} 共发现 {len(all_ids)} 部待爬取影片")

        # 多线程爬取详情
        count = 0
        with ThreadPoolExecutor(max_workers=self.max_workers) as executor:
            futures = {executor.submit(self.crawl_movie, mid): mid for mid in all_ids}
            for future in as_completed(futures):
                mid = futures[future]
                try:
                    result = future.result()
                    if result:
                        count += 1
                        title = result.get("title", "未知")
                        src_count = len(result.get("play_sources", []))
                        video_count = sum(
                            len([ep for ep in s["episodes"] if ep.get("video_url")])
                            for s in result.get("play_sources", [])
                        )
                        print(f"  [{count}/{len(all_ids)}] {title} "
                              f"(播放源:{src_count}, 解析视频:{video_count})")

                        # 可选下载视频
                        if self.download_video and result.get("play_sources"):
                            self._download_videos(result)

                    if count % 10 == 0:
                        self._save_progress()
                except Exception as e:
                    print(f"  [!] 爬取影片 {mid} 失败: {e}")

        self._save_progress()
        print(f"[+] {cat_name} 爬取完成，共 {count} 部")
        return count

    def _download_videos(self, movie_info):
        """下载影片视频"""
        title = movie_info.get("title", "unknown")
        safe_title = re.sub(r'[<>:"/\\|?*]', '_', title)
        movie_dir = os.path.join(self.output_dir, "videos", safe_title)
        os.makedirs(movie_dir, exist_ok=True)

        for source in movie_info.get("play_sources", []):
            for ep in source.get("episodes", []):
                video_url = ep.get("video_url", "")
                if video_url and (".m3u8" in video_url or ".mp4" in video_url):
                    ext = ".mp4"
                    ep_name = re.sub(r'[<>:"/\\|?*]', '_', ep.get("ep_name", "video"))
                    src_name = re.sub(r'[<>:"/\\|?*]', '_', source.get("source_name", "source"))
                    out_name = f"{safe_title}_{src_name}_{ep_name}{ext}"
                    out_path = os.path.join(movie_dir, out_name)
                    if os.path.exists(out_path) and os.path.getsize(out_path) > 1024:
                        continue
                    download_m3u8(video_url, out_path, self.session)
                    time.sleep(self.delay)

    def run(self):
        """运行全站爬虫"""
        print("=" * 60)
        print("  七味网 (pkavi.com) 全站爬虫")
        print("  - 完美逆向解密 (encrypt=0/1/2)")
        print("  - 自动解析m3u8真实地址")
        print("=" * 60)
        print(f"[*] 目标分类: {[CATEGORIES.get(t, t) for t in self.types]}")
        print(f"[*] 请求延迟: {self.delay}秒")
        print(f"[*] 并发数: {self.max_workers}")
        print(f"[*] 下载视频: {'是' if self.download_video else '否'}")
        print(f"[*] 输出目录: {self.output_dir}")

        start_time = time.time()
        total = 0

        for cat_id in self.types:
            count = self.crawl_category(cat_id)
            total += count

        self._save_results()

        elapsed = time.time() - start_time
        print(f"\n{'='*60}")
        print(f"[+] 全站爬取完成！")
        print(f"[+] 共爬取 {total} 部影片")
        print(f"[+] 耗时: {elapsed/60:.1f} 分钟")
        print(f"[+] 结果目录: {os.path.abspath(self.output_dir)}")
        print(f"{'='*60}")


# ============ 单影片快速解析 ============
def quick_parse(url):
    """快速解析单个影片播放地址（调试用）"""
    session = get_session()

    # 判断是详情页还是播放页
    mv_match = re.search(r"/mv/(\d+)\.html", url)
    py_match = re.search(r"/py/(\d+)-(\d+)-(\d+)\.html", url)

    if py_match:
        print(f"[*] 解析播放页: {url}")
        data = parse_play_page(session, url)
        if data:
            print(f"\n{'='*50}")
            print(f"  加密级别: {data['encrypt']}")
            print(f"  播放源: {data['from']}")
            print(f"  视频地址: {data['url']}")
            if data.get("url_next"):
                print(f"  下一集: {data['url_next']}")
            print(f"{'='*50}\n")
        return data

    elif mv_match:
        mid = int(mv_match.group(1))
        print(f"[*] 解析影片详情: {url}")
        detail = parse_detail_page(session, mid)
        if detail:
            print(f"\n  标题: {detail['title']} ({detail['year']})")
            print(f"  导演: {', '.join(detail['director'])}")
            print(f"  演员: {', '.join(detail['actors'][:5])}...")
            print(f"  豆瓣评分: {detail['douban_rating']}")
            print(f"  播放源数: {len(detail['play_sources'])}")
            print(f"\n  正在解析所有播放源视频地址...\n")

            for source in detail["play_sources"]:
                print(f"  --- 播放源: {source['source_name']} (ID:{source['source_id']}) ---")
                for ep in source["episodes"]:
                    play_data = parse_play_page(session, ep["ep_url"])
                    if play_data:
                        ep["video_url"] = play_data["url"]
                        print(f"    [{ep['ep_name']}] encrypt={play_data['encrypt']}")
                        print(f"      => {play_data['url']}")
                    time.sleep(0.5)
            return detail
    else:
        print("[!] 无法识别URL格式")
        return None


# ============ 入口 ============
def main():
    parser = argparse.ArgumentParser(description="七味网(pkavi.com)全站爬虫 - 完美逆向解密")
    parser.add_argument("--types", nargs="+", type=int, default=None,
                        help="要爬取的分类ID (1=电影 2=剧集 3=综艺 4=动漫 30=短剧)，默认全部")
    parser.add_argument("--max-page", type=int, default=None,
                        help="每个分类最大爬取页数，默认爬全部")
    parser.add_argument("--delay", type=float, default=1.5,
                        help="请求间隔秒数 (默认1.5)")
    parser.add_argument("--workers", type=int, default=3,
                        help="并发线程数 (默认3)")
    parser.add_argument("--download", action="store_true",
                        help="同时下载视频文件 (需要ffmpeg)")
    parser.add_argument("--proxy", type=str, default=None,
                        help="代理地址，如 http://127.0.0.1:7890")
    parser.add_argument("--output", type=str, default=OUTPUT_DIR,
                        help=f"输出目录 (默认: {OUTPUT_DIR})")
    parser.add_argument("--url", type=str, default=None,
                        help="快速解析单个URL（详情页或播放页），不启动全站爬取")
    args = parser.parse_args()

    if args.url:
        quick_parse(args.url)
        return

    proxies = None
    if args.proxy:
        proxies = {"http": args.proxy, "https": args.proxy}

    spider = PkaviSpider(
        types=args.types,
        max_page=args.max_page,
        delay=args.delay,
        max_workers=args.workers,
        download_video=args.download,
        proxies=proxies,
        output_dir=args.output,
    )
    spider.run()


if __name__ == "__main__":
    main()
