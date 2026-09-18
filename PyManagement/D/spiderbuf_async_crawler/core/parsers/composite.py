"""组合解析器：按顺序执行多个解析策略并合并结果。"""

from __future__ import annotations

from typing import Any, Dict, List

from core.models import ParseResult, ResourceItem
from core.parsers.base import ParserStrategy


class CompositeParser(ParserStrategy):
    """组合多个解析器（策略组合）。

    config 键：
    - parsers: list 子解析器规格，每个元素为
      {"name": "bs4"|"xpath"|"re", "config": {...}}（config 可选）
    子解析器按顺序执行，links/resources 合并去重，data 深合并。
    """

    name = "composite"

    def __init__(self, config: Optional[Dict[str, Any]] = None) -> None:
        super().__init__(config)
        from core.parsers.base import ParserFactoryRegistry
        self._subs: List[ParserStrategy] = []
        for spec in self.config.get("parsers") or []:
            if isinstance(spec, str):
                spec = {"name": spec}
            self._subs.append(ParserFactoryRegistry.create(
                spec["name"], spec.get("config") or {}))

    def parse(self, html: str, url: str = "", **kwargs: Any) -> ParseResult:
        merged = ParseResult()
        for sub in self._subs:
            part = sub.parse(html, url=url, **kwargs)
            for link in part.links:
                if link not in merged.links:
                    merged.links.append(link)
            for res in part.resources:
                if res.url not in {r.url for r in merged.resources}:
                    merged.resources.append(res)
            if part.title and not merged.title:
                merged.title = part.title
            if part.encoding and not merged.encoding:
                merged.encoding = part.encoding
            self._merge_data(merged.data, part.data)
        return merged

    @staticmethod
    def _merge_data(target: dict, source: dict) -> None:
        for key, value in source.items():
            if key not in target:
                target[key] = value
            elif isinstance(target[key], dict) and isinstance(value, dict):
                CompositeParser._merge_data(target[key], value)
            elif isinstance(target[key], list) and isinstance(value, list):
                # 表格等列表型数据：按行合并去重
                for item in value:
                    if item not in target[key]:
                        target[key].append(item)
