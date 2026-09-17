# -*- coding: utf-8 -*-
"""内存队列：一次性加载全部 URL，进程内去重，重启即失效。"""
from __future__ import annotations

import asyncio
import logging

from ..models import Task
from ..urlutils import normalize_url
from .base import UrlQueue

logger = logging.getLogger(__name__)


class MemoryUrlQueue(UrlQueue):
    """基于 asyncio.Queue 的内存队列。

    - 去重：seen 集合（规范化 URL）
    - 排序：按入队顺序（BFS 天然成立，depth 递增）
    """

    name = "memory"

    def __init__(self, keep_params: bool = True) -> None:
        self._q: asyncio.Queue[Task] = asyncio.Queue()
        self._seen: set[str] = set()
        self._pending = 0
        self._done_cnt = 0
        self._failed_cnt = 0
        self._keep_params = keep_params

    def _key(self, url: str) -> str:
        return normalize_url(url, keep_params=self._keep_params)

    async def put(self, task: Task) -> bool:
        key = self._key(task.url)
        if key in self._seen:
            return False
        self._seen.add(key)
        self._q.put_nowait(task)
        self._pending += 1
        return True

    async def get(self) -> Task | None:
        try:
            task = self._q.get_nowait()
        except asyncio.QueueEmpty:
            return None
        self._pending -= 1
        return task

    async def done(self, task: Task, ok: bool = True) -> None:
        if ok:
            self._done_cnt += 1
        else:
            self._failed_cnt += 1

    async def release(self, task: Task) -> None:
        # 内存队列中断时直接丢弃（进程结束即失效）
        self._pending += 0

    async def empty(self) -> bool:
        return self._q.empty() and self._pending <= 0

    async def pending_count(self) -> int:
        return self._pending + self._q.qsize()

    async def close(self) -> None:
        while not self._q.empty():
            try:
                self._q.get_nowait()
            except asyncio.QueueEmpty:
                break

    # ------------------------------------------------------------ 状态
    @property
    def seen_count(self) -> int:
        return len(self._seen)

    @property
    def done_count(self) -> int:
        return self._done_cnt

    @property
    def failed_count(self) -> int:
        return self._failed_cnt
