# -*- coding: utf-8 -*-
"""
下载器策略抽象基类（策略模式）
不同资源类型对应不同下载策略：图片/文档走通用 HTTP 下载，视频走协议下载合并。
"""
from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass
from pathlib import Path
from typing import Optional


@dataclass
class DownloadResult:
    """一次资源下载的结果"""

    ok: bool
    path: Optional[Path] = None
    bytes: int = 0
    note: str = ""
    resource_type: str = ""
    retriable: bool = True   # False=确定性失败（如 HTTP 4xx），不重试直接终态


class ResourceDownloader(ABC):
    """资源下载策略抽象基类"""

    name: str = "base"
    supported_types: tuple = ()

    @abstractmethod
    async def download(self, job) -> DownloadResult:
        """执行下载；job 为 QueueItem（含 url/task_id/referer/resource_type 等）"""
