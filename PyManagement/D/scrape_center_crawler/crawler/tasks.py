# -*- coding: utf-8 -*-
"""任务描述与引擎设置"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional, Tuple


@dataclass
class TaskSpec:
    """一个抓取任务（可多个任务并行/串行执行）"""

    task_id: str = ""
    name: str = ""                       # 任务名（未从页面提取到标题时用作目录名）
    seed_urls: List[str] = field(default_factory=list)
    title_from_page: bool = True         # 目录优先使用页面 <title>
    allowed_domains: List[str] = field(default_factory=list)   # 链接爬取域白名单（默认种子域名）
    resource_domains: Optional[List[str]] = None  # 资源域白名单（None=全部允许）
    parser: Any = "auto"                 # 'bs4' | 'xpath' | 'regex' | ['bs4','xpath'] | {'type':...}
    extract: Optional[Dict[str, Any]] = None  # 自定义提取规则（links/images/videos/fields）
    depth: int = 2                       # 最大链接爬取深度（0=只抓种子页）
    max_pages: int = 200                 # 每任务最大页面抓取数
    concurrency: int = 8                 # 任务内并发
    delay: float = 0.0                   # 同域请求间隔（秒）
    timeout: float = 0.0                 # 请求超时（0=使用全局默认）
    verify_ssl: bool = True
    auth: Optional[Tuple[str, str]] = None   # (用户名, 密码) Basic Auth
    headers: Optional[Dict[str, str]] = None
    cookies: Optional[Dict[str, str]] = None
    download_resources: bool = True
    custom_resource_types: Optional[List[Dict]] = None  # 自定义资源类型
    crypto_plugin: Any = None            # 逆向解密插件配置（str | dict）
    save_page: bool = False              # 是否保存 HTML 原文
    save_structured: bool = True         # 是否保存结构化 JSON
    video_max_duration: int = 0          # 直播流最长拉取秒数（0=默认）
    referer: str = ""                    # 默认 Referer

    def __post_init__(self) -> None:
        if not self.task_id:
            self.task_id = self.name or "task"

    @property
    def title(self) -> str:
        return self.name or self.task_id

    def domain_whitelist(self) -> List[str]:
        if self.allowed_domains:
            return [d.lower().lstrip("*.") for d in self.allowed_domains]
        from .utils import domain_of

        domains = {domain_of(u) for u in self.seed_urls if domain_of(u)}
        return sorted(domains)


@dataclass
class Settings:
    """引擎全局设置"""

    output_dir: str = "output"
    queue_type: str = "memory"           # 'memory' | 'sqlite'
    sqlite_path: str = "crawler_queue.db"
    concurrency: int = 8
    timeout: float = 30.0
    max_retries: int = 3
    qps: float = 0.0                     # 全局请求速率上限（0=不限速）
    progress: bool = False               # 实时进度输出（每 10s 打印一行）
    verify_ssl: bool = True
    resume: bool = False                 # 断点续爬（sqlite 队列有效）
    verbose: bool = False
    download_resources: bool = True
    video_segment_concurrency: int = 8
    video_max_duration: int = 600
