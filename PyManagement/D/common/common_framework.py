import asyncio
import re
import functools
from abc import ABC, abstractmethod
from typing import Set, List, Optional, Dict, Callable
from urllib.parse import urljoin, urlparse

import aiohttp
from bs4 import BeautifulSoup
from playwright.async_api import Browser, async_playwright, Page, Response


# ------------------------------
# 异步重试装饰器
# ------------------------------
def async_retry(max_retries: int = 2, delay: float = 1.0):
    def decorator(func: Callable):
        @functools.wraps(func)
        async def wrapper(*args, **kwargs):
            last_exception = None
            for attempt in range(max_retries + 1):
                try:
                    return await func(*args, **kwargs)
                except Exception as e:
                    last_exception = e
                    if attempt >= max_retries:
                        break
                    await asyncio.sleep(delay)
            return None
        return wrapper
    return decorator


# ------------------------------
# 失败URL管理器：记录+加载用于补爬
# ------------------------------
class FailUrlManager:
    def __init__(self, file_path: str = "fail_urls.txt"):
        self.file_path = file_path

    def record_fail(self, url: str, reason: str):
        with open(self.file_path, "a", encoding="utf-8") as f:
            f.write(f"{url} | {reason}\n")

    def load_failed_urls(self) -> List[str]:
        urls = []
        try:
            with open(self.file_path, "r", encoding="utf-8") as f:
                for line in f:
                    line = line.strip()
                    if "|" in line:
                        u, _ = line.split("|", maxsplit=1)
                        urls.append(u.strip())
        except FileNotFoundError:
            pass
        return urls


# ------------------------------
# HTML有效性校验：过滤JS骨架空白页面
# ------------------------------
def is_html_valid(html: Optional[str]) -> bool:
    if not html:
        return False
    if len(html) < 300:
        return False
    if "<body" not in html.lower():
        return False
    return True


# ------------------------------
# 策略模式：抓取器抽象
# ------------------------------
class BaseFetcher(ABC):
    @abstractmethod
    async def fetch(self, url: str) -> Optional[str]:
        pass


class RequestsFetcher(BaseFetcher):
    def __init__(self, headers: Dict, timeout: int):
        self.headers = headers
        self.timeout = timeout

    @async_retry(max_retries=2, delay=1.2)
    async def fetch(self, url: str) -> Optional[str]:
        try:
            async with aiohttp.ClientSession() as session:
                async with session.get(
                    url,
                    headers=self.headers,
                    timeout=aiohttp.ClientTimeout(total=self.timeout),
                    allow_redirects=True
                ) as resp:
                    if resp.status == 404:
                        return None
                    if resp.status >= 400:
                        raise Exception(f"Http status:{resp.status}")
                    text = await resp.text(encoding="utf-8", errors="ignore")
                    return text
        except Exception as e:
            raise e


class PlaywrightFetcher(BaseFetcher):
    """纯异步playwright，返回page对象，支持网络抓视频请求"""
    def __init__(self, headers: Dict, timeout: int, browser: Browser, net_video_set: Set[str]):
        self.ua = headers.get("User‑Agent", "")
        self.timeout = timeout
        self.browser = browser
        self._net_video_set = net_video_set  # 外部传入集合，收集网络捕获视频

    async def fetch(self, url: str) -> Optional[str]:
        raise NotImplementedError("请使用 fetch_with_page 替代 fetch")

    @async_retry(max_retries=1, delay=2.0)
    async def fetch_with_page(self, url: str) -> Optional[Page]:
        page: Optional[Page] = None
        try:
            page = await self.browser.new_page(user_agent=self.ua)

            # 注册网络响应监听，捕获视频资源
            def on_response(resp: Response):
                u = resp.url
                if not u.startswith(("http://", "https://")):
                    return
                lower_url = u.lower()
                # 匹配常见视频后缀
                if any(suffix in lower_url for suffix in (".mp4", ".m3u8", ".webm", ".mov", ".m4v")):
                    self._net_video_set.add(u)

            page.on("response", on_response)

            await page.goto(url, timeout=self.timeout * 1000)
            await page.wait_for_load_state("networkidle", timeout=self.timeout*1000)
            await page.wait_for_timeout(1800)  # 延长等待，给分片请求完成时间
            return page
        except Exception:
            if page:
                await page.close()
            return None


# ------------------------------
# URL管理器｜单例模式
# ------------------------------
class UrlManager:
    _instance = None

    def __new__(cls, *args, **kwargs):
        if not cls._instance:
            cls._instance = super().__new__(cls)
        return cls._instance

    def __init__(self, base_domain: str):
        self.base_domain = base_domain
        self.visited: Set[str] = set()

    def normalize_url(self, url: str) -> str:
        url = urljoin(self.base_domain, url)
        return re.sub(r"#.*$", "", url)

    def is_same_domain(self, url: str) -> bool:
        p1 = urlparse(url)
        p2 = urlparse(self.base_domain)
        return p1.netloc == p2.netloc

    def is_visited(self, url: str) -> bool:
        return url in self.visited

    def mark_visited(self, url: str):
        self.visited.add(url)


