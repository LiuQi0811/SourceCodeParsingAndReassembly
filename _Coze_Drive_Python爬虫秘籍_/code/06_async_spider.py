# -*- coding: utf-8 -*-
"""异步爬虫：asyncio + httpx 并发抓取 10 页数据，比逐页快得多。

pip install httpx
python 06_async_spider.py
"""
import asyncio
import time

import httpx

URLS = [f"https://quotes.toscrape.com/page/{i}/" for i in range(1, 11)]

async def fetch(client: httpx.AsyncClient, url: str) -> str:
    resp = await client.get(url)
    resp.raise_for_status()
    return resp.text

async def main():
    start = time.perf_counter()

    async with httpx.AsyncClient(
        headers={"User-Agent": "Mozilla/5.0 (compatible; AsyncDemo/1.0)"},
        timeout=15,
        follow_redirects=True,
        limits=httpx.Limits(max_connections=5),  # 控制并发数，做有礼貌的爬虫
    ) as client:
        pages = await asyncio.gather(*(fetch(client, url) for url in URLS))

    total_quotes = sum(page.count('class="quote"') for page in pages)
    print(f"抓取 {len(URLS)} 页，共 {total_quotes} 条名言")
    print(f"耗时 {time.perf_counter() - start:.2f} 秒（同步逐页约需 2~3 秒以上）")

if __name__ == "__main__":
    asyncio.run(main())
