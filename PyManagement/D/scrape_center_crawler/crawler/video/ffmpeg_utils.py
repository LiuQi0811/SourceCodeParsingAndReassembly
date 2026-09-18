# -*- coding: utf-8 -*-
"""ffmpeg / ffprobe 异步封装：视频合并、转封装、校验"""
from __future__ import annotations

import asyncio
import logging
import os
import shutil
import subprocess
from typing import List, Optional, Tuple

logger = logging.getLogger("crawler.video.ffmpeg")

FFMPEG = shutil.which("ffmpeg")
FFPROBE = shutil.which("ffprobe")

# Windows 下不弹出控制台窗口
_CREATE_NO_WINDOW = 0x08000000 if os.name == "nt" else 0


def ffmpeg_available() -> bool:
    return FFMPEG is not None


def ffprobe_available() -> bool:
    return FFPROBE is not None


async def run_ffmpeg(
    args: List[str],
    timeout: float = 600.0,
    input_text: Optional[str] = None,
    cwd: Optional[str] = None,
) -> Tuple[int, str, str]:
    """异步执行 ffmpeg；返回 (returncode, stdout, stderr)。cwd 指定工作目录（分片相对路径落盘用）"""
    if FFMPEG is None:
        raise RuntimeError("未找到 ffmpeg，请先安装并加入 PATH（视频合并/转码需要）")
    cmd = [FFMPEG, "-hide_banner", "-y", *args]
    logger.debug("ffmpeg(cwd=%s): %s", cwd, " ".join(cmd))
    try:
        proc = await asyncio.create_subprocess_exec(
            *cmd,
            cwd=cwd,
            stdin=subprocess.PIPE if input_text is not None else None,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            creationflags=_CREATE_NO_WINDOW,
        )
        stdout, stderr = await asyncio.wait_for(
            proc.communicate(input=input_text.encode("utf-8") if input_text is not None else None),
            timeout=timeout,
        )
        return proc.returncode or 0, stdout.decode("utf-8", "replace"), stderr.decode("utf-8", "replace")
    except asyncio.TimeoutError:
        raise TimeoutError(f"ffmpeg 执行超时（>{timeout}s）: {' '.join(args[:6])}...")
    except Exception as exc:
        raise RuntimeError(f"ffmpeg 执行失败: {exc}")


async def ffprobe_duration(path: str) -> Optional[float]:
    """探测媒体时长（秒）；失败返回 None"""
    if FFPROBE is None:
        return None
    try:
        proc = await asyncio.create_subprocess_exec(
            FFPROBE, "-hide_banner", "-v", "error", "-show_entries",
            "format=duration", "-of", "default=noprint_wrappers=1:nokey=1", path,
            stdout=subprocess.PIPE, stderr=subprocess.PIPE,
            creationflags=_CREATE_NO_WINDOW,
        )
        out, _ = await asyncio.wait_for(proc.communicate(), timeout=60)
        text = out.decode("utf-8", "replace").strip()
        return float(text) if text else None
    except Exception:
        return None


async def remux_to_mp4(src: str, dst: str, timeout: float = 600.0) -> bool:
    """快速转封装（不重编码）为 mp4；失败返回 False（保留原文件）"""
    try:
        rc, _, err = await run_ffmpeg(["-i", src, "-c", "copy", "-movflags", "+faststart", dst], timeout=timeout)
        return rc == 0 and os.path.exists(dst) and os.path.getsize(dst) > 0
    except Exception:
        logger.warning("转封装 mp4 失败: %s", err if 'err' in locals() else "")
        return False


async def concat_by_ffmpeg(parts: List[str], dst: str, timeout: float = 600.0) -> bool:
    """用 concat demuxer 合并分片（HLS TS / fMP4 分片均适用），返回是否成功"""
    try:
        lst = "\n".join(f"file '{p.replace(chr(39), chr(39) + chr(92) + chr(39) + chr(39))}'" for p in parts)
        rc, _, err = await run_ffmpeg(
            ["-f", "concat", "-safe", "0", "-protocol_whitelist", "file,pipe,crypto,data",
             "-i", "-", "-c", "copy", dst],
            timeout=timeout, input_text=lst,
        )
        return rc == 0 and os.path.exists(dst) and os.path.getsize(dst) > 0
    except Exception as exc:
        logger.warning("ffmpeg concat 失败: %s", exc)
        return False