# ------------------------------
# 抓取器工厂
# ------------------------------
class FetcherFactory:
    @staticmethod
    def get_static_fetcher(headers: Dict, timeout: int) -> RequestsFetcher:
        return RequestsFetcher(headers, timeout)

    @staticmethod
    def get_dynamic_fetcher(headers: Dict, timeout: int, browser: Browser, net_video_set: Set[str]) -> PlaywrightFetcher:
        return PlaywrightFetcher(headers, timeout, browser, net_video_set)


# ------------------------------
# 页面解析器：DOM提取图片、视频，支持iframe
# ------------------------------
class PageParser:
    @staticmethod
    def extract_links(html: str, base_domain: str) -> List[str]:
        soup = BeautifulSoup(html, "lxml")
        links = []
        for a_tag in soup.find_all("a", href=True):
            href = a_tag["href"]
            full_url = urljoin(base_domain, href)
            links.append(full_url)
        return links

    @staticmethod
    def extract_media_from_html(html: str, base_domain: str):
        image_set = set()
        video_set = set()
        soup = BeautifulSoup(html, "lxml")
        for img in soup.find_all("img", src=True):
            src = img["src"].strip()
            if src.startswith("data:"):
                continue
            full = urljoin(base_domain, src)
            if full.startswith(("http://", "https://")):
                image_set.add(full)
        for vid in soup.find_all("video", src=True):
            src = vid["src"].strip()
            if src.startswith("data:"):
                continue
            full = urljoin(base_domain, src)
            if full.startswith(("http://", "https://")):
                video_set.add(full)
        for src_tag in soup.find_all("source", src=True):
            src = src_tag["src"].strip()
            if src.startswith("data:"):
                continue
            full = urljoin(base_domain, src)
            if full.startswith(("http://", "https://")):
                video_set.add(full)
        return list(image_set), list(video_set)

    @staticmethod
    async def extract_media_from_page(page: Page, base_url: str):
        """playwright JS读取DOM，捕获动态渲染+iframe媒体"""
        result = await page.evaluate("""() => {
            const imgs = new Set();
            const videos = new Set();
            document.querySelectorAll('img[src]').forEach(el=>{
                const s = el.src;
                if(s && !s.startsWith('data:')) imgs.add(s);
            });
            document.querySelectorAll('video[src]').forEach(el=>{
                const s = el.src;
                if(s) videos.add(s);
            });
            document.querySelectorAll('video source[src]').forEach(el=>{
                const s = el.src;
                if(s) videos.add(s);
            });
            document.querySelectorAll('iframe').forEach(iframe=>{
                try{
                    const idoc = iframe.contentDocument || iframe.contentWindow.document;
                    idoc.querySelectorAll('img[src]').forEach(el=>{
                        const s=el.src; if(s&&!s.startsWith('data:')) imgs.add(s);
                    });
                    idoc.querySelectorAll('video[src],video source[src]').forEach(el=>{
                        const s=el.src; if(s) videos.add(s);
                    });
                }catch(e){}
            });
            return {imgs:Array.from(imgs), videos:Array.from(videos)};
        }""")
        img_list = result.get("imgs", [])
        vid_list = result.get("videos", [])
        img_list = [i for i in img_list if i.startswith(("http://","https://"))]
        vid_list = [v for v in vid_list if v.startswith(("http://","https://"))]
        return img_list, vid_list

    @staticmethod
    def extract_links_from_html(html: str, base_domain: str) -> List[str]:
        soup = BeautifulSoup(html, "lxml")
        links = []
        for a_tag in soup.find_all("a", href=True):
            href = a_tag["href"]
            full = urljoin(base_domain, href)
            links.append(full)
        return links


