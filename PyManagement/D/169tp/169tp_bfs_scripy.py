import asyncio
import aiohttp
from concurrent.futures import ThreadPoolExecutor
from bs4 import BeautifulSoup, XMLParsedAsHTMLWarning
from urllib.parse import urljoin, urlparse
from typing import Set, List, Optional
import os
import warnings
from charset_normalizer import from_bytes

# 屏蔽bs4把XML当做HTML解析的警告
warnings.filterwarnings("ignore", category=XMLParsedAsHTMLWarning)

# ------------------------------
# 单例会话
# ------------------------------
class RequestSessionSingleton:
    _instance: Optional["RequestSessionSingleton"] = None
    aio_session: Optional[aiohttp.ClientSession] = None
    headers = {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36",
        "Referer": "https://www.169tp.com/"
    }

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
        return cls._instance

    async def init_aio_session(self):
        if self.aio_session is None or self.aio_session.closed:
            self.aio_session = aiohttp.ClientSession(headers=self.headers, timeout=aiohttp.ClientTimeout(total=12))

    async def close(self):
        if self.aio_session and not self.aio_session.closed:
            await self.aio_session.close()

# ------------------------------
# 解析器：图片 + 站内a链接解析
# ------------------------------
class PageParser:
    # 不需要入BFS页面队列的后缀
    SKIP_SUFFIX = {".xml", ".js", ".css", ".jpg", ".jpeg", ".png", ".gif", ".webp", ".ico", ".svg"}

    @staticmethod
    def extract_images(base_url: str, html: str) -> Set[str]:
        img_set = set()
        soup = BeautifulSoup(html, "lxml")
        for tag in soup.find_all("img"):
            src = tag.get("src")
            if src:
                img_set.add(urljoin(base_url, src.strip()))
            # 补充抓取懒加载 data‑src
            data_src = tag.get("data‑src")
            if data_src:
                img_set.add(urljoin(base_url, data_src.strip()))
        return img_set

    @staticmethod
    def extract_internal_links(base_url: str, html: str, root_domain: str) -> Set[str]:
        link_set = set()
        soup = BeautifulSoup(html, "lxml")
        parse_root = urlparse(root_domain)
        for a_tag in soup.find_all("a", href=True):
            href = a_tag.get("href").strip()
            if not href or href.startswith("#"):
                continue
            full = urljoin(base_url, href)
            p = urlparse(full)
            # 过滤资源后缀
            path_lower = p.path.lower()
            if any(path_lower.endswith(suf) for suf in PageParser.SKIP_SUFFIX):
                continue
            if p.netloc == parse_root.netloc and p.scheme in ("http", "https"):
                link_set.add(full)
        return link_set

