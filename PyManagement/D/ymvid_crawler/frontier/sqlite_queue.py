"""SQLite 持久化队列策略：支持断点续爬"""
import sqlite3
import asyncio
import time
from .base import URLFrontier


class SQLiteFrontier(URLFrontier):
    SCHEMA = """
    CREATE TABLE IF NOT EXISTS url_queue (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        url TEXT UNIQUE NOT NULL,
        depth INTEGER DEFAULT 0,
        parent TEXT DEFAULT '',
        status TEXT DEFAULT 'pending',
        error TEXT DEFAULT '',
        updated_at REAL
    );
    CREATE INDEX IF NOT EXISTS idx_status ON url_queue(status);
    """

    def __init__(self, db_path: str = "crawl_queue.db"):
        self._db_path = db_path
        self._conn = sqlite3.connect(db_path, check_same_thread=False)
        self._conn.execute("PRAGMA journal_mode=WAL")
        self._conn.execute("PRAGMA synchronous=NORMAL")
        self._conn.executescript(self.SCHEMA)
        self._conn.commit()
        self._lock = asyncio.Lock()

    async def put(self, url: str, depth: int = 0, parent: str = ""):
        async with self._lock:
            try:
                self._conn.execute(
                    "INSERT OR IGNORE INTO url_queue "
                    "(url, depth, parent, status, updated_at) "
                    "VALUES (?, ?, ?, 'pending', ?)",
                    (url, depth, parent, time.time())
                )
                self._conn.commit()
            except sqlite3.Error:
                pass

    async def get(self) -> tuple[str, int] | None:
        async with self._lock:
            cur = self._conn.execute(
                "SELECT url, depth FROM url_queue WHERE status='pending' "
                "ORDER BY id LIMIT 1"
            )
            row = cur.fetchone()
            if row:
                self._conn.execute(
                    "UPDATE url_queue SET status='processing', updated_at=? "
                    "WHERE url=?",
                    (time.time(), row[0])
                )
                self._conn.commit()
                return row[0], row[1]
            return None

    async def mark_done(self, url: str, status: str = "done"):
        async with self._lock:
            self._conn.execute(
                "UPDATE url_queue SET status=?, updated_at=? WHERE url=?",
                (status, time.time(), url)
            )
            self._conn.commit()

    async def mark_error(self, url: str, error: str = ""):
        async with self._lock:
            self._conn.execute(
                "UPDATE url_queue SET status='error', error=?, updated_at=? "
                "WHERE url=?",
                (error[:500], time.time(), url)
            )
            self._conn.commit()

    async def size(self) -> int:
        async with self._lock:
            cur = self._conn.execute(
                "SELECT COUNT(*) FROM url_queue WHERE status='pending'"
            )
            return cur.fetchone()[0]

    async def close(self):
        async with self._lock:
            self._conn.commit()
            self._conn.close()

    async def reset_processing(self):
        """启动时把未完成的 processing 重置为 pending，实现断点续爬"""
        async with self._lock:
            self._conn.execute(
                "UPDATE url_queue SET status='pending' WHERE status='processing'"
            )
            self._conn.commit()