#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
懂片帝API版爬虫 - 在浏览器上下文内直接调用内部API
自动处理签名认证，抓取效率更高
"""

import asyncio
import json
from pathlib import Path
from datetime import datetime
from playwright.async_api import async_playwright


class DongpianAPICrawler:
    """API版爬虫 - 通过浏览器环境调用内部接口"""
    
    BASE_URL = "https://dongpian1.com"
    
    def __init__(self, output_dir="dongpian_api_data"):
        self.output_dir = Path(output_dir)
        self.output_dir.mkdir(parents=True, exist_ok=True)
        self.browser = None
        self.page = None
        
    async def init(self):
        """初始化浏览器并注入抓取脚本"""
        playwright = await async_playwright().start()
        self.browser = await playwright.chromium.launch(headless=True)
        self.context = await self.browser.new_context(
            user_agent="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
        )
        self.page = await self.context.new_page()
        await self.page.goto(self.BASE_URL)
        await self.page.wait_for_load_state("networkidle")
        print("[✓] 浏览器初始化完成，页面加载成功")
    
    async def fetch_api(self, path, params=None):
        """在页面上下文内发起API请求，自动带上签名"""
        result = await self.page.evaluate("""
            async (path, params) => {
                const url = new URL(path, window.location.origin);
                if (params) {
                    Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
                }
                try {
                    const resp = await fetch(url.toString(), {
                        credentials: 'include',
                        headers: {
                            'Accept': 'application/json'
                        }
                    });
                    return await resp.json();
                } catch(e) {
                    return {error: e.message};
                }
            }
        """, path, params)
        return result
    
    async def crawl_catalog(self, kind, sort="trending", window="week", max_pages=10):
        """抓取分类目录"""
        all_items = []
        
        for page in range(1, max_pages + 1):
            print(f"  抓取 {kind} 第 {page} 页...")
            data = await self.fetch_api("/v1/browse/catalog", {
                "sort": sort,
                "window": window,
                "kind": kind,
                "page": page,
                "limit": 24
            })
            
            if data.get("error"):
                print(f"    错误: {data['error']}")
                break
            
            items = data.get("items") or data.get("data") or data.get("results") or []
            if not items:
                print(f"    无更多数据")
                break
                
            all_items.extend(items)
            print(f"    获取 {len(items)} 条")
            
            # 检查是否有下一页
            if not data.get("has_more") and len(items) < 24:
                break
            
            await asyncio.sleep(0.5)
        
        return all_items
    
    async def crawl_home_feed(self):
        """抓取首页Feed"""
        print("\n[1] 抓取首页Feed...")
        data = await self.fetch_api("/v1/feed/home", {
            "scope": "public",
            "mode": "page",
            "sections": 10,
            "cards": 24
        })
        return data
    
    async def crawl_all(self):
        """执行全部抓取"""
        print(f"\n{'='*60}")
        print(f"懂片帝API版爬虫启动")
        print(f"时间: {datetime.now().isoformat()}")
        print(f"{'='*60}\n")
        
        await self.init()
        
        result = {
            "crawl_time": datetime.now().isoformat(),
            "site": self.BASE_URL,
            "home": await self.crawl_home_feed(),
            "catalogs": {}
        }
        
        # 抓取所有分类
        kinds = ["movie", "series", "variety", "anime", "shortdrama"]
        for kind in kinds:
            print(f"\n[2] 抓取分类: {kind}")
            items = await self.crawl_catalog(kind, max_pages=20)
            result["catalogs"][kind] = items
            print(f"  ✓ {kind} 共获取 {len(items)} 条")
        
        # 抓取推荐
        print(f"\n[3] 抓取推荐...")
        suggest = await self.fetch_api("/v1/suggest", {
            "q": "",
            "limit": 50,
            "mode": "home",
            "scope": "public"
        })
        result["suggestions"] = suggest
        
        # 保存
        output_file = self.output_dir / "full_data.json"
        with open(output_file, "w", encoding="utf-8") as f:
            json.dump(result, f, ensure_ascii=False, indent=2)
        
        # 生成统计
        total = sum(len(v) for v in result["catalogs"].values())
        print(f"\n{'='*60}")
        print(f"抓取完成!")
        print(f"分类总影片数: {total}")
        for k, v in result["catalogs"].items():
            print(f"  - {k}: {len(v)} 部")
        print(f"数据保存至: {output_file.absolute()}")
        print(f"{'='*60}")
        
        await self.browser.close()


if __name__ == "__main__":
    crawler = DongpianAPICrawler()
    asyncio.run(crawler.crawl_all())
