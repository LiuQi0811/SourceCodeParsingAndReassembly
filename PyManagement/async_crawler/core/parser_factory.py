# core/parser_factory.py
from abc import ABC
from bs4 import BeautifulSoup
from lxml import etree
import re
from typing import Any, List
from core.task_model import ParserType


class BaseParser(ABC):
    def parse(self, html: str, expr: str) -> List[Any]:
        raise NotImplementedError


class Bs4Parser(BaseParser):
    def parse(self, html: str, expr: str):
        soup = BeautifulSoup(html, "html.parser")
        return soup.select(expr)


class XpathParser(BaseParser):
    def parse(self, html: str, expr: str):
        doc = etree.HTML(html)
        return doc.xpath(expr)


class ReParser(BaseParser):
    def parse(self, html: str, expr: str):
        return re.findall(expr, html)


class ParserFactory:
    @staticmethod
    def get_parser(parser_type: ParserType) -> BaseParser:
        match parser_type:
            case ParserType.BS4:
                return Bs4Parser()
            case ParserType.XPATH:
                return XpathParser()
            case ParserType.RE:
                return ReParser()
            case _:
                raise ValueError("不支持的解析器类型")
