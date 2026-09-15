# ============================================================
# crawler.py  —  Python 3.14+
# 依赖: pip install aiohttp beautifulsoup4 lxml chardet
#       视频下载额外依赖: cryptography (AES-128 加密流)
# 视频模块: fdzys_video.py (HLS 下载器 + 播放器配置解析)
# ============================================================
from __future__ import annotations

import argparse
import asyncio
import hashlib
import os
import re
import sqlite3
import time
import mimetypes
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import Iterable, Callable, Any
from urllib.parse import urljoin, urlparse, urldefrag, parse_qs
from collections import defaultdict

import aiohttp
import chardet
from bs4 import BeautifulSoup
from lxml import etree

from fdzys_video import (
    HLSClient,
    extract_player_config,
    is_direct_media_url,
    is_m3u8_url,
    safe_filename,
)


# ============================================================
# 1. 数据模型
# ============================================================
@dataclass
class PageTask:
    url: str
    depth: int = 0
    referer: str | None = None
    task_parsers: list[str] | None = None   # 单任务解析器覆盖


@dataclass
class ResourceItem:
    url: str
    kind: str            # image/video/audio/document/archive/other
    referer: str | None = None
    extra: dict = field(default_factory=dict)


# ============================================================
# 2. 观察者模式 —— 资源/事件总线
# ============================================================
class Observer(ABC):
    @abstractmethod
    async def update(self, event: str, payload: Any) -> None: ...


class EventBus:
    """极简异步发布订阅。"""

    def __init__(self) -> None:
        self._subs: dict[str, list[Observer]] = defaultdict(list)

    def subscribe(self, event: str, obs: Observer) -> None:
        self._subs[event].append(obs)

    def subscribe_all(self, obs: Observer, events: Iterable[str]) -> None:
        for e in events:
            self.subscribe(e, obs)

    async def publish(self, event: str, payload: Any) -> None:
        for obs in self._subs.get(event, []):
            try:
                await obs.update(event, payload)
            except Exception as exc:                       # noqa: BLE001
                print(f"[EventBus] observer error on {event}: {exc}")


# ============================================================
# 3. 策略模式 —— URL 队列
# ============================================================
class URLQueueStrategy(ABC):
    @abstractmethod
    async def push(self, task: PageTask) -> bool:
        """返回 True 表示是新任务（未访问过）。"""

    @abstractmethod
    async def pop(self) -> PageTask | None: ...

    @abstractmethod
    async def mark_done(self, task: PageTask) -> None: ...

    @abstractmethod
    async def empty(self) -> bool: ...

    @abstractmethod
    async def size(self) -> int: ...


class MemoryQueue(URLQueueStrategy):
    """策略一：一次性加载 / 内存去重。"""

    def __init__(self) -> None:
        self._queue: asyncio.Queue[PageTask] = asyncio.Queue()
        self._seen: set[str] = set()

    async def push(self, task: PageTask) -> bool:
        key = _normalize(task.url)
        if key in self._seen:
            return False
        self._seen.add(key)
        await self._queue.put(task)
        return True

    async def pop(self) -> PageTask | None:
        try:
            return self._queue.get_nowait()
        except asyncio.QueueEmpty:
            return None

    async def mark_done(self, task: PageTask) -> None:  # noqa: D102
        pass

    async def empty(self) -> bool:
        return self._queue.empty()

    async def size(self) -> int:
        return self._queue.qsize()


