# core/models.py
from __future__ import annotations

import time
from dataclasses import dataclass, field, asdict
from typing import Any, Optional


@dataclass(slots=True)
class QueueItem:
    """队列任务项"""

    url: str
    parent_url: Optional[str] = None
    depth: int = 0
    retry_count: int = 0
    id: Optional[int] = None

    # 运行时上下文（不持久化）
    parent_title: Optional[str] = None
    hint_type: Optional[str] = None
    meta: dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)

    @classmethod
    def from_row(cls, row: tuple) -> "QueueItem":
        """从 SQLite 查询行构造（顺序与 SELECT 一致）"""
        item_id, url, parent_url, depth, retry = row
        return cls(
            id=item_id,
            url=url,
            parent_url=parent_url,
            depth=depth,
            retry_count=retry,
        )


@dataclass(slots=True)
class ResourceInfo:
    """资源描述"""

    url: str
    resource_type: str = "other"
    title: Optional[str] = None
    group: Optional[str] = None
    filename: Optional[str] = None
    save_path: Optional[str] = None
    file_size: Optional[int] = None
    content_type: Optional[str] = None
    referer: Optional[str] = None
    headers: dict[str, str] = field(default_factory=dict)
    discovered_at: float = field(default_factory=time.time)


@dataclass
class CrawlStats:
    """爬取统计"""

    discovered: int = 0
    parsed: int = 0
    downloaded: int = 0
    errors: int = 0
    skipped: int = 0
    started_at: float = field(default_factory=time.time)
    finished_at: Optional[float] = None

    @property
    def elapsed(self) -> float:
        end = self.finished_at or time.time()
        return end - self.started_at

    def summary(self) -> str:
        return (
            f"发现={self.discovered} 解析={self.parsed} "
            f"下载={self.downloaded} 错误={self.errors} "
            f"跳过={self.skipped} 耗时={self.elapsed:.1f}s"
        )