# downloader/base.py
from __future__ import annotations

from abc import ABC, abstractmethod
from pathlib import Path


class DownloadStrategy(ABC):
    """下载器策略抽象基类"""

    @abstractmethod
    async def download(
        self,
        url: str,
        save_path: Path,
        session=None,
        **kwargs,
    ) -> bool:
        ...

    @abstractmethod
    def can_handle(self, url: str, content_type: str = "") -> bool:
        ...