# -*- coding: utf-8 -*-
"""SQLite 持久化队列：边发现 URL 边入库，支持断点续爬。"""
from __future__ import annotations

import asyncio
import logging
from datetime import datetime, timezone

import aiosqlite

from ..models import Task
from ..urlutils import normalize_url
from .base import UrlQueue

logger = logging.getLogger(__name__)

_SCHEMA = """
CREATE TABLE IF NOT EXISTS urls(
    url         TEXT PRIMARY KEY,
    state       TEXT NOT NULL DEFAULT 'pending',   -- pending | in_progress | done | failed
    depth       INTEGER NOT NULL DEFAULT 0,
    parser_mode TEXT,
    referer     TEXT,
    title       TEXT,
    added_at    TEXT NOT NULL,
    updated_at  TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS meta(
    key   TEXT PRIMARY KEY,
    value TEXT
);
"""


def _now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


class SqliteUrlQueue(UrlQueue):
    """基于 SQLite 的持久化队列。

    - 每个 URL 一行，状态机：pending -> in_progress -> done / failed
    - 启动时若 resume=True，将 in_progress 复位为 pending（上次中断的任务）
    - 去重依赖 url 主键
    - 并发安全：asyncio.Lock 串行化读写
    """

    name = "sqlite"

    def __init__(self, db_path: str, resume: bool = True, keep_params: bool = True) -> None:
        self.db_path = db_path
        self.resume = resume
        self._keep_params = keep_params
        self._db: aiosqlite.Connection | None = None
        self._lock = asyncio.Lock()
        self._pending_est = 0   # 内存态估计，避免频繁 COUNT

    def _key(self, url: str) -> str:
        return normalize_url(url, keep_params=self._keep_params)

    async def open(self) -> None:
        self._db = await aiosqlite.connect(self.db_path)
        self._db.row_factory = aiosqlite.Row
        await self._db.executescript(_SCHEMA)
        await self._db.execute("PRAGMA journal_mode=WAL")
        await self._db.execute("PRAGMA busy_timeout=5000")
        await self._db.commit()
        if self.resume:
            # 断点续爬：上次中断留下的 in_progress 复位为 pending
            cur = await self._db.execute(
                "UPDATE urls SET state='pending', updated_at=? WHERE state='in_progress'",
                (_now(),),
            )
            await self._db.commit()
            if cur.rowcount:
                logger.info("SQLite 队列续爬：复位 %d 个中断任务", cur.rowcount)
        self._pending_est = await self._count("pending")

    async def _count(self, state: str) -> int:
        assert self._db is not None
        cur = await self._db.execute("SELECT COUNT(*) FROM urls WHERE state=?", (state,))
        row = await cur.fetchone()
        return int(row[0])

    # ------------------------------------------------------------ 接口
    async def put(self, task: Task) -> bool:
        assert self._db is not None
        key = self._key(task.url)
        async with self._lock:
            cur = await self._db.execute(
                "INSERT OR IGNORE INTO urls(url,state,depth,parser_mode,referer,title,added_at,updated_at) "
                "VALUES(?,?,?,?,?,?,?,?)",
                (key, "pending", task.depth, task.parser_mode, task.referer, task.title, _now(), _now()),
            )
            await self._db.commit()
            if cur.rowcount > 0:
                self._pending_est += 1
                return True
            return False

    async def get(self) -> Task | None:
        assert self._db is not None
        async with self._lock:
            cur = await self._db.execute(
                "SELECT url, depth, parser_mode, referer, title FROM urls "
                "WHERE state='pending' ORDER BY depth ASC, added_at ASC LIMIT 1"
            )
            row = await cur.fetchone()
            if row is None:
                return None
            await self._db.execute(
                "UPDATE urls SET state='in_progress', updated_at=? WHERE url=?",
                (_now(), row["url"]),
            )
            await self._db.commit()
            self._pending_est -= 1
            return Task(url=row["url"], depth=row["depth"], parser_mode=row["parser_mode"],
                        referer=row["referer"], title=row["title"])

    async def done(self, task: Task, ok: bool = True) -> None:
        assert self._db is not None
        async with self._lock:
            await self._db.execute(
                "UPDATE urls SET state=?, updated_at=? WHERE url=?",
                ("done" if ok else "failed", _now(), self._key(task.url)),
            )
            await self._db.commit()

    async def release(self, task: Task) -> None:
        """中断时把已领取任务放回 pending。"""
        assert self._db is not None
        async with self._lock:
            await self._db.execute(
                "UPDATE urls SET state='pending', updated_at=? WHERE url=?",
                (_now(), self._key(task.url)),
            )
            await self._db.commit()
            self._pending_est += 1

    async def empty(self) -> bool:
        return self._pending_est <= 0

    async def pending_count(self) -> int:
        return self._pending_est

    async def close(self) -> None:
        if self._db is not None:
            await self._db.close()
            self._db = None

    # ------------------------------------------------------------ 状态
    async def done_count(self) -> int:
        return await self._count("done")

    async def failed_count(self) -> int:
        return await self._count("failed")

    async def in_progress_count(self) -> int:
        return await self._count("in_progress")

    async def total_count(self) -> int:
        assert self._db is not None
        cur = await self._db.execute("SELECT COUNT(*) FROM urls")
        row = await cur.fetchone()
        return int(row[0])
