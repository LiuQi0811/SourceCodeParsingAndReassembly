# -*- coding: utf-8 -*-
"""ffmpeg 封装：探测可用性、转封装、音视频混流。"""
from __future__ import annotations

import asyncio
import logging
import os
import shutil
import subprocess
from pathlib import Path

logger = logging.getLogger(__name__)


def ffmpeg_available(ffmpeg: str) -> bool:
    try:
        return shutil.which(ffmpeg) is not None
    except Exception:
        return False


def _flags() -> int:
    if os.name == "nt":
        return subprocess.CREATE_NO_WINDOW  # type: ignore[attr-defined]
    return 0


async def ffmpeg_run(ffmpeg: str, args: list[str], timeout: float = 600) -> tuple[int, str]:
    """异步运行 ffmpeg，返回 (returncode, stderr)。"""
    try:
        proc = await asyncio.create_subprocess_exec(
            ffmpeg, "-hide_banner", "-y", *args,
            stdout=subprocess.DEVNULL, stderr=subprocess.PIPE,
            creationflags=_flags(),
        )
        _, stderr = await asyncio.wait_for(proc.communicate(), timeout=timeout)
        return proc.returncode or 0, stderr.decode("utf-8", errors="replace")
    except asyncio.TimeoutError:
        return -1, "ffmpeg timeout"
    except FileNotFoundError:
        return -1, f"ffmpeg not found: {ffmpeg}"


async def remux(src: Path, dst: Path, ffmpeg: str = "ffmpeg", timeout: float = 600) -> tuple[bool, str]:
    """流拷贝转封装（如 .ts -> .mp4）。"""
    code, err = await ffmpeg_run(
        ffmpeg, ["-i", str(src), "-c", "copy", "-movflags", "+faststart", str(dst)], timeout
    )
    ok = code == 0 and dst.exists() and dst.stat().st_size > 0
    return ok, err


async def mux_av(video: Path, audio: Path | None, dst: Path,
                 ffmpeg: str = "ffmpeg", timeout: float = 600) -> tuple[bool, str]:
    """音视频混流为 mp4。audio 为 None 时仅视频转封装。"""
    args = ["-i", str(video)]
    if audio is not None:
        args += ["-i", str(audio)]
    args += ["-c", "copy", "-movflags", "+faststart", str(dst)]
    code, err = await ffmpeg_run(ffmpeg, args, timeout)
    ok = code == 0 and dst.exists() and dst.stat().st_size > 0
    return ok, err


async def ffprobe_duration(ffprobe: str, path: Path) -> float:
    """探测媒体时长（秒）；失败返回 -1。"""
    try:
        proc = await asyncio.create_subprocess_exec(
            ffprobe, "-v", "error", "-show_entries", "format=duration",
            "-of", "default=noprint_wrappers=1:nokey=1", str(path),
            stdout=subprocess.PIPE, stderr=subprocess.PIPE, creationflags=_flags(),
        )
        out, _ = await asyncio.wait_for(proc.communicate(), timeout=60)
        text = out.decode("utf-8", errors="replace").strip()
        return float(text) if text else -1.0
    except Exception:
        return -1.0
