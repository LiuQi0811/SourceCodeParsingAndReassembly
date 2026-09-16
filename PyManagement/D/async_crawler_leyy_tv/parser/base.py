# parser/base.py
from __future__ import annotations

from abc import ABC, abstractmethod
from typing import Any


class ParserStrategy(ABC):
    """解析器策略抽象基类"""

    @abstractmethod
    def parse(self, content: str, rule: dict[str, Any]) -> dict[str, list]:
        """
        Args:
            content: HTML/文本内容
            rule:    {字段名: 选择器}
        Returns:
            {字段名: [值, ...]}
        """
        ...