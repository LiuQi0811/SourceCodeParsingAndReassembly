#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
懂片帝AI - 浏览器内fetch注入式爬虫
===================================
本方案通过Playwright在浏览器页面内注入JS代码，直接使用网站已有的
签名机制调用内部API，无需逆向签名算法。

核心原理：
  网站使用 HMAC-SHA256 签名保护API，但浏览器内运行的fetch请求
  会被自动注入签名头。我们通过在页面上下文中执行 fetch() 函数，
  就能直接利用网站自身的签名逻辑完成认证。

用法：
  python dongpian_inject_crawler.py                  # 爬取全站(推荐)
  python dongpian_inject_crawler.py --keyword "仙逆"  # 搜索指定关键词
  python dongpian_inject_crawler.py --demo            # 演示模式（少量数据）
"""

import argparse
import csv
import json
import os
import re
import time
from datetime import datetime
from pathlib import Path

BASE_URL = "https://dongpian1.com"
OUTPUT_DIR = Path("dongpian_data")
OUTPUT_DIR.mkdir(exist_ok=True)


class InjectCrawler:
    """通过页面注入JS调用内部API的爬虫"""

    def __init__(self, headless=True):
        from playwright.sync_api import sync_playwright
        self.pw = sync_playwright().start()
        self.browser = self.pw.chromium.launch(
            headless=headless,
            args=["--no-sandbox", "--disable-blink-features=AutomationControlled"]
        )
        self.context = self.browser.new_context(
            viewport={"width": 1920, "height": 1080},
            locale="zh-CN",
            user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
                        "(KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36",
        )
        self.page = self.context.new_page()
        self.all_movies = {}  # av_id -> info
        self.all_details = {}
        self.all_episodes = {}

    def _page_fetch(self, url, method="GET", body=None, is_json=True):
        """在页面上下文中执行fetch，自动携带签名"""
        js_code = f"""
        async () => {{
            try {{
                const opts = {{ method: '{method}', headers: {{ 'accept': 'application/json' }} }};
                {f"opts.body = JSON.stringify({json.dumps(body)}); opts.headers['content-type'] = 'application/json';" if body else ""}
                const resp = await fetch({json.dumps(url)}, opts);
                const text = await resp.text();
                return {{ok: resp.ok, status: resp.status, data: text}};
            }} catch(e) {{
                return {{ok: false, error: e.message}};
            }}
        }}
        """
        try:
            result = self.page.evaluate(js_code)
            if result.get("ok") and is_json:
                return json.loads(result["data"])
            return result
        except Exception as e:
            return {"ok": False, "error": str(e)}

    def bootstrap(self):
        """访问首页初始化"""
        self.page.goto(f"{BASE_URL}/", wait_until="domcontentloaded", timeout=45000)
        # 等待核心JS加载完成
        self.page.wait_for_load_state("load", timeout=30000)
        time.sleep(4)
        print("[*] 页面加载完成")

    def get_suggest(self, q, limit=10):
        """获取搜索建议"""
        from urllib.parse import quote
        return self._page_fetch(f"/v1/suggest?q={quote(q)}&limit={limit}&mode=home")

    def create_thread(self, query):
        """创建搜索线程（AI会话）"""
        import uuid
        payload = {
            "title": query,
            "metadata": {
                "search_fields": "all",
                "search_scope_label": "综合",
                "search_mode": "fast",
                "source": "movie_composer_route",
                "submission_id": str(uuid.uuid4()),
            }
        }
        return self._page_fetch("/v1/threads", method="POST", body=payload)

    def browse_catalog(self, query, thread_id, page=1, limit=20, query_mode="fast_v3"):
        """获取目录搜索结果"""
        from urllib.parse import urlencode
        params = urlencode({
            "page": page, "limit": limit, "query_mode": query_mode,
            "thread_id": thread_id, "search_fields": "all", "q": query
        })
        return self._page_fetch(f"/v1/browse/catalog?{params}")

    def get_catalog_detail(self, av_id):
        """获取影片详情"""
        return self._page_fetch(f"/v1/catalog/{av_id}")

    def get_catalog_variants(self, av_id):
        """获取影片变体"""
        return self._page_fetch(f"/v1/catalog/{av_id}/variants")

    def get_episodes(self, av_id, limit=100, offset=0):
        """获取剧集列表"""
        return self._page_fetch(f"/v1/catalog/{av_id}/episodes?limit={limit}&offset={offset}")

    def search_and_collect(self, query, max_pages=3):
        """搜索并收集所有结果"""
        print(f"[*] 搜索: '{query}'")

        thread = self.create_thread(query)
        if not thread.get("ok", True) and "id" not in thread:
            # 线程创建可能已经返回数据
            if "error" in thread:
                print(f"  [!] 创建线程失败: {thread.get('error')}")
                return []
            thread_id = thread.get("id", "")
        else:
            thread_id = thread.get("id", "")

        if not thread_id:
            # 尝试直接从返回值提取
            if isinstance(thread, dict) and "data" in thread:
                print(f"  [响应] {str(thread.get('data',''))[:200]}")
            print(f"  [!] 未获取到thread_id，尝试直接解析首页数据")
            return self._extract_from_page()

        print(f"  线程ID: {thread_id[:30]}...")

        all_results = []
        for page in range(1, max_pages + 1):
            data = self.browse_catalog(query, thread_id, page=page)
            if not data or "error" in data:
                break

            items = self._extract_items(data)
            if not items:
                break
            all_results.extend(items)
            print(f"  第{page}页: {len(items)} 个结果 (累计{len(all_results)})")
            time.sleep(0.5)

        return all_results

    def _extract_items(self, data):
        """从API响应递归提取影片条目"""
        items = []

        def _walk(obj, depth=0):
            if depth > 8:
                return
            if isinstance(obj, dict):
                # 检测是否是影片对象
                vid = obj.get("variant_id", obj.get("id", ""))
                if isinstance(vid, str) and vid.startswith("av_"):
                    if vid not in self.all_movies:
                        info = {
                            "av_id": vid,
                            "title": obj.get("title", ""),
                            "year": obj.get("year", ""),
                            "genres": obj.get("genres", obj.get("tags", [])),
                            "areas": obj.get("areas", obj.get("regions", [])),
                            "language": obj.get("language", ""),
                            "overview": obj.get("overview", obj.get("description", "")),
                            "status": obj.get("status", obj.get("update_status", "")),
                            "episode_count": obj.get("episode_count", obj.get("total_episodes", 0)),
                            "rating": obj.get("rating", obj.get("score", "")),
                            "poster": obj.get("poster_url", obj.get("poster", obj.get("cover_url", ""))),
                            "content_type": obj.get("content_type", obj.get("type", "")),
                            "directors": obj.get("directors", []),
                            "actors": obj.get("actors", obj.get("cast", [])),
                            "url": f"{BASE_URL}/player/{vid}",
                        }
                        self.all_movies[vid] = info
                        items.append(info)
                    else:
                        items.append(self.all_movies[vid])
                for v in obj.values():
                    _walk(v, depth + 1)
            elif isinstance(obj, list):
                for item in obj:
                    _walk(item, depth + 1)

        _walk(data)
        return items

    def _extract_from_page(self):
        """从页面DOM提取影片链接"""
        links = self.page.eval_on_selector_all(
            'a[href*="/player/"]',
            """els => els.map(a => ({href:a.href, text:a.textContent.trim().substring(0,100)}))"""
        )
        items = []
        for link in links:
            m = re.search(r'/player/(av_[A-Za-z0-9_-]+)', link["href"])
            if m:
                vid = m.group(1)
                if vid not in self.all_movies:
                    info = {"av_id": vid, "title": link["text"].split("202")[0].strip(), "url": link["href"]}
                    self.all_movies[vid] = info
                    items.append(info)
        return items

    def fetch_details(self, movie_ids=None, delay=1.0):
        """批量获取影片详情"""
        if movie_ids is None:
            movie_ids = list(self.all_movies.keys())

        total = len(movie_ids)
        for idx, vid in enumerate(movie_ids):
            if vid in self.all_details:
                continue
            print(f"  [{idx+1}/{total}] 获取详情: {vid}", end="")

            try:
                # 获取详情
                detail = self.get_catalog_detail(vid)
                variants = self.get_catalog_variants(vid)

                info = dict(self.all_movies.get(vid, {"av_id": vid}))

                if isinstance(detail, dict) and "error" not in detail:
                    info.update(self._flatten(detail))

                if isinstance(variants, dict) and "error" not in variants:
                    info["variants"] = variants

                # 获取剧集
                episodes_data = self.get_episodes(vid, limit=200)
                episodes = []
                if isinstance(episodes_data, dict) and "error" not in episodes_data:
                    episodes = self._parse_episodes(episodes_data)
                info["episodes"] = episodes
                self.all_episodes[vid] = episodes

                self.all_details[vid] = info
                title = info.get("title", "未知")
                ep_count = len(episodes)
                print(f" → {title} ({ep_count}集)")

            except Exception as e:
                print(f" → 失败: {e}")

            time.sleep(delay)

    @staticmethod
    def _flatten(data):
        field_map = {
            "title": "title", "original_title": "original_title",
            "year": "year", "release_date": "release_date",
            "genres": "genres", "tags": "genres",
            "areas": "areas", "regions": "areas",
            "language": "language",
            "overview": "overview", "description": "overview",
            "status": "status", "update_status": "status",
            "episode_count": "episode_count", "total_episodes": "episode_count",
            "current_episode": "current_episode",
            "rating": "rating", "score": "rating", "douban_rating": "rating",
            "poster_url": "poster", "poster": "poster", "cover_url": "poster", "cover": "poster",
            "backdrop_url": "backdrop", "banner_url": "banner",
            "directors": "directors", "actors": "actors", "cast": "actors",
            "duration": "duration", "content_type": "content_type",
            "quality": "quality", "alias": "alias", "aliases": "alias",
        }
        result = {}
        for src, dst in field_map.items():
            if src in data and data[src] not in (None, "", [], 0):
                if dst not in result or not result[dst]:
                    result[dst] = data[src]
        return result

    @staticmethod
    def _parse_episodes(data):
        episodes = []
        items = data.get("episodes", data.get("items", data.get("data", [])))
        if isinstance(items, dict):
            items = items.get("episodes", items.get("items", []))
        for ep in items if isinstance(items, list) else []:
            if isinstance(ep, dict):
                episodes.append({
                    "episode_id": ep.get("id", ep.get("episode_id", "")),
                    "title": ep.get("title", ep.get("name", "")),
                    "number": ep.get("index", ep.get("episode_number", ep.get("number", 0))),
                    "duration": ep.get("duration", 0),
                    "thumbnail": ep.get("thumbnail", ep.get("still_url", "")),
                })
        return episodes

    def crawl_homepage_recommendations(self):
        """从首页提取推荐内容的所有链接"""
        self.page.goto(f"{BASE_URL}/", wait_until="domcontentloaded", timeout=45000)
        self.page.wait_for_load_state("load", timeout=30000)
        time.sleep(4)

        # 滚动加载更多
        for i in range(15):
            self.page.evaluate("window.scrollBy(0, 1000)")
            time.sleep(1)
            try:
                load_more = self.page.get_by_text("继续下滑加载更多")
                if load_more.is_visible(timeout=500):
                    load_more.click()
                    time.sleep(1.5)
            except Exception:
                pass

        # 提取所有影片链接
        items = self._extract_from_page()
        print(f"[*] 首页推荐共发现 {len(items)} 部影片")
        return items

    def close(self):
        try:
            self.browser.close()
            self.pw.stop()
        except Exception:
            pass


def save_json(data, path):
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    print(f"[✓] 已保存: {path}")


def save_movies_csv(movies, path):
    fields = ["av_id", "title", "year", "genres", "areas", "status", "episode_count", "rating", "content_type", "url"]
    with open(path, "w", encoding="utf-8-sig", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=fields, extrasaction="ignore")
        writer.writeheader()
        for m in movies:
            row = dict(m)
            for k in ("genres", "areas", "directors", "actors"):
                if isinstance(row.get(k), list):
                    row[k] = ", ".join(str(x) for x in row[k] if x)
            writer.writerow(row)
    print(f"[✓] 已保存: {path}")


def save_episodes_csv(all_details, path):
    fields = ["av_id", "movie_title", "episode_id", "title", "number", "duration"]
    with open(path, "w", encoding="utf-8-sig", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=fields, extrasaction="ignore")
        writer.writeheader()
        for vid, detail in all_details.items():
            mtitle = detail.get("title", vid)
            for ep in detail.get("episodes", []):
                writer.writerow({
                    "av_id": vid, "movie_title": mtitle,
                    "episode_id": ep.get("episode_id", ""),
                    "title": ep.get("title", ""),
                    "number": ep.get("number", ""),
                    "duration": ep.get("duration", ""),
                })
    print(f"[✓] 已保存: {path}")


def main():
    parser = argparse.ArgumentParser(description="懂片帝AI 注入式全站爬虫")
    parser.add_argument("--keyword", "-k", type=str, default="", help="搜索关键词")
    parser.add_argument("--demo", action="store_true", help="演示模式（少量数据）")
    parser.add_argument("--no-headless", action="store_true", help="显示浏览器")
    parser.add_argument("--no-details", action="store_true", help="不获取详情")
    parser.add_argument("--pages", type=int, default=3, help="搜索结果页数")
    args = parser.parse_args()

    # 扩展关键词列表用于全站抓取
    SEARCH_KEYWORDS = [
        "剧", "短剧", "动漫", "电影", "综艺",
        "韩剧", "美剧", "日剧", "泰剧",
        "2026", "2025", "2024", "2023",
        "动作", "喜剧", "爱情", "科幻", "悬疑", "恐怖", "战争", "古装", "都市",
        "仙侠", "修仙", "穿越", "重生", "复仇", "总裁",
    ]

    crawler = InjectCrawler(headless=not args.no_headless)
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")

    try:
        crawler.bootstrap()

        if args.keyword:
            # 单关键词搜索
            crawler.search_and_collect(args.keyword, max_pages=args.pages)
        elif args.demo:
            # 演示模式：只抓首页
            crawler.crawl_homepage_recommendations()
        else:
            # 全站模式：首页 + 多关键词搜索
            print("=" * 60)
            print("懂片帝AI 全站爬虫启动")
            print("=" * 60)
            crawler.crawl_homepage_recommendations()

            for kw in SEARCH_KEYWORDS:
                try:
                    crawler.search_and_collect(kw, max_pages=args.pages)
                    print(f"  累计 {len(crawler.all_movies)} 部影片")
                    time.sleep(0.5)
                except Exception as e:
                    print(f"  [!] 关键词 '{kw}' 失败: {e}")

        # 获取详情
        if not args.no_details and crawler.all_movies:
            print(f"\n[*] 开始获取 {len(crawler.all_movies)} 部影片详情...")
            crawler.fetch_details(delay=0.8)

        # 保存数据
        print(f"\n{'='*60}")
        print(f"[✓] 抓取完成！影片总数: {len(crawler.all_movies)}, 详情数: {len(crawler.all_details)}")

        movie_list = list(crawler.all_movies.values())
        save_json(movie_list, OUTPUT_DIR / f"movie_list_{timestamp}.json")
        save_movies_csv(movie_list, OUTPUT_DIR / f"movie_list_{timestamp}.csv")

        if crawler.all_details:
            save_json(crawler.all_details, OUTPUT_DIR / f"movie_details_{timestamp}.json")
            save_episodes_csv(crawler.all_details, OUTPUT_DIR / f"episodes_{timestamp}.csv")

        print(f"[✓] 数据目录: {OUTPUT_DIR.absolute()}")

    except KeyboardInterrupt:
        print("\n[!] 用户中断，保存已有数据...")
        if crawler.all_movies:
            save_json(list(crawler.all_movies.values()), OUTPUT_DIR / f"movie_list_backup_{timestamp}.json")
    finally:
        crawler.close()


if __name__ == "__main__":
    main()
