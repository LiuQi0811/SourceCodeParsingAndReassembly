"""
yt-dlp 适配器
匹配抖音/快手/B站/YouTube 等强反爬站，委托 yt-dlp 提取播放地址
"""
from typing import Optional
import aiohttp
from crawler_framework.adapters.base import VideoSiteAdapter
from crawler_framework.adapters import register_adapter
from crawler_framework.downloaders.ytdlp_downloader import YtDlpDownloader


@register_adapter
class YtDlpAdapter(VideoSiteAdapter):
    """yt-dlp 通用适配器：覆盖 1000+ 站点"""

    name = "ytdlp"

    @classmethod
    def match(cls, url: str) -> bool:
        return YtDlpDownloader.match(url)

    async def extract_m3u8(
        self,
        url: str,
        session: aiohttp.ClientSession,
    ) -> Optional[str]:
        """用 yt-dlp 解析出播放直链（可能是 m3u8 或 mp4）"""
        info = await YtDlpDownloader.extract_info(url)
        if not info.get("success"):
            return None
        # yt-dlp extract_info 不直接返回 url，需要进一步取 formats
        try:
            import yt_dlp
            opts = {"quiet": True, "no_warnings": True}
            with yt_dlp.YoutubeDL(opts) as ydl:
                data = ydl.extract_info(url, download=False)
                formats = data.get("formats") or []
                # 优先选 mp4
                for f in reversed(formats):
                    if f.get("ext") == "mp4" and f.get("url"):
                        return f["url"]
                for f in reversed(formats):
                    if f.get("url"):
                        return f["url"]
        except Exception:
            pass
        return None
