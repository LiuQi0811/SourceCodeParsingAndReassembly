"""内存队列：一次性加载全部 URL，asyncio.Queue + 去重集合。"""

from __future__ import annotations

import asyncio
import heapq
import time
from typing import Dict, Optional

from core.models import Task, TaskStatus
from core.queue.base import QueueStrategy


class MemoryQueueStrategy(QueueStrategy):
    """内存队列（默认）。

    一次性把全部 URL put 进来；内部用优先级堆实现 priority 调度
    （priority 越大越先取），并用 seen 集合保证 URL 全局唯一。
    适合中小规模、单进程、无需断点续爬的场景。
    """

    name = "memory"

    def __init__(self, seed_tasks: Optional[list] = None, **_: object) -> None:
        self._seed: list = seed_tasks or []
        self._heap: list = []                 # (-priority, seq, Task)
        self._seq = 0
        self._seen: set = set()
        self._states: Dict[str, str] = {}     # url -> status
        self._cond = asyncio.Condition()
        self._closed = False

    async def start(self) -> None:
        for task in self._seed:
            await self.put(task)

    async def put(self, task: Task) -> bool:
        task = self._normalize(task)
        if task.url in self._seen:
            return False
        self._seen.add(task.url)
        self._states[task.url] = TaskStatus.PENDING
        heapq.heappush(self._heap, (-task.priority, self._seq, task))
        self._seq += 1
        async with self._cond:
            self._cond.notify()
        return True

    async def get(self) -> Optional[Task]:
        while True:
            if self._heap:
                _, _, task = heapq.heappop(self._heap)
                self._states[task.url] = TaskStatus.RUNNING
                return task
            async with self._cond:
                if self._closed or not self._heap:
                    return None
                await self._cond.wait()

    async def complete(self, url: str) -> None:
        self._states[url] = TaskStatus.DONE

    async def fail(self, url: str, error: str = "") -> None:
        self._states[url] = TaskStatus.FAILED

    async def pending_count(self) -> int:
        return len(self._heap)

    async def empty(self) -> bool:
        return not self._heap and not any(
            s == TaskStatus.RUNNING for s in self._states.values())

    async def close(self) -> None:
        self._closed = True
        async with self._cond:
            self._cond.notify_all()
