"""
BS4 解析器实现（Strategy Pattern）
"""
from typing import Any, Dict, List, Optional
from bs4 import BeautifulSoup
from crawler_framework.parsers.base import BaseParser, ParseResult


class Bs4Parser(BaseParser):
    """基于 BeautifulSoup4 的解析策略"""

    @property
    def name(self) -> str:
        return "bs4"

    def parse(
        self,
        html_or_text: str,
        base_url: str = "",
        rules: Optional[Dict[str, Any]] = None
    ) -> ParseResult:
        if not html_or_text:
            return ParseResult()

        soup = BeautifulSoup(html_or_text, "html.parser")
        extracted_data: Dict[str, Any] = {}
        links: List[str] = []
        resources: List[str] = []

        # 1. 结构化字段提取
        if rules:
            for field_name, rule in rules.items():
                extracted_data[field_name] = self._extract_by_rule(soup, rule, base_url)
        else:
            title_node = soup.find("title")
            if title_node:
                extracted_data["title"] = title_node.get_text(strip=True)

        # 2. 超链接发现 (a href)
        seen_links = set()
        for a_tag in soup.find_all("a", href=True):
            full_url = self.normalize_url(a_tag["href"], base_url)
            if full_url and full_url not in seen_links:
                seen_links.add(full_url)
                links.append(full_url)

        # 3. 静态/多媒体资源链接发现
        seen_res = set()
        for tag, attr in [
            ("img", "src"),
            ("amp-img", "src"),
            ("video", "src"),
            ("audio", "src"),
            ("source", "src"),
            ("link", "href"),
            ("script", "src"),
        ]:
            for node in soup.find_all(tag, attrs={attr: True}):
                res_url = self.normalize_url(node[attr], base_url)
                if res_url and res_url not in seen_res:
                    seen_res.add(res_url)
                    resources.append(res_url)

        return ParseResult(
            data=extracted_data,
            extracted_urls=links,
            resource_urls=resources,
            raw_text=soup.get_text(separator="\n", strip=True)
        )

    def _extract_by_rule(self, soup: BeautifulSoup, rule: Any, base_url: str) -> Any:
        if isinstance(rule, str):
            selector, attr = self._parse_selector(rule)
            node = soup.select_one(selector)
            if not node:
                return None
            if attr:
                val = node.get(attr)
                return self.normalize_url(str(val), base_url) if attr in ("href", "src") and val else val
            return node.get_text(strip=True)

        elif isinstance(rule, list):
            if len(rule) >= 1 and isinstance(rule[0], str):
                selector, attr = self._parse_selector(rule[0])
                results = []
                for el in soup.select(selector):
                    if attr:
                        v = el.get(attr)
                        results.append(self.normalize_url(str(v), base_url) if attr in ("href", "src") and v else v)
                    else:
                        results.append(el.get_text(strip=True))
                return results

        elif isinstance(rule, dict):
            return {k: self._extract_by_rule(soup, v, base_url) for k, v in rule.items()}

        return None

    def _parse_selector(self, rule_str: str):
        if "::attr(" in rule_str and rule_str.endswith(")"):
            sel, attr = rule_str.split("::attr(", 1)
            return sel.strip(), attr[:-1].strip()
        elif "@" in rule_str:
            sel, attr = rule_str.split("@", 1)
            return sel.strip(), attr.strip()
        return rule_str.strip(), None


# 别名兼容
Bs4ParserStrategy = Bs4Parser
