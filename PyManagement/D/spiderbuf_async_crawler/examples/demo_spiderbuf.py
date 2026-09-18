"""示例 3：SpiderBuf 39 关解题 —— 用框架跑通关卡。

运行（项目根目录）：
  python -m examples.demo_spiderbuf                 # 全部 39 关
  python -m examples.demo_spiderbuf --codes s01     # 只跑指定关卡
  python -m examples.demo_spiderbuf --groups s,e    # 只跑入门/登录组
  python -m examples.demo_spiderbuf --sqlite        # 用 SQLite 队列（断点续爬）
"""

from __future__ import annotations

import argparse
import asyncio
import json
import logging
import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from core.engine import CrawlerEngine, ScriptExternalRunner
from core.events import PROGRESS, TASK_COMPLETED, TASK_FAILED, VIDEO_MERGED
from core.factories import QueueFactory
from core.logging_util import setup_logging
from sites.spiderbuf.challenges import build_tasks
from sites.spiderbuf.solvers import build_solver_registry

# 文件记录 DEBUG 全量链路（output/logs/run_*.log），控制台只显 WARNING
log_path = setup_logging("output/logs")


async def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--codes", nargs="*", default=None)
    parser.add_argument("--groups", nargs="*", default=None)
    parser.add_argument("--sqlite", action="store_true")
    parser.add_argument("--db", default="spiderbuf_queue.sqlite")
    parser.add_argument("--workers", type=int, default=6)
    args = parser.parse_args()

    queue = QueueFactory.create("sqlite" if args.sqlite else "memory",
                                db_path=args.db, resume_failed=True)
    engine = CrawlerEngine(
        queue=queue,
        parser_name="bs4",
        workers=args.workers,
        output_root="output/spiderbuf",
        save_data=True,
        solver_registry=build_solver_registry(),
        external_runner=ScriptExternalRunner(),
    )

    async def on_done(event) -> None:
        task = event.data["task"]
        if event.data.get("external"):
            ok = "✔" if event.data.get("ok") else "✘"
            print(f"  {ok} [外部] {task.title} -> {task.url}")
        else:
            print(f"  ✔ [框架] {task.title} <- {task.url}")

    async def on_failed(event) -> None:
        err = event.data["error"][:200]
        logging.error("[失败] %s: %s", event.data["task"].title, err)
        print(f"  ✘ [失败] {event.data['task'].title}: {err}")

    async def on_progress(event) -> None:
        d = event.data
        print(f"  [进度] pending={d['pending']} done={d['succeeded']} "
              f"fail={d['failed']} 资源={d['resources']} 视频={d['videos']}")

    async def on_video(event) -> None:
        print(f"  ▶ 视频合并: {event.data['protocol']} -> {event.data['path']}")

    engine.on(TASK_COMPLETED, on_done)
    engine.on(TASK_FAILED, on_failed)
    engine.on(PROGRESS, on_progress)
    engine.on(VIDEO_MERGED, on_video)

    tasks = build_tasks(groups=args.groups, codes=args.codes)
    print(f"共 {len(tasks)} 个任务（日志: {log_path}）")
    try:
        stats = await engine.run(tasks)
    except KeyboardInterrupt:
        # engine.run 内部已温和停止；此处兜底提示
        print("\n已中断。SQLite 队列断点保留，下次加 --sqlite 可续爬。")
        stats = engine.stats

    print(f"\n================ 完成 ================")
    print(f"成功 {stats.succeeded} / 失败 {stats.failed} / "
          f"保存资源 {stats.saved_resources} / 合并视频 {stats.merged_videos}")
    print(f"耗时 {stats.elapsed:.1f}s，输出目录: output/spiderbuf")

    # 运行成绩单：每关状态 + 耗时 + 失败原因
    print("\n--- 运行成绩单 ---")
    for r in sorted(stats.task_results,
                    key=lambda x: (x["status"] != "ok", x["title"])):
        mark = "✔" if r["status"] == "ok" else "✘"
        extra = f"  {r['error']}" if r["status"] != "ok" else ""
        print(f"  {mark} {r['title']:<24} {r['elapsed']:>6.1f}s{extra}")
    report_path = os.path.join("output", "report.json")
    os.makedirs("output", exist_ok=True)
    with open(report_path, "w", encoding="utf-8") as f:
        json.dump({
            "elapsed": round(stats.elapsed, 1),
            "succeeded": stats.succeeded,
            "failed": stats.failed,
            "saved_resources": stats.saved_resources,
            "merged_videos": stats.merged_videos,
            "results": stats.task_results,
        }, f, ensure_ascii=False, indent=2)
    print(f"\n报告: {report_path}")


if __name__ == "__main__":
    asyncio.run(main())
