# -*- coding: utf-8 -*-
from .base import QueueStrategy
from .memory_queue import MemoryQueueStrategy
from .sqlite_queue import SQLiteQueueStrategy


def create_queue(mode: str, db_path: str) -> QueueStrategy:
    if mode == "sqlite":
        return SQLiteQueueStrategy(db_path)
    return MemoryQueueStrategy()


__all__ = ["QueueStrategy", "MemoryQueueStrategy", "SQLiteQueueStrategy", "create_queue"]