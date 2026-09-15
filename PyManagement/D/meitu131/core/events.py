# core/events.py
import asyncio
from collections import defaultdict
from enum import Enum, auto
from typing import Callable, Any

class EventType(Enum):
    URL_DISCOVERED = auto()
    PAGE_FETCHED = auto()
    PARSE_SUCCESS = auto()
    RESOURCE_SAVED = auto()
    TASK_FAILED = auto()
    CRAWL_COMPLETED = auto()

class AsyncEventBus:
    """异步观察者模式事件总线，支持协程和同步回调。"""

    def __init__(self):
        self._listeners: dict[EventType, list[Callable]] = defaultdict(list)

    def subscribe(self, event_type: EventType, callback: Callable):
        self._listeners[event_type].append(callback)

    def unsubscribe(self, event_type: EventType, callback: Callable):
        self._listeners[event_type].remove(callback)

    async def emit(self, event_type: EventType, **data: Any):
        for cb in self._listeners[event_type]:
            if asyncio.iscoroutinefunction(cb):
                await cb(**data)
            else:
                cb(**data)

# 内置观察者：进度统计
class ProgressObserver:
    def __init__(self):
        self.stats = {"discovered": 0, "fetched": 0,
                      "parsed": 0, "saved": 0, "failed": 0}
        self._lock = asyncio.Lock()

    async def on_url_discovered(self, url: str, **kw):
        async with self._lock:
            self.stats["discovered"] += 1

    async def on_page_fetched(self, url: str, **kw):
        async with self._lock:
            self.stats["fetched"] += 1

    async def on_task_failed(self, url: str, error: str, **kw):
        async with self._lock:
            self.stats["failed"] += 1
        print(f"[FAIL] {url}: {error}")

    def snapshot(self) -> dict:
        return dict(self.stats)