# -*- coding: utf-8 -*-
"""解析器策略模块：bs4 / xpath(lxml) / regex，支持组合"""
from .base import ExtractedData, ParserStrategy, ResourceRef, normalize_rules
from .bs4_parser import BS4Parser
from .composite import CompositeParser
from .regex_parser import RegexParser
from .xpath_parser import XPathParser

__all__ = [
    "ExtractedData", "ParserStrategy", "ResourceRef", "normalize_rules",
    "BS4Parser", "XPathParser", "RegexParser", "CompositeParser",
]
