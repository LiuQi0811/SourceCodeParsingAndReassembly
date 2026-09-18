# -*- coding: utf-8 -*-
"""
RTMP / RTSP 流下载（经 ffmpeg）
  - RTMP: ffmpeg -i rtmp://... -c copy out.mp4
  - RTSP: ffmpeg -rtsp_transport tcp -i rtsp://... -c copy out.mp4
说明：RTMP/RTSP 为二进制流协议，aiohttp 无法直接读取，必须借助 ffmpeg。
"""
from __future__ import annotations

import logging
from pathlib import Path

from .base import VideoMergeError, VideoMerger
from .ffmpeg_utils import ffmpeg_available, ffprobe_duration, run_ffmpeg

logger = logging.getLogger("crawler.video.rtsp")


class RTSPMerger(VideoMerger):
    """RTMP 与 RTSP 共用：ffmpeg 拉流 + 转封装"""

    protocol = "rtsp"  # 同时处理 rtmp

    def __init__(self, fetcher, task_ctx, storage, event_bus=None, ffmpeg_sem=None,
                 max_live_seconds: int = 600) -> None:
        super().__init__(fetcher, task_ctx, storage, event_bus)
        self.max_live_seconds = max_live_seconds
        self._ffmpeg_sem = ffmpeg_sem

    async def download(self, url: str, dest_dir: Path, filename: str, job) -> Path:
        if not ffmpeg_available():
            raise VideoMergeError("RTMP/RTSP 下载需要 ffmpeg（请安装并加入 PATH）")
        task = self.task_ctx.get(job.task_id) if self.task_ctx else None
        dest_dir.mkdir(parents=True, exist_ok=True)

        out = dest_dir / f"{filename}.mp4"
        dur = getattr(task, "video_max_duration", 0) or self.max_live_seconds
        args = []
        if url.lower().startswith("rtsp://"):
            args = ["-rtsp_transport", "tcp", "-i", url]
        else:
            args = ["-rw_timeout", "10000000", "-i", url]
        args += ["-t", str(dur), "-c", "copy", "-movflags", "+faststart", str(out)]

        if self._ffmpeg_sem:
            async with self._ffmpeg_sem:
                rc, _, err = await run_ffmpeg(args, timeout=dur + 120)
        else:
            rc, _, err = await run_ffmpeg(args, timeout=dur + 120)
        if rc != 0 or not out.exists():
            raise VideoMergeError(f"ffmpeg 拉流失败（{url}）: {err[-400:]}")

        duration = await ffprobe_duration(str(out))
        if duration is None or duration <= 0:
            raise VideoMergeError("RTSP/RTMP 输出校验失败")
        return out
