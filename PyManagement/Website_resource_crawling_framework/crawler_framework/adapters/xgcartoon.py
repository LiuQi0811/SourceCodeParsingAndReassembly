"""
西瓜卡通 (xgcartoon / cnxgct) 适配器
链路：播放页 URL → /user/amp/content_pframe_url API → player.htm?vid=xxx → bzcdn.net/{vid}/playlist.m3u8
"""
import re
from typing import Optional
import aiohttp
from crawler_framework.adapters.base import VideoSiteAdapter
from crawler_framework.adapters import register_adapter


@register_adapter
class XgcartoonAdapter(VideoSiteAdapter):
    """西瓜卡通站：m3u8 不在静态 HTML，需调 API 取 vid"""

    name = "xgcartoon"

    @classmethod
    def match(cls, url: str) -> bool:
        return ("cnxgct.com/video/" in url) or ("xgcartoon.com" in url and "/video/" in url)

    async def extract_m3u8(
        self,
        url: str,
        session: aiohttp.ClientSession,
    ) -> Optional[str]:
        # 1. 从播放页 URL 提取 chapter_id: /video/{slug}/{chapter_id}.html
        m = re.search(r"/video/[^/]+/([^./?#]+)\.html", url)
        if not m:
            return None
        chapter_id = m.group(1)

        # 2. 调 API 拿 player.htm?vid=xxx
        api = (
            "https://www.cnxgct.com/user/amp/content_pframe_url"
            f"?chapter_id={chapter_id}&level=low&expires=3600"
        )
        try:
            async with session.get(api, headers={"Referer": url}, timeout=aiohttp.ClientTimeout(total=10)) as resp:
                if resp.status != 200:
                    return None
                data = await resp.json(content_type=None)
        except Exception:
            return None

        player_url = (data or {}).get("data", "")
        if not player_url:
            return None

        # 3. 从 player.htm?vid=xxx 提取 vid，拼 m3u8
        vid_m = re.search(r"vid=([0-9a-fA-F-]{36})", player_url)
        if not vid_m:
            return None
        vid = vid_m.group(1)
        return f"https://xgct-video.bzcdn.net/{vid}/playlist.m3u8"
