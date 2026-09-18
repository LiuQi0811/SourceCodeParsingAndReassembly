# -*- coding: utf-8 -*-
"""RTMP / RTSP / HTTP-FLV 直接调用 ffmpeg 录制"""
import asyncio
import logging
from pathlib import Path
from typing import Optional

from .base import BaseDownloader


class FfmpegStreamDownloader(BaseDownloader):

    def __init__(self, config, session, timeout: int = 1800):
        super().__init__(config, session)
        self.timeout = timeout

    async def download(self, url: str, output_dir: Path, filename: str) -> Optional[str]:
        output_path = output_dir / f"{filename}.mp4"
        output_path.parent.mkdir(parents=True, exist_ok=True)
        try:
            proc = await asyncio.create_subprocess_exec(
                "ffmpeg", "-y", "-loglevel", "error", "-i", url,
                "-c", "copy", "-bsf:a", "aac_adtstoasc", str(output_path),
                stdout=asyncio.subprocess.DEVNULL,
                stderr=asyncio.subprocess.PIPE,
            )
            try:
                _, err = await asyncio.wait_for(proc.communicate(), timeout=self.timeout)
            except asyncio.TimeoutError:
                proc.kill()
                logging.warning(f"流录制超时: {url}")
                return None
            if proc.returncode == 0 and output_path.exists():
                logging.info(f"流录制完成: {output_path}")
                return str(output_path)
            logging.error(f"ffmpeg 录制失败: {err.decode('utf-8', 'ignore')[:200]}")
        except FileNotFoundError:
            logging.error("未找到 ffmpeg")
        return None