class SQLiteQueue(URLQueueStrategy):
    """策略二：SQLite 持久化，支持断点续爬。"""

    def __init__(self, db_path: str = "crawl_queue.db") -> None:
        self.db_path = db_path
        self._lock = asyncio.Lock()
        self._conn = sqlite3.connect(db_path, check_same_thread=False)
        self._conn.execute("""
            CREATE TABLE IF NOT EXISTS queue (
                url     TEXT PRIMARY KEY,
                depth   INTEGER,
                referer TEXT,
                status  TEXT DEFAULT 'pending',   -- pending / done / error
                ts      REAL
            )
        """)
        self._conn.execute("CREATE INDEX IF NOT EXISTS idx_status ON queue(status)")
        self._conn.commit()

    async def push(self, task: PageTask) -> bool:
        url = _normalize(task.url)
        async with self._lock:
            cur = self._conn.execute("SELECT 1 FROM queue WHERE url=?", (url,))
            if cur.fetchone():
                return False
            self._conn.execute(
                "INSERT INTO queue(url,depth,referer,status,ts) VALUES(?,?,?,?,?)",
                (url, task.depth, task.referer, "pending", time.time()),
            )
            self._conn.commit()
            return True

    async def pop(self) -> PageTask | None:
        async with self._lock:
            cur = self._conn.execute(
                "SELECT url,depth,referer FROM queue WHERE status='pending' "
                "ORDER BY ts LIMIT 1"
            )
            row = cur.fetchone()
            if not row:
                return None
            self._conn.execute("UPDATE queue SET status='running' WHERE url=?", (row[0],))
            self._conn.commit()
            return PageTask(url=row[0], depth=row[1], referer=row[2])

    async def mark_done(self, task: PageTask) -> None:
        async with self._lock:
            self._conn.execute("UPDATE queue SET status='done' WHERE url=?",
                               (_normalize(task.url),))
            self._conn.commit()

    async def empty(self) -> bool:
        async with self._lock:
            cur = self._conn.execute(
                "SELECT 1 FROM queue WHERE status='pending' LIMIT 1")
            return cur.fetchone() is None

    async def size(self) -> int:
        async with self._lock:
            cur = self._conn.execute(
                "SELECT COUNT(*) FROM queue WHERE status='pending'")
            return cur.fetchone()[0]


# ============================================================
# 4. 策略模式 + 工厂模式 —— 解析器
# ============================================================
class ParserStrategy(ABC):
    name: str = "base"

    @abstractmethod
    def extract(self, html: str, base_url: str) -> tuple[list[str], list[ResourceItem]]:
        """返回 (子链接, 资源列表)。"""


class BS4Parser(ParserStrategy):
    name = "bs4"

    def extract(self, html: str, base_url: str) -> tuple[list[str], list[ResourceItem]]:
        soup = BeautifulSoup(html, "lxml")
        links: list[str] = []
        for a in soup.find_all("a", href=True):
            links.append(urljoin(base_url, a["href"].strip()))

        resources: list[ResourceItem] = []
        # img
        for img in soup.find_all("img"):
            src = img.get("src") or img.get("data-src") or img.get("data-original")
            if src:
                resources.append(ResourceItem(urljoin(base_url, src.strip()), "image",
                                              referer=base_url))
        # video / source
        for v in soup.find_all(["video", "source"]):
            src = v.get("src")
            if src:
                resources.append(ResourceItem(urljoin(base_url, src.strip()), "video",
                                              referer=base_url))
        # a[href] 中指向资源的
        for a in soup.find_all("a", href=True):
            href = a["href"]
            if re.search(r"\.(mp4|m3u8|mp3|pdf|zip|rar|jpg|png|webp)(\?|$)",
                         href, re.I):
                resources.append(ResourceItem(urljoin(base_url, href.strip()),
                                              _guess_kind(href), referer=base_url))
        return links, resources


class XPathParser(ParserStrategy):
    name = "xpath"

    def extract(self, html: str, base_url: str) -> tuple[list[str], list[ResourceItem]]:
        try:
            tree = etree.HTML(html)
        except Exception:
            return [], []
        if tree is None:
            return [], []
        links = [urljoin(base_url, h.strip()) for h in
                 tree.xpath("//a/@href") if h and h.strip()]
        resources: list[ResourceItem] = []
        for src in tree.xpath("//img/@src | //img/@data-src | //img/@data-original"):
            if src and src.strip():
                resources.append(ResourceItem(urljoin(base_url, src.strip()),
                                              "image", referer=base_url))
        for src in tree.xpath("//video/@src | //source/@src"):
            if src and src.strip():
                resources.append(ResourceItem(urljoin(base_url, src.strip()),
                                              "video", referer=base_url))
        return links, resources


