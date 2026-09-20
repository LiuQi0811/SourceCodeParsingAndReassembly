"""
视频站适配器抽象基类
针对 JS 动态渲染 / API 取流的站点（m3u8 不在静态 HTML 里）
新站点继承 VideoSiteAdapter 并 @register_adapter 即可自动接入
"""
from abc import ABC, abstractmethod
from typing import Optional
import aiohttp


class VideoSiteAdapter(ABC):
    """视频站适配器：从播放页 URL 解析出 m3u8 直链"""

    #: 适配器名（用于日志/调试）
    name: str = "base"

    @classmethod
    @abstractmethod
    def match(cls, url: str) -> bool:
        """判断该适配器是否适用于此播放页 URL"""
        ...

    @abstractmethod
    async def extract_m3u8(
        self,
        url: str,
        session: aiohttp.ClientSession,
    ) -> Optional[str]:
        """
        从播放页 URL 解析出 m3u8 直链
        :return: m3u8 URL；无法解析返回 None
        """
        ...
