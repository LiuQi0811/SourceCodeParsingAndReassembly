import asyncio
import os
import re
import json
import functools
import subprocess
import logging
import signal
import shutil
import tempfile
from abc import ABC, abstractmethod
from typing import Set, List, Optional, Dict, Callable, Any, Tuple
from urllib.parse import urljoin, urlparse, unquote
from pathlib import Path

import aiohttp
from bs4 import BeautifulSoup
from playwright.async_api import Browser, async_playwright, Page, Response


# ===================== 配置区 =====================
CONFIG = {
    "start_url": "https://www.169tp.com",
    "max_depth": 2,
    "concurrency": 3,
    "sleep_sec": 1.0,
    "timeout": 15,
    "use_dynamic_fallback": True,
    "download_enable": True,
    "json_output_path": "crawl_result.json",
    "assets_output_path": "assets.txt",
    "download_root": "./download",

    # 按类型独立最小文件大小（字节），0=不限制
    "min_size": {
        "image": 1024 * 5,      # 5KB
        "video": 1024 * 50,     # 50KB
        "audio": 1024 * 20,     # 20KB
        "doc": 0,                # 文档不限制
        "static": 0              # js/css不限制
    },
    "min_disk_free_mb": 50,     # 磁盘剩余低于50MB停止下载

    "block_domains": {
        "google-analytics.com",
        "doubleclick.net",
        "googletagmanager.com",
        "googlesyndication.com"
    },

    "allow_image_suffix": {".jpg", ".jpeg", ".png", ".gif", ".webp", ".bmp", ".svg", ".ico"},
    "allow_video_suffix": {".mp4", ".m3u8", ".webm", ".mov", ".m4v", ".flv", ".avi"},
    "allow_audio_suffix": {".mp3", ".wav", ".m4a", ".flac", ".ogg", ".aac", ".opus"},
    "allow_doc_suffix": {".pdf", ".docx", ".doc", ".xlsx", ".xls", ".pptx", ".ppt", ".txt", ".md", ".zip", ".rar", ".7z", ".csv", ".epub"},
    "allow_static_suffix": {".js", ".css", ".woff", ".woff2", ".ttf", ".eot", ".otf", ".map"},

    # Content-Type 映射（用于无后缀URL识别）
    "content_type_map": {
        "image": {"image/", "application/octet-stream"},  # octet-stream 结合后缀二次判断
        "video": {"video/", "application/x-mpegurl", "application/vnd.apple.mpegurl"},
        "audio": {"audio/"},
        "doc": {"application/pdf", "application/msword", "application/vnd.openxmlformats",
                "application/vnd.ms-excel", "application/vnd.ms-powerpoint",
                "application/zip", "application/x-rar", "application/x-7z",
                "text/plain", "text/csv", "application/epub+zip"},
        "static": {"text/css", "application/javascript", "application/x-javascript",
                   "text/javascript", "font/", "application/font"}
    },

    "ffmpeg_path": "ffmpeg",
    "ffmpeg_timeout_sec": 120,   # ffmpeg 子进程超时，防止卡死

    "custom_referer": "",
    "custom_cookie": "",
    "proxy_url": "",
    "whitelist_domains": [],
    "download_rate_limit": 0,    # bytes/s，0=不限速

    "page_pool_size": 3,         # Playwright 页面池大小
    "log_file": "spider.log",
    "fail_page_file": "fail_urls.txt",
    "fail_resource_file": "fail_resources.txt"
}
# ==================================================


# ---------- 日志 ----------
def setup_logger(log_path: str) -> logging.Logger:
    logger = logging.getLogger("spider")
    logger.setLevel(logging.INFO)
    fmt = logging.Formatter("%(asctime)s - %(levelname)s - %(message)s")
    fh = logging.FileHandler(log_path, encoding="utf-8")
    fh.setFormatter(fmt)
    logger.addHandler(fh)
    ch = logging.StreamHandler()
    ch.setFormatter(fmt)
    logger.addHandler(ch)
    return logger

logger = setup_logger(CONFIG["log_file"])


# ---------- 工具函数 ----------
def check_ffmpeg_available(ffmpeg_bin: str) -> bool:
    try:
        subprocess.run([ffmpeg_bin, "-version"],
                       stdout=subprocess.PIPE, stderr=subprocess.PIPE, check=False)
        return True
    except Exception:
        return False


