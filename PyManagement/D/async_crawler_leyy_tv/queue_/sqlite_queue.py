# queue_/sqlite_queue.py
from __future__ import annotations

import asyncio
from typing import Optional

import aiosqlite

from core.models import QueueItem
from .base import QueueStrategy


class SQLiteQueueStrategy(QueueStrategy):
    """
    SQLite 持久化队列策略：边发现 URL 边入库，支持断点续爬。
    使用 WAL 模式减少并发写入冲突。
    """

    _SCHEMA = [
        """
        CREATE TABLE IF NOT EXISTS crawl_queue (
            id          INTEGER PRIMARY KEY AUTOINCREMENT,
            url         TEXT UNIQUE NOT NULL,
            parent_url  TEXT,
            title       TEXT,
            depth       INTEGER DEFAULT 0,
            status      TEXT DEFAULT 'pending',
            retry_count INTEGER DEFAULT 0,
            created_at  REAL DEFAULT (strftime('%s','now')),
            updated_at  REAL DEFAULT (strftime('%s','now'))
        )
        """,
        "CREATE INDEX IF NOT EXISTS idx_status ON crawl_queue(status)",
        """
        CREATE TABLE IF NOT EXISTS crawled_resources (
            id            INTEGER PRIMARY KEY AUTOINCREMENT,
            url           TEXT UNIQUE NOT NULL,
            title         TEXT,
            resource_type TEXT,
            file_path     TEXT,
            file_size     INTEGER,
            status        TEXT DEFAULT 'done',
            created_at    REAL DEFAULT (strftime('%s','now'))
        )
        """,
    ]

    def __init__(self, db_path: str = "crawler_queue.db", max_retry: int = 3):
        self.db_path = db_path
        self.max_retry = max_retry
        self._db: Optional[aiosqlite.Connection] = None
        self._lock = asyncio.Lock()

    async def init_db(self) -> None:
        self._db = await aiosqlite.connect(self.db_path)
        await self._db.execute("PRAGMA journal_mode=WAL")
        await self._db.execute("PRAGMA synchronous=NORMAL")
        for stmt in self._SCHEMA:
            await self._db.execute(stmt)
        await self._db.commit()

    async def reset_processing(self) -> None:
        """断点续爬：启动时把 processing 状态还原为 pending"""
        async with self._lock:
            await self._db.execute(
                "UPDATE crawl_queue SET status='pending' WHERE status='processing'"
            )
            await self._db.commit()

    async def put(self, item: QueueItem) -> None:
        async with self._lock:
            await self._db.execute(
                """INSERT OR IGNORE INTO crawl_queue (url, parent_url, depth)
                   VALUES (?, ?, ?)""",
                (item.url, item.parent_url, item.depth),
            )
            await self._db.commit()

    async def get(self) -> Optional[QueueItem]:
        async with self._lock:
            cursor = await self._db.execute(
                """SELECT id, url, parent_url, depth, retry_count
                   FROM crawl_queue
                   WHERE status='pending'
                   ORDER BY id ASC LIMIT 1"""
            )
            row = await cursor.fetchone()
            if row is None:
                return None

            item = QueueItem.from_row(row)
            await self._db.execute(
                "UPDATE crawl_queue SET status='processing', "
                "updated_at=strftime('%s','now') WHERE id=?",
                (item.id,),
            )
            await self._db.commit()
            return item

    async def task_done(self, item: QueueItem) -> None:
        if item.id is None:
            return
        async with self._lock:
            await self._db.execute(
                "UPDATE crawl_queue SET status='done', "
                "updated_at=strftime('%s','now') WHERE id=?",
                (item.id,),
            )
            await self._db.commit()

    async def mark_error(self, item: QueueItem) -> None:
        if item.id is None:
            return
        async with self._lock:
            await self._db.execute(
                """UPDATE crawl_queue
                   SET status = CASE WHEN retry_count >= ? THEN 'error'
                                     ELSE 'pending' END,
                       retry_count = retry_count + 1,
                       updated_at = strftime('%s','now')
                   WHERE id = ?""",
                (self.max_retry, item.id),
            )
            await self._db.commit()

    async def set_title(self, url: str, title: str) -> None:
        async with self._lock:
            await self._db.execute(
                "UPDATE crawl_queue SET title=? WHERE url=?",
                (title, url),
            )
            await self._db.commit()

    async def get_title(self, url: str) -> Optional[str]:
        async with self._lock:
            cursor = await self._db.execute(
                "SELECT title FROM crawl_queue WHERE url=? LIMIT 1", (url,)
            )
            row = await cursor.fetchone()
            return row[0] if row and row[0] else None

    async def size(self) -> int:
        cursor = await self._db.execute(
            "SELECT COUNT(*) FROM crawl_queue "
            "WHERE status IN ('pending','processing')"
        )
        row = await cursor.fetchone()
        return row[0] if row else 0

    async def is_complete(self) -> bool:
        return (await self.size()) == 0

    async def close(self) -> None:
        if self._db is not None:
            await self._db.close()
            self._db = None