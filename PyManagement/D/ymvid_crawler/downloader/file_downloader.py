"""普通文件下载器"""
from pathlib import Path
import aiofiles


class FileDownloader:
    def __init__(self, fetcher):
        self.fetcher = fetcher

    async def download(self, url: str, save_path: Path,
                       referer: str = "", headers: dict | None = None) -> bool:
        save_path.parent.mkdir(parents=True, exist_ok=True)
        try:
            req_headers = dict(headers or {})
            if referer:
                req_headers["Referer"] = referer
            data = await self.fetcher.fetch_bytes(url, req_headers or None)
            async with aiofiles.open(save_path, "wb") as f:
                await f.write(data)
            return True
        except Exception as e:
            print(f"[文件] 下载失败 {url[:80]} -> {e}")
            return False