def safe_filename(url: str) -> str:
    parsed = urlparse(url)
    filename = os.path.basename(unquote(parsed.path))
    filename = re.sub(r'[\\/*?:"<>|]', "_", filename)
    if not filename or len(filename) > 180:
        filename = f"res_{abs(hash(url)) % 1000000}.dat"
    return filename


def unique_file_path(directory: Path, filename: str) -> Path:
    """文件名冲突防覆盖：自动追加 _1 _2"""
    base, ext = os.path.splitext(filename)
    candidate = directory / filename
    counter = 1
    while candidate.exists():
        candidate = directory / f"{base}_{counter}{ext}"
        counter += 1
    return candidate


def is_block_domain(url: str, block_set: Set[str]) -> bool:
    """完整域名后缀匹配，避免子串误拦"""
    p = urlparse(url)
    host = (p.hostname or "").lower()
    if not host:
        return True
    for b in block_set:
        b = b.lower()
        if host == b or host.endswith("." + b):
            return True
    return False


def is_whitelist_domain(url: str, whitelist: List[str]) -> bool:
    if not whitelist:
        return True
    p = urlparse(url)
    host = (p.hostname or "").lower()
    if not host:
        return False
    for w in whitelist:
        w = w.lower()
        if host == w or host.endswith("." + w):
            return True
    return False


def build_http_headers(cfg: Dict[str, str]) -> Dict[str, str]:
    headers = {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 13_5) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36",
        "Accept-Language": "zh-CN,zh;q=0.9",
        "Accept": "*/*"
    }
    if cfg["custom_referer"]:
        headers["Referer"] = cfg["custom_referer"]
    if cfg["custom_cookie"]:
        headers["Cookie"] = cfg["custom_cookie"]
    return headers


def ffmpeg_header_arg(headers: Dict[str, str]) -> str:
    return "".join(f"{k}: {v}\r\n" for k, v in headers.items())


def classify_url_by_suffix(url: str, cfg: Dict) -> Optional[str]:
    """根据后缀判断资源类型，返回 image/video/audio/doc/static 或 None"""
    lu = url.lower().split("?")[0].split("#")[0]
    if any(lu.endswith(s) for s in cfg["allow_image_suffix"]):
        return "image"
    if any(lu.endswith(s) for s in cfg["allow_video_suffix"]):
        return "video"
    if any(lu.endswith(s) for s in cfg["allow_audio_suffix"]):
        return "audio"
    if any(lu.endswith(s) for s in cfg["allow_doc_suffix"]):
        return "doc"
    if any(lu.endswith(s) for s in cfg["allow_static_suffix"]):
        return "static"
    return None


def classify_by_content_type(content_type: str, cfg: Dict) -> Optional[str]:
    """根据 Content-Type 判断资源类型"""
    if not content_type:
        return None
    ct = content_type.lower().split(";")[0].strip()
    for rtype, patterns in cfg["content_type_map"].items():
        for pat in patterns:
            if ct == pat or ct.startswith(pat):
                # octet-stream 太宽泛，需要结合后缀
                if pat == "application/octet-stream":
                    continue
                return rtype
    return None


def async_retry(max_retries: int = 2, delay: float = 1.0):
    def decorator(func: Callable):
        @functools.wraps(func)
        async def wrapper(*args, **kwargs):
            for attempt in range(max_retries + 1):
                try:
                    return await func(*args, **kwargs)
                except Exception:
                    if attempt >= max_retries:
                        return None
                    await asyncio.sleep(delay)
            return None
        return wrapper
    return decorator


def atomic_write(filepath: str, content: str, encoding: str = "utf-8"):
    """原子写入：先写临时文件，成功后 rename，防止崩溃损坏"""
    directory = os.path.dirname(os.path.abspath(filepath)) or "."
    fd, tmp_path = tempfile.mkstemp(dir=directory, suffix=".tmp")
    try:
        with os.fdopen(fd, "w", encoding=encoding) as f:
            f.write(content)
        os.replace(tmp_path, filepath)
    except Exception:
        try:
            os.unlink(tmp_path)
        except OSError:
            pass
        raise


def check_disk_space(path: str, min_free_mb: int) -> bool:
    """检查磁盘剩余空间"""
    try:
        usage = shutil.disk_usage(path)
        free_mb = usage.free / (1024 * 1024)
        return free_mb >= min_free_mb
    except Exception:
        return True


