# main.py
"""
leyy.tv 异步视频爬虫 - 主入口

支持两种抓取模式：
  1. 全部抓取 (mode="all")     : 从首页开始递归爬整个站点
  2. 指定抓取 (mode="specific") : 只下载指定的播放页（支持 URL 列表 / 文件）

用法：
  # 代码内配置 - 修改下方 CRAWL_MODE 和对应配置即可
  python async_crawler_leyy_tv.py

  # 命令行指定抓取（从文件读取播放页 URL，每行一个）
  python async_crawler_leyy_tv.py --mode specific --file urls.txt

  # 命令行指定抓取（直接传 URL）
  python async_crawler_leyy_tv.py --mode specific --url https://leyy.tv/vodplay/120017-1-1.html

  # 命令行全部抓取
  python async_crawler_leyy_tv.py --mode all
"""
from __future__ import annotations

import argparse
import asyncio
import logging
import sys
from pathlib import Path

from config import CrawlerConfig
from core.engine import CrawlEngine
from core.event import EventType
from observers.progress_reporter import ProgressReporter
from parser.factory import ParserFactory
from queue_.memory_queue import MemoryQueueStrategy
from queue_.sqlite_queue import SQLiteQueueStrategy

# ═══════════════════════════════════════════════════════════════
#  抓取模式配置（改这里就行）
# ═══════════════════════════════════════════════════════════════
CRAWL_MODE = "specific"  # "all" = 全部抓取 | "specific" = 指定抓取

# ── 全部抓取模式配置 ──
ALL_CONFIG = {
    "seed_urls": ["https://leyy.tv/"],
    "max_depth": 3,       # 首页→列表页→播放页→m3u8，共3层
}

# ── 指定抓取模式配置 ──
SPECIFIC_CONFIG = {
    # 方式一：直接写播放页 URL 列表（每行一个，支持多部）
    "urls": [
        "https://leyy.tv/vodplay/120017-1-1.html",
        # "https://leyy.tv/vodplay/120771-1-1.html",
        # "https://leyy.tv/vodplay/120785-1-1.html",
    ],
    # 方式二：从文件读取（每行一个播放页 URL，空行和 # 开头的行会忽略）
    # 设为 None 则不读文件；优先级：文件 > 上面的 urls 列表
    "url_file": None,  # 例如: "urls.txt"
    "max_depth": 1,    # 指定模式固定为1：只处理播放页本身，不蔓延
}
# ═══════════════════════════════════════════════════════════════


def build_queue(cfg: CrawlerConfig):
    if cfg.queue_type == "sqlite":
        return SQLiteQueueStrategy(db_path=cfg.sqlite_path)
    return MemoryQueueStrategy()


def load_urls_from_file(filepath: str) -> list[str]:
    """从文本文件读取 URL 列表，每行一个，忽略空行和注释"""
    p = Path(filepath)
    if not p.exists():
        print(f"[错误] URL 文件不存在: {filepath}")
        sys.exit(1)
    urls = []
    for line in p.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if line and not line.startswith("#"):
            urls.append(line)
    if not urls:
        print(f"[错误] URL 文件为空: {filepath}")
        sys.exit(1)
    return urls


def resolve_seed_urls(mode: str, args: argparse.Namespace) -> tuple[list[str], int]:
    """根据模式和命令行参数解析种子 URL 列表和最大深度"""

    # 命令行优先
    if args.mode:
        mode = args.mode

    if mode == "all":
        cfg = ALL_CONFIG
        if args.url:
            seeds = [args.url]
        elif args.file:
            seeds = load_urls_from_file(args.file)
        else:
            seeds = cfg["seed_urls"]
        return seeds, cfg["max_depth"]

    elif mode == "specific":
        # 命令行指定
        if args.url:
            return [args.url], 1
        if args.file:
            return load_urls_from_file(args.file), 1

        # 代码配置：文件优先
        if SPECIFIC_CONFIG["url_file"]:
            return load_urls_from_file(SPECIFIC_CONFIG["url_file"]), 1

        urls = SPECIFIC_CONFIG["urls"]
        if not urls:
            print("[错误] 指定抓取模式下 urls 列表为空，请在 SPECIFIC_CONFIG 中添加播放页 URL")
            sys.exit(1)
        return urls, 1

    else:
        print(f"[错误] 未知模式: {mode}，可选: all / specific")
        sys.exit(1)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="leyy.tv 异步视频爬虫",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__,
    )
    parser.add_argument(
        "--mode", choices=["all", "specific"],
        help="抓取模式: all=全部抓取, specific=指定抓取",
    )
    parser.add_argument(
        "--url", help="指定单个播放页 URL（specific 模式）",
    )
    parser.add_argument(
        "--file", help="从文件读取播放页 URL 列表，每行一个",
    )
    return parser.parse_args()


async def main():
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
        datefmt="%H:%M:%S",
    )

    args = parse_args()
    seed_urls, max_depth = resolve_seed_urls(CRAWL_MODE, args)

    mode_label = "全部抓取" if (args.mode or CRAWL_MODE) == "all" else "指定抓取"
    print(f"\n{'='*60}")
    print(f"  模式: {mode_label}")
    print(f"  种子 URL 数: {len(seed_urls)}")
    for u in seed_urls[:5]:
        print(f"    - {u}")
    if len(seed_urls) > 5:
        print(f"    ... 共 {len(seed_urls)} 个")
    print(f"  最大深度: {max_depth}")
    print(f"{'='*60}\n")

    cfg = CrawlerConfig(
        queue_type="memory",
        sqlite_path="crawler_queue.db",
        parser_type=["leyytv", "xpath", "regex"],
        output_dir="./downloads",
        # ── 并发控制（过高会被 CDN 限流/断连）──
        max_concurrency=16,
        worker_count=2,
        # ── 抓取范围 ──
        max_depth=max_depth,
        same_domain_only=False,
        seed_urls=seed_urls,
    )

    queue = build_queue(cfg)
    parser = ParserFactory.create(cfg.parser_type)
    engine = CrawlEngine(cfg, queue_strategy=queue, parser=parser)

    # 注册观察者
    reporter = ProgressReporter(verbose=True)
    engine.events.on(EventType.URL_DISCOVERED,
                     reporter.on_url_discovered)
    engine.events.on(EventType.DOWNLOAD_START,
                     reporter.on_download_start)
    engine.events.on(EventType.DOWNLOAD_COMPLETE,
                     reporter.on_download_complete)
    engine.events.on(EventType.DOWNLOAD_ERROR,
                     reporter.on_download_error)
    engine.events.on(EventType.CRAWL_COMPLETE,
                     reporter.on_crawl_complete)

    await engine.run()


if __name__ == "__main__":
    asyncio.run(main())
