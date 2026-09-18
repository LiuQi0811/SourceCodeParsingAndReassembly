"""
队列工厂（Factory Pattern）
根据用户配置或运行时参数创建对应的队列策略实例
"""
from typing import Optional
from crawler_framework.core.models import QueueMode
from crawler_framework.queues.base import BaseQueueStrategy
from crawler_framework.queues.memory_queue import MemoryQueueStrategy
from crawler_framework.queues.sqlite_queue import SQLiteQueueStrategy


class QueueFactory:
    """队列创建工厂"""

    @staticmethod
    def create_queue(mode: str = "memory", db_path: str = "crawler_queue.db", maxsize: int = 0) -> BaseQueueStrategy:
        """
        工厂方法：创建队列实例
        :param mode: "memory" 或 "sqlite"
        :param db_path: SQLite数据库文件路径（当 mode="sqlite" 时有效）
        :param maxsize: 内存队列最大容量（0表示无上限）
        """
        mode_str = str(mode).lower()
        if mode_str in (QueueMode.MEMORY.value, "mem"):
            return MemoryQueueStrategy(maxsize=maxsize)
        elif mode_str in (QueueMode.SQLITE.value, "db", "sqlite3"):
            return SQLiteQueueStrategy(db_path=db_path)
        else:
            raise ValueError(f"不支持的队列模式: {mode}，仅支持 'memory' 或 'sqlite'")
