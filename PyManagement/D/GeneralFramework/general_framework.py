# -*- coding: utf-8 -*-
"""
通用媒体采集爬虫框架 —— 最终整合版 general_framework.py
========================================================
以 v1~v7 七版能力整合而成：

- v1 基座：五类资源（image/video/audio/doc/static）收集与下载、m3u8 ffmpeg 合并、
  防盗链 Referer/Cookie、代理、域名白名单/黑名单、限速、最小大小
- v2 增强：PagePool 页面池复用、按类型 min_size、磁盘空间检查、Content-Type 识别、
  原子写入、文件名防覆盖、<base href>、页面/资源失败分离记录、优雅关闭
- v3 增强：代理池（健康检测+故障剔除）、缩略图关键词过滤、URL 去重剥离动态参数、
  JS/CSS 文本链接提取、iframe 递归、scan_only_mode、快照断点续爬、资源元信息、
  嵌套 m3u8 自动跳转子流
- v4 增强：自动滚动懒加载、TS 分片捕获 + 虚拟 m3u8 组装下载（blob/分片视频）
- v5/v6 能力：DASH-MPD 解析（SegmentList / SegmentTemplate+Timeline）与分片下载、
  ffmpeg 合并（通用实现，不依赖 ffmpeg-python / m3u8 库）
- v7 能力：SQLite URL 指纹持久化去重（crawl_dedup.db）、令牌桶全局 RPS 限速、
  Prometheus metrics 导出（可选，缺库自动禁用）

已知缺陷修复（相对 v1~v4）：
1. UrlManager 去除单例（多实例互不污染）
2. PlaywrightFetcher 异常改为 re-raise（让 async_retry 真正生效）
3. init_browser 仅在 use_dynamic_fallback=True 时启动浏览器（省资源）
4. PagePool Cookie 注入使用站点实际域名（原 example.com 占位导致不生效）
5. 全文件统一 ASCII 连字符（原 v1/v7 存在 U+2011 头名导致 UA/编码失效）

运行：python general_framework.py（或 import 后实例化 AsyncUniversalSpider）
"""
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
import time
import hashlib
import sqlite3
from abc import ABC, abstractmethod
from typing import Set, List, Optional, Dict, Callable, Any, Tuple
from urllib.parse import urljoin, urlparse, unquote, urlunparse, parse_qs, urlencode
from pathlib import Path

import aiohttp
from bs4 import BeautifulSoup
from playwright.async_api import Browser, async_playwright, Page, Response

# lxml：DASH-MPD 解析（可选，缺库时 DASH 下载禁用）
try:
    from lxml import etree
    LXML_AVAILABLE = True
except ImportError:
    LXML_AVAILABLE = False

# m3u8 库：嵌套 m3u8 变体识别（可选，缺库时 ffmpeg 自动选流兜底）
try:
    import m3u8
    M3U8_AVAILABLE = True
except ImportError:
    M3U8_AVAILABLE = False

# prometheus 指标（可选）
try:
    from prometheus_client import Counter, Gauge, Summary, generate_latest
    from prometheus_client.core import REGISTRY
    from aiohttp import web
    PROMETHEUS_AVAILABLE = True
except ImportError:
    PROMETHEUS_AVAILABLE = False
    web = None
    REGISTRY = None
    Counter = Gauge = Summary = None


# ===================== 配置区（直接改这里，无需命令行） =====================
CONFIG = {
    # ---- 基础抓取 ----
    "start_url": "https://www.dbku.tv/?ref=designnotes.cn",
    "max_depth": 2,
    "concurrency": 3,
    "sleep_sec": 1.0,
    "timeout": 15,
    "use_dynamic_fallback": False,
    "page_pool_size": 3,

    # ---- 输出与下载 ----
    "download_enable": True,
    "json_output_path": "crawl_result.json",
    "assets_output_path": "assets.txt",
    "download_root": "./download",
    "scan_only_mode": False,          # True=仅扫描收集不下载

    # 按页面标题建目录存放整组资源（图片/视频/音频/文档混合）；
    # False=按类型分类目录（images/videos/audios/docs/static）
    "organize_by_title": True,
    "title_dir_max_len": 100,         # 标题目录名最大长度

    # 下载模式：
    #   "stream" = 边采集边下载（每页解析完立即落盘）
    #   "batch"  = 全部采集完成后统一下载（先扫全站资源，结束再落盘）
    "download_mode": "stream",

    # 按类型独立最小文件大小（字节），0=不限制
    "min_size": {
        "image": 1024 * 5,
        "video": 1024 * 50,
        "audio": 1024 * 20,
        "doc": 0,
        "static": 0
    },
    "min_disk_free_mb": 50,           # 磁盘剩余低于 50MB 停止下载

    # ---- 域名过滤 ----
    "block_domains": {
        "google-analytics.com", "doubleclick.net", "googletagmanager.com",
        "googlesyndication.com", "facebook.net", "facebook.com"
    },
    "whitelist_domains": [],          # 空=不限制；如 ["file.ertuba.com"]
    "thumbnail_keywords": {           # 缩略图/小图关键词黑名单
        "thumb", "thumbnail", "avatar", "icon", "logo", "sprite",
        "badge", "loading", "placeholder", "default", "small", "_s.",
        "_thumb", "1x1", "pixel", "blank", "dot"
    },

    # ---- 资源后缀（在这里增删类型） ----
    "allow_image_suffix": {".jpg", ".jpeg", ".png", ".gif", ".webp", ".bmp", ".svg", ".ico"},
    "allow_video_suffix": {".mp4", ".m3u8", ".mpd", ".webm", ".mov", ".m4v", ".flv", ".avi", ".m4s", ".ts"},
    "allow_audio_suffix": {".mp3", ".wav", ".m4a", ".flac", ".ogg", ".aac", ".opus"},
    "allow_doc_suffix": {".pdf", ".docx", ".doc", ".xlsx", ".xls", ".pptx", ".ppt",
                         ".txt", ".md", ".zip", ".rar", ".7z", ".csv", ".epub"},
    "allow_static_suffix": {".js", ".css", ".woff", ".woff2", ".ttf", ".eot", ".otf", ".map"},

    # Content-Type 映射（无后缀 URL 识别）
    "content_type_map": {
        "image": {"image/"},
        "video": {"video/", "application/x-mpegurl", "application/vnd.apple.mpegurl",
                  "application/dash+xml"},
        "audio": {"audio/"},
        "doc": {"application/pdf", "application/msword", "application/vnd.openxmlformats",
                "application/vnd.ms-excel", "application/vnd.ms-powerpoint",
                "application/zip", "application/x-rar", "application/x-7z",
                "text/plain", "text/csv", "application/epub+zip"},
        "static": {"text/css", "application/javascript", "application/x-javascript",
                   "text/javascript", "font/", "application/font"}
    },

    # ---- 流媒体 ----
    "ffmpeg_path": "ffmpeg",
    "ffmpeg_timeout_sec": 600,
    "enable_dash_download": True,     # DASH-MPD 分片下载合并
    "enable_ts_assemble": True,       # TS 分片捕获 + 虚拟 m3u8 组装
    "ts_min_segments": 3,             # 至少收集到 3 个 ts 分片才尝试组装

    # ---- 反爬 ----
    "custom_referer": "",
    "custom_cookie": "",
    "proxy_pool": [],                 # 代理池 ["http://127.0.0.1:7890", ...]，空=不使用
    "proxy_health_check_url": "https://www.baidu.com",
    "proxy_max_fail": 3,
    "download_rate_limit": 0,         # 单下载限速 bytes/s，0=不限速

    # ---- 工程能力 ----
    "token_bucket_rps": 0.0,          # 全局 RPS 限速，0=关闭；如 2.0=全局限速 2 req/s
    "token_bucket_capacity": 5.0,
    "strip_url_query_keys": ["t", "_t", "timestamp", "v", "ver", "cache", "_", "rand"],
    "enable_js_css_extract": True,    # JS/CSS 内文本链接提取
    "iframe_recursive": False,        # iframe 递归入队
    "enable_auto_scroll": True,       # 动态页自动滚动懒加载
    "scroll_step": 800,
    "scroll_sleep_ms": 600,
    "scroll_max_times": 20,
    "snapshot_file": "spider_snapshot.json",   # 断点快照（SIGINT 时保存）
    "enable_sqlite_dedup": False,     # SQLite URL 指纹持久化去重（跨运行）
    "dedup_db_path": "crawl_dedup.db",
    "prometheus_enable": False,       # Prometheus /metrics 导出（需 prometheus_client）
    "prometheus_host": "0.0.0.0",
    "prometheus_port": 8000,
    "log_file": "spider.log",
    "fail_page_file": "fail_urls.txt",
    "fail_resource_file": "fail_resources.txt",
}
# ================================================================================


