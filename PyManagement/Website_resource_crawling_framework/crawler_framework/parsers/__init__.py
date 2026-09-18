from crawler_framework.parsers.base import BaseParser, BaseParserStrategy, ParseResult
from crawler_framework.parsers.bs4_parser import Bs4Parser, Bs4ParserStrategy
from crawler_framework.parsers.xpath_parser import XPathParser
from crawler_framework.parsers.regex_parser import RegexParser
from crawler_framework.parsers.composite_parser import CompositeParser
from crawler_framework.parsers.factory import ParserFactory

# 别名
XPathParserStrategy = XPathParser
RegexParserStrategy = RegexParser
CompositeParserStrategy = CompositeParser

__all__ = [
    "BaseParser",
    "BaseParserStrategy",
    "ParseResult",
    "Bs4Parser",
    "Bs4ParserStrategy",
    "XPathParser",
    "XPathParserStrategy",
    "RegexParser",
    "RegexParserStrategy",
    "CompositeParser",
    "CompositeParserStrategy",
    "ParserFactory",
]