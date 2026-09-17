# -*- coding: utf-8 -*-
"""队列工厂（工厂模式）。"""
from __future__ import annotations

from ..config import Config
from .base import UrlQueue
from .memory import MemoryUrlQueue
from .sqlite_queue import SqliteUrlQueue


class QueueFactory:
    """按配置创建队列。

    - queue_type=memory : 一次性把起始 URL 加载进内存队列
    - queue_type=sqlite : SQLite 持久化队列，边发现边入库，支持断点续爬
    """

    @staticmethod
    async def create(cfg: Config) -> UrlQueue:
        if cfg.queue_type == "sqlite":
            q = SqliteUrlQueue(cfg.sqlite_path, resume=cfg.resume,
                               keep_params=cfg.follow_params)
            await q.open()
            return q
        return MemoryUrlQueue(keep_params=cfg.follow_params)


def build(cfg: Config) -> UrlQueue:
    """同步包装（在已有事件循环中调用时用 create）。"""
    import asyncio
    return asyncio.run(QueueFactory.create(cfg))
