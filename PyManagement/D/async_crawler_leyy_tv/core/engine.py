
# core/engine.py
from __future__ import annotations

import asyncio
import logging
import time
from typing import Optional
from urllib.parse import urljoin, urlparse

import aiohttp

from config import CrawlerConfig
from core.event import Event, EventEmitter, EventType
from core.models import CrawlStats, QueueItem
from downloader.factory import DownloaderFactory
from parser.base import ParserStrategy
from parser.factory import ParserFactory
from queue_.base import QueueStrategy
from storage.file_manager import FileManager, ResourceClassifier
from utils.encoding import safe_decode

logger = logging.getLogger("Engine")


class CrawlEngine:
    """
    异步爬虫引擎。
    - 队列策略可切换（内存 / SQLite）
    - 解析器策略可全局/单任务切换
    - 观察者模式事件通知
    """

    def __init__(
        self,
        config: CrawlerConfig,
        queue_strategy: QueueStrategy,
        parser: Optional[ParserStrategy] = None,
    ):
        self.cfg = config
        self.queue = queue_strategy
        self.parser = parser or ParserFactory.create(config.parser_type)

        self.file_manager = FileManager(config.output_dir)
        self.events = EventEmitter()
        self.stats = CrawlStats()

        self.semaphore = asyncio.Semaphore(config.max_concurrency)
        self.session: Optional[aiohttp.ClientSession] = None

        # 单任务解析器覆盖 & 标题缓存
        self._task_parsers: dict[str, ParserStrategy] = {}
        self._title_cache: dict[str, str] = {}

        # 去重（内存模式也保证 URL 唯一）
        self._seen_urls: set[str] = set()

        # 爬取结束标志
        self._stop = asyncio.Event()

    # ---------- 配置接口 ----------

    def set_global_parser(self, parser: ParserStrategy) -> None:
        self.parser = parser

    def set_task_parser(self, url: str, parser: ParserStrategy) -> None:
        self._task_parsers[url] = parser

    def _get_parser(self, url: str) -> ParserStrategy:
        return self._task_parsers.get(url, self.parser)

    # ---------- 启动 ----------

    async def run(self, seed_urls: list[str] | None = None) -> None:
        seeds = seed_urls or self.cfg.seed_urls

        # 初始化队列
        if hasattr(self.queue, "init_db"):
            await self.queue.init_db()
            if hasattr(self.queue, "reset_processing"):
                await self.queue.reset_processing()

        # 种子入队
        for url in seeds:
            if url in self._seen_urls:
                continue
            self._seen_urls.add(url)
            await self.queue.put(QueueItem(url=url, depth=0))
            self.stats.discovered += 1
            await self.events.emit(Event(
                type=EventType.URL_DISCOVERED, data={"url": url},
            ))

        connector = aiohttp.TCPConnector(limit=0, ssl=False)
        timeout = aiohttp.ClientTimeout(total=self.cfg.request_timeout)

        async with aiohttp.ClientSession(
            headers=self.cfg.headers,
            connector=connector,
            timeout=timeout,
        ) as session:
            self.session = session
            workers = [
                asyncio.create_task(self._worker(i))
                for i in range(self.cfg.worker_count)
            ]
            await asyncio.gather(*workers, return_exceptions=True)

        self.stats.finished_at = time.time()
        await self.events.emit(Event(
            type=EventType.CRAWL_COMPLETE,
            data={"stats": self.stats},
        ))
        await self.queue.close()

    # ---------- Worker ----------

    async def _worker(self, worker_id: int) -> None:
        idle_rounds = 0
        while not self._stop.is_set():
            item = await self.queue.get()

            if item is None:
                if await self.queue.is_complete():
                    # 再确认一次，避免竞态
                    await asyncio.sleep(0.15)
                    if await self.queue.is_complete() and \
                            (await self.queue.get()) is None:
                        break
                idle_rounds += 1
                await asyncio.sleep(min(0.05 * idle_rounds, 0.5))
                continue

            idle_rounds = 0
            async with self.semaphore:
                try:
                    await self._process_item(item)
                    await self.queue.task_done(item)
                except Exception as e:
                    logger.error(f"[W{worker_id}] {item.url} 处理失败: {e!r}")
                    self.stats.errors += 1
                    if hasattr(self.queue, "mark_error"):
                        await self.queue.mark_error(item)
                    else:
                        await self.queue.task_done(item)

    # ---------- 处理单个 URL ----------

    async def _process_item(self, item: QueueItem) -> None:
        # 深度控制
        if item.depth > self.cfg.max_depth:
            self.stats.skipped += 1
            return

        async with self.session.get(item.url, allow_redirects=True) as resp:
            content_type = resp.headers.get("Content-Type", "")
            raw = await resp.read()

        rtype = ResourceClassifier.classify(item.url, content_type)

        if rtype in ("image", "video", "audio", "document", "archive"):
            await self._download_resource(item, rtype, content_type)
        else:
            html = safe_decode(raw, resp.charset if resp.charset else None)
            await self._parse_page(item, html)

    async def _parse_page(self, item: QueueItem, html: str) -> None:
        parser = self._get_parser(item.url)
        try:
            result = parser.parse(html, self.cfg.parse_rules)
        except Exception as e:
            logger.error(f"解析失败 {item.url}: {e!r}")
            return

        self.stats.parsed += 1

        # 缓存页面标题，供子资源确定目录
        title = (result.get("title") or ["未命名"])[0].strip()
        if title:
            self._title_cache[item.url] = title
            if hasattr(self.queue, "set_title"):
                await self.queue.set_title(item.url, title)

        # 过滤出同域名链接
        base_host = urlparse(item.url).netloc
        candidates: list[str] = []

        for link in result.get("links", []):
            absolute = urljoin(item.url, link)
            absolute, _ = _strip_fragment(absolute)
            if not absolute.startswith(("http://", "https://")):
                continue
            if self.cfg.same_domain_only and \
                    urlparse(absolute).netloc != base_host:
                continue
            candidates.append(absolute)

        # 图片/视频/m3u8/mpd 也作为待下载资源入队
        for key in ("images", "videos", "m3u8", "mpd"):
            for res_url in result.get(key, []):
                absolute = urljoin(item.url, res_url)
                absolute, _ = _strip_fragment(absolute)
                if absolute.startswith(("http://", "https://")):
                    candidates.append(absolute)

        for url in candidates:
            if url in self._seen_urls:
                continue
            self._seen_urls.add(url)

            new_item = QueueItem(
                url=url,
                parent_url=item.url,
                depth=item.depth + 1,
                parent_title=title,
            )
            await self.queue.put(new_item)
            self.stats.discovered += 1
            await self.events.emit(Event(
                type=EventType.URL_DISCOVERED, data={"url": url},
            ))

    async def _download_resource(
        self, item: QueueItem, rtype: str, content_type: str,
    ) -> None:
        downloader = DownloaderFactory.get_downloader(item.url, content_type)

        # 确定目录标题
        title = item.parent_title
        if not title and item.parent_url:
            title = self._title_cache.get(item.parent_url)
            if not title and hasattr(self.queue, "get_title"):
                title = await self.queue.get_title(item.parent_url)
        if not title:
            title = "未命名资源"

        filename = _extract_filename(item.url)
        save_path = self.file_manager.get_save_path(
            title=title,
            resource_type=rtype,
            filename=filename,
        )

        await self.events.emit(Event(
            type=EventType.DOWNLOAD_START,
            data={"url": item.url, "path": str(save_path)},
        ))

        ok = await downloader.download(
            item.url, save_path, session=self.session,
        )

        if ok:
            self.stats.downloaded += 1
            await self.events.emit(Event(
                type=EventType.DOWNLOAD_COMPLETE,
                data={"url": item.url, "path": str(save_path), "title": title},
            ))
        else:
            self.stats.errors += 1
            await self.events.emit(Event(
                type=EventType.DOWNLOAD_ERROR,
                data={"url": item.url, "title": title},
            ))


def _extract_filename(url: str) -> str:
    path = urlparse(url).path
    name = path.rsplit("/", 1)[-1] or "resource"
    # 过滤掉非法查询后缀
    return name.split("?")[0]


def _strip_fragment(url: str) -> tuple[str, str]:
    p = urlparse(url)
    return p._replace(fragment="").geturl(), p.fragment