# ---------- 失败记录管理器 ----------
class FailManager:
    def __init__(self, page_file: str, resource_file: str):
        self.page_file = page_file
        self.resource_file = resource_file

    def record_page(self, url: str, reason: str):
        msg = f"{url} | {reason}"
        with open(self.page_file, "a", encoding="utf-8") as f:
            f.write(msg + "\n")
        logger.warning(f"[PAGE FAIL] {msg}")

    def record_resource(self, url: str, rtype: str, reason: str):
        msg = f"{url} | {rtype} | {reason}"
        with open(self.resource_file, "a", encoding="utf-8") as f:
            f.write(msg + "\n")
        logger.debug(f"[RES FAIL] {msg}")

    def load_failed_pages(self) -> List[str]:
        urls = []
        try:
            with open(self.page_file, "r", encoding="utf-8") as f:
                for line in f:
                    line = line.strip()
                    if "|" in line:
                        u, _ = line.split("|", maxsplit=1)
                        urls.append(u.strip())
        except FileNotFoundError:
            pass
        return urls


# ---------- HTML 校验 ----------
def is_html_valid(html: Optional[str]) -> bool:
    if not html:
        return False
    if len(html) < 300:
        return False
    if "<body" not in html.lower():
        return False
    return True


def get_base_href(html: str, default_base: str) -> str:
    """读取页面 <base href>，用于相对路径拼接"""
    try:
        soup = BeautifulSoup(html, "lxml")
        base_tag = soup.find("base", href=True)
        if base_tag:
            href = base_tag["href"].strip()
            if href.startswith(("http://", "https://")):
                return href
            return urljoin(default_base, href)
    except Exception:
        pass
    return default_base


# ---------- 限速写入 ----------
async def limited_write(f, chunk: bytes, rate_limit: int):
    if rate_limit <= 0:
        f.write(chunk)
        return
    f.write(chunk)
    await asyncio.sleep(len(chunk) / rate_limit)


# ---------- 资源下载器 ----------
class ResourceDownloader:
    def __init__(self, cfg: Dict[str, Any], fail_mgr: FailManager):
        self.cfg = cfg
        self.fail_mgr = fail_mgr
        self.session: Optional[aiohttp.ClientSession] = None
        self.downloaded_set: Set[str] = set()
        self.http_headers = build_http_headers(cfg)
        self.ffmpeg_available = check_ffmpeg_available(cfg["ffmpeg_path"])
        self.ffmpeg_procs: List[asyncio.subprocess.Process] = []
        self.stats = {"success": 0, "fail": 0, "skip": 0}

    async def init(self):
        self.session = aiohttp.ClientSession(timeout=aiohttp.ClientTimeout(total=30))

    async def close(self):
        if self.session:
            await self.session.close()
        # 杀掉残留 ffmpeg 子进程
        for proc in self.ffmpeg_procs:
            try:
                proc.kill()
            except Exception:
                pass

    @async_retry(max_retries=1, delay=1.0)
    async def download_file(self, url: str, save_dir: Path, rtype: str) -> Optional[Path]:
        if not self.cfg["download_enable"]:
            return None
        if is_block_domain(url, self.cfg["block_domains"]):
            return None
        if url in self.downloaded_set:
            return None
        if self.session is None:
            return None
        # 磁盘空间检查
        if not check_disk_space(str(save_dir), self.cfg["min_disk_free_mb"]):
            self.fail_mgr.record_resource(url, rtype, "disk space insufficient")
            return None

        try:
            async with self.session.get(
                url, headers=self.http_headers,
                proxy=self.cfg["proxy_url"] if self.cfg["proxy_url"] else None,
                allow_redirects=True
            ) as resp:
                if resp.status != 200:
                    self.fail_mgr.record_resource(url, rtype, f"http {resp.status}")
                    return None
                content_length = resp.headers.get("Content-Length")
                min_size = self.cfg["min_size"].get(rtype, 0)
                if content_length is not None and min_size > 0:
                    try:
                        if int(content_length) < min_size:
                            self.stats["skip"] += 1
                            return None
                    except ValueError:
                        pass
                fname = safe_filename(url)
                out_path = unique_file_path(save_dir, fname)
                with open(out_path, "wb") as f:
                    async for chunk in resp.content.iter_chunked(65536):
                        await limited_write(f, chunk, self.cfg["download_rate_limit"])
                self.downloaded_set.add(url)
                self.stats["success"] += 1
                logger.info(f"[DOWNLOAD OK] {rtype} {url} -> {out_path}")
                return out_path
        except Exception as e:
            self.stats["fail"] += 1
            self.fail_mgr.record_resource(url, rtype, str(e)[:200])
            return None

    async def download_m3u8(self, m3u8_url: str, output_mp4: Path, rtype: str = "video") -> bool:
        if not self.ffmpeg_available:
            self.fail_mgr.record_resource(m3u8_url, rtype, "ffmpeg not available")
            return False
        if is_block_domain(m3u8_url, self.cfg["block_domains"]):
            return False
        if m3u8_url in self.downloaded_set:
            return False
        if not check_disk_space(str(output_mp4.parent), self.cfg["min_disk_free_mb"]):
            self.fail_mgr.record_resource(m3u8_url, rtype, "disk space insufficient")
            return False

        try:
            header_str = ffmpeg_header_arg(self.http_headers)
            cmd = [
                self.cfg["ffmpeg_path"], "-y",
                "-headers", header_str,
                "-i", m3u8_url,
                "-c", "copy",
                str(output_mp4)
            ]
            proc = await asyncio.create_subprocess_exec(
                *cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE
            )
            self.ffmpeg_procs.append(proc)
            try:
                await asyncio.wait_for(proc.communicate(), timeout=self.cfg["ffmpeg_timeout_sec"])
            except asyncio.TimeoutError:
                proc.kill()
                await proc.wait()
                self.fail_mgr.record_resource(m3u8_url, rtype, "ffmpeg timeout")
                return False
            finally:
                if proc in self.ffmpeg_procs:
                    self.ffmpeg_procs.remove(proc)

            if proc.returncode == 0 and output_mp4.exists():
                self.downloaded_set.add(m3u8_url)
                self.stats["success"] += 1
                logger.info(f"[M3U8 OK] {m3u8_url} -> {output_mp4}")
                return True
            self.stats["fail"] += 1
            self.fail_mgr.record_resource(m3u8_url, rtype, f"ffmpeg rc={proc.returncode}")
            return False
        except Exception as e:
            self.stats["fail"] += 1
            self.fail_mgr.record_resource(m3u8_url, rtype, str(e)[:200])
            return False


