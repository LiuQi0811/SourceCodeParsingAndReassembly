# -*- coding: utf-8 -*-
"""
scrape.center 全站异步爬虫 —— 命令行入口

用法示例：
  # 抓取 ssr1 电影站（SSR，含图片资源）
  python main.py --site ssr1 --queue sqlite --concurrency 8

  # 自定义种子 URL + 组合解析器
  python main.py --url https://example.com --title 示例 --parser "bs4,xpath"

  # 一次性把 URL 列表载入内存队列
  python main.py --urls-file urls.txt --queue memory

  # SQLite 断点续爬（中断后再次运行同样命令续爬）
  python main.py --site ssr1 --queue sqlite --resume

  # 运行自测（单元 + 本地集成 + 视频合并验证）
  python main.py --self-test

  # 查看 scrape.center 全部预设站点
  python main.py --sites
"""
from __future__ import annotations

import argparse
import asyncio
import json
import logging
import sys
from pathlib import Path
from typing import Any, Dict, List, Optional

from crawler.engine import CrawlEngine
from crawler.events import LoggingObserver
from crawler.tasks import Settings, TaskSpec
from crawler.utils import write_json_report

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)-7s %(message)s",
    datefmt="%H:%M:%S",
)
logger = logging.getLogger("main")

# ---------------------------------------------------------------------------
# scrape.center 预设站点（58 个练习子站）
# ---------------------------------------------------------------------------
SITE_IDS = [
    "ssr1", "ssr2", "ssr3", "ssr4",
    "spa1", "spa2", "spa3", "spa4", "spa5", "spa6", "spa7", "spa8", "spa9",
    "spa10", "spa11", "spa12", "spa13", "spa14", "spa15", "spa16",
    "tool1",
    "captcha1", "captcha2", "captcha3", "captcha4", "captcha5", "captcha6", "captcha7", "captcha8",
    "login1", "login2", "login3",
    "websocket1",
    "antispider1", "antispider2", "antispider3", "antispider4", "antispider5",
    "antispider6", "antispider7", "antispider8", "antispider9", "antispider10",
    "appbasic1", "appbasic2",
    "app1", "app2", "app3", "app4", "app5", "app6", "app7", "app8", "app9",
]


def _site_task(site: str) -> TaskSpec:
    """为单个演示站点构造任务（按站点特性配置）"""
    base = f"https://{site}.scrape.center"
    common = dict(task_id=site, name=site, max_pages=40, depth=2, save_page=False, save_structured=False)
    if site.startswith("ssr"):
        task = TaskSpec(seed_urls=[base + "/"], **common)
        if site == "ssr2":
            task.verify_ssl = False  # 无 HTTPS 证书
        if site == "ssr3":
            task.auth = ("admin", "admin")  # HTTP Basic Auth
        if site == "ssr4":
            task.timeout = 60  # 每响应延迟 5 秒
            task.max_pages = 5
        return task
    if site == "spa1":  # Ajax 电影接口，JSON + cover 图片
        task = TaskSpec(
            seed_urls=[f"{base}/api/movie"],
            parser="regex",
            extract={"images": {"regex": r'"cover"\s*:\s*"([^"]+)"'}},
            **{**common, "depth": 1},
        )
        return task
    if site == "tool1":  # 代理池 API
        task = TaskSpec(
            seed_urls=["https://proxypool.scrape.center/random"],
            parser="regex",
            **{**common, "depth": 0, "save_structured": True},
        )
        return task
    # 其余为 SPA / 验证码 / 登录 / 反爬站点：抓首页 HTML + 静态资源
    task = TaskSpec(seed_urls=[base + "/"], download_resources=False, **{**common, "depth": 1})
    return task


def build_preset_tasks(site_ids: List[str]) -> List[TaskSpec]:
    return [_site_task(s) for s in site_ids]


def load_config_file(path: str) -> Dict[str, Any]:
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


def tasks_from_config(cfg: Dict[str, Any]) -> List[TaskSpec]:
    tasks: List[TaskSpec] = []
    for item in cfg.get("tasks", []):
        tasks.append(TaskSpec(**{k: v for k, v in item.items() if k != "_comment"}))
    return tasks


def settings_from_config(cfg: Dict[str, Any]) -> Settings:
    return Settings(**{k: v for k, v in cfg.get("settings", {}).items()})


