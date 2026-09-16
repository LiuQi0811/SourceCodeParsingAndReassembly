# parser/factory.py
from __future__ import annotations

from typing import Union

from .base import ParserStrategy
from .bs4_parser import BS4Parser
from .composite_parser import CompositeParser
from .leyytv_parser import LeyyTvParser
from .regex_parser import RegexParser
from .xpath_parser import XPathParser


class ParserFactory:
    """
    解析器工厂。
    - create("xpath")               → XPathParser
    - create(["xpath", "regex"])    → CompositeParser([XPathParser, RegexParser])
    - create("leyytv")              → LeyyTvParser (leyy.tv 专用, RC4解密)
    """

    _registry: dict[str, type[ParserStrategy]] = {
        "bs4": BS4Parser,
        "xpath": XPathParser,
        "regex": RegexParser,
        "leyytv": LeyyTvParser,
    }

    @classmethod
    def create(
        cls,
        parser_type: Union[str, list[str]],
        **kwargs,
    ) -> ParserStrategy:
        if isinstance(parser_type, list):
            if len(parser_type) == 1:
                return cls._create_single(parser_type[0], **kwargs)
            parsers = [cls._create_single(t, **kwargs) for t in parser_type]
            return CompositeParser(parsers)
        return cls._create_single(parser_type, **kwargs)

    @classmethod
    def _create_single(cls, parser_type: str, **kwargs) -> ParserStrategy:
        if parser_type not in cls._registry:
            raise ValueError(
                f"不支持的解析器: {parser_type}，"
                f"可选: {list(cls._registry.keys())}"
            )
        return cls._registry[parser_type](**kwargs)

    @classmethod
    def register(cls, name: str, parser_cls: type[ParserStrategy]) -> None:
        cls._registry[name] = parser_cls