# ---------- 抓取器抽象 ----------
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
                    url, headers=self.headers,
                    proxy=self.proxy if self.proxy else None,
                    timeout=aiohttp.ClientTimeout(total=self.timeout),
                    allow_redirects=True
                ) as resp:
                    if resp.status == 404:
                        return None
                    if resp.status >= 400:
                        raise Exception(f"Http status:{resp.status}")
                    return await resp.text(encoding="utf-8", errors="ignore")
        except Exception as e:
            raise e


# ---------- Playwright 页面池 ----------
class PagePool:
    """复用 Page 实例，减少频繁创建销毁"""
    def __init__(self, browser: Browser, pool_size: int, headers: Dict,
                 net_sets: Dict[str, Set[str]], proxy: str, block_domains: Set[str], cfg: Dict):
        self.browser = browser
        self.pool_size = pool_size
        self.headers = headers
        self.net_sets = net_sets
        self.proxy = proxy
        self.block_domains = block_domains
        self.cfg = cfg
        self._pool: asyncio.Queue[Page] = asyncio.Queue(maxsize=pool_size)
        self._created = 0
        self._lock = asyncio.Lock()

    async def _create_page(self) -> Page:
        page_args = {"user_agent": self.headers.get("User-Agent", "")}
        if self.proxy:
            page_args["proxy"] = {"server": self.proxy}
        page = await self.browser.new_page(**page_args)

        cookie_str = self.headers.get("Cookie", "")
        if cookie_str:
            cookies = []
            for part in cookie_str.split(";"):
                part = part.strip()
                if "=" in part:
                    k, v = part.split("=", maxsplit=1)
                    cookies.append({"name": k.strip(), "value": v.strip(), "url": "https://example.com"})
            try:
                await page.context.add_cookies(cookies)
            except Exception:
                pass
        referer = self.headers.get("Referer", "")
        if referer:
            page.set_default_http_headers({"Referer": referer})

        def on_response(resp: Response):
            u = resp.url
            if not u.startswith(("http://", "https://")):
                return
            if is_block_domain(u, self.block_domains):
                return
            # 后缀识别
            rtype = classify_url_by_suffix(u, self.cfg)
            if rtype:
                self.net_sets[rtype].add(u)
                return
            # Content-Type 识别（无后缀URL）
            ct = resp.headers.get("content-type", "")
            rtype_ct = classify_by_content_type(ct, self.cfg)
            if rtype_ct:
                self.net_sets[rtype_ct].add(u)

        page.on("response", on_response)
        return page

    async def acquire(self) -> Page:
        async with self._lock:
            if not self._pool.empty():
                return await self._pool.get()
            if self._created < self.pool_size:
                self._created += 1
                return await self._create_page()
        return await self._pool.get()

    async def release(self, page: Page):
        try:
            # 重置页面状态，导航到 about:blank 释放内存
            await page.goto("about:blank", timeout=5000)
        except Exception:
            pass
        await self._pool.put(page)

    async def close_all(self):
        while not self._pool.empty():
            try:
                page = self._pool.get_nowait()
                await page.close()
            except Exception:
                pass


