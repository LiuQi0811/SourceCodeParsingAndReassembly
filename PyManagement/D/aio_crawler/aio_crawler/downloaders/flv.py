# -*- coding: utf-8 -*-
"""HTTP-FLV 下载器。"""
from __future__ import annotations

import logging
from pathlib import Path

from ..models import DownloadResult, ResourceRef
from .base import BaseDownloader

logger = logging.getLogger(__name__)


class FlvDownloader(BaseDownloader):
    """HTTP-FLV：直接流式下载 .flv 文件；失败时回退 ffmpeg 录制。"""

    name = "flv"

    async def download(self, ref: ResourceRef, title: str | None) -> DownloadResult:
        try:
            dest: Path = self.saver.resolve(title, ref.group, "flv")
            if dest.exists() and dest.stat().st_size > 0 and not self.cfg.overwrite:
                return self.result(ref, True, dest, dest.stat().st_size, method="flv-skip")
            size, _ = await self._stream_to(ref.url, dest, ref.referer)
            return self.result(ref, True, dest, size, method="http-flv")
        except Exception as e:
            logger.warning("HTTP-FLV 直链失败 %s: %s，尝试 ffmpeg 录制", ref.url, e)
            return await self._record_ffmpeg(ref, title)

    async def _record_ffmpeg(self, ref: ResourceRef, title: str | None) -> DownloadResult:
        from .merger import ffmpeg_available, ffmpeg_run
        if not ffmpeg_available(self.cfg.ffmpeg_path):
            return self.result(ref, False, error="flv 直链失败且无 ffmpeg", method="flv")
        dest: Path = self.saver.resolve(title, ref.group, "flv")
        headers = f"User-Agent: {self.cfg.user_agent}\r\n"
        if ref.referer:
            headers += f"Referer: {ref.referer}\r\n"
        code, err = await ffmpeg_run(
            self.cfg.ffmpeg_path,
            ["-headers", headers, "-i", ref.url, "-c", "copy", str(dest)],
            timeout=self.cfg.timeout * 5,
        )
        if code != 0 or not dest.exists() or dest.stat().st_size == 0:
            return self.result(ref, False, error=err[-400:], method="flv-ffmpeg")
        return self.result(ref, True, dest, dest.stat().st_size, method="flv-ffmpeg")
