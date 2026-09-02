import asyncio
import os
import re
import json
import functools
import subprocess
from abc import ABC, abstractmethod
from typing import Set, List, Optional, Dict, Callable, Any
from urllib.parse import urljoin, urlparse, unquote
from pathlib import Path

import aiohttp
from bs4 import BeautifulSoup
from playwright.async_api import Browser, async_playwright, Page, Response


# ===================== 配置区（可修改）=====================
CONFIG = {
    "max_depth": 2,
    "concurrency": 3,
    "sleep_sec": 1.0,
    "timeout": 15,
    "use_dynamic_fallback": True,
    "download_enable": True,                 # 1.是否开启下载
    "json_output_path": "crawl_result.json",  # 2.结构化json输出
    "download_root": "./download",
    "min_resource_size": 1024 * 10,          # 4.最小资源字节：10KB，小于则丢弃
    "block_domains": {                        # 4.黑名单域名，不爬不取资源
        "google-analytics.com",
        "doubleclick.net",
        "googletagmanager.com"
    },
    "allow_video_suffix": {".mp4", ".m3u8", ".webm", ".mov", ".m4v"},
    "allow_image_suffix": {".jpg", ".jpeg", ".png", ".gif", ".webp", ".bmp"},
    "ffmpeg_path": "ffmpeg",                  # 3.ffmpeg路径，windows写绝对路径如 "C:/ffmpeg/bin/ffmpeg.exe"
}
# ==========================================================


def check_ffmpeg_available(ffmpeg_bin: str) -> bool:
    try:
        subprocess.run([ffmpeg_bin, "-version"],
                       stdout=subprocess.PIPE,
                       stderr=subprocess.PIPE,
                       check=False)
        return True
    except Exception:
        return False


FFMPEG_AVAILABLE = check_ffmpeg_available(CONFIG["ffmpeg_path"])

# 创建目录
Path(CONFIG["download_root"]).mkdir(exist_ok=True)
Path(CONFIG["download_root"], "images").mkdir(exist_ok=True)
Path(CONFIG["download_root"], "videos").mkdir(exist_ok=True)


def safe_filename(url: str) -> str:
    """从url生成安全本地文件名"""
    parsed = urlparse(url)
    filename = os.path.basename(unquote(parsed.path))
    filename = re.sub(r'[\\/*?:"<>|]', "_", filename)
    if not filename:
        filename = f"res_{hash(url) % 100000}.dat"
    return filename


def is_block_domain(url: str) -> bool:
    """4.黑名单域名过滤"""
    p = urlparse(url)
    host = p.hostname
    if not host:
        return True
    for b in CONFIG["block_domains"]:
        if b in host:
            return True
    return False


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
# 失败URL管理器
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
# HTML有效性校验
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
# 资源下载工具类
# ------------------------------
class ResourceDownloader:
    def __init__(self, cfg: Dict[str, Any]):
        self.cfg = cfg
        self.session: Optional[aiohttp.ClientSession] = None
        self.downloaded_set: Set[str] = set()  # 去重，避免重复下载

    async def init(self):
        self.session = aiohttp.ClientSession(timeout=aiohttp.ClientTimeout(total=30))

    async def close(self):
        if self.session:
            await self.session.close()

    @async_retry(max_retries=1, delay=1.0)
    async def download_file(self, url: str, save_dir: Path) -> Optional[Path]:
        if not self.cfg["download_enable"]:
            return None
        if is_block_domain(url):
            return None
        if url in self.downloaded_set:
            return None
        if self.session is None:
            return None

        try:
            async with self.session.get(url, allow_redirects=True) as resp:
                if resp.status != 200:
                    return None
                content_length = resp.headers.get("Content-Length")
                if content_length is not None:
                    try:
                        if int(content_length) < self.cfg["min_resource_size"]:
                            return None
                    except ValueError:
                        pass
                fname = safe_filename(url)
                out_path = save_dir / fname
                with open(out_path, "wb") as f:
                    async for chunk in resp.content.iter_chunked(65536):
                        f.write(chunk)
                self.downloaded_set.add(url)
                return out_path
        except Exception:
            return None

    async def download_m3u8(self, m3u8_url: str, output_mp4: Path) -> bool:
        """3. m3u8通过ffmpeg转mp4"""
        if not FFMPEG_AVAILABLE:
            return False
        if is_block_domain(m3u8_url):
            return False
        if m3u8_url in self.downloaded_set:
            return False
        try:
            cmd = [
                self.cfg["ffmpeg_path"],
                "-y",
                "-i", m3u8_url,
                "-c", "copy",
                str(output_mp4)
            ]
            proc = await asyncio.create_subprocess_exec(
                *cmd,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE
            )
            await proc.communicate()
            if proc.returncode == 0 and output_mp4.exists():
                self.downloaded_set.add(m3u8_url)
                return True
            return False
        except Exception:
            return False