class PlaywrightFetcher(BaseFetcher):
    def __init__(self, page_pool: PagePool, timeout: int):
        self.page_pool = page_pool
        self.timeout = timeout

    async def fetch(self, url: str) -> Optional[str]:
        raise NotImplementedError("使用 fetch_with_page")

    @async_retry(max_retries=1, delay=2.0)
    async def fetch_with_page(self, url: str) -> Optional[Tuple[Page, str]]:
        page = await self.page_pool.acquire()
        try:
            await page.goto(url, timeout=self.timeout * 1000)
            await page.wait_for_load_state("networkidle", timeout=self.timeout * 1000)
            await page.wait_for_timeout(1500)
            html = await page.content()
            return page, html
        except Exception:
            await self.page_pool.release(page)
            return None


# ---------- URL 管理器 ----------
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

    def normalize_url(self, url: str, base_href: Optional[str] = None) -> str:
        base = base_href or self.base_domain
        url = urljoin(base, url)
        return re.sub(r"#.*$", "", url)

    def allow_enqueue(self, url: str) -> bool:
        return is_whitelist_domain(url, self.whitelist_domains)

    def is_visited(self, url: str) -> bool:
        return url in self.visited

    def mark_visited(self, url: str):
        self.visited.add(url)


# ---------- 抓取器工厂 ----------
class FetcherFactory:
    @staticmethod
    def get_static_fetcher(headers: Dict, timeout: int, proxy: str) -> RequestsFetcher:
        return RequestsFetcher(headers, timeout, proxy)

    @staticmethod
    def get_dynamic_fetcher(page_pool: PagePool, timeout: int) -> PlaywrightFetcher:
        return PlaywrightFetcher(page_pool, timeout)


