"""内存队列策略：一次性加载全部URL到内存"""
import asyncio
from .base import URLFrontier


class MemoryFrontier(URLFrontier):
    def __init__(self):
        self._queue: asyncio.Queue = asyncio.Queue()
        self._seen: set[str] = set()
        self._done: set[str] = set()
        self._errors: dict[str, str] = {}

    async def put(self, url: str, depth: int = 0, parent: str = ""):
        if url not in self._seen:
            self._seen.add(url)
            await self._queue.put((url, depth))

    async def get(self) -> tuple[str, int] | None:
        try:
            return self._queue.get_nowait()
        except asyncio.QueueEmpty:
            return None

    async def mark_done(self, url: str, status: str = "done"):
        self._done.add(url)

    async def mark_error(self, url: str, error: str = ""):
        self._errors[url] = error

    async def size(self) -> int:
        return self._queue.qsize()

    async def close(self):
        pass