# ------------------------------
# 抓取器抽象
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
    def __init__(self, headers: Dict, timeout: int, browser: Browser, net_video_set: Set[str]):
        self.ua = headers.get("User‑Agent", "")
        self.timeout = timeout
        self.browser = browser
        self._net_video_set = net_video_set

    async def fetch(self, url: str) -> Optional[str]:
        raise NotImplementedError("请使用 fetch_with_page 替代 fetch")

    @async_retry(max_retries=1, delay=2.0)
    async def fetch_with_page(self, url: str) -> Optional[Page]:
        page: Optional[Page] = None
        try:
            page = await self.browser.new_page(user_agent=self.ua)

            def on_response(resp: Response):
                u = resp.url
                if not u.startswith(("http://", "https://")):
                    return
                if is_block_domain(u):
                    return
                lower_url = u.lower()
                if any(suffix in lower_url for suffix in CONFIG["allow_video_suffix"]):
                    self._net_video_set.add(u)

            page.on("response", on_response)
            await page.goto(url, timeout=self.timeout * 1000)
            await page.wait_for_load_state("networkidle", timeout=self.timeout*1000)
            await page.wait_for_timeout(1800)
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
# 页面解析器
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
            if full.startswith(("http://", "https://")) and not is_block_domain(full):
                image_set.add(full)
        for vid in soup.find_all("video", src=True):
            src = vid["src"].strip()
            if src.startswith("data:"):
                continue
            full = urljoin(base_domain, src)
            if full.startswith(("http://", "https://")) and not is_block_domain(full):
                video_set.add(full)
        for src_tag in soup.find_all("source", src=True):
            src = src_tag["src"].strip()
            if src.startswith("data:"):
                continue
            full = urljoin(base_domain, src)
            if full.startswith(("http://", "https://")) and not is_block_domain(full):
                video_set.add(full)
        return list(image_set), list(video_set)

    @staticmethod
    async def extract_media_from_page(page: Page, base_url: str):
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
        img_list = [i for i in img_list if i.startswith(("http://","https://")) and not is_block_domain(i)]
        vid_list = [v for v in vid_list if v.startswith(("http://","https://")) and not is_block_domain(v)]
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
# 核心爬虫类
# ------------------------------
class AsyncUniversalSpider:
    def __init__(self, start_url: str):
        self.cfg = CONFIG
        self.start_url = start_url
        parsed = urlparse(start_url)
        self.base_domain = f"{parsed.scheme}://{parsed.netloc}"
        self.max_depth = self.cfg["max_depth"]
        self.concurrency = self.cfg["concurrency"]
        self.sleep_sec = self.cfg["sleep_sec"]
        self.timeout = self.cfg["timeout"]
        self.use_dynamic_fallback = self.cfg["use_dynamic_fallback"]

        self.headers = {
            "User‑Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 13_5) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36",
            "Accept‑Language": "zh‑CN,zh;q=0.9",
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8"
        }

        self.url_manager = UrlManager(self.base_domain)
        self.fail_manager = FailUrlManager("fail_urls.txt")
        self.downloader = ResourceDownloader(self.cfg)

        self.browser: Optional[Browser] = None
        self.pw_context = None
        self.fetcher_static: Optional[RequestsFetcher] = None
        self.fetcher_dynamic: Optional[PlaywrightFetcher] = None
        self.task_queue: asyncio.Queue = asyncio.Queue()

        self.all_images: Set[str] = set()
        self.all_videos: Set[str] = set()
        self.net_capture_videos: Set[str] = set()

        # 2.结构化采集记录
        self.crawl_records: List[Dict[str, Any]] = []

    async def init_browser(self):
        self.pw_context = await async_playwright().start()
        self.browser = await self.pw_context.chromium.launch(headless=True)
        self.fetcher_static = FetcherFactory.get_static_fetcher(self.headers, self.timeout)
        self.fetcher_dynamic = FetcherFactory.get_dynamic_fetcher(self.headers, self.timeout, self.browser, self.net_capture_videos)
        await self.downloader.init()

    async def close_browser(self):
        if self.browser:
            await self.browser.close()
        if self.pw_context:
            await self.pw_context.stop()
        await self.downloader.close()

    def save_json_result(self):
        """2.输出结构化JSON"""
        payload = {
            "start_url": self.start_url,
            "total_images": len(self.all_images),
            "total_videos_dom": len(self.all_videos),
            "total_videos_network": len(self.net_capture_videos),
            "total_videos_all": len(self.all_videos.union(self.net_capture_videos)),
            "page_records": self.crawl_records
        }
        with open(self.cfg["json_output_path"], "w", encoding="utf-8") as f:
            json.dump(payload, f, ensure_ascii=False, indent=2)
        print(f"JSON结果已保存: {self.cfg['json_output_path']}")

    def save_media_to_file(self, filepath="assets.txt"):
        total_videos = self.all_videos.union(self.net_capture_videos)
        with open(filepath, "w", encoding="utf‑8") as f:
            f.write("===== IMAGE LINKS =====\n")
            for img in sorted(self.all_images):
                f.write(img + "\n")
            f.write("\n===== VIDEO LINKS (DOM + Network Capture) =====\n")
            for vid in sorted(total_videos):
                f.write(vid + "\n")
        print(f"assets.txt已保存，图片:{len(self.all_images)}，视频总数:{len(total_videos)}")

    async def process_downloads(self, images: List[str], videos: List[str], net_videos: List[str]):
        """1+3 执行下载：普通资源http下载；m3u8调用ffmpeg"""
        img_dir = Path(self.cfg["download_root"]) / "images"
        vid_dir = Path(self.cfg["download_root"]) / "videos"
        # 图片
        for img_url in images:
            await self.downloader.download_file(img_url, img_dir)
        # 普通视频
        for v_url in videos + net_videos:
            lu = v_url.lower()
            if lu.endswith(".m3u8"):
                base_name = safe_filename(v_url).replace(".m3u8", ".mp4")
                out_mp4 = vid_dir / base_name
                await self.downloader.download_m3u8(v_url, out_mp4)
            else:
                await self.downloader.download_file(v_url, vid_dir)

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
                current_net_videos: List[str] = []

                if page is not None:
                    images, videos = await PageParser.extract_media_from_page(page, url)
                    html = await page.content()
                    links = PageParser.extract_links_from_html(html, url)
                    current_net_videos = list(self.net_capture_videos)
                elif html is not None:
                    images, videos = PageParser.extract_media_from_html(html, url)
                    links = PageParser.extract_links_from_html(html, url)
                else:
                    print(f"[FAIL] {url} | static+dynamic all failed")
                    self.fail_manager.record_fail(url, "static+dynamic all failed")
                    continue

                self.all_images.update(images)
                self.all_videos.update(videos)

                # 2.单页记录存入JSON
                self.crawl_records.append({
                    "page_url": url,
                    "depth": depth,
                    "images": images,
                    "videos_dom": videos,
                    "videos_network": current_net_videos
                })

                # 1+3下载
                await self.process_downloads(images, videos, current_net_videos)

                print(f"[OK] {url} | img:{len(images)} | dom_video:{len(videos)} | net_video:{len(current_net_videos)}")

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
        print(f"FFMPEG可用：{FFMPEG_AVAILABLE}，开启下载：{CONFIG['download_enable']}")
        await self.init_browser()
        await self.task_queue.put((self.start_url, 0))
        workers = [asyncio.create_task(self.worker()) for _ in range(self.concurrency)]
        await self.task_queue.join()

        for w in workers:
            w.cancel()
        await asyncio.gather(*workers, return_exceptions=True)
        await self.close_browser()

        self.save_media_to_file("assets.txt")
        self.save_json_result()
        print("===== 全部任务完成 =====")

    async def retry_failed(self):
        fail_urls = self.fail_manager.load_failed_urls()
        for u in fail_urls:
            await self.task_queue.put((u, 0))
        print(f"准备补爬 {len(fail_urls)} 个失败链接")


if __name__ == "__main__":
    async def main():
        spider = AsyncUniversalSpider(
            start_url="https://haijiaod.com/video/Categories/11.html"  # 修改为目标网址
        )
        await spider.run()

    asyncio.run(main())
