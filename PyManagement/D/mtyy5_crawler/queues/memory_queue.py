# -*- coding: utf-8 -*-
"""① 内存队列"""
import asyncio
from typing import Optional

from queues.base import QueueStrategy


class MemoryQueueStrategy(QueueStrategy):
    def __init__(self):
        self.queue: asyncio.Queue = asyncio.Queue()
        self.seen: set[str] = set()

    async def put(self, url: str, depth: int = 0, title: str = "") -> None:
        u = self._norm(url)
        if u in self.seen:
            return
        self.seen.add(u)
        await self.queue.put({"url": u, "depth": depth, "title": title})

    async def get(self) -> Optional[dict]:
        try:
            return self.queue.get_nowait()
        except asyncio.QueueEmpty:
            return None

    async def is_seen(self, url: str) -> bool:
        return self._norm(url) in self.seen

    async def mark_done(self, url: str) -> None:
        pass

    async def close(self) -> None:
        pass

    async def pending_count(self) -> int:
        return self.queue.qsize()