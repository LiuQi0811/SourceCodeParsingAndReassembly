# -*- coding: utf-8 -*-
"""BeautifulSoup（bs4）解析策略：默认全量提取 a/img/video/audio，支持 css 选择器规则"""
from __future__ import annotations

from typing import Any, Dict, List, Optional

from bs4 import BeautifulSoup

from .base import DEFAULT_LINK_TAGS, DEFAULT_RESOURCE_TAGS, ExtractedData, ParserStrategy, ResourceRef


class BS4Parser(ParserStrategy):
    """基于 BeautifulSoup + CSS 选择器的解析策略"""

    name = "bs4"

    def _soup(self, text: str) -> BeautifulSoup:
        return BeautifulSoup(text or "", "html.parser")

    def _extract_by_rule(self, soup: BeautifulSoup, rule: Dict[str, Any]) -> List[str]:
        if "css" in rule:
            attr = rule.get("attr", "text")
            values: List[str] = []
            for node in soup.select(rule["css"]):
                if attr == "text":
                    v = node.get_text(" ", strip=True)
                else:
                    v = node.get(attr)
                    if not v and attr in ("src", "href"):
                        # src/href 属性回退：兼容 <video src>、<a href> 混合选择器
                        v = node.get("src") or node.get("href") or node.get("data-src")
                if v:
                    values.append(str(v).strip())
            return values
        if "regex" in rule:
            import re
            return re.findall(rule["regex"], str(soup))
        return []

    def parse(self, text: str, base_url: str, extract: Optional[Dict[str, Any]] = None) -> ExtractedData:
        soup = self._soup(text)
        rules = extract or {}
        data = ExtractedData()

        # 标题
        title_node = soup.find("title")
        if title_node and title_node.get_text(strip=True):
            data.title = title_node.get_text(strip=True)
        h1 = soup.find("h1")
        if h1 and h1.get_text(strip=True) and not data.title:
            data.title = h1.get_text(strip=True)

        # 链接
        link_rule = rules.get("links") or DEFAULT_LINK_TAGS
        if link_rule:
            for u in self._extract_by_rule(soup, link_rule):
                joined = self._safe_join(u, base_url)
                if joined:
                    data.links.append(joined)

        # 资源（默认：img / video / audio）
        type_map = {"images": "image", "videos": "video", "audios": "audio",
                    "documents": "document", "archives": "archive", "custom": ""}
        for key, kind in type_map.items():
            rule = rules.get(key)
            if rule is None:
                rule = DEFAULT_RESOURCE_TAGS.get(kind)
            if not rule:
                continue
            for u in self._extract_by_rule(soup, rule):
                joined = self._safe_join(u, base_url)
                if joined:
                    data.resources.append(ResourceRef(url=joined, kind=kind or "custom", referer=base_url))

        # 结构化字段
        for fname, frule in (rules.get("fields") or {}).items():
            vals = self._extract_by_rule(soup, frule if isinstance(frule, dict) else {"css": str(frule), "attr": "text"})
            data.fields[fname] = vals[0] if len(vals) == 1 else vals
        return data

    def extract_text(self, text: str, rule: Dict[str, Any]) -> Optional[str]:
        soup = self._soup(text)
        if "css" not in rule:
            return None
        node = soup.select_one(rule["css"])
        if node is None:
            return None
        attr = rule.get("attr", "text")
        if attr == "text":
            return node.get_text(" ", strip=True)
        return str(node.get(attr) or "").strip() or None
