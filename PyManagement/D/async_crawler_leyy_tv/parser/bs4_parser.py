# parser/bs4_parser.py
from __future__ import annotations

from typing import Any

from bs4 import BeautifulSoup

from .base import ParserStrategy


class BS4Parser(ParserStrategy):
    """BeautifulSoup 解析器（CSS 选择器）"""

    def __init__(self, features: str = "lxml"):
        self.features = features

    def parse(self, content: str, rule: dict[str, Any]) -> dict[str, list]:
        soup = BeautifulSoup(content, self.features)
        result: dict[str, list] = {}
        for key, selector in rule.items():
            try:
                els = soup.select(selector)
                result[key] = [
                    (el.get_text(strip=True) if hasattr(el, "get_text")
                     else str(el))
                    for el in els
                ]
            except Exception:
                result[key] = []
        return result