#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
PPnix (https://www.ppnix.com/cn/) 全站爬虫
功能：
  1. 抓取全站电影/电视剧列表（自动翻页、断点续爬）
  2. 抓取每个详情页的元数据（标题/原名/年份/评分/导演/演员/类型/地区/简介等）
  3. 解析播放页中的 m3u8 / mp4 直链
  4. 可选下载封面海报
  5. 结果输出 JSON / CSV，图片保存到本地
  6. 支持多线程、随机 UA、限速、代理、失败重试
"""

import os
import re
import sys
import json
import time
import random
import logging
import argparse
import hashlib
from pathlib import Path
from urllib.parse import urljoin, urlparse
from concurrent.futures import ThreadPoolExecutor, as_completed

import requests
from bs4 import BeautifulSoup

# ========== 基础配置 ==========
BASE_URL = "https://www.ppnix.com"
LANG = "/cn"
HEADERS_BASE = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
                  "(KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
    "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
    "Referer": BASE_URL + LANG + "/",
}

USER_AGENTS = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:127.0) Gecko/20100101 Firefox/127.0",
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1",
]

# 日志
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%H:%M:%S",
)
log = logging.getLogger("ppnix")


# ========== 工具函数 ==========
def make_session(proxy=None):
    s = requests.Session()
    s.headers.update(HEADERS_BASE)
    if proxy:
        s.proxies = {"http": proxy, "https": proxy}
    return s


def rand_sleep(a=0.5, b=2.0):
    time.sleep(random.uniform(a, b))


def get_html(session, url, retries=3, timeout=15):
    """带重试的GET请求，返回文本或None"""
    for i in range(retries):
        try:
            session.headers["User-Agent"] = random.choice(USER_AGENTS)
            resp = session.get(url, timeout=timeout)
            resp.raise_for_status()
            # 网站使用 utf-8
            resp.encoding = resp.apparent_encoding or "utf-8"
            return resp.text
        except Exception as e:
            log.warning(f"GET {url} 失败({i+1}/{retries}): {e}")
            time.sleep(1.5 * (i + 1))
    return None


def safe_filename(name: str) -> str:
    return re.sub(r'[\\/:*?"<>|]', "_", name).strip()[:120]


# ========== 列表页解析 ==========
def parse_list_page(html: str, cate: str):
    """
    解析列表页 HTML，返回 [(vid, title, year, cover_url), ...] 与 是否有下一页
    cate: 'movie' | 'tv'
    """
    soup = BeautifulSoup(html, "html.parser")
    items = []

    # 网站所有影片卡片都是 a[href*="/cn/movie/"] 或 a[href*="/cn/tv/"] + h2
    # 这里通用地从所有链接里抓详情链接和标题
    for a in soup.select(f'a[href*="/{cate}/"]'):
        href = a.get("href", "")
        m = re.search(rf"/{cate}/(\d+)\.html", href)
        if not m:
            continue
        vid = int(m.group(1))
        h2 = a.find("h2")
        if not h2:
            # 标题可能就是 a 的文本，向上找
            h2 = a.find_parent(["li", "div"])
            if h2:
                h2 = h2.find("h2")
        title = h2.get_text(strip=True) if h2 else a.get_text(strip=True)
        if not title:
            continue
        # 年份从链接文本或列表卡片文本中提取
        card_text = a.get_text(" ", strip=True)
        year_m = re.search(r"\b(19\d{2}|20\d{2})\b", card_text)
        year = int(year_m.group(1)) if year_m else None
        # 封面
        img = a.find("img") or (a.find_parent() and a.find_parent().find("img"))
        cover = ""
        if img:
            cover = img.get("data-src") or img.get("src") or ""
            if cover.startswith("//"):
                cover = "https:" + cover
            elif cover.startswith("/"):
                cover = urljoin(BASE_URL, cover)
        items.append({
            "id": vid,
            "title": title,
            "year": year,
            "cover": cover,
            "cate": cate,
            "url": f"{BASE_URL}{LANG}/{cate}/{vid}.html",
        })

    # 去重（同一页面可能重复出现，如"正在上映"和"热门电影"）
    seen = set()
    uniq = []
    for it in items:
        if it["id"] in seen:
            continue
        seen.add(it["id"])
        uniq.append(it)

    # 判断下一页：找"下一页"或页号链接
    has_next = False
    next_page_href = None
    for a in soup.find_all("a"):
        t = a.get_text(strip=True)
        if t in ("下一页", "Next", "下页"):
            href = a.get("href", "")
            # 若 href 不是 # 或 javascript，则有下一页
            if href and not href.startswith("#") and "javascript" not in href:
                has_next = True
                next_page_href = href
            break
    # 兼容：找最大页号，若当前页 < 最大页，也视为有下一页
    page_nums = []
    for a in soup.find_all("a"):
        t = a.get_text(strip=True)
        if re.fullmatch(r"\d+", t):
            page_nums.append(int(t))
    return uniq, has_next, next_page_href


# ========== 详情页解析 ==========
def parse_detail_page(html: str, vid: int, cate: str):
    """
    解析详情页，返回元数据字典
    """
    soup = BeautifulSoup(html, "html.parser")
    info = {
        "id": vid,
        "cate": cate,
        "title": "",
        "original_title": "",
        "year": None,
        "rating": None,
        "director": [],
        "actors": [],
        "genres": [],
        "regions": [],
        "description": "",
        "episodes": None,         # 电视剧总集数
        "current_episodes": None, # 电视剧已更新集数
        "play_sources": [],       # 播放源列表 [{"name":..,"url":..,"episodes":[...]}]
    }

    # 标题 <h1> 形如 "四渡 (2026) 4.4"
    h1 = soup.find("h1")
    if h1:
        raw = h1.get_text(" ", strip=True)
        info["title"] = raw
        m_year = re.search(r"\((\d{4})\)", raw)
        if m_year:
            info["year"] = int(m_year.group(1))
            info["title"] = raw[:m_year.start()].strip()
        m_rating = re.search(r"(\d+\.?\d*)\s*$", raw)
        if m_rating:
            try:
                info["rating"] = float(m_rating.group(1))
            except ValueError:
                pass

    # 导演/演员/类型/地区：详情页在 <h1> 标题之后按以下顺序排列：
    #   导演（第一个人名链接） → 演员（后面一批人名链接） → 类型 → 地区
    # 为避免把导航(首页/电影/电视剧/简体中文...)当成演员，只取 h1 后、播放器前的内容区域，
    # 并用"导航词黑名单 + 词表"严格过滤。
    NAV_BLACKLIST = {
        "PPnix", "首页", "电影", "电视剧", "简体中文", "繁體中文", "English",
        "English", "Englist", "繁体中文",
        "Home", "Movie", "TV Show", "登录", "注册", "搜索", "为你推荐",
    }
    body_area = soup.find("h1")
    info_links = []
    if body_area:
        # 找到 h1 的父容器，取其下所有 a（不是整个文档）
        container = body_area.find_parent()
        # 向上找两层，确保包含所有元数据链接
        for _ in range(3):
            if container and container.find_parent():
                container = container.find_parent()
            else:
                break
        if container:
            # 找到"为你推荐"标题位置，之后的链接不算
            stop_el = None
            for tag in container.find_all(["h2", "h3", "div"], string=re.compile(r"为你推荐|推荐|播放")):
                stop_el = tag
                break
            # 迭代容器下所有 <a>，在 stop_el 之前停下
            for a in container.find_all("a"):
                if stop_el and a.sourceline and stop_el.sourceline and a.sourceline > stop_el.sourceline:
                    break
                txt = a.get_text(strip=True)
                href = a.get("href", "")
                if not txt or txt in NAV_BLACKLIST:
                    continue
                if len(txt) > 20:
                    continue
                # 过滤分页/翻页/功能性链接
                if re.fullmatch(r"\d+|下一页|上一页|尾页|首页|全部|按\w+排序", txt):
                    continue
                # 过滤外部广告/弹窗链接（非本站详情页、非简单锚点）
                if href.startswith("javascript") or href == "#":
                    continue
                info_links.append((txt, href))

    # 分类：按顺序 → 第一个人是导演，然后人名归演员，遇到类型词切到类型，遇到地区词切到地区
    GENRES = {"剧情","喜剧","动作","惊悚","爱情","犯罪","冒险","恐怖","悬疑","奇幻",
              "科幻","动画","战争","传记","历史","家庭","音乐","同性","纪录片",
              "歌舞","运动","古装","灾难","武侠","西部","儿童","短片","黑色电影",
              "戏曲","真人秀","热血","战斗"}
    REGIONS = {"美国","英国","日本","中国大陆","法国","中国香港","韩国","德国",
               "加拿大","意大利","西班牙","澳大利亚","台湾","印度","比利时",
               "瑞典","泰国","爱尔兰","丹麦","俄罗斯","墨西哥","瑞士","新加坡",
               "挪威","荷兰","新西兰","芬兰","波兰","巴西","西德","南非",
               "匈牙利","卢森堡","奥地利","捷克","阿根廷","罗马尼亚",
               "马来西亚","土耳其","印度尼西亚","保加利亚","菲律宾",
               "葡萄牙","希腊","塞尔维亚","冰岛","越南","智利","伊朗","苏联",
               "马耳他","阿联酋","哥伦比亚","卡塔尔","克罗地亚","乌克兰",
               "以色列","柬埔寨","摩洛哥","南斯拉夫","约旦","斯洛文尼亚",
               "捷克斯洛伐克","拉脱维亚","塞浦路斯","黎巴嫩","阿尔及利亚",
               "立陶宛","白俄罗斯","爱沙尼亚","波多黎各","斯洛伐克","尼泊尔",
               "委内瑞拉","哈萨克斯坦","古巴","博茨瓦纳","北马其顿",
               "马恩岛","马其顿","阿富汗","蒙古","突尼斯","秘鲁","科威特",
               "瓦努阿图","玻利维亚","沙特阿拉伯","摩纳哥","巴拿马","巴哈马",
               "尼日利亚","多米尼加","埃及","利比里亚","列支敦士登","伊拉克",
               "亚美尼亚","乌拉圭","中国澳门","中国","不丹"}
    # 人名判定：主要是中英文字符（含·）、长度 2-15
    name_re = re.compile(r"^[\u4e00-\u9fa5A-Za-z·•\s\-\.]{2,15}$")
    phase = "director"  # director → actors → genres → regions
    for txt, href in info_links:
        if txt in GENRES:
            phase = "genres"
            if txt not in info["genres"]:
                info["genres"].append(txt)
            continue
        if txt in REGIONS:
            phase = "regions"
            if txt not in info["regions"]:
                info["regions"].append(txt)
            continue
        # 如果匹配类型或地区的链接（href中带/genre//country/）
        if "/genre/" in href or "/type/" in href:
            phase = "genres"
            if txt not in info["genres"]:
                info["genres"].append(txt)
            continue
        if "/country/" in href or "/region/" in href:
            phase = "regions"
            if txt not in info["regions"]:
                info["regions"].append(txt)
            continue
        # 导演/演员
        if name_re.match(txt):
            if phase == "director":
                info["director"].append(txt)
                phase = "actors"  # 第一个之后切到演员
            elif phase == "actors":
                if txt not in info["actors"] and txt not in info["director"]:
                    info["actors"].append(txt)
            else:
                # 已经到类型/地区阶段的残留人名，忽略
                pass

    # 简介：meta description
    desc_meta = soup.find("meta", attrs={"name": "description"})
    if desc_meta and desc_meta.get("content"):
        info["description"] = desc_meta["content"].strip()

    # 集数（电视剧）：快照里看到类似 "7 / 40" 格式
    if cate == "tv":
        for tag in soup.find_all(string=re.compile(r"\d+\s*/\s*\d+")):
            m = re.search(r"(\d+)\s*/\s*(\d+)", str(tag))
            if m:
                info["current_episodes"] = int(m.group(1))
                info["episodes"] = int(m.group(2))
                break

    # ========== 解析播放源 ==========
    # 该站播放源通常通过页面 JS 中的 iframe / player_aaaa / var player_* 注入
    play_sources = extract_play_sources(html, vid, cate)
    info["play_sources"] = play_sources

    return info


def extract_play_sources(html: str, vid: int, cate: str = "movie"):
    """
    从详情页HTML中提取视频播放地址：
    - 匹配 iframe src（常见播放器嵌套）
    - 匹配 player_aaaa / var main = ... / m3u8 / mp4 直链
    """
    sources = []

    # 1) 找所有 iframe
    for m in re.finditer(r'<iframe[^>]+src=["\']([^"\']+)["\']', html, re.I):
        src = m.group(1)
        if src.startswith("//"):
            src = "https:" + src
        if "ad." in src or "doubleclick" in src or "googletag" in src:
            continue
        sources.append({"name": "iframe", "url": src, "type": "iframe"})

    # 2) 匹配常见加密/明文播放器配置： player_aaaa, var player, MacPlayer
    patterns = [
        r'player_aaaa[^{]*=\s*(\{[^;]+\})',
        r'var\s+player[^{]*=\s*(\{[^;]+\})',
        r'var\s+main[^{]*=\s*(\{[^;]+\})',
        r'MacPlayer\.Url\s*=\s*["\']([^"\']+)["\']',
        r'url\s*:\s*["\']([^"\']+\.(?:m3u8|mp4))["\']',
        r'src\s*:\s*["\']([^"\']+\.(?:m3u8|mp4))["\']',
        r'["\']([^"\']*?\.m3u8[^"\']*)["\']',
        r'["\']([^"\']*?\.mp4[^"\']*)["\']',
    ]
    found_urls = set()
    for pat in patterns:
        for m in re.finditer(pat, html, re.I):
            g = m.group(1)
            if g.startswith("{"):
                # 尝试解析 JSON（宽松）
                try:
                    cfg = json.loads(g.replace("'", '"'))
                    u = cfg.get("url") or cfg.get("src") or cfg.get("link")
                    if u:
                        if u.startswith("//"):
                            u = "https:" + u
                        if u not in found_urls:
                            found_urls.add(u)
                            sources.append({"name": cfg.get("name", "main"), "url": u,
                                            "type": "m3u8" if ".m3u8" in u else "mp4"})
                except Exception:
                    # 正则出里面的 url
                    um = re.search(r'url["\':\s]+([^"\'\s,}]+)', g)
                    if um:
                        u = um.group(1).strip("'\" ")
                        if u.startswith("//"):
                            u = "https:" + u
                        if u not in found_urls and (".m3u8" in u or ".mp4" in u):
                            found_urls.add(u)
                            sources.append({"name": "main", "url": u,
                                            "type": "m3u8" if ".m3u8" in u else "mp4"})
            else:
                u = g
                if u.startswith("//"):
                    u = "https:" + u
                if u not in found_urls:
                    found_urls.add(u)
                    sources.append({"name": "direct", "url": u,
                                    "type": "m3u8" if ".m3u8" in u else "mp4"})

    # 2) 解析页面内联的 m3u8 集数/清晰度数组（该站核心播放逻辑）
    #    形如:  m3u8=['1080P']  或  m3u8=['第01集','第02集',...]
    m3u8_arr = []
    mm = re.search(r'm3u8\s*=\s*\[([^\]]*)\]', html)
    if mm:
        arr_raw = mm.group(1)
        # 提取每个字符串项（支持单引号、双引号）
        m3u8_arr = re.findall(r'["\']([^"\']+)["\']', arr_raw)

    if m3u8_arr:
        # 判断是电影（清晰度列表）还是电视剧（集数列表）
        is_tv_episodes = bool(cate == "tv") and (
            any(re.search(r'\d+集|第\s*\d+|EP?\s*\d+|E\d+', s, re.I) for s in m3u8_arr)
            or (len(m3u8_arr) >= 1 and all(re.fullmatch(r'\d+', s) for s in m3u8_arr))
        )
        if is_tv_episodes:
            # 电视剧：每个 m3u8 项是一集
            eps = []
            for idx, name in enumerate(m3u8_arr, start=1):
                m3u8_url = f"{BASE_URL}/info/m3u8/{vid}/{name}.m3u8"
                eps.append({"num": idx, "name": name, "url": m3u8_url})
            sources.append({
                "name": f"PPnix-{cate}",
                "type": "m3u8",
                "url": eps[0]["url"] if eps else "",
                "episodes": eps,
            })
        else:
            # 电影：每个 m3u8 项是一种清晰度
            quals = []
            for q in m3u8_arr:
                m3u8_url = f"{BASE_URL}/info/m3u8/{vid}/{q}.m3u8"
                quals.append({"quality": q, "url": m3u8_url})
            sources.append({
                "name": f"PPnix-{cate}",
                "type": "m3u8",
                "url": quals[0]["url"] if quals else "",
                "qualities": quals,
            })

    return sources


# ========== 列表爬取 ==========
def crawl_list(session, cate: str, state: dict, max_pages=0, sleep=(0.8, 2.0)):
    """
    抓取某一类别的全部列表页
    state: 已爬取的id集合字典，将就地更新
    返回新增条目列表
    """
    items_all = []
    # 第一页
    url = f"{BASE_URL}{LANG}/{cate}/"
    page = 1
    while True:
        if max_pages and page > max_pages:
            log.info(f"[{cate}] 达到 max_pages={max_pages}，停止列表翻页")
            break
        log.info(f"[{cate}] 抓取列表第 {page} 页: {url}")
        html = get_html(session, url)
        if not html:
            log.error(f"[{cate}] 列表页 {url} 抓取失败")
            break
        items, has_next, next_href = parse_list_page(html, cate)
        new_cnt = 0
        for it in items:
            if it["id"] not in state["seen_ids"]:
                state["seen_ids"].add(it["id"])
                items_all.append(it)
                new_cnt += 1
        log.info(f"[{cate}] 第{page}页解析到 {len(items)} 条，新增 {new_cnt} 条")
        if not has_next:
            log.info(f"[{cate}] 已到达最后一页")
            break
        # 构造下一页URL
        if next_href:
            if next_href.startswith("http"):
                url = next_href
            else:
                url = urljoin(BASE_URL + LANG + f"/{cate}/", next_href.lstrip("/"))
        else:
            # 兜底：该站分页格式 /cn/movie/---{page}-.html
            page += 1
            url = f"{BASE_URL}{LANG}/{cate}/---{page}-.html"
            continue
        page += 1
        rand_sleep(*sleep)
    return items_all


# ========== 详情爬取 ==========
def crawl_detail(session, item: dict, download_cover=False, cover_dir="covers"):
    vid = item["id"]
    cate = item["cate"]
    url = item["url"]
    html = get_html(session, url)
    if not html:
        log.warning(f"详情页抓取失败: {url}")
        return None
    info = parse_detail_page(html, vid, cate)
    # 用列表中拿到的标题/年份/封面兜底
    if not info["title"]:
        info["title"] = item.get("title", "")
    if not info["year"]:
        info["year"] = item.get("year")
    if not info.get("cover") and item.get("cover"):
        info["cover"] = item["cover"]
    else:
        info["cover"] = item.get("cover") or info.get("cover", "")

    # 下载封面
    if download_cover and info.get("cover"):
        try:
            os.makedirs(cover_dir, exist_ok=True)
            ext = os.path.splitext(urlparse(info["cover"]).path)[1] or ".jpg"
            fpath = os.path.join(cover_dir, f"{cate}_{vid}_{safe_filename(info['title'])}{ext}")
            if not os.path.exists(fpath):
                session.headers["Referer"] = url
                r = session.get(info["cover"], timeout=15)
                if r.status_code == 200:
                    with open(fpath, "wb") as f:
                        f.write(r.content)
                info["cover_local"] = fpath
        except Exception as e:
            log.debug(f"封面下载失败 {info.get('cover')}: {e}")
    return info


# ========== 主流程 ==========
def main():
    parser = argparse.ArgumentParser(description="PPnix 全站爬虫")
    parser.add_argument("-o", "--out", default="ppnix_data", help="输出目录")
    parser.add_argument("--movies-only", action="store_true", help="仅抓电影")
    parser.add_argument("--tv-only", action="store_true", help="仅抓电视剧")
    parser.add_argument("--list-only", action="store_true", help="只抓列表，不抓详情")
    parser.add_argument("--max-pages", type=int, default=0, help="每个类别最多抓几页，0=全部")
    parser.add_argument("--workers", type=int, default=5, help="详情爬取线程数")
    parser.add_argument("--sleep", type=float, nargs=2, default=[0.5, 1.5], metavar=("MIN","MAX"), help="请求间隔(秒)")
    parser.add_argument("--download-cover", action="store_true", help="下载封面海报")
    parser.add_argument("--proxy", default="", help="代理地址，如 http://127.0.0.1:7890")
    parser.add_argument("--resume", action="store_true", default=True, help="断点续爬（默认开启）")
    args = parser.parse_args()

    out_dir = Path(args.out)
    out_dir.mkdir(parents=True, exist_ok=True)
    cover_dir = out_dir / "covers"

    session = make_session(args.proxy or None)
    # 先访问首页设置 cookie
    try:
        session.get(BASE_URL + LANG + "/", timeout=15)
    except Exception:
        pass

    # 断点续爬：加载已有数据
    list_file = out_dir / "list.json"
    detail_file = out_dir / "detail.json"
    csv_file = out_dir / "detail.csv"
    state = {"seen_ids": set(), "list": [], "details": {}}

    if args.resume:
        if list_file.exists():
            try:
                with open(list_file, "r", encoding="utf-8") as f:
                    state["list"] = json.load(f)
                state["seen_ids"] = {it["id"] for it in state["list"]}
                log.info(f"从断点恢复列表 {len(state['list'])} 条")
            except Exception:
                pass
        if detail_file.exists():
            try:
                with open(detail_file, "r", encoding="utf-8") as f:
                    d = json.load(f)
                state["details"] = {int(k): v for k, v in d.items()}
                log.info(f"从断点恢复详情 {len(state['details'])} 条")
            except Exception:
                pass

    # 1. 抓列表
    categories = []
    if not args.tv_only:
        categories.append("movie")
    if not args.movies_only:
        categories.append("tv")

    for cate in categories:
        new_items = crawl_list(session, cate, state,
                               max_pages=args.max_pages,
                               sleep=tuple(args.sleep))
        state["list"].extend(new_items)
        # 增量保存列表
        with open(list_file, "w", encoding="utf-8") as f:
            json.dump(state["list"], f, ensure_ascii=False, indent=2)
        log.info(f"[{cate}] 列表累计 {len(state['list'])} 条")

    if args.list_only:
        log.info("仅抓列表，完成。")
        return

    # 2. 抓详情（多线程）
    todo = [it for it in state["list"] if it["id"] not in state["details"]]
    log.info(f"待抓详情 {len(todo)} 条，使用 {args.workers} 线程")

    def worker(it):
        s = make_session(args.proxy or None)
        try:
            s.get(BASE_URL + LANG + "/", timeout=10)
        except Exception:
            pass
        rand_sleep(*args.sleep)
        info = crawl_detail(s, it, download_cover=args.download_cover,
                            cover_dir=str(cover_dir))
        return info

    done = 0
    with ThreadPoolExecutor(max_workers=args.workers) as ex:
        futs = {ex.submit(worker, it): it for it in todo}
        for fut in as_completed(futs):
            it = futs[fut]
            try:
                info = fut.result()
                if info:
                    state["details"][it["id"]] = info
            except Exception as e:
                log.error(f"处理 {it} 出错: {e}")
            done += 1
            if done % 20 == 0 or done == len(todo):
                log.info(f"详情进度 {done}/{len(todo)}")
                # 增量保存
                with open(detail_file, "w", encoding="utf-8") as f:
                    json.dump(state["details"], f, ensure_ascii=False, indent=2)

    # 最终保存
    with open(detail_file, "w", encoding="utf-8") as f:
        json.dump(state["details"], f, ensure_ascii=False, indent=2)

    # 导出 CSV
    import csv
    fields = ["id", "cate", "title", "original_title", "year", "rating",
              "director", "actors", "genres", "regions",
              "episodes", "current_episodes", "cover", "url", "description",
              "play_source_urls"]
    with open(csv_file, "w", encoding="utf-8-sig", newline="") as f:
        w = csv.DictWriter(f, fieldnames=fields)
        w.writeheader()
        for v in state["details"].values():
            play_urls = [s.get("url", "") for s in v.get("play_sources", [])]
            row = {
                "id": v.get("id"),
                "cate": v.get("cate"),
                "title": v.get("title"),
                "original_title": v.get("original_title"),
                "year": v.get("year"),
                "rating": v.get("rating"),
                "director": "/".join(v.get("director", [])),
                "actors": "/".join(v.get("actors", [])),
                "genres": "/".join(v.get("genres", [])),
                "regions": "/".join(v.get("regions", [])),
                "episodes": v.get("episodes"),
                "current_episodes": v.get("current_episodes"),
                "cover": v.get("cover", ""),
                "url": v.get("url", ""),
                "description": v.get("description", ""),
                "play_source_urls": " | ".join(play_urls),
            }
            w.writerow(row)

    log.info(f"全部完成! 共 {len(state['list'])} 条列表, {len(state['details'])} 条详情")
    log.info(f"输出目录: {out_dir.resolve()}")
    log.info(f" - 列表 JSON: {list_file}")
    log.info(f" - 详情 JSON: {detail_file}")
    log.info(f" - 详情 CSV : {csv_file}")
    if args.download_cover:
        log.info(f" - 封面目录 : {cover_dir}")


if __name__ == "__main__":
    main()
