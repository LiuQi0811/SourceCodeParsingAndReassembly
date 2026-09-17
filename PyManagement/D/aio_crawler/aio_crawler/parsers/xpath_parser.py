# -*- coding: utf-8 -*-
"""lxml XPath 解析器。"""
from __future__ import annotations

import logging

from lxml import etree, html as lxml_html

from ..models import Page, ParseResult, ResourceRef
from ..urlutils import classify_url, ext_of, urljoin
from .base import BaseParser
from .bs4_parser import _FILE_LINK_EXTS

logger = logging.getLogger(__name__)

_XPATH_TITLE = "//title/text()"
_XPATH_LINKS = "//a[@href]/@href"
_XPATH_RES_TAGS = {
    "//img[@src]/@src": "img",
    "//video[@src]/@src": "video",
    "//audio[@src]/@src": "audio",
    "//source[@src]/@src": "source",
    "//embed[@src]/@src": "embed",
    "//iframe[@src]/@src": "iframe",
    "//link[@href]/@href": "link",
    "//script[@src]/@src": "script",
    "//track[@src]/@src": "track",
    "//a[@href][contains(@href,'.m3u8') or contains(@href,'.mpd') or contains(@href,'.flv')]/@href": "a-stream",
}


class XPathParser(BaseParser):
    """基于 lxml + XPath 的解析器。"""

    name = "xpath"

    # 显式指定 UTF-8 解析：内容已由 charset 模块解码为 str，
    # 避免 libxml2 因 <meta charset> 声明而触发编码重判导致解析出空树。
    _HTML_PARSER = etree.HTMLParser(encoding="utf-8", recover=True)

    def parse(self, page: Page, referer: str | None = None) -> ParseResult:
        res = ParseResult(parser_used=[self.name])
        try:
            tree = lxml_html.document_fromstring(
                page.text.encode("utf-8", errors="replace"), parser=self._HTML_PARSER
            )
        except (etree.ParserError, ValueError) as e:
            logger.warning("xpath 解析失败 %s: %s", page.url, e)
            return res

        # 标题
        titles = tree.xpath(_XPATH_TITLE)
        if titles and str(titles[0]).strip():
            res.title = str(titles[0]).strip()

        base = page.url
        base_nodes = tree.xpath("//base[@href]/@href")
        if base_nodes:
            base = urljoin(page.url, str(base_nodes[0]))

        seen: set[str] = set()

        def _push(href: str, tag: str) -> None:
            href = urljoin(base, href.strip())
            if not href or href.startswith(("javascript:", "mailto:", "tel:", "data:", "#")):
                return
            if href in seen:
                return
            seen.add(href)
            ext = ext_of(href)
            if tag == "a" and ext not in _FILE_LINK_EXTS:
                res.links.append(href)
            else:
                kind, group = classify_url(href)
                res.resources.append(
                    ResourceRef(url=href, kind=kind, group=group, ext=ext,
                                referer=referer or page.url, from_parser=self.name)
                )

        for expr, tag in _XPATH_RES_TAGS.items():
            try:
                for v in tree.xpath(expr):
                    _push(str(v), tag)
            except Exception:
                continue

        for v in tree.xpath(_XPATH_LINKS):
            _push(str(v), "a")

        return res
