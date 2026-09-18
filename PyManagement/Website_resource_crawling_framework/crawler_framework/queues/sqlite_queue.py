"""
队列策略②：持久化SQLite队列，边发现URL边存入，支持断点续爬
使用 SQLite 数据库存储URL记录，具备重试计数、状态流转、去重与断点恢复能力
在程序重启时，可自动加载未完成的任务继续抓取
"""
import asyncio
import json
import os
import sqlite3
import time
from typing import Optional, List, Dict, Any
from crawler_framework.core.models import CrawlTask, TaskStatus
from crawler_framework.queues.base import BaseQueueStrategy


class SQLiteQueueStrategy(BaseQueueStrategy):
    """
    SQLite 持久化队列策略：
    1. 动态持久化：边抓取发现新URL，边写入SQLite数据库；
    2. URL自动去重：利用URL唯一索引；
    3. 断点续爬：支持应用重启时将之前 'processing' 或 'pending' 的任务加载继续执行；
    4. 状态追溯：实时保存每个URL的抓取状态、错误日志、重试次数。
    """

    def __init__(self, db_path: str = "crawler_tasks.db"):
        self.db_path = db_path
        self._lock = asyncio.Lock()
        self._conn: Optional[sqlite3.Connection] = None

    def _get_connection(self) -> sqlite3.Connection:
        if self._conn is None:
            self._conn = sqlite3.connect(self.db_path, check_same_thread=False, timeout=30.0)
            self._conn.row_factory = sqlite3.Row
            # 开启 WAL 模式以提升异步/并发读写吞吐量
            self._conn.execute("PRAGMA journal_mode = WAL;")
            self._conn.execute("PRAGMA synchronous = NORMAL;")
        return self._conn

    async def initialize(self) -> None:
        async with self._lock:
            loop = asyncio.get_running_loop()
            await loop.run_in_executor(None, self._init_tables)

    def _init_tables(self) -> None:
        conn = self._get_connection()
        with conn:
            conn.execute("""
                CREATE TABLE IF NOT EXISTS crawl_queue (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    task_id TEXT NOT NULL,
                    url TEXT UNIQUE NOT NULL,
                    depth INTEGER DEFAULT 0,
                    max_depth INTEGER DEFAULT 3,
                    method TEXT DEFAULT 'GET',
                    headers_json TEXT,
                    params_json TEXT,
                    priority INTEGER DEFAULT 0,
                    status TEXT DEFAULT 'pending',
                    retry_count INTEGER DEFAULT 0,
                    max_retries INTEGER DEFAULT 3,
                    parser_type TEXT,
                    parser_rules_json TEXT,
                    decrypt_type TEXT,
                    decrypt_params_json TEXT,
                    extra_json TEXT,
                    error_msg TEXT,
                    created_at REAL,
                    updated_at REAL
                );
            """)
            conn.execute("CREATE INDEX IF NOT EXISTS idx_status_priority ON crawl_queue(status, priority DESC, id ASC);")
            conn.execute("CREATE INDEX IF NOT EXISTS idx_url ON crawl_queue(url);")

    async def reset_processing(self) -> int:
        """断点续爬核心：将因意外退出而残留的 processing 状态恢复为 pending"""
        async with self._lock:
            loop = asyncio.get_running_loop()
            return await loop.run_in_executor(None, self._sync_reset_processing)

    def _sync_reset_processing(self) -> int:
        conn = self._get_connection()
        with conn:
            cur = conn.execute(
                "UPDATE crawl_queue SET status = 'pending', updated_at = ? WHERE status = 'processing'",
                (time.time(),)
            )
            return cur.rowcount

    async def push(self, task: CrawlTask) -> bool:
        async with self._lock:
            loop = asyncio.get_running_loop()
            return await loop.run_in_executor(None, self._sync_push, task)

    def _sync_push(self, task: CrawlTask) -> bool:
        conn = self._get_connection()
        now = time.time()
        try:
            with conn:
                conn.execute("""
                    INSERT INTO crawl_queue (
                        task_id, url, depth, max_depth, method, headers_json, params_json,
                        priority, status, retry_count, max_retries, parser_type,
                        parser_rules_json, decrypt_type, decrypt_params_json, extra_json,
                        error_msg, created_at, updated_at
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """, (
                    task.task_id,
                    task.url,
                    task.depth,
                    task.max_depth,
                    task.method,
                    json.dumps(task.headers) if task.headers else None,
                    json.dumps(task.params) if task.params else None,
                    task.priority,
                    TaskStatus.PENDING.value,
                    task.retry_count,
                    task.max_retries,
                    task.parser_type,
                    json.dumps(task.parser_rules) if task.parser_rules else None,
                    task.decrypt_type,
                    json.dumps(task.decrypt_params) if task.decrypt_params else None,
                    json.dumps(task.extra) if task.extra else None,
                    None,
                    task.created_at,
                    now
                ))
            return True
        except sqlite3.IntegrityError:
            # URL已存在，自动去重
            return False

    async def push_batch(self, tasks: List[CrawlTask]) -> int:
        async with self._lock:
            loop = asyncio.get_running_loop()
            return await loop.run_in_executor(None, self._sync_push_batch, tasks)

    def _sync_push_batch(self, tasks: List[CrawlTask]) -> int:
        success = 0
        for task in tasks:
            if self._sync_push(task):
                success += 1
        return success

    async def pop(self) -> Optional[CrawlTask]:
        async with self._lock:
            loop = asyncio.get_running_loop()
            return await loop.run_in_executor(None, self._sync_pop)

    def _sync_pop(self) -> Optional[CrawlTask]:
        conn = self._get_connection()
        now = time.time()
        with conn:
            cur = conn.execute("""
                SELECT * FROM crawl_queue 
                WHERE status = 'pending' 
                ORDER BY priority DESC, id ASC 
                LIMIT 1
            """)
            row = cur.fetchone()
            if not row:
                return None

            row_id = row["id"]
            conn.execute(
                "UPDATE crawl_queue SET status = 'processing', updated_at = ? WHERE id = ?",
                (now, row_id)
            )

        return self._row_to_task(row)

    def _row_to_task(self, row: sqlite3.Row) -> CrawlTask:
        return CrawlTask(
            url=row["url"],
            task_id=row["task_id"],
            depth=row["depth"],
            max_depth=row["max_depth"],
            method=row["method"] or "GET",
            headers=json.loads(row["headers_json"]) if row["headers_json"] else {},
            params=json.loads(row["params_json"]) if row["params_json"] else {},
            priority=row["priority"] or 0,
            status=TaskStatus.PROCESSING,
            retry_count=row["retry_count"] or 0,
            max_retries=row["max_retries"] or 3,
            parser_type=row["parser_type"],
            parser_rules=json.loads(row["parser_rules_json"]) if row["parser_rules_json"] else None,
            decrypt_type=row["decrypt_type"],
            decrypt_params=json.loads(row["decrypt_params_json"]) if row["decrypt_params_json"] else {},
            extra=json.loads(row["extra_json"]) if row["extra_json"] else {},
            created_at=row["created_at"] or time.time(),
            updated_at=time.time(),
        )

    async def complete(self, task: CrawlTask) -> None:
        async with self._lock:
            loop = asyncio.get_running_loop()
            await loop.run_in_executor(None, self._sync_complete, task.url)

    def _sync_complete(self, url: str) -> None:
        conn = self._get_connection()
        now = time.time()
        with conn:
            conn.execute(
                "UPDATE crawl_queue SET status = 'completed', updated_at = ?, error_msg = NULL WHERE url = ?",
                (now, url)
            )

    async def fail(self, task: CrawlTask, error_msg: str = "") -> None:
        async with self._lock:
            loop = asyncio.get_running_loop()
            await loop.run_in_executor(None, self._sync_fail, task, error_msg)

    def _sync_fail(self, task: CrawlTask, error_msg: str) -> None:
        conn = self._get_connection()
        now = time.time()
        new_retries = task.retry_count + 1
        with conn:
            if new_retries <= task.max_retries:
                # 重新变为 pending 等待下次抓取
                conn.execute("""
                    UPDATE crawl_queue 
                    SET status = 'pending', retry_count = ?, error_msg = ?, updated_at = ?
                    WHERE url = ?
                """, (new_retries, error_msg, now, task.url))
            else:
                conn.execute("""
                    UPDATE crawl_queue 
                    SET status = 'failed', retry_count = ?, error_msg = ?, updated_at = ?
                    WHERE url = ?
                """, (new_retries, error_msg, now, task.url))

    async def is_empty(self) -> bool:
        async with self._lock:
            loop = asyncio.get_running_loop()
            return await loop.run_in_executor(None, self._sync_is_empty)

    def _sync_is_empty(self) -> bool:
        conn = self._get_connection()
        cur = conn.execute("SELECT COUNT(*) AS c FROM crawl_queue WHERE status IN ('pending', 'processing')")
        return cur.fetchone()["c"] == 0

    async def pending_count(self) -> int:
        async with self._lock:
            loop = asyncio.get_running_loop()
            return await loop.run_in_executor(None, self._sync_pending_count)

    def _sync_pending_count(self) -> int:
        conn = self._get_connection()
        cur = conn.execute("SELECT COUNT(*) AS c FROM crawl_queue WHERE status = 'pending'")
        return cur.fetchone()["c"]

    async def get_stats(self) -> Dict[str, Any]:
        async with self._lock:
            loop = asyncio.get_running_loop()
            return await loop.run_in_executor(None, self._sync_get_stats)

    def _sync_get_stats(self) -> Dict[str, Any]:
        conn = self._get_connection()
        cur = conn.execute("""
            SELECT 
                COUNT(*) as total,
                SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending,
                SUM(CASE WHEN status = 'processing' THEN 1 ELSE 0 END) as processing,
                SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed,
                SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed
            FROM crawl_queue
        """)
        row = cur.fetchone()
        return {
            "mode": "sqlite",
            "db_path": self.db_path,
            "total_seen": row["total"] or 0,
            "pending": row["pending"] or 0,
            "processing": row["processing"] or 0,
            "completed": row["completed"] or 0,
            "failed": row["failed"] or 0,
        }

    async def close(self) -> None:
        async with self._lock:
            if self._conn:
                self._conn.close()
                self._conn = None