# ---------- 日志 ----------
def setup_logger(log_path: str) -> logging.Logger:
    """初始化/重建 logger（handlers 每次清空重建，支持运行时切换日志文件）"""
    logger = logging.getLogger("general_framework")
    logger.setLevel(logging.INFO)
    for h in list(logger.handlers):
        logger.removeHandler(h)
    fmt = logging.Formatter("%(asctime)s - %(levelname)s - %(message)s")
    try:
        fh = logging.FileHandler(log_path, encoding="utf-8")
        fh.setFormatter(fmt)
        logger.addHandler(fh)
    except Exception:
        pass  # 日志路径不可写时仅输出控制台
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
    """URL 转安全文件名；无扩展名或超长时用 hash 降级"""
    parsed = urlparse(url)
    filename = os.path.basename(unquote(parsed.path))
    filename = re.sub(r'[\\/*?:"<>|\s]+', "_", filename)
    if not filename or len(filename) > 180:
        ext = os.path.splitext(filename)[1]
        filename = hashlib.md5(url.encode("utf-8")).hexdigest()[:12] + ext
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


def safe_title_dirname(title: str, max_len: int = 100) -> str:
    """页面标题转安全目录名：保留中文，替换非法字符，去首尾空白/点，限长"""
    if not title:
        return ""
    name = re.sub(r'[\\/*?:"<>|\r\n\t]+', "_", title.strip())
    name = name.strip(" .")
    if not name:
        return ""
    if len(name) > max_len:
        name = name[:max_len].rstrip(" .")
    return name


def unique_dir_path(parent: Path, name: str) -> Path:
    """目录名冲突防覆盖：自动追加 _1 _2 并创建"""
    candidate = parent / name
    counter = 1
    base = name
    while candidate.exists():
        candidate = parent / f"{base}_{counter}"
        counter += 1
    candidate.mkdir(parents=True, exist_ok=True)
    return candidate


def is_data_uri(url: str) -> bool:
    """统一判断 data: 协议（base64 内嵌资源）"""
    return bool(url) and url.strip().lower().startswith("data:")


def is_thumbnail_url(url: str, keywords: Set[str]) -> bool:
    """判断是否为缩略图/小图 URL"""
    if not url:
        return False
    lu = url.lower()
    path = urlparse(lu).path
    for kw in keywords:
        if kw in path or kw in lu:
            return True
    return False


def is_block_domain(url: str, block_set: Set[str]) -> bool:
    """完整域名后缀匹配（子串不误拦）；IP 地址按完整匹配；空值保护"""
    if not url or not block_set:
        return False
    p = urlparse(url)
    host = (p.hostname or "").lower()
    if not host:
        return True
    if re.match(r"^\d+\.\d+\.\d+\.\d+$", host):
        return host in {b.lower() for b in block_set}
    for b in block_set:
        b = b.lower()
        if host == b or host.endswith("." + b):
            return True
    return False


def is_whitelist_domain(url: str, whitelist: List[str]) -> bool:
    """白名单匹配，空列表=不限制"""
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
    """剔除动态 query 参数，生成去重 key"""
    if not url:
        return url
    p = urlparse(url)
    qs = parse_qs(p.query, keep_blank_values=True)
    new_qs = {k: v for k, v in qs.items() if k.lower() not in strip_keys}
    new_query = urlencode(new_qs, doseq=True)
    return urlunparse((p.scheme, p.netloc, p.path, p.params, new_query, ""))


def extract_url_from_text(text: str) -> List[str]:
    """从 JS/CSS 文本正则提取 http/https 链接"""
    if not text:
        return []
    pattern = re.compile(r"https?://[^'\")\s>]+", re.I)
    out = []
    for m in pattern.findall(text):
        m = m.rstrip(r"\\;,.)")
        if m.startswith(("http://", "https://")):
            out.append(m)
    return out


