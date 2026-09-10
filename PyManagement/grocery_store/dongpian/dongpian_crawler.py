#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
懂片帝AI (dongpian1.com) 全站爬虫
基于 Playwright 浏览器自动化，无需逆向API签名
支持抓取影片信息、分类列表、详情页数据、集数信息等
"""

import asyncio
import json
import os
import time
from pathlib import Path
from urllib.parse import urljoin, urlparse
from datetime import datetime
from typing import Set, Dict, List, Optional, Any

from playwright.async_api import async_playwright, Page, Browser, BrowserContext


class DongpianCrawler:
    """懂片帝全站爬虫"""
    
    BASE_URL = "https://dongpian1.com"
    
    # 影片分类
    CATEGORIES = {
        "movie": "电影",
        "series": "电视剧", 
        "variety": "综艺",
        "anime": "动漫",
        "shortdrama": "短剧"
    }
    
    # 排序方式
    SORTS = ["trending", "newest", "rating"]
    
    def __init__(self, headless: bool = True, delay: float = 1.5, output_dir: str = "dongpian_data"):
        """
        初始化爬虫
        :param headless: 是否无头模式运行
        :param delay: 请求间隔(秒)
        :param output_dir: 数据输出目录
        """
        self.headless = headless
        self.delay = delay
        self.output_dir = Path(output_dir)
        self.output_dir.mkdir(parents=True, exist_ok=True)
        
        # 图片保存目录
        self.images_dir = self.output_dir / "images"
        self.images_dir.mkdir(exist_ok=True)
        
        # 已访问URL集合
        self.visited_urls: Set[str] = set()
        self.visited_movie_ids: Set[str] = set()
        
        # 数据存储
        self.all_movies: List[Dict] = []
        self.all_playlists: List[Dict] = []
        self.categories_data: Dict[str, List] = {k: [] for k in self.CATEGORIES}
        
        # 统计信息
        self.stats = {
            "start_time": None,
            "end_time": None,
            "movies_crawled": 0,
            "pages_crawled": 0,
            "errors": 0
        }
        
        self.browser: Optional[Browser] = None
        self.context: Optional[BrowserContext] = None
        self.page: Optional[Page] = None
    
    async def init_browser(self):
        """初始化浏览器"""
        playwright = await async_playwright().start()
        self.browser = await playwright.chromium.launch(
            headless=self.headless,
            args=[
                '--no-sandbox',
                '--disable-dev-shm-usage',
                '--disable-blink-features=AutomationControlled',
            ]
        )
        
        self.context = await self.browser.new_context(
            user_agent="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            viewport={"width": 1920, "height": 1080},
            locale="zh-CN",
            timezone_id="Asia/Shanghai"
        )
        
        # 反检测
        await self.context.add_init_script("""
            Object.defineProperty(navigator, 'webdriver', {get: () => undefined});
            window.chrome = {runtime: {}};
        """)
        
        self.page = await self.context.new_page()
        
        # 拦截不必要的资源，加速加载
        await self.context.route("**/*.{png,jpg,jpeg,gif,svg,woff,woff2}", lambda route: route.continue_())
        
        print(f"[✓] 浏览器初始化完成")
    
    async def close(self):
        """关闭浏览器"""
        if self.browser:
            await self.browser.close()
        print(f"[✓] 浏览器已关闭")
    
    async def wait_for_page_load(self, timeout: int = 15000):
        """等待页面加载稳定"""
        try:
            await self.page.wait_for_load_state("networkidle", timeout=timeout)
        except:
            pass
        await asyncio.sleep(self.delay)
    
    async def scroll_to_load_all(self, max_scrolls: int = 30):
        """滚动页面加载所有内容"""
        print(f"  → 滚动加载中...", end="", flush=True)
        last_height = 0
        
        for i in range(max_scrolls):
            await self.page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
            await asyncio.sleep(1.5)
            
            new_height = await self.page.evaluate("document.body.scrollHeight")
            print(f".", end="", flush=True)
            
            if new_height == last_height:
                # 检查是否有"查看更多"按钮
                view_more = await self.page.query_selector("button:has-text('查看更多'), button:has-text('加载更多')")
                if view_more:
                    try:
                        await view_more.click()
                        await asyncio.sleep(2)
                        continue
                    except:
                        break
                else:
                    break
            
            last_height = new_height
        
        print(f" 完成")
    
    async def extract_current_page_movies(self) -> List[Dict]:
        """从当前页面提取影片列表"""
        movies = await self.page.evaluate("""
            () => {
                const results = [];
                const seen = new Set();
                
                // 查找所有影片卡片
                const articles = document.querySelectorAll('article');
                articles.forEach(article => {
                    try {
                        const titleEl = article.querySelector('h2, h3');
                        if (!titleEl) return;
                        
                        const title = titleEl.textContent.trim();
                        if (!title || seen.has(title)) return;
                        seen.add(title);
                        
                        // 获取链接
                        const link = article.querySelector('a[href*="/play"], a[href*="/movie"], a[href*="/detail"], a[href*="watch"]');
                        const href = link ? link.href : '';
                        
                        // 获取图片
                        const img = article.querySelector('img');
                        const poster = img ? (img.src || img.dataset.src || '') : '';
                        
                        // 获取元信息
                        const text = article.textContent;
                        const metaMatch = text.match(/(\\d{4})\\s*\\/\\s*([^\\/]+)\\s*\\/\\s*([^\\/·]+)/);
                        
                        // 获取集数信息
                        const epMatch = text.match(/更新至(\\d+)集|全(\\d+)集|HD|高清|BD/);
                        
                        results.push({
                            title: title,
                            url: href,
                            poster: poster,
                            year: metaMatch ? metaMatch[1] : '',
                            area: metaMatch ? metaMatch[2].trim() : '',
                            genres: metaMatch ? metaMatch[3].trim().split('·').map(g => g.trim()) : [],
                            episode_info: epMatch ? epMatch[0] : '',
                            extracted_at: new Date().toISOString()
                        });
                    } catch(e) {}
                });
                
                return results;
            }
        """)
        
        return movies
    
    async def crawl_home_page(self):
        """抓取首页"""
        print(f"\n{'='*60}")
        print(f"[1/4] 开始抓取首页...")
        print(f"{'='*60}")
        
        await self.page.goto(self.BASE_URL, wait_until="domcontentloaded")
        await self.wait_for_page_load()
        
        # 滚动加载首页所有内容
        await self.scroll_to_load_all(max_scrolls=20)
        
        # 提取首页推荐内容
        home_movies = await self.extract_current_page_movies()
        print(f"  → 首页提取到 {len(home_movies)} 部推荐影片")
        
        self.all_movies.extend(home_movies)
        
        # 保存首页数据
        self.save_json(home_movies, "home_recommendations.json")
        
        self.stats["pages_crawled"] += 1
        return home_movies
    
    async def crawl_category(self, category_key: str, category_name: str, max_pages: int = 10):
        """
        抓取某个分类
        :param category_key: 分类key
        :param category_name: 分类名称
        :param max_pages: 最大页数
        """
        print(f"\n{'='*60}")
        print(f"[2/4] 抓取分类: {category_name} ({category_key})")
        print(f"{'='*60}")
        
        all_category_movies = []
        
        for page_num in range(1, max_pages + 1):
            print(f"\n  → 第 {page_num} 页...")
            
            # 尝试访问分类页
            try:
                # 方法1: 通过导航点击
                if page_num == 1:
                    # 找到对应分类标签点击
                    await self.page.goto(self.BASE_URL, wait_until="domcontentloaded")
                    await self.wait_for_page_load()
                    
                    # 点击对应分类
                    category_tab = await self.page.query_selector(f"text='{category_name}'")
                    if category_tab:
                        await category_tab.click()
                        await asyncio.sleep(2)
                        await self.wait_for_page_load()
                
                # 滚动加载当前页
                await self.scroll_to_load_all(max_scrolls=10)
                
                # 提取影片
                movies = await self.extract_current_page_movies()
                
                if not movies:
                    print(f"    未找到更多影片，停止翻页")
                    break
                
                new_count = 0
                for m in movies:
                    m["category"] = category_key
                    if m["title"] not in self.visited_movie_ids:
                        self.visited_movie_ids.add(m["title"])
                        all_category_movies.append(m)
                        new_count += 1
                
                print(f"    本页提取到 {len(movies)} 部，新增 {new_count} 部")
                
                if new_count == 0 and page_num > 1:
                    print(f"    无新内容，停止翻页")
                    break
                
                # 尝试点击下一页或继续滚动
                next_btn = await self.page.query_selector("button:has-text('下一页'), button[aria-label*='下一页']")
                if next_btn:
                    try:
                        await next_btn.click()
                        await asyncio.sleep(2)
                    except:
                        break
                else:
                    # 没有下一页按钮，尝试继续滚动
                    pass
                
                self.stats["pages_crawled"] += 1
                await asyncio.sleep(self.delay)
                
            except Exception as e:
                print(f"    抓取出错: {e}")
                self.stats["errors"] += 1
                break
        
        print(f"\n  ✓ {category_name} 分类共抓取 {len(all_category_movies)} 部影片")
        self.categories_data[category_key] = all_category_movies
        self.all_movies.extend(all_category_movies)
        
        # 保存分类数据
        self.save_json(all_category_movies, f"category_{category_key}.json")
        
        return all_category_movies
    
    async def crawl_movie_detail(self, movie_url: str) -> Optional[Dict]:
        """
        抓取影片详情页
        :param movie_url: 影片URL
        """
        if movie_url in self.visited_urls:
            return None
        
        self.visited_urls.add(movie_url)
        
        try:
            await self.page.goto(movie_url, wait_until="domcontentloaded")
            await self.wait_for_page_load(timeout=10000)
            
            # 提取详情信息
            detail = await self.page.evaluate("""
                () => {
                    const result = {
                        title: '',
                        original_title: '',
                        year: '',
                        area: '',
                        genres: [],
                        rating: '',
                        description: '',
                        director: '',
                        actors: [],
                        total_episodes: 0,
                        episodes: [],
                        poster: '',
                        backdrop: '',
                        url: window.location.href
                    };
                    
                    // 标题
                    const h1 = document.querySelector('h1');
                    if (h1) result.title = h1.textContent.trim();
                    
                    // 评分
                    const ratingEl = document.querySelector('[class*="rating"], [class*="score"]');
                    if (ratingEl) result.rating = ratingEl.textContent.trim();
                    
                    // 简介
                    const descEl = document.querySelector('[class*="desc"], [class*="summary"], [class*="intro"]');
                    if (descEl) result.description = descEl.textContent.trim();
                    
                    // 海报
                    const posterImg = document.querySelector('img[alt*="海报"], img[class*="poster"]');
                    if (posterImg) result.poster = posterImg.src || '';
                    
                    // 背景图
                    const backdropEl = document.querySelector('[class*="backdrop"], [class*="bg"]');
                    if (backdropEl) {
                        const bg = getComputedStyle(backdropEl).backgroundImage;
                        const match = bg.match(/url\\(["']?([^"')]+)["']?\\)/);
                        if (match) result.backdrop = match[1];
                    }
                    
                    // 元信息区域
                    const metaText = document.body.textContent;
                    
                    const yearMatch = metaText.match(/(\\d{4})/);
                    if (yearMatch) result.year = yearMatch[1];
                    
                    // 导演演员
                    const directorMatch = metaText.match(/导演[:：]\\s*([^\\n]+)/);
                    if (directorMatch) result.director = directorMatch[1].trim();
                    
                    const actorsMatch = metaText.match(/主演[:：]\\s*([^\\n]+)/);
                    if (actorsMatch) {
                        result.actors = actorsMatch[1].split(/[、,，]/).map(a => a.trim()).filter(a => a);
                    }
                    
                    // 集数列表
                    const epButtons = document.querySelectorAll('button[class*="episode"], a[class*="episode"], [class*="ep-list"] button, [class*="ep-list"] a');
                    epButtons.forEach(ep => {
                        const epText = ep.textContent.trim();
                        if (epText.match(/^\\d+$/)) {
                            result.episodes.push({
                                number: parseInt(epText),
                                text: epText,
                                element: ep.textContent
                            });
                        }
                    });
                    result.total_episodes = result.episodes.length;
                    
                    // 去重
                    result.episodes = result.episodes.filter((ep, i, arr) => 
                        arr.findIndex(e => e.number === ep.number) === i
                    );
                    
                    return result;
                }
            """)
            
            self.stats["movies_crawled"] += 1
            print(f"    ✓ 已抓取: {detail.get('title', '未知')} ({detail.get('total_episodes', 0)}集)")
            
            return detail
            
        except Exception as e:
            print(f"    ✗ 详情页抓取失败: {e}")
            self.stats["errors"] += 1
            return None
    
    async def crawl_search(self, keyword: str) -> List[Dict]:
        """
        搜索并抓取结果
        :param keyword: 搜索关键词
        """
        print(f"\n  → 搜索: {keyword}")
        
        try:
            # 找到搜索框
            await self.page.goto(self.BASE_URL)
            await self.wait_for_page_load()
            
            search_input = await self.page.query_selector('input[placeholder*="搜索"], input[type="search"]')
            if search_input:
                await search_input.fill(keyword)
                await asyncio.sleep(0.5)
                await search_input.press("Enter")
                await self.wait_for_page_load()
                
                await self.scroll_to_load_all(max_scrolls=5)
                
                results = await self.extract_current_page_movies()
                print(f"    搜索到 {len(results)} 个结果")
                return results
        except Exception as e:
            print(f"    搜索出错: {e}")
        
        return []
    
    async def crawl_all(self, crawl_details: bool = False, max_detail_crawl: int = 50):
        """
        执行全站抓取
        :param crawl_details: 是否抓取详情页
        :param max_detail_crawl: 最大详情页抓取数量
        """
        self.stats["start_time"] = datetime.now().isoformat()
        
        print(f"\n{'#'*60}")
        print(f"# 懂片帝AI (dongpian1.com) 全站爬虫启动")
        print(f"# 启动时间: {self.stats['start_time']}")
        print(f"{'#'*60}")
        
        await self.init_browser()
        
        try:
            # 1. 抓取首页
            await self.crawl_home_page()
            
            # 2. 抓取各分类
            for cat_key, cat_name in self.CATEGORIES.items():
                await self.crawl_category(cat_key, cat_name, max_pages=5)
            
            # 3. 去重
            unique_movies = {}
            for m in self.all_movies:
                if m["title"] and m["title"] not in unique_movies:
                    unique_movies[m["title"]] = m
            self.all_movies = list(unique_movies.values())
            
            print(f"\n{'='*60}")
            print(f"[3/4] 列表抓取完成，共获取 {len(self.all_movies)} 部影片")
            print(f"{'='*60}")
            
            # 4. 抓取详情页（可选）
            if crawl_details and self.all_movies:
                print(f"\n{'='*60}")
                print(f"[4/4] 开始抓取详情页 (最多 {max_detail_crawl} 部)...")
                print(f"{'='*60}")
                
                detail_results = []
                for i, movie in enumerate(self.all_movies[:max_detail_crawl]):
                    if movie.get("url") and self.BASE_URL in movie.get("url", ""):
                        print(f"  ({i+1}/{min(max_detail_crawl, len(self.all_movies))})", end="")
                        detail = await self.crawl_movie_detail(movie["url"])
                        if detail:
                            detail_results.append(detail)
                            # 每抓10部保存一次
                            if len(detail_results) % 10 == 0:
                                self.save_json(detail_results, "movie_details.json")
                        await asyncio.sleep(self.delay)
                
                # 保存最终详情数据
                self.save_json(detail_results, "movie_details.json")
                print(f"\n  ✓ 详情页抓取完成，共 {len(detail_results)} 部")
            
            # 保存全部影片列表
            self.save_json(self.all_movies, "all_movies.json")
            
            # 生成索引
            self.generate_index()
            
        finally:
            self.stats["end_time"] = datetime.now().isoformat()
            self.save_json(self.stats, "crawl_stats.json")
            
            await self.close()
            
            print(f"\n{'#'*60}")
            print(f"# 抓取完成!")
            print(f"# 总影片数: {len(self.all_movies)}")
            print(f"# 抓取页数: {self.stats['pages_crawled']}")
            print(f"# 错误数: {self.stats['errors']}")
            print(f"# 数据保存至: {self.output_dir.absolute()}")
            print(f"{'#'*60}")
    
    def save_json(self, data: Any, filename: str):
        """保存JSON数据"""
        filepath = self.output_dir / filename
        with open(filepath, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        # print(f"  → 已保存: {filename}")
    
    def generate_index(self):
        """生成索引文件"""
        index = {
            "site": "懂片帝AI",
            "base_url": self.BASE_URL,
            "crawl_time": datetime.now().isoformat(),
            "total_movies": len(self.all_movies),
            "categories": {},
            "files": {
                "all_movies": "all_movies.json",
                "home_recommendations": "home_recommendations.json",
                "movie_details": "movie_details.json",
                "stats": "crawl_stats.json"
            }
        }
        
        for cat_key, cat_name in self.CATEGORIES.items():
            index["categories"][cat_key] = {
                "name": cat_name,
                "count": len(self.categories_data[cat_key]),
                "file": f"category_{cat_key}.json"
            }
        
        self.save_json(index, "index.json")
        
        # 同时生成CSV格式方便查看
        try:
            import csv
            csv_path = self.output_dir / "all_movies.csv"
            with open(csv_path, "w", encoding="utf-8-sig", newline="") as f:
                writer = csv.DictWriter(f, fieldnames=[
                    "title", "year", "area", "episode_info", "category", "url", "poster"
                ])
                writer.writeheader()
                for movie in self.all_movies:
                    writer.writerow({k: movie.get(k, "") for k in writer.fieldnames})
            print(f"  → 已生成CSV索引: all_movies.csv")
        except Exception as e:
            print(f"  → CSV生成失败: {e}")


async def main():
    """主函数"""
    import argparse
    
    parser = argparse.ArgumentParser(description="懂片帝AI全站爬虫")
    parser.add_argument("--headless", action="store_true", default=True, help="无头模式")
    parser.add_argument("--no-headless", action="store_true", help="显示浏览器窗口")
    parser.add_argument("--delay", type=float, default=1.5, help="请求间隔(秒)")
    parser.add_argument("--output", type=str, default="dongpian_data", help="输出目录")
    parser.add_argument("--details", action="store_true", help="是否抓取详情页")
    parser.add_argument("--max-details", type=int, default=50, help="最大详情页抓取数量")
    
    args = parser.parse_args()
    
    crawler = DongpianCrawler(
        headless=not args.no_headless,
        delay=args.delay,
        output_dir=args.output
    )
    
    await crawler.crawl_all(
        crawl_details=args.details,
        max_detail_crawl=args.max_details
    )


if __name__ == "__main__":
    asyncio.run(main())