async def run(args: argparse.Namespace) -> int:
    # ---- 任务来源 ----
    if args.self_test:
        from tests.self_test import main as self_test_main

        return await self_test_main()

    tasks: List[TaskSpec] = []
    settings = Settings()

    if args.config:
        cfg = load_config_file(args.config)
        tasks = tasks_from_config(cfg)
        settings = settings_from_config(cfg)

    if args.site:
        site_ids = [s.strip() for s in args.site.split(",") if s.strip()]
        for sid in site_ids:
            if sid not in SITE_IDS:
                print(f"未知站点: {sid}。可用: {', '.join(SITE_IDS)}")
                return 2
        tasks.extend(build_preset_tasks(site_ids))
        # 用户显式传入的 --max-pages / --depth 覆盖站点预设（None=未传，保持预设）
        if args.max_pages is not None:
            for t in tasks:
                t.max_pages = args.max_pages
        if args.depth is not None:
            for t in tasks:
                t.depth = args.depth

    if args.url:
        seeds = [args.url] + (args.urls or [])
        parser = args.parser.replace(",", "|")
        if "," in args.parser:
            parser = [p.strip() for p in args.parser.split(",")]
        tasks.append(
            TaskSpec(
                task_id=args.task_id or (args.title or "custom"),
                name=args.title or (args.task_id or "custom"),
                seed_urls=seeds,
                parser=parser,
                depth=args.depth if args.depth is not None else 2,
                max_pages=args.max_pages if args.max_pages is not None else 200,
                download_resources=not args.no_resources,
                verify_ssl=not args.no_verify_ssl,
            )
        )

    if args.urls_file:
        with open(args.urls_file, "r", encoding="utf-8") as f:
            lines = [ln.strip() for ln in f if ln.strip() and not ln.startswith("#")]
        if tasks:
            tasks[0].seed_urls.extend(lines)
        else:
            tasks.append(
                TaskSpec(
                    task_id=args.task_id or "urls-file",
                    name=args.title or "urls-file",
                    seed_urls=lines,
                    depth=args.depth if args.depth is not None else 2,
                    max_pages=args.max_pages if args.max_pages is not None else 200,
                    download_resources=not args.no_resources,
                )
            )

    if not tasks:
        print("请提供 --site / --url / --urls-file / --config / --self-test 之一")
        return 2

    # ---- 覆盖全局设置 ----
    if args.queue:
        settings.queue_type = args.queue
    if args.db:
        settings.sqlite_path = args.db
    if args.concurrency:
        settings.concurrency = args.concurrency
    if args.qps:
        settings.qps = args.qps
    if args.progress:
        settings.progress = True
    if args.output:
        settings.output_dir = args.output
    if args.resume:
        settings.resume = True
    settings.download_resources = not args.no_resources
    settings.verbose = args.verbose

    print("=" * 72)
    print(f"队列: {settings.queue_type}    并发: {settings.concurrency}    "
          f"输出: {settings.output_dir}    断点续爬: {settings.resume}")
    for t in tasks:
        print(f"  - [{t.task_id}] {t.name}  种子: {t.seed_urls[:2]}  深度: {t.depth}  "
              f"解析器: {t.parser if isinstance(t.parser, str) else '+'.join(t.parser)}")
    print("=" * 72)

    engine = CrawlEngine(settings=settings)
    engine.event_bus.subscribe_all(LoggingObserver(verbose=settings.verbose))
    stats = await engine.start(tasks)

    s = stats.summary()
    print("\n" + "=" * 72)
    print("抓取报告")
    print("=" * 72)
    print(f"耗时: {s['elapsed_seconds']}s   页面成功: {s['pages_fetched']}   "
          f"页面失败: {s['pages_failed']}（尝试失败 {s['pages_attempts_failed']} 次，含重试）")
    print(f"发现链接: {s['links_discovered']}   发现资源: {s['resources_found']}   "
          f"资源下载: {s['resources_downloaded']}   "
          f"资源失败: {s['resources_failed']}（尝试失败 {s['resource_attempts_failed']} 次，含重试）")
    print(f"视频合并: {s['videos_merged']}   视频失败: {s['videos_failed']}")
    print(f"总下载: {s['bytes_downloaded']} 字节")
    if s["failure_reasons"]:
        order = sorted(s["failure_reasons"].items(), key=lambda x: -x[1])
        print("失败原因分布: " + "  ".join(f"{k}={v}" for k, v in order))
    if s["tasks"]:
        print("\n分任务明细:")
        print(f"  {'任务':<12}{'页面成功':>8}{'页面失败':>8}{'资源成功':>10}{'资源失败':>10}{'下载字节':>14}")
        for tid in sorted(s["tasks"]):
            t = s["tasks"][tid]
            print(f"  {tid:<12}{t['fetched']:>8}{t['failed']:>8}"
                  f"{t['resources']:>10}{t['resources_failed']:>10}{t['bytes']:>14}")
    print(f"输出目录: {Path(settings.output_dir).resolve()}")
    try:
        index = engine.storage.build_index()
        print(f"产物索引: {index.resolve()}")
    except Exception:
        logger.exception("生成产物索引失败")
    rep = write_json_report(settings.output_dir, s, extra={"sites": [t.task_id for t in tasks]})
    if rep:
        print(f"统计报告: {rep}")
    return 0


