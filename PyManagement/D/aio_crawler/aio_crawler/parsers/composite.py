# -*- coding: utf-8 -*-
"""组合解析器：按顺序运行多个解析器并去重合并（组合使用）。"""
from __future__ import annotations

from ..models import Page, ParseResult
from .base import BaseParser


class CompositeParser(BaseParser):
    """组合解析器。

    - parsers: 有序的 BaseParser 列表
    - title_priority: 标题取第一个非空（按解析器顺序）
    - 链接 / 资源跨解析器去重；记录每个解析器的命中数。
    """

    name = "composite"

    def __init__(self, parsers: list[BaseParser]) -> None:
        assert parsers, "组合解析器至少需要一个子解析器"
        self.parsers = parsers
        self.name = "composite:" + ",".join(p.name for p in parsers)

    def parse(self, page: Page, referer: str | None = None) -> ParseResult:
        merged = ParseResult(parser_used=[])
        seen_links: set[str] = set()
        seen_res: set[str] = set()

        for p in self.parsers:
            sub = p.parse(page, referer=referer)
            merged.parser_used.extend(sub.parser_used)
            if merged.title is None and sub.title:
                merged.title = sub.title
            for link in sub.links:
                if link not in seen_links:
                    seen_links.add(link)
                    merged.links.append(link)
            for r in sub.resources:
                if r.url not in seen_res:
                    seen_res.add(r.url)
                    merged.resources.append(r)
            merged.notes[p.name] = {
                "links": len(sub.links),
                "resources": len(sub.resources),
                "title": sub.title,
            }
        return merged