class RegexParser(ParserStrategy):
    name = "regex"
    _A = re.compile(r'<a[^>]+href=["\']([^"\']+)["\']', re.I)
    _IMG = re.compile(r'<img[^>]+(?:src|data-src|data-original)=["\']([^"\']+)["\']', re.I)
    _VID = re.compile(r'<(?:video|source)[^>]+src=["\']([^"\']+)["\']', re.I)
    _RES = re.compile(r'https?://[^\s"\'<>]+\.(?:mp4|m3u8|mp3|pdf|zip|rar|jpg|png|webp)',
                      re.I)

    def extract(self, html: str, base_url: str) -> tuple[list[str], list[ResourceItem]]:
        links = [urljoin(base_url, m.group(1).strip())
                 for m in self._A.finditer(html)]
        resources: list[ResourceItem] = []
        for m in self._IMG.finditer(html):
            resources.append(ResourceItem(urljoin(base_url, m.group(1).strip()),
                                          "image", referer=base_url))
        for m in self._VID.finditer(html):
            resources.append(ResourceItem(urljoin(base_url, m.group(1).strip()),
                                          "video", referer=base_url))
        for m in self._RES.finditer(html):
            resources.append(ResourceItem(m.group(0), _guess_kind(m.group(0)),
                                          referer=base_url))
        return links, resources


class PlayerParser(ParserStrategy):
    """解析播放器配置 player_aaaa：
    - 播放页/详情页均含该配置
    - 直链(m3u8/mp4/flv…)可下载；外部平台(如 v.qq.com)标记 skip
    - 加密源(encrypt=1)暂不支持，直接跳过"""

    name = "player"

    def extract(self, html: str, base_url: str) -> tuple[list[str], list[ResourceItem]]:
        cfg = extract_player_config(html)
        if not cfg:
            return [], []
        if cfg.get("encrypt"):
            return [], []                      # 加密源暂不支持
        url = cfg.get("url") or ""
        if not url:
            return [], []
        extra = {
            "from": cfg.get("from"),
            "sid": cfg.get("sid"),
            "nid": cfg.get("nid"),
            "vod_name": (cfg.get("vod_data") or {}).get("vod_name"),
        }
        if is_direct_media_url(url):
            return [], [ResourceItem(url=url, kind="video",
                                     referer=base_url, extra=extra)]
        extra["skip"] = True                    # 外部平台，需站点签名/DRM
        return [], [ResourceItem(url=url, kind="video",
                                 referer=base_url, extra=extra)]


class ParserFactory:
    """工厂模式 —— 根据名称创建 / 组合解析器。"""

    _registry: dict[str, type[ParserStrategy]] = {
        "bs4":   BS4Parser,
        "xpath": XPathParser,
        "regex": RegexParser,
        "player": PlayerParser,
    }

    @classmethod
    def create(cls, names: Iterable[str]) -> list[ParserStrategy]:
        out: list[ParserStrategy] = []
        for n in names:
            n = n.strip().lower()
            if n in cls._registry:
                out.append(cls._registry[n]())
            else:
                print(f"[ParserFactory] unknown parser: {n}")
        if not out:
            out.append(BS4Parser())
        return out


# ============================================================
# 5. 工厂模式 —— 资源分类 / 保存
# ============================================================
KIND_RULES: list[tuple[str, re.Pattern]] = [
    ("image",    re.compile(r"\.(jpg|jpeg|png|gif|webp|bmp|svg|ico|avif)(\?|$)", re.I)),
    ("video",    re.compile(r"\.(mp4|m3u8|flv|mkv|avi|mov|ts|webm)(\?|$)", re.I)),
    ("audio",    re.compile(r"\.(mp3|m4a|aac|flac|wav|ogg)(\?|$)", re.I)),
    ("document", re.compile(r"\.(pdf|docx?|xlsx?|pptx?|txt|epub|md)(\?|$)", re.I)),
    ("archive",  re.compile(r"\.(zip|rar|7z|tar|gz|bz2)(\?|$)", re.I)),
]

MIME_MAP = {
    "image": "images", "video": "videos", "audio": "audios",
    "document": "documents", "archive": "archives", "other": "others",
}


def _guess_kind(url: str) -> str:
    for kind, pat in KIND_RULES:
        if pat.search(url):
            return kind
    path = urlparse(url).path
    mime, _ = mimetypes.guess_type(path)
    if mime:
        if mime.startswith("image/"):  return "image"
        if mime.startswith("video/"):  return "video"
        if mime.startswith("audio/"):  return "audio"
        if mime == "application/pdf":  return "document"
    return "other"


class ResourceSaverFactory:
    """按 kind 创建保存器（这里保存器逻辑一致，可扩展解密/转换）。"""

    _subdir = MIME_MAP

    @classmethod
    def save_dir(cls, root: str, kind: str) -> str:
        sub = cls._subdir.get(kind, "others")
        d = os.path.join(root, sub)
        os.makedirs(d, exist_ok=True)
        return d


