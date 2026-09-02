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
    "start_url": "https://www.169tp.com",   # 起始URL
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

    # ========== 资源后缀配置，在这里增删类型 ==========
    "allow_image_suffix": {".jpg", ".jpeg", ".png", ".gif", ".webp", ".bmp"},
    "allow_video_suffix": {".mp4", ".m3u8", ".webm", ".mov", ".m4v"},
    "allow_audio_suffix": {".mp3", ".wav", ".m4a", ".flac", ".ogg", ".aac"},
    "allow_doc_suffix": {".pdf", ".docx", ".doc", ".xlsx", ".xls", ".pptx", ".ppt", ".txt", ".md", ".zip", ".rar", ".7z"},
    "allow_static_suffix": {".js", ".css", ".woff", ".woff2", ".ttf", ".eot"},

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
    def __init__(self, headers: Dict, timeout: int, browser: Browser,
                 net_video_set: Set[str], net_audio_set:Set[str], net_doc_set:Set[str], net_static_set:Set[str],
                 proxy: str, block_domains: Set[str]):
        self.ua = headers.get("User‑Agent", "")
        self.referer = headers.get("Referer", "")
        self.cookie_str = headers.get("Cookie", "")
        self.timeout = timeout
        self.browser = browser
        self._net_video_set = net_video_set
        self._net_audio_set = net_audio_set
        self._net_doc_set = net_doc_set
        self._net_static_set = net_static_set
        self.proxy = proxy
        self.block_domains = block_domains
        self.cfg_suffix = CONFIG

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
                lu = u.lower()
                if any(s in lu for s in self.cfg_suffix["allow_video_suffix"]):
                    self._net_video_set.add(u)
                if any(s in lu for s in self.cfg_suffix["allow_audio_suffix"]):
                    self._net_audio_set.add(u)
                if any(s in lu for s in self.cfg_suffix["allow_doc_suffix"]):
                    self._net_doc_set.add(u)
                if any(s in lu for s in self.cfg_suffix["allow_static_suffix"]):
                    self._net_static_set.add(u)

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
    def get_dynamic_fetcher(headers: Dict, timeout: int, browser: Browser,
                            net_video_set:Set[str],net_audio_set:Set[str],net_doc_set:Set[str],net_static_set:Set[str],
                            proxy: str, block_domains: Set[str]) -> PlaywrightFetcher:
        return PlaywrightFetcher(headers, timeout, browser,
                                 net_video_set,net_audio_set,net_doc_set,net_static_set,
                                 proxy, block_domains)


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
    def extract_media_from_html(html: str, base_domain: str, block_domains: Set[str], cfg):
        image_set = set()
        video_set = set()
        audio_set = set()
        doc_set = set()
        static_set = set()
        soup = BeautifulSoup(html, "lxml")

        # img
        for img in soup.find_all("img", src=True):
            src = img["src"].strip()
            if src.startswith("data:"): continue
            full = urljoin(base_domain, src)
            if full.startswith(("http://", "https://")) and not is_block_domain(full, block_domains):
                image_set.add(full)

        # video
        for vid in soup.find_all("video", src=True):
            src = vid["src"].strip()
            if src.startswith("data:"): continue
            full = urljoin(base_domain, src)
            if full.startswith(("http://", "https://")) and not is_block_domain(full, block_domains):
                video_set.add(full)
        for src_tag in soup.find_all("source", src=True):
            src = src_tag["src"].strip()
            if src.startswith("data:"): continue
            full = urljoin(base_domain, src)
            lu = full.lower()
            if full.startswith(("http://", "https://")) and not is_block_domain(full, block_domains):
                if any(s in lu for s in cfg["allow_video_suffix"]):
                    video_set.add(full)
                if any(s in lu for s in cfg["allow_audio_suffix"]):
                    audio_set.add(full)

        # audio
        for aud in soup.find_all("audio", src=True):
            src = aud["src"].strip()
            if src.startswith("data:"): continue
            full = urljoin(base_domain, src)
            if full.startswith(("http://", "https://")) and not is_block_domain(full, block_domains):
                audio_set.add(full)

        # link css/font
        for link in soup.find_all("link", href=True):
            src = link["href"].strip()
            full = urljoin(base_domain, src)
            lu = full.lower()
            if full.startswith(("http://", "https://")) and not is_block_domain(full, block_domains):
                if any(s in lu for s in cfg["allow_static_suffix"]):
                    static_set.add(full)

        # script js
        for script in soup.find_all("script", src=True):
            src = script["src"].strip()
            full = urljoin(base_domain, src)
            lu = full.lower()
            if full.startswith(("http://", "https://")) and not is_block_domain(full, block_domains):
                if any(s in lu for s in cfg["allow_static_suffix"]):
                    static_set.add(full)

        # a标签附件文档
        for a in soup.find_all("a", href=True):
            href = a["href"].strip()
            full = urljoin(base_domain, href)
            lu = full.lower()
            if full.startswith(("http://", "https://")) and not is_block_domain(full, block_domains):
                if any(s in lu for s in cfg["allow_doc_suffix"]):
                    doc_set.add(full)

        return list(image_set), list(video_set), list(audio_set), list(doc_set), list(static_set)

    @staticmethod
    async def extract_media_from_page(page: Page, base_url: str, block_domains: Set[str], cfg):
        result = await page.evaluate("""() => {
            const imgs = new Set();
            const videos = new Set();
            const audios = new Set();
            const docs = new Set();
            const statics = new Set();
            document.querySelectorAll('img[src]').forEach(el=>{
                const s = el.src; if(s && !s.startsWith('data:')) imgs.add(s);
            });
            document.querySelectorAll('video[src]').forEach(el=>{const s=el.src;if(s)videos.add(s);});
            document.querySelectorAll('audio[src]').forEach(el=>{const s=el.src;if(s)audios.add(s);});
            document.querySelectorAll('video source[src],audio source[src]').forEach(el=>{
                const s=el.src;if(s){
                    if(s.endsWith('.mp4')||s.endsWith('.m3u8')||s.endsWith('.webm')) videos.add(s);
                    if(s.endsWith('.mp3')||s.endsWith('.m4a')) audios.add(s);
                }
            });
            document.querySelectorAll('link[href],script[src]').forEach(el=>{
                const s = el.href||el.src;
                if(s) statics.add(s);
            });
            document.querySelectorAll('a[href]').forEach(el=>{const s=el.href;if(s)docs.add(s);});
            return {imgs:Array.from(imgs),videos:Array.from(videos),audios:Array.from(audios),docs:Array.from(docs),statics:Array.from(statics)};
        }""")
        def filter_urls(lst):
            return [i for i in lst if i.startswith(("http://","https://")) and not is_block_domain(i, block_domains)]
        imgs = filter_urls(result.get("imgs",[]))
        vids = filter_urls(result.get("videos",[]))
        auds = filter_urls(result.get("audios",[]))
        docs_raw = filter_urls(result.get("docs",[]))
        stcs_raw = filter_urls(result.get("statics",[]))

        # 过滤a标签里真正的文档后缀
        doc_list=[]
        for u in docs_raw:
            lu=u.lower()
            if any(s in lu for s in cfg["allow_doc_suffix"]):
                doc_list.append(u)
        static_list=[]
        for u in stcs_raw:
            lu=u.lower()
            if any(s in lu for s in cfg["allow_static_suffix"]):
                static_list.append(u)
        return imgs, vids, auds, doc_list, static_list


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

        # 全部资源集合
        self.all_images: Set[str] = set()
        self.all_videos: Set[str] = set()
        self.all_audios: Set[str] = set()
        self.all_docs: Set[str] = set()
        self.all_statics: Set[str] = set()

        self.net_capture_videos: Set[str] = set()
        self.net_capture_audios: Set[str] = set()
        self.net_capture_docs: Set[str] = set()
        self.net_capture_statics: Set[str] = set()

        self.crawl_records: List[Dict[str, Any]] = []

        # 创建多级下载目录
        root = Path(self.cfg["download_root"])
        root.mkdir(exist_ok=True)
        (root / "images").mkdir(exist_ok=True)
        (root / "videos").mkdir(exist_ok=True)
        (root / "audios").mkdir(exist_ok=True)
        (root / "docs").mkdir(exist_ok=True)
        (root / "static").mkdir(exist_ok=True)

    async def init_browser(self):
        pw_args = {}
        if self.cfg["proxy_url"]:
            pw_args["proxy"] = {"server": self.cfg["proxy_url"]}
        self.pw_context = await async_playwright().start()
        self.browser = await self.pw_context.chromium.launch(headless=True,**pw_args)
        self.fetcher_static = FetcherFactory.get_static_fetcher(self.headers, self.timeout, self.cfg["proxy_url"])
        self.fetcher_dynamic = FetcherFactory.get_dynamic_fetcher(
            self.headers, self.timeout, self.browser,
            self.net_capture_videos, self.net_capture_audios, self.net_capture_docs, self.net_capture_statics,
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
            "total_videos": len(self.all_videos.union(self.net_capture_videos)),
            "total_audios": len(self.all_audios.union(self.net_capture_audios)),
            "total_docs": len(self.all_docs.union(self.net_capture_docs)),
            "total_statics": len(self.all_statics.union(self.net_capture_statics)),
            "page_records": self.crawl_records
        }
        with open(self.cfg["json_output_path"], "w", encoding="utf-8") as f:
            json.dump(payload, f, ensure_ascii=False, indent=2)
        logger.info(f"JSON结果已保存: {self.cfg['json_output_path']}")

    def save_media_to_file(self, filepath="assets.txt"):
        all_img = sorted(self.all_images)
        all_vid = sorted(self.all_videos.union(self.net_capture_videos))
        all_aud = sorted(self.all_audios.union(self.net_capture_audios))
        all_doc = sorted(self.all_docs.union(self.net_capture_docs))
        all_sta = sorted(self.all_statics.union(self.net_capture_statics))
        with open(filepath, "w", encoding="utf‑8") as f:
            f.write("===== IMAGE LINKS =====\n")
            for u in all_img: f.write(u+"\n")
            f.write("\n===== VIDEO LINKS =====\n")
            for u in all_vid: f.write(u+"\n")
            f.write("\n===== AUDIO LINKS =====\n")
            for u in all_aud: f.write(u+"\n")
            f.write("\n===== DOCUMENT LINKS =====\n")
            for u in all_doc: f.write(u+"\n")
            f.write("\n===== STATIC(JS/CSS/FONT) LINKS =====\n")
            for u in all_sta: f.write(u+"\n")
        logger.info(f"assets.txt已保存 | img:{len(all_img)} video:{len(all_vid)} audio:{len(all_aud)} doc:{len(all_doc)} static:{len(all_sta)}")

    async def process_downloads(self,images,videos,audios,docs,statics,net_videos,net_audios,net_docs,net_statics):
        root = Path(self.cfg["download_root"])
        img_dir = root / "images"
        vid_dir = root / "videos"
        aud_dir = root / "audios"
        doc_dir = root / "docs"
        st_dir = root / "static"

        for u in images:
            await self.downloader.download_file(u, img_dir)
        for u in audios+net_audios:
            await self.downloader.download_file(u, aud_dir)
        for u in docs+net_docs:
            await self.downloader.download_file(u, doc_dir)
        for u in statics+net_statics:
            await self.downloader.download_file(u, st_dir)

        # 视频区分m3u8
        all_video_list = videos + net_videos
        for v_url in all_video_list:
            lu = v_url.lower()
            if lu.endswith(".m3u8"):
                base_name = safe_filename(v_url).replace(".m3u8",".mp4")
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

                images:List[str]=[]
                videos:List[str]=[]
                audios:List[str]=[]
                docs:List[str]=[]
                statics:List[str]=[]
                links:List[str]=[]

                cv = list(self.net_capture_videos)
                ca = list(self.net_capture_audios)
                cd = list(self.net_capture_docs)
                cs = list(self.net_capture_statics)

                if page is not None:
                    images, videos, audios, docs, statics = await PageParser.extract_media_from_page(page,url,self.cfg["block_domains"],self.cfg)
                    html = await page.content()
                    links = PageParser.extract_links_from_html(html,url)
                elif html is not None:
                    images, videos, audios, docs, statics = PageParser.extract_media_from_html(html,url,self.cfg["block_domains"],self.cfg)
                    links = PageParser.extract_links_from_html(html,url)
                else:
                    self.fail_manager.record_fail(url,"static+dynamic all failed")
                    continue

                self.all_images.update(images)
                self.all_videos.update(videos)
                self.all_audios.update(audios)
                self.all_docs.update(docs)
                self.all_statics.update(statics)

                self.crawl_records.append({
                    "page_url":url,
                    "depth":depth,
                    "images":images,
                    "videos_dom":videos,
                    "audios_dom":audios,
                    "docs_dom":docs,
                    "statics_dom":statics,
                    "videos_network":cv,
                    "audios_network":ca,
                    "docs_network":cd,
                    "statics_network":cs
                })

                await self.process_downloads(images,videos,audios,docs,statics,cv,ca,cd,cs)
                logger.info(f"[OK] {url} | img:{len(images)} vid:{len(videos)} aud:{len(audios)} doc:{len(docs)} static:{len(statics)}")

                for link in links:
                    norm_link = self.url_manager.normalize_url(link)
                    if not self.url_manager.is_visited(norm_link) and self.url_manager.allow_enqueue(norm_link):
                        await self.task_queue.put((norm_link, depth+1))

                await asyncio.sleep(self.sleep_sec)
            except Exception:
                logger.exception("[worker exception]")
            finally:
                if 'page' in locals() and page is not None:
                    await page.close()
                self.task_queue.task_done()

    async def run(self):
        logger.info(f"FFMPEG可用：{self.downloader.ffmpeg_available}，开启下载：{self.cfg['download_enable']}，代理：{self.cfg['proxy_url'] or '无'}")
        await self.init_browser()
        await self.task_queue.put((self.start_url,0))
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
            await self.task_queue.put((u,0))
        logger.info(f"准备补爬 {len(fail_urls)} 个失败链接")


if __name__ == "__main__":
    async def main():
        spider = AsyncUniversalSpider(start_url=CONFIG["start_url"], cfg=CONFIG)
        await spider.run()
    asyncio.run(main())
