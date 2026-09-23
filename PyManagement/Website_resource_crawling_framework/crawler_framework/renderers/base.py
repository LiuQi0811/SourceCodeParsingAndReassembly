"""
渲染器抽象基类
针对 SPA / JS 动态渲染站（HTML 是空壳，内容靠 JS 渲染）
新渲染器继承 BaseRenderer 并 @register_renderer 即可
"""
from abc import ABC, abstractmethod
from typing import Optional


class BaseRenderer(ABC):
    """页面渲染器：打开 URL，等 JS 渲染完，返回最终 HTML"""

    name: str = "base"

    @classmethod
    @abstractmethod
    def is_available(cls) -> bool:
        """渲染器是否可用（依赖是否装了）"""
        ...

    @abstractmethod
    async def render(self, url: str, wait_ms: int = 2000) -> Optional[str]:
        """
        渲染页面，返回渲染后的 HTML
        :return: 渲染后 HTML；失败返回 None
        """
        ...

    @abstractmethod
    async def close(self) -> None:
        """释放浏览器资源"""
        ...