# ============================================================
# 6. 编码检测工具
# ============================================================
_CHARSET_RE = re.compile(rb'charset\s*=\s*["\']?\s*([\w-]+)', re.I)
_ALIAS = {"gb2312": "gbk", "gb-2312": "gbk", "utf8": "utf-8", "utf-8": "utf-8"}


def detect_charset(raw: bytes, content_type: str | None = None) -> str:
    # 1) HTTP header
    if content_type:
        m = re.search(r"charset=([\w-]+)", content_type, re.I)
        if m:
            return _ALIAS.get(m.group(1).lower(), m.group(1).lower())
    # 2) <meta charset> / http-equiv
    m = _CHARSET_RE.search(raw[:4096])
    if m:
        cs = m.group(1).decode("ascii", "ignore").lower()
        return _ALIAS.get(cs, cs)
    # 3) chardet
    guess = chardet.detect(raw[:65536])
    if guess and guess.get("encoding"):
        cs = guess["encoding"].lower()
        return _ALIAS.get(cs, cs)
    return "utf-8"


def decode_html(raw: bytes, content_type: str | None = None) -> str:
    cs = detect_charset(raw, content_type)
    for enc in (cs, "utf-8", "gbk", "gb18030", "big5", "latin-1"):
        try:
            return raw.decode(enc, errors="strict")
        except (UnicodeDecodeError, LookupError):
            continue
    return raw.decode("utf-8", errors="replace")


# ============================================================
# 7. 内置观察者：日志 / 统计 / 保存资源
# ============================================================
class LogObserver(Observer):
    async def update(self, event: str, payload: Any) -> None:
        print(f"[{event}] {payload}")


class StatObserver(Observer):
    def __init__(self) -> None:
        self.pages = 0
        self.resources = 0
        self.by_kind: dict[str, int] = defaultdict(int)

    async def update(self, event: str, payload: Any) -> None:
        if event == "page_done":
            self.pages += 1
        elif event == "resource_found":
            self.resources += 1
            self.by_kind[payload.kind] += 1

    def report(self) -> str:
        return (f"pages={self.pages} resources={self.resources} "
                f"kinds={dict(self.by_kind)}")


