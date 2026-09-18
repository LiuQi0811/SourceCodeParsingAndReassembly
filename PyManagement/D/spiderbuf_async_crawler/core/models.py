"""数据模型：任务、资源项、解析结果。"""

from __future__ import annotations

import time
from dataclasses import dataclass, field
from enum import Enum
from typing import Any, Dict, List, Optional


class RetryableError(RuntimeError):
    """可重试错误：限流/临时性反爬/瞬时 5xx，调用方应指数退避重试。"""


class TaskStatus(str, Enum):
    PENDING = "pending"
    RUNNING = "running"
    DONE = "done"
    FAILED = "failed"
    SKIPPED = "skipped"


class ResourceKind(str, Enum):
    """自动识别的资源类型，用于分类目录。"""

    IMAGE = "images"          # 图片
    VIDEO = "videos"          # 视频
    AUDIO = "audios"          # 音频
    DOC = "docs"              # 文档
    ARCHIVE = "archives"      # 压缩包
    CODE = "codes"            # 代码/脚本
    DATA = "data"             # 数据文件（json/csv 等）
    PAGE = "pages"            # 网页（html 另存）
    OTHER = "other"           # 其他


@dataclass
class Task:
    """一个抓取任务（URL + 可选覆盖配置）。"""

    url: str
    title: str = ""                     # 任务标题，用于命名保存目录
    method: str = "GET"                 # GET / POST
    data: Optional[Dict[str, Any]] = None      # POST 表单
    json_body: Optional[Dict[str, Any]] = None # POST JSON
    headers: Optional[Dict[str, str]] = None   # 自定义请求头（覆盖全局）
    parser: Optional[str] = None        # 单任务解析器（覆盖全局）：bs4/xpath/re/composite
    parser_config: Optional[Dict[str, Any]] = None  # 解析器配置
    charset: Optional[str] = None       # 强制字符集（否则自动识别）
    save_resources: bool = True         # 是否保存页面内资源
    save_html: bool = False             # 是否保存 HTML 原页
    depth: int = 0                      # 抓取深度（内存队列广度优先）
    solver: Optional[str] = None        # 站点签名器名称（见 sites 适配层）
    require_browser: bool = False       # 是否需要浏览器执行器
    external_script: Optional[str] = None  # 外部执行脚本（如 spiders/spider_xx.py）
    priority: int = 0                   # 越大越优先
    extra: Dict[str, Any] = field(default_factory=dict)  # 站点自定义字段

    def __post_init__(self) -> None:
        if not self.title:
            self.title = self.url.split("//")[-1].split("/")[0] or self.url


@dataclass
class ResourceItem:
    """从页面中发现/需要下载的资源。"""

    url: str
    kind: ResourceKind = ResourceKind.OTHER
    name: str = ""                       # 保存文件名（不含扩展名）
    referer: Optional[str] = None        # 防盗链 Referer
    extra: Dict[str, Any] = field(default_factory=dict)


@dataclass
class ParseResult:
    """解析器的统一输出。"""

    links: List[str] = field(default_factory=list)      # 发现的页面链接（URL）
    resources: List[ResourceItem] = field(default_factory=list)  # 发现的资源
    data: Dict[str, Any] = field(default_factory=dict)  # 结构化数据（表格/字段）
    title: str = ""                                      # 页面标题
    encoding: str = "utf-8"                              # 实际使用的编码


@dataclass
class CrawlStats:
    """抓取统计（观察者输出）。"""

    started_at: float = field(default_factory=time.time)
    fetched: int = 0
    succeeded: int = 0
    failed: int = 0
    discovered_urls: int = 0
    saved_resources: int = 0
    merged_videos: int = 0
    task_results: List[Dict[str, Any]] = field(default_factory=list)  # 运行成绩单

    @property
    def elapsed(self) -> float:
        return time.time() - self.started_at
