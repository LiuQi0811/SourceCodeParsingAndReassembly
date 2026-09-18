"""示例 2：SQLite 持久化队列 —— 边发现边入库，支持断点续爬。

运行：python -m examples.demo_sqlite_queue（在项目根目录）
队列数据落在 crawl_queue.sqlite；中断后重跑同一脚本可续爬。
"""

from __future__ import annotations

import asyncio
import logging
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from core.engine import CrawlerEngine
from core.events import PROGRESS, TASK_COMPLETED
from core.factories import QueueFactory, TaskFactory

logging.basicConfig(level=logging.WARNING)

SEED_URLS = [
    "https://spiderbuf.cn/challenge/requests-lxml-for-scraping-beginner",
    "https://spiderbuf.cn/challenge/scraper-http-header",
    "https://spiderbuf.cn/challenge/lxml-xpath-advanced",
]


async def main() -> None:
    # sqlite 队列：断点续爬（resume_failed=True 时失败任务也会重试）
    queue = QueueFactory.create("sqlite", db_path="crawl_queue.sqlite",
                                resume_failed=True)
    engine = CrawlerEngine(
        queue=queue,
        parser_name="bs4",
        workers=4,
        output_root="output/demo_sqlite",
        save_data=True,
    )

    async def on_done(event) -> None:
        task = event.data["task"]
        print(f"  ✔ {task.url}")

    async def on_progress(event) -> None:
        d = event.data
        print(f"  [进度] pending={d['pending']} done={d['succeeded']} "
              f"fail={d['failed']} res={d['resources']}")

    engine.on(TASK_COMPLETED, on_done)
    engine.on(PROGRESS, on_progress)

    seed = TaskFactory.create_many([{"url": u} for u in SEED_URLS])
    stats = await engine.run(seed)
    print(f"\n完成：成功 {stats.succeeded} / 失败 {stats.failed} / "
          f"保存资源 {stats.saved_resources}，耗时 {stats.elapsed:.1f}s")
    print("SQLite 队列文件：crawl_queue.sqlite（可重跑续爬）")


if __name__ == "__main__":
    asyncio.run(main())
