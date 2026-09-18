# -*- coding: utf-8 -*-
"""② SQLite 持久化队列：支持断点续爬"""
import asyncio
import logging
from typing import Optional

import aiosqlite

from queues.base import QueueStrategy


class SQLiteQueueStrategy(QueueStrategy):
    def __init__(self, db_path: str):
        self.db_path = db_path
        self._db: Optional[aiosqlite.Connection] = None
        self._init_lock = asyncio.Lock()
        self._io_lock = asyncio.Lock()

    async def _init_db(self):
        if self._db is not None:
            return
        async with self._init_lock:
            if self._db is not None:
                return
            self._db = await aiosqlite.connect(self.db_path)
            await self._db.execute("""
                CREATE TABLE IF NOT EXISTS crawl_queue (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    url TEXT UNIQUE NOT NULL,
                    depth INTEGER DEFAULT 0,
                    title TEXT DEFAULT '',
                    status TEXT DEFAULT 'pending',
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )""")
            await self._db.execute(
                "CREATE INDEX IF NOT EXISTS idx_status ON crawl_queue(status)"
            )
            # 断点续爬：把上次残留的 processing 恢复为 pending
            await self._db.execute(
                "UPDATE crawl_queue SET status='pending' WHERE status='processing'"
            )
            await self._db.commit()

    async def put(self, url: str, depth: int = 0, title: str = "") -> None:
        await self._init_db()
        u = self._norm(url)
        try:
            async with self._io_lock:
                await self._db.execute(
                    "INSERT OR IGNORE INTO crawl_queue (url, depth, title, status) "
                    "VALUES (?, ?, ?, 'pending')",
                    (u, depth, title),
                )
                await self._db.commit()
        except Exception as e:
            logging.debug(f"SQLite put error: {e}")

    async def get(self) -> Optional[dict]:
        await self._init_db()
        async with self._io_lock:
            async with self._db.execute(
                "SELECT url, depth, title FROM crawl_queue "
                "WHERE status='pending' ORDER BY id LIMIT 1"
            ) as cursor:
                row = await cursor.fetchone()
            if not row:
                return None
            await self._db.execute(
                "UPDATE crawl_queue SET status='processing', "
                "updated_at=CURRENT_TIMESTAMP WHERE url=?", (row[0],)
            )
            await self._db.commit()
            return {"url": row[0], "depth": row[1], "title": row[2]}

    async def is_seen(self, url: str) -> bool:
        await self._init_db()
        u = self._norm(url)
        async with self._db.execute(
            "SELECT 1 FROM crawl_queue WHERE url=?", (u,)
        ) as cur:
            return (await cur.fetchone()) is not None

    async def mark_done(self, url: str) -> None:
        await self._init_db()
        u = self._norm(url)
        async with self._io_lock:
            await self._db.execute(
                "UPDATE crawl_queue SET status='done', "
                "updated_at=CURRENT_TIMESTAMP WHERE url=?", (u,)
            )
            await self._db.commit()

    async def close(self) -> None:
        if self._db:
            await self._db.close()
            self._db = None

    async def pending_count(self) -> int:
        await self._init_db()
        async with self._db.execute(
            "SELECT COUNT(*) FROM crawl_queue "
            "WHERE status IN ('pending','processing')"
        ) as cur:
            row = await cur.fetchone()
            return row[0] if row else 0