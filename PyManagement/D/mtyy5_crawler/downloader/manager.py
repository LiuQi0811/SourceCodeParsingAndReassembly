# -*- coding: utf-8 -*-
"""流媒体统一下载入口：按 URL 自动分发到 HLS / DASH / ffmpeg"""
import logging
from pathlib import Path
from typing import Optional

import aiohttp

from config import Config
from .hls import HlsDownloader
from .dash import DashDownloader
from .ffmpeg_stream import FfmpegStreamDownloader


class StreamManager:

    def __init__(self, config: Config, session: aiohttp.ClientSession):
        self.config = config
        self.hls = HlsDownloader(config, session)
        self.dash = DashDownloader(config, session)
        self.ffmpeg = FfmpegStreamDownloader(config, session)

    async def download(self, url: str, output_dir: Path, filename: str) -> Optional[str]:
        u = url.lower()
        if ".m3u8" in u:
            return await self.hls.download(url, output_dir, filename)
        if ".mpd" in u:
            return await self.dash.download(url, output_dir, filename)
        if u.startswith(("rtmp://", "rtsp://")) or ".flv" in u:
            return await self.ffmpeg.download(url, output_dir, filename)
        # 未知流类型，兜底当 HLS 处理
        logging.debug(f"未知流类型，尝试 HLS: {url}")
        return await self.hls.download(url, output_dir, filename)