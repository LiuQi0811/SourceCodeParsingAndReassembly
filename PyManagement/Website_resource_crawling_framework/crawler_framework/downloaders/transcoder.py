"""
FFmpeg 转封装工具
TS → MP4（-c copy 不改编码，只换封装，几秒完成）
"""
import os
import shutil
import subprocess
from typing import Optional


def find_ffmpeg() -> Optional[str]:
    """定位系统 ffmpeg，找不到返回 None"""
    return shutil.which("ffmpeg")


def has_ffmpeg() -> bool:
    return find_ffmpeg() is not None


def remux_to_mp4(ts_path: str, mp4_path: Optional[str] = None) -> Optional[str]:
    """
    TS → MP4 转封装（不重编码，快）
    :return: mp4 路径；失败或无 ffmpeg 返回 None
    """
    ffmpeg = find_ffmpeg()
    if not ffmpeg:
        return None
    if not os.path.exists(ts_path):
        return None
    if mp4_path is None:
        mp4_path = os.path.splitext(ts_path)[0] + ".mp4"
    try:
        result = subprocess.run(
            [ffmpeg, "-y", "-i", ts_path, "-c", "copy", "-movflags", "+faststart", mp4_path],
            capture_output=True, timeout=120,
        )
        if result.returncode == 0 and os.path.exists(mp4_path):
            return mp4_path
    except Exception:
        pass
    return None
