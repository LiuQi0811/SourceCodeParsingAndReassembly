# observers/progress_reporter.py
from __future__ import annotations

import logging

from core.event import Event

logger = logging.getLogger("Progress")


class ProgressReporter:
    """下载进度观察者"""

    def __init__(self, verbose: bool = True):
        self.verbose = verbose
        self._total = 0
        self._done = 0
        self._failed = 0

    async def on_url_discovered(self, event: Event) -> None:
        self._total += 1

    async def on_download_start(self, event: Event) -> None:
        if self.verbose:
            logger.info(f"↓ 开始下载: {event.data.get('url')}")

    async def on_download_complete(self, event: Event) -> None:
        self._done += 1
        if self.verbose:
            logger.info(
                f"✓ [{self._done}/{self._total}] "
                f"{event.data.get('title', '')} → {event.data.get('path')}"
            )

    async def on_download_error(self, event: Event) -> None:
        self._failed += 1
        logger.warning(f"✗ 失败: {event.data.get('url')}")

    async def on_crawl_complete(self, event: Event) -> None:
        stats = event.data.get("stats")
        if stats is not None:
            logger.info(f"爬取完成: {stats.summary()}")
        else:
            logger.info(
                f"爬取完成: 下载={self._done} 失败={self._failed}"
            )