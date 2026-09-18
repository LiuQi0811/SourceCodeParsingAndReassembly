# -*- coding: utf-8 -*-
"""组合解析策略：多个解析器同时运行并合并结果（去重）"""
from __future__ import annotations

from typing import Any, Dict, List, Optional

from .base import ExtractedData, ParserStrategy, ResourceRef


class CompositeParser(ParserStrategy):
    """组合多个解析策略：例如 [bs4, xpath] 同时解析，结果取并集"""

    name = "composite"

    def __init__(self, strategies: List[ParserStrategy]) -> None:
        if not strategies:
            raise ValueError("CompositeParser 需要至少一个子解析策略")
        self.strategies = strategies

    def parse(self, text: str, base_url: str, extract: Optional[Dict[str, Any]] = None) -> ExtractedData:
        merged = ExtractedData()
        seen_links, seen_res = set(), set()
        for strat in self.strategies:
            data = strat.parse(text, base_url, extract)
            for u in data.links:
                if u not in seen_links:
                    seen_links.add(u)
                    merged.links.append(u)
            for r in data.resources:
                k = (r.url, r.kind)
                if k not in seen_res:
                    seen_res.add(k)
                    merged.resources.append(r)
            if data.title and not merged.title:
                merged.title = data.title
            for k, v in data.fields.items():
                merged.fields.setdefault(k, v)
        return merged

    def extract_text(self, text: str, rule: Dict[str, Any]) -> Optional[str]:
        for strat in self.strategies:
            v = strat.extract_text(text, rule)
            if v:
                return v
        return None
