# -*- coding: utf-8 -*-
"""下载器模块：通用 HTTP 下载器 / 视频协议下载器（工厂分发）"""
from .base import DownloadResult, ResourceDownloader
from .http_downloader import HttpDownloader
from .video_downloader import VideoResourceDownloader

__all__ = ["DownloadResult", "ResourceDownloader", "HttpDownloader", "VideoResourceDownloader"]
