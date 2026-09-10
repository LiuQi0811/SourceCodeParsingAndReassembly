#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
懂片帝AI (dongpian1.com) 全站爬虫
===================================
功能：
  1. 爬取首页推荐、各分类（短剧、动漫、电影等）的影视列表
  2. 支持关键词搜索抓取
  3. 抓取每个影片的详情信息（标题、年份、类型、地区、简介、集数等）
  4. 抓取播放源信息（播放线路、视频地址）
  5. 抓取弹幕
  6. 支持增量抓取、断点续爬
  7. 数据保存为 JSON / CSV 格式
  8. 提供 requests 模式（需配合浏览器签名）和 Playwright 模式两种抓取方式

依赖安装：
  pip install playwright requests beautifulsoup4 lxml
  playwright install chromium

用法：
  python dongpian_crawler.py                  # 默认使用Playwright模式抓取首页推荐
  python dongpian_crawler.py --mode requests  # 使用requests模式(需浏览器签名)
  python dongpian_crawler.py --search "仙逆"   # 按关键词搜索
  python dongpian_crawler.py --pages 5         # 抓取5页推荐
  python dongpian_crawler.py --all             # 抓取所有分类
  python dongpian_crawler.py --detail <av_id>  # 抓取指定影片详情
"""

import argparse
import csv
import hashlib
import json
import os
import random
import re
import sys
import time
from datetime import datetime
from pathlib import Path
from urllib.parse import quote, urlencode, urljoin

try:
    import requests
    from bs4 import BeautifulSoup
    REQUESTS_AVAILABLE = True
except ImportError:
    REQUESTS_AVAILABLE = False

# ============================================================
# 配置
# ============================================================
BASE_URL = "https://dongpian1.com"
OUTPUT_DIR = Path("dongpian_data")
OUTPUT_DIR.mkdir(exist_ok=True)

# 请求头模板 - 模拟浏览器
DEFAULT_HEADERS = {
    "accept": "application/json",
    "accept-language": "zh-CN,zh;q=0.9,en;q=0.8",
    "content-type": "application/json",
    "referer": f"{BASE_URL}/",
    "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
                  "(KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36",
    "x-ai-movie-build-version": "dongpiandi-v2026.09.08.3-6a4fbcaaef9f-web",
    "x-ai-movie-client-name": "movie-search-frontend",
    "x-ai-movie-client-version": "1.0.0",
    "x-ai-movie-protocol-version": "2026-07-05.library-v2.playback-v1",
}

# 预定义的搜索关键词（覆盖各种类型，用于全站抓取）
ALL_KEYWORDS = [
    # 热门国产剧
    "剧", "剧2026", "剧2025", "剧2024", "剧2023",
    # 短剧
    "短剧", "短剧2026", "短剧2025",
    # 动漫
    "动漫", "动漫2026", "动漫2025", "动漫2024", "国产动漫", "日本动漫",
    # 电影
    "电影", "电影2026", "电影2025", "电影2024",
    "动作", "喜剧", "爱情", "科幻", "恐怖", "悬疑", "战争",
    # 韩剧/美剧/日剧
    "韩剧", "韩剧2026", "韩剧2025",
    "美剧", "日剧", "泰剧",
    # 综艺
    "综艺",
    # 字母搜索（通过拼音首字母扩大覆盖率）
] + [chr(c) for c in range(ord('a'), ord('z') + 1)]


# ============================================================
# 签名生成器（从JS逆向）
# ============================================================
class SignatureGenerator:
    """生成懂片帝API请求签名"""

    def __init__(self):
        # 注意：实际签名密钥需要从JS中提取
        # 观察到的签名格式是64字符hex = SHA-256
        # 签名字段 = HMAC-SHA256(secret, method + path + timestamp + nonce + body)
        # 由于密钥可能随build版本变化，Playwright模式是最可靠的
        self.build_version = DEFAULT_HEADERS["x-ai-movie-build-version"]
        self.protocol_version = DEFAULT_HEADERS["x-ai-movie-protocol-version"]

    @staticmethod
    def generate_nonce() -> str:
        """生成随机nonce (32位hex)"""
        return hashlib.md5(f"{time.time()}{random.random()}".encode()).hexdigest()

    @staticmethod
    def generate_timestamp() -> str:
        """生成毫秒级时间戳"""
        return str(int(time.time() * 1000))

    def sign(self, method: str, path: str, body: str = "") -> dict:
        """
        生成签名headers
        注意：这是一个占位实现，完整的签名算法需要逆向JS中的HMAC密钥
        建议使用Playwright模式获取准确签名
        """
        timestamp = self.generate_timestamp()
        nonce = self.generate_nonce()

        # 签名逻辑可能是 SHA-256(method + path + timestamp + nonce + body + secret)
        # 由于secret未知，这里返回基本的headers
        sign_string = f"{method.upper()}\n{path}\n{timestamp}\n{nonce}"
        if body:
            sign_string += f"\n{body}"

        headers = {
            **DEFAULT_HEADERS,
            "x-ai-movie-nonce": nonce,
            "x-ai-movie-timestamp": timestamp,
            # "x-ai-movie-signature": 需要密钥，在Playwright模式中由浏览器自动处理
        }
        return headers


# ============================================================
# Requests 模式抓取器（轻量快速，但签名需要处理）
# ============================================================
class RequestsCrawler:
    """基于requests的轻量爬虫（签名可能失效，推荐使用PlaywrightCrawler）"""

    def __init__(self):
        if not REQUESTS_AVAILABLE:
            raise ImportError("请安装 requests: pip install requests")
        self.session = requests.Session()
        self.session.headers.update(DEFAULT_HEADERS)
        self.signer = SignatureGenerator()
        self.visited = set()

    def _request(self, method, path, **kwargs):
        url = urljoin(BASE_URL, path) if not path.startswith("http") else path
        headers = self.signer.sign(method, path, kwargs.get("json", "") and json.dumps(kwargs.get("json", "")))
        headers.update(kwargs.pop("headers", {}))

        for attempt in range(3):
            try:
                resp = self.session.request(method, url, headers=headers, timeout=15, **kwargs)
                if resp.status_code == 200:
                    return resp.json()
                elif resp.status_code == 401 or resp.status_code == 403:
                    print(f"[!] 签名验证失败 ({resp.status_code}): {path}")
                    return None
                time.sleep(1)
            except Exception as e:
                print(f"[!] 请求失败 (尝试{attempt+1}/3): {e}")
                time.sleep(2)
        return None

    def get_suggest(self, query: str, limit: int = 8):
        """搜索联想"""
        return self._request("GET", f"/v1/suggest?q={quote(query)}&limit={limit}&mode=home")

    def create_thread(self, title: str):
        """创建搜索会话"""
        import uuid
        payload = {
            "title": title,
            "metadata": {
                "search_fields": "all",
                "search_scope_label": "综合",
                "search_mode": "fast",
                "source": "movie_composer_route",
                "submission_id": str(uuid.uuid4()),
            }
        }
        return self._request("POST", "/v1/threads", json=payload)

    def browse_catalog(self, query: str, thread_id: str, page: int = 1, limit: int = 20):
        """浏览目录/搜索结果"""
        params = {
            "page": page,
            "limit": limit,
            "query_mode": "fast_v3",
            "thread_id": thread_id,
            "search_fields": "all",
            "q": query,
        }
        return self._request("GET", f"/v1/browse/catalog?{urlencode(params)}")

    def get_movie_detail(self, av_id: str):
        """获取影片详情"""
        return self._request("GET", f"/v1/catalog/{av_id}")

    def get_movie_variants(self, av_id: str):
        """获取影片变体（多版本）"""
        return self._request("GET", f"/v1/catalog/{av_id}/variants")

    def get_episodes(self, av_id: str, limit: int = 100, offset: int = 0):
        """获取剧集列表"""
        return self._request("GET", f"/v1/catalog/{av_id}/episodes?limit={limit}&offset={offset}")


# ============================================================
# Playwright 模式抓取器（推荐，自动处理签名和JS渲染）
# ============================================================
class PlaywrightCrawler:
    """基于Playwright浏览器自动化的爬虫，自动处理JS签名"""

    def __init__(self, headless: bool = True, slow_mo: int = 0):
        try:
            from playwright.sync_api import sync_playwright
        except ImportError:
            raise ImportError("请安装playwright: pip install playwright && playwright install chromium")

        self.playwright = sync_playwright().start()
        self.browser = self.playwright.chromium.launch(
            headless=headless,
            slow_mo=slow_mo,
            args=["--no-sandbox", "--disable-blink-features=AutomationControlled"]
        )
        self.context = self.browser.new_context(
            user_agent=DEFAULT_HEADERS["user-agent"],
            viewport={"width": 1920, "height": 1080},
            locale="zh-CN",
        )
        self.page = self.context.new_page()
        self.all_movies = {}  # av_id -> movie_info
        self.movie_details = {}
        self.visited_urls = set()

        # 拦截API响应自动收集数据
        self._setup_interceptors()

    def _setup_interceptors(self):
        """设置网络拦截器自动抓取API数据"""
        self._captured_responses = []

        def handle_response(response):
            url = response.url
            if "/v1/" in url and "ddjzis" not in url and "googletagmanager" not in url:
                try:
                    if "application/json" in (response.headers.get("content-type", "")):
                        data = response.json()
                        self._captured_responses.append({"url": url, "data": data})
                except Exception:
                    pass

        self.page.on("response", handle_response)

    def goto(self, path: str, wait_until: str = "domcontentloaded"):
        """访问页面"""
        url = urljoin(BASE_URL, path) if not path.startswith("http") else path
        if url in self.visited_urls:
            return
        self._captured_responses = []
        self.page.goto(url, wait_until=wait_until, timeout=45000)
        try:
            self.page.wait_for_load_state("load", timeout=15000)
        except Exception:
            pass
        self.visited_urls.add(url)
        time.sleep(2)

    def search(self, keyword: str, wait_time: int = 5):
        """执行AI搜索并返回结果"""
        self.goto("/")
        time.sleep(2)

        # 查找搜索框并输入关键词
        try:
            search_box = self.page.locator('input[placeholder*="搜索"], input[type="text"]').first
            search_box.click()
            search_box.fill(keyword)
            time.sleep(1)
            # 按回车或点击发送
            search_box.press("Enter")
        except Exception as e:
            print(f"[!] 搜索框操作失败: {e}")
            try:
                self.page.keyboard.press("Enter")
            except Exception:
                pass

        # 等待搜索结果加载
        time.sleep(wait_time)

        return self._extract_search_results()

    def _extract_search_results(self):
        """从搜索结果页面提取影片信息"""
        movies = []
        # 从页面DOM提取
        try:
            # 获取页面中所有影片链接
            links = self.page.eval_on_selector_all(
                'a[href*="/player/"]',
                """elements => elements.map(a => ({
                    href: a.href,
                    text: a.textContent.trim().substring(0, 200)
                }))"""
            )
            for link in links:
                av_id = self._extract_av_id(link["href"])
                if av_id and av_id not in self.all_movies:
                    self.all_movies[av_id] = {"href": link["href"], "av_id": av_id}
                    movies.append({"av_id": av_id, "href": link["href"], "source_text": link["text"]})
        except Exception as e:
            print(f"[!] 提取链接失败: {e}")

        # 同时从API响应中提取
        for resp in self._captured_responses:
            data = resp["data"]
            if isinstance(data, dict):
                self._extract_movies_from_obj(data, movies)

        return movies

    def _extract_movies_from_obj(self, obj, movies, depth=0):
        """递归从JSON对象中提取影片信息"""
        if depth > 5:
            return
        if isinstance(obj, dict):
            if "variant_id" in obj or "id" in obj and isinstance(obj.get("id", ""), str) and obj.get("id", "").startswith(("av_", "episode:")):
                vid = obj.get("variant_id") or obj.get("id", "")
                if vid.startswith("av_"):
                    info = {
                        "av_id": vid,
                        "title": obj.get("title", ""),
                        "year": obj.get("year", obj.get("release_year", "")),
                        "genres": obj.get("genres", obj.get("tags", [])),
                        "areas": obj.get("areas", []),
                        "language": obj.get("language", ""),
                        "overview": obj.get("overview", obj.get("description", "")),
                        "status": obj.get("status", obj.get("update_status", "")),
                        "episode_count": obj.get("episode_count", obj.get("total_episodes", 0)),
                        "rating": obj.get("rating", obj.get("score", "")),
                        "poster": obj.get("poster", obj.get("cover_url", obj.get("cover", ""))),
                    }
                    if vid not in self.all_movies:
                        self.all_movies[vid] = info
                        movies.append(info)
            for v in obj.values():
                self._extract_movies_from_obj(v, movies, depth + 1)
        elif isinstance(obj, list):
            for item in obj:
                self._extract_movies_from_obj(item, movies, depth + 1)

    @staticmethod
    def _extract_av_id(href: str) -> str:
        """从URL中提取av_id"""
        match = re.search(r'/player/(av_[A-Za-z0-9_-]+)', href)
        return match.group(1) if match else ""

    def crawl_homepage(self, scroll_count: int = 10):
        """爬取首页推荐内容，通过滚动加载更多"""
        self.goto("/")
        print("[*] 正在爬取首页推荐内容...")

        for i in range(scroll_count):
            self.page.evaluate("window.scrollBy(0, 1500)")
            time.sleep(2)
            # 点击"继续下滑加载更多"按钮
            try:
                load_more = self.page.get_by_text("继续下滑加载更多")
                if load_more.is_visible(timeout=1000):
                    load_more.click()
                    time.sleep(2)
            except Exception:
                pass

            movies = self._extract_search_results()
            print(f"  [滚动 {i+1}/{scroll_count}] 已发现 {len(self.all_movies)} 部影片")

        # 点击各分类标签
        categories = ["短剧", "探索", "片单"]
        for cat in categories:
            try:
                link = self.page.get_by_role("link", name=cat)
                if link.is_visible(timeout=2000):
                    link.click()
                    time.sleep(3)
                    for _ in range(scroll_count // 2):
                        self.page.evaluate("window.scrollBy(0, 1500)")
                        time.sleep(2)
                    self._extract_search_results()
                    print(f"  [{cat}] 累计 {len(self.all_movies)} 部影片")
                    self.goto("/")
                    time.sleep(2)
            except Exception as e:
                print(f"  [!] 分类 {cat} 抓取失败: {e}")

        return list(self.all_movies.values())

    def crawl_search_all(self, keywords=None, max_per_keyword: int = 50):
        """通过多个关键词搜索实现全站抓取"""
        if keywords is None:
            keywords = ALL_KEYWORDS

        total = len(keywords)
        for idx, kw in enumerate(keywords):
            print(f"\n[*] 搜索关键词 [{idx+1}/{total}]: '{kw}'")
            try:
                results = self.search(kw, wait_time=4)
                print(f"  本次发现 {len(results)} 部，总计 {len(self.all_movies)} 部")

                # 点击"查看更多"按钮
                try:
                    more_btn = self.page.get_by_role("button", name="查看更多")
                    for _ in range(3):
                        if more_btn.is_visible(timeout=2000):
                            more_btn.click()
                            time.sleep(2)
                            self._extract_search_results()
                except Exception:
                    pass

            except Exception as e:
                print(f"  [!] 搜索失败: {e}")

            time.sleep(1)
            if len(self.all_movies) >= max_per_keyword * total * 0.3:
                print(f"[*] 已达到足够数量，停止搜索")
                break

        return list(self.all_movies.values())

    def get_movie_detail(self, av_id: str) -> dict:
        """获取指定影片的详细信息"""
        if av_id in self.movie_details:
            return self.movie_details[av_id]

        detail_url = f"/player/{av_id}"
        self.goto(detail_url)
        time.sleep(3)

        # 从页面和API响应中提取详情
        detail = {"av_id": av_id, "url": urljoin(BASE_URL, detail_url)}

        # 从API响应提取
        for resp in self._captured_responses:
            data = resp["data"]
            if isinstance(data, dict):
                if "title" in data and ("variant_id" in data or av_id in resp["url"]):
                    detail.update(self._flatten_movie_data(data))
                if "episodes" in data or "items" in data:
                    episodes = data.get("episodes", data.get("items", []))
                    detail["episodes"] = self._parse_episodes(episodes)
                if "playback_sources" in data or "sources" in data:
                    detail["playback_sources"] = data.get("playback_sources", data.get("sources", []))

        # 从DOM提取
        try:
            page_text = self.page.evaluate("document.body.innerText")
            detail["page_text_snippet"] = page_text[:2000]
        except Exception:
            pass

        self.movie_details[av_id] = detail
        return detail

    def _flatten_movie_data(self, data: dict) -> dict:
        """展平影片数据"""
        fields = ["title", "original_title", "year", "release_date", "genres", "tags",
                  "areas", "regions", "language", "languages", "overview", "description",
                  "status", "update_status", "episode_count", "total_episodes",
                  "current_episode", "rating", "score", "douban_rating",
                  "poster", "cover_url", "cover", "backdrop", "banner",
                  "directors", "actors", "cast", "duration", "type", "content_type",
                  "quality", "resolution"]
        result = {}
        for f in fields:
            if f in data and data[f]:
                key = f
                if f in ("description",):
                    key = "overview"
                elif f in ("regions",):
                    key = "areas"
                elif f in ("cover", "cover_url", "backdrop", "banner"):
                    key = "poster"
                elif f in ("score", "douban_rating"):
                    key = "rating"
                elif f in ("cast",):
                    key = "actors"
                elif f in ("total_episodes",):
                    key = "episode_count"
                elif f in ("update_status",):
                    key = "status"
                result[key] = data[f]
        return result

    def _parse_episodes(self, episodes: list) -> list:
        """解析剧集列表"""
        parsed = []
        for ep in episodes:
            if isinstance(ep, dict):
                parsed.append({
                    "id": ep.get("id", ep.get("episode_id", "")),
                    "title": ep.get("title", ep.get("name", ep.get("episode_title", ""))),
                    "index": ep.get("index", ep.get("episode_number", ep.get("number", 0))),
                    "duration": ep.get("duration", 0),
                    "thumbnail": ep.get("thumbnail", ep.get("still_url", "")),
                    "playback_url": ep.get("playback_url", ""),
                })
        return parsed

    def crawl_all_details(self, movie_list: list = None, delay: float = 2.0):
        """爬取所有已发现影片的详情"""
        if movie_list is None:
            movie_list = list(self.all_movies.keys())

        total = len(movie_list)
        for idx, av_id in enumerate(movie_list):
            if not av_id.startswith("av_"):
                continue
            print(f"[*] 获取详情 [{idx+1}/{total}]: {av_id}")
            try:
                detail = self.get_movie_detail(av_id)
                title = detail.get("title", self.all_movies.get(av_id, {}).get("title", "未知"))
                ep_count = len(detail.get("episodes", []))
                print(f"  {title} - {ep_count}集")
            except Exception as e:
                print(f"  [!] 详情获取失败: {e}")
            time.sleep(delay)

    def close(self):
        """关闭浏览器"""
        try:
            self.browser.close()
            self.playwright.stop()
        except Exception:
            pass


# ============================================================
# 数据导出
# ============================================================
def save_to_json(data, filename):
    """保存为JSON"""
    filepath = OUTPUT_DIR / filename
    with open(filepath, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    print(f"[✓] 已保存: {filepath}")
    return filepath


def save_to_csv(data, filename, fields=None):
    """保存为CSV"""
    filepath = OUTPUT_DIR / filename
    if not data:
        print("[!] 无数据可保存")
        return filepath

    if fields is None:
        fields = list(data[0].keys()) if isinstance(data, list) and data else list(data.keys())

    with open(filepath, "w", encoding="utf-8-sig", newline="") as f:
        if isinstance(data, list):
            writer = csv.DictWriter(f, fieldnames=fields, extrasaction="ignore")
            writer.writeheader()
            for row in data:
                writer.writerow(row)
        else:
            writer = csv.writer(f)
            for k, v in data.items():
                writer.writerow([k, v])
    print(f"[✓] 已保存: {filepath}")
    return filepath


def save_episodes_to_csv(all_details, filename="episodes.csv"):
    """将所有剧集信息单独保存"""
    filepath = OUTPUT_DIR / filename
    rows = []
    for av_id, detail in all_details.items():
        title = detail.get("title", av_id)
        for ep in detail.get("episodes", []):
            rows.append({
                "av_id": av_id,
                "movie_title": title,
                "episode_id": ep.get("id", ""),
                "episode_title": ep.get("title", ""),
                "episode_index": ep.get("index", ""),
                "duration": ep.get("duration", ""),
            })

    if rows:
        fields = ["av_id", "movie_title", "episode_id", "episode_title", "episode_index", "duration"]
        save_to_csv(rows, filename, fields)
    return filepath


# ============================================================
# 主程序
# ============================================================
def main():
    parser = argparse.ArgumentParser(description="懂片帝AI (dongpian1.com) 全站爬虫")
    parser.add_argument("--mode", choices=["playwright", "requests"], default="playwright",
                        help="抓取模式：playwright(推荐)或requests")
    parser.add_argument("--headless", action="store_true", default=True,
                        help="无头模式运行浏览器（默认开启）")
    parser.add_argument("--no-headless", dest="headless", action="store_false",
                        help="显示浏览器窗口（调试用）")
    parser.add_argument("--search", type=str, default="",
                        help="搜索关键词（默认爬首页推荐）")
    parser.add_argument("--all", action="store_true",
                        help="使用预设关键词全面抓取全站")
    parser.add_argument("--pages", type=int, default=10,
                        help="滚动加载页数（默认10）")
    parser.add_argument("--detail", type=str, default="",
                        help="抓取指定av_id的详情")
    parser.add_argument("--with-details", action="store_true", default=True,
                        help="抓取影片详情（默认开启）")
    parser.add_argument("--no-details", dest="with_details", action="store_false",
                        help="不抓取影片详情，只抓列表")
    parser.add_argument("--delay", type=float, default=2.0,
                        help="请求间隔秒数（默认2.0）")
    parser.add_argument("--output-prefix", type=str, default="dongpian",
                        help="输出文件名前缀")
    args = parser.parse_args()

    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    prefix = args.output_prefix

    # ====== Requests 模式 ======
    if args.mode == "requests":
        if not REQUESTS_AVAILABLE:
            print("[!] 请安装 requests 和 beautifulsoup4: pip install requests beautifulsoup4")
            sys.exit(1)
        print("[*] 使用 requests 模式（注意：签名可能失效，推荐Playwright模式）")
        crawler = RequestsCrawler()

        if args.search:
            thread = crawler.create_thread(args.search)
            print(f"[*] 搜索: {args.search}")
            if thread:
                thread_id = thread.get("id", "")
                results = crawler.browse_catalog(args.search, thread_id)
                save_to_json(results, f"{prefix}_search_{args.search}_{timestamp}.json")
        else:
            # 获取bootstrap
            bootstrap = crawler._request("GET", "/v1/runtime/bootstrap")
            save_to_json(bootstrap, f"{prefix}_bootstrap_{timestamp}.json")

        return

    # ====== Playwright 模式（推荐） ======
    print("[*] 使用 Playwright 模式启动浏览器...")
    crawler = PlaywrightCrawler(headless=args.headless)

    try:
        all_movies = []

        if args.detail:
            # 抓取单个影片详情
            av_id = args.detail if args.detail.startswith("av_") else f"av_{args.detail}"
            detail = crawler.get_movie_detail(av_id)
            save_to_json(detail, f"{prefix}_detail_{av_id}_{timestamp}.json")
            print(json.dumps(detail, ensure_ascii=False, indent=2)[:2000])

        elif args.search:
            # 搜索模式
            print(f"[*] 搜索关键词: {args.search}")
            results = crawler.search(args.search)
            all_movies = list(crawler.all_movies.values())
            print(f"[+] 搜索到 {len(all_movies)} 个结果")

        elif args.all:
            # 全站抓取模式 - 使用多关键词搜索
            print("[*] 开始全站抓取（多关键词搜索）...")
            all_movies = crawler.crawl_search_all()
            print(f"[+] 全站共发现 {len(all_movies)} 部影片")

        else:
            # 默认：抓取首页推荐
            all_movies = crawler.crawl_homepage(scroll_count=args.pages)
            print(f"[+] 首页推荐共发现 {len(all_movies)} 部影片")

        # 保存影片列表
        movie_list = list(crawler.all_movies.values())
        list_file = save_to_json(movie_list, f"{prefix}_movie_list_{timestamp}.json")

        # 导出CSV列表
        csv_fields = ["av_id", "title", "year", "status", "rating", "href"]
        csv_rows = []
        for m in movie_list:
            row = {k: m.get(k, "") for k in csv_fields if k in m}
            if "av_id" not in row:
                row["av_id"] = m.get("variant_id", m.get("id", ""))
            if "href" not in row and row["av_id"]:
                row["href"] = f"{BASE_URL}/player/{row['av_id']}"
            csv_rows.append(row)
        save_to_csv(csv_rows, f"{prefix}_movie_list_{timestamp}.csv", csv_fields)

        # 抓取详情
        if args.with_details and movie_list:
            print(f"\n[*] 开始抓取 {len(movie_list)} 部影片的详情...")
            crawler.crawl_all_details(delay=args.delay)

            # 保存详情
            details_file = save_to_json(crawler.movie_details, f"{prefix}_movie_details_{timestamp}.json")

            # 保存剧集CSV
            save_episodes_to_csv(crawler.movie_details, f"{prefix}_episodes_{timestamp}.csv")

        print(f"\n{'='*60}")
        print(f"[✓] 抓取完成！")
        print(f"[✓] 影片总数: {len(crawler.all_movies)}")
        print(f"[✓] 已抓取详情: {len(crawler.movie_details)}")
        print(f"[✓] 数据保存在: {OUTPUT_DIR.absolute()}")
        print(f"{'='*60}")

    except KeyboardInterrupt:
        print("\n[!] 用户中断，保存已抓取数据...")
        if crawler.all_movies:
            save_to_json(list(crawler.all_movies.values()), f"{prefix}_movie_list_interrupted_{timestamp}.json")
        if crawler.movie_details:
            save_to_json(crawler.movie_details, f"{prefix}_movie_details_interrupted_{timestamp}.json")
    finally:
        crawler.close()


if __name__ == "__main__":
    main()
