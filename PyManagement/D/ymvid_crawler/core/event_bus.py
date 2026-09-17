"""轻量级异步事件总线（观察者模式核心）"""
import asyncio
import time
from typing import Callable, Coroutine
from .events import CrawlEvent, EventType


class EventBus:
    def __init__(self):
        self._subscribers: dict[EventType, list[Callable]] = {}

    def subscribe(self, event_type: EventType,
                  callback: Callable[[CrawlEvent], Coroutine]):
        self._subscribers.setdefault(event_type, []).append(callback)

    async def publish(self, event: CrawlEvent):
        event.timestamp = time.time()
        callbacks = self._subscribers.get(event.event_type, [])
        if callbacks:
            await asyncio.gather(
                *[cb(event) for cb in callbacks],
                return_exceptions=True
            )