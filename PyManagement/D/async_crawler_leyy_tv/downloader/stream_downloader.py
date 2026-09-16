# downloader/stream_downloader.py
from __future__ import annotations

import asyncio
import logging
from pathlib import Path

from .base import DownloadStrategy

logger = logging.getLogger("Stream")


class FFmpegStreamDownloader(DownloadStrategy):
    """HTTP-FLV / RTMP / RTSP 下载器（依赖 ffmpeg 拉流）"""

    def can_handle(self, url: str, content_type: str = "") -> bool:
        if url.startswith(("rtmp://", "rtmps://", "rtsp://", "rtsps://")):
            return True
        if url.endswith(".flv"):
            return True
        if "flv" in content_type:
            return True
        return False

    async def download(
        self,
        url: str,
        save_path: Path,
        session=None,
        **kwargs,
    ) -> bool:
        save_path.parent.mkdir(parents=True, exist_ok=True)
        timeout = kwargs.get("timeout", 3600)

        try:
            proc = await asyncio.create_subprocess_exec(
                "ffmpeg", "-y",
                "-i", url,
                "-c", "copy",
                "-t", str(timeout),
                str(save_path),
                stdout=asyncio.subprocess.DEVNULL,
                stderr=asyncio.subprocess.PIPE,
            )
            _, stderr = await proc.communicate()
            if proc.returncode != 0:
                logger.error(
                    f"ffmpeg 拉流失败 {url}: "
                    f"{stderr.decode(errors='ignore')[-300:]}"
                )
                return False
            return True
        except FileNotFoundError:
            logger.error("未找到 ffmpeg，请先安装")
            return False
        except Exception as e:
            logger.error(f"流下载异常 {url}: {e!r}")
            return False


class WebRTCDownloader(DownloadStrategy):
    """
    WebRTC 下载器（基于 aiortc）。

    说明：WebRTC 拉流依赖信令协议（SDP 交换），
    不同服务端实现差异较大。此处仅提供基类骨架，
    具体信令逻辑需按目标服务端协议实现。
    """

    def can_handle(self, url: str, content_type: str = "") -> bool:
        return "webrtc" in url.lower() or "webrtc" in content_type.lower()

    async def download(
        self,
        url: str,
        save_path: Path,
        session=None,
        **kwargs,
    ) -> bool:
        try:
            import aiortc  # noqa: F401
        except ImportError:
            logger.error("WebRTC 需安装 aiortc: pip install aiortc")
            return False

        logger.warning("WebRTC 下载需按具体信令协议实现，当前为占位")
        return False