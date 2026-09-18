# -*- coding: utf-8 -*-
"""
视频流协议下载合并：抽象基类 + 协议识别分发器
支持 HLS(m3u8) / DASH(mpd) / HTTP-FLV / RTMP / RTSP / WebRTC
"""
from __future__ import annotations

import logging
from abc import ABC, abstractmethod
from pathlib import Path
from typing import Optional

from ..constants import VideoProtocol

logger = logging.getLogger("crawler.video")


class VideoMergeError(Exception):
    """视频合并失败"""


class VideoMerger(ABC):
    """视频协议合并器抽象基类"""

    protocol: str = "base"

    def __init__(self, fetcher, task_ctx, storage, event_bus=None) -> None:
        self.fetcher = fetcher
        self.task_ctx = task_ctx        # dict: task_id -> task
        self.storage = storage
        self.event_bus = event_bus

    def _emit(self, etype: str, task_id: str, url: str, message: str = "", data=None) -> None:
        if self.event_bus:
            self.event_bus.emit(etype, task_id=task_id, url=url, message=message, data=data)

    @abstractmethod
    async def download(self, url: str, dest_dir: Path, filename: str, job) -> Path:
        """下载并合并，返回最终文件路径"""


class VideoDownloader:
    """视频协议识别与分发器"""

    @staticmethod
    def detect_protocol(url: str) -> Optional[str]:
        low = url.lower()
        for pattern, proto in VideoProtocol.PROTOCOL_PATTERNS:
            if pattern in low:
                return proto
        return None

    def __init__(self, merger_factory=None) -> None:
        # merger_factory: callable(protocol) -> VideoMerger
        self.merger_factory = merger_factory

    async def download(self, url: str, dest_dir: Path, filename: str, job, task) -> Path:
        protocol = self.detect_protocol(url)
        if protocol is None:
            raise VideoMergeError(f"无法识别的视频协议: {url}")
        merger = self.merger_factory(protocol)
        return await merger.download(url, dest_dir, filename, job)


def build_merger_factory(fetcher, task_ctx, storage, event_bus=None, ffmpeg_sem=None):
    """构造合并器工厂：protocol -> merger 实例（工厂模式）"""
    from .dash_merger import DASHMerger
    from .flv_merger import FLVMerger
    from .hls_merger import HLSMerger
    from .rtmp_rtsp import RTSPMerger

    def _factory(protocol: str) -> VideoMerger:
        if protocol == VideoProtocol.HLS:
            return HLSMerger(fetcher, task_ctx, storage, event_bus, ffmpeg_sem=ffmpeg_sem)
        if protocol == VideoProtocol.DASH:
            return DASHMerger(fetcher, task_ctx, storage, event_bus, ffmpeg_sem=ffmpeg_sem)
        if protocol == VideoProtocol.FLV:
            return FLVMerger(fetcher, task_ctx, storage, event_bus, ffmpeg_sem=ffmpeg_sem)
        if protocol in (VideoProtocol.RTMP, VideoProtocol.RTSP):
            return RTSPMerger(fetcher, task_ctx, storage, event_bus, ffmpeg_sem=ffmpeg_sem)
        raise VideoMergeError(f"WebRTC 为实时 P2P 流，无法离线下载合并: 协议={protocol}")

    return _factory
