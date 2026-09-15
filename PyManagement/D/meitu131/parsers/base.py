# parsers/base.py
from abc import ABC, abstractmethod
from typing import Any

class BaseParser(ABC):
    name: str = "base"

    @abstractmethod
    async def parse(self, html: str, **kwargs) -> dict[str, Any]:
        """返回 {'links': [...], 'resources': [...], 'title': str}"""
        ...