# ---------- 页面解析器 ----------
class PageParser:
    @staticmethod
    def extract_links_from_html(html: str, base_href: str) -> List[str]:
        soup = BeautifulSoup(html, "lxml")
        links = []
        for a_tag in soup.find_all("a", href=True):
            href = a_tag["href"].strip()
            if href.startswith(("javascript:", "mailto:", "tel:", "#")):
                continue
            full = urljoin(base_href, href)
            links.append(full)
        return links

    @staticmethod
    def extract_media_from_html(html: str, base_href: str, block_domains: Set[str], cfg: Dict):
        image_set, video_set, audio_set, doc_set, static_set = set(), set(), set(), set(), set()
        soup = BeautifulSoup(html, "lxml")

        for img in soup.find_all("img", src=True):
            src = img["src"].strip()
            if src.startswith("data:"):
                continue
            full = urljoin(base_href, src)
            if full.startswith(("http://", "https://")) and not is_block_domain(full, block_domains):
                image_set.add(full)

        for vid in soup.find_all("video", src=True):
            src = vid["src"].strip()
            if src.startswith("data:"):
                continue
            full = urljoin(base_href, src)
            if full.startswith(("http://", "https://")) and not is_block_domain(full, block_domains):
                video_set.add(full)

        for aud in soup.find_all("audio", src=True):
            src = aud["src"].strip()
            if src.startswith("data:"):
                continue
            full = urljoin(base_href, src)
            if full.startswith(("http://", "https://")) and not is_block_domain(full, block_domains):
                audio_set.add(full)

        for src_tag in soup.find_all("source", src=True):
            src = src_tag["src"].strip()
            if src.startswith("data:"):
                continue
            full = urljoin(base_href, src)
            if full.startswith(("http://", "https://")) and not is_block_domain(full, block_domains):
                rtype = classify_url_by_suffix(full, cfg)
                if rtype == "video":
                    video_set.add(full)
                elif rtype == "audio":
                    audio_set.add(full)

        for link in soup.find_all("link", href=True):
            src = link["href"].strip()
            full = urljoin(base_href, src)
            if full.startswith(("http://", "https://")) and not is_block_domain(full, block_domains):
                if classify_url_by_suffix(full, cfg) == "static":
                    static_set.add(full)

        for script in soup.find_all("script", src=True):
            src = script["src"].strip()
            full = urljoin(base_href, src)
            if full.startswith(("http://", "https://")) and not is_block_domain(full, block_domains):
                if classify_url_by_suffix(full, cfg) == "static":
                    static_set.add(full)

        for a in soup.find_all("a", href=True):
            href = a["href"].strip()
            if href.startswith(("javascript:", "mailto:", "tel:", "#")):
                continue
            full = urljoin(base_href, href)
            if full.startswith(("http://", "https://")) and not is_block_domain(full, block_domains):
                if classify_url_by_suffix(full, cfg) == "doc":
                    doc_set.add(full)

        return list(image_set), list(video_set), list(audio_set), list(doc_set), list(static_set)

    @staticmethod
    async def extract_media_from_page(page: Page, base_url: str, block_domains: Set[str], cfg: Dict):
        result = await page.evaluate("""() => {
            const imgs = new Set(), videos = new Set(), audios = new Set();
            const docs = new Set(), statics = new Set();
            document.querySelectorAll('img[src]').forEach(el => {
                const s = el.src; if (s && !s.startsWith('data:')) imgs.add(s);
            });
            document.querySelectorAll('video[src]').forEach(el => { const s = el.src; if (s) videos.add(s); });
            document.querySelectorAll('audio[src]').forEach(el => { const s = el.src; if (s) audios.add(s); });
            document.querySelectorAll('video source[src], audio source[src]').forEach(el => {
                const s = el.src; if (s) {
                    if (s.endsWith('.mp4') || s.endsWith('.m3u8') || s.endsWith('.webm') || s.endsWith('.mov')) videos.add(s);
                    if (s.endsWith('.mp3') || s.endsWith('.m4a') || s.endsWith('.wav')) audios.add(s);
                }
            });
            document.querySelectorAll('link[href], script[src]').forEach(el => {
                const s = el.href || el.src; if (s) statics.add(s);
            });
            document.querySelectorAll('a[href]').forEach(el => { const s = el.href; if (s) docs.add(s); });
            return {
                imgs: Array.from(imgs), videos: Array.from(videos),
                audios: Array.from(audios), docs: Array.from(docs), statics: Array.from(statics)
            };
        }""")

        def filt(lst):
            return [i for i in lst if i.startswith(("http://", "https://")) and not is_block_domain(i, block_domains)]

        imgs = filt(result.get("imgs", []))
        vids = filt(result.get("videos", []))
        auds = filt(result.get("audios", []))
        docs_raw = filt(result.get("docs", []))
        stcs_raw = filt(result.get("statics", []))

        doc_list = [u for u in docs_raw if classify_url_by_suffix(u, cfg) == "doc"]
        static_list = [u for u in stcs_raw if classify_url_by_suffix(u, cfg) == "static"]
        return imgs, vids, auds, doc_list, static_list


