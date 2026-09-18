# -*- coding: utf-8 -*-
"""视频资源下载器：协议识别 -> 合并器下载 -> 事件发布"""
from __future__ import annotations

import logging
from pathlib import Path

from ..constants import EventType
from ..resource.storage import ResourceStorage
from ..video.base import VideoDownloader, build_merger_factory
from .base import DownloadResult, ResourceDownloader

logger = logging.getLogger("crawler.download.video")


class VideoResourceDownloader(ResourceDownloader):
    """视频资源下载策略：支持 HLS/DASH/FLV/RTMP/RTSP，含分片下载与合并"""

    name = "video"

    def __init__(self, fetcher, storage: ResourceStorage, task_ctx=None, event_bus=None,
                 ffmpeg_sem=None) -> None:
        self.fetcher = fetcher
        self.storage = storage
        self.task_ctx = task_ctx
        self.event_bus = event_bus
        factory = build_merger_factory(fetcher, task_ctx, storage, event_bus, ffmpeg_sem)
        self.downloader = VideoDownloader(merger_factory=factory)

    async def download(self, job) -> DownloadResult:
        task = self.task_ctx.get(job.task_id) if self.task_ctx else None
        title = task.title if task else ""
        protocol = self.downloader.detect_protocol(job.url)
        filename = self._filename(job.url, protocol)

        if self.event_bus:
            self.event_bus.emit(
                EventType.VIDEO_MERGE_START, task_id=job.task_id, url=job.url,
                message=f"协议={protocol} 开始下载合并", data={"protocol": protocol},
            )
        try:
            dest_dir = self.storage.group_dir(job.task_id, "video", title)
            # 幂等：同一 URL 的合并产物已存在（上次成功），直接复用不重复下载
            out = dest_dir / f"{filename}.mp4"
            if out.exists() and out.stat().st_size > 0:
                if self.event_bus:
                    self.event_bus.emit(
                        EventType.VIDEO_MERGE_OK, task_id=job.task_id, url=job.url,
                        message=f"视频产物已存在，复用: {out.name} ({out.stat().st_size} 字节)",
                        data={"path": str(out), "bytes": out.stat().st_size},
                    )
                return DownloadResult(ok=True, path=out, bytes=out.stat().st_size,
                                      note="protocol={protocol}（复用）", resource_type="video")
            try:
                out = await self.downloader.download(job.url, dest_dir, filename, job, task)
            except Exception as exc:
                # 合并失败：保留已下载分片，复用重试一次（大视频省去重复下载全部分片）
                logger.warning("视频合并失败，复用分片重试一次: %s (%s)", job.url, exc)
                try:
                    out = await self.downloader.download(job.url, dest_dir, filename, job, task)
                except Exception as exc2:
                    import shutil

                    shutil.rmtree(dest_dir / f".{filename}.parts", ignore_errors=True)
                    raise exc2
            size = out.stat().st_size if out.exists() else 0
            if self.event_bus:
                self.event_bus.emit(
                    EventType.VIDEO_MERGE_OK, task_id=job.task_id, url=job.url,
                    message=f"视频合并完成: {out.name} ({size} 字节)", data={"path": str(out), "bytes": size},
                )
            return DownloadResult(ok=True, path=out, bytes=size, note=f"protocol={protocol}", resource_type="video")
        except Exception as exc:
            if self.event_bus:
                self.event_bus.emit(
                    EventType.VIDEO_MERGE_ERROR, task_id=job.task_id, url=job.url,
                    message=f"视频下载合并失败: {exc}", data={"error": str(exc)},
                )
            logger.warning("视频下载失败 %s: %s", job.url, exc)
            return DownloadResult(ok=False, note=str(exc)[:300], resource_type="video")

    @staticmethod
    def _filename(url: str, protocol: str) -> str:
        from ..utils import sanitize_filename, url_filename

        base = url_filename(url, default=f"video_{protocol}")
        name = base.rsplit(".", 1)[0] if "." in base else base
        return sanitize_filename(name, max_len=100, fallback=f"video_{protocol}")
