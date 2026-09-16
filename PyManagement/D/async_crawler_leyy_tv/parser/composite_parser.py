# parser/composite_parser.py
from __future__ import annotations

import logging
from typing import Any

from .base import ParserStrategy

logger = logging.getLogger("CompositeParser")


class CompositeParser(ParserStrategy):
    """
    组合解析器：同时使用多种解析策略，结果按字段名合并去重。
    """

    def __init__(self, parsers: list[ParserStrategy]):
        if not parsers:
            raise ValueError("CompositeParser 至少需要一个子解析器")
        self.parsers = parsers

    def parse(self, content: str, rule: dict[str, Any]) -> dict[str, list]:
        merged: dict[str, list] = {}
        for parser in self.parsers:
            try:
                partial = parser.parse(content, rule)
            except Exception as e:
                logger.warning(f"{parser.__class__.__name__} 解析失败: {e!r}")
                continue

            for key, values in partial.items():
                bucket = merged.setdefault(key, [])
                seen = set(bucket)
                for v in values:
                    if v not in seen:
                        bucket.append(v)
                        seen.add(v)
        # 补齐缺失字段
        for key in rule:
            merged.setdefault(key, [])
        return merged