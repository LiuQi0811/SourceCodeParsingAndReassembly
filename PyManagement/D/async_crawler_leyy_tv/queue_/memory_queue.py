# queue_/memory_queue.py
from __future__ import annotations

import asyncio
from typing import Optional

from core.models import QueueItem
from .base import QueueStrategy


class MemoryQueueStrategy(QueueStrategy):
    """
    内存队列策略：一次性/增量加载 URL 到 asyncio.Queue。
    _pending 计数在 put 时 +1，task_done 时 -1。
    """

    def __init__(self):
        self._queue: asyncio.Queue[QueueItem] = asyncio.Queue()
        self._pending = 0
        self._lock = asyncio.Lock()

    async def put(self, item: QueueItem) -> None:
        async with self._lock:
            self._pending += 1
        await self._queue.put(item)

    async def get(self) -> Optional[QueueItem]:
        try:
            return self._queue.get_nowait()
        except asyncio.QueueEmpty:
            return None

    async def task_done(self, item: QueueItem) -> None:
        async with self._lock:
            if self._pending > 0:
                self._pending -= 1
        try:
            self._queue.task_done()
        except ValueError:
            pass

    async def size(self) -> int:
        return self._queue.qsize()

    async def is_complete(self) -> bool:
        async with self._lock:
            return self._pending <= 0

    async def close(self) -> None:
        pass