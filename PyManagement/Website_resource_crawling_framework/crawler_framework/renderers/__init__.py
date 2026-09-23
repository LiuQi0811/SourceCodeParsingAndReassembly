"""
渲染器注册表
用法：
    from crawler_framework.renderers import get_renderer
    r = get_renderer("playwright")
    html = await r.render(url)
"""
from typing import List, Optional, Type
from crawler_framework.renderers.base import BaseRenderer

_REGISTRY: List[Type[BaseRenderer]] = []


def register_renderer(cls: Type[BaseRenderer]) -> Type[BaseRenderer]:
    _REGISTRY.append(cls)
    return cls


def get_renderer(name: str = "playwright") -> Optional[BaseRenderer]:
    for cls in _REGISTRY:
        if cls.name == name and cls.is_available():
            return cls()
    return None


def list_renderers() -> List[str]:
    return [c.name for c in _REGISTRY if c.is_available()]


from crawler_framework.renderers import playwright  # noqa: E402,F401
