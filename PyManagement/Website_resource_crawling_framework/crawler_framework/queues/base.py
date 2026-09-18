"""
队列策略抽象基类（Strategy Pattern）
"""
from abc import ABC, abstractmethod
from typing import Optional, List, Dict, Any
from crawler_framework.core.models import CrawlTask


class BaseQueueStrategy(ABC):
    """
    爬虫队列策略接口
    支持在内存队列与持久化SQLite队列之间平滑切换
    """

    @abstractmethod
    async def initialize(self) -> None:
        """异步初始化队列存储（建立表、索引等）"""
        pass

    @abstractmethod
    async def push(self, task: CrawlTask) -> bool:
        """
        向队列存入单条任务。如果该URL已被处理或已存在队列中（去重），返回 False；成功写入返回 True
        """
        pass

    @abstractmethod
    async def push_batch(self, tasks: List[CrawlTask]) -> int:
        """
        批量推入任务，返回实际成功写入（未被去重）的数量
        """
        pass

    @abstractmethod
    async def pop(self) -> Optional[CrawlTask]:
        """
        取出下一个待抓取任务，如果队列为空返回 None
        """
        pass

    @abstractmethod
    async def complete(self, task: CrawlTask) -> None:
        """
        标记任务已成功完成
        """
        pass

    @abstractmethod
    async def fail(self, task: CrawlTask, error_msg: str = "") -> None:
        """
        标记任务抓取失败；若未达到最大重试次数，则重新放入等待队列
        """
        pass

    @abstractmethod
    async def is_empty(self) -> bool:
        """
        判断队列是否已空（待抓取与正在抓取均为0）
        """
        pass

    @abstractmethod
    async def pending_count(self) -> int:
        """
        获取当前待抓取任务数
        """
        pass

    @abstractmethod
    async def get_stats(self) -> Dict[str, Any]:
        """
        获取当前队列的运行统计（总数、待抓取、处理中、已完成、已失败）
        """
        pass

    async def stats(self) -> Dict[str, Any]:
        """别名兼容"""
        return await self.get_stats()

    @abstractmethod
    async def reset_processing(self) -> int:
        """
        重置因程序意外退出而卡在 'processing' 状态的任务回 'pending'，实现断点续爬
        """
        pass

    @abstractmethod
    async def close(self) -> None:
        """
        关闭队列，释放资源
        """
        pass
