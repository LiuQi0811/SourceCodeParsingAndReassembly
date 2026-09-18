"""解析器策略抽象基类与工厂注册表。"""

from __future__ import annotations

from abc import ABC, abstractmethod
from typing import Any, Dict, List, Optional
from urllib.parse import urljoin, urlparse

from core.models import ParseResult, ResourceItem, ResourceKind

# 常见资源扩展名 → 类型（用于链接级识别）
_RESOURCE_EXT_MAP = {
    ".jpg": ResourceKind.IMAGE, ".jpeg": ResourceKind.IMAGE, ".png": ResourceKind.IMAGE,
    ".gif": ResourceKind.IMAGE, ".webp": ResourceKind.IMAGE, ".bmp": ResourceKind.IMAGE,
    ".svg": ResourceKind.IMAGE, ".ico": ResourceKind.IMAGE,
    ".mp4": ResourceKind.VIDEO, ".mkv": ResourceKind.VIDEO, ".avi": ResourceKind.VIDEO,
    ".mov": ResourceKind.VIDEO, ".flv": ResourceKind.VIDEO, ".wmv": ResourceKind.VIDEO,
    ".webm": ResourceKind.VIDEO, ".ts": ResourceKind.VIDEO, ".m3u8": ResourceKind.VIDEO,
    ".mpd": ResourceKind.VIDEO, ".rmvb": ResourceKind.VIDEO,
    ".mp3": ResourceKind.AUDIO, ".wav": ResourceKind.AUDIO, ".aac": ResourceKind.AUDIO,
    ".flac": ResourceKind.AUDIO, ".ogg": ResourceKind.AUDIO, ".m4a": ResourceKind.AUDIO,
    ".pdf": ResourceKind.DOC, ".doc": ResourceKind.DOC, ".docx": ResourceKind.DOC,
    ".ppt": ResourceKind.DOC, ".pptx": ResourceKind.DOC, ".xls": ResourceKind.DOC,
    ".xlsx": ResourceKind.DOC, ".txt": ResourceKind.DOC, ".md": ResourceKind.DOC,
    ".zip": ResourceKind.ARCHIVE, ".rar": ResourceKind.ARCHIVE, ".7z": ResourceKind.ARCHIVE,
    ".tar": ResourceKind.ARCHIVE, ".gz": ResourceKind.ARCHIVE,
    ".py": ResourceKind.CODE, ".js": ResourceKind.CODE, ".css": ResourceKind.CODE,
    ".json": ResourceKind.DATA, ".csv": ResourceKind.DATA, ".xml": ResourceKind.DATA,
    ".html": ResourceKind.PAGE, ".htm": ResourceKind.PAGE,
}


def kind_from_url(url: str) -> ResourceKind:
    """按 URL 扩展名推断资源类型（用于链接级识别）。"""
    path = urlparse(url).path.lower()
    for ext, kind in _RESOURCE_EXT_MAP.items():
        if path.endswith(ext):
            return kind
    return ResourceKind.OTHER


def resolve_url(base: str, href: str) -> str:
    """补全相对 URL，过滤 javascript:/mailto:/data: 等伪链接。"""
    href = (href or "").strip()
    if not href or href.startswith(("javascript:", "mailto:", "tel:", "data:")):
        return ""
    if href.startswith("#"):
        return ""
    full = urljoin(base, href)
    if not full.startswith(("http://", "https://")):
        return ""
    return full.split("#")[0]


class ParserStrategy(ABC):
    """解析器策略接口。"""

    name: str = "base"

    def __init__(self, config: Optional[Dict[str, Any]] = None) -> None:
        self.config: Dict[str, Any] = config or {}

    @abstractmethod
    def parse(self, html: str, url: str = "", **kwargs: Any) -> ParseResult:
        """解析 HTML 文本，返回统一 ParseResult。"""

    def _finish(self, result: ParseResult, url: str) -> ParseResult:
        """去重并补全相对链接。"""
        seen_links: set = set()
        cleaned: List[str] = []
        for link in result.links:
            full = resolve_url(url, link)
            if full and full not in seen_links:
                seen_links.add(full)
                cleaned.append(full)
        result.links = cleaned
        return result


class ParserFactoryRegistry:
    """解析器工厂注册表（工厂模式）。"""

    _registry: Dict[str, type] = {}

    @classmethod
    def register(cls, name: str, parser_cls: type) -> None:
        cls._registry[name] = parser_cls

    @classmethod
    def create(cls, name: str, config: Optional[Dict[str, Any]] = None) -> ParserStrategy:
        if name not in cls._registry:
            raise ValueError(f"未知解析器: {name}，可用: {list(cls._registry)}")
        return cls._registry[name](config)
