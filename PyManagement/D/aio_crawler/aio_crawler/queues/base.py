# -*- coding: utf-8 -*-
"""URL 队列抽象基类。"""
from __future__ import annotations

from abc import ABC, abstractmethod

from ..models import Task


class UrlQueue(ABC):
    """队列统一接口：put / get / done / release / 状态查询。"""

    name: str = "base"

    @abstractmethod
    async def put(self, task: Task) -> bool:
        """入队；重复 URL 返回 False。"""

    @abstractmethod
    async def get(self) -> Task | None:
        """取一个待处理任务；无任务时返回 None。"""

    @abstractmethod
    async def done(self, task: Task, ok: bool = True) -> None:
        """标记任务完成 / 失败。"""

    @abstractmethod
    async def release(self, task: Task) -> None:
        """释放任务（回到待处理，用于中断续爬）。"""

    @abstractmethod
    async def empty(self) -> bool:
        """是否没有待处理任务。"""

    @abstractmethod
    async def pending_count(self) -> int:
        """待处理任务数。"""

    @abstractmethod
    async def close(self) -> None:
        """关闭队列，释放资源。"""
