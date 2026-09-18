# -*- coding: utf-8 -*-
"""基于 lxml(XPath) 的解析器"""
from urllib.parse import urljoin
from lxml import html as lxml_html

from .base import BaseParser, STREAM_PATTERNS


class LxmlParser(BaseParser):
    name = "lxml"

    def _tree(self, h: str):
        try:
            return lxml_html.fromstring(h)
        except Exception:
            return lxml_html.fromstring("<html></html>")

    def parse_links(self, html_text: str, base_url: str) -> list[str]:
        tree = self._tree(html_text)
        out = []
        for href in tree.xpath("//a/@href"):
            href = href.strip()
            if href and not href.startswith(("javascript:", "mailto:", "tel:", "#")):
                out.append(urljoin(base_url, href))
        return out

    def parse_title(self, html_text: str) -> str:
        tree = self._tree(html_text)
        t = tree.xpath("//title/text()")
        if t:
            return t[0].strip()
        h1 = tree.xpath("//h1//text()")
        return "".join(h1).strip() if h1 else ""

    def parse_resources(self, html_text: str, base_url: str) -> list[dict]:
        tree = self._tree(html_text)
        out = []
        xpaths = [
            "//img/@src", "//img/@data-src", "//img/@data-original",
            "//video/@src", "//source/@src", "//audio/@src",
            "//a/@href", "//link/@href",
        ]
        for xp in xpaths:
            for u in tree.xpath(xp):
                u = u.strip()
                if u:
                    out.append({"url": urljoin(base_url, u)})
        return out

    def parse_streams(self, html_text: str, base_url: str) -> list[dict]:
        seen, out = set(), []
        for pat, proto in STREAM_PATTERNS:
            for m in pat.findall(html_text):
                if m not in seen:
                    seen.add(m)
                    out.append({"url": m, "protocol": proto})
        return out