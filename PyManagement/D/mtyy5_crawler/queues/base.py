# -*- coding: utf-8 -*-
"""队列策略抽象基类"""
from abc import ABC, abstractmethod
from typing import Optional


class QueueStrategy(ABC):
    @abstractmethod
    async def put(self, url: str, depth: int = 0, title: str = "") -> None: ...

    @abstractmethod
    async def get(self) -> Optional[dict]: ...

    @abstractmethod
    async def is_seen(self, url: str) -> bool: ...

    @abstractmethod
    async def mark_done(self, url: str) -> None: ...

    @abstractmethod
    async def close(self) -> None: ...

    @abstractmethod
    async def pending_count(self) -> int: ...

    @staticmethod
    def _norm(url: str) -> str:
        return url.split("#")[0].rstrip("/")