# core/queue.py
import asyncio, aiosqlite, os
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import Optional
from enum import Enum

class TaskStatus(Enum):
    PENDING = "pending"
    PROCESSING = "processing"
    SUCCESS = "success"
    FAILED = "failed"

@dataclass
class CrawlTask:
    url: str
    depth: int = 0
    task_type: str = "page"       # page / resource
    status: TaskStatus = TaskStatus.PENDING
    retry_count: int = 0
    max_retries: int = 3
    referer: str = ""
    meta: dict = field(default_factory=dict)

# ---------- 抽象策略 ----------
class BaseQueue(ABC):
    @abstractmethod
    async def put(self, task: CrawlTask) -> bool: ...
    @abstractmethod
    async def get(self) -> Optional[CrawlTask]: ...
    @abstractmethod
    async def complete(self, task: CrawlTask, success: bool): ...
    @abstractmethod
    async def is_empty(self) -> bool: ...
    @abstractmethod
    async def close(self): ...

# ---------- 策略一：内存队列 ----------
class MemoryQueue(BaseQueue):
    """一次性加载全部URL到内存，适合中小规模全站抓取。"""

    def __init__(self):
        self._queue: asyncio.Queue[CrawlTask] = asyncio.Queue()
        self._seen: set[str] = set()
        self._active = 0

    async def put(self, task: CrawlTask) -> bool:
        if task.url in self._seen:
            return False
        self._seen.add(task.url)
        await self._queue.put(task)
        return True

    async def get(self) -> Optional[CrawlTask]:
        try:
            task = await asyncio.wait_for(self._queue.get(), timeout=3.0)
            self._active += 1
            return task
        except asyncio.TimeoutError:
            return None

    async def complete(self, task: CrawlTask, success: bool):
        self._active -= 1
        if not success and task.retry_count < task.max_retries:
            task.retry_count += 1
            await self._queue.put(task)

    async def is_empty(self) -> bool:
        return self._queue.empty() and self._active == 0

    async def close(self):
        pass

# ---------- 策略二：SQLite 持久化队列 ----------
class SQLiteQueue(BaseQueue):
    """WAL 模式 SQLite 队列，支持断点续爬。"""

    def __init__(self, db_path: str = "crawl_queue.db"):
        self.db_path = db_path
        self._db: Optional[aiosqlite.Connection] = None

    async def init(self):
        self._db = await aiosqlite.connect(self.db_path)
        await self._db.execute("PRAGMA journal_mode = WAL")
        await self._db.execute("PRAGMA busy_timeout = 5000")
        await self._db.execute("""
            CREATE TABLE IF NOT EXISTS crawl_queue (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                url TEXT UNIQUE NOT NULL,
                depth INTEGER DEFAULT 0,
                task_type TEXT DEFAULT 'page',
                status TEXT DEFAULT 'pending',
                retry_count INTEGER DEFAULT 0,
                max_retries INTEGER DEFAULT 3,
                referer TEXT DEFAULT '',
                meta TEXT DEFAULT '{}',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)
        await self._db.commit()

    async def put(self, task: CrawlTask) -> bool:
        try:
            await self._db.execute(
                """INSERT OR IGNORE INTO crawl_queue
                   (url, depth, task_type, status, retry_count, max_retries, referer)
                   VALUES (?, ?, ?, 'pending', ?, ?, ?)""",
                (task.url, task.depth, task.task_type,
                 task.retry_count, task.max_retries, task.referer)
            )
            await self._db.commit()
            return True
        except Exception:
            return False

    async def get(self) -> Optional[CrawlTask]:
        # 原子性地取出一个任务并标记为 processing
        cursor = await self._db.execute(
            """UPDATE crawl_queue SET status='processing',
               updated_at=CURRENT_TIMESTAMP
               WHERE id = (
                   SELECT id FROM crawl_queue
                   WHERE status IN ('pending', 'failed')
                     AND retry_count < max_retries
                   ORDER BY id LIMIT 1
               )
               RETURNING url, depth, task_type, retry_count, max_retries, referer"""
        )
        row = await cursor.fetchone()
        await self._db.commit()
        if row is None:
            return None
        return CrawlTask(url=row[0], depth=row[1], task_type=row[2],
                         retry_count=row[3], max_retries=row[4], referer=row[5])

    async def complete(self, task: CrawlTask, success: bool):
        status = TaskStatus.SUCCESS.value if success else TaskStatus.FAILED.value
        await self._db.execute(
            """UPDATE crawl_queue SET status=?, retry_count=retry_count+?,
               updated_at=CURRENT_TIMESTAMP WHERE url=?""",
            (status, 0 if success else 1, task.url)
        )
        await self._db.commit()

    async def is_empty(self) -> bool:
        cursor = await self._db.execute(
            """SELECT COUNT(*) FROM crawl_queue
               WHERE status IN ('pending', 'failed')
                 AND retry_count < max_retries"""
        )
        count = (await cursor.fetchone())[0]
        return count == 0

    async def reset_stale(self):
        """启动时将上次未完成的任务重置为 pending。"""
        await self._db.execute(
            "UPDATE crawl_queue SET status='pending' WHERE status='processing'"
        )
        await self._db.commit()

    async def close(self):
        if self._db:
            await self._db.close()

# ---------- 工厂 ----------
class QueueFactory:
    _registry = {"memory": MemoryQueue, "sqlite": SQLiteQueue}

    @classmethod
    def create(cls, queue_type: str = "memory", **kwargs) -> BaseQueue:
        if queue_type not in cls._registry:
            raise ValueError(f"Unknown queue type: {queue_type}")
        return cls._registry[queue_type](**kwargs)