def main() -> int:
    ap = argparse.ArgumentParser(description="scrape.center 异步爬虫（asyncio + aiohttp）")
    ap.add_argument("--site", help="scrape.center 预设站点，逗号分隔，如 ssr1,ssr2")
    ap.add_argument("--url", help="自定义种子 URL")
    ap.add_argument("--urls", nargs="*", default=[], help="附加种子 URL")
    ap.add_argument("--urls-file", help="从文件批量加载种子 URL（每行一个）")
    ap.add_argument("--title", default="", help="任务标题（目录名）")
    ap.add_argument("--task-id", default="", help="任务 ID（默认取标题）")
    ap.add_argument("--parser", default="auto", help="解析器: auto/bs4/xpath/regex/组合(bs4,xpath)")
    ap.add_argument("--depth", type=int, default=None, help="链接爬取深度（覆盖 --site 预设；默认按站点预设）")
    ap.add_argument("--max-pages", type=int, default=None,
                    help="每任务最大页面数（覆盖 --site 预设；0=不设限；默认按站点预设）")
    ap.add_argument("--queue", choices=["memory", "sqlite"], default="", help="队列类型")
    ap.add_argument("--db", default="", help="SQLite 队列文件路径")
    ap.add_argument("--concurrency", type=int, default=0, help="并发数")
    ap.add_argument("--qps", type=float, default=0.0, help="全局请求速率上限（每秒请求数，0=不限速）")
    ap.add_argument("--progress", action="store_true", help="实时进度输出（每 10s 打印一行）")
    ap.add_argument("--log-file", default="", help="详细日志同时写入该文件（UTF-8），便于长任务追溯排查")
    ap.add_argument("--output", default="", help="输出目录")
    ap.add_argument("--resume", action="store_true", help="断点续爬（sqlite 队列）")
    ap.add_argument("--no-resources", action="store_true", help="不下载资源")
    ap.add_argument("--no-verify-ssl", action="store_true", help="跳过 SSL 证书校验")
    ap.add_argument("--config", default="", help="JSON 配置文件")
    ap.add_argument("--verbose", action="store_true", help="详细日志")
    ap.add_argument("--sites", action="store_true", help="列出全部预设站点")
    ap.add_argument("--self-test", action="store_true", help="运行自测")
    args = ap.parse_args()

    if args.log_file:
        log_parent = Path(args.log_file).parent
        if str(log_parent) not in ("", "."):
            log_parent.mkdir(parents=True, exist_ok=True)
        fh = logging.FileHandler(args.log_file, encoding="utf-8")
        fh.setFormatter(logging.Formatter(
            "%(asctime)s %(levelname)-7s %(name)s %(message)s", datefmt="%Y-%m-%d %H:%M:%S",
        ))
        logging.getLogger().addHandler(fh)

    if args.sites:
        print("scrape.center 预设站点:")
        for i in range(0, len(SITE_IDS), 8):
            print("  " + "  ".join(SITE_IDS[i:i + 8]))
        return 0

    try:
        return asyncio.run(run(args))
    except KeyboardInterrupt:
        print("\n已手动中断（SQLite 队列已持久化，可用 --resume 续爬）")
        return 130
    except Exception:
        logger.exception("运行失败")
        return 1


if __name__ == "__main__":
    sys.exit(main())
