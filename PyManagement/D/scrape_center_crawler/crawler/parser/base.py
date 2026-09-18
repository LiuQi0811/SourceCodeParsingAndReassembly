# -*- coding: utf-8 -*-
"""
解析器策略抽象基类（策略模式）
提供三种可切换/可组合的实现：bs4、xpath(lxml)、regex；全局与单任务均可配置。
"""
from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional

from ..utils import normalize_url


@dataclass
class ResourceRef:
    """从页面提取到的一个资源引用"""

    url: str
    kind: str = ""          # 资源类型提示（image/video/...，空则由分类器判定）
    referer: str = ""


@dataclass
class ExtractedData:
    """一次解析的结果"""

    links: List[str] = field(default_factory=list)
    resources: List[ResourceRef] = field(default_factory=list)
    fields: Dict[str, Any] = field(default_factory=dict)
    title: str = ""


# 每个资源类型的默认提取方式（按策略不同）
DEFAULT_LINK_TAGS = {"css": "a[href]", "attr": "href"}
DEFAULT_RESOURCE_TAGS = {
    "image": {"css": "img[src], source[type^=image][src]", "attr": "src"},
    "video": {"css": "video[src], source[src], video source[src], a[href$='.m3u8'], a[href$='.mpd'], a[href$='.mp4'], a[href$='.flv']", "attr": "href"},
    "audio": {"css": "audio[src], audio source[src], a[href$='.mp3'], a[href$='.wav'], a[href$='.m4a']", "attr": "href"},
}


def normalize_rules(extract: Optional[Dict[str, Any]]) -> Dict[str, Dict[str, Any]]:
    """规范化提取规则：补齐缺失的 links/resources 默认项"""
    if not extract:
        return {}
    rules: Dict[str, Dict[str, Any]] = {}
    for key in ("links", "images", "videos", "audios", "documents", "archives", "custom"):
        if key in extract:
            rules[key] = extract[key] if isinstance(extract[key], dict) else {"regex": str(extract[key])}
    return rules


class ParserStrategy(ABC):
    """解析策略抽象基类"""

    name: str = "base"

    @abstractmethod
    def parse(self, text: str, base_url: str, extract: Optional[Dict[str, Any]] = None) -> ExtractedData:
        """解析文本：提取链接、资源、标题与结构化字段"""

    @abstractmethod
    def extract_text(self, text: str, rule: Dict[str, Any]) -> Optional[str]:
        """按规则提取单个文本（用于标题/字段提取）"""

    def _safe_join(self, url: str, base_url: str) -> Optional[str]:
        return normalize_url(url, base_url)
