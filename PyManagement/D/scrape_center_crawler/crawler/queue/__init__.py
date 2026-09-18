# -*- coding: utf-8 -*-
"""队列策略模块：内存队列 / SQLite 持久化队列（断点续爬）"""
from .base import QueueItem, QueueStrategy
from .memory_queue import MemoryQueue
from .sqlite_queue import SQLiteQueue

__all__ = ["QueueItem", "QueueStrategy", "MemoryQueue", "SQLiteQueue"]