# ------------------------------
# 核心爬虫类：DOM媒体 + 网络抓包视频合并
# ------------------------------
class AsyncUniversalSpider:
    def __init__(
        self,
        start_url: str,
        max_depth: int = 3,
        concurrency: int = 3,
        sleep_sec: float = 0.8,
        timeout: int = 15,
        use_dynamic_fallback: bool = True
    ):
        self.start_url = start_url
        parsed = urlparse(start_url)
        self.base_domain = f"{parsed.scheme}://{parsed.netloc}"
        self.max_depth = max_depth
        self.concurrency = concurrency
        self.sleep_sec = sleep_sec
        self.timeout = timeout
        self.use_dynamic_fallback = use_dynamic_fallback

        self.headers = {
            "User‑Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 13_5) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36",
            "Accept‑Language": "zh‑CN,zh;q=0.9",
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8"
        }

        self.url_manager = UrlManager(self.base_domain)
        self.fail_manager = FailUrlManager("fail_urls.txt")

        self.browser: Optional[Browser] = None
        self.pw_context = None
        self.fetcher_static: Optional[RequestsFetcher] = None
        self.fetcher_dynamic: Optional[PlaywrightFetcher] = None
        self.task_queue: asyncio.Queue = asyncio.Queue()

        self.all_images: Set[str] = set()
        self.all_videos: Set[str] = set()
        self.net_capture_videos: Set[str] = set()  # 网络监听器捕获视频

    async def init_browser(self):
        self.pw_context = await async_playwright().start()
        self.browser = await self.pw_context.chromium.launch(headless=True)
        self.fetcher_static = FetcherFactory.get_static_fetcher(self.headers, self.timeout)
        self.fetcher_dynamic = FetcherFactory.get_dynamic_fetcher(self.headers, self.timeout, self.browser, self.net_capture_videos)

    async def close_browser(self):
        if self.browser:
            await self.browser.close()
        if self.pw_context:
            await self.pw_context.stop()

    def save_media_to_file(self, filepath="assets.txt"):
        # DOM视频 + 网络抓包视频合并去重
        total_videos = self.all_videos.union(self.net_capture_videos)
        with open(filepath, "w", encoding="utf‑8") as f:
            f.write("===== IMAGE LINKS =====\n")
            for img in sorted(self.all_images):
                f.write(img + "\n")
            f.write("\n===== VIDEO LINKS (DOM + Network Capture) =====\n")
            for vid in sorted(total_videos):
                f.write(vid + "\n")
        print(f"已保存 {filepath}，图片:{len(self.all_images)}，视频总数:{len(total_videos)}（DOM:{len(self.all_videos)}，网络抓包:{len(self.net_capture_videos)}）")

    async def worker(self):
        while True:
            try:
                url, depth = await self.task_queue.get()
            except asyncio.CancelledError:
                break
            try:
                if self.url_manager.is_visited(url) or depth > self.max_depth:
                    continue
                self.url_manager.mark_visited(url)
                print(f"[worker] depth={depth} url={url}")

                html: Optional[str] = None
                page: Optional[Page] = None
                html = await self.fetcher_static.fetch(url)
                if not is_html_valid(html):
                    html = None

                if html is None and self.use_dynamic_fallback:
                    page = await self.fetcher_dynamic.fetch_with_page(url)

                images: List[str] = []
                videos: List[str] = []
                links: List[str] = []

                if page is not None:
                    images, videos = await PageParser.extract_media_from_page(page, url)
                    html = await page.content()
                    links = PageParser.extract_links_from_html(html, url)
                elif html is not None:
                    images, videos = PageParser.extract_media_from_html(html, url)
                    links = PageParser.extract_links_from_html(html, url)
                else:
                    print(f"[FAIL] {url} | static+dynamic all failed")
                    self.fail_manager.record_fail(url, "static+dynamic all failed")
                    continue

                self.all_images.update(images)
                self.all_videos.update(videos)
                print(f"[OK] {url} | img:{len(images)} | dom_video:{len(videos)}")

                for link in links:
                    norm_link = self.url_manager.normalize_url(link)
                    if self.url_manager.is_same_domain(norm_link) and not self.url_manager.is_visited(norm_link):
                        await self.task_queue.put((norm_link, depth + 1))

                await asyncio.sleep(self.sleep_sec)
            except Exception as e:
                print(f"[worker exception] {str(e)}")
            finally:
                if 'page' in locals() and page is not None:
                    await page.close()
                self.task_queue.task_done()

    async def run(self):
        await self.init_browser()
        await self.task_queue.put((self.start_url, 0))
        workers = [asyncio.create_task(self.worker()) for _ in range(self.concurrency)]
        await self.task_queue.join()

        for w in workers:
            w.cancel()
        await asyncio.gather(*workers, return_exceptions=True)
        await self.close_browser()
        self.save_media_to_file("assets.txt")

    async def retry_failed(self):
        fail_urls = self.fail_manager.load_failed_urls()
        for u in fail_urls:
            await self.task_queue.put((u, 0))
        print(f"准备补爬 {len(fail_urls)} 个失败链接")


if __name__ == "__main__":
    async def main():
        spider = AsyncUniversalSpider(
            start_url="https://haijiaod.com/video/Categories/11.html",
            max_depth=2,
            concurrency=3,
            sleep_sec=1.0,
            use_dynamic_fallback=True
        )
        await spider.run()

    asyncio.run(main())
