# downloader/__init__.py
from .base import DownloadStrategy
from .simple_downloader import SimpleDownloader
from .hls_downloader import HLSDownloader
from .dash_downloader import DASHDownloader
from .stream_downloader import FFmpegStreamDownloader, WebRTCDownloader
from .factory import DownloaderFactory

__all__ = [
    "DownloadStrategy", "SimpleDownloader", "HLSDownloader",
    "DASHDownloader", "FFmpegStreamDownloader", "WebRTCDownloader",
    "DownloaderFactory",
]