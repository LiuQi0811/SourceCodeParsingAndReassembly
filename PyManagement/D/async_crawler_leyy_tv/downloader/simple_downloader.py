# downloader/simple_downloader.py
from __future__ import annotations

from pathlib import Path

import aiofiles
import aiohttp

from .base import DownloadStrategy


class SimpleDownloader(DownloadStrategy):
    """通用文件下载器（图片、文档、音频、普通视频文件）"""

    def can_handle(self, url: str, content_type: str = "") -> bool:
        return True  # 兜底

    async def download(
        self,
        url: str,
        save_path: Path,
        session: aiohttp.ClientSession | None = None,
        **kwargs,
    ) -> bool:
        own_session = session is None
        if own_session:
            session = aiohttp.ClientSession()

        try:
            save_path.parent.mkdir(parents=True, exist_ok=True)
            headers = kwargs.get("headers") or {}
            timeout = kwargs.get("timeout", 300)

            async with session.get(
                url, headers=headers,
                timeout=aiohttp.ClientTimeout(total=timeout),
            ) as resp:
                if resp.status != 200:
                    return False
                async with aiofiles.open(save_path, "wb") as f:
                    async for chunk in resp.content.iter_chunked(1 << 16):
                        await f.write(chunk)
            return True
        except Exception:
            return False
        finally:
            if own_session:
                await session.close()