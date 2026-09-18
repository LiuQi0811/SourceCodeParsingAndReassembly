"""
队列策略①：一次性加载全部URL到内存队列后抓取
基于 asyncio.Queue 与线程安全/协程安全的内存去重集合
适用于已知目标列表的高速并行并发采集
"""
import asyncio
from typing import Optional, List, Set, Dict, Any
import time
from crawler_framework.core.models import CrawlTask, TaskStatus
from crawler_framework.queues.base import BaseQueueStrategy


class MemoryQueueStrategy(BaseQueueStrategy):
    """
    内存队列策略：
    - 一次性把种子URL加载到内存队列；
    - 基于内存集合高效去重；
    - 纯内存运行，无IO开销，抓取速度极高。
    """

    def __init__(self, maxsize: int = 0):
        self._maxsize = maxsize
        self._queue: asyncio.Queue[CrawlTask] = asyncio.Queue(maxsize=maxsize)
        self._seen_urls: Set[str] = set()
        self._tasks_map: Dict[str, CrawlTask] = {}
        self._processing: Dict[str, CrawlTask] = {}
        self._completed_count: int = 0
        self._failed_count: int = 0
        self._lock = asyncio.Lock()

    async def initialize(self) -> None:
        # 内存队列无需创建物理文件
        pass

    async def push(self, task: CrawlTask) -> bool:
        async with self._lock:
            if task.url in self._seen_urls:
                return False
            self._seen_urls.add(task.url)
            self._tasks_map[task.url] = task
            await self._queue.put(task)
            return True

    async def push_batch(self, tasks: List[CrawlTask]) -> int:
        added = 0
        for task in tasks:
            if await self.push(task):
                added += 1
        return added

    async def pop(self) -> Optional[CrawlTask]:
        async with self._lock:
            if self._queue.empty():
                return None
            task = await self._queue.get()
            task.status = TaskStatus.PROCESSING
            task.updated_at = time.time()
            self._processing[task.url] = task
            return task

    async def complete(self, task: CrawlTask) -> None:
        async with self._lock:
            task.status = TaskStatus.COMPLETED
            task.updated_at = time.time()
            self._processing.pop(task.url, None)
            self._completed_count += 1

    async def fail(self, task: CrawlTask, error_msg: str = "") -> None:
        async with self._lock:
            self._processing.pop(task.url, None)
            task.retry_count += 1
            task.updated_at = time.time()

            if task.retry_count <= task.max_retries:
                # 重新加入待抓取队列进行重试
                task.status = TaskStatus.PENDING
                await self._queue.put(task)
            else:
                task.status = TaskStatus.FAILED
                self._failed_count += 1

    async def is_empty(self) -> bool:
        async with self._lock:
            return self._queue.empty() and len(self._processing) == 0

    async def pending_count(self) -> int:
        return self._queue.qsize()

    async def get_stats(self) -> Dict[str, Any]:
        async with self._lock:
            return {
                "mode": "memory",
                "pending": self._queue.qsize(),
                "processing": len(self._processing),
                "completed": self._completed_count,
                "failed": self._failed_count,
                "total_seen": len(self._seen_urls),
            }

    async def stats(self) -> Dict[str, Any]:
        """别名兼容"""
        return await self.get_stats()

    async def reset_processing(self) -> int:
        async with self._lock:
            count = len(self._processing)
            for task in list(self._processing.values()):
                task.status = TaskStatus.PENDING
                await self._queue.put(task)
            self._processing.clear()
            return count

    async def close(self) -> None:
        pass
