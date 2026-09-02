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
from urllib.parse import urljoin, urlparse, unquote, urlunparse, parse_qs, urlencode
from pathlib import Path

import aiohttp
from bs4 import BeautifulSoup
from playwright.async_api import Browser, async_playwright, Page, Response

try:
    import m3u8
    M3U8_AVAILABLE = True
except ImportError:
    M3U8_AVAILABLE = False


# ===================== 配置区 =====================
CONFIG = {
    "start_url": "https://www.bilibili.com/",
    "max_depth": 2,
    "concurrency": 3,
    "sleep_sec": 1.0,
    "timeout": 15,
    "use_dynamic_fallback": True,
    "download_enable": True,
    "json_output_path": "crawl_result.json",
    "assets_output_path": "assets.txt",
    "download_root": "./download",

    "min_size": {
        "image": 1024 * 5, "video": 1024 * 50,
        "audio": 1024 * 20, "doc": 0, "static": 0
    },
    "min_disk_free_mb": 50,

    "block_domains": {
        "google-analytics.com", "doubleclick.net", "googletagmanager.com",
        "googlesyndication.com", "facebook.net", "facebook.com"
    },

    "thumbnail_keywords": {
        "thumb", "thumbnail", "avatar", "icon", "logo", "sprite",
        "badge", "loading", "placeholder", "default", "small", "_s.",
        "_thumb", "1x1", "pixel", "blank", "dot"
    },

    "allow_image_suffix": {".jpg", ".jpeg", ".png", ".gif", ".webp", ".bmp", ".svg", ".ico"},
    "allow_video_suffix": {".mp4", ".m3u8", ".webm", ".mov", ".m4v", ".flv", ".avi"},
    "allow_audio_suffix": {".mp3", ".wav", ".m4a", ".flac", ".ogg", ".aac", ".opus"},
    "allow_doc_suffix": {".pdf", ".docx", ".doc", ".xlsx", ".xls", ".pptx", ".ppt", ".txt", ".md", ".zip", ".rar", ".7z", ".csv", ".epub"},
    "allow_static_suffix": {".js", ".css", ".woff", ".woff2", ".ttf", ".eot", ".otf", ".map"},

    "content_type_map": {
        "image": {"image/"},
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
    "ffmpeg_timeout_sec": 120,

    "custom_referer": "",
    "custom_cookie": "",

    "proxy_pool": [],
    "proxy_health_check_url": "https://www.google.com",
    "proxy_max_fail": 3,

    "whitelist_domains": [],
    "download_rate_limit": 0,

    "page_pool_size": 3,
    "log_file": "spider.log",
    "fail_page_file": "fail_urls.txt",
    "fail_resource_file": "fail_resources.txt",

    "strip_url_query_keys": ["t", "_t", "timestamp", "v", "ver", "cache", "_", "rand"],
    "enable_js_css_extract": True,
    "iframe_recursive": False,
    "scan_only_mode": False,
    "snapshot_file": "spider_snapshot.json",

    # ===== 新增：自动滚动懒加载 =====
    "enable_auto_scroll": True,
    "scroll_step": 800,
    "scroll_sleep_ms": 600,
    "scroll_max_times": 20,

    # ===== 新增：TS分片组装虚拟m3u8下载（blob视频）=====
    "enable_ts_assemble": True,
    "ts_min_segments": 3,   # 至少收集到3个ts分片才尝试组装
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
    base, ext = os.path.splitext(filename)
    candidate = directory / filename
    counter = 1
    while candidate.exists():
        candidate = directory / f"{base}_{counter}{ext}"
        counter += 1
    return candidate


def is_data_uri(url: str) -> bool:
    return bool(url) and url.strip().lower().startswith("data:")


def is_thumbnail_url(url: str, keywords: Set[str]) -> bool:
    if not url:
        return False
    lu = url.lower()
    path = urlparse(lu).path
    for kw in keywords:
        if kw in path or kw in lu:
            return True
    return False


def is_block_domain(url: str, block_set: Set[str]) -> bool:
    if not url or not block_set:
        return False
    p = urlparse(url)
    host = (p.hostname or "").lower()
    if not host:
        return True
    if re.match(r'^\d+\.\d+\.\d+\.\d+$', host):
        return host in {b.lower() for b in block_set}
    for b in block_set:
        b = b.lower()
        if host == b or host.endswith("." + b):
            return True
    return False


def is_whitelist_domain(url: str, whitelist: List[str]) -> bool:
    if not whitelist:
        return True
    if not url:
        return False
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
    if cfg.get("custom_referer"):
        headers["Referer"] = cfg["custom_referer"]
    if cfg.get("custom_cookie"):
        headers["Cookie"] = cfg["custom_cookie"]
    return headers


def ffmpeg_header_arg(headers: Dict[str, str]) -> str:
    return "".join(f"{k}: {v}\r\n" for k, v in headers.items())


def normalize_url_for_dedup(url: str, strip_keys: List[str]) -> str:
    if not url:
        return url
    p = urlparse(url)
    qs = parse_qs(p.query, keep_blank_values=True)
    new_qs = {k: v for k, v in qs.items() if k.lower() not in strip_keys}
    new_query = urlencode(new_qs, doseq=True)
    return urlunparse((p.scheme, p.netloc, p.path, p.params, new_query, ""))


def extract_url_from_text(text: str) -> List[str]:
    if not text:
        return []
    pattern = re.compile(r'https?://[^\'")\s>]+', re.I)
    matches = pattern.findall(text)
    out = []
    for m in matches:
        m = m.rstrip(r'\\;,.)')
        if m.startswith(("http://", "https://")):
            out.append(m)
    return out


def classify_url_by_suffix(url: str, cfg: Dict) -> Optional[str]:
    if not url:
        return None
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
    if not content_type:
        return None
    ct = content_type.lower().split(";")[0].strip()
    for rtype, patterns in cfg["content_type_map"].items():
        for pat in patterns:
            if ct == pat or ct.startswith(pat):
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
    try:
        usage = shutil.disk_usage(path)
        return (usage.free / (1024 * 1024)) >= min_free_mb
    except Exception:
        return True


def is_html_valid(html: Optional[str]) -> bool:
    if not html:
        return False
    if len(html) < 300:
        return False
    return "<body" in html.lower()


def get_base_href(html: str, default_base: str) -> str:
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


async def limited_write(f, chunk: bytes, rate_limit: int):
    if rate_limit <= 0:
        f.write(chunk)
        return
    f.write(chunk)
    await asyncio.sleep(len(chunk) / rate_limit)


# ---------- 自动滚动懒加载 ----------
async def auto_scroll_page(page: Page, scroll_step: int = 800,
                            sleep_ms: int = 600, max_scroll_times: int = 20):
    """页面自动滚动，触发懒加载资源"""
    for _ in range(max_scroll_times):
        await page.evaluate(f"window.scrollBy(0, {scroll_step})")
        await page.wait_for_timeout(sleep_ms)
        is_end = await page.evaluate("""
            () => window.scrollY + window.innerHeight >= document.body.scrollHeight - 100
        """)
        if is_end:
            break
    await page.evaluate("window.scrollTo(0,0)")
    await page.wait_for_timeout(800)


# ---------- TS分片收集器（组装虚拟m3u8） ----------
class TsSegmentCollector:
    def __init__(self):
        self.base_url: Optional[str] = None
        self.ts_list: List[str] = []

    def collect_ts(self, resp_url: str):
        if not resp_url:
            return
        lu = resp_url.lower().split("?")[0]
        if lu.endswith(".ts") or ".ts?" in resp_url.lower():
            if resp_url not in self.ts_list:
                self.ts_list.append(resp_url)
            if not self.base_url:
                idx = resp_url.rfind("/")
                self.base_url = resp_url[:idx + 1]

    def build_virtual_m3u8(self) -> Optional[str]:
        if not self.ts_list:
            return None
        lines = ["#EXTM3U", "#EXT-X-VERSION:3", "#EXT-X-TARGETDURATION:8"]
        for ts in self.ts_list:
            lines.append("#EXTINF:7.0,")
            lines.append(ts)
        lines.append("#EXT-X-ENDLIST")
        return "\n".join(lines)

    def reset(self):
        self.base_url = None
        self.ts_list = []


# ---------- 代理池 ----------
class ProxyPool:
    def __init__(self, proxy_list: List[str], health_check_url: str, max_fail: int = 3):
        self.proxy_list = proxy_list or []
        self.health_check_url = health_check_url
        self.max_fail = max_fail
        self.fail_count: Dict[str, int] = {p: 0 for p in self.proxy_list}
        self.alive: Set[str] = set(self.proxy_list)
        self.index = 0
        self._lock = asyncio.Lock()

    async def health_check(self, timeout: int = 8):
        if not self.proxy_list:
            logger.info("代理池为空，不使用代理")
            return
        logger.info(f"开始代理健康检测，共 {len(self.proxy_list)} 个")
        tasks = [self._check_one(p, timeout) for p in self.proxy_list]
        await asyncio.gather(*tasks, return_exceptions=True)
        logger.info(f"代理健康检测完成，可用 {len(self.alive)}/{len(self.proxy_list)}")

    async def _check_one(self, proxy: str, timeout: int):
        try:
            async with aiohttp.ClientSession(timeout=aiohttp.ClientTimeout(total=timeout)) as session:
                async with session.get(self.health_check_url, proxy=proxy) as resp:
                    if resp.status < 500:
                        self.alive.add(proxy)
                        logger.info(f"代理可用: {proxy}")
                        return
        except Exception as e:
            logger.warning(f"代理不可用: {proxy} ({str(e)[:80]})")
        self.alive.discard(proxy)

    async def get(self) -> Optional[str]:
        if not self.alive:
            return None
        async with self._lock:
            alive_list = list(self.alive)
            if not alive_list:
                return None
            p = alive_list[self.index % len(alive_list)]
            self.index += 1
            return p

    def mark_fail(self, proxy: Optional[str]):
        if not proxy or proxy not in self.fail_count:
            return
        self.fail_count[proxy] += 1
        if self.fail_count[proxy] >= self.max_fail:
            self.alive.discard(proxy)
            logger.warning(f"代理连续失败 {self.max_fail} 次，已剔除: {proxy}")

    def mark_success(self, proxy: Optional[str]):
        if proxy and proxy in self.fail_count:
            self.fail_count[proxy] = 0


# ---------- 失败记录 ----------
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


# ---------- 资源元信息 ----------
class ResourceMeta:
    def __init__(self, url: str, rtype: str, source: str = "dom"):
        self.url = url
        self.rtype = rtype
        self.source = source
        self.content_type: Optional[str] = None
        self.size: Optional[int] = None
        self.downloaded: bool = False
        self.local_path: Optional[str] = None
        self.error: Optional[str] = None

    def to_dict(self) -> Dict:
        return {
            "url": self.url, "type": self.rtype, "source": self.source,
            "content_type": self.content_type, "size": self.size,
            "downloaded": self.downloaded, "local_path": self.local_path,
            "error": self.error
        }


# ---------- 资源下载器 ----------
class ResourceDownloader:
    def __init__(self, cfg: Dict[str, Any], fail_mgr: FailManager, proxy_pool: Optional[ProxyPool] = None):
        self.cfg = cfg
        self.fail_mgr = fail_mgr
        self.proxy_pool = proxy_pool
        self.session: Optional[aiohttp.ClientSession] = None
        self.downloaded_set: Set[str] = set()
        self.http_headers = build_http_headers(cfg)
        self.ffmpeg_available = check_ffmpeg_available(cfg["ffmpeg_path"])
        self.ffmpeg_procs: List[asyncio.subprocess.Process] = []
        self.stats = {"success": 0, "fail": 0, "skip": 0}
        self.meta_store: Dict[str, ResourceMeta] = {}

    async def init(self):
        self.session = aiohttp.ClientSession(timeout=aiohttp.ClientTimeout(total=30))

    async def close(self):
        if self.session:
            await self.session.close()
        for proc in self.ffmpeg_procs:
            try:
                proc.kill()
            except Exception:
                pass

    def get_meta(self, url: str, rtype: str, source: str = "dom") -> ResourceMeta:
        if url not in self.meta_store:
            self.meta_store[url] = ResourceMeta(url, rtype, source)
        return self.meta_store[url]

    @async_retry(max_retries=1, delay=1.0)
    async def download_file(self, url: str, save_dir: Path, rtype: str, source: str = "dom") -> Optional[Path]:
        meta = self.get_meta(url, rtype, source)
        if not self.cfg["download_enable"]:
            return None
        if is_data_uri(url) or is_block_domain(url, self.cfg["block_domains"]):
            return None
        if rtype == "image" and is_thumbnail_url(url, self.cfg["thumbnail_keywords"]):
            self.stats["skip"] += 1
            return None
        if url in self.downloaded_set:
            return None
        if self.session is None:
            return None
        if not check_disk_space(str(save_dir), self.cfg["min_disk_free_mb"]):
            meta.error = "disk space insufficient"
            self.fail_mgr.record_resource(url, rtype, "disk space insufficient")
            return None

        proxy = await self.proxy_pool.get() if self.proxy_pool else None
        try:
            async with self.session.get(
                url, headers=self.http_headers, proxy=proxy, allow_redirects=True
            ) as resp:
                if resp.status != 200:
                    meta.error = f"http {resp.status}"
                    self.fail_mgr.record_resource(url, rtype, f"http {resp.status}")
                    if proxy:
                        self.proxy_pool.mark_fail(proxy)
                    return None
                if proxy:
                    self.proxy_pool.mark_success(proxy)

                meta.content_type = resp.headers.get("Content-Type", "")
                content_length = resp.headers.get("Content-Length")
                if content_length:
                    try:
                        meta.size = int(content_length)
                    except ValueError:
                        pass

                min_size = self.cfg["min_size"].get(rtype, 0)
                if meta.size is not None and min_size > 0 and meta.size < min_size:
                    self.stats["skip"] += 1
                    return None

                fname = safe_filename(url)
                out_path = unique_file_path(save_dir, fname)
                with open(out_path, "wb") as f:
                    async for chunk in resp.content.iter_chunked(65536):
                        await limited_write(f, chunk, self.cfg["download_rate_limit"])
                self.downloaded_set.add(url)
                meta.downloaded = True
                meta.local_path = str(out_path)
                if meta.size is None:
                    meta.size = out_path.stat().st_size
                self.stats["success"] += 1
                logger.info(f"[DOWNLOAD OK] {rtype}({source}) {url} -> {out_path}")
                return out_path
        except Exception as e:
            self.stats["fail"] += 1
            meta.error = str(e)[:200]
            self.fail_mgr.record_resource(url, rtype, str(e)[:200])
            if proxy:
                self.proxy_pool.mark_fail(proxy)
            return None

    async def download_m3u8(self, m3u8_url: str, output_mp4: Path, rtype: str = "video",
                             source: str = "dom", nested_depth: int = 0) -> bool:
        MAX_NEST = 2
        meta = self.get_meta(m3u8_url, rtype, source)
        if nested_depth > MAX_NEST:
            meta.error = "m3u8嵌套层数超限"
            self.fail_mgr.record_resource(m3u8_url, rtype, "m3u8嵌套层数超限")
            return False
        if not self.ffmpeg_available:
            meta.error = "ffmpeg not available"
            self.fail_mgr.record_resource(m3u8_url, rtype, "ffmpeg not available")
            return False
        if is_data_uri(m3u8_url) or is_block_domain(m3u8_url, self.cfg["block_domains"]):
            return False
        if m3u8_url in self.downloaded_set:
            return False
        if not check_disk_space(str(output_mp4.parent), self.cfg["min_disk_free_mb"]):
            meta.error = "disk space insufficient"
            self.fail_mgr.record_resource(m3u8_url, rtype, "disk space insufficient")
            return False

        if M3U8_AVAILABLE and nested_depth == 0:
            try:
                proxy = await self.proxy_pool.get() if self.proxy_pool else None
                async with self.session.get(m3u8_url, headers=self.http_headers,
                                            proxy=proxy, timeout=aiohttp.ClientTimeout(total=10)) as resp:
                    text = await resp.text()
                    m3u_obj = m3u8.loads(text)
                    if m3u_obj.is_variant and m3u_obj.playlists:
                        first_sub = m3u_obj.playlists[0].absolute_uri
                        logger.info(f"检测嵌套m3u8，跳转子流 {first_sub}")
                        return await self.download_m3u8(first_sub, output_mp4, rtype, source, nested_depth + 1)
            except Exception:
                pass

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
                meta.error = "ffmpeg timeout"
                self.fail_mgr.record_resource(m3u8_url, rtype, "ffmpeg timeout")
                return False
            finally:
                if proc in self.ffmpeg_procs:
                    self.ffmpeg_procs.remove(proc)

            if proc.returncode == 0 and output_mp4.exists():
                self.downloaded_set.add(m3u8_url)
                meta.downloaded = True
                meta.local_path = str(output_mp4)
                meta.size = output_mp4.stat().st_size
                self.stats["success"] += 1
                logger.info(f"[M3U8 OK] {m3u8_url} -> {output_mp4}")
                return True
            self.stats["fail"] += 1
            meta.error = f"ffmpeg rc={proc.returncode}"
            self.fail_mgr.record_resource(m3u8_url, rtype, f"ffmpeg rc={proc.returncode}")
            return False
        except Exception as e:
            self.stats["fail"] += 1
            meta.error = str(e)[:200]
            self.fail_mgr.record_resource(m3u8_url, rtype, str(e)[:200])
            return False

    async def download_from_virtual_m3u8(self, m3u8_text: str, output_mp4: Path,
                                           source: str = "ts_assemble") -> bool:
        """通过ffmpeg pipe输入虚拟m3u8，下载TS分片合并成mp4"""
        meta = self.get_meta(f"virtual_m3u8_{abs(hash(m3u8_text)) % 100000}", "video", source)
        if not self.ffmpeg_available or not self.cfg["download_enable"]:
            return False
        if not check_disk_space(str(output_mp4.parent), self.cfg["min_disk_free_mb"]):
            return False
        try:
            header_str = ffmpeg_header_arg(self.http_headers)
            cmd = [
                self.cfg["ffmpeg_path"], "-hide_banner", "-loglevel", "warning",
                "-headers", header_str,
                "-i", "-",
                "-c", "copy", "-y",
                str(output_mp4)
            ]
            proc = await asyncio.create_subprocess_exec(
                *cmd, stdin=subprocess.PIPE,
                stdout=subprocess.PIPE, stderr=subprocess.PIPE
            )
            self.ffmpeg_procs.append(proc)
            try:
                proc.stdin.write(m3u8_text.encode("utf-8"))
                await proc.stdin.drain()
                proc.stdin.close()
                await asyncio.wait_for(proc.wait(), timeout=self.cfg["ffmpeg_timeout_sec"])
            except asyncio.TimeoutError:
                proc.kill()
                await proc.wait()
                meta.error = "ffmpeg timeout"
                return False
            finally:
                if proc in self.ffmpeg_procs:
                    self.ffmpeg_procs.remove(proc)

            if proc.returncode == 0 and output_mp4.exists():
                meta.downloaded = True
                meta.local_path = str(output_mp4)
                meta.size = output_mp4.stat().st_size
                self.stats["success"] += 1
                logger.info(f"[TS ASSEMBLE OK] {len(m3u8_text.splitlines())} segments -> {output_mp4}")
                return True
            self.stats["fail"] += 1
            meta.error = f"ffmpeg rc={proc.returncode}"
            return False
        except Exception as e:
            self.stats["fail"] += 1
            meta.error = str(e)[:200]
            return False


# ---------- 抓取器 ----------
class BaseFetcher(ABC):
    @abstractmethod
    async def fetch(self, url: str) -> Optional[str]:
        pass


class RequestsFetcher(BaseFetcher):
    def __init__(self, headers: Dict, timeout: int, proxy_pool: Optional[ProxyPool] = None):
        self.headers = headers
        self.timeout = timeout
        self.proxy_pool = proxy_pool

    @async_retry(max_retries=2, delay=1.2)
    async def fetch(self, url: str) -> Optional[str]:
        proxy = await self.proxy_pool.get() if self.proxy_pool else None
        try:
            async with aiohttp.ClientSession() as session:
                async with session.get(
                    url, headers=self.headers, proxy=proxy,
                    timeout=aiohttp.ClientTimeout(total=self.timeout),
                    allow_redirects=True
                ) as resp:
                    if proxy:
                        self.proxy_pool.mark_success(proxy)
                    if resp.status == 404:
                        return None
                    if resp.status >= 400:
                        raise Exception(f"Http status:{resp.status}")
                    return await resp.text(encoding="utf-8", errors="ignore")
        except Exception as e:
            if proxy:
                self.proxy_pool.mark_fail(proxy)
            raise e


# ---------- Playwright 页面池 ----------
class PagePool:
    def __init__(self, browser: Browser, pool_size: int, headers: Dict,
                 net_sets: Dict[str, Set[str]], proxy_pool: Optional[ProxyPool],
                 block_domains: Set[str], cfg: Dict,
                 ts_collector: Optional[TsSegmentCollector] = None):
        self.browser = browser
        self.pool_size = pool_size
        self.headers = headers
        self.net_sets = net_sets
        self.proxy_pool = proxy_pool
        self.block_domains = block_domains
        self.cfg = cfg
        self.ts_collector = ts_collector
        self._pool: asyncio.Queue[Page] = asyncio.Queue(maxsize=pool_size)
        self._created = 0
        self._lock = asyncio.Lock()

    async def _create_page(self) -> Page:
        page_args = {"user_agent": self.headers.get("User-Agent", "")}
        proxy = await self.proxy_pool.get() if self.proxy_pool else None
        if proxy:
            page_args["proxy"] = {"server": proxy}
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
            if not u or not u.startswith(("http://", "https://")):
                return
            if is_data_uri(u) or is_block_domain(u, self.block_domains):
                return
            # 收集TS分片
            if self.ts_collector:
                self.ts_collector.collect_ts(u)
            rtype = classify_url_by_suffix(u, self.cfg)
            if rtype:
                if rtype == "image" and is_thumbnail_url(u, self.cfg["thumbnail_keywords"]):
                    return
                self.net_sets[rtype].add(u)
                return
            ct = resp.headers.get("content-type", "")
            rtype_ct = classify_by_content_type(ct, self.cfg)
            if rtype_ct:
                if rtype_ct == "image" and is_thumbnail_url(u, self.cfg["thumbnail_keywords"]):
                    return
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
    def __init__(self, page_pool: PagePool, timeout: int, cfg: Dict):
        self.page_pool = page_pool
        self.timeout = timeout
        self.cfg = cfg

    async def fetch(self, url: str) -> Optional[str]:
        raise NotImplementedError("使用 fetch_with_page")

    @async_retry(max_retries=1, delay=2.0)
    async def fetch_with_page(self, url: str) -> Optional[Tuple[Page, str]]:
        page = await self.page_pool.acquire()
        try:
            await page.goto(url, timeout=self.timeout * 1000)
            await page.wait_for_load_state("networkidle", timeout=self.timeout * 1000)
            # 自动滚动懒加载
            if self.cfg.get("enable_auto_scroll"):
                await auto_scroll_page(
                    page,
                    scroll_step=self.cfg.get("scroll_step", 800),
                    sleep_ms=self.cfg.get("scroll_sleep_ms", 600),
                    max_scroll_times=self.cfg.get("scroll_max_times", 20)
                )
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

    def __init__(self, base_domain: str, whitelist_domains: List[str], strip_keys: List[str]):
        self.base_domain = base_domain
        self.whitelist_domains = whitelist_domains
        self.strip_keys = strip_keys
        self.visited_raw: Set[str] = set()
        self.visited_norm: Set[str] = set()

    def normalize_url(self, url: str, base_href: Optional[str] = None) -> str:
        if not url:
            return url
        base = base_href or self.base_domain
        url = urljoin(base, url)
        return re.sub(r"#.*$", "", url)

    def get_dedup_key(self, raw_url: str) -> str:
        return normalize_url_for_dedup(raw_url, self.strip_keys)

    def allow_enqueue(self, url: str) -> bool:
        return is_whitelist_domain(url, self.whitelist_domains)

    def is_visited(self, url: str) -> bool:
        norm = self.get_dedup_key(url)
        return norm in self.visited_norm

    def mark_visited(self, url: str):
        self.visited_raw.add(url)
        self.visited_norm.add(self.get_dedup_key(url))


# ---------- 页面解析器 ----------
class PageParser:
    @staticmethod
    def extract_links_from_html(html: str, base_href: str) -> List[str]:
        soup = BeautifulSoup(html, "lxml")
        links = []
        for a_tag in soup.find_all("a", href=True):
            href = a_tag["href"].strip()
            if not href or href.startswith(("javascript:", "mailto:", "tel:", "#")) or is_data_uri(href):
                continue
            full = urljoin(base_href, href)
            links.append(full)
        return links

    @staticmethod
    def extract_js_css_urls(soup: BeautifulSoup, base_href: str, block_domains: Set[str], cfg: Dict) -> List[str]:
        out = []
        if not cfg.get("enable_js_css_extract", False):
            return out
        for script in soup.find_all("script"):
            txt = script.string
            if not txt:
                continue
            for fu in extract_url_from_text(txt):
                fu = urljoin(base_href, fu)
                if fu.startswith(("http://", "https://")) and not is_data_uri(fu) and not is_block_domain(fu, block_domains):
                    out.append(fu)
        for style in soup.find_all("style"):
            txt = style.string
            if not txt:
                continue
            for fu in extract_url_from_text(txt):
                fu = urljoin(base_href, fu)
                if fu.startswith(("http://", "https://")) and not is_data_uri(fu) and not is_block_domain(fu, block_domains):
                    out.append(fu)
        return out

    @staticmethod
    def get_iframe_src_list(html: str, base_href: str) -> List[str]:
        soup = BeautifulSoup(html, "lxml")
        srcs = []
        for iframe in soup.find_all("iframe", src=True):
            src = iframe["src"].strip()
            if not src or src.startswith(("javascript:", "#", "about:")) or is_data_uri(src):
                continue
            srcs.append(urljoin(base_href, src))
        return srcs

    @staticmethod
    def extract_media_from_html(html: str, base_href: str, block_domains: Set[str], cfg: Dict):
        image_set, video_set, audio_set, doc_set, static_set = set(), set(), set(), set(), set()
        soup = BeautifulSoup(html, "lxml")
        thumb_kw = cfg["thumbnail_keywords"]

        def _add(target_set, src, rtype):
            if not src or src.startswith("data:") or is_data_uri(src):
                return
            full = urljoin(base_href, src)
            if not full.startswith(("http://", "https://")) or is_block_domain(full, block_domains):
                return
            if rtype == "image" and is_thumbnail_url(full, thumb_kw):
                return
            target_set.add(full)

        for img in soup.find_all("img", src=True):
            _add(image_set, img["src"].strip(), "image")
        for vid in soup.find_all("video", src=True):
            _add(video_set, vid["src"].strip(), "video")
        for aud in soup.find_all("audio", src=True):
            _add(audio_set, aud["src"].strip(), "audio")
        for src_tag in soup.find_all("source", src=True):
            src = src_tag["src"].strip()
            full = urljoin(base_href, src)
            if full.startswith(("http://", "https://")) and not is_block_domain(full, block_domains) and not is_data_uri(src):
                rtype = classify_url_by_suffix(full, cfg)
                if rtype == "video":
                    video_set.add(full)
                elif rtype == "audio":
                    audio_set.add(full)
        for link in soup.find_all("link", href=True):
            src = link["href"].strip()
            full = urljoin(base_href, src)
            if full.startswith(("http://", "https://")) and not is_block_domain(full, block_domains) and not is_data_uri(src):
                if classify_url_by_suffix(full, cfg) == "static":
                    static_set.add(full)
        for script in soup.find_all("script", src=True):
            src = script["src"].strip()
            full = urljoin(base_href, src)
            if full.startswith(("http://", "https://")) and not is_block_domain(full, block_domains) and not is_data_uri(src):
                if classify_url_by_suffix(full, cfg) == "static":
                    static_set.add(full)
        for a in soup.find_all("a", href=True):
            href = a["href"].strip()
            if not href or href.startswith(("javascript:", "mailto:", "tel:", "#")) or is_data_uri(href):
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
            return [i for i in lst if i and i.startswith(("http://", "https://"))
                    and not is_data_uri(i) and not is_block_domain(i, block_domains)]

        thumb_kw = cfg["thumbnail_keywords"]
        imgs = [i for i in filt(result.get("imgs", [])) if not is_thumbnail_url(i, thumb_kw)]
        vids = filt(result.get("videos", []))
        auds = filt(result.get("audios", []))
        docs_raw = filt(result.get("docs", []))
        stcs_raw = filt(result.get("statics", []))
        doc_list = [u for u in docs_raw if classify_url_by_suffix(u, cfg) == "doc"]
        static_list = [u for u in stcs_raw if classify_url_by_suffix(u, cfg) == "static"]
        return imgs, vids, auds, doc_list, static_list


# ---------- 快照 ----------
def dump_snapshot(filepath: str, queue_items: list, visited_raw: set, records: list):
    payload = {"queue": queue_items, "visited": list(visited_raw), "records": records}
    atomic_write(filepath, json.dumps(payload, ensure_ascii=False, indent=2))


def load_snapshot(filepath: str) -> Optional[Dict]:
    try:
        with open(filepath, "r", encoding="utf-8") as f:
            return json.load(f)
    except FileNotFoundError:
        return None


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

        if cfg.get("scan_only_mode"):
            cfg["download_enable"] = False
            self.sleep_sec = min(self.sleep_sec, 0.2)

        self.headers = build_http_headers(cfg)
        self.url_manager = UrlManager(self.base_domain, cfg["whitelist_domains"], cfg["strip_url_query_keys"])
        self.fail_mgr = FailManager(cfg["fail_page_file"], cfg["fail_resource_file"])
        self.proxy_pool = ProxyPool(cfg.get("proxy_pool", []), cfg.get("proxy_health_check_url", "https://www.google.com"), cfg.get("proxy_max_fail", 3))
        self.downloader = ResourceDownloader(cfg, self.fail_mgr, self.proxy_pool)
        self.ts_collector = TsSegmentCollector()

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

        root = Path(cfg["download_root"])
        root.mkdir(exist_ok=True)
        for sub in ["images", "videos", "audios", "docs", "static"]:
            (root / sub).mkdir(exist_ok=True)

    async def init_browser(self):
        await self.proxy_pool.health_check()
        pw_args = {}
        proxy = await self.proxy_pool.get()
        if proxy:
            pw_args["proxy"] = {"server": proxy}
        self.pw_context = await async_playwright().start()
        self.browser = await self.pw_context.chromium.launch(headless=True, **pw_args)

        self.page_pool = PagePool(
            self.browser, self.cfg["page_pool_size"], self.headers,
            self.net_capture, self.proxy_pool, self.cfg["block_domains"], self.cfg,
            self.ts_collector
        )
        self.fetcher_static = RequestsFetcher(self.headers, self.timeout, self.proxy_pool)
        self.fetcher_dynamic = PlaywrightFetcher(self.page_pool, self.timeout, self.cfg)
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
        resource_meta_list = [m.to_dict() for m in self.downloader.meta_store.values()]
        payload = {
            "start_url": self.start_url,
            "page_stats": self.page_stats,
            "download_stats": self.downloader.stats,
            "total_images": len(self.all_images),
            "total_videos": len(self.all_videos.union(self.net_capture["video"])),
            "total_audios": len(self.all_audios.union(self.net_capture["audio"])),
            "total_docs": len(self.all_docs.union(self.net_capture["doc"])),
            "total_statics": len(self.all_statics.union(self.net_capture["static"])),
            "resources_meta": resource_meta_list,
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

    def save_snapshot(self):
        queue_items = []
        temp_queue = []
        while not self.task_queue.empty():
            try:
                item = self.task_queue.get_nowait()
                queue_items.append(list(item))
                temp_queue.append(item)
            except asyncio.QueueEmpty:
                break
        for item in temp_queue:
            self.task_queue.put_nowait(item)
        dump_snapshot(self.cfg["snapshot_file"], queue_items, self.url_manager.visited_raw, self.crawl_records)
        logger.info(f"快照已保存: {self.cfg['snapshot_file']} (队列剩余 {len(queue_items)})")

    async def process_downloads(self, images, videos, audios, docs, statics, source: str = "dom"):
        root = Path(self.cfg["download_root"])
        for u in images:
            await self.downloader.download_file(u, root / "images", "image", source)
        for u in audios:
            await self.downloader.download_file(u, root / "audios", "audio", source)
        for u in docs:
            await self.downloader.download_file(u, root / "docs", "doc", source)
        for u in statics:
            await self.downloader.download_file(u, root / "static", "static", source)
        for v_url in videos:
            lu = v_url.lower().split("?")[0]
            if lu.endswith(".m3u8"):
                base_name = safe_filename(v_url).replace(".m3u8", ".mp4")
                out_mp4 = unique_file_path(root / "videos", base_name)
                await self.downloader.download_m3u8(v_url, out_mp4, "video", source)
            else:
                await self.downloader.download_file(v_url, root / "videos", "video", source)

    async def process_ts_assemble(self, page_url: str):
        """处理TS分片组装虚拟m3u8下载"""
        if not self.cfg.get("enable_ts_assemble"):
            return
        if len(self.ts_collector.ts_list) < self.cfg.get("ts_min_segments", 3):
            self.ts_collector.reset()
            return
        virtual_m3u8 = self.ts_collector.build_virtual_m3u8()
        if not virtual_m3u8:
            self.ts_collector.reset()
            return
        logger.info(f"[TS ASSEMBLE] 页面 {page_url} 收集到 {len(self.ts_collector.ts_list)} 个TS分片，开始组装下载")
        root = Path(self.cfg["download_root"])
        out_name = f"ts_assembled_{abs(hash(page_url)) % 100000}.mp4"
        out_mp4 = unique_file_path(root / "videos", out_name)
        await self.downloader.download_from_virtual_m3u8(virtual_m3u8, out_mp4)
        self.ts_collector.reset()

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
                self.ts_collector.reset()

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
                    page_source = "network"
                    # TS分片组装下载
                    await self.process_ts_assemble(url)
                else:
                    images, videos, audios, docs, statics = PageParser.extract_media_from_html(
                        html, base_href, self.cfg["block_domains"], self.cfg
                    )
                    page_source = "dom"

                # JS/CSS 文本提取
                js_css_urls = PageParser.extract_js_css_urls(
                    BeautifulSoup(html, "lxml"), base_href, self.cfg["block_domains"], self.cfg
                )
                js_css_images, js_css_videos, js_css_audios, js_css_docs, js_css_statics = [], [], [], [], []
                for ju in js_css_urls:
                    rtype = classify_url_by_suffix(ju, self.cfg)
                    if rtype == "image" and not is_thumbnail_url(ju, self.cfg["thumbnail_keywords"]):
                        js_css_images.append(ju)
                    elif rtype == "video":
                        js_css_videos.append(ju)
                    elif rtype == "audio":
                        js_css_audios.append(ju)
                    elif rtype == "doc":
                        js_css_docs.append(ju)
                    elif rtype == "static":
                        js_css_statics.append(ju)

                images = list(set(images) | set(js_css_images))
                videos = list(set(videos) | set(js_css_videos))
                audios = list(set(audios) | set(js_css_audios))
                docs = list(set(docs) | set(js_css_docs))
                statics = list(set(statics) | set(js_css_statics))

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
                    "statics_network": net_snapshot["static"],
                    "ts_segments": len(self.ts_collector.ts_list)
                })

                all_v = list(set(videos) | set(net_snapshot["video"]))
                all_a = list(set(audios) | set(net_snapshot["audio"]))
                all_d = list(set(docs) | set(net_snapshot["doc"]))
                all_s = list(set(statics) | set(net_snapshot["static"]))
                await self.process_downloads(images, all_v, all_a, all_d, all_s, page_source)

                logger.info(f"[OK] {url} | img:{len(images)} vid:{len(all_v)} aud:{len(all_a)} doc:{len(all_d)} static:{len(all_s)}")

                # iframe 递归入队
                if self.cfg.get("iframe_recursive"):
                    for if_url in PageParser.get_iframe_src_list(html, base_href):
                        norm_if = self.url_manager.normalize_url(if_url, base_href)
                        if not self.url_manager.is_visited(norm_if) and self.url_manager.allow_enqueue(norm_if):
                            await self.task_queue.put((norm_if, depth + 1))

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
        try:
            self.save_snapshot()
        except Exception:
            pass

    async def run(self):
        loop = asyncio.get_running_loop()
        for sig in (signal.SIGINT, signal.SIGTERM):
            try:
                loop.add_signal_handler(sig, self.request_shutdown)
            except NotImplementedError:
                pass

        logger.info(f"FFMPEG可用：{self.downloader.ffmpeg_available}，下载：{self.cfg['download_enable']}，代理池：{len(self.cfg.get('proxy_pool', []))}")
        await self.init_browser()

        if self.task_queue.empty():
            await self.task_queue.put((self.start_url, 0))

        workers = [asyncio.create_task(self.worker()) for _ in range(self.concurrency)]

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
                     f"下载成功:{self.downloader.stats['success']} 失败:{self.downloader.stats['fail']} 跳过:{self.downloader.stats['skip']} =====")


if __name__ == "__main__":
    async def main():
        spider = AsyncUniversalSpider(start_url=CONFIG["start_url"], cfg=CONFIG)
        snap = load_snapshot(CONFIG["snapshot_file"])
        if snap:
            logger.info("检测到快照，恢复任务队列...")
            for raw_url in snap["visited"]:
                spider.url_manager.mark_visited(raw_url)
            spider.crawl_records = snap.get("records", [])
            for q_item in snap.get("queue", []):
                u, d = q_item
                await spider.task_queue.put((u, d))
        await spider.run()
    asyncio.run(main())
