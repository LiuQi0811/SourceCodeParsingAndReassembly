"""队列策略抽象基类。"""

from __future__ import annotations

from abc import ABC, abstractmethod
from typing import Any, Dict, Optional

from core.models import Task, TaskStatus


class QueueStrategy(ABC):
    """任务队列策略接口。

    put/get 的语义：
    - put：把一个任务加入队列（自动去重；重复 URL 忽略）
    - get：取下一个 pending 任务，并立即标记为 running（防重复消费）
    - complete/fail：结束一个任务
    """

    name: str = "base"

    @abstractmethod
    async def start(self) -> None:
        """初始化（内存队列无操作；SQLite 队列建表并恢复断点）。"""

    @abstractmethod
    async def put(self, task: Task) -> bool:
        """入队。返回 True 表示新加入，False 表示已存在被忽略。"""

    @abstractmethod
    async def get(self) -> Optional[Task]:
        """取出下一个待执行任务（标记 running）。无任务返回 None。"""

    @abstractmethod
    async def complete(self, url: str) -> None:
        """标记任务完成。"""

    @abstractmethod
    async def fail(self, url: str, error: str = "") -> None:
        """标记任务失败。"""

    @abstractmethod
    async def pending_count(self) -> int:
        """剩余待执行任务数。"""

    @abstractmethod
    async def empty(self) -> bool:
        """是否所有任务都已完成/失败（无 pending 与 running）。"""

    @abstractmethod
    async def close(self) -> None:
        """关闭队列（内存队列无操作；SQLite 队列关闭连接）。"""

    def _normalize(self, task: Task) -> Task:
        """统一 URL 规范化（去 fragment、去尾部斜杠差异）。"""
        url = task.url.split("#")[0].strip()
        if url.endswith("/"):
            url = url.rstrip("/")
        task.url = url
        return task


class QueueFactoryRegistry:
    """队列策略注册表（工厂模式的轻量实现，见 core/factories.py）。"""

    _registry: Dict[str, type] = {}

    @classmethod
    def register(cls, name: str, queue_cls: type) -> None:
        cls._registry[name] = queue_cls

    @classmethod
    def create(cls, name: str, **kwargs: Any) -> QueueStrategy:
        if name not in cls._registry:
            raise ValueError(f"未知队列策略: {name}，可用: {list(cls._registry)}")
        return cls._registry[name](**kwargs)
