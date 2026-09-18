#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""入口"""
import asyncio
import logging

from config import Config
from engine import CrawlerEngine


async def main():
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s [%(levelname)s] %(message)s",
        datefmt="%H:%M:%S",
    )

    config = Config(
        base_url="https://www.mtyy5.com",
        start_urls=["https://www.mtyy5.com"],
        concurrency=15,
        queue_mode="sqlite",                 # 可切换 "memory"
        parsers=["bs4", "lxml", "regex"],
        max_depth=4,
        max_pages=5000,
        output_dir="./downloads_mtyy5",
        db_path="./mtyy5_queue.db",
    )

    engine = CrawlerEngine(config)
    await engine.start()


if __name__ == "__main__":
    asyncio.run(main())