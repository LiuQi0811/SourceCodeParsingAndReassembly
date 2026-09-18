"""自测：双队列（内存 / SQLite 断点续爬）。"""

from __future__ import annotations

import asyncio
import os
import sys
import tempfile
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from core.factories import QueueFactory, TaskFactory
from core.models import Task


async def test_memory_queue() -> None:
    q = QueueFactory.create("memory")
    await q.start()
    t1 = Task(url="https://a.com/x", title="a")
    t2 = Task(url="https://a.com/x", title="a")   # 重复
    t3 = Task(url="https://a.com/y", title="b", priority=5)
    assert await q.put(t1) is True
    assert await q.put(t2) is False, "重复 URL 应被去重"
    assert await q.put(t3) is True
    assert await q.pending_count() == 2
    got = await q.get()
    assert got.url == "https://a.com/y", "priority 越高越先出队"
    await q.complete(got.url)
    got2 = await q.get()
    assert got2.url == "https://a.com/x"
    await q.complete(got2.url)
    assert await q.empty()
    await q.close()
    print("  ✔ 内存队列：去重/优先级/状态流转")


async def test_sqlite_queue_resume() -> None:
    with tempfile.TemporaryDirectory() as tmp:
        db = os.path.join(tmp, "q.sqlite")
        q = QueueFactory.create("sqlite", db_path=db)
        await q.start()
        await q.put(Task(url="https://b.com/1", title="t1"))
        await q.put(Task(url="https://b.com/2", title="t2"))
        got = await q.get()          # 标记 running
        assert got.url == "https://b.com/1"
        # 模拟中断：不 complete 直接 close
        await q.close()

        # 断点续爬：重新打开，running 的 1 与 pending 的 2 都应恢复为 pending
        q2 = QueueFactory.create("sqlite", db_path=db)
        await q2.start()
        assert await q2.pending_count() == 2, "断点应恢复 2 个任务"
        got1 = await q2.get()
        got2 = await q2.get()
        assert {got1.url, got2.url} == {"https://b.com/1", "https://b.com/2"}
        await q2.complete(got1.url)
        await q2.fail(got2.url, "测试失败")
        await q2.close()
    print("  ✔ SQLite 队列：持久化 + 断点续爬 + 失败标记")


async def main() -> None:
    await test_memory_queue()
    await test_sqlite_queue_resume()


if __name__ == "__main__":
    asyncio.run(main())
