# queue_/base.py
from __future__ import annotations

from abc import ABC, abstractmethod
from typing import Optional

from core.models import QueueItem


class QueueStrategy(ABC):
    """队列策略抽象基类"""

    @abstractmethod
    async def put(self, item: QueueItem) -> None: ...

    @abstractmethod
    async def get(self) -> Optional[QueueItem]: ...

    @abstractmethod
    async def task_done(self, item: QueueItem) -> None: ...

    @abstractmethod
    async def size(self) -> int: ...

    @abstractmethod
    async def is_complete(self) -> bool: ...

    @abstractmethod
    async def close(self) -> None: ...