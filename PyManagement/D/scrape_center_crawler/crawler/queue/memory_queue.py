# -*- coding: utf-8 -*-
"""
内存队列策略：一次性把所有 URL 载入内存，边抓边出队。
适合目标明确、URL 数量可控的场景，速度最快。
"""
from __future__ import annotations

import asyncio
from collections import deque
from typing import Deque, Dict, List, Optional, Set

from .base import QueueItem, QueueStrategy


class MemoryQueue(QueueStrategy):
    """纯内存 FIFO 队列（策略模式的一种具体策略）"""

    name = "memory"

    def __init__(self) -> None:
        self._queue: Deque[QueueItem] = deque()
        self._seen: Set[str] = set()
        self._done: Set[str] = set()
        self._total = 0
        self._lock = asyncio.Lock()
        self._wake = asyncio.Event()

    async def initialize(self, seeds: List[QueueItem], resume: bool = False) -> None:
        async with self._lock:
            for item in seeds:
                if item.key() not in self._seen:
                    self._seen.add(item.key())
                    self._queue.append(item)
                    self._total += 1
            self._wake.set()

    async def put(self, item: QueueItem) -> bool:
        async with self._lock:
            if item.key() in self._seen:
                return False
            self._seen.add(item.key())
            self._queue.append(item)
            self._total += 1
        self._wake.set()
        return True

    async def get(self) -> Optional[QueueItem]:
        while True:
            async with self._lock:
                if self._queue:
                    return self._queue.popleft()
            # 队列空：等待唤醒（可能有其它 worker 正在产出新 URL）
            self._wake.clear()
            try:
                await asyncio.wait_for(self._wake.wait(), timeout=0.2)
            except asyncio.TimeoutError:
                pass
            async with self._lock:
                if not self._queue:
                    return None

    async def mark_done(self, item: QueueItem) -> None:
        self._done.add(item.key())

    async def mark_failed(self, item: QueueItem, error: str = "", retriable: bool = True) -> bool:
        # 内存队列：失败记录，重试由引擎负责重新 put；这里直接进入终态
        self._done.add(item.key())
        return True

    async def qsize(self) -> int:
        return len(self._queue)

    async def total(self) -> int:
        return self._total

    async def close(self) -> None:
        pass
