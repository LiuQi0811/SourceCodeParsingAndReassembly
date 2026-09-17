"""DASH (.mpd) 下载器：通过 FFmpeg 直接拉取与合并"""
import asyncio
from pathlib import Path


class DashDownloader:
    def __init__(self, fetcher, concurrency: int = 16):
        self.fetcher = fetcher
        self.sem = asyncio.Semaphore(concurrency)

    async def download(self, mpd_url: str, save_path: Path,
                       referer: str = "", headers: dict | None = None) -> bool:
        save_path.parent.mkdir(parents=True, exist_ok=True)

        cmd = ["ffmpeg", "-y"]
        ff_headers = dict(headers or {})
        if referer:
            ff_headers["Referer"] = referer
        if ff_headers:
            header_block = "".join(f"{k}: {v}\r\n" for k, v in ff_headers.items())
            cmd += ["-headers", header_block]
        cmd += ["-i", mpd_url, "-c", "copy", str(save_path)]

        try:
            proc = await asyncio.create_subprocess_exec(
                *cmd, stdout=asyncio.subprocess.DEVNULL,
                stderr=asyncio.subprocess.PIPE
            )
            _, stderr = await proc.communicate()
            if proc.returncode != 0:
                print(f"[DASH] 合并失败: "
                      f"{stderr.decode(errors='ignore')[:200]}")
            return proc.returncode == 0
        except FileNotFoundError:
            print("[DASH] 未找到 ffmpeg")
            return False
