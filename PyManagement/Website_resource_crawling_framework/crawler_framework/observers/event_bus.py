"""
事件发布与订阅总线 (CrawlerEventBus)
支持多个观察者的异步并发调度与广播分发
"""
import asyncio
from typing import List
from crawler_framework.observers.base import BaseObserver
from crawler_framework.observers.events import CrawlerEvent, EventType


class CrawlerEventBus:
    """观察者模式核心：事件广播总线"""

    def __init__(self):
        self._observers: List[BaseObserver] = []
        self._lock = asyncio.Lock()

    def subscribe(self, observer: BaseObserver) -> "CrawlerEventBus":
        """注册/订阅观察者"""
        if observer not in self._observers:
            self._observers.append(observer)
        return self

    def unsubscribe(self, observer: BaseObserver) -> "CrawlerEventBus":
        """注销观察者"""
        if observer in self._observers:
            self._observers.remove(observer)
        return self

    async def emit(self, event: CrawlerEvent) -> None:
        """
        异步广播事件给所有已注册观察者
        使用 asyncio.gather 并发分发，单个观察者异常不会中断爬取主流程
        """
        if not self._observers:
            return

        tasks = [self._safe_notify(observer, event) for observer in self._observers]
        await asyncio.gather(*tasks, return_exceptions=True)

    async def _safe_notify(self, observer: BaseObserver, event: CrawlerEvent) -> None:
        try:
            await observer.on_event(event)
        except Exception as e:
            # 观察者自身异常隔离，打印警告但不抛出破坏主引擎
            print(f"[EventBus Warning] 观察者 {observer.__class__.__name__} 执行出错: {e}")
