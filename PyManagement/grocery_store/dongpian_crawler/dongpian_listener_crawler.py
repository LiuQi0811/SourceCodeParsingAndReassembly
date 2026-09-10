#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
懂片帝AI - 网络监听式全站爬虫
===============================
核心思路：
  网站的签名在其前端HTTP客户端（axios/fetch wrapper）中自动添加，
  直接调用原生fetch不会带签名。但通过导航到对应页面、触发搜索、
  点击影片等操作，网站自身会发起签名过的API请求。
  我们通过监听 page.on("response") 捕获这些API响应来获取数据。

用法：
  python dongpian_listener_crawler.py                  # 全站抓取
  python dongpian_listener_crawler.py --keyword "仙逆"  # 搜索指定关键词
  python dongpian_listener_crawler.py --demo            # 演示模式
  python dongpian_listener_crawler.py --no-headless     # 显示浏览器
"""

import argparse
import csv
import json
import re
import time
from datetime import datetime
from pathlib import Path
from urllib.parse import urljoin, parse_qs, urlparse

BASE_URL = "https://dongpian1.com"
OUTPUT_DIR = Path("dongpian_data")
OUTPUT_DIR.mkdir(exist_ok=True)


class ListenerCrawler:
    """通过监听网络响应抓取数据"""

    def __init__(self, headless=True):
        from playwright.sync_api import sync_playwright
        self.pw = sync_playwright().start()
        self.browser = self.pw.chromium.launch(
            headless=headless,
            args=["--no-sandbox", "--disable-blink-features=AutomationControlled",
                  "--disable-dev-shm-usage"]
        )
        self.context = self.browser.new_context(
            viewport={"width": 1920, "height": 1080},
            locale="zh-CN",
            user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
                        "(KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36",
        )
        self.page = self.context.new_page()

        # 数据存储
        self.all_movies = {}      # av_id -> movie info
        self.all_details = {}     # av_id -> detail
        self.all_episodes = {}    # av_id -> episode list

        # 用于等待特定API响应的事件
        self._response_data = {}
        self._setup_listener()

    def _setup_listener(self):
        """设置网络响应监听器"""
        def on_response(response):
            url = response.url
            # 跳过静态资源和第三方
            if any(skip in url for skip in [
                '.js', '.css', '.png', '.jpg', '.svg', '.woff', '.ico',
                'ddjzis.cn', 'googletagmanager', 'google-analytics',
                'doubleclick', 'facebook', 'analytics'
            ]):
                return

            if "/v1/" not in url:
                return

            try:
                content_type = response.headers.get("content-type", "")
                if "application/json" not in content_type:
                    return

                data = response.json()
                if not data or "error" in data:
                    return

                # 分类处理
                if "/browse/catalog" in url or "/threads" in url:
                    self._extract_movies(data)
                elif "/catalog/" in url:
                    # 详情页API: /v1/catalog/{av_id} 或 /v1/catalog/{av_id}/episodes 或 /v1/catalog/{av_id}/variants
                    path = urlparse(url).path
                    m = re.search(r'/catalog/(av_[A-Za-z0-9_-]+)', path)
                    if m:
                        av_id = m.group(1)
                        if "/episodes" in path:
                            self._merge_episodes(av_id, data)
                        else:
                            self._merge_detail(av_id, data)
                elif "/v1/suggest" in url:
                    self._extract_from_suggest(data)

            except Exception:
                pass

        self.page.on("response", on_response)

    def _extract_movies(self, data, depth=0):
        """递归从响应数据中提取影片信息"""
        if depth > 10:
            return
        if isinstance(data, dict):
            vid = data.get("variant_id", "")
            if not vid:
                vid = data.get("id", "") if isinstance(data.get("id", ""), str) else ""
            if isinstance(vid, str) and vid.startswith("av_"):
                if vid not in self.all_movies:
                    self.all_movies[vid] = {
                        "av_id": vid,
                        "title": data.get("title", ""),
                        "year": data.get("year", data.get("release_year", "")),
                        "genres": data.get("genres", data.get("tags", [])),
                        "areas": data.get("areas", data.get("regions", [])),
                        "language": data.get("language", ""),
                        "overview": data.get("overview", data.get("description", "")),
                        "status": data.get("status", data.get("update_status", "")),
                        "episode_count": data.get("episode_count", data.get("total_episodes", 0)),
                        "rating": data.get("rating", data.get("score", "")),
                        "poster": data.get("poster_url", data.get("poster", data.get("cover_url", ""))),
                        "content_type": data.get("content_type", data.get("type", "")),
                        "directors": data.get("directors", []),
                        "actors": data.get("actors", data.get("cast", [])),
                        "url": f"{BASE_URL}/player/{vid}",
                        "crawled_at": datetime.now().isoformat(),
                    }
                else:
                    # 更新已有记录
                    self.all_movies[vid].update({
                        k: v for k, v in {
                            "title": data.get("title"),
                            "year": data.get("year"),
                            "genres": data.get("genres", data.get("tags")),
                            "poster": data.get("poster_url", data.get("poster", data.get("cover_url"))),
                        }.items() if v and not self.all_movies[vid].get(k)
                    })
            for v in data.values():
                self._extract_movies(v, depth + 1)
        elif isinstance(data, list):
            for item in data:
                self._extract_movies(item, depth + 1)

    def _extract_from_suggest(self, data):
        """从搜索建议提取"""
        if isinstance(data, list):
            for item in data:
                if isinstance(item, dict):
                    vid = item.get("variant_id", item.get("id", ""))
                    if isinstance(vid, str) and vid.startswith("av_") and vid not in self.all_movies:
                        self._extract_movies(item)

    def _merge_detail(self, av_id, data):
        """合并影片详情"""
        if av_id not in self.all_details:
            self.all_details[av_id] = dict(self.all_movies.get(av_id, {"av_id": av_id}))
        d = self.all_details[av_id]
        fields = ["title", "original_title", "year", "release_date", "genres", "tags",
                  "areas", "regions", "language", "overview", "description",
                  "status", "update_status", "episode_count", "total_episodes",
                  "current_episode", "rating", "score", "douban_rating",
                  "poster_url", "poster", "cover_url", "backdrop_url",
                  "directors", "actors", "cast", "duration", "content_type",
                  "quality", "alias", "aliases"]
        mapping = {
            "description": "overview", "tags": "genres", "regions": "areas",
            "cast": "actors", "total_episodes": "episode_count",
            "update_status": "status", "score": "rating", "douban_rating": "rating",
            "cover_url": "poster", "poster_url": "poster", "backdrop_url": "backdrop",
        }
        for f in fields:
            if f in data and data[f] not in (None, "", [], 0):
                key = mapping.get(f, f)
                if key not in d or not d[key]:
                    d[key] = data[f]
        if "variants" in data:
            d["variants_count"] = len(data["variants"]) if isinstance(data["variants"], list) else 1

    def _merge_episodes(self, av_id, data):
        """合并剧集列表"""
        eps = []
        items = data
        if isinstance(data, dict):
            items = data.get("episodes", data.get("items", data.get("data", [])))
            if isinstance(items, dict):
                items = items.get("episodes", items.get("items", []))
        if isinstance(items, list):
            for ep in items:
                if isinstance(ep, dict):
                    eps.append({
                        "episode_id": ep.get("id", ep.get("episode_id", "")),
                        "title": ep.get("title", ep.get("name", ep.get("episode_title", ""))),
                        "number": ep.get("index", ep.get("episode_number", ep.get("number", 0))),
                        "duration": ep.get("duration", ep.get("duration_seconds", 0)),
                        "thumbnail": ep.get("thumbnail", ep.get("still_url", ep.get("thumbnail_url", ""))),
                    })
        self.all_episodes[av_id] = eps
        if av_id in self.all_details:
            self.all_details[av_id]["episodes"] = eps
        if eps and av_id in self.all_movies:
            self.all_movies[av_id]["episode_count"] = len(eps)

    def _wait_for_idle(self, ms=2000):
        """等待网络空闲"""
        self.page.wait_for_timeout(ms)

    def goto(self, url, wait_ms=4000):
        """访问页面并等待加载"""
        try:
            self.page.goto(url, wait_until="domcontentloaded", timeout=30000)
        except Exception as e:
            print(f"  [!] 页面加载警告: {e}")
        self.page.wait_for_timeout(wait_ms)

    def dismiss_popups(self):
        """关闭弹窗"""
        # 多次按ESC
        for _ in range(3):
            self.page.keyboard.press("Escape")
            self.page.wait_for_timeout(300)
        # 尝试点击关闭按钮
        close_texts = ["我知道了", "关闭", "稍后提醒", "关闭回家地址提醒",
                       "关闭影片预览", "关闭通知"]
        for btn_text in close_texts:
            try:
                btn = self.page.get_by_role("button", name=btn_text)
                if btn.is_visible(timeout=300):
                    btn.click()
                    self.page.wait_for_timeout(300)
            except Exception:
                pass
        # 尝试通过xpath找按钮
        try:
            for sel in ['button:has-text("关闭")', 'button[aria-label="关闭"]',
                        '[class*="close"]', '[class*="dismiss"]']:
                btn = self.page.locator(sel).first
                if btn.is_visible(timeout=300):
                    btn.click()
                    self.page.wait_for_timeout(300)
        except Exception:
            pass

    def search(self, keyword, wait_ms=5000):
        """搜索影片"""
        try:
            # 确保在首页
            if "/session/" in self.page.url or not self.page.url.startswith(BASE_URL):
                self.goto(f"{BASE_URL}/", wait_ms=3000)
                self.dismiss_popups()

            # 找搜索框 - 多种选择器
            search_box = None
            for sel in [
                'input[type="text"]',
                'input[role="searchbox"]',
                '[contenteditable="true"]',
            ]:
                try:
                    loc = self.page.locator(sel).first
                    if loc.is_visible(timeout=1000):
                        search_box = loc
                        break
                except Exception:
                    continue

            if not search_box:
                # 通过tabindex或其他属性找
                try:
                    search_box = self.page.locator("input").first
                except Exception:
                    pass

            if search_box:
                search_box.click(timeout=3000)
                self.page.wait_for_timeout(300)
                # 全选并清除
                search_box.press("Control+a")
                self.page.wait_for_timeout(100)
                search_box.type(keyword, delay=50)
                self.page.wait_for_timeout(1500)
                search_box.press("Enter")
                self.page.wait_for_timeout(wait_ms)
                self.dismiss_popups()

            # 点击"查看更多"加载更多结果
            for _ in range(5):
                try:
                    more_btn = self.page.get_by_role("button", name="查看更多")
                    if more_btn.is_visible(timeout=1000):
                        more_btn.click()
                        self.page.wait_for_timeout(2000)
                    else:
                        break
                except Exception:
                    break

        except Exception as e:
            print(f"  [!] 搜索操作失败: {e}")

    def crawl_homepage(self, scrolls=15):
        """爬取首页推荐"""
        print("[*] 爬取首页推荐...")
        self.goto(f"{BASE_URL}/", wait_ms=4000)
        self.dismiss_popups()

        for i in range(scrolls):
            self.page.evaluate("window.scrollBy(0, 800)")
            self.page.wait_for_timeout(800)
            try:
                load_more = self.page.get_by_text("继续下滑加载更多")
                if load_more.is_visible(timeout=500):
                    load_more.click()
                    self.page.wait_for_timeout(2000)
            except Exception:
                pass

        # 提取页面中所有player链接
        self._extract_links_from_dom()
        print(f"  首页发现: {len(self.all_movies)} 部影片")

    def _extract_links_from_dom(self):
        """从DOM中提取player链接"""
        try:
            links = self.page.eval_on_selector_all(
                'a[href*="/player/"]',
                """els => els.map(a => a.href)"""
            )
            for href in links:
                m = re.search(r'/player/(av_[A-Za-z0-9_-]+)', href)
                if m:
                    vid = m.group(1)
                    if vid not in self.all_movies:
                        self.all_movies[vid] = {
                            "av_id": vid, "title": "",
                            "url": href, "source": "dom_link"
                        }
        except Exception:
            pass

    def open_player_page(self, av_id, wait_ms=3000):
        """打开影片播放页（会触发详情和剧集API）"""
        url = f"{BASE_URL}/player/{av_id}"
        self.goto(url, wait_ms=wait_ms)
        self.dismiss_popups()
        # 等一下确保API响应被捕获
        self.page.wait_for_timeout(1500)

    def fetch_all_details(self, delay=1.5, max_items=None):
        """逐影片打开播放页获取详情和剧集"""
        vids = [v for v in self.all_movies.keys() if v not in self.all_details]
        if max_items:
            vids = vids[:max_items]
        total = len(vids)

        for idx, vid in enumerate(vids):
            try:
                self.open_player_page(vid)
                title = self.all_details.get(vid, {}).get("title",
                        self.all_movies.get(vid, {}).get("title", vid[:20]+"..."))
                eps = len(self.all_episodes.get(vid, []))
                print(f"  [{idx+1}/{total}] {title} - {eps}集")
            except Exception as e:
                print(f"  [{idx+1}/{total}] {vid[:30]}... 失败: {e}")
            time.sleep(delay)

    def crawl_categories(self):
        """爬取各分类页面"""
        categories = [
            ("/short-drama", "短剧"),
            ("/playlists/explore", "探索片单"),
        ]
        for path, name in categories:
            try:
                print(f"[*] 爬取分类: {name}")
                self.goto(f"{BASE_URL}{path}", wait_ms=3000)
                self.dismiss_popups()
                for _ in range(8):
                    self.page.evaluate("window.scrollBy(0, 800)")
                    self.page.wait_for_timeout(800)
                self._extract_links_from_dom()
                print(f"  {name} 累计: {len(self.all_movies)} 部")
            except Exception as e:
                print(f"  [!] {name} 失败: {e}")

    def crawl_by_keywords(self, keywords, max_per_kw=3):
        """通过多关键词搜索全站"""
        for idx, kw in enumerate(keywords):
            print(f"[*] 搜索 [{idx+1}/{len(keywords)}]: '{kw}'")
            before = len(self.all_movies)
            self.search(kw)
            # 从DOM提取链接
            self._extract_links_from_dom()
            added = len(self.all_movies) - before
            print(f"  +{added} 部, 累计 {len(self.all_movies)} 部")
            time.sleep(1)

    def get_movie_title_from_dom(self, av_id):
        """尝试从页面获取影片标题"""
        try:
            title = self.page.evaluate("document.querySelector('h1,h2,h3')?.textContent?.trim()")
            if title and av_id in self.all_movies:
                self.all_movies[av_id]["title"] = title
                if av_id in self.all_details:
                    self.all_details[av_id]["title"] = title
        except Exception:
            pass

    def close(self):
        try:
            self.browser.close()
            self.pw.stop()
        except Exception:
            pass


# ============================================================
# 数据导出
# ============================================================
def save_json(data, filename):
    path = OUTPUT_DIR / filename
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    print(f"[✓] {path}")
    return path


def save_movies_csv(movies, filename):
    fields = ["av_id", "title", "year", "genres", "areas", "status",
              "episode_count", "rating", "content_type", "url"]
    path = OUTPUT_DIR / filename
    with open(path, "w", encoding="utf-8-sig", newline="") as f:
        w = csv.DictWriter(f, fieldnames=fields, extrasaction="ignore")
        w.writeheader()
        for m in movies:
            row = dict(m)
            for k in ("genres", "areas", "directors", "actors"):
                if isinstance(row.get(k), list):
                    row[k] = ", ".join(str(x) for x in row[k] if x)
            w.writerow(row)
    print(f"[✓] {path}")
    return path


def save_episodes_csv(all_episodes, all_details, filename):
    fields = ["av_id", "movie_title", "episode_id", "title", "number", "duration"]
    path = OUTPUT_DIR / filename
    with open(path, "w", encoding="utf-8-sig", newline="") as f:
        w = csv.DictWriter(f, fieldnames=fields, extrasaction="ignore")
        w.writeheader()
        for vid, eps in all_episodes.items():
            mtitle = all_details.get(vid, {}).get("title",
                     {v.get("av_id"): v.get("title", "") for v in []}.get(vid, vid[:20]))
            for ep in eps:
                w.writerow({
                    "av_id": vid, "movie_title": mtitle,
                    "episode_id": ep.get("episode_id", ""),
                    "title": ep.get("title", ""),
                    "number": ep.get("number", ""),
                    "duration": ep.get("duration", ""),
                })
    print(f"[✓] {path}")
    return path


# ============================================================
# 关键词列表
# ============================================================
DEFAULT_KEYWORDS = [
    "剧", "短剧", "动漫", "电影", "综艺",
    "韩剧2026", "韩剧2025", "美剧", "日剧", "泰剧",
    "动作", "喜剧", "爱情", "科幻", "悬疑", "恐怖", "战争",
    "古装", "都市", "仙侠", "修仙", "穿越", "总裁",
    "2026", "2025", "2024", "2023",
    "仙逆", "凡人修仙传", "吞噬星空", "早春晴朗",
]

DEMO_KEYWORDS = ["仙逆"]


# ============================================================
# 主程序
# ============================================================
def main():
    parser = argparse.ArgumentParser(description="懂片帝AI 全站爬虫（网络监听版）")
    parser.add_argument("--keyword", "-k", type=str, default="", help="搜索单个关键词")
    parser.add_argument("--demo", action="store_true", help="演示模式")
    parser.add_argument("--all", action="store_true", default=True, help="全站抓取（默认）")
    parser.add_argument("--no-headless", action="store_true", help="显示浏览器")
    parser.add_argument("--no-details", action="store_true", help="跳过详情抓取")
    parser.add_argument("--max-details", type=int, default=0,
                        help="最多抓取多少部详情(0=全部已发现的)")
    parser.add_argument("--scrolls", type=int, default=12, help="首页滚动次数")
    parser.add_argument("--delay", type=float, default=1.5, help="请求间隔秒数")
    args = parser.parse_args()

    ts = datetime.now().strftime("%Y%m%d_%H%M%S")
    crawler = ListenerCrawler(headless=not args.no_headless)

    try:
        print("=" * 60)
        print("懂片帝AI (dongpian1.com) 全站爬虫")
        print("=" * 60)

        if args.keyword:
            # 单关键词搜索
            print(f"[*] 搜索模式: '{args.keyword}'")
            crawler.goto(f"{BASE_URL}/", wait_ms=4000)
            crawler.dismiss_popups()
            crawler.search(args.keyword)
            crawler._extract_links_from_dom()
        elif args.demo:
            print("[*] 演示模式")
            crawler.crawl_homepage(scrolls=5)
            crawler.search("仙逆")
        else:
            # 全站模式
            crawler.crawl_homepage(scrolls=args.scrolls)
            crawler.crawl_categories()
            crawler.crawl_by_keywords(DEFAULT_KEYWORDS)

        print(f"\n[*] 影片发现完成，共 {len(crawler.all_movies)} 部")

        # 抓取详情
        if not args.no_details and crawler.all_movies:
            max_d = args.max_details if args.max_details > 0 else None
            print(f"\n[*] 开始获取影片详情...")
            crawler.fetch_all_details(delay=args.delay, max_items=max_d)

        # 保存数据
        print(f"\n{'='*60}")
        print("[✓] 抓取完成！")
        print(f"    影片总数: {len(crawler.all_movies)}")
        print(f"    详情数量: {len(crawler.all_details)}")
        print(f"    剧集数据: {sum(len(v) for v in crawler.all_episodes.values())} 集")
        print(f"{'='*60}\n")

        movies = list(crawler.all_movies.values())
        save_json(movies, f"movie_list_{ts}.json")
        save_movies_csv(movies, f"movie_list_{ts}.csv")

        if crawler.all_details:
            save_json(crawler.all_details, f"movie_details_{ts}.json")
            save_episodes_csv(crawler.all_episodes, crawler.all_details, f"episodes_{ts}.csv")

        print(f"\n[✓] 数据目录: {OUTPUT_DIR.absolute()}")

    except KeyboardInterrupt:
        print("\n[!] 用户中断，保存数据...")
        if crawler.all_movies:
            save_json(list(crawler.all_movies.values()), f"movie_list_backup_{ts}.json")
    finally:
        crawler.close()


if __name__ == "__main__":
    main()
