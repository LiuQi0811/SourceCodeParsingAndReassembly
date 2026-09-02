import asyncio
import warnings
from urllib.parse import urljoin, urlparse
from typing import Set, Tuple, Optional
from playwright.async_api import async_playwright, Browser, Page
from bs4 import BeautifulSoup

warnings.filterwarnings("ignore")

class PlaywrightBfsCrawler:
    def __init__(
        self,
        root_url: str,
        max_crawl_page: int = 50,
        max_depth: int = 3,
        concurrency: int = 2,
        page_delay: float = 1.0,
        headless: bool = True
    ):
        self.root_url = root_url
        self.host = urlparse(root_url).netloc

        self.max_crawl_page = max_crawl_page
        self.max_depth = max_depth
        self.concurrency = concurrency
        self.page_delay = page_delay
        self.headless = headless

        self.browser: Optional[Browser] = None
        self.visited: Set[str] = set()
        self.all_img_urls: Set[str] = set()
        # 队列元素：(url, depth)
        self.queue: asyncio.Queue[Tuple[str, int]] = asyncio.Queue()

        # 过滤不需要入队列的后缀
        self.skip_suffix = {".xml", ".js", ".css", ".jpg", ".jpeg", ".png", ".gif", ".webp", ".ico", ".svg"}

    async def init_browser(self):
        pw = await async_playwright().start()
        self.browser = await pw.chromium.launch(
            headless=self.headless,
            args=[
                "--disable-blink-features=AutomationControlled",
                "--no‑sandbox"
            ]
        )

    async def close_browser(self):
        if self.browser:
            await self.browser.close()

    def _is_same_host(self, url: str) -> bool:
        return urlparse(url).netloc == self.host

    def _should_skip_url(self, url: str) -> bool:
        p = urlparse(url)
        path = p.path.lower()
        if any(path.endswith(suf) for suf in self.skip_suffix):
            return True
        return False

    async def fetch_rendered_html(self, url: str) -> Optional[str]:
        """打开浏览器页面，执行JS，返回渲染完成后的完整HTML"""
        if not self.browser:
            return None
        try:
            context = await self.browser.new_context(
                user_agent="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36",
                viewport={"width":1920, "height":1080}
            )
            page: Page = await context.new_page()
            # 访问页面，等待网络空闲，JS全部执行完毕
            await page.goto(url, wait_until="networkidle", timeout=30000)
            # 滚动一次触发懒加载图片
            await page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
            await page.wait_for_timeout(800)
            html = await page.content()
            await context.close()
            return html
        except Exception as e:
            print(f"页面加载异常 {url}: {e}")
            return None

    def parse_page_resource(self, base_url: str, html: str):
        """解析渲染完成HTML：提取站内链接、提取图片src/data‑src"""
        soup = BeautifulSoup(html, "lxml")
        out_links: Set[str] = set()
        out_imgs: Set[str] = set()

        # 提取a标签链接
        for a_tag in soup.find_all("a", href=True):
            href = a_tag.get("href", "").strip()
            if not href or href.startswith(("#", "javascript:", "mailto:")):
                continue
            abs_u = urljoin(base_url, href)
            if self._is_same_host(abs_u) and not self._should_skip_url(abs_u):
                out_links.add(abs_u)

        # 提取图片：src、data‑src懒加载
        for img_tag in soup.find_all("img"):
            src = img_tag.get("src")
            ds = img_tag.get("data‑src")
            if src:
                out_imgs.add(urljoin(base_url, src.strip()))
            if ds:
                out_imgs.add(urljoin(base_url, ds.strip()))
        return out_links, out_imgs

    async def worker(self):
        while len(self.visited) < self.max_crawl_page:
            try:
                url, depth = await asyncio.wait_for(self.queue.get(), timeout=5.0)
            except asyncio.TimeoutError:
                print("[BFS‑Playwright]队列空闲，爬虫结束")
                break

            if url in self.visited:
                self.queue.task_done()
                continue
            self.visited.add(url)
            print(f"[BFS] depth={depth} | {len(self.visited)}/{self.max_crawl_page} -> {url}")

            html = await self.fetch_rendered_html(url)
            if html is None:
                self.queue.task_done()
                await asyncio.sleep(self.page_delay)
                continue

            next_links, imgs = self.parse_page_resource(url, html)
            self.all_img_urls.update(imgs)

            next_depth = depth + 1
            if next_depth <= self.max_depth:
                for link in next_links:
                    if link not in self.visited:
                        await self.queue.put((link, next_depth))

            self.queue.task_done()
            await asyncio.sleep(self.page_delay)

    async def run(self):
        await self.init_browser()
        await self.queue.put((self.root_url, 0))
        workers = [asyncio.create_task(self.worker()) for _ in range(self.concurrency)]
        await asyncio.gather(*workers)
        await self.close_browser()

    def export_img_links(self, path="./pw_img_links.txt"):
        with open(path, "w", encoding="utf‑8") as f:
            for item in sorted(self.all_img_urls):
                f.write(item + "\n")
        print(f"图片链接导出完成 {path}，总数：{len(self.all_img_urls)}")


async def main():
    crawler = PlaywrightBfsCrawler(
        root_url="https://www.169tp.com/",
        max_crawl_page=40,
        max_depth=3,
        concurrency=2,
        page_delay=1.2,
        headless=True
    )
    try:
        await crawler.run()
        print(f"\n已处理页面：{len(crawler.visited)}")
        print(f"收集图片链接总数：{len(crawler.all_img_urls)}")
        crawler.export_img_links("./pw_img_links.txt")
    except Exception as e:
        print(f"异常:{e}")
        await crawler.close_browser()


if __name__ == "__main__":
    asyncio.run(main())