class ResourceSaveObserver(Observer):
    """收到 resource_found 事件后异步下载保存：
    - 视频 m3u8 → HLS 下载(合并 .ts)
    - 视频直链(mp4/flv…) → 直接下载
    - 其他资源 → 按类型分类保存"""

    def __init__(self, root: str, session: aiohttp.ClientSession,
                 concurrency: int = 8, *,
                 only_video: bool = False,
                 max_videos: int | None = None,
                 hls_segment_limit: int | None = None) -> None:
        self.root = root
        self.session = session
        self.sem = asyncio.Semaphore(concurrency)
        self._seen: set[str] = set()
        self.saved = 0
        self.only_video = only_video
        self.max_videos = max_videos
        self.video_count = 0
        self.hls = HLSClient(session, concurrency=concurrency)
        self.hls_segment_limit = hls_segment_limit
        self._tasks: set[asyncio.Task] = set()

    async def update(self, event: str, payload: Any) -> None:
        if event != "resource_found":
            return
        item: ResourceItem = payload
        if self.only_video and item.kind != "video":
            return
        key = _normalize(item.url)
        if key in self._seen:
            return
        self._seen.add(key)
        if item.extra and item.extra.get("skip"):
            print(f"[video-skip] 外部平台(需签名/DRM): {item.url}")
            return
        t = asyncio.create_task(self._download(item))
        self._tasks.add(t)
        t.add_done_callback(self._tasks.discard)

    async def _download(self, item: ResourceItem) -> None:
        async with self.sem:
            try:
                if item.kind == "video" and is_m3u8_url(item.url):
                    await self._download_hls(item)
                elif item.kind == "video":
                    await self._download_direct_video(item)
                else:
                    await self._download_other(item)
            except Exception as exc:                       # noqa: BLE001
                print(f"[save-fail] {item.url} -> {exc}")

    async def wait_idle(self) -> None:
        """等待所有在途下载任务结束(爬虫退出前调用)。"""
        if self._tasks:
            await asyncio.gather(*self._tasks, return_exceptions=True)

    # ---------- HLS 视频 ----------
    async def _download_hls(self, item: ResourceItem) -> None:
        if self.max_videos is not None and self.video_count >= self.max_videos:
            return
        self.video_count += 1
        dest = self._video_dest(item, ".ts")
        if os.path.exists(dest) and os.path.getsize(dest) > 0:
            print(f"[video-skip] 已存在 {dest}")
            return
        res = await self.hls.download(item.url, dest, referer=item.referer,
                                      max_segments=self.hls_segment_limit)
        if res.error or res.segments == 0:
            print(f"[video-fail] {item.url} -> {res.error or 'empty segments'}")
            return
        self.saved += 1
        print(f"[video-saved] {dest}  {res.variant or ''} "
              f"{res.segments}segs {res.bytes / 1048576:.1f}MB")

    # ---------- 直链视频 ----------
    async def _download_direct_video(self, item: ResourceItem) -> None:
        headers = {"Referer": item.referer} if item.referer else {}
        async with self.session.get(
                item.url, headers=headers,
                timeout=aiohttp.ClientTimeout(total=300)) as r:
            if r.status != 200:
                return
            data = await r.read()
            ext = _guess_ext(item.url, r.headers.get("Content-Type"))
        dest = self._video_dest(item, ext)
        if os.path.exists(dest) and os.path.getsize(dest) > 0:
            print(f"[video-skip] 已存在 {dest}")
            return
        os.makedirs(os.path.dirname(dest), exist_ok=True)
        await asyncio.to_thread(_write_file, dest, data)
        self.saved += 1
        print(f"[video-saved] {dest} {len(data) / 1048576:.1f}MB")

    # ---------- 其他资源 ----------
    async def _download_other(self, item: ResourceItem) -> None:
        headers = {"Referer": item.referer} if item.referer else {}
        async with self.session.get(item.url, headers=headers,
                                    timeout=aiohttp.ClientTimeout(total=60)) as r:
            if r.status != 200:
                return
            data = await r.read()
            ext = _guess_ext(item.url, r.headers.get("Content-Type"))
            name = hashlib.md5(item.url.encode()).hexdigest()[:16] + ext
            path = os.path.join(ResourceSaverFactory.save_dir(self.root,
                                                              item.kind), name)
            await asyncio.to_thread(_write_file, path, data)
            self.saved += 1
            print(f"[saved] {item.kind:<8} {path}")

    # ---------- 命名 ----------
    def _video_dest(self, item: ResourceItem, ext: str) -> str:
        extra = item.extra or {}
        vod = safe_filename(extra.get("vod_name") or _slug_from_url(item.referer or ""))
        sid = extra.get("sid") or 1
        nid = extra.get("nid")
        if nid:
            base = f"{nid}_s{sid}"
        else:
            base = hashlib.md5(item.url.encode()).hexdigest()[:12]
        folder = os.path.join(self.root, "videos", vod)
        os.makedirs(folder, exist_ok=True)
        return os.path.join(folder, base + ext)


def _write_file(path: str, data: bytes) -> None:
    with open(path, "wb") as f:
        f.write(data)


def _guess_ext(url: str, ctype: str | None) -> str:
    path = urlparse(url).path
    ext = os.path.splitext(path)[1]
    if ext and len(ext) <= 5:
        return ext
    if ctype:
        ext = mimetypes.guess_extension(ctype.split(";")[0].strip())
        if ext:
            return ext
    return ".bin"


# ============================================================
# 8. 逆向解密钩子（占位 —— 需按目标站点规则实现）
# ============================================================
class Decryptor:
    """
    『完美逆向』必须贴合目标站点。这里提供标准接口：
    - decrypt_html(raw, url)：处理 JS 混淆 / 加密正文
    - decrypt_media(data, item)：处理 m3u8 二次加密 / AES 分片
    若目标站点无加密，直接返回原值即可。
    """

    def decrypt_html(self, raw: bytes, url: str) -> bytes:  # noqa: ARG002
        return raw

    def decrypt_media(self, data: bytes, item: ResourceItem) -> bytes:  # noqa: ARG002
        return data