def classify_url_by_suffix(url: str, cfg: Dict) -> Optional[str]:
    """按后缀识别资源类型 image/video/audio/doc/static，无法识别返回 None"""
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
    """按 Content-Type 识别资源类型（无后缀 URL 用）"""
    if not content_type:
        return None
    ct = content_type.lower().split(";")[0].strip()
    for rtype, patterns in cfg["content_type_map"].items():
        for pat in patterns:
            if ct == pat or ct.startswith(pat):
                return rtype
    return None


def async_retry(max_retries: int = 2, delay: float = 1.0):
    """异步重试装饰器：异常后 sleep 重试，耗尽返回 None"""
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
            if last_exception is not None:
                logger.debug(f"[retry] {func.__name__} 重试 {max_retries + 1} 次仍失败: "
                             f"{type(last_exception).__name__}: {last_exception}")
            return None
        return wrapper
    return decorator


def atomic_write(filepath: str, content: str, encoding: str = "utf-8"):
    """原子写入：先写临时文件再 rename，防止崩溃损坏"""
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
    """页面有效性判断：过滤 JS 骨架空白页，但保留含媒体标签的短页面（单图/单视频页）"""
    if not html:
        return False
    if len(html) < 50:
        return False
    low = html.lower()
    if "<body" not in low:
        return False
    # 含媒体元素（img/video/audio/source/链接）的短页面视为有效
    if any(t in low for t in ("<img", "<video", "<audio", "<source", "<a ")):
        return True
    # 无媒体标签：需足够长度才算有效（过滤纯容器骨架页）
    return len(html) >= 300


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


async def limited_write(f, chunk: bytes, rate_limit: int):
    """按字节数限速写入"""
    if rate_limit <= 0:
        f.write(chunk)
        return
    f.write(chunk)
    await asyncio.sleep(len(chunk) / rate_limit)


# ---------- 令牌桶全局 RPS 限速（v7 移植） ----------
class TokenBucket:
    def __init__(self, rps: float, capacity: float):
        self.rps = rps
        self.capacity = capacity
        self.tokens = capacity
        self.last_refill = time.time()
        self._lock = asyncio.Lock()

    async def consume(self):
        if self.rps <= 0:
            return
        async with self._lock:
            now = time.time()
            delta = now - self.last_refill
            add = delta * self.rps
            self.tokens = min(self.capacity, self.tokens + add)
            self.last_refill = now
            if self.tokens >= 1.0:
                self.tokens -= 1.0
                return
            need = 1.0 - self.tokens
            sleep_time = need / self.rps
        await asyncio.sleep(sleep_time)
        async with self._lock:
            self.tokens -= 1.0
            self.last_refill = time.time()


# ---------- 代理池（v3 移植：健康检测 + 失败剔除 + 轮询） ----------
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


# ---------- 失败记录管理（v2：页面/资源分离） ----------
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


# ---------- 资源元信息（v3） ----------
class ResourceMeta:
    """单个资源的元信息记录（导出到 JSON）"""
    def __init__(self, url: str, rtype: str, source: str = "dom"):
        self.url = url
        self.rtype = rtype
        self.source = source  # dom / network / js_css / ts_assemble / dash
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


# ---------- SQLite URL 指纹持久化去重（v7 移植） ----------
class SqliteDedup:
    """跨运行 URL 去重：md5 指纹表持久化到 sqlite"""
    def __init__(self, db_path: str):
        self.db_path = db_path
        self.conn: Optional[sqlite3.Connection] = None

    def open(self):
        self.conn = sqlite3.connect(self.db_path, check_same_thread=False)
        cur = self.conn.cursor()
        cur.execute("""
        CREATE TABLE IF NOT EXISTS url_fingerprint(
            fp TEXT PRIMARY KEY,
            url TEXT,
            create_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
        """)
        self.conn.commit()

    def seed_urls(self) -> List[str]:
        """载入历史已访问 URL（用于跨运行去重）"""
        if not self.conn:
            return []
        cur = self.conn.cursor()
        cur.execute("SELECT url FROM url_fingerprint")
        return [row[0] for row in cur.fetchall()]

    def mark(self, fp: str, url: str):
        if not self.conn:
            return
        cur = self.conn.cursor()
        cur.execute("INSERT OR IGNORE INTO url_fingerprint(fp,url) VALUES (?,?)", (fp, url))
        self.conn.commit()

    def close(self):
        if self.conn:
            self.conn.close()
            self.conn = None


# ---------- TS 分片收集器（v4：组装虚拟 m3u8 下载 blob/分片视频） ----------
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


# ---------- DASH-MPD 解析（v5/v6 移植：SegmentList + SegmentTemplate/Timeline） ----------
class DashStream:
    def __init__(self, stream_type: str, segments: List[str],
                 bandwidth: int = 0, resolution: Optional[str] = None):
        self.stream_type = stream_type      # video / audio
        self.segments = segments            # 绝对 URL 列表
        self.bandwidth = bandwidth
        self.resolution = resolution


class DashManifest:
    def __init__(self, streams: List[DashStream], has_drm: bool = False):
        self.streams = streams
        self.has_drm = has_drm


