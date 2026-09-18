# -*- coding: utf-8 -*-
"""
SQLite 持久化队列策略：
  - 边发现 URL 边写入 SQLite，进程崩溃/中断后可用 resume=True 断点续爬
  - 状态机：pending -> processing -> done / failed（failed 且重试次数未达上限时重新入队）
  - 启动时把遗留的 processing 行重置为 pending（崩溃安全）
"""
from __future__ import annotations

import asyncio
import json
import sqlite3
import threading
import time
from typing import Dict, List, Optional

from .base import QueueItem, QueueStrategy

_SCHEMA = """
CREATE TABLE IF NOT EXISTS crawl_queue (
    url         TEXT NOT NULL,
    task_id     TEXT NOT NULL,
    depth       INTEGER NOT NULL DEFAULT 0,
    is_resource INTEGER NOT NULL DEFAULT 0,
    resource_type TEXT NOT NULL DEFAULT '',
    referer     TEXT NOT NULL DEFAULT '',
    priority    INTEGER NOT NULL DEFAULT 0,
    state       TEXT NOT NULL DEFAULT 'pending',
    retries     INTEGER NOT NULL DEFAULT 0,
    error       TEXT NOT NULL DEFAULT '',
    final_retriable INTEGER NOT NULL DEFAULT 1,
    created_at  TEXT NOT NULL,
    updated_at  TEXT NOT NULL,
    PRIMARY KEY (url, task_id)
);
CREATE INDEX IF NOT EXISTS idx_cq_state ON crawl_queue(state, priority);
"""

_MIGRATIONS = (
    "ALTER TABLE crawl_queue ADD COLUMN final_retriable INTEGER NOT NULL DEFAULT 1",
)


