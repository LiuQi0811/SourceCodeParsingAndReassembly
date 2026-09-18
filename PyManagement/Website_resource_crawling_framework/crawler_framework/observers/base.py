"""
观察者抽象基类（Observer Pattern）
所有监听爬虫运行状态的观察者均实现此接口
"""
from abc import ABC, abstractmethod
from crawler_framework.observers.events import CrawlerEvent


class BaseObserver(ABC):
    """观察者抽象基类"""

    @abstractmethod
    async def on_event(self, event: CrawlerEvent) -> None:
        """
        异步事件处理回调函数
        :param event: 爬虫事件载荷
        """
        pass
