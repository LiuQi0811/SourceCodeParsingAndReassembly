# -*- coding: utf-8 -*-
"""爬虫引擎"""
import asyncio
import hashlib
import logging
import re
from pathlib import Path
from typing import Optional
from urllib.parse import urlparse

import aiofiles
import aiohttp

from config import Config
from patterns.observer import EventBus, LogObserver, CounterObserver
from utils.encoding import decode_content
from utils.classifier import ResourceClassifier
from queues import create_queue, QueueStrategy
from parsers import ParserFactory, CompositeParser
from downloader import StreamManager


class CrawlerEngine:

    def __init__(self, config: Config):
        self.config = config
        self.event_bus = EventBus()
        self.classifier = ResourceClassifier(config)

        self.session: Optional[aiohttp.ClientSession] = None
        self.queue: Optional[QueueStrategy] = None
        self.parser: Optional[CompositeParser] = None
        self.streamer: Optional[StreamManager] = None

        self._semaphore = asyncio.Semaphore(config.concurrency)
        self._resource_hashes: set[str] = set()
        self._page_count = 0
        self._page_lock = asyncio.Lock()

        # 观察者
        self.event_bus.subscribe("log", LogObserver())
        self.counter = CounterObserver()
        for evt in ("page_done", "resource_saved", "stream_done", "page_fail"):
            self.event_bus.subscribe(evt, self.counter)

    # --------------------------------------------------------
    # 生命周期
    # --------------------------------------------------------
    async def start(self):
        # 队列策略
        self.queue = create_queue(self.config.queue_mode, self.config.db_path)

        # 解析器组合
        parsers = ParserFactory.create_all(self.config.parsers)
        self.parser = CompositeParser(parsers)

        # HTTP 会话
        timeout = aiohttp.ClientTimeout(
            total=self.config.timeout_total,
            connect=self.config.timeout_connect,
        )
        connector = aiohttp.TCPConnector(
            limit=0, limit_per_host=8, ttl_dns_cache=300
        )
        self.session = aiohttp.ClientSession(
            timeout=timeout,
            connector=connector,
            headers={"User-Agent": self.config.user_agent, **self.config.headers},
        )
        self.streamer = StreamManager(self.config, self.session)

        Path(self.config.output_dir).mkdir(parents=True, exist_ok=True)

        # 投递起始 URL
        for u in self.config.start_urls:
            if not await self.queue.is_seen(u):
                await self.queue.put(u, depth=0, title="")

        await self.event_bus.emit(
            "log",
            {"message": f"爬虫启动，队列模式={self.config.queue_mode}"},
        )

        try:
            await self._crawl_loop()
        finally:
            if self.session:
                await self.session.close()
            if self.queue:
                await self.queue.close()
            self._print_stats()

    # --------------------------------------------------------
    # 主循环
    # --------------------------------------------------------
    async def _crawl_loop(self):
        active: set[asyncio.Task] = set()
        idle_rounds = 0

        while True:
            item = await self.queue.get()

            if item is None:
                if active:
                    await asyncio.wait(active, timeout=3,
                                       return_when=asyncio.FIRST_COMPLETED)
                    idle_rounds = 0
                    continue
                pending = await self.queue.pending_count()
                if pending == 0:
                    idle_rounds += 1
                    if idle_rounds >= 3:
                        break
                    await asyncio.sleep(1.0)
                else:
                    idle_rounds = 0
                    await asyncio.sleep(0.2)
                continue

            idle_rounds = 0

            async with self._page_lock:
                if self._page_count >= self.config.max_pages:
                    await self.queue.mark_done(item["url"])
                    continue
                self._page_count += 1

            t = asyncio.create_task(self._process_item(item))
            active.add(t)
            t.add_done_callback(active.discard)

            if len(active) >= self.config.concurrency:
                await asyncio.wait(active, return_when=asyncio.FIRST_COMPLETED)

        if active:
            await asyncio.gather(*active, return_exceptions=True)

    # --------------------------------------------------------
    # 单项处理
    # --------------------------------------------------------
    async def _process_item(self, item: dict):
        url = item["url"]
        depth = item.get("depth", 0)
        title = item.get("title", "")

        # 域名白名单
        if self.config.allowed_domains:
            host = urlparse(url).netloc
            if not any(host.endswith(d) for d in self.config.allowed_domains):
                await self.queue.mark_done(url)
                return

        # 流媒体（优先，避免被当网页抓）
        path_lower = urlparse(url).path.lower()
        if (path_lower.endswith((".m3u8", ".mpd", ".flv"))
                or url.lower().startswith(("rtmp://", "rtsp://"))):
            await self._download_stream(url, title)
            await self.queue.mark_done(url)
            return

        # 资源文件
        rtype = self.classifier.classify(url)
        if rtype in ("image", "video", "audio", "document", "stream"):
            await self._download_resource(url, rtype, title)
            await self.queue.mark_done(url)
            return

        # 深度限制
        if depth > self.config.max_depth:
            await self.queue.mark_done(url)
            return

        # 抓网页
        async with self._semaphore:
            html_text = await self._fetch_page(url)

        if html_text is None:
            await self.event_bus.emit("page_fail", {"url": url})
            await self.queue.mark_done(url)
            return

        page_title = self.parser.parse_title(html_text) or title \
            or urlparse(url).netloc
        page_title = re.sub(r"\s+", " ", page_title).strip()[:100] or "untitled"

        # 分发新链接
        for link in self.parser.parse_links(html_text, url):
            link = link.split("#")[0].rstrip("/")
            if not await self.queue.is_seen(link):
                await self.queue.put(link, depth=depth + 1, title=page_title)

        # 资源
        for res in self.parser.parse_resources(html_text, url):
            rurl = res["url"]
            if self.classifier.classify(rurl) != "other":
                if not await self.queue.is_seen(rurl):
                    await self.queue.put(rurl, depth=depth, title=page_title)

        # 流
        for s in self.parser.parse_streams(html_text, url):
            if not await self.queue.is_seen(s["url"]):
                await self.queue.put(s["url"], depth=depth, title=page_title)

        await self.queue.mark_done(url)
        await self.event_bus.emit("page_done", {"url": url, "title": page_title})

    # --------------------------------------------------------
    # HTTP 抓取
    # --------------------------------------------------------
    async def _fetch_page(self, url: str) -> Optional[str]:
        for attempt in range(self.config.max_retries):
            try:
                async with self.session.get(url, allow_redirects=True) as resp:
                    if resp.status == 200:
                        raw = await resp.read()
                        return decode_content(raw, dict(resp.headers))
                    if 500 <= resp.status < 600:
                        await asyncio.sleep(self.config.retry_delay * (attempt + 1))
                        continue
                    logging.debug(f"HTTP {resp.status}: {url}")
                    return None
            except (asyncio.TimeoutError,
                    aiohttp.ClientConnectorError,
                    aiohttp.ServerDisconnectedError) as e:
                logging.debug(f"网络错误({attempt + 1}): {url} - {e}")
            except aiohttp.ClientError as e:
                logging.debug(f"客户端错误: {url} - {e}")
                return None
            except Exception as e:
                logging.debug(f"抓取异常: {url} - {e}")
            if attempt < self.config.max_retries - 1:
                await asyncio.sleep(self.config.retry_delay * (attempt + 1))
        return None

    # --------------------------------------------------------
    # 资源下载
    # --------------------------------------------------------
    async def _download_resource(self, url: str, rtype: str, title: str):
        h = hashlib.md5(url.encode()).hexdigest()
        if h in self._resource_hashes:
            return
        self._resource_hashes.add(h)

        out_dir = self.classifier.get_dir(rtype, title)
        out_dir.mkdir(parents=True, exist_ok=True)
        ext = self.classifier.get_ext(url)
        fname = h[:12] + "_" + hashlib.sha1(url.encode()).hexdigest()[:8] + ext
        out_path = out_dir / fname
        if out_path.exists() and out_path.stat().st_size > 0:
            return

        for attempt in range(self.config.max_retries):
            try:
                async with self.session.get(url) as resp:
                    if resp.status == 200:
                        tmp = out_path.with_suffix(out_path.suffix + ".part")
                        async with aiofiles.open(tmp, "wb") as f:
                            async for chunk in resp.content.iter_chunked(64 * 1024):
                                await f.write(chunk)
                        tmp.replace(out_path)
                        logging.info(f"资源保存: {out_path}")
                        await self.event_bus.emit(
                            "resource_saved",
                            {"url": url, "path": str(out_path)},
                        )
                        return
                    if 500 <= resp.status < 600:
                        await asyncio.sleep(self.config.retry_delay * (attempt + 1))
                        continue
                    return
            except Exception as e:
                if attempt < self.config.max_retries - 1:
                    await asyncio.sleep(self.config.retry_delay * (attempt + 1))
                else:
                    logging.debug(f"资源下载失败: {url} - {e}")

    async def _download_stream(self, url: str, title: str):
        out_dir = self.classifier.get_dir("stream", title)
        out_dir.mkdir(parents=True, exist_ok=True)
        fname = hashlib.sha1(url.encode()).hexdigest()[:16]
        result = await self.streamer.download(url, out_dir, fname)
        if result:
            await self.event_bus.emit("stream_done", {"url": url, "path": result})
        else:
            logging.warning(f"流媒体下载失败: {url}")

    # --------------------------------------------------------
    # 统计
    # --------------------------------------------------------
    def _print_stats(self):
        logging.info("=" * 50)
        logging.info("抓取统计:")
        for k, v in self.counter.summary().items():
            logging.info(f"  {k}: {v}")
        logging.info("=" * 50)