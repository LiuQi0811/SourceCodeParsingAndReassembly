# -*- coding: utf-8 -*-
"""命令行入口。

示例：
    python -m aio_crawler https://example.com/ --queues memory
    python -m aio_crawler https://example.com/ --queues sqlite --db crawl.db --resume
    python -m aio_crawler https://example.com/ --parser composite:bs4,xpath,re --save-root downloads
"""
from __future__ import annotations

import asyncio
import logging
import sys

from .config import Config
from .engine import CrawlEngine


def _setup_logging(level: str) -> None:
    logging.basicConfig(
        level=getattr(logging, level.upper(), logging.INFO),
        format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
        datefmt="%H:%M:%S",
    )


def _print_summary(summary: dict) -> None:
    print("\n===== 爬取完成摘要 =====")
    for k, v in summary.items():
        print(f"  {k}: {v}")
    print("========================")


async def _run(cfg: Config) -> int:
    engine = CrawlEngine(cfg)
    summary = await engine.run()
    _print_summary(summary)
    return 0


def main(argv: list[str] | None = None) -> int:
    cfg = Config.from_cli(argv)
    _setup_logging(cfg.log_level)
    try:
        return asyncio.run(_run(cfg))
    except KeyboardInterrupt:
        print("\n已中断", file=sys.stderr)
        return 130


if __name__ == "__main__":
    sys.exit(main())
