# -*- coding: utf-8 -*-
"""爬取引擎：抓取 -> 字符集识别 -> 解码 -> 解析 -> 入队 -> 下载，全异步。"""
from __future__ import annotations

import asyncio
import logging
from typing import Optional

import aiohttp

from .charset import decode as decode_bytes
from .config import Config
from .downloaders import DownloaderFactory
from .models import Page, Task
from .observer import EventBus, Events, LogObserver, StatsObserver
from .parsers import ParserFactory
from .queues import QueueFactory, UrlQueue
from .savers import TitleSaver
from .strategies import CrawlStrategy, StrategyFactory

logger = logging.getLogger(__name__)


class CrawlEngine:
    """异步爬虫引擎。

    设计：
    - 工作池：concurrency 个 worker 并发消费队列
    - 观察者模式：EventBus 发布事件，StatsObserver / LogObserver 订阅
    - 工厂模式：QueueFactory / ParserFactory / DownloaderFactory / StrategyFactory
    - 策略模式：CrawlStrategy 决定链接/资源过滤与停止条件
    - 双队列：memory（一次性加载）/ sqlite（边发现边入库、断点续爬）
    """

    def __init__(
        self,
        cfg: Config,
        queue: Optional[UrlQueue] = None,
        bus: Optional[EventBus] = None,
        saver: Optional[TitleSaver] = None,
    ) -> None:
        self.cfg = cfg
        self.bus = bus or EventBus()
        self.stats = StatsObserver()
        self.saver = saver or TitleSaver(cfg.save_root, title_dir=cfg.title_dir,
                                         overwrite=cfg.overwrite)
        self.queue = queue
        self.parser_factory = ParserFactory(cfg.parser_mode)
        self.strategy: CrawlStrategy = StrategyFactory.create(cfg.strategy, cfg)
        self._stop = asyncio.Event()
        self._active = 0
        self._dl_sem: Optional[asyncio.Semaphore] = None
        self._session: Optional[aiohttp.ClientSession] = None
        self._dl_factory: Optional[DownloaderFactory] = None

    # ------------------------------------------------------------ 运行
    async def run(self) -> dict:
        await self.stats.attach(self.bus)
        await LogObserver(logger).attach(self.bus)

        self._session = aiohttp.ClientSession(
            connector=aiohttp.TCPConnector(limit=max(16, self.cfg.concurrency * 2)),
            timeout=aiohttp.ClientTimeout(total=self.cfg.timeout, connect=15),
            headers={"User-Agent": self.cfg.user_agent},
        )
        self._dl_sem = asyncio.Semaphore(self.cfg.download_concurrency)
        self._dl_factory = DownloaderFactory(self.cfg, self.saver, self._session, self._dl_sem)

        if self.queue is None:
            self.queue = await QueueFactory.create(self.cfg)

        await self.bus.publish(Events.CRAWL_STARTED, start_urls=self.cfg.start_urls)

        # 起始 URL 入队
        for u in self.cfg.start_urls:
            await self.queue.put(Task(url=u, depth=0))

        workers = [asyncio.create_task(self._worker()) for _ in range(max(1, self.cfg.concurrency))]
        supervisor = asyncio.create_task(self._supervise())

        await asyncio.gather(*workers)
        self._stop.set()
        await supervisor

        if isinstance(self.queue, UrlQueue):
            await self.queue.close()
        if self._session is not None:
            await self._session.close()

        summary = self.stats.summary()
        await self.bus.publish(Events.CRAWL_FINISHED, summary=summary)
        return summary

    # ------------------------------------------------------------ 工作池
    async def _worker(self) -> None:
        while not self._stop.is_set():
            task = await self.queue.get()
            if task is None:
                await asyncio.sleep(0.05)
                continue
            if self._stop.is_set():
                await self.queue.release(task)
                return

            self._active += 1
            ok = True
            processed = True
            try:
                processed = await self._process(task)
            except asyncio.CancelledError:
                self._active -= 1
                await self.queue.release(task)
                raise
            except Exception as e:
                ok = False
                await self.bus.publish(Events.PAGE_FAILED, url=task.url, error=str(e))
            finally:
                self._active -= 1
                if processed:
                    await self.queue.done(task, ok)
                else:
                    # 提前停止：任务放回队列，供断点续爬
                    await self.queue.release(task)

    async def _supervise(self) -> None:
        while True:
            if self._stop.is_set():
                return
            if (
                self._active == 0
                and await self.queue.empty()
                and await self.queue.pending_count() == 0
            ):
                self._stop.set()
                return
            await asyncio.sleep(0.15)

    # ------------------------------------------------------------ 页面处理
    async def _process(self, task: Task) -> bool:
        if self.strategy.should_stop(self.stats.pages_fetched):
            self._stop.set()
            return False

        page = await self._fetch(task)
        await self.bus.publish(Events.PAGE_FETCHED, url=task.url,
                               status=page.status, charset=page.charset)

        parser = self.parser_factory.get(task.parser_mode)
        pr = parser.parse(page, referer=task.referer)

        title = pr.title or task.title
        page.title = title
        await self.bus.publish(Events.PAGE_PARSED, url=task.url,
                               title=title, parsers=pr.parser_used,
                               links=len(pr.links), resources=len(pr.resources))

        # 链接入队
        if self.strategy.should_follow_links():
            for link in pr.links:
                if self.strategy.accept_link(link, task.depth + 1, self.cfg.start_urls):
                    added = await self.queue.put(
                        Task(url=link, depth=task.depth + 1,
                             parser_mode=task.parser_mode, referer=task.url, title=title)
                    )
                    if added:
                        await self.bus.publish(Events.LINK_QUEUED, url=link, depth=task.depth + 1)

        # 资源下载
        refs = [r for r in pr.resources if self.strategy.accept_resource(r)]
        for r in refs:
            await self.bus.publish(Events.RESOURCE_FOUND, url=r.url, kind=r.kind)
        if refs and self.cfg.download_resources:
            await asyncio.gather(*(self._download_one(r, title) for r in refs))

        return True

    # ------------------------------------------------------------ 抓取
    async def _fetch(self, task: Task) -> Page:
        headers = {}
        if task.referer:
            headers["Referer"] = task.referer
        last: Exception | None = None
        for attempt in range(self.cfg.retries + 1):
            try:
                resp = await self._session.get(task.url, headers=headers, allow_redirects=True)
                try:
                    if resp.status >= 400:
                        raise RuntimeError(f"HTTP {resp.status}")
                    raw = await resp.read()
                    ct = resp.headers.get("Content-Type", "")
                    text, charset = decode_bytes(raw, ct, self.cfg.charset_fallback)
                    return Page(url=str(resp.url), text=text, charset=charset, raw=raw,
                                headers=dict(resp.headers), status=resp.status)
                finally:
                    await resp.release()
            except (aiohttp.ClientError, asyncio.TimeoutError, RuntimeError) as e:
                last = e
                if attempt < self.cfg.retries:
                    await asyncio.sleep(0.5 * (attempt + 1))
        raise last or RuntimeError("fetch failed")

    # ------------------------------------------------------------ 资源下载
    async def _download_one(self, ref, title: str | None) -> None:
        async with self._dl_sem:
            dl = self._dl_factory.create(ref)
            result = await dl.download(ref, title)
        if result.ok:
            await self.saver.record(title, result.as_manifest())
            await self.bus.publish(Events.RESOURCE_DOWNLOADED, url=ref.url,
                                   path=result.rel_path, size=result.size)
        else:
            await self.bus.publish(Events.RESOURCE_FAILED, url=ref.url, error=result.error)
