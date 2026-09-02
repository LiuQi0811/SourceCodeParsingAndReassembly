import asyncio
import os
import re
import json
import functools
import subprocess
import logging
from abc import ABC, abstractmethod
from typing import Set, List, Optional, Dict, Callable, Any
from urllib.parse import urljoin, urlparse, unquote
from pathlib import Path

import aiohttp
from bs4 import BeautifulSoup
from playwright.async_api import Browser, async_playwright, Page, Response


# ===================== 【直接在这里修改所有参数，无需命令行】 =====================
CONFIG = {
    "start_url": "https://example.com",   # 起始URL
    "max_depth": 2,
    "concurrency": 3,
    "sleep_sec": 1.0,
    "timeout": 15,
    "use_dynamic_fallback": True,
    "download_enable": True,
    "json_output_path": "crawl_result.json",
    "download_root": "./download",
    "min_resource_size": 1024 * 10,
    "block_domains": {
        "google-analytics.com",
        "doubleclick.net",
        "googletagmanager.com"
    },
    "allow_video_suffix": {".mp4", ".m3u8", ".webm", ".mov", ".m4v"},
    "allow_image_suffix": {".jpg", ".jpeg", ".png", ".gif", ".webp", ".bmp"},
    "ffmpeg_path": "ffmpeg",

    # 防盗链
    "custom_referer": "",
    "custom_cookie": "",

    # 代理 http://127.0.0.1:7890 / socks5://127.0.0.1:7890，留空不使用
    "proxy_url": "",

    # B 白名单域名列表，空列表代表不限制；示例：["example.com","a.org"]
    "whitelist_domains": [],

    # C 下载限速 bytes/s，0=不限速；524288 = 512KB/s
    "download_rate_limit": 0,

    # D 日志文件
    "log_file": "spider.log"
}
# ================================================================================


def setup_logger(log_path: str):
    logger = logging.getLogger("spider")
    logger.setLevel(logging.INFO)
    fmt = logging.Formatter("%(asctime)s - %(levelname)s - %(message)s")
    fh = logging.FileHandler(log_path, encoding="utf‑8")
    fh.setFormatter(fmt)
    logger.addHandler(fh)
    ch = logging.StreamHandler()
    ch.setFormatter(fmt)
    logger.addHandler(ch)
    return logger

logger = setup_logger(CONFIG["log_file"])


def check_ffmpeg_available(ffmpeg_bin: str) -> bool:
    try:
        subprocess.run([ffmpeg_bin, "-version"],
                       stdout=subprocess.PIPE,
                       stderr=subprocess.PIPE,
                       check=False)
        return True
    except Exception:
        return False


def safe_filename(url: str) -> str:
    parsed = urlparse(url)
    filename = os.path.basename(unquote(parsed.path))
    filename = re.sub(r'[\\/*?:"<>|]', "_", filename)
    if not filename or len(filename) > 180:
        filename = f"res_{hash(url) % 1000000}.dat"
    return filename


def is_block_domain(url: str, block_set: Set[str]) -> bool:
    p = urlparse(url)
    host = p.hostname
    if not host:
        return True
    for b in block_set:
        if b in host:
            return True
    return False


def is_whitelist_domain(url: str, whitelist: List[str]) -> bool:
    if not whitelist:
        return True
    p = urlparse(url)
    host = p.hostname
    if not host:
        return False
    for w in whitelist:
        if w in host:
            return True
    return False


def build_http_headers(cfg: Dict[str, str]) -> Dict[str, str]:
    headers = {
        "User‑Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 13_5) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36",
        "Accept‑Language": "zh‑CN,zh;q=0.9",
        "Accept": "*/*"
    }
    if cfg["custom_referer"]:
        headers["Referer"] = cfg["custom_referer"]
    if cfg["custom_cookie"]:
        headers["Cookie"] = cfg["custom_cookie"]
    return headers


def ffmpeg_header_arg(headers: Dict[str, str]) -> str:
    parts = []
    for k, v in headers.items():
        parts.append(f"{k}: {v}\r\n")
    return "".join(parts)


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


class FailUrlManager:
    def __init__(self, file_path: str = "fail_urls.txt"):
        self.file_path = file_path

    def record_fail(self, url: str, reason: str):
        msg = f"{url} | {reason}"
        with open(self.file_path, "a", encoding="utf-8") as f:
            f.write(msg + "\n")
        logger.warning(msg)

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