class DashManifestParser:
    """lxml 解析 MPD：支持 SegmentList（显式分片）与 SegmentTemplate+SegmentTimeline"""

    @staticmethod
    def parse_mpd(xml_text: str, base_url: str) -> Optional[DashManifest]:
        if not LXML_AVAILABLE or not xml_text:
            return None
        streams: List[DashStream] = []
        has_drm = False
        ns = {"mpd": "urn:mpeg:dash:schema:mpd:2011"}
        try:
            root = etree.fromstring(xml_text.encode("utf-8"))
            for period in root.xpath(".//mpd:Period", namespaces=ns):
                for adp in period.xpath("./mpd:AdaptationSet", namespaces=ns):
                    prots = adp.xpath("./mpd:ContentProtection", namespaces=ns)
                    if len(prots) > 0:
                        has_drm = True

                    content_type = adp.get("contentType")
                    if not content_type:
                        mime = adp.get("mimeType", "")
                        content_type = mime.split("/")[0] if "/" in mime else "video"
                    stype = "video" if content_type == "video" else "audio"

                    for rep in adp.xpath("./mpd:Representation", namespaces=ns):
                        bw = int(rep.get("bandwidth", "0"))
                        w = rep.get("width")
                        h = rep.get("height")
                        res = f"{w}x{h}" if w and h else None

                        seg_urls: List[str] = []

                        # 方式一：SegmentList 显式分片
                        seg_list = rep.find("./mpd:SegmentList", namespaces=ns)
                        if seg_list is not None:
                            for su in seg_list.xpath("./mpd:SegmentURL", namespaces=ns):
                                media = su.get("media")
                                if media:
                                    seg_urls.append(urljoin(base_url, media))

                        # 方式二：SegmentTemplate + SegmentTimeline（$Number$ 展开）
                        seg_tmpl = rep.find("./mpd:SegmentTemplate", namespaces=ns)
                        if seg_tmpl is not None and not seg_urls:
                            media_template = seg_tmpl.get("media", "")
                            timeline = seg_tmpl.find("./mpd:SegmentTimeline", namespaces=ns)
                            if timeline is not None:
                                num = 1
                                for s in timeline.findall("./mpd:S", namespaces=ns):
                                    seg_url = re.sub(r"\$Number\$", str(num), media_template)
                                    if seg_url and "$" not in seg_url:
                                        seg_urls.append(urljoin(base_url, seg_url))
                                    num += 1

                        if seg_urls:
                            streams.append(DashStream(
                                stream_type=stype,
                                segments=seg_urls,
                                bandwidth=bw,
                                resolution=res
                            ))
        except Exception as e:
            logger.warning(f"[MPD解析警告] {e}")
            return None

        if not streams:
            return None
        return DashManifest(streams=streams, has_drm=has_drm)


# ---------- 资源下载器 ----------
class ResourceDownloader:
    def __init__(self, cfg: Dict[str, Any], fail_mgr: FailManager,
                 proxy_pool: Optional[ProxyPool] = None):
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

    async def _get_proxy(self) -> Optional[str]:
        return await self.proxy_pool.get() if self.proxy_pool else None

    def _proxy_ok(self, proxy: Optional[str]):
        if proxy and self.proxy_pool:
            self.proxy_pool.mark_success(proxy)

    def _proxy_bad(self, proxy: Optional[str]):
        if proxy and self.proxy_pool:
            self.proxy_pool.mark_fail(proxy)

    @async_retry(max_retries=1, delay=1.0)
    async def download_file(self, url: str, save_dir: Path, rtype: str,
                            source: str = "dom") -> Optional[Path]:
        """流式下载单文件：状态/黑名单/缩略图/磁盘/最小大小/限速/防覆盖"""
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

        proxy = await self._get_proxy()
        try:
            async with self.session.get(
                url, headers=self.http_headers, proxy=proxy, allow_redirects=True
            ) as resp:
                if resp.status != 200:
                    meta.error = f"http {resp.status}"
                    self.fail_mgr.record_resource(url, rtype, f"http {resp.status}")
                    self._proxy_bad(proxy)
                    return None
                self._proxy_ok(proxy)

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
            self._proxy_bad(proxy)
            return None

    async def download_m3u8(self, m3u8_url: str, output_mp4: Path, rtype: str = "video",
                            source: str = "dom", nested_depth: int = 0) -> bool:
        """ffmpeg 合并 m3u8；有 m3u8 库时自动跳转嵌套变体子流"""
        MAX_NEST = 2
        meta = self.get_meta(m3u8_url, rtype, source)
        if not self.cfg["download_enable"]:
            return False
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

        # 嵌套 m3u8 变体识别（可选依赖 m3u8 库；缺库时 ffmpeg 自动选流）
        if M3U8_AVAILABLE and nested_depth == 0:
            try:
                proxy = await self._get_proxy()
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

    async def _download_segments(self, seg_urls: List[str], tmp_dir: Path,
                                 prefix: str) -> List[Path]:
        """并发下载分片到临时目录，返回本地文件路径列表"""
        paths: List[Path] = []

        async def one(i: int, u: str):
            ext = os.path.splitext(urlparse(u).path)[1]
            if not ext:
                ext = ".m4s"
            dest = tmp_dir / f"{prefix}_{i}{ext}"
            proxy = await self._get_proxy()
            async with self.session.get(u, headers=self.http_headers,
                                        proxy=proxy, timeout=aiohttp.ClientTimeout(total=60)) as resp:
                if resp.status != 200:
                    raise Exception(f"seg http {resp.status}")
                with open(dest, "wb") as f:
                    async for chunk in resp.content.iter_chunked(65536):
                        f.write(chunk)
            return dest

        sem = asyncio.Semaphore(4)
        results = await asyncio.gather(
            *(sem_wrap(one, i, u, sem) for i, u in enumerate(seg_urls)),
            return_exceptions=True
        )
        for r in results:
            if isinstance(r, Exception):
                logger.warning(f"[DASH seg fail] {r}")
                return []
            paths.append(r)
        return paths

    async def _run_ffmpeg(self, cmd: List[str], meta: ResourceMeta, tag: str) -> bool:
        proc = await asyncio.create_subprocess_exec(
            *cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE
        )
        self.ffmpeg_procs.append(proc)
        try:
            await asyncio.wait_for(proc.communicate(), timeout=self.cfg["ffmpeg_timeout_sec"])
        except asyncio.TimeoutError:
            proc.kill()
            await proc.wait()
            meta.error = f"{tag} timeout"
            return False
        finally:
            if proc in self.ffmpeg_procs:
                self.ffmpeg_procs.remove(proc)
        return proc.returncode == 0

    @staticmethod
    def _write_concat_list(paths: List[Path], list_file: Path):
        with open(list_file, "w", encoding="utf-8") as f:
            for p in paths:
                esc = str(p).replace("'", "'\\''")
                f.write(f"file '{esc}'\n")

    async def download_dash(self, mpd_url: str, output_mp4: Path,
                            rtype: str = "video", source: str = "dash") -> bool:
        """DASH-MPD 下载：解析分片清单 -> 并发下载 -> ffmpeg 合并转 mp4"""
        meta = self.get_meta(mpd_url, rtype, source)
        if not self.cfg["download_enable"]:
            return False
        if not self.cfg.get("enable_dash_download", True):
            return False
        if not self.ffmpeg_available or self.session is None:
            meta.error = "ffmpeg/session not available"
            return False
        if mpd_url in self.downloaded_set:
            return False
        if not check_disk_space(str(output_mp4.parent), self.cfg["min_disk_free_mb"]):
            meta.error = "disk space insufficient"
            return False

        # 1. 下载并解析 MPD
        try:
            proxy = await self._get_proxy()
            async with self.session.get(mpd_url, headers=self.http_headers, proxy=proxy,
                                        timeout=aiohttp.ClientTimeout(total=30)) as resp:
                if resp.status != 200:
                    meta.error = f"mpd http {resp.status}"
                    return False
                xml_text = await resp.text()
            manifest = DashManifestParser.parse_mpd(xml_text, mpd_url)
            if manifest is None:
                meta.error = "mpd parse failed or empty"
                return False
            if manifest.has_drm:
                meta.error = "DRM protected"
                self.fail_mgr.record_resource(mpd_url, rtype, "DRM protected")
                return False

            video_stream = next((s for s in manifest.streams
                                 if s.stream_type == "video" and s.segments), None)
            audio_stream = next((s for s in manifest.streams
                                 if s.stream_type == "audio" and s.segments), None)
            if not video_stream and not audio_stream:
                meta.error = "no usable segments"
                return False

            tmp_dir = Path(tempfile.mkdtemp(prefix="dash_"))
            try:
                # 2. 下载分片
                v_paths: List[Path] = []
                a_paths: List[Path] = []
                if video_stream:
                    v_paths = await self._download_segments(video_stream.segments, tmp_dir, "v")
                if audio_stream:
                    a_paths = await self._download_segments(audio_stream.segments, tmp_dir, "a")
                if not v_paths and not a_paths:
                    meta.error = "all segments failed"
                    return False

                # 3. concat demuxer 合并同类分片
                v_mp4 = tmp_dir / "v_combined.mp4"
                a_mp4 = tmp_dir / "a_combined.mp4"
                ok_v = ok_a = False
                if v_paths:
                    self._write_concat_list(v_paths, tmp_dir / "v_list.txt")
                    ok_v = await self._run_ffmpeg(
                        [self.cfg["ffmpeg_path"], "-y", "-f", "concat", "-safe", "0",
                         "-i", str(tmp_dir / "v_list.txt"), "-c", "copy", str(v_mp4)],
                        meta, "dash concat video")
                if a_paths:
                    self._write_concat_list(a_paths, tmp_dir / "a_list.txt")
                    ok_a = await self._run_ffmpeg(
                        [self.cfg["ffmpeg_path"], "-y", "-f", "concat", "-safe", "0",
                         "-i", str(tmp_dir / "a_list.txt"), "-c", "copy", str(a_mp4)],
                        meta, "dash concat audio")

                # 4. 合流：音视频都成功 -> mux；否则取单个
                if ok_v and ok_a and v_mp4.exists() and a_mp4.exists():
                    ok = await self._run_ffmpeg(
                        [self.cfg["ffmpeg_path"], "-y", "-i", str(v_mp4), "-i", str(a_mp4),
                         "-c", "copy", "-map", "0:v:0", "-map", "1:a:0", str(output_mp4)],
                        meta, "dash mux")
                elif ok_v and v_mp4.exists():
                    ok = await self._run_ffmpeg(
                        [self.cfg["ffmpeg_path"], "-y", "-i", str(v_mp4), "-c", "copy",
                         str(output_mp4)], meta, "dash video copy")
                elif ok_a and a_mp4.exists():
                    ok = await self._run_ffmpeg(
                        [self.cfg["ffmpeg_path"], "-y", "-i", str(a_mp4), "-c", "copy",
                         str(output_mp4)], meta, "dash audio copy")
                else:
                    ok = False

                if ok and output_mp4.exists():
                    self.downloaded_set.add(mpd_url)
                    meta.downloaded = True
                    meta.local_path = str(output_mp4)
                    meta.size = output_mp4.stat().st_size
                    self.stats["success"] += 1
                    logger.info(f"[DASH OK] {mpd_url} -> {output_mp4}")
                    return True
                self.stats["fail"] += 1
                meta.error = "dash assemble failed"
                return False
            finally:
                shutil.rmtree(tmp_dir, ignore_errors=True)
        except Exception as e:
            self.stats["fail"] += 1
            meta.error = str(e)[:200]
            self.fail_mgr.record_resource(mpd_url, rtype, str(e)[:200])
            return False

    async def download_from_virtual_m3u8(self, m3u8_text: str, output_mp4: Path,
                                         source: str = "ts_assemble") -> bool:
        """TS 分片组装：ffmpeg pipe 输入虚拟 m3u8 合并成 mp4"""
        meta = self.get_meta(f"virtual_m3u8_{abs(hash(m3u8_text)) % 100000}", "video", source)
        if not self.cfg["download_enable"]:
            return False
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


