# parser/regex_parser.py
from __future__ import annotations

import re
from typing import Any

from .base import ParserStrategy


class RegexParser(ParserStrategy):
    """正则表达式解析器"""

    def __init__(self, flags: int = re.DOTALL | re.IGNORECASE):
        self.flags = flags

    def parse(self, content: str, rule: dict[str, Any]) -> dict[str, list]:
        result: dict[str, list] = {}
        for key, pattern in rule.items():
            try:
                matches = re.findall(pattern, content, self.flags)
            except re.error:
                result[key] = []
                continue

            values: list = []
            for m in matches:
                if isinstance(m, str):
                    values.append(m)
                elif isinstance(m, tuple) and m:
                    values.append(m[0])
                else:
                    values.append(str(m))
            result[key] = values
        return result