# ------------------------------
# BFS全站爬虫核心（增加深度控制）
# ------------------------------
class BfsSiteCrawler:
    def __init__(
        self,
        root_url: str,
        max_crawl_page: int = 130,
        max_depth: int = 3,
        download_concurrent: int = 3,
        request_delay: float = 0.8
    ):
        self.root_url = root_url
        self.max_crawl_page = max_crawl_page
        self.max_depth = max_depth
        self.request_delay = request_delay

        self.session_mgr = RequestSessionSingleton()
        self.thread_pool = ThreadPoolExecutor(max_workers=4)

        self.visited_pages: Set[str] = set()
        self.page_queue: asyncio.Queue[tuple[str, int]] = asyncio.Queue()
        self.all_img_urls: Set[str] = set()

        self.download_semaphore = asyncio.Semaphore(download_concurrent)
        self.save_dir = "./bfs_download"
        os.makedirs(self.save_dir, exist_ok=True)

    async def fetch_html(self, url: str) -> Optional[str]:
        await self.session_mgr.init_aio_session()
        try:
            async with self.session_mgr.aio_session.get(url) as resp:
                if resp.status != 200:
                    print(f"[fetch] status={resp.status} url={url}")
                    return None
                raw_bytes = await resp.read()
                result = from_bytes(raw_bytes).best()
                if result:
                    html = str(result)
                else:
                    try:
                        html = raw_bytes.decode("gbk")
                    except UnicodeDecodeError:
                        html = raw_bytes.decode("utf‑8", errors="replace")
                return html
        except Exception as e:
            print(f"请求异常 {url} : {e}")
            return None

    async def consumer(self):
        while len(self.visited_pages) < self.max_crawl_page:
            try:
                page_url, depth = await asyncio.wait_for(self.page_queue.get(), timeout=4.0)
            except asyncio.TimeoutError:
                print("[BFS]队列空闲超时，无更多新页面，BFS结束")
                break

            if page_url in self.visited_pages:
                self.page_queue.task_done()
                continue
            self.visited_pages.add(page_url)
            print(f"[BFS]深度:{depth} | 正在解析 {page_url} | 已处理:{len(self.visited_pages)}/{self.max_crawl_page}")

            html = await self.fetch_html(page_url)
            if not html:
                self.page_queue.task_done()
                continue

            loop = asyncio.get_running_loop()
            img_links = await loop.run_in_executor(
                self.thread_pool,
                PageParser.extract_images,
                page_url,
                html
            )
            internal_links = await loop.run_in_executor(
                self.thread_pool,
                PageParser.extract_internal_links,
                page_url,
                html,
                self.root_url
            )

            self.all_img_urls.update(img_links)

            next_depth = depth + 1
            if next_depth <= self.max_depth:
                for new_page in internal_links:
                    if new_page not in self.visited_pages:
                        await self.page_queue.put((new_page, next_depth))

            await asyncio.sleep(self.request_delay)
            self.page_queue.task_done()

    async def start_bfs(self):
        await self.page_queue.put((self.root_url, 0))
        consumers = [asyncio.create_task(self.consumer()) for _ in range(3)]
        await asyncio.gather(*consumers, return_exceptions=True)
        print(f"\n[BFS结束] 队列剩余未消费任务数: {self.page_queue.qsize()}")

    async def download_single_img(self, img_url: str):
        async with self.download_semaphore:
            await self.session_mgr.init_aio_session()
            try:
                u = urlparse(img_url)
                fn = os.path.basename(u.path)
                if not fn:
                    fn = f"{hash(img_url) % 99999}.jpg"
                save_path = os.path.join(self.save_dir, fn)
                async with self.session_mgr.aio_session.get(img_url) as resp:
                    if resp.status != 200:
                        return
                    data = await resp.read()
                    with open(save_path, "wb") as f:
                        f.write(data)
                print(f"保存 {fn}")
                await asyncio.sleep(0.2)
            except Exception as e:
                print(f"下载失败 {img_url} {e}")

    async def download_all(self):
        print(f"\n准备下载 {len(self.all_img_urls)} 张图片")
        tasks = [self.download_single_img(url) for url in self.all_img_urls]
        await asyncio.gather(*tasks)

    def export_img_links(self, output_file: str = "./img_links.txt"):
        with open(output_file, "w", encoding="utf‑8") as f:
            for link in sorted(self.all_img_urls):
                f.write(link + "\n")
        print(f"图片链接已导出至: {output_file}")

    async def close(self):
        self.thread_pool.shutdown(wait=True)
        await self.session_mgr.close()


async def main():
    crawler = BfsSiteCrawler(
        root_url="https://www.169tp.com/",
        max_crawl_page=130,
        max_depth=3,
        request_delay=0.8
    )
    try:
        await crawler.start_bfs()
        print(f"\nBFS完成，一共解析页面：{len(crawler.visited_pages)}")
        print(f"收集图片链接总数：{len(crawler.all_img_urls)}")
        crawler.export_img_links("./img_links.txt")

        # await crawler.download_all()
    finally:
        await crawler.close()


if __name__ == "__main__":
    asyncio.run(main())
