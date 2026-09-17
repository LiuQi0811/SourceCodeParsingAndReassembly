# -*- coding: utf-8 -*-
"""运行配置。"""
from __future__ import annotations

import argparse
import os
from dataclasses import dataclass, field

DEFAULT_UA = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/124.0 Safari/537.36 aio_crawler/1.0"
)


@dataclass(slots=True)
class Config:
    # ---- 入口与范围
    start_urls: list[str] = field(default_factory=list)
    max_depth: Optional[int] = None          # None = 不限深度
    domain_scope: str = "same"               # same | all
    max_pages: Optional[int] = None          # 最多抓取页面数（用于限流/断点测试）

    # ---- 并发
    concurrency: int = 8                     # 页面抓取并发
    download_concurrency: int = 4            # 资源下载并发
    timeout: float = 30.0
    retries: int = 2
    user_agent: str = DEFAULT_UA

    # ---- 队列
    queue_type: str = "memory"               # memory | sqlite
    sqlite_path: str = "crawl_queue.db"
    resume: bool = True                      # SQLite 队列断点续爬

    # ---- 解析
    parser_mode: str = "auto"                # auto | bs4 | xpath | re | composite:bs4,xpath,re
    charset_fallback: Optional[str] = None   # 强制回退字符集

    # ---- 资源保存
    save_root: str = "downloads"
    title_dir: bool = True                   # 以页面标题建目录
    download_resources: bool = True
    resource_types: set[str] = field(default_factory=lambda: {"image", "video", "doc", "audio", "other"})
    overwrite: bool = False                  # 已存在是否覆盖
    follow_params: bool = True               # 去重时是否保留查询参数

    # ---- 视频合并
    remux: bool = True                       # 合并后用 ffmpeg 封装为 mp4
    ffmpeg_path: str = "ffmpeg"
    merge_concurrency: int = 4               # HLS/DASH 分片下载并发

    # ---- 策略
    strategy: str = "fullsite"               # fullsite | resource_only | depth_limited

    # ---- 其他
    log_level: str = "INFO"
    accept_exts: Optional[set[str]] = None   # 资源扩展名白名单（None = 全部）

    # ------------------------------------------------------------ 便捷方法
    @property
    def save_root_path(self) -> str:
        return os.path.abspath(self.save_root)

    @classmethod
    def from_cli(cls, argv: list[str] | None = None) -> "Config":
        p = argparse.ArgumentParser(
            prog="aio_crawler",
            description="通用异步爬虫框架（asyncio + aiohttp）",
        )
        p.add_argument("start", nargs="+", help="起始 URL")
        p.add_argument("--concurrency", type=int, default=8)
        p.add_argument("--download-concurrency", type=int, default=4)
        p.add_argument("--queue", choices=["memory", "sqlite"], default="memory",
                       help="队列类型：内存一次性加载 / SQLite 持久化断点续爬")
        p.add_argument("--db", default="crawl_queue.db", help="SQLite 队列数据库路径")
        p.add_argument("--no-resume", action="store_true", help="SQLite 队列不续爬（清空重建）")
        p.add_argument("--parser", default="auto",
                       help="auto | bs4 | xpath | re | composite:bs4,xpath,re")
        p.add_argument("--save-root", default="downloads")
        p.add_argument("--no-title-dir", action="store_true", help="不按标题建目录")
        p.add_argument("--depth", type=int, default=None, help="最大抓取深度")
        p.add_argument("--domain", choices=["same", "all"], default="same")
        p.add_argument("--strategy", choices=["fullsite", "resource_only", "depth_limited"],
                       default="fullsite")
        p.add_argument("--max-pages", type=int, default=None)
        p.add_argument("--resources", default=None,
                       help="只下载的资源类别，逗号分隔: image,video,doc,audio,other")
        p.add_argument("--accept-exts", default=None,
                       help="只下载的扩展名白名单，逗号分隔: jpg,png,mp4,m3u8,mpd")
        p.add_argument("--no-download", action="store_true", help="只抓页面不下载资源")
        p.add_argument("--no-remux", action="store_true", help="视频合并不转封装 mp4")
        p.add_argument("--ffmpeg", default="ffmpeg")
        p.add_argument("--timeout", type=float, default=30.0)
        p.add_argument("--retries", type=int, default=2)
        p.add_argument("--user-agent", default=DEFAULT_UA)
        p.add_argument("--overwrite", action="store_true")
        p.add_argument("--log-level", default="INFO")

        a = p.parse_args(argv)
        if a.resources:
            kinds = {s.strip().lower() for s in a.resources.split(",") if s.strip()}
            valid = {"image", "video", "doc", "audio", "other"}
            bad = kinds - valid
            if bad:
                p.error(f"无效资源类别: {sorted(bad)}，可选: {sorted(valid)}")
        cfg = cls(
            start_urls=a.start,
            concurrency=a.concurrency,
            download_concurrency=a.download_concurrency,
            queue_type=a.queue,
            sqlite_path=a.db,
            resume=not a.no_resume,
            parser_mode=a.parser,
            save_root=a.save_root,
            title_dir=not a.no_title_dir,
            max_depth=a.depth,
            domain_scope=a.domain,
            strategy=a.strategy,
            max_pages=a.max_pages,
            download_resources=not a.no_download,
            remux=not a.no_remux,
            ffmpeg_path=a.ffmpeg,
            timeout=a.timeout,
            retries=a.retries,
            user_agent=a.user_agent,
            overwrite=a.overwrite,
            log_level=a.log_level,
        )
        if a.resources:
            cfg.resource_types = {s.strip().lower() for s in a.resources.split(",") if s.strip()}
        if a.accept_exts:
            cfg.accept_exts = {s.strip().lower().lstrip(".") for s in a.accept_exts.split(",") if s.strip()}
        return cfg