async def sem_wrap(fn, i, u, sem):
    async with sem:
        return await fn(i, u)


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


# ---------- Playwright 页面池（v2/v3：复用 Page 减少创建销毁） ----------
class PagePool:
    def __init__(self, browser: Browser, pool_size: int, headers: Dict,
                 net_sets: Dict[str, Set[str]], proxy_pool: Optional[ProxyPool],
                 block_domains: Set[str], cfg: Dict,
                 base_domain: str = "",
                 ts_collector: Optional[TsSegmentCollector] = None):
        self.browser = browser
        self.pool_size = pool_size
        self.headers = headers
        self.net_sets = net_sets
        self.proxy_pool = proxy_pool
        self.block_domains = block_domains
        self.cfg = cfg
        self.base_domain = base_domain
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

        # Cookie 注入：url 使用站点实际域名（原 example.com 占位导致不生效）
        cookie_str = self.headers.get("Cookie", "")
        if cookie_str:
            cookies = []
            for part in cookie_str.split(";"):
                part = part.strip()
                if "=" in part:
                    k, v = part.split("=", maxsplit=1)
                    cookies.append({"name": k.strip(), "value": v.strip(),
                                    "url": self.base_domain or "https://example.com"})
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
            # 收集 TS 分片（blob/分片视频组装用）
            if self.ts_collector:
                self.ts_collector.collect_ts(u)
            rtype = classify_url_by_suffix(u, self.cfg)
            if rtype:
                if rtype == "image" and is_thumbnail_url(u, self.cfg["thumbnail_keywords"]):
                    return
                self.net_sets[rtype].add(u)
                return
            # Content-Type 识别（无后缀 URL）
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
            # 自动滚动懒加载（v4）
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
            # re-raise：让 async_retry 真正生效（原版吞异常导致重试形同虚设）
            try:
                await self.page_pool.release(page)
            except Exception:
                pass
            raise


