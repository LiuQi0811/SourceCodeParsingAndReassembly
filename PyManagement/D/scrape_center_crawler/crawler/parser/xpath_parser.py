# -*- coding: utf-8 -*-
"""XPath(lxml) 解析策略：默认全量提取，支持 xpath 规则"""
from __future__ import annotations

from typing import Any, Dict, List, Optional

from lxml import etree, html

from .base import DEFAULT_LINK_TAGS, DEFAULT_RESOURCE_TAGS, ExtractedData, ParserStrategy, ResourceRef

_DEFAULT_LINKS_XPATH = "//a/@href"
_DEFAULT_RESOURCE_XPATH = {
    "image": "//img/@src | //source[contains(@type,'image')]/@src",
    "video": ("//video/@src | //video/source/@src | //source[contains(@type,'video')]/@src "
              "| //a[contains(@href,'.m3u8')]/@href | //a[contains(@href,'.mpd')]/@href "
              "| //a[contains(@href,'.mp4')]/@href | //a[contains(@href,'.flv')]/@href"),
    "audio": ("//audio/@src | //audio/source/@src | //a[contains(@href,'.mp3')]/@href "
              "| //a[contains(@href,'.wav')]/@href | //a[contains(@href,'.m4a')]/@href"),
}


class XPathParser(ParserStrategy):
    """基于 lxml XPath 的解析策略"""

    name = "xpath"

    def _tree(self, text: str):
        return html.fromstring(text or "")

    def _extract_by_rule(self, tree, rule: Dict[str, Any]) -> List[str]:
        if "xpath" not in rule:
            return []
        try:
            nodes = tree.xpath(rule["xpath"])
        except Exception:
            return []
        values: List[str] = []
        for node in nodes:
            if isinstance(node, str):
                values.append(node.strip())
            elif hasattr(node, "text_content"):
                values.append(node.text_content().strip())
            elif node.text:
                values.append(node.text.strip())
        return [v for v in values if v]

    def parse(self, text: str, base_url: str, extract: Optional[Dict[str, Any]] = None) -> ExtractedData:
        try:
            tree = self._tree(text)
        except Exception:
            return ExtractedData()
        rules = extract or {}
        data = ExtractedData()

        titles = self._extract_by_rule(tree, {"xpath": "//title/text()"})
        if titles:
            data.title = titles[0]
        else:
            h1 = self._extract_by_rule(tree, {"xpath": "//h1/text()"})
            if h1:
                data.title = h1[0]

        link_rule = rules.get("links") or {"xpath": _DEFAULT_LINKS_XPATH}
        for u in self._extract_by_rule(tree, link_rule):
            joined = self._safe_join(u, base_url)
            if joined:
                data.links.append(joined)

        type_map = {"images": "image", "videos": "video", "audios": "audio",
                    "documents": "document", "archives": "archive", "custom": ""}
        for key, kind in type_map.items():
            rule = rules.get(key)
            if rule is None:
                rule = {"xpath": _DEFAULT_RESOURCE_XPATH[kind]} if kind in _DEFAULT_RESOURCE_XPATH else None
            if not rule:
                continue
            for u in self._extract_by_rule(tree, rule):
                joined = self._safe_join(u, base_url)
                if joined:
                    data.resources.append(ResourceRef(url=joined, kind=kind or "custom", referer=base_url))

        for fname, frule in (rules.get("fields") or {}).items():
            vals = self._extract_by_rule(tree, frule if isinstance(frule, dict) else {"xpath": str(frule)})
            data.fields[fname] = vals[0] if len(vals) == 1 else vals
        return data

    def extract_text(self, text: str, rule: Dict[str, Any]) -> Optional[str]:
        if "xpath" not in rule:
            return None
        try:
            tree = self._tree(text)
            vals = self._extract_by_rule(tree, rule)
            return vals[0] if vals else None
        except Exception:
            return None
