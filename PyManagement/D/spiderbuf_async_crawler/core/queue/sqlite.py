"""SQLite 持久化队列：边发现 URL 边入库，支持断点续爬。"""

from __future__ import annotations

import asyncio
import json
import logging
import time
from typing import Any, Dict, Optional

import aiosqlite

from core.models import Task, TaskStatus
from core.queue.base import QueueStrategy

logger = logging.getLogger(__name__)

_SCHEMA = """
CREATE TABLE IF NOT EXISTS tasks (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    url           TEXT NOT NULL UNIQUE,
    title         TEXT NOT NULL DEFAULT '',
    depth         INTEGER NOT NULL DEFAULT 0,
    priority      INTEGER NOT NULL DEFAULT 0,
    status        TEXT NOT NULL DEFAULT 'pending',
    parser        TEXT,
    parser_config TEXT,
    headers       TEXT,
    solver        TEXT,
    require_browser INTEGER NOT NULL DEFAULT 0,
    external_script TEXT,
    extra         TEXT,
    error         TEXT,
    discovered_at REAL NOT NULL,
    finished_at   REAL
);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_priority ON tasks(priority DESC, id ASC);
"""


class SQLiteQueueStrategy(QueueStrategy):
    """SQLite 持久化队列。

    - 每发现一个 URL 立即 INSERT 入库（观察者事件订阅入队）
    - 启动时把上次未完成的 pending 任务恢复（断点续爬）
    - failed 任务可通过 resume_failed=True 重新入队重试
    """

    name = "sqlite"

    def __init__(self, db_path: str = "crawl_queue.sqlite",
                 resume_failed: bool = False, **_: object) -> None:
        self.db_path = db_path
        self.resume_failed = resume_failed
        self._conn: Optional[aiosqlite.Connection] = None
        self._wake = asyncio.Event()
        self._closed = False
        self._write_lock = asyncio.Lock()

    async def start(self) -> None:
        self._conn = await aiosqlite.connect(self.db_path)
        self._conn.row_factory = aiosqlite.Row
        await self._conn.executescript(_SCHEMA)
        await self._conn.commit()
        # 断点续爬：pending 与 running（上次未完成）都恢复为 pending；
        # resume_failed=True 时 failed 任务也重试
        statuses = ["pending", "running"]
        if self.resume_failed:
            statuses.append("failed")
        placeholders = ",".join("?" for _ in statuses)
        await self._conn.execute(
            f"UPDATE tasks SET status='pending', error=NULL WHERE status IN ({placeholders})",
            statuses,
        )
        await self._conn.commit()
        n = await self._count("pending")
        if n:
            logger.info("[sqlite-queue] 断点续爬恢复 %d 个待抓取任务", n)

    async def _count(self, status: str) -> int:
        assert self._conn is not None
        cur = await self._conn.execute(
            "SELECT COUNT(*) AS c FROM tasks WHERE status=?", (status,))
        row = await cur.fetchone()
        return int(row["c"]) if row else 0

    async def put(self, task: Task) -> bool:
        assert self._conn is not None
        task = self._normalize(task)
        async with self._write_lock:
            cur = await self._conn.execute(
                "SELECT id FROM tasks WHERE url=?", (task.url,))
            if await cur.fetchone():
                return False
            await self._conn.execute(
                """INSERT OR IGNORE INTO tasks
                   (url, title, depth, priority, status, parser, parser_config,
                    headers, solver, require_browser, external_script, extra, discovered_at)
                   VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)""",
                (task.url, task.title, task.depth, task.priority, TaskStatus.PENDING,
                 task.parser,
                 json.dumps(task.parser_config, ensure_ascii=False) if task.parser_config else None,
                 json.dumps(task.headers, ensure_ascii=False) if task.headers else None,
                 task.solver, int(task.require_browser), task.external_script,
                 json.dumps(task.extra, ensure_ascii=False) if task.extra else None,
                 time.time()),
            )
            await self._conn.commit()
        self._wake.set()
        return True

    async def get(self) -> Optional[Task]:
        assert self._conn is not None
        while not self._closed:
            async with self._write_lock:
                cur = await self._conn.execute(
                    """SELECT * FROM tasks WHERE status='pending'
                       ORDER BY priority DESC, id ASC LIMIT 1""")
                row = await cur.fetchone()
                if row:
                    await self._conn.execute(
                        "UPDATE tasks SET status='running' WHERE id=?", (row["id"],))
                    await self._conn.commit()
                    return self._row_to_task(row)
            self._wake.clear()
            try:
                await asyncio.wait_for(self._wake.wait(), timeout=0.5)
            except asyncio.TimeoutError:
                # 定时唤醒：供 close 后退出
                if await self._count("pending") == 0:
                    return None
        return None

    def _row_to_task(self, row: aiosqlite.Row) -> Task:
        def _loads(raw: Optional[str]) -> Optional[Dict[str, Any]]:
            if not raw:
                return None
            try:
                return json.loads(raw)
            except json.JSONDecodeError:
                return None

        return Task(
            url=row["url"],
            title=row["title"],
            depth=int(row["depth"]),
            priority=int(row["priority"]),
            parser=row["parser"],
            parser_config=_loads(row["parser_config"]),
            headers=_loads(row["headers"]),
            solver=row["solver"],
            require_browser=bool(row["require_browser"]),
            external_script=row["external_script"],
            extra=_loads(row["extra"]) or {},
        )

    async def complete(self, url: str) -> None:
        assert self._conn is not None
        async with self._write_lock:
            await self._conn.execute(
                "UPDATE tasks SET status='done', finished_at=?, error=NULL WHERE url=?",
                (time.time(), url))
            await self._conn.commit()

    async def fail(self, url: str, error: str = "") -> None:
        assert self._conn is not None
        async with self._write_lock:
            await self._conn.execute(
                "UPDATE tasks SET status='failed', finished_at=?, error=? WHERE url=?",
                (time.time(), error[:2000], url))
            await self._conn.commit()

    async def pending_count(self) -> int:
        return await self._count("pending")

    async def empty(self) -> bool:
        pending = await self._count("pending")
        running = await self._count("running")
        return pending == 0 and running == 0

    async def close(self) -> None:
        self._closed = True
        self._wake.set()
        if self._conn is not None:
            await self._conn.close()
            self._conn = None
