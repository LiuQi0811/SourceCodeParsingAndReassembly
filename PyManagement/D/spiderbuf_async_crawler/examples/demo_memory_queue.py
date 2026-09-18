"""示例 1：内存队列 —— 一次性加载全部 URL 后异步抓取。

运行：python -m examples.demo_memory_queue（在项目根目录）
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
    "https://spiderbuf.cn/challenge/requests-lxml-for-scraping-beginner",   # s01
    "https://spiderbuf.cn/challenge/scraper-http-header",                   # s02
    "https://spiderbuf.cn/challenge/lxml-xpath-advanced",                   # s03
]


async def main() -> None:
    queue = QueueFactory.create("memory")
    engine = CrawlerEngine(
        queue=queue,
        parser_name="bs4",
        workers=4,
        output_root="output/demo_memory",
        save_data=True,
    )

    # 观察者：打印完成事件
    async def on_done(event) -> None:
        task = event.data["task"]
        print(f"  ✔ {task.url} -> title={event.data.get('title', '')}")

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


if __name__ == "__main__":
    asyncio.run(main())
