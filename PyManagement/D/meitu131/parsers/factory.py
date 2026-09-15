# parsers/factory.py
from .bs4_parser import BS4Parser
from .xpath_parser import XPathParser
from .regex_parser import RegexParser
from .base import BaseParser

class ParserFactory:
    _registry: dict[str, type[BaseParser]] = {
        "bs4": BS4Parser,
        "xpath": XPathParser,
        "regex": RegexParser,
    }

    @classmethod
    def create(cls, name: str) -> BaseParser:
        if name not in cls._registry:
            raise ValueError(f"Unknown parser: {name}")
        return cls._registry[name]()

    @classmethod
    def create_composite(cls, names: list[str]) -> "CompositeParser":
        """组合多个解析器，合并结果（去重）。"""
        return CompositeParser([cls.create(n) for n in names])

class CompositeParser(BaseParser):
    """组合解析器：顺序执行，合并去重。"""
    def __init__(self, parsers: list[BaseParser]):
        self.parsers = parsers
        self.name = "+".join(p.name for p in parsers)

    async def parse(self, html: str, base_url: str = "", **kwargs) -> dict:
        all_links, all_resources, title = set(), [], ""
        for p in self.parsers:
            result = await p.parse(html, base_url, **kwargs)
            all_links.update(result.get("links", []))
            all_resources.extend(result.get("resources", []))
            if not title and result.get("title"):
                title = result["title"]

        # 资源按 URL 去重
        seen_urls = set()
        unique_resources = []
        for r in all_resources:
            if r["url"] not in seen_urls:
                seen_urls.add(r["url"])
                unique_resources.append(r)

        return {"links": list(all_links),
                "resources": unique_resources,
                "title": title}