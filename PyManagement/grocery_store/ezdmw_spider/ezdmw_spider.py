#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
E站弹幕网 (www.ezdmw.org) 全站爬虫
功能：
  1. 抓取所有动漫番剧列表及详情（标题、类型、年份、状态、集数、磁力链接、简介、剧情）
  2. 抓取社区文章、动漫图集、学习园地资源
  3. 自动去重、断点续爬
  4. 数据保存为 JSON 结构化文件
  5. 支持并发、限速、随机UA、重试机制

使用方法：
  python ezdmw_spider.py                # 默认抓取全部内容
  python ezdmw_spider.py --anime-only   # 只抓动漫番剧
  python ezdmw_spider.py --community    # 抓动漫+社区+图集+学习
  python ezdmw_spider.py --max-pages 50 # 限制最大翻页数
"""

import os
import re
import json
import time
import random
import logging
import argparse
from urllib.parse import urljoin, urlparse, parse_qs, unquote
from collections import deque
from datetime import datetime

import requests
from bs4 import BeautifulSoup
from concurrent.futures import ThreadPoolExecutor, as_completed

# ============ 配置 ============
BASE_URL = "https://www.ezdmw.org"
OUTPUT_DIR = "ezdmw_data"
ANIME_FILE = os.path.join(OUTPUT_DIR, "anime.json")
COMMUNITY_FILE = os.path.join(OUTPUT_DIR, "community.json")
ATLAS_FILE = os.path.join(OUTPUT_DIR, "atlas.json")
LEARNING_FILE = os.path.join(OUTPUT_DIR, "learning.json")
VISITED_FILE = os.path.join(OUTPUT_DIR, "visited_urls.json")

MAX_WORKERS = 3           # 并发线程数（建议不要超过5，避免给站点造成过大压力）
DELAY_MIN = 0.8           # 请求最小间隔（秒）
DELAY_MAX = 2.0           # 请求最大间隔（秒）
MAX_RETRIES = 3           # 失败重试次数
TIMEOUT = 20              # 请求超时（秒）

# User-Agent 池
USER_AGENTS = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36 Edg/124.0.0.0",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:126.0) Gecko/20100101 Firefox/126.0",
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
]

# ============ 日志 ============
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%H:%M:%S",
)
logger = logging.getLogger("ezdmw_spider")

# ============ 工具函数 ============
def get_session():
    s = requests.Session()
    s.headers.update({
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
        "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
        "Referer": BASE_URL + "/",
    })
    return s


def random_delay():
    time.sleep(random.uniform(DELAY_MIN, DELAY_MAX))


def fetch(session, url, retries=MAX_RETRIES):
    """带重试的请求"""
    for attempt in range(retries):
        try:
            session.headers["User-Agent"] = random.choice(USER_AGENTS)
            resp = session.get(url, timeout=TIMEOUT)
            resp.encoding = resp.apparent_encoding or "utf-8"
            if resp.status_code == 200:
                return resp.text
            logger.warning(f"状态码 {resp.status_code}: {url} (重试 {attempt+1}/{retries})")
        except requests.RequestException as e:
            logger.warning(f"请求失败 {url}: {e} (重试 {attempt+1}/{retries})")
        if attempt < retries - 1:
            time.sleep(2 ** attempt)
    return None


def load_json(path, default):
    if os.path.exists(path):
        try:
            with open(path, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception:
            return default
    return default


def save_json(path, data):
    tmp = path + ".tmp"
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    os.replace(tmp, path)


# ============ 解析函数 ============
def parse_anime_detail(html, url):
    """解析动漫详情页"""
    soup = BeautifulSoup(html, "html.parser")
    data = {"url": url, "crawl_time": datetime.now().isoformat()}

    # 标题
    title_tag = soup.find("h4") or soup.find("h1")
    if title_tag:
        data["title"] = title_tag.get_text(strip=True)
    else:
        data["title"] = ""

    # 类型、年份等
    info_blocks = soup.find_all(["h2", "h3"])
    for block in info_blocks:
        text = block.get_text(strip=True)
        if text.startswith("【类型】"):
            data["tags"] = [t.strip() for t in text.replace("【类型】：", "").replace("【类型】:", "").split("、") if t.strip()]
        elif text.startswith("【年份】"):
            year_text = text.replace("【年份】：", "").replace("【年份】:", "")
            data["year_info"] = year_text
            m = re.search(r"(\d{4})年", year_text)
            if m:
                data["year"] = int(m.group(1))
            data["status"] = "连载中" if "连载中" in year_text else "完结"

    # 集数链接
    episodes = []
    play_heading = None
    for h in soup.find_all(["h2", "h3"]):
        if "在线播放" in h.get_text():
            play_heading = h
            break
    if play_heading:
        parent = play_heading.find_parent()
        if parent:
            for a in parent.find_all("a", href=True):
                ep_num = a.get_text(strip=True)
                ep_href = urljoin(BASE_URL, a["href"])
                if ep_num.isdigit() or re.match(r"^\d+$", ep_num):
                    episodes.append({"episode": int(ep_num), "url": ep_href})
                elif ep_num:
                    episodes.append({"episode": ep_num, "url": ep_href})
    # 按集数排序
    def ep_key(e):
        n = e["episode"]
        return n if isinstance(n, int) else 9999
    episodes.sort(key=ep_key)
    data["episodes"] = episodes
    data["total_episodes"] = len(episodes)

    # 磁力下载链接
    magnets = []
    download_heading = None
    for h in soup.find_all(["h2", "h3"]):
        if "下载" in h.get_text() or "动漫下载" in h.get_text():
            download_heading = h
            break
    if download_heading:
        parent = download_heading.find_parent()
        if parent:
            for a in parent.find_all("a", href=True):
                href = a["href"]
                text = a.get_text(strip=True)
                if href.startswith("magnet:"):
                    magnets.append({"name": text, "magnet": href})
    data["magnets"] = magnets

    # 简介 & 剧情
    content_text = soup.get_text("\n", strip=True)
    intro_match = re.search(r"简介[：:]\s*(.*?)(?=剧情[：:]|分享该动漫|在线播放|$)", content_text, re.S)
    plot_match = re.search(r"剧情[：:]\s*(.*?)(?=分享该动漫|在线播放|$)", content_text, re.S)
    if intro_match:
        data["introduction"] = intro_match.group(1).strip()
    if plot_match:
        data["plot"] = plot_match.group(1).strip()

    return data


def parse_anime_list(html):
    """解析动漫列表页，返回 (动漫链接列表, 是否有下一页)"""
    soup = BeautifulSoup(html, "html.parser")
    anime_urls = set()
    for a in soup.find_all("a", href=True):
        href = a["href"]
        if re.search(r"/Index/bangumi/\d+\.html", href):
            full = urljoin(BASE_URL, href)
            anime_urls.add(full)
    return list(anime_urls)


def parse_list_page(html):
    """解析列表页（社区/图集/学习），返回文章链接集合"""
    soup = BeautifulSoup(html, "html.parser")
    urls = set()
    # 社区/文章/图集详情链接：/Index/contribution/up_* /Index/up_details/*.html
    for a in soup.find_all("a", href=True):
        href = a["href"]
        if any(p in href for p in ["/Index/contribution/up_article", "/Index/contribution/up_atlas",
                                   "/Index/contribution/contribution", "/Index/up_details/"]):
            full = urljoin(BASE_URL, href)
            urls.add(full)
    return urls


def parse_article_detail(html, url):
    """解析社区文章/图集/学习资源详情页"""
    soup = BeautifulSoup(html, "html.parser")
    data = {"url": url, "crawl_time": datetime.now().isoformat()}

    title_tag = soup.find(["h1", "h2", "h3", "h4"])
    if title_tag:
        data["title"] = title_tag.get_text(strip=True)

    # 正文
    body = soup.find("div", class_=re.compile(r"(content|article|post|detail|main)", re.I))
    if not body:
        body = soup.body
    if body:
        # 图片
        images = []
        for img in body.find_all("img", src=True):
            src = urljoin(BASE_URL, img["src"])
            if not src.startswith("data:"):
                images.append(src)
        data["images"] = images
        data["text"] = body.get_text("\n", strip=True)[:5000]

    # 下载链接（磁力/百度/阿里等）
    links = []
    for a in soup.find_all("a", href=True):
        href = a["href"]
        text = a.get_text(strip=True)
        if href.startswith("magnet:") or "pan.baidu" in href or "aliyundrive" in href or "quark" in href or "xunlei" in href:
            links.append({"name": text, "url": href})
    data["download_links"] = links
    return data


# ============ 爬虫主体 ============
class EzdmwSpider:
    def __init__(self, args):
        self.args = args
        self.session = get_session()
        os.makedirs(OUTPUT_DIR, exist_ok=True)

        self.anime_list = load_json(ANIME_FILE, [])
        self.community_list = load_json(COMMUNITY_FILE, [])
        self.atlas_list = load_json(ATLAS_FILE, [])
        self.learning_list = load_json(LEARNING_FILE, [])
        self.visited = set(load_json(VISITED_FILE, []))

        # 建立 URL -> 索引 映射，方便更新
        self.anime_urls = {a["url"]: i for i, a in enumerate(self.anime_list)}
        self.queue = deque()
        logger.info(f"已加载: 动漫 {len(self.anime_list)} 部, 社区 {len(self.community_list)} 篇, "
                    f"图集 {len(self.atlas_list)} 篇, 学习 {len(self.learning_list)} 篇")

    def save_state(self):
        save_json(ANIME_FILE, self.anime_list)
        save_json(COMMUNITY_FILE, self.community_list)
        save_json(ATLAS_FILE, self.atlas_list)
        save_json(LEARNING_FILE, self.learning_list)
        save_json(VISITED_FILE, list(self.visited))

    def discover_entry_urls(self):
        """发现所有入口页（分类、年份、排行榜列表等）"""
        entries = []

        # 基础列表页
        list_pages = [
            "/Index/anime.html",
            "/Index/end_comic.html",
        ]
        for p in list_pages:
            entries.append(urljoin(BASE_URL, p))

        # 分类搜索入口
        categories = [
            "补番", "连载", "轻改", "漫改", "游改", "原创", "热血", "励志",
            "战斗", "魔法", "后宫", "恋爱", "国创", "科幻", "奇幻", "机战",
            "少女", "百合", "校园", "日常", "推理", "催泪", "治愈", "致郁",
            "基腐", "乙女", "运动", "偶像", "社团", "搞笑", "萝莉", "萌系",
            "伪娘", "音乐", "神魔", "猎奇", "剧场", "完",
        ]
        for cat in categories:
            entries.append(f"{BASE_URL}/Index/search_some.html?searchText={cat}&page=0")
            entries.append(f"{BASE_URL}/Index/search_some.html?searchText={cat}&page=0&hot=true")

        # 年份入口
        years = ["2026年7月", "2026年总", "2025年总", "2024年总", "2023年总", "2022年总",
                 "2021年总", "2020年总", "2019年总", "2018年总", "2017年总", "2016年总",
                 "2015年总", "2014年总", "2013年总", "2012年总", "2011年总", "2010年总", "2000年之前总"]
        for y in years:
            from urllib.parse import quote
            entries.append(f"{BASE_URL}/Index/fan_ranking.html?name={quote(y)}【连载中】&atype=hor")
            entries.append(f"{BASE_URL}/Index/fan_ranking.html?name={quote(y)}&atype=ver")

        # 追番时间表
        entries.append(f"{BASE_URL}/Index/end_comic_after.html")

        # 社区/图集/学习入口
        if not self.args.anime_only:
            community_types = [
                "/Index/contribution/contribution.html?type=community&order=new",
                "/Index/contribution/contribution.html?type=community&order=hot",
                "/Index/contribution/up_article.html?type=whole&order=new",
                "/Index/contribution/up_article.html?type=whole&order=hot",
                "/Index/contribution/contribution.html?type=佳句&order=new",
                "/Index/contribution/up_ask.html?type=问答&order=new",
                "/Index/contribution/up_review.html?type=whole&order=new",
            ]
            atlas_types = [
                "/Index/contribution/up_atlas.html?type=whole&order=new",
                "/Index/contribution/up_atlas.html?type=动漫&order=new",
                "/Index/contribution/up_atlas.html?type=壁纸&order=new",
                "/Index/contribution/up_atlas.html?type=表情&order=new",
                "/Index/contribution/up_atlas.html?type=头像&order=new",
                "/Index/contribution/up_atlas.html?type=其他/综合&order=new",
            ]
            learning_types = [
                "/Index/contribution/contribution.html?type=【资源】学习园地&order=new",
                "/Index/contribution/contribution.html?type=【资源】学习园地&order=hot",
            ]
            for p in community_types:
                entries.append(urljoin(BASE_URL, p))
            for p in atlas_types:
                entries.append(urljoin(BASE_URL, p))
            for p in learning_types:
                entries.append(urljoin(BASE_URL, p))

        return list(dict.fromkeys(entries))  # 去重保序

    def next_page_url(self, url):
        """生成下一页URL"""
        parsed = urlparse(url)
        qs = parse_qs(parsed.query)
        page = 0
        if "page" in qs:
            try:
                page = int(qs["page"][0])
            except ValueError:
                page = 0
        page += 1
        from urllib.parse import urlencode, urlunparse
        new_qs = qs.copy()
        new_qs["page"] = [str(page)]
        # 重新构建query
        query_parts = []
        for k, vs in new_qs.items():
            for v in vs:
                query_parts.append(f"{k}={v}")
        new_query = "&".join(query_parts)
        return urlunparse(parsed._replace(query=new_query))

    def is_anime_detail(self, url):
        return bool(re.search(r"/Index/bangumi/\d+\.html", url))

    def is_article_detail(self, url):
        return bool(re.search(r"/Index/(contribution/(up_article|up_atlas|up_ask|up_review)|up_details/\d+)\.html", url))

    def is_atlas_detail(self, url):
        return "up_atlas" in url or "/Index/up_details/" in url

    def crawl_page(self, url):
        """抓取单页，返回 (类型, 数据, 新发现的链接)"""
        if url in self.visited:
            return None
        self.visited.add(url)
        logger.info(f"抓取: {url[:100]}")
        html = fetch(self.session, url)
        random_delay()
        if not html:
            return None

        result = {"type": "unknown", "data": None, "new_links": []}

        # 解析所有链接
        soup = BeautifulSoup(html, "html.parser")
        all_links = set()
        for a in soup.find_all("a", href=True):
            href = urljoin(BASE_URL, a["href"])
            if href.startswith(BASE_URL) and "#" not in href:
                all_links.add(href)
        result["new_links"] = list(all_links)

        # 判断页面类型，解析数据
        if self.is_anime_detail(url):
            data = parse_anime_detail(html, url)
            result["type"] = "anime"
            result["data"] = data
        elif self.is_article_detail(url):
            data = parse_article_detail(html, url)
            if "/Index/contribution/up_atlas" in url:
                result["type"] = "atlas"
            elif "学习园地" in url or (data.get("title") and "学习" in data["title"]):
                result["type"] = "learning"
            else:
                result["type"] = "community"
            result["data"] = data

        return result

    def classify_link(self, url):
        """判断链接应该进入哪个队列"""
        if self.is_anime_detail(url):
            return "anime_detail"
        if self.is_article_detail(url):
            if "up_atlas" in url:
                return "atlas_detail"
            if "学习园地" in url:
                return "learning_detail"
            return "article_detail"
        if "/Index/search_some.html" in url:
            return "anime_list"
        if "/Index/anime.html" in url or "/Index/end_comic" in url or "/Index/fan_ranking" in url:
            return "anime_list"
        if "/Index/contribution/" in url or "/Index/up_details/" in url:
            return "community_list"
        return "other"

    def run(self):
        logger.info("=" * 50)
        logger.info("E站弹幕网全站爬虫启动")
        logger.info("=" * 50)

        entries = self.discover_entry_urls()
        logger.info(f"共发现 {len(entries)} 个入口页")
        for e in entries:
            self.queue.append(e)

        page_counts = {"anime_list": 0, "community_list": 0}
        processed = 0
        skipped_existing = 0

        # BFS 遍历
        with ThreadPoolExecutor(max_workers=MAX_WORKERS) as executor:
            futures = {}
            while self.queue or futures:
                # 提交新任务
                while self.queue and len(futures) < MAX_WORKERS * 2:
                    url = self.queue.popleft()
                    if url in self.visited:
                        continue
                    # 检查是否已抓取详情
                    if self.is_anime_detail(url) and url in self.anime_urls and not self.args.force:
                        skipped_existing += 1
                        self.visited.add(url)
                        continue
                    link_type = self.classify_link(url)
                    # 列表页翻页限制
                    if link_type == "anime_list":
                        m = re.search(r"[?&]page=(\d+)", url)
                        if m and int(m.group(1)) >= self.args.max_pages:
                            continue
                        if not m:
                            page_counts["anime_list"] = page_counts.get("anime_list", 0)
                    if link_type in ("community_list",) and self.args.anime_only:
                        continue
                    fut = executor.submit(self.crawl_page, url)
                    futures[fut] = url

                if not futures:
                    break

                done = []
                for fut in as_completed(futures, timeout=60):
                    done.append(fut)
                    break

                for fut in done:
                    url = futures.pop(fut)
                    processed += 1
                    try:
                        result = fut.result()
                    except Exception as e:
                        logger.error(f"处理异常 {url}: {e}")
                        continue

                    if not result:
                        continue

                    rtype = result["type"]
                    data = result["data"]

                    if rtype == "anime" and data:
                        if data.get("title"):
                            if url in self.anime_urls:
                                idx = self.anime_urls[url]
                                self.anime_list[idx] = data
                                logger.info(f"  [更新动漫] {data['title']} (共{data['total_episodes']}集, {len(data['magnets'])}个磁力)")
                            else:
                                self.anime_list.append(data)
                                self.anime_urls[url] = len(self.anime_list) - 1
                                logger.info(f"  [新动漫] {data['title']} (共{data['total_episodes']}集, {len(data['magnets'])}个磁力)")

                    elif rtype == "community" and data:
                        if data.get("title"):
                            self.community_list.append(data)
                            logger.info(f"  [社区文章] {data['title'][:40]}")

                    elif rtype == "atlas" and data:
                        if data.get("title"):
                            self.atlas_list.append(data)
                            logger.info(f"  [图集] {data['title'][:40]} ({len(data.get('images', []))}张图)")

                    elif rtype == "learning" and data:
                        if data.get("title"):
                            self.learning_list.append(data)
                            logger.info(f"  [学习资源] {data['title'][:40]}")

                    # 将新发现的链接加入队列
                    for new_url in result.get("new_links", []):
                        if new_url not in self.visited and new_url.startswith(BASE_URL):
                            cat = self.classify_link(new_url)
                            # 列表页翻页
                            if cat in ("anime_list", "community_list"):
                                self.queue.append(new_url)
                                # 列表页上发现的详情链接加入队列
                                if cat == "anime_list":
                                    pass  # 会通过new_links自然加入
                            elif cat in ("anime_detail", "article_detail", "atlas_detail", "learning_detail"):
                                self.queue.append(new_url)

                    # 定期保存
                    if processed % 20 == 0:
                        self.save_state()
                        logger.info(f"--- 进度: 已处理 {processed} 页, 跳过已存 {skipped_existing}, 队列 {len(self.queue)} ---")

        self.save_state()
        logger.info("=" * 50)
        logger.info("抓取完成!")
        logger.info(f"动漫番剧: {len(self.anime_list)} 部")
        logger.info(f"社区文章: {len(self.community_list)} 篇")
        logger.info(f"动漫图集: {len(self.atlas_list)} 篇")
        logger.info(f"学习资源: {len(self.learning_list)} 篇")
        logger.info(f"总计访问页面: {len(self.visited)}")
        logger.info(f"数据保存目录: {os.path.abspath(OUTPUT_DIR)}")
        logger.info("=" * 50)


def main():
    global MAX_WORKERS
    parser = argparse.ArgumentParser(description="E站弹幕网 www.ezdmw.org 全站爬虫")
    parser.add_argument("--anime-only", action="store_true", help="只抓取动漫番剧（不抓社区/图集/学习资源）")
    parser.add_argument("--community", action="store_true", help="同时抓取社区/图集/学习资源（默认开启全量）")
    parser.add_argument("--max-pages", type=int, default=200, help="每个分类最大翻页数（默认200，足够覆盖全站）")
    parser.add_argument("--force", action="store_true", help="强制重新抓取已存在的页面")
    parser.add_argument("--workers", type=int, default=MAX_WORKERS, help="并发线程数（默认%d）" % MAX_WORKERS)
    args = parser.parse_args()

    MAX_WORKERS = args.workers

    spider = EzdmwSpider(args)
    try:
        spider.run()
    except KeyboardInterrupt:
        logger.info("收到中断信号，保存进度...")
        spider.save_state()
        logger.info("进度已保存，下次运行可断点续爬")


if __name__ == "__main__":
    main()
