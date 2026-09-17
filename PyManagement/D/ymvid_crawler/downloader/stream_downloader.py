"""RTMP / RTSP / HTTP-FLV / WebRTC 流录制"""
import asyncio
from pathlib import Path


class StreamDownloader:
    async def download(self, stream_url: str, save_path: Path,
                       protocol: str = "rtmp", duration: int = 0,
                       headers: dict | None = None) -> bool:
        save_path.parent.mkdir(parents=True, exist_ok=True)

        cmd = ["ffmpeg", "-y"]
        if protocol == "rtsp":
            cmd += ["-rtsp_transport", "tcp"]
        elif protocol in ("flv", "rtmp"):
            cmd += ["-f", "flv"]
        # HTTP-FLV 等基于 HTTP 的协议可携带自定义请求头
        if protocol == "flv" and headers:
            header_block = "".join(f"{k}: {v}\r\n" for k, v in headers.items())
            cmd += ["-headers", header_block]
        # webrtc 目前只能让 FFmpeg 尝试自动识别

        cmd += ["-i", stream_url]
        if duration > 0:
            cmd += ["-t", str(duration)]
        cmd += ["-c", "copy", str(save_path)]

        try:
            proc = await asyncio.create_subprocess_exec(
                *cmd, stdout=asyncio.subprocess.DEVNULL,
                stderr=asyncio.subprocess.PIPE
            )
            _, stderr = await proc.communicate()
            if proc.returncode == 0:
                return True

            # copy 失败 → 重新编码
            cmd2 = ["ffmpeg", "-y", "-i", stream_url]
            if duration > 0:
                cmd2 += ["-t", str(duration)]
            cmd2 += ["-c:v", "libx264", "-c:a", "aac",
                     "-preset", "fast", str(save_path)]
            proc2 = await asyncio.create_subprocess_exec(
                *cmd2, stdout=asyncio.subprocess.DEVNULL,
                stderr=asyncio.subprocess.PIPE
            )
            _, stderr2 = await proc2.communicate()
            if proc2.returncode != 0:
                print(f"[Stream] 录制失败: "
                      f"{stderr2.decode(errors='ignore')[:200]}")
            return proc2.returncode == 0
        except FileNotFoundError:
            print("[Stream] 未找到 ffmpeg")
            return False
