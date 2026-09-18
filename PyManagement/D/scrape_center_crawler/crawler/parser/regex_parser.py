# -*- coding: utf-8 -*-
"""正则解析策略：用 re 正则提取链接/资源，适合强规则场景"""
from __future__ import annotations

import re
from typing import Any, Dict, List, Optional

from .base import DEFAULT_LINK_TAGS, DEFAULT_RESOURCE_TAGS, ExtractedData, ParserStrategy, ResourceRef

_DEFAULT_LINK_RE = r"""href\s*=\s*["']([^"']+)["']"""
_DEFAULT_RESOURCE_RE = {
    "image": r"""<(?:img|source)[^>]+src\s*=\s*["']([^"']+)["']""",
    "video": r"""<(?:video|source)[^>]+src\s*=\s*["']([^"']+)["']|href\s*=\s*["']([^"']+\.(?:m3u8|mpd|mp4|flv|ts))["']""",
    "audio": r"""<(?:audio|source)[^>]+src\s*=\s*["']([^"']+)["']|href\s*=\s*["']([^"']+\.(?:mp3|wav|m4a|aac|flac))["']""",
}


class RegexParser(ParserStrategy):
    """基于 re 正则的解析策略"""

    name = "regex"

    def _extract_by_rule(self, text: str, rule: Dict[str, Any]) -> List[str]:
        if "regex" not in rule or not rule.get("regex"):
            return []
        try:
            return [m for m in re.findall(rule["regex"], text or "", re.I | re.S)]
        except re.error:
            return []

    def parse(self, text: str, base_url: str, extract: Optional[Dict[str, Any]] = None) -> ExtractedData:
        text = text or ""
        rules = extract or {}
        data = ExtractedData()

        m = re.search(r"<title[^>]*>(.*?)</title>", text, re.I | re.S)
        if m:
            data.title = re.sub(r"<[^>]+>", "", m.group(1)).strip()
        if not data.title:
            m = re.search(r"<h1[^>]*>(.*?)</h1>", text, re.I | re.S)
            if m:
                data.title = re.sub(r"<[^>]+>", "", m.group(1)).strip()

        link_rule = rules.get("links") or {"regex": _DEFAULT_LINK_RE}
        for u in self._extract_by_rule(text, link_rule):
            joined = self._safe_join(u, base_url)
            if joined:
                data.links.append(joined)

        type_map = {"images": "image", "videos": "video", "audios": "audio",
                    "documents": "document", "archives": "archive", "custom": ""}
        for key, kind in type_map.items():
            rule = rules.get(key)
            if rule is None:
                rule = {"regex": _DEFAULT_RESOURCE_RE[kind]} if kind in _DEFAULT_RESOURCE_RE else None
            if not rule:
                continue
            for u in self._extract_by_rule(text, rule):
                if isinstance(u, tuple):  # 多捕获组场景取第一个非空
                    u = next((x for x in u if x), "")
                joined = self._safe_join(u, base_url)
                if joined:
                    data.resources.append(ResourceRef(url=joined, kind=kind or "custom", referer=base_url))

        for fname, frule in (rules.get("fields") or {}).items():
            vals = self._extract_by_rule(text, frule if isinstance(frule, dict) else {"regex": str(frule)})
            data.fields[fname] = vals[0] if len(vals) == 1 else vals
        return data

    def extract_text(self, text: str, rule: Dict[str, Any]) -> Optional[str]:
        if "regex" not in rule:
            return None
        try:
            m = re.search(rule["regex"], text or "", re.I | re.S)
            return m.group(1) if m and m.groups() else (m.group(0) if m else None)
        except (re.error, IndexError):
            return None
