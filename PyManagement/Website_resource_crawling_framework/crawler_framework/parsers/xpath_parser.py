"""
解析器实现②：XPath (lxml) 解析器
支持 XPath 1.0 语法、节点匹配、属性获取与全站链接发现
"""
from typing import Any, Dict, List, Optional
import lxml.html
from lxml import etree
from crawler_framework.parsers.base import BaseParser, ParseResult


class XPathParser(BaseParser):
    """基于 lxml 的 XPath 解析策略"""

    @property
    def name(self) -> str:
        return "xpath"

    def parse(
        self,
        html_or_text: str,
        base_url: str = "",
        rules: Optional[Dict[str, Any]] = None
    ) -> ParseResult:
        if not html_or_text:
            return ParseResult()

        try:
            tree = lxml.html.fromstring(html_or_text)
        except Exception:
            try:
                tree = etree.HTML(html_or_text)
            except Exception:
                return ParseResult()

        if tree is None:
            return ParseResult()

        extracted_data: Dict[str, Any] = {}
        links: List[str] = []
        resources: List[str] = []

        # 1. 自定义规则提取（XPath 表达式）
        if rules:
            for field_name, rule in rules.items():
                extracted_data[field_name] = self._extract_by_rule(tree, rule, base_url)
        else:
            # 默认提取 title
            titles = tree.xpath("//title/text()")
            if titles:
                extracted_data["title"] = str(titles[0]).strip()

        # 2. 自动收集超链接
        a_hrefs = tree.xpath("//a/@href")
        for href in a_hrefs:
            full_url = self.normalize_url(str(href), base_url)
            if full_url and full_url not in links:
                links.append(full_url)

        # 3. 自动收集静态多媒体与静态资源链接
        media_xpaths = [
            "//img/@src",
            "//img/@data-src",
            "//video/@src",
            "//audio/@src",
            "//video/source/@src",
            "//audio/source/@src",
            "//link[@rel='stylesheet']/@href",
            "//script[@src]/@src",
        ]
        for xp in media_xpaths:
            found = tree.xpath(xp)
            for item in found:
                full_res = self.normalize_url(str(item), base_url)
                if full_res and full_res not in resources:
                    resources.append(full_res)

        # 纯文本
        raw_text = "".join(tree.xpath("//body//text()")).strip() if tree.xpath("//body") else ""

        return ParseResult(
            data=extracted_data,
            extracted_urls=links,
            resource_urls=resources,
            raw_text=raw_text,
        )

    def _extract_by_rule(self, tree: Any, rule: Any, base_url: str) -> Any:
        if isinstance(rule, str):
            res = tree.xpath(rule)
            if not res:
                return None
            if isinstance(res, list):
                if len(res) == 1:
                    val = res[0]
                    if hasattr(val, "text"):
                        val = val.text
                    val = str(val).strip()
                    if rule.endswith("/@href") or rule.endswith("/@src"):
                        val = self.normalize_url(val, base_url)
                    return val
                else:
                    items = []
                    for it in res:
                        if hasattr(it, "text"):
                            it = it.text
                        v = str(it).strip()
                        if rule.endswith("/@href") or rule.endswith("/@src"):
                            v = self.normalize_url(v, base_url)
                        items.append(v)
                    return items
            return str(res).strip()

        elif isinstance(rule, list):
            # 列表型规则: ["//div[contains(@class, 'item')]", {"title": ".//h2/text()", "link": ".//a/@href"}]
            if len(rule) >= 2 and isinstance(rule[0], str) and isinstance(rule[1], dict):
                node_xpath = rule[0]
                sub_dict = rule[1]
                nodes = tree.xpath(node_xpath)
                out_list = []
                for node in nodes:
                    item_data = {}
                    for k, sub_rule in sub_dict.items():
                        item_data[k] = self._extract_by_rule(node, sub_rule, base_url)
                    out_list.append(item_data)
                return out_list
            elif len(rule) == 1 and isinstance(rule[0], str):
                nodes = tree.xpath(rule[0])
                return [str(n.text if hasattr(n, "text") else n).strip() for n in nodes]

        elif isinstance(rule, dict):
            out = {}
            for k, v in rule.items():
                out[k] = self._extract_by_rule(tree, v, base_url)
            return out

        return None