class SQLiteQueue(QueueStrategy):
    """SQLite 持久化队列（策略模式的一种具体策略）"""

    name = "sqlite"

    def __init__(self, db_path: str, max_retries: int = 3) -> None:
        self.db_path = db_path
        self.max_retries = max_retries
        self._conn: Optional[sqlite3.Connection] = None
        self._lock = threading.Lock()          # sqlite 连接跨线程需加锁
        self._total = 0
        self._wake = asyncio.Event()

    # ---------- 底层 sqlite 操作（线程锁保护，全部同步执行，避免阻塞事件循环） ----------
    def _execute(self, sql: str, params: tuple = ()) -> sqlite3.Cursor:
        with self._lock:
            if self._conn is None:
                raise RuntimeError("SQLiteQueue 尚未初始化")
            cur = self._conn.execute(sql, params)
            self._conn.commit()
            return cur

    def _init_db(self) -> None:
        self._conn = sqlite3.connect(self.db_path, check_same_thread=False)
        self._conn.execute("PRAGMA journal_mode=WAL")
        self._conn.execute("PRAGMA synchronous=NORMAL")
        self._conn.executescript(_SCHEMA)
        # 旧库迁移：补 final_retriable 列
        cols = {r[1] for r in self._conn.execute("PRAGMA table_info(crawl_queue)")}
        if "final_retriable" not in cols:
            for stmt in _MIGRATIONS:
                self._conn.execute(stmt)
            # 旧库回填：4xx 终态失败（error 以 "4xx," 或 "HTTP 4" 开头）标记为确定性失败缓存
            self._conn.execute(
                """UPDATE crawl_queue SET final_retriable=0
                   WHERE state='failed' AND (error LIKE '4%' OR error LIKE 'HTTP 4%')"""
            )
        self._conn.commit()

    async def initialize(self, seeds: List[QueueItem], resume: bool = False) -> None:
        await asyncio.to_thread(self._init_db)
        now = time.strftime("%Y-%m-%d %H:%M:%S")

        def _work() -> None:
            # 崩溃安全：把遗留 processing 状态重置回 pending
            self._execute("UPDATE crawl_queue SET state='pending', updated_at=? WHERE state='processing'", (now,))
            if not resume:
                task_ids = {s.task_id for s in seeds}
                # 非续爬模式：清掉历史记录，但保留"确定性失败缓存"（final_retriable=0 的 failed 行），
                # 使 4xx 等注定失败的 URL 重跑时不再请求
                for tid in task_ids:
                    self._execute(
                        "DELETE FROM crawl_queue WHERE task_id=? AND NOT (state='failed' AND final_retriable=0)",
                        (tid,),
                    )
            for item in seeds:
                self._insert(item, now)

        await asyncio.to_thread(_work)
        self._wake.set()

    def _insert(self, item: QueueItem, now: str) -> bool:
        """返回 True=接受入队；False=重复/已完成/重试耗尽，跳过"""
        with self._lock:
            if self._conn is None:
                return False
            cur = self._conn.execute(
                "SELECT state, retries, final_retriable FROM crawl_queue WHERE url=? AND task_id=?",
                (item.url, item.task_id),
            )
            row = cur.fetchone()
            if row is None:
                self._conn.execute(
                    """INSERT OR IGNORE INTO crawl_queue
                       (url, task_id, depth, is_resource, resource_type, referer, priority,
                        state, retries, error, final_retriable, created_at, updated_at)
                       VALUES (?,?,?,?,?,?,?, 'pending', 0, '', 1, ?, ?)""",
                    (item.url, item.task_id, item.depth, 1 if item.is_resource else 0,
                     item.resource_type, item.referer, item.priority, now, now),
                )
                self._total += 1
                self._conn.commit()
                return True
            if row[0] == "failed" and row[2] == 0:
                # 确定性失败缓存：4xx 等终态失败，直接跳过不再重抓
                return False
            if row[0] in ("done", "processing") or (row[0] == "failed" and row[1] >= self.max_retries):
                # 已完成 / 处理中 / 失败且重试耗尽：跳过
                return False
            # failed 且未耗尽重试：重置为 pending 续爬
            self._conn.execute(
                "UPDATE crawl_queue SET state='pending', error='', updated_at=? WHERE url=? AND task_id=?",
                (now, item.url, item.task_id),
            )
            self._conn.commit()
            return True

    async def put(self, item: QueueItem) -> bool:
        now = time.strftime("%Y-%m-%d %H:%M:%S")
        accepted = await asyncio.to_thread(self._insert, item, now)
        if accepted:
            self._wake.set()
        return accepted

    async def get(self) -> Optional[QueueItem]:
        while True:
            def _claim():
                with self._lock:
                    if self._conn is None:
                        return None
                    cur = self._conn.execute(
                        """SELECT url, task_id, depth, is_resource, resource_type, referer, priority, retries
                           FROM crawl_queue WHERE state='pending'
                           ORDER BY priority ASC, rowid ASC LIMIT 1"""
                    )
                    row = cur.fetchone()
                    if row is None:
                        return None
                    self._conn.execute(
                        "UPDATE crawl_queue SET state='processing', updated_at=? WHERE url=? AND task_id=?",
                        (time.strftime("%Y-%m-%d %H:%M:%S"), row[0], row[1]),
                    )
                    self._conn.commit()
                    return QueueItem(
                        url=row[0], task_id=row[1], depth=row[2], is_resource=bool(row[3]),
                        resource_type=row[4] or "", referer=row[5] or "", priority=row[6], retries=row[7],
                    )

            item = await asyncio.to_thread(_claim)
            if item is not None:
                return item
            self._wake.clear()
            try:
                await asyncio.wait_for(self._wake.wait(), timeout=0.2)
            except asyncio.TimeoutError:
                pass
            if await self.qsize() == 0:
                return None

    async def mark_done(self, item: QueueItem) -> None:
        def _work():
            self._execute(
                "UPDATE crawl_queue SET state='done', updated_at=? WHERE url=? AND task_id=?",
                (time.strftime("%Y-%m-%d %H:%M:%S"), item.url, item.task_id),
            )
        await asyncio.to_thread(_work)

    async def mark_failed(self, item: QueueItem, error: str = "", retriable: bool = True) -> bool:
        def _work() -> bool:
            with self._lock:
                if self._conn is None:
                    return True
                cur = self._conn.execute(
                    "SELECT retries FROM crawl_queue WHERE url=? AND task_id=?",
                    (item.url, item.task_id),
                )
                row = cur.fetchone()
                retries = (row[0] if row else item.retries) + 1
                if not retriable or retries >= self.max_retries:
                    state = "failed"
                    final = True
                else:
                    state = "pending"
                    final = False
                self._conn.execute(
                    """UPDATE crawl_queue SET state=?, retries=?, error=?, final_retriable=?, updated_at=?
                       WHERE url=? AND task_id=?""",
                    (state, retries, (error or "")[:500], 0 if not retriable else 1,
                     time.strftime("%Y-%m-%d %H:%M:%S"), item.url, item.task_id),
                )
                self._conn.commit()
                return final
        final = await asyncio.to_thread(_work)
        self._wake.set()
        return final

    async def qsize(self) -> int:
        def _work():
            with self._lock:
                if self._conn is None:
                    return 0
                cur = self._conn.execute("SELECT COUNT(*) FROM crawl_queue WHERE state='pending'")
                row = cur.fetchone()
                return row[0] if row else 0
        return await asyncio.to_thread(_work)

    async def total(self) -> int:
        def _work():
            with self._lock:
                if self._conn is None:
                    return 0
                cur = self._conn.execute("SELECT COUNT(*) FROM crawl_queue")
                row = cur.fetchone()
                return row[0] if row else 0
        return await asyncio.to_thread(_work)

    async def stats(self) -> Dict[str, int]:
        def _work():
            with self._lock:
                if self._conn is None:
                    return {}
                cur = self._conn.execute(
                    "SELECT state, COUNT(*) FROM crawl_queue GROUP BY state"
                )
                return {r[0]: r[1] for r in cur.fetchall()}
        return await asyncio.to_thread(_work)

    async def close(self) -> None:
        if self._conn is not None:
            conn = self._conn
            self._conn = None
            await asyncio.to_thread(conn.close)
