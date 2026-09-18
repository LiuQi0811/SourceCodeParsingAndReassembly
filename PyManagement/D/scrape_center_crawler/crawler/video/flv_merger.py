# -*- coding: utf-8 -*-
"""
HTTP-FLV 下载合并
  - 静态 .flv：流式下载完整文件 -> ffmpeg 转封装 mp4（无 ffmpeg 保留 flv）
  - 直播 FLV（无 Content-Length）：ffmpeg 限时拉流 -> 转封装 mp4
"""
from __future__ import annotations

import asyncio
import logging
from pathlib import Path

from .base import VideoMergeError, VideoMerger
from .ffmpeg_utils import ffmpeg_available, ffprobe_duration, remux_to_mp4, run_ffmpeg

logger = logging.getLogger("crawler.video.flv")


class FLVMerger(VideoMerger):
    protocol = "flv"

    def __init__(self, fetcher, task_ctx, storage, event_bus=None, ffmpeg_sem=None,
                 max_live_seconds: int = 600) -> None:
        super().__init__(fetcher, task_ctx, storage, event_bus)
        self.max_live_seconds = max_live_seconds
        self._ffmpeg_sem = ffmpeg_sem

    async def download(self, url: str, dest_dir: Path, filename: str, job) -> Path:
        task = self.task_ctx.get(job.task_id) if self.task_ctx else None
        dest_dir.mkdir(parents=True, exist_ok=True)
        flv_path = dest_dir / f"{filename}.flv"

        # 1. 静态文件：直接流式下载
        try:
            headers = await self._probe_headers(url, task)
            content_length = int(headers.get("Content-Length") or 0)
        except Exception:
            content_length = 0

        if content_length > 0:
            await self.fetcher.stream_to_file(
                url, str(flv_path), referer=task.referer if task else "",
                verify_ssl=task.verify_ssl if task else True,
                auth=task.auth if task else None, timeout=300,
            )
        else:
            # 2. 直播流 / 未知长度：ffmpeg 限时拉流
            if not ffmpeg_available():
                raise VideoMergeError("HTTP-FLV 直播流需要 ffmpeg 拉取")
            dur = getattr(task, "video_max_duration", 0) or self.max_live_seconds
            args = ["-i", url, "-t", str(dur), "-c", "copy", str(flv_path)]
            if self._ffmpeg_sem:
                async with self._ffmpeg_sem:
                    rc, _, err = await run_ffmpeg(args, timeout=dur + 120)
            else:
                rc, _, err = await run_ffmpeg(args, timeout=dur + 120)
            if rc != 0 or not flv_path.exists():
                raise VideoMergeError(f"ffmpeg 拉取 FLV 失败: {err[-400:]}")

        duration = await ffprobe_duration(str(flv_path))
        if duration is None or duration <= 0:
            raise VideoMergeError("FLV 下载结果校验失败")

        # 3. 转封装 mp4（提高兼容性），转后校验可播放；校验失败回退 flv
        mp4 = dest_dir / f"{filename}.mp4"
        if ffmpeg_available():
            if self._ffmpeg_sem:
                async with self._ffmpeg_sem:
                    ok = await remux_to_mp4(str(flv_path), str(mp4))
            else:
                ok = await remux_to_mp4(str(flv_path), str(mp4))
            if ok and mp4.exists() and mp4.stat().st_size > 0:
                dur = await ffprobe_duration(str(mp4))
                if dur is not None and dur > 0:
                    flv_path.unlink(missing_ok=True)
                    return mp4
        return flv_path

    async def _probe_headers(self, url: str, task) -> dict:
        import aiohttp

        session = self.fetcher.session
        headers = dict(getattr(self.fetcher, "headers", {}))
        if task:
            headers.update(task.headers or {})
        async with session.head(
            url, headers=headers, ssl=False if (task and not task.verify_ssl) else None,
            timeout=aiohttp.ClientTimeout(total=30),
        ) as resp:
            return {k: v for k, v in resp.headers.items()}
