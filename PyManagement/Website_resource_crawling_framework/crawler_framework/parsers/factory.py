"""
解析器工厂（Factory Pattern）
提供解析器策略对象的创建与管理，支持全局默认解析器切换和单任务动态覆盖
"""
from typing import Dict, List, Optional, Union
from crawler_framework.core.models import ParserMode
from crawler_framework.parsers.base import BaseParser
from crawler_framework.parsers.bs4_parser import Bs4Parser
from crawler_framework.parsers.xpath_parser import XPathParser
from crawler_framework.parsers.regex_parser import RegexParser
from crawler_framework.parsers.composite_parser import CompositeParser


class ParserFactory:
    """解析器创建工厂"""

    _global_default_parser: str = "xpath"

    @classmethod
    def set_global_default(cls, parser_type: Union[str, ParserMode]) -> None:
        """设置全局默认解析器"""
        cls._global_default_parser = str(parser_type).lower()

    @classmethod
    def get_global_default(cls) -> str:
        """获取当前全局默认解析器名称"""
        return cls._global_default_parser

    @classmethod
    def get_parser(
        cls,
        parser_type: Optional[Union[str, List[str]]] = None,
        default_type: Optional[str] = None
    ) -> BaseParser:
        """
        根据名称或列表获取解析器实例
        :param parser_type: "bs4", "xpath", "regex", "composite" 或 ["bs4", "regex"]
        :param default_type: 备用类型
        """
        target = parser_type or default_type or cls._global_default_parser

        # 如果传入的是列表，说明是组合解析器
        if isinstance(target, list):
            composite = CompositeParser()
            for sub_name in target:
                composite.add_parser(cls._create_single_parser(sub_name))
            return composite

        target_str = str(target).lower()

        if target_str in (ParserMode.BS4.value, "bs4", "beautifulsoup", "soup"):
            return Bs4Parser()
        elif target_str in (ParserMode.XPATH.value, "xpath", "lxml"):
            return XPathParser()
        elif target_str in (ParserMode.REGEX.value, "regex", "re"):
            return RegexParser()
        elif target_str in (ParserMode.COMPOSITE.value, "composite", "combo", "all"):
            composite = CompositeParser()
            composite.add_parser(XPathParser())
            composite.add_parser(Bs4Parser())
            composite.add_parser(RegexParser())
            return composite
        else:
            return XPathParser()

    @classmethod
    def create_parser(cls, parser_type: Optional[str] = None) -> BaseParser:
        """工厂创建方法别名"""
        return cls.get_parser(parser_type)

    @classmethod
    def _create_single_parser(cls, name: str) -> BaseParser:
        name_str = str(name).lower()
        if name_str in ("bs4", "soup"):
            return Bs4Parser()
        elif name_str in ("xpath", "lxml"):
            return XPathParser()
        elif name_str in ("regex", "re"):
            return RegexParser()
        return XPathParser()
