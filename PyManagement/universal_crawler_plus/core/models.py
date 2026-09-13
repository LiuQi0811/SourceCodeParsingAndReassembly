"""
核心数据模型
使用 Pydantic 定义各模块之间传递的数据结构
"""
from datetime import datetime
from typing import Optional, Dict, Any, List
from dataclasses import dataclass, field
from enum import Enum
from pathlib import Path

from .config import ResourceType


class TaskStatus(Enum):
    PENDING = "pending"
    QUEUED = "queued"
    DOWNLOADING = "downloading"
    DOWNLOADED = "downloaded"
    PARSING = "parsing"
    PARSED = "parsed"
    FAILED = "failed"
    SKIPPED = "skipped"
    DUPLICATE = "duplicate"


@dataclass
class UrlItem:
    """URL任务项"""
    url: str
    depth: int = 0
    referer: str = ""
    resource_type: ResourceType = ResourceType.HTML
    status: TaskStatus = TaskStatus.PENDING
    retries: int = 0
    local_path: Optional[Path] = None
    content_length: int = 0
    content_hash: str = ""
    headers: Dict[str, str] = field(default_factory=dict)
    created_at: datetime = field(default_factory=datetime.now)
    extra: Dict[str, Any] = field(default_factory=dict)

    def __hash__(self):
        return hash(self.url)

    def __eq__(self, other):
        if isinstance(other, UrlItem):
            return self.url == other.url
        return False


@dataclass
class DownloadResult:
    """下载结果"""
    url: str
    success: bool
    status_code: int = 0
    local_path: Optional[Path] = None
    content: Optional[bytes] = None
    content_type: str = ""
    content_length: int = 0
    from_resume: bool = False  # 是否来自断点续传
    error: Optional[str] = None
    headers: Dict[str, str] = field(default_factory=dict)
    elapsed: float = 0.0


@dataclass
class ParseResult:
    """解析结果"""
    url: str
    success: bool
    title: str = ""
    links: List[str] = field(default_factory=list)
    resources: List[str] = field(default_factory=list)
    text_content: str = ""
    metadata: Dict[str, Any] = field(default_factory=dict)
    error: Optional[str] = None


@dataclass
class CrawlStats:
    """爬取统计"""
    total_urls: int = 0
    queued: int = 0
    downloaded: int = 0
    parsed: int = 0
    failed: int = 0
    skipped: int = 0
    duplicate: int = 0
    total_bytes: int = 0
    start_time: Optional[datetime] = None
    end_time: Optional[datetime] = None

    @property
    def duration(self) -> float:
        if self.start_time and self.end_time:
            return (self.end_time - self.start_time).total_seconds()
        elif self.start_time:
            return (datetime.now() - self.start_time).total_seconds()
        return 0.0

    @property
    def speed(self) -> float:
        if self.duration > 0:
            return self.downloaded / self.duration
        return 0.0