def is_html_valid(html: Optional[str]) -> bool:
    if not html:
        return False
    if len(html) < 300:
        return False
    if "<body" not in html.lower():
        return False
    return True


async def limited_write(f, chunk: bytes, rate_limit: int):
    if rate_limit <= 0:
        f.write(chunk)
        return
    f.write(chunk)
    sleep_time = len(chunk) / rate_limit
    await asyncio.sleep(sleep_time)


class ResourceDownloader:
    def __init__(self, cfg: Dict[str, Any]):
        self.cfg = cfg
        self.session: Optional[aiohttp.ClientSession] = None
        self.downloaded_set: Set[str] = set()
        self.http_headers = build_http_headers(cfg)
        self.ffmpeg_available = check_ffmpeg_available(cfg["ffmpeg_path"])

    async def init(self):
        self.session = aiohttp.ClientSession(
            timeout=aiohttp.ClientTimeout(total=30)
        )

    async def close(self):
        if self.session:
            await self.session.close()

    @async_retry(max_retries=1, delay=1.0)
    async def download_file(self, url: str, save_dir: Path) -> Optional[Path]:
        if not self.cfg["download_enable"]:
            return None
        if is_block_domain(url, self.cfg["block_domains"]):
            return None
        if url in self.downloaded_set:
            return None
        if self.session is None:
            return None

        try:
            async with self.session.get(
                url,
                headers=self.http_headers,
                proxy=self.cfg["proxy_url"] if self.cfg["proxy_url"] else None,
                allow_redirects=True
            ) as resp:
                if resp.status != 200:
                    logger.debug(f"download skip status={resp.status} {url}")
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
                        await limited_write(f, chunk, self.cfg["download_rate_limit"])
                self.downloaded_set.add(url)
                logger.info(f"download ok {url} -> {out_path}")
                return out_path
        except Exception as e:
            logger.debug(f"download fail {url} err:{str(e)}")
            return None

    async def download_m3u8(self, m3u8_url: str, output_mp4: Path) -> bool:
        if not self.ffmpeg_available:
            return False
        if is_block_domain(m3u8_url, self.cfg["block_domains"]):
            return False
        if m3u8_url in self.downloaded_set:
            return False
        try:
            header_str = ffmpeg_header_arg(self.http_headers)
            cmd = [
                self.cfg["ffmpeg_path"],
                "-y",
                "-headers", header_str,
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
                logger.info(f"m3u8 ok {m3u8_url} -> {output_mp4}")
                return True
            logger.warning(f"m3u8 ffmpeg returncode={proc.returncode} {m3u8_url}")
            return False
        except Exception as e:
            logger.warning(f"m3u8 run exception {m3u8_url} {str(e)}")
            return False


class BaseFetcher(ABC):
    @abstractmethod
    async def fetch(self, url: str) -> Optional[str]:
        pass


class RequestsFetcher(BaseFetcher):
    def __init__(self, headers: Dict, timeout: int, proxy: str):
        self.headers = headers
        self.timeout = timeout
        self.proxy = proxy

    @async_retry(max_retries=2, delay=1.2)
    async def fetch(self, url: str) -> Optional[str]:
        try:
            async with aiohttp.ClientSession() as session:
                async with session.get(
                    url,
                    headers=self.headers,
                    proxy=self.proxy if self.proxy else None,
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
    def __init__(self, headers: Dict, timeout: int, browser: Browser, net_video_set: Set[str], proxy: str, block_domains: Set[str]):
        self.ua = headers.get("User‑Agent", "")
        self.referer = headers.get("Referer", "")
        self.cookie_str = headers.get("Cookie", "")
        self.timeout = timeout
        self.browser = browser
        self._net_video_set = net_video_set
        self.proxy = proxy
        self.block_domains = block_domains

    async def fetch(self, url: str) -> Optional[str]:
        raise NotImplementedError("请使用 fetch_with_page 替代 fetch")

    @async_retry(max_retries=1, delay=2.0)
    async def fetch_with_page(self, url: str) -> Optional[Page]:
        page: Optional[Page] = None
        try:
            page_args = {"user_agent": self.ua}
            if self.proxy:
                page_args["proxy"] = {"server": self.proxy}
            page = await self.browser.new_page(**page_args)

            if self.cookie_str:
                cookies = []
                for part in self.cookie_str.split(";"):
                    part = part.strip()
                    if "=" in part:
                        k, v = part.split("=", maxsplit=1)
                        cookies.append({"name": k.strip(), "value": v.strip(), "url": url})
                await page.context.add_cookies(cookies)
            if self.referer:
                page.set_default_http_headers({"Referer": self.referer})

            def on_response(resp: Response):
                u = resp.url
                if not u.startswith(("http://", "https://")):
                    return
                if is_block_domain(u, self.block_domains):
                    return
                lower_url = u.lower()
                if any(suffix in lower_url for suffix in {".mp4", ".m3u8", ".webm", ".mov", ".m4v"}):
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


class UrlManager:
    _instance = None

    def __new__(cls, *args, **kwargs):
        if not cls._instance:
            cls._instance = super().__new__(cls)
        return cls._instance

    def __init__(self, base_domain: str, whitelist_domains: List[str]):
        self.base_domain = base_domain
        self.visited: Set[str] = set()
        self.whitelist_domains = whitelist_domains

    def normalize_url(self, url: str) -> str:
        url = urljoin(self.base_domain, url)
        return re.sub(r"#.*$", "", url)

    def allow_enqueue(self, url: str) -> bool:
        return is_whitelist_domain(url, self.whitelist_domains)

    def is_visited(self, url: str) -> bool:
        return url in self.visited

    def mark_visited(self, url: str):
        self.visited.add(url)


class FetcherFactory:
    @staticmethod
    def get_static_fetcher(headers: Dict, timeout: int, proxy: str) -> RequestsFetcher:
        return RequestsFetcher(headers, timeout, proxy)

    @staticmethod
    def get_dynamic_fetcher(headers: Dict, timeout: int, browser: Browser, net_video_set: Set[str], proxy: str, block_domains: Set[str]) -> PlaywrightFetcher:
        return PlaywrightFetcher(headers, timeout, browser, net_video_set, proxy, block_domains)


class PageParser:
    @staticmethod
    def extract_links_from_html(html: str, base_domain: str) -> List[str]:
        soup = BeautifulSoup(html, "lxml")
        links = []
        for a_tag in soup.find_all("a", href=True):
            href = a_tag["href"]
            full = urljoin(base_domain, href)
            links.append(full)
        return links

    @staticmethod
    def extract_media_from_html(html: str, base_domain: str, block_domains: Set[str]):
        image_set = set()
        video_set = set()
        soup = BeautifulSoup(html, "lxml")
        for img in soup.find_all("img", src=True):
            src = img["src"].strip()
            if src.startswith("data:"):
                continue
            full = urljoin(base_domain, src)
            if full.startswith(("http://", "https://")) and not is_block_domain(full, block_domains):
                image_set.add(full)
        for vid in soup.find_all("video", src=True):
            src = vid["src"].strip()
            if src.startswith("data:"):
                continue
            full = urljoin(base_domain, src)
            if full.startswith(("http://", "https://")) and not is_block_domain(full, block_domains):
                video_set.add(full)
        for src_tag in soup.find_all("source", src=True):
            src = src_tag["src"].strip()
            if src.startswith("data:"):
                continue
            full = urljoin(base_domain, src)
            if full.startswith(("http://", "https://")) and not is_block_domain(full, block_domains):
                video_set.add(full)
        return list(image_set), list(video_set)

    @staticmethod
    async def extract_media_from_page(page: Page, base_url: str, block_domains: Set[str]):
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
        img_list = [i for i in img_list if i.startswith(("http://","https://")) and not is_block_domain(i, block_domains)]
        vid_list = [v for v in vid_list if v.startswith(("http://","https://")) and not is_block_domain(v, block_domains)]
        return img_list, vid_list


class AsyncUniversalSpider:
    def __init__(self, start_url: str, cfg: Dict[str, Any]):
        self.cfg = cfg
        self.start_url = start_url
        parsed = urlparse(start_url)
        self.base_domain = f"{parsed.scheme}://{parsed.netloc}"
        self.max_depth = self.cfg["max_depth"]
        self.concurrency = self.cfg["concurrency"]
        self.sleep_sec = self.cfg["sleep_sec"]
        self.timeout = self.cfg["timeout"]
        self.use_dynamic_fallback = self.cfg["use_dynamic_fallback"]

        self.headers = build_http_headers(self.cfg)
        self.url_manager = UrlManager(self.base_domain, self.cfg["whitelist_domains"])
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
        self.crawl_records: List[Dict[str, Any]] = []

        Path(self.cfg["download_root"]).mkdir(exist_ok=True)
        Path(self.cfg["download_root"], "images").mkdir(exist_ok=True)
        Path(self.cfg["download_root"], "videos").mkdir(exist_ok=True)

    async def init_browser(self):
        pw_args = {}
        if self.cfg["proxy_url"]:
            pw_args["proxy"] = {"server": self.cfg["proxy_url"]}
        self.pw_context = await async_playwright().start()
        self.browser = await self.pw_context.chromium.launch(headless=True, **pw_args)
        self.fetcher_static = FetcherFactory.get_static_fetcher(self.headers, self.timeout, self.cfg["proxy_url"])
        self.fetcher_dynamic = FetcherFactory.get_dynamic_fetcher(
            self.headers, self.timeout, self.browser, self.net_capture_videos,
            self.cfg["proxy_url"], self.cfg["block_domains"]
        )
        await self.downloader.init()

    async def close_browser(self):
        if self.browser:
            await self.browser.close()
        if self.pw_context:
            await self.pw_context.stop()
        await self.downloader.close()

    def save_json_result(self):
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
        logger.info(f"JSON结果已保存: {self.cfg['json_output_path']}")

    def save_media_to_file(self, filepath="assets.txt"):
        total_videos = self.all_videos.union(self.net_capture_videos)
        with open(filepath, "w", encoding="utf‑8") as f:
            f.write("===== IMAGE LINKS =====\n")
            for img in sorted(self.all_images):
                f.write(img + "\n")
            f.write("\n===== VIDEO LINKS (DOM + Network Capture) =====\n")
            for vid in sorted(total_videos):
                f.write(vid + "\n")
        logger.info(f"assets.txt已保存，图片:{len(self.all_images)}，视频总数:{len(total_videos)}")

    async def process_downloads(self, images: List[str], videos: List[str], net_videos: List[str]):
        img_dir = Path(self.cfg["download_root"]) / "images"
        vid_dir = Path(self.cfg["download_root"]) / "videos"
        for img_url in images:
            await self.downloader.download_file(img_url, img_dir)
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
                logger.info(f"[worker] depth={depth} url={url}")

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
                current_net_videos = list(self.net_capture_videos)

                if page is not None:
                    images, videos = await PageParser.extract_media_from_page(page, url, self.cfg["block_domains"])
                    html = await page.content()
                    links = PageParser.extract_links_from_html(html, url)
                elif html is not None:
                    images, videos = PageParser.extract_media_from_html(html, url, self.cfg["block_domains"])
                    links = PageParser.extract_links_from_html(html, url)
                else:
                    self.fail_manager.record_fail(url, "static+dynamic all failed")
                    continue

                self.all_images.update(images)
                self.all_videos.update(videos)

                self.crawl_records.append({
                    "page_url": url,
                    "depth": depth,
                    "images": images,
                    "videos_dom": videos,
                    "videos_network": current_net_videos
                })

                await self.process_downloads(images, videos, current_net_videos)
                logger.info(f"[OK] {url} | img:{len(images)} | dom_video:{len(videos)} | net_video:{len(current_net_videos)}")

                for link in links:
                    norm_link = self.url_manager.normalize_url(link)
                    if not self.url_manager.is_visited(norm_link) and self.url_manager.allow_enqueue(norm_link):
                        await self.task_queue.put((norm_link, depth + 1))

                await asyncio.sleep(self.sleep_sec)
            except Exception as e:
                logger.exception(f"[worker exception]")
            finally:
                if 'page' in locals() and page is not None:
                    await page.close()
                self.task_queue.task_done()

    async def run(self):
        logger.info(f"FFMPEG可用：{self.downloader.ffmpeg_available}，开启下载：{self.cfg['download_enable']}，代理：{self.cfg['proxy_url'] or '无'}")
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
        logger.info("===== 全部任务完成 =====")

    async def retry_failed(self):
        fail_urls = self.fail_manager.load_failed_urls()
        for u in fail_urls:
            await self.task_queue.put((u, 0))
        logger.info(f"准备补爬 {len(fail_urls)} 个失败链接")


if __name__ == "__main__":
    async def main():
        spider = AsyncUniversalSpider(start_url=CONFIG["start_url"], cfg=CONFIG)
        await spider.run()

    asyncio.run(main())

# 关键配置示例片段
# CONFIG = {
#     "start_url": "https://xxx.site",
#     "max_depth":1,
#     "concurrency":2,
#     "proxy_url":"http://127.0.0.1:7890",
#     "custom_referer":"https://xxx.site",
#     "custom_cookie":"token=aaa;session=bbb",
#     "whitelist_domains":["xxx.site"],
#     "download_rate_limit":524288,
# }