"""
视频站适配器注册表
用法：
    from crawler_framework.adapters import get_adapter
    adapter = get_adapter(play_page_url)
    if adapter:
        m3u8 = await adapter.extract_m3u8(url, session)
"""
from typing import List, Optional, Type
from crawler_framework.adapters.base import VideoSiteAdapter

_REGISTRY: List[Type[VideoSiteAdapter]] = []


def register_adapter(cls: Type[VideoSiteAdapter]) -> Type[VideoSiteAdapter]:
    """类装饰器：注册适配器"""
    _REGISTRY.append(cls)
    return cls


def get_adapter(url: str) -> Optional[VideoSiteAdapter]:
    """按 URL 匹配第一个适用的适配器实例"""
    for cls in _REGISTRY:
        try:
            if cls.match(url):
                return cls()
        except Exception:
            continue
    return None


def list_adapters() -> List[str]:
    return [c.name for c in _REGISTRY]


# 自动导入所有内置适配器（触发 @register_adapter）
from crawler_framework.adapters import xgcartoon  # noqa: E402,F401
