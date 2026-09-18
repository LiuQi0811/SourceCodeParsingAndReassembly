# -*- coding: utf-8 -*-
from .base import BaseParser, STREAM_PATTERNS
from .bs4_parser import BS4Parser
from .lxml_parser import LxmlParser
from .regex_parser import RegexParser
from .composite import CompositeParser
from .factory import ParserFactory

# 注册内置解析器
ParserFactory.register("bs4", BS4Parser)
ParserFactory.register("lxml", LxmlParser)
ParserFactory.register("regex", RegexParser)

__all__ = [
    "BaseParser", "STREAM_PATTERNS",
    "BS4Parser", "LxmlParser", "RegexParser",
    "CompositeParser", "ParserFactory",
]