# ---------- 核心爬虫 ----------
class AsyncUniversalSpider:
    def __init__(self, start_url: str, cfg: Dict[str, Any]):
        self.cfg = cfg
        self.start_url = start_url
        parsed = urlparse(start_url)
        self.base_domain = f"{parsed.scheme}://{parsed.netloc}"
        self.max_depth = cfg["max_depth"]
        self.concurrency = cfg["concurrency"]
        self.sleep_sec = cfg["sleep_sec"]
        self.timeout = cfg["timeout"]
        self.use_dynamic_fallback = cfg["use_dynamic_fallback"]

        self.headers = build_http_headers(cfg)
        self.url_manager = UrlManager(self.base_domain, cfg["whitelist_domains"])
        self.fail_mgr = FailManager(cfg["fail_page_file"], cfg["fail_resource_file"])
        self.downloader = ResourceDownloader(cfg, self.fail_mgr)

        self.browser: Optional[Browser] = None
        self.pw_context = None
        self.page_pool: Optional[PagePool] = None
        self.fetcher_static: Optional[RequestsFetcher] = None
        self.fetcher_dynamic: Optional[PlaywrightFetcher] = None
        self.task_queue: asyncio.Queue = asyncio.Queue()

        self.all_images: Set[str] = set()
        self.all_videos: Set[str] = set()
        self.all_audios: Set[str] = set()
        self.all_docs: Set[str] = set()
        self.all_statics: Set[str] = set()

        self.net_capture: Dict[str, Set[str]] = {
            "image": set(), "video": set(), "audio": set(), "doc": set(), "static": set()
        }

        self.crawl_records: List[Dict[str, Any]] = []
        self.page_stats = {"success": 0, "fail": 0}
        self._shutdown = False

        # 创建下载目录
        root = Path(cfg["download_root"])
        root.mkdir(exist_ok=True)
        for sub in ["images", "videos", "audios", "docs", "static"]:
            (root / sub).mkdir(exist_ok=True)

    async def init_browser(self):
        pw_args = {}
        if self.cfg["proxy_url"]:
            pw_args["proxy"] = {"server": self.cfg["proxy_url"]}
        self.pw_context = await async_playwright().start()
        self.browser = await self.pw_context.chromium.launch(headless=True, **pw_args)

        self.page_pool = PagePool(
            self.browser, self.cfg["page_pool_size"], self.headers,
            self.net_capture, self.cfg["proxy_url"], self.cfg["block_domains"], self.cfg
        )
        self.fetcher_static = FetcherFactory.get_static_fetcher(self.headers, self.timeout, self.cfg["proxy_url"])
        self.fetcher_dynamic = FetcherFactory.get_dynamic_fetcher(self.page_pool, self.timeout)
        await self.downloader.init()

    async def close_browser(self):
        if self.page_pool:
            await self.page_pool.close_all()
        if self.browser:
            await self.browser.close()
        if self.pw_context:
            await self.pw_context.stop()
        await self.downloader.close()

    def save_json_result(self):
        payload = {
            "start_url": self.start_url,
            "page_stats": self.page_stats,
            "download_stats": self.downloader.stats,
            "total_images": len(self.all_images),
            "total_videos": len(self.all_videos.union(self.net_capture["video"])),
            "total_audios": len(self.all_audios.union(self.net_capture["audio"])),
            "total_docs": len(self.all_docs.union(self.net_capture["doc"])),
            "total_statics": len(self.all_statics.union(self.net_capture["static"])),
            "page_records": self.crawl_records
        }
        atomic_write(self.cfg["json_output_path"], json.dumps(payload, ensure_ascii=False, indent=2))
        logger.info(f"JSON已保存: {self.cfg['json_output_path']}")

    def save_media_to_file(self):
        all_img = sorted(self.all_images)
        all_vid = sorted(self.all_videos.union(self.net_capture["video"]))
        all_aud = sorted(self.all_audios.union(self.net_capture["audio"]))
        all_doc = sorted(self.all_docs.union(self.net_capture["doc"]))
        all_sta = sorted(self.all_statics.union(self.net_capture["static"]))
        lines = []
        lines.append("===== IMAGE LINKS =====\n")
        lines.extend(u + "\n" for u in all_img)
        lines.append("\n===== VIDEO LINKS =====\n")
        lines.extend(u + "\n" for u in all_vid)
        lines.append("\n===== AUDIO LINKS =====\n")
        lines.extend(u + "\n" for u in all_aud)
        lines.append("\n===== DOCUMENT LINKS =====\n")
        lines.extend(u + "\n" for u in all_doc)
        lines.append("\n===== STATIC(JS/CSS/FONT) LINKS =====\n")
        lines.extend(u + "\n" for u in all_sta)
        atomic_write(self.cfg["assets_output_path"], "".join(lines))
        logger.info(f"assets.txt已保存 | img:{len(all_img)} video:{len(all_vid)} audio:{len(all_aud)} doc:{len(all_doc)} static:{len(all_sta)}")

    async def process_downloads(self, images, videos, audios, docs, statics):
        root = Path(self.cfg["download_root"])
        for u in images:
            await self.downloader.download_file(u, root / "images", "image")
        for u in audios:
            await self.downloader.download_file(u, root / "audios", "audio")
        for u in docs:
            await self.downloader.download_file(u, root / "docs", "doc")
        for u in statics:
            await self.downloader.download_file(u, root / "static", "static")
        for v_url in videos:
            lu = v_url.lower().split("?")[0]
            if lu.endswith(".m3u8"):
                base_name = safe_filename(v_url).replace(".m3u8", ".mp4")
                out_mp4 = unique_file_path(root / "videos", base_name)
                await self.downloader.download_m3u8(v_url, out_mp4, "video")
            else:
                await self.downloader.download_file(v_url, root / "videos", "video")

    async def worker(self):
        while not self._shutdown:
            try:
                url, depth = await self.task_queue.get()
            except asyncio.CancelledError:
                break
            try:
                if self._shutdown:
                    break
                if self.url_manager.is_visited(url) or depth > self.max_depth:
                    continue
                self.url_manager.mark_visited(url)
                logger.info(f"[worker] depth={depth} url={url}")

                html: Optional[str] = None
                page: Optional[Page] = None
                base_href = self.base_domain

                html = await self.fetcher_static.fetch(url)
                if not is_html_valid(html):
                    html = None

                if html is None and self.use_dynamic_fallback and not self._shutdown:
                    result = await self.fetcher_dynamic.fetch_with_page(url)
                    if result:
                        page, html = result

                if html is None:
                    self.page_stats["fail"] += 1
                    self.fail_mgr.record_page(url, "static+dynamic all failed")
                    continue

                base_href = get_base_href(html, self.base_domain)
                self.page_stats["success"] += 1

                if page is not None:
                    images, videos, audios, docs, statics = await PageParser.extract_media_from_page(
                        page, url, self.cfg["block_domains"], self.cfg
                    )
                else:
                    images, videos, audios, docs, statics = PageParser.extract_media_from_html(
                        html, base_href, self.cfg["block_domains"], self.cfg
                    )

                # 网络捕获的资源（本页面期间累积的）
                net_snapshot = {k: list(v) for k, v in self.net_capture.items()}

                self.all_images.update(images)
                self.all_videos.update(videos)
                self.all_audios.update(audios)
                self.all_docs.update(docs)
                self.all_statics.update(statics)

                self.crawl_records.append({
                    "page_url": url, "depth": depth,
                    "images": images, "videos_dom": videos, "audios_dom": audios,
                    "docs_dom": docs, "statics_dom": statics,
                    "videos_network": net_snapshot["video"],
                    "audios_network": net_snapshot["audio"],
                    "docs_network": net_snapshot["doc"],
                    "statics_network": net_snapshot["static"]
                })

                # 合并 DOM + 网络资源去重后下载
                all_v = list(set(videos) | set(net_snapshot["video"]))
                all_a = list(set(audios) | set(net_snapshot["audio"]))
                all_d = list(set(docs) | set(net_snapshot["doc"]))
                all_s = list(set(statics) | set(net_snapshot["static"]))
                await self.process_downloads(images, all_v, all_a, all_d, all_s)

                logger.info(f"[OK] {url} | img:{len(images)} vid:{len(all_v)} aud:{len(all_a)} doc:{len(all_d)} static:{len(all_s)}")

                links = PageParser.extract_links_from_html(html, base_href)
                for link in links:
                    norm_link = self.url_manager.normalize_url(link, base_href)
                    if not self.url_manager.is_visited(norm_link) and self.url_manager.allow_enqueue(norm_link):
                        await self.task_queue.put((norm_link, depth + 1))

                await asyncio.sleep(self.sleep_sec)
            except Exception:
                logger.exception("[worker exception]")
            finally:
                if page is not None and self.page_pool:
                    await self.page_pool.release(page)
                self.task_queue.task_done()

    def request_shutdown(self):
        self._shutdown = True
        logger.info("收到退出信号，正在优雅关闭...")

    async def run(self):
        # 注册信号处理
        loop = asyncio.get_running_loop()
        for sig in (signal.SIGINT, signal.SIGTERM):
            try:
                loop.add_signal_handler(sig, self.request_shutdown)
            except NotImplementedError:
                pass

        logger.info(f"FFMPEG可用：{self.downloader.ffmpeg_available}，下载：{self.cfg['download_enable']}，代理：{self.cfg['proxy_url'] or '无'}")
        await self.init_browser()
        await self.task_queue.put((self.start_url, 0))
        workers = [asyncio.create_task(self.worker()) for _ in range(self.concurrency)]

        # 等待队列清空或收到退出信号
        while not self.task_queue.empty() and not self._shutdown:
            await asyncio.sleep(0.5)
        if not self._shutdown:
            await self.task_queue.join()

        for w in workers:
            w.cancel()
        await asyncio.gather(*workers, return_exceptions=True)
        await self.close_browser()

        self.save_media_to_file()
        self.save_json_result()
        logger.info(f"===== 完成 | 页面成功:{self.page_stats['success']} 失败:{self.page_stats['fail']} | "
                     f"下载成功:{self.downloader.stats['success']} 失败:{self.downloader.stats['fail']} =====")


if __name__ == "__main__":
    async def main():
        spider = AsyncUniversalSpider(start_url=CONFIG["start_url"], cfg=CONFIG)
        await spider.run()
    asyncio.run(main())