# ============================================================
# 9. 爬虫引擎
# ============================================================
class AsyncCrawler:
    def __init__(
        self,
        start_urls: list[str],
        queue: URLQueueStrategy,
        parser_names: list[str] | None = None,
        *,
        save_root: str = "downloads",
        max_depth: int = 2,
        concurrency: int = 20,
        allowed_domains: set[str] | None = None,
        save_resources: bool = True,
        only_video: bool = False,
        max_videos: int | None = None,
        hls_segment_limit: int | None = None,
        decryptor: Decryptor | None = None,
    ) -> None:
        self.start_urls = start_urls
        self.queue = queue
        self.default_parsers = parser_names or ["bs4", "xpath", "regex"]
        self.save_root = save_root
        self.max_depth = max_depth
        self.concurrency = concurrency
        self.allowed_domains = allowed_domains
        self.save_resources = save_resources
        self.only_video = only_video
        self.max_videos = max_videos
        self.hls_segment_limit = hls_segment_limit
        self.decryptor = decryptor or Decryptor()

        self.bus = EventBus()
        self.stats = StatObserver()
        self.bus.subscribe_all(self.stats, ["page_done", "resource_found"])
        self.bus.subscribe("error", LogObserver())

        self._session: aiohttp.ClientSession | None = None
        self._save_obs: ResourceSaveObserver | None = None
        self._active = 0
        self._active_lock = asyncio.Lock()
        self._idle = asyncio.Event()
        self._idle.set()

    # ---------- 生命周期 ----------
    async def __aenter__(self) -> "AsyncCrawler":
        self._session = aiohttp.ClientSession(
            headers={
                "User-Agent": ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                               "AppleWebKit/537.36 (KHTML, like Gecko) "
                               "Chrome/124.0 Safari/537.36"),
                "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
                "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
            },
            connector=aiohttp.TCPConnector(limit=self.concurrency * 2, ssl=False),
        )
        if self.save_resources:
            self._save_obs = ResourceSaveObserver(
                self.save_root, self._session,
                only_video=self.only_video,
                max_videos=self.max_videos,
                hls_segment_limit=self.hls_segment_limit,
            )
            self.bus.subscribe("resource_found", self._save_obs)
        return self

    async def __aexit__(self, *exc) -> None:  # noqa: ANN002
        if self._save_obs:
            # 等待在途下载任务(含 HLS 分片)全部结束
            await self._save_obs.wait_idle()
        if self._session:
            await self._session.close()

    # ---------- 入口 ----------
    async def run(self) -> None:
        for u in self.start_urls:
            await self.queue.push(PageTask(url=u, depth=0))

        workers = [asyncio.create_task(self._worker(i))
                   for i in range(self.concurrency)]
        try:
            await asyncio.gather(*workers)
        except asyncio.CancelledError:
            for w in workers:
                w.cancel()
            raise
        if self._save_obs:
            await self._save_obs.wait_idle()
        print("\n========== DONE ==========")
        print(self.stats.report())
        if self._save_obs:
            print(f"resource saved: {self._save_obs.saved}")

    # ---------- worker ----------
    async def _worker(self, wid: int) -> None:
        while True:
            task = await self.queue.pop()
            if task is None:
                if await self._all_done():
                    return
                await asyncio.sleep(0.1)
                continue
            try:
                await self._handle(task)
            except Exception as exc:                       # noqa: BLE001
                await self.bus.publish("error", f"{task.url} :: {exc}")
            finally:
                await self.queue.mark_done(task)
                await self.bus.publish("page_done", task.url)

    async def _all_done(self) -> bool:
        async with self._active_lock:
            if self._active == 0 and await self.queue.empty():
                return True
        return False

    # ---------- 单个页面处理 ----------
    async def _handle(self, task: PageTask) -> None:
        async with self._active_lock:
            self._active += 1
        try:
            raw, ctype = await self._fetch(task.url)
            if raw is None:
                return
            raw = self.decryptor.decrypt_html(raw, task.url)
            html = decode_html(raw, ctype)

            parser_names = task.task_parsers or self.default_parsers
            parsers = ParserFactory.create(parser_names)

            links: list[str] = []
            resources: list[ResourceItem] = []
            seen_r: set[str] = set()
            for p in parsers:
                try:
                    ls, rs = p.extract(html, task.url)
                    links.extend(ls)
                    for r in rs:
                        if r.url not in seen_r:
                            seen_r.add(r.url)
                            resources.append(r)
                except Exception as exc:                   # noqa: BLE001
                    await self.bus.publish("error",
                                           f"parser {p.name} on {task.url}: {exc}")

            # 发布资源
            for r in resources:
                await self.bus.publish("resource_found", r)

            # 入队子链接
            is_video_detail = _is_video_detail_page(task.url, html)
            base = _normalize(task.url)
            for link in links:
                link = urldefrag(link)[0]
                if not link.startswith(("http://", "https://")):
                    continue
                if self.allowed_domains:
                    host = urlparse(link).netloc
                    if host not in self.allowed_domains:
                        continue
                # 播放页 = 详情页的直接子页面(任意集数命名/线路参数)：
                # 属叶子页，由详情页直达，不受 max_depth 限制
                is_play = is_video_detail and link.startswith(base + "/")
                # 列表分页链接(?page=N)：列表扩展页，不受 max_depth 限制，
                # 保证全站分页链(all?page=2..N)能逐页延伸覆盖
                is_pager = bool(parse_qs(urlparse(link).query).get("page"))
                if task.depth < self.max_depth or is_play or is_pager:
                    await self.queue.push(PageTask(
                        url=link,
                        depth=task.depth + 1,
                        referer=task.url,
                        task_parsers=["player"] if is_play else None,
                    ))
        finally:
            async with self._active_lock:
                self._active -= 1

    async def _fetch(self, url: str) -> tuple[bytes | None, str | None]:
        assert self._session
        try:
            async with self._session.get(
                url, timeout=aiohttp.ClientTimeout(total=30), allow_redirects=True
            ) as resp:
                ctype = resp.headers.get("Content-Type")
                if resp.status != 200:
                    await self.bus.publish("error", f"{url} -> HTTP {resp.status}")
                    return None, ctype
                # 只解析 HTML / XML / JSON / 纯文本
                if ctype and not re.search(
                    r"(text|html|xml|json|javascript)", ctype, re.I
                ):
                    return None, ctype
                return await resp.read(), ctype
        except Exception as exc:                           # noqa: BLE001
            await self.bus.publish("error", f"{url} -> {exc}")
            return None, None


