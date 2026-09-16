# parser/xpath_parser.py
from __future__ import annotations

from typing import Any

from lxml import etree, html

from .base import ParserStrategy


class XPathParser(ParserStrategy):
    """lxml XPath 解析器"""

    def __init__(self, auto_fix: bool = True):
        self.auto_fix = auto_fix

    def parse(self, content: str, rule: dict[str, Any]) -> dict[str, list]:
        try:
            if self.auto_fix:
                tree = html.fromstring(content)
            else:
                tree = etree.fromstring(content.encode("utf-8"))
        except (etree.ParserError, etree.XMLSyntaxError, ValueError):
            return {k: [] for k in rule}

        result: dict[str, list] = {}
        for key, xpath in rule.items():
            try:
                matches = tree.xpath(xpath)
            except etree.XPathError:
                result[key] = []
                continue

            values: list = []
            for m in matches:
                if isinstance(m, str):
                    values.append(m)
                elif isinstance(m, etree._Element):
                    values.append(
                        etree.tostring(m, encoding="unicode", method="html")
                    )
                else:
                    values.append(str(m))
            result[key] = values
        return result