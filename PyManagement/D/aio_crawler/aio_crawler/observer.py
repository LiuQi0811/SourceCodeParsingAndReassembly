# -*- coding: utf-8 -*-
"""观察者模式：事件总线 + 内置观察者（日志、统计）。"""
from __future__ import annotations

import asyncio
import logging
import time
from collections import defaultdict
from typing import Any, Callable, Coroutine

logger = logging.getLogger("aio_crawler.observer")


class Events:
    """事件名常量。"""

    CRAWL_STARTED = "crawl_started"
    CRAWL_FINISHED = "crawl_finished"
    PAGE_FETCHED = "page_fetched"
    PAGE_PARSED = "page_parsed"
    PAGE_FAILED = "page_failed"
    LINK_QUEUED = "link_queued"
    RESOURCE_FOUND = "resource_found"
    RESOURCE_DOWNLOADED = "resource_downloaded"
    RESOURCE_FAILED = "resource_failed"
    ERROR = "error"


Handler = Callable[..., Coroutine]


class EventBus:
    """事件总线：事件 -> 观察者集合。可全局单例使用。"""

    def __init__(self) -> None:
        self._subs: dict[str, list[Handler]] = defaultdict(list)
        self._lock = asyncio.Lock()

    def subscribe(self, event: str, handler: Handler) -> None:
        self._subs[event].append(handler)

    def unsubscribe(self, event: str, handler: Handler) -> None:
        if handler in self._subs.get(event, []):
            self._subs[event].remove(handler)

    async def publish(self, event: str, **data: Any) -> None:
        handlers = list(self._subs.get(event, ()))
        if not handlers:
            return
        async with self._lock:
            for h in handlers:
                try:
                    await h(event=event, **data)
                except Exception:  # 观察者失败不影响主流程
                    logger.exception("观察者 %r 处理事件 %r 失败", h, event)


# ---------------------------------------------------------------- 观察者
class StatsObserver:
    """统计观察者：汇总抓取/解析/下载计数与耗时。"""

    def __init__(self) -> None:
        self.started_at = 0.0
        self.finished_at = 0.0
        self.pages_fetched = 0
        self.pages_failed = 0
        self.links_queued = 0
        self.resources_found = 0
        self.resources_downloaded = 0
        self.resources_failed = 0
        self.errors: list[str] = []

    async def attach(self, bus: EventBus) -> None:
        bus.subscribe(Events.CRAWL_STARTED, self.on_started)
        bus.subscribe(Events.CRAWL_FINISHED, self.on_finished)
        bus.subscribe(Events.PAGE_FETCHED, self.on_page_fetched)
        bus.subscribe(Events.PAGE_FAILED, self.on_page_failed)
        bus.subscribe(Events.LINK_QUEUED, self.on_link_queued)
        bus.subscribe(Events.RESOURCE_FOUND, self.on_resource_found)
        bus.subscribe(Events.RESOURCE_DOWNLOADED, self.on_resource_downloaded)
        bus.subscribe(Events.RESOURCE_FAILED, self.on_resource_failed)
        bus.subscribe(Events.ERROR, self.on_error)

    async def on_started(self, **kw) -> None:
        self.started_at = time.monotonic()

    async def on_finished(self, **kw) -> None:
        self.finished_at = time.monotonic()

    async def on_page_fetched(self, **kw) -> None:
        self.pages_fetched += 1

    async def on_page_failed(self, **kw) -> None:
        self.pages_failed += 1

    async def on_link_queued(self, **kw) -> None:
        self.links_queued += 1

    async def on_resource_found(self, **kw) -> None:
        self.resources_found += 1

    async def on_resource_downloaded(self, **kw) -> None:
        self.resources_downloaded += 1

    async def on_resource_failed(self, **kw) -> None:
        self.resources_failed += 1

    async def on_error(self, **kw) -> None:
        self.errors.append(str(kw.get("message", kw)))

    @property
    def elapsed(self) -> float:
        return (self.finished_at or time.monotonic()) - (self.started_at or time.monotonic())

    def summary(self) -> dict[str, Any]:
        return {
            "elapsed_sec": round(self.elapsed, 2),
            "pages_fetched": self.pages_fetched,
            "pages_failed": self.pages_failed,
            "links_queued": self.links_queued,
            "resources_found": self.resources_found,
            "resources_downloaded": self.resources_downloaded,
            "resources_failed": self.resources_failed,
            "errors": self.errors[:10],
        }


class LogObserver:
    """日志观察者：把关键事件输出到 logger。"""

    def __init__(self, log: logging.Logger) -> None:
        self.log = log

    async def attach(self, bus: EventBus) -> None:
        bus.subscribe(Events.CRAWL_STARTED, self.on_started)
        bus.subscribe(Events.CRAWL_FINISHED, self.on_finished)
        bus.subscribe(Events.PAGE_FETCHED, self.on_page_fetched)
        bus.subscribe(Events.PAGE_FAILED, self.on_page_failed)
        bus.subscribe(Events.RESOURCE_DOWNLOADED, self.on_downloaded)
        bus.subscribe(Events.RESOURCE_FAILED, self.on_dl_failed)
        bus.subscribe(Events.ERROR, self.on_error)

    async def on_started(self, **kw) -> None:
        self.log.info("爬取开始: %s", kw.get("start_urls"))

    async def on_finished(self, **kw) -> None:
        self.log.info("爬取结束: %s", kw.get("summary"))

    async def on_page_fetched(self, **kw) -> None:
        self.log.debug("已抓取 [%s] %s", kw.get("status"), kw.get("url"))

    async def on_page_failed(self, **kw) -> None:
        self.log.warning("页面失败 %s: %s", kw.get("url"), kw.get("error"))

    async def on_downloaded(self, **kw) -> None:
        self.log.info("已下载 %s <- %s", kw.get("path"), kw.get("url"))

    async def on_dl_failed(self, **kw) -> None:
        self.log.warning("下载失败 %s: %s", kw.get("url"), kw.get("error"))

    async def on_error(self, **kw) -> None:
        self.log.error("错误: %s", kw.get("message"))