# ============================================================
# 10. 工具
# ============================================================
def _normalize(url: str) -> str:
    url, _ = urldefrag(url)
    return url.rstrip("/") or url


def _is_video_detail_page(url: str, html: str) -> bool:
    """判断是否为视频详情页：
    - 播放器配置的 link 模板含 {nid}
    - 或页面含线路 tab(data-sid)"""
    cfg = extract_player_config(html)
    if not cfg:
        return False
    if "{nid}" in (cfg.get("link") or ""):
        return True
    return bool(re.search(r'data-sid="\d+"', html))


def _slug_from_url(url: str) -> str:
    """取 URL 最后一段作为标识。"""
    return urlparse(url).path.rstrip("/").rsplit("/", 1)[-1]


# ============================================================
# 11. CLI 入口
# ============================================================
async def main() -> None:
    ap = argparse.ArgumentParser(description="fdzys 异步爬虫(支持 HLS 视频下载)")
    ap.add_argument("--start", default="https://fdzys.com",
                    help="起始 URL(可指定分类页或详情页)")
    ap.add_argument("--depth", type=int, default=2, help="最大爬取深度")
    ap.add_argument("--concurrency", type=int, default=16, help="并发数")
    ap.add_argument("--parsers", default="bs4,xpath,regex,player",
                    help="解析器组合(逗号分隔)")
    ap.add_argument("--db", default="fdzys_queue.db", help="队列数据库路径")
    ap.add_argument("--only-video", action="store_true",
                    help="只下载视频资源(跳过图片等)")
    ap.add_argument("--max-videos", type=int, default=None,
                    help="视频下载数量上限")
    ap.add_argument("--hls-segments", type=int, default=None,
                    help="每个 m3u8 最多下载分片数(预览用)")
    args = ap.parse_args()

    queue: URLQueueStrategy = SQLiteQueue(args.db)

    async with AsyncCrawler(
        start_urls=[args.start],
        queue=queue,
        parser_names=[p.strip() for p in args.parsers.split(",") if p.strip()],
        save_root="downloads",
        max_depth=args.depth,
        concurrency=args.concurrency,
        allowed_domains={"fdzys.com", "www.fdzys.com"},
        save_resources=True,
        only_video=args.only_video,
        max_videos=args.max_videos,
        hls_segment_limit=args.hls_segments,
    ) as crawler:
        await crawler.run()


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("\n[interrupted]")