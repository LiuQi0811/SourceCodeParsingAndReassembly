"""
组合解析器 (Composite Parser)
支持将 bs4、xpath、regex 多种解析器进行组合使用（管道串联或并行合并）
满足用户“支持组合使用”的深度需求
"""
from typing import Any, Dict, List, Optional
from crawler_framework.parsers.base import BaseParser, ParseResult


class CompositeParser(BaseParser):
    """
    组合解析器：
    支持在同一个解析任务中灵活组合多个解析器：
    例如：
    rules = {
        "bs4": {"main_title": "h1.main-title"},
        "xpath": {"token": "//span/@data-token"},
        "regex": {"raw_desc": r'<p class="desc">(.*?)</p>'}
    }
    """

    def __init__(self, parsers: Optional[List[BaseParser]] = None):
        self._parsers: List[BaseParser] = parsers or []

    @property
    def name(self) -> str:
        return "composite"

    def add_parser(self, parser: BaseParser) -> "CompositeParser":
        self._parsers.append(parser)
        return self

    def parse(
        self,
        html_or_text: str,
        base_url: str = "",
        rules: Optional[Dict[str, Any]] = None
    ) -> ParseResult:
        combined_data: Dict[str, Any] = {}
        all_links: List[str] = []
        all_resources: List[str] = []
        last_text: Optional[str] = None

        if not self._parsers:
            # 自动挂载三大默认解析器
            from crawler_framework.parsers.xpath_parser import XPathParser
            from crawler_framework.parsers.bs4_parser import Bs4Parser
            from crawler_framework.parsers.regex_parser import RegexParser
            self._parsers = [XPathParser(), Bs4Parser(), RegexParser()]

        # 如果 rules 中显式按解析器名字分发：
        if rules and any(k in ("bs4", "xpath", "regex") for k in rules.keys()):
            for parser in self._parsers:
                p_name = parser.name
                if p_name in rules:
                    sub_rule = rules[p_name]
                    res = parser.parse(html_or_text, base_url, sub_rule)
                    combined_data.update(res.data)
                    for u in res.extracted_urls:
                        if u not in all_links:
                            all_links.append(u)
                    for r in res.resource_urls:
                        if r not in all_resources:
                            all_resources.append(r)
                    if res.raw_text:
                        last_text = res.raw_text
        else:
            # 依次由内部所有解析器按序执行，合并解析结果
            for parser in self._parsers:
                res = parser.parse(html_or_text, base_url, rules)
                combined_data.update(res.data)
                for u in res.extracted_urls:
                    if u not in all_links:
                        all_links.append(u)
                for r in res.resource_urls:
                    if r not in all_resources:
                        all_resources.append(r)
                if res.raw_text:
                    last_text = res.raw_text

        return ParseResult(
            data=combined_data,
            extracted_urls=all_links,
            resource_urls=all_resources,
            raw_text=last_text,
            extra={"parsers_used": [p.name for p in self._parsers]}
        )


CompositeParserStrategy = CompositeParser
