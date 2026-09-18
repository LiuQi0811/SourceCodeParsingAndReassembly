# -*- coding: utf-8 -*-
"""观察者模式：事件总线"""
from abc import ABC, abstractmethod
import logging


class Observer(ABC):
    """观察者抽象基类"""

    @abstractmethod
    async def on_event(self, event_type: str, data: dict) -> None:
        ...


class EventBus:
    """主题（事件总线）"""

    def __init__(self):
        self._observers: dict[str, list[Observer]] = {}

    def subscribe(self, event_type: str, observer: Observer) -> None:
        self._observers.setdefault(event_type, []).append(observer)

    def unsubscribe(self, event_type: str, observer: Observer) -> None:
        if event_type in self._observers:
            try:
                self._observers[event_type].remove(observer)
            except ValueError:
                pass

    async def emit(self, event_type: str, data: dict) -> None:
        for obs in list(self._observers.get(event_type, [])):
            try:
                await obs.on_event(event_type, data)
            except Exception as e:
                logging.warning(f"Observer error [{event_type}]: {e}")


class LogObserver(Observer):
    """把事件写入日志"""

    async def on_event(self, event_type: str, data: dict) -> None:
        logging.info(f"[{event_type}] {data.get('message', data)}")


class CounterObserver(Observer):
    """统计各类事件数量"""

    def __init__(self):
        self.counts: dict[str, int] = {}

    async def on_event(self, event_type: str, data: dict) -> None:
        self.counts[event_type] = self.counts.get(event_type, 0) + 1

    def summary(self) -> dict:
        return dict(self.counts)