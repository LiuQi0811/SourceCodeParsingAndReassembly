import asyncio
import aiohttp
from concurrent.futures import ThreadPoolExecutor
from bs4 import BeautifulSoup
from urllib.parse import urljoin, urlparse
from typing import Set, List, Optional
import os
import warnings
from charset_normalizer import from_bytes

warnings.filterwarnings("ignore")


class HttpClient:
    """修复后的HTTP客户端，不再搞错误的单例混淆"""
    def __init__(self):
        self.session: Optional[aiohttp.ClientSession] = None
        self.headers = {
            "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36",
            "Referer": "https://www.169tp.com/"
        }

    async def start(self):
        if self.session is None or self.session.closed:
            self.session = aiohttp.ClientSession(
                headers=self.headers,
                timeout=aiohttp.ClientTimeout(total=15)
            )

    async def stop(self):
        if self.session and not self.session.closed:
            await self.session.close()

    async def fetch_bytes(self, url: str) -> Optional[bytes]:
        await self.start()
        try:
            async with self.session.get(url) as resp:
                if resp.status != 200:
                    print(f"[fetch] status={resp.status} {url}")
                    return None
                return await resp.read()
        except Exception as e:
            print(f"请求异常 {url}: {e}")
            return None


class SitemapSiteCrawler:
    def __init__(self, root_url: str, max_fetch_pages: int = 200, concurrency: int = 2, delay: float = 1.2):
        self.root_url = root_url
        self.sitemap_index_url = urljoin(root_url, "/sitemap/sitemap_index.xml")
        self.max_fetch_pages = max_fetch_pages
        self.concurrency = concurrency
        self.delay = delay

        self.http = HttpClient()
        self.thread_pool = ThreadPoolExecutor(max_workers=4)

        self.sitemap_urls: List[str] = []
        self.all_page_urls: List[str] = []
        self.visited: Set[str] = set()
        self.all_img_urls: Set[str] = set()

    async def parse_sitemap_index(self):
        raw = await self.http.fetch_bytes(self.sitemap_index_url)
        if raw is None:
            print("sitemap_index.xml 获取失败")
            return
        soup = BeautifulSoup(raw, features="xml")
        for sitemap in soup.find_all("sitemap"):
            loc_node = sitemap.find("loc")
            if loc_node:
                self.sitemap_urls.append(loc_node.text.strip())
        print(f"解析到子 sitemap 数量：{len(self.sitemap_urls)}")

    async def parse_sub_sitemaps(self):
        for sm_url in self.sitemap_urls:
            raw = await self.http.fetch_bytes(sm_url)
            if not raw:
                continue
            soup = BeautifulSoup(raw, features="xml")
            for url_node in soup.find_all("url"):
                loc_node = url_node.find("loc")
                if loc_node:
                    page_url = loc_node.text.strip()
                    self.all_page_urls.append(page_url)
            await asyncio.sleep(0.3)
        # 去重
        self.all_page_urls = list(dict.fromkeys(self.all_page_urls))
        print(f"从sitemap拿到全部页面总数：{len(self.all_page_urls)}")
        self.all_page_urls = self.all_page_urls[:self.max_fetch_pages]
        print(f"实际将要抓取页面数量(截断后): {len(self.all_page_urls)}")

    async def process_one_page(self, page_url: str):
        if page_url in self.visited:
            return
        self.visited.add(page_url)
        print(f"[PAGE] {len(self.visited)}/{len(self.all_page_urls)} -> {page_url}")
        raw_bytes = await self.http.fetch_bytes(page_url)
        if raw_bytes is None:
            return

        result = from_bytes(raw_bytes).best()
        if result:
            html = str(result)
        else:
            try:
                html = raw_bytes.decode("gbk")
            except Exception:
                html = raw_bytes.decode("utf-8", errors="replace")

        def _extract(html_text):
            soup = BeautifulSoup(html_text, "lxml")
            imgs = set()
            for img_tag in soup.find_all("img"):
                src = img_tag.get("src")
                ds = img_tag.get("data-src")
                if src:
                    imgs.add(urljoin(page_url, src.strip()))
                if ds:
                    imgs.add(urljoin(page_url, ds.strip()))
            return imgs

        img_set = await asyncio.get_running_loop().run_in_executor(self.thread_pool, _extract, html)
        self.all_img_urls.update(img_set)
        await asyncio.sleep(self.delay)

    async def worker(self, queue: asyncio.Queue[str]):
        while True:
            try:
                url = queue.get_nowait()
            except asyncio.QueueEmpty:
                break
            await self.process_one_page(url)
            queue.task_done()

    async def run(self):
        await self.parse_sitemap_index()
        await self.parse_sub_sitemaps()
        q = asyncio.Queue()
        for u in self.all_page_urls:
            await q.put(u)
        workers = [asyncio.create_task(self.worker(q)) for _ in range(self.concurrency)]
        await asyncio.gather(*workers)

    def export_images(self, path="./img_sitemap.txt"):
        with open(path, "w", encoding="utf-8") as f:
            for item in sorted(self.all_img_urls):
                f.write(item + "\n")
        print(f"图片链接导出完成：{path}，共{len(self.all_img_urls)}条")

    async def close(self):
        self.thread_pool.shutdown(wait=True)
        await self.http.stop()


async def main():
    crawler = SitemapSiteCrawler(
        root_url="https://www.169tp.com/",
        max_fetch_pages=200,
        concurrency=2,
        delay=1.2
    )
    try:
        await crawler.run()
        print(f"\n已处理页面：{len(crawler.visited)}")
        print(f"收集图片链接总数：{len(crawler.all_img_urls)}")
        crawler.export_images("./img_sitemap.txt")
    finally:
        await crawler.close()


if __name__ == "__main__":
    asyncio.run(main())
