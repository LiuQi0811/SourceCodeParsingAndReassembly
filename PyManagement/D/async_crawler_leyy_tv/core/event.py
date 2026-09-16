# core/event.py
from __future__ import annotations

import asyncio
import logging
import time
from collections import defaultdict
from dataclasses import dataclass, field
from enum import Enum
from typing import Any, Callable

logger = logging.getLogger("EventEmitter")


class EventType(str, Enum):
    URL_DISCOVERED = "url_discovered"
    RESOURCE_FOUND = "resource_found"
    DOWNLOAD_START = "download_start"
    DOWNLOAD_PROGRESS = "download_progress"
    DOWNLOAD_COMPLETE = "download_complete"
    DOWNLOAD_ERROR = "download_error"
    CRAWL_COMPLETE = "crawl_complete"


@dataclass
class Event:
    type: EventType
    data: dict[str, Any] = field(default_factory=dict)
    timestamp: float = field(default_factory=time.time)


class EventEmitter:
    """异步事件发射器（观察者模式）"""

    def __init__(self):
        self._listeners: dict[EventType, list[Callable]] = defaultdict(list)

    def on(self, event_type: EventType, listener: Callable) -> None:
        self._listeners[event_type].append(listener)

    def off(self, event_type: EventType, listener: Callable) -> None:
        if listener in self._listeners[event_type]:
            self._listeners[event_type].remove(listener)

    async def emit(self, event: Event) -> None:
        listeners = list(self._listeners.get(event.type, []))
        if not listeners:
            return

        tasks = []
        loop = asyncio.get_running_loop()
        for listener in listeners:
            if asyncio.iscoroutinefunction(listener):
                tasks.append(asyncio.create_task(listener(event)))
            else:
                tasks.append(loop.run_in_executor(None, listener, event))

        results = await asyncio.gather(*tasks, return_exceptions=True)
        for r in results:
            if isinstance(r, Exception):
                logger.error(f"监听器异常: {r!r}")