# ---------- URL 管理器（去单例：每个爬虫实例独立，避免多实例状态污染） ----------
class UrlManager:
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
    def extract_title(html: str) -> str:
        """静态提取页面 <title> 文本"""
        if not html:
            return ""
        try:
            soup = BeautifulSoup(html, "lxml")
            t = soup.find("title")
            if t and t.string:
                return t.string.strip()
        except Exception:
            pass
        return ""

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
    def extract_js_css_urls(soup: BeautifulSoup, base_href: str, block_domains: Set[str],
                            cfg: Dict) -> List[str]:
        out = []
        if not cfg.get("enable_js_css_extract", False):
            return out
        for script in soup.find_all("script"):
            txt = script.string
            if not txt:
                continue
            for fu in extract_url_from_text(txt):
                fu = urljoin(base_href, fu)
                if fu.startswith(("http://", "https://")) and not is_data_uri(fu) \
                        and not is_block_domain(fu, block_domains):
                    out.append(fu)
        for style in soup.find_all("style"):
            txt = style.string
            if not txt:
                continue
            for fu in extract_url_from_text(txt):
                fu = urljoin(base_href, fu)
                if fu.startswith(("http://", "https://")) and not is_data_uri(fu) \
                        and not is_block_domain(fu, block_domains):
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
    def extract_media_from_html(html: str, base_href: str, block_domains: Set[str],
                                cfg: Dict):
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

        # 懒加载属性优先（src 是占位图时用真实图地址；占位图由缩略图关键词过滤）
        lazy_attrs = ("data-src", "data-original", "data-lazy-src",
                      "data-echo", "data-lazy", "data-url", "data-image")
        for img in soup.find_all("img"):
            src = (img.get("src") or "").strip()
            lazy_src = ""
            for attr in lazy_attrs:
                val = img.get(attr)
                if val:
                    lazy_src = val.strip()
                    break
            if lazy_src:
                _add(image_set, lazy_src, "image")
            if src:
                _add(image_set, src, "image")
        for vid in soup.find_all("video", src=True):
            _add(video_set, vid["src"].strip(), "video")
        for aud in soup.find_all("audio", src=True):
            _add(audio_set, aud["src"].strip(), "audio")
        for src_tag in soup.find_all("source", src=True):
            src = src_tag["src"].strip()
            full = urljoin(base_href, src)
            if full.startswith(("http://", "https://")) and not is_block_domain(full, block_domains) \
                    and not is_data_uri(src):
                rtype = classify_url_by_suffix(full, cfg)
                if rtype == "video":
                    video_set.add(full)
                elif rtype == "audio":
                    audio_set.add(full)
        for link in soup.find_all("link", href=True):
            src = link["href"].strip()
            full = urljoin(base_href, src)
            if full.startswith(("http://", "https://")) and not is_block_domain(full, block_domains) \
                    and not is_data_uri(src):
                if classify_url_by_suffix(full, cfg) == "static":
                    static_set.add(full)
        for script in soup.find_all("script", src=True):
            src = script["src"].strip()
            full = urljoin(base_href, src)
            if full.startswith(("http://", "https://")) and not is_block_domain(full, block_domains) \
                    and not is_data_uri(src):
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
    async def extract_media_from_page(page: Page, base_url: str, block_domains: Set[str],
                                      cfg: Dict):
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


# ---------- 自动滚动懒加载（v4） ----------
async def auto_scroll_page(page: Page, scroll_step: int = 800,
                           sleep_ms: int = 600, max_scroll_times: int = 20):
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


# ---------- Prometheus 指标（v7 移植，可选） ----------
class CrawlerMetrics:
    def __init__(self):
        if not PROMETHEUS_AVAILABLE:
            self.enabled = False
            return
        self.enabled = True
        self.crawl_total = Counter("crawl_total", "总任务数", ["status"])
        self.crawl_success = Counter("crawl_success_total", "成功采集")
        self.crawl_fail = Counter("crawl_fail_total", "采集失败")
        self.crawl_retry = Counter("crawl_retry_total", "重试次数")
        self.queue_size = Gauge("crawl_queue_size", "队列长度", ["queue"])
        self.crawl_rate = Summary("crawl_process_seconds", "处理耗时")

    def inc_total(self, status: str):
        if self.enabled:
            self.crawl_total.labels(status=status).inc()

    def inc_success(self):
        if self.enabled:
            self.crawl_success.inc()

    def inc_fail(self):
        if self.enabled:
            self.crawl_fail.inc()

    def set_queue(self, q_name: str, val: int):
        if self.enabled:
            self.queue_size.labels(queue=q_name).set(val)

    def observe_duration(self, sec: float):
        if self.enabled:
            self.crawl_rate.observe(sec)

    async def start_http_server(self, host: str, port: int):
        if not self.enabled or web is None:
            return
        async def metrics_handler(request):
            return web.Response(body=generate_latest(REGISTRY), content_type="text/plain; version=0.0.4")
        app = web.Application()
        app.add_routes([web.get("/metrics", metrics_handler)])
        runner = web.AppRunner(app)
        await runner.setup()
        site = web.TCPSite(runner, host, port)
        await site.start()
        print(f"Prometheus metrics listen on http://{host}:{port}/metrics")


# ---------- 快照（v3：断点续爬） ----------
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
        self.url_manager = UrlManager(self.base_domain, cfg["whitelist_domains"],
                                      cfg["strip_url_query_keys"])
        self.fail_mgr = FailManager(cfg["fail_page_file"], cfg["fail_resource_file"])
        self.proxy_pool = ProxyPool(
            cfg.get("proxy_pool", []),
            cfg.get("proxy_health_check_url", "https://www.baidu.com"),
            cfg.get("proxy_max_fail", 3)
        )
        self.downloader = ResourceDownloader(cfg, self.fail_mgr, self.proxy_pool)
        self.ts_collector = TsSegmentCollector()
        self.token_bucket = TokenBucket(cfg.get("token_bucket_rps", 0.0),
                                        cfg.get("token_bucket_capacity", 5.0))
        self.metrics = CrawlerMetrics()
        self.sqlite_dedup: Optional[SqliteDedup] = None
        if cfg.get("enable_sqlite_dedup"):
            self.sqlite_dedup = SqliteDedup(cfg["dedup_db_path"])

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
        # 按标题组织时目录按页面动态创建；否则预建类型分类目录
        if not cfg.get("organize_by_title", True):
            for sub in ["images", "videos", "audios", "docs", "static"]:
                (root / sub).mkdir(exist_ok=True)

    async def init_browser(self):
        await self.proxy_pool.health_check()
        self.fetcher_static = RequestsFetcher(self.headers, self.timeout, self.proxy_pool)
        # 仅当启用动态兜底时才启动浏览器（原版无条件启动浪费资源）
        if self.use_dynamic_fallback:
            pw_args = {}
            proxy = await self.proxy_pool.get()
            if proxy:
                pw_args["proxy"] = {"server": proxy}
            self.pw_context = await async_playwright().start()
            self.browser = await self.pw_context.chromium.launch(headless=True, **pw_args)
            self.page_pool = PagePool(
                self.browser, self.cfg["page_pool_size"], self.headers,
                self.net_capture, self.proxy_pool, self.cfg["block_domains"], self.cfg,
                self.base_domain, self.ts_collector
            )
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
        if self.sqlite_dedup:
            self.sqlite_dedup.close()

    def _mark_seen_persistent(self, url: str):
        """同步写 SQLite 持久化去重（可选）"""
        if self.sqlite_dedup:
            fp = hashlib.md5(normalize_url_for_dedup(url, self.cfg["strip_url_query_keys"])
                             .encode("utf-8")).hexdigest()
            self.sqlite_dedup.mark(fp, url)

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
        logger.info(f"assets.txt已保存 | img:{len(all_img)} video:{len(all_vid)} "
                    f"audio:{len(all_aud)} doc:{len(all_doc)} static:{len(all_sta)}")

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
        dump_snapshot(self.cfg["snapshot_file"], queue_items,
                      self.url_manager.visited_raw, self.crawl_records)
        logger.info(f"快照已保存: {self.cfg['snapshot_file']} (队列剩余 {len(queue_items)})")

    async def process_downloads(self, images, videos, audios, docs, statics,
                                source: str = "dom", dir_path: Optional[Path] = None):
        """下载整组资源。dir_path 给定=按页面标题目录混合存放；None=按类型分类目录"""
        root = Path(self.cfg["download_root"])
        if dir_path is not None:
            img_dir = vid_dir = aud_dir = doc_dir = sta_dir = dir_path
        else:
            img_dir = root / "images"
            vid_dir = root / "videos"
            aud_dir = root / "audios"
            doc_dir = root / "docs"
            sta_dir = root / "static"
        for u in images:
            await self.downloader.download_file(u, img_dir, "image", source)
        for u in audios:
            await self.downloader.download_file(u, aud_dir, "audio", source)
        for u in docs:
            await self.downloader.download_file(u, doc_dir, "doc", source)
        for u in statics:
            await self.downloader.download_file(u, sta_dir, "static", source)
        for v_url in videos:
            lu = v_url.lower().split("?")[0]
            if lu.endswith(".m3u8"):
                base_name = safe_filename(v_url).replace(".m3u8", ".mp4")
                out_mp4 = unique_file_path(vid_dir, base_name)
                await self.downloader.download_m3u8(v_url, out_mp4, "video", source)
            elif lu.endswith(".mpd"):
                base_name = safe_filename(v_url).replace(".mpd", ".mp4")
                out_mp4 = unique_file_path(vid_dir, base_name)
                await self.downloader.download_dash(v_url, out_mp4, "video", source)
            else:
                await self.downloader.download_file(v_url, vid_dir, "video", source)

    async def process_ts_assemble(self, page_url: str,
                                  dir_path: Optional[Path] = None):
        """TS 分片组装虚拟 m3u8 下载（blob/分片视频）"""
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
        vid_dir = dir_path or (root / "videos")
        out_name = f"ts_assembled_{abs(hash(page_url)) % 100000}.mp4"
        out_mp4 = unique_file_path(vid_dir, out_name)
        await self.downloader.download_from_virtual_m3u8(virtual_m3u8, out_mp4)
        self.ts_collector.reset()

    async def worker(self):
        while not self._shutdown:
            try:
                url, depth = await self.task_queue.get()
            except asyncio.CancelledError:
                break
            # page 提前初始化：continue/break 时 finally 也能安全引用
            page: Optional[Page] = None
            try:
                if self._shutdown:
                    break
                if self.url_manager.is_visited(url) or depth > self.max_depth:
                    continue
                self.url_manager.mark_visited(url)
                self._mark_seen_persistent(url)
                # 全局 RPS 令牌桶限速（v7）
                await self.token_bucket.consume()
                logger.info(f"[worker] depth={depth} url={url}")

                html: Optional[str] = None
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
                    self.metrics.inc_fail()
                    self.metrics.inc_total("fail")
                    continue

                base_href = get_base_href(html, self.base_domain)
                self.page_stats["success"] += 1

                if page is not None:
                    images, videos, audios, docs, statics = await PageParser.extract_media_from_page(
                        page, url, self.cfg["block_domains"], self.cfg
                    )
                    page_source = "network"
                else:
                    images, videos, audios, docs, statics = PageParser.extract_media_from_html(
                        html, base_href, self.cfg["block_domains"], self.cfg
                    )
                    page_source = "dom"

                # 页面标题（动态优先，静态兜底）
                page_title = ""
                if page is not None:
                    try:
                        page_title = (await page.title() or "").strip()
                    except Exception:
                        page_title = ""
                if not page_title:
                    page_title = PageParser.extract_title(html)

                # 按标题建目录（stream 模式 + organize_by_title + 启用下载时）
                page_dir: Optional[Path] = None
                if (self.cfg.get("download_mode", "stream") == "stream"
                        and self.cfg.get("organize_by_title", True)
                        and self.cfg["download_enable"]):
                    dir_name = safe_title_dirname(page_title, self.cfg.get("title_dir_max_len", 100))
                    if not dir_name:
                        dir_name = f"page_{abs(hash(url)) % 100000}"
                    page_dir = unique_dir_path(Path(self.cfg["download_root"]), dir_name)

                # JS/CSS 文本链接提取（v3）
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
                    "page_url": url, "depth": depth, "page_title": page_title,
                    "page_dir": str(page_dir) if page_dir else None,
                    "images": images, "videos_dom": videos, "audios_dom": audios,
                    "docs_dom": docs, "statics_dom": statics,
                    "videos_network": net_snapshot["video"],
                    "audios_network": net_snapshot["audio"],
                    "docs_network": net_snapshot["doc"],
                    "statics_network": net_snapshot["static"],
                    "ts_segments": len(self.ts_collector.ts_list),
                    "ts_list": list(self.ts_collector.ts_list)
                })

                all_v = list(set(videos) | set(net_snapshot["video"]))
                all_a = list(set(audios) | set(net_snapshot["audio"]))
                all_d = list(set(docs) | set(net_snapshot["doc"]))
                all_s = list(set(statics) | set(net_snapshot["static"]))

                # stream 模式：边采边下；batch 模式仅收集，结束再统一下载
                if self.cfg.get("download_mode", "stream") == "stream":
                    await self.process_downloads(images, all_v, all_a, all_d, all_s,
                                                 page_source, page_dir)

                    # TS 分片组装（blob/分片视频）
                    if page is not None:
                        await self.process_ts_assemble(url, page_dir)

                self.metrics.inc_success()
                self.metrics.inc_total("success")
                logger.info(f"[OK] {url} | 标题:{page_title or '(无)'} "
                            f"目录:{page_dir.name if page_dir else '按类型'}"
                            f" img:{len(images)} vid:{len(all_v)} "
                            f"aud:{len(all_a)} doc:{len(all_d)} static:{len(all_s)}")

                # iframe 递归入队（v3）
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
                try:
                    if page is not None and self.page_pool:
                        await self.page_pool.release(page)
                except Exception:
                    pass
                self.task_queue.task_done()

    async def download_all_batched(self):
        """batch 模式：全部采集完成后统一下载，按页面记录逐组落盘"""
        if not self.cfg["download_enable"]:
            return
        root = Path(self.cfg["download_root"])
        organize = self.cfg.get("organize_by_title", True)
        logger.info(f"[BATCH] 批量下载开始，共 {len(self.crawl_records)} 个页面记录")
        for rec in self.crawl_records:
            url = rec["page_url"]
            images = rec["images"]
            all_v = list(set(rec["videos_dom"]) | set(rec["videos_network"]))
            all_a = list(set(rec["audios_dom"]) | set(rec["audios_network"]))
            all_d = list(set(rec["docs_dom"]) | set(rec["docs_network"]))
            all_s = list(set(rec["statics_dom"]) | set(rec["statics_network"]))
            source = "network" if (rec.get("videos_network") or rec.get("audios_network")) else "dom"

            # 按标题建目录（organize_by_title=True）
            page_dir: Optional[Path] = None
            if organize:
                title = rec.get("page_title") or ""
                dir_name = safe_title_dirname(title, self.cfg.get("title_dir_max_len", 100))
                if not dir_name:
                    dir_name = f"page_{abs(hash(url)) % 100000}"
                page_dir = unique_dir_path(root, dir_name)
                rec["page_dir"] = str(page_dir)

            await self.process_downloads(images, all_v, all_a, all_d, all_s, source, page_dir)

            # TS 分片组装（batch 模式用记录快照）
            ts_list = rec.get("ts_list") or []
            if self.cfg.get("enable_ts_assemble") and len(ts_list) >= self.cfg.get("ts_min_segments", 3):
                tc = TsSegmentCollector()
                tc.ts_list = list(ts_list)
                virtual_m3u8 = tc.build_virtual_m3u8()
                if virtual_m3u8:
                    vid_dir = page_dir or (root / "videos")
                    out_name = f"ts_assembled_{abs(hash(url)) % 100000}.mp4"
                    out_mp4 = unique_file_path(vid_dir, out_name)
                    await self.downloader.download_from_virtual_m3u8(virtual_m3u8, out_mp4)
        logger.info("[BATCH] 批量下载完成")

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

        # 跨运行去重：载入 sqlite 历史指纹（可选）
        if self.sqlite_dedup:
            self.sqlite_dedup.open()
            for u in self.sqlite_dedup.seed_urls():
                self.url_manager.mark_visited(u)
            logger.info(f"SQLite 去重已启用，载入历史指纹 {len(self.url_manager.visited_norm)} 条")

        logger.info(f"FFMPEG可用：{self.downloader.ffmpeg_available}，下载：{self.cfg['download_enable']}，"
                    f"代理池：{len(self.cfg.get('proxy_pool', []))}，RPS限速：{self.cfg.get('token_bucket_rps', 0)}")
        await self.init_browser()

        if self.task_queue.empty():
            await self.task_queue.put((self.start_url, 0))

        prom_task = None
        if self.cfg.get("prometheus_enable"):
            prom_task = asyncio.create_task(
                self.metrics.start_http_server(self.cfg["prometheus_host"],
                                               self.cfg["prometheus_port"])
            )

        workers = [asyncio.create_task(self.worker()) for _ in range(self.concurrency)]

        while not self.task_queue.empty() and not self._shutdown:
            await asyncio.sleep(0.5)
        if not self._shutdown:
            await self.task_queue.join()

        for w in workers:
            w.cancel()
        await asyncio.gather(*workers, return_exceptions=True)
        if prom_task:
            prom_task.cancel()
            await asyncio.gather(prom_task, return_exceptions=True)
        await self.close_browser()

        # batch 模式：全部采集完成后统一下载
        if self.cfg.get("download_mode", "stream") == "batch":
            # close_browser 已关闭下载 session，批量阶段前重建
            if self.downloader.session is None or self.downloader.session.closed:
                await self.downloader.init()
            await self.download_all_batched()
            await self.downloader.close()

        self.save_media_to_file()
        self.save_json_result()
        logger.info(f"===== 完成 | 页面成功:{self.page_stats['success']} 失败:{self.page_stats['fail']} | "
                    f"下载成功:{self.downloader.stats['success']} 失败:{self.downloader.stats['fail']} "
                    f"跳过:{self.downloader.stats['skip']} =====")

    async def retry_failed(self):
        fail_urls = self.fail_mgr.load_failed_pages()
        for u in fail_urls:
            await self.task_queue.put((u, 0))
        logger.info(f"准备补爬 {len(fail_urls)} 个失败链接")


# ===================== 入口 =====================
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
