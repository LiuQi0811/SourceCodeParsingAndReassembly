"""解析器工厂 + 组合解析器"""
from .base import BaseParser
from .bs4_parser import Bs4Parser
from .xpath_parser import XPathParser
from .regex_parser import RegexParser


class ParserFactory:
    _registry = {
        "bs4": Bs4Parser,
        "xpath": XPathParser,
        "lxml": XPathParser,
        "re": RegexParser,
        "regex": RegexParser,
    }

    @classmethod
    def create(cls, name: str) -> BaseParser:
        name = name.lower().strip()
        if name not in cls._registry:
            raise ValueError(
                f"未知解析器: {name}，可选: {list(cls._registry.keys())}"
            )
        return cls._registry[name]()

    @classmethod
    def create_combined(cls, names: list[str]) -> "CombinedParser":
        parsers = [cls.create(n) for n in names]
        return CombinedParser(parsers)


class CombinedParser(BaseParser):
    """组合解析器：多解析器同时运行，结果去重合并"""

    def __init__(self, parsers: list[BaseParser]):
        self.parsers = parsers

    def _deduplicate(self, items: list[dict], key: str = "url") -> list[dict]:
        seen = set()
        result = []
        for item in items:
            u = item.get(key, "")
            if u and u not in seen:
                seen.add(u)
                result.append(item)
        return result

    def parse_links(self, text: str, base_url: str) -> list[dict]:
        all_links = []
        for p in self.parsers:
            try:
                all_links.extend(p.parse_links(text, base_url))
            except Exception:
                continue
        return self._deduplicate(all_links)

    def parse_resources(self, text: str, base_url: str) -> list[dict]:
        all_res = []
        for p in self.parsers:
            try:
                all_res.extend(p.parse_resources(text, base_url))
            except Exception:
                continue
        return self._deduplicate(all_res)

    def parse_title(self, text: str) -> str:
        for p in self.parsers:
            try:
                t = p.parse_title(text)
                if t:
                    return t
            except Exception:
                continue
        return ""