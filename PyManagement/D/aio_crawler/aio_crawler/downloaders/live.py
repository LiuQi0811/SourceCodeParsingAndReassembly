# -*- coding: utf-8 -*-
"""RTMP / RTSP / WebRTC 直播流录制（基于 ffmpeg）。

仅用于用户拥有权利或已获授权的内容。录制定时长度由 live_record_seconds 控制。
"""
from __future__ import annotations

import logging
from pathlib import Path

from ..models import DownloadResult, ResourceRef
from .base import BaseDownloader
from .merger import ffmpeg_available, ffmpeg_run

logger = logging.getLogger(__name__)

_EXT_BY_SCHEME = {
    "rtmp": "flv",
    "rtmps": "flv",
    "rtsp": "mkv",
    "webrtc": "mkv",
    "http": "flv",
    "https": "flv",
}


class LiveDownloader(BaseDownloader):
    """RTMP / RTSP / WebRTC 流录制器。

    - rtsp: 加 -rtsp_transport tcp
    - webrtc: 需要 ffmpeg 构建支持（部分构建不支持）
    - 通过 -t 限制录制时长，避免无限录制
    """

    name = "live"

    def __init__(self, *a, record_seconds: float = 60.0, **kw) -> None:
        super().__init__(*a, **kw)
        self.record_seconds = record_seconds

    async def download(self, ref: ResourceRef, title: str | None) -> DownloadResult:
        if not ffmpeg_available(self.cfg.ffmpeg_path):
            return self.result(ref, False, error="录制直播流需要 ffmpeg", method="live")

        from urllib.parse import urlsplit
        scheme = (urlsplit(ref.url).scheme or "http").lower()
        ext = _EXT_BY_SCHEME.get(scheme, "mkv")
        dest: Path = self.saver.resolve(title, ref.group, ext)
        if dest.exists() and dest.stat().st_size > 0 and not self.cfg.overwrite:
            return self.result(ref, True, dest, dest.stat().st_size, method="live-skip")

        args = []
        if scheme in ("rtsp", "rtsps"):
            args += ["-rtsp_transport", "tcp"]
        if scheme in ("rtmp", "rtmps"):
            args += ["-rtmp_live", "live"]
        args += ["-i", ref.url, "-t", str(int(self.record_seconds)),
                 "-c", "copy", "-f", ext, str(dest)]
        code, err = await ffmpeg_run(self.cfg.ffmpeg_path, args, timeout=self.cfg.timeout * 10)
        if code != 0 or not dest.exists() or dest.stat().st_size == 0:
            return self.result(ref, False, error=err[-400:], method="live")
        return self.result(ref, True, dest, dest.stat().st_size, method="live-ffmpeg")
