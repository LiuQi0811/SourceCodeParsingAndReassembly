# downloader/factory.py
from __future__ import annotations

from .base import DownloadStrategy
from .dash_downloader import DASHDownloader
from .hls_downloader import HLSDownloader
from .simple_downloader import SimpleDownloader
from .stream_downloader import FFmpegStreamDownloader, WebRTCDownloader


class DownloaderFactory:
    """
    下载器工厂。
    按顺序匹配 can_handle，命中即返回。
    """

    _downloaders: list[DownloadStrategy] = [
        HLSDownloader(),
        DASHDownloader(),
        FFmpegStreamDownloader(),
        WebRTCDownloader(),
        SimpleDownloader(),  # 兜底
    ]

    @classmethod
    def get_downloader(
        cls, url: str, content_type: str = ""
    ) -> DownloadStrategy:
        for d in cls._downloaders:
            if d.can_handle(url, content_type):
                return d
        return cls._downloaders[-1]

    @classmethod
    def register(cls, downloader: DownloadStrategy, priority: int = 0) -> None:
        cls._downloaders.insert(priority, downloader)