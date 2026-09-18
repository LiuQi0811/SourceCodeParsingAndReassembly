# -*- coding: utf-8 -*-
"""
队列策略抽象基类（策略模式）
两种实现可无缝切换：
  - MemoryQueue：一次性把全部 URL 载入内存队列
  - SQLiteQueue：边发现边持久化，支持断点续爬
"""
from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import List, Optional


@dataclass
class QueueItem:
    """队列中的一条抓取任务"""

    url: str
    task_id: str = ""
    depth: int = 0
    is_resource: bool = False        # True=资源下载任务，False=页面抓取任务
    resource_type: str = ""          # 资源类型提示（可空，实际以分类器判定）
    referer: str = ""
    priority: int = 0                # 0=页面，数值越大优先级越低
    retries: int = 0
    error: str = ""

    def key(self) -> str:
        return f"{self.url}|{self.task_id}"


class QueueStrategy(ABC):
    """队列策略抽象接口（全部异步）"""

    name: str = "base"

    @abstractmethod
    async def initialize(self, seeds: List[QueueItem], resume: bool = False) -> None:
        """初始化：载入种子 URL；resume=True 时恢复未完成任务"""

    @abstractmethod
    async def put(self, item: QueueItem) -> bool:
        """入队；返回 False 表示重复/已处理过"""

    @abstractmethod
    async def get(self) -> Optional[QueueItem]:
        """取出一条待处理任务；队列为空返回 None"""

    @abstractmethod
    async def mark_done(self, item: QueueItem) -> None:
        """标记完成"""

    @abstractmethod
    async def mark_failed(self, item: QueueItem, error: str = "", retriable: bool = True) -> bool:
        """标记失败（带重试计数）。返回 True=进入最终失败态（重试耗尽或不可重试）；
        False=已重新入队待重试。retriable=False 表示确定性失败（如 HTTP 4xx），直接终态。"""

    @abstractmethod
    async def qsize(self) -> int:
        """待处理数量"""

    @abstractmethod
    async def total(self) -> int:
        """累计入队数量"""

    @abstractmethod
    async def close(self) -> None:
        """关闭队列（SQLite 会提交事务/关连接）"""
