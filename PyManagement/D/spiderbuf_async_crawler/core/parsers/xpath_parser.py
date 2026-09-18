"""XPath 解析器：lxml。"""

from __future__ import annotations

from typing import Any, Dict, Optional

from lxml import etree, html

from core.models import ParseResult, ResourceItem, ResourceKind
from core.parsers.base import ParserStrategy, kind_from_url, resolve_url


class XPathParser(ParserStrategy):
    """基于 lxml 的 XPath 解析。

    config 可选键：
    - xpath: dict[str, str] 字段名 → XPath 表达式（如 {"标题": "//h1/text()"}）
    - links_xpath: str 提取链接的表达式（默认 //a/@href）
    - resources_xpath: str 提取资源的表达式（默认 //img/@src）
    - table_xpath: str 表格所在节点表达式（默认 //table[1]）
    """

    name = "xpath"

    def parse(self, html_text: str, url: str = "", **kwargs: Any) -> ParseResult:
        result = ParseResult()
        try:
            root = html.fromstring(html_text)
        except (etree.ParserError, ValueError):
            # 兜底：修复 HTML 再解析
            parser = html.HTMLParser(encoding="utf-8", recover=True)
            root = html.document_fromstring(html_text, parser=parser)

        # 标题
        titles = root.xpath("//title/text()") or root.xpath("//h1/text()")
        if titles:
            result.title = (titles[0] or "").strip()

        # 自定义字段提取
        for field, expr in (self.config.get("xpath") or {}).items():
            vals = root.xpath(expr)
            result.data.setdefault("fields", {})[field] = [
                v.strip() if isinstance(v, str) else str(v) for v in vals]

        # 链接
        links_expr = self.config.get("links_xpath", "//a/@href")
        for href in root.xpath(links_expr):
            full = resolve_url(url, str(href))
            if full:
                result.links.append(full)

        # 资源
        res_expr = self.config.get("resources_xpath", "//img/@src")
        for src in root.xpath(res_expr):
            full = resolve_url(url, str(src))
            if full:
                result.resources.append(ResourceItem(
                    url=full, kind=ResourceKind.IMAGE,
                    name=_auto_name(full), referer=url))

        # 表格
        table_expr = self.config.get("table_xpath", "//table[1]")
        table = root.xpath(table_expr)
        if table and self.config.get("table", True):
            data = self._extract_table(table[0])
            if data:
                result.data["table"] = data

        return self._finish(result, url)

    @staticmethod
    def _extract_table(node: Any) -> list:
        headers = [th.xpath("string(.)").strip() for th in node.xpath(".//th")]
        rows: list = []
        for tr in node.xpath(".//tr"):
            cells = [td.xpath("string(.)").strip() for td in tr.xpath("./td")]
            if not cells:
                continue
            if headers and len(cells) == len(headers):
                rows.append(dict(zip(headers, cells)))
            else:
                rows.append(cells)
        return rows


def _auto_name(full_url: str) -> str:
    path = full_url.split("?")[0].rstrip("/")
    name = path.rsplit("/", 1)[-1]
    root, _, _ = name.rpartition(".")
    return root or "resource"
