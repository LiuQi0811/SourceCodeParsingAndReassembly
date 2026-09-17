# -*- coding: utf-8 -*-
"""re 正则解析器。"""
from __future__ import annotations

import logging
import re

from ..models import Page, ParseResult, ResourceRef
from ..urlutils import classify_url, ext_of, urljoin
from .base import BaseParser
from .bs4_parser import _FILE_LINK_EXTS

logger = logging.getLogger(__name__)

_TITLE_RE = re.compile(r"<title[^>]*>\s*(.*?)\s*</title>", re.IGNORECASE | re.DOTALL)

# 资源 URL（带常见扩展名，覆盖引号包裹形式）
_RES_RE = re.compile(
    r"""(?:src|href|url|data-video|data-src)\s*=\s*["']([^"']+?\.(?:m3u8|mpd|flv|ts|mp4|mkv|webm|avi|mov|wmv|m4v|3gp|rmvb|rm|jpg|jpeg|png|gif|webp|bmp|svg|ico|avif|heic|mp3|wav|aac|flac|ogg|m4a|opus|pdf|docx?|xlsx?|pptx?|txt|md|csv|json|xml|epub|zip|rar|7z|tar|gz|apk|exe)(?:\?[^"']*)?)["']""",
    re.IGNORECASE,
)

# 通用页面链接（双引号/单引号 href）
_LINK_RE = re.compile(r"""<a[^>]+href\s*=\s*["']([^"']+)["'][^>]*>""", re.IGNORECASE)


class RegexParser(BaseParser):
    """基于正则表达式的轻量解析器。"""

    name = "re"

    def parse(self, page: Page, referer: str | None = None) -> ParseResult:
        res = ParseResult(parser_used=[self.name])
        text = page.text

        m = _TITLE_RE.search(text)
        if m and m.group(1).strip():
            res.title = m.group(1).strip()

        base = page.url
        bm = re.search(r"""<base[^>]+href\s*=\s*["']([^"']+)["']""", text, re.IGNORECASE)
        if bm:
            base = urljoin(page.url, bm.group(1))

        seen: set[str] = set()

        def _push(href: str, kind_flag: str) -> None:
            href = urljoin(base, href.strip())
            if not href or href.startswith(("javascript:", "mailto:", "tel:", "data:", "#")):
                return
            if href in seen:
                return
            seen.add(href)
            if kind_flag == "link":
                res.links.append(href)
            else:
                ext = ext_of(href)
                k, g = classify_url(href)
                res.resources.append(
                    ResourceRef(url=href, kind=k, group=g, ext=ext,
                                referer=referer or page.url, from_parser=self.name)
                )

        # 资源
        for mm in _RES_RE.finditer(text):
            _push(mm.group(1), "res")

        # 页面链接（排除已被资源捕获的）
        for mm in _LINK_RE.finditer(text):
            href = urljoin(base, mm.group(1).strip())
            if not href or href.startswith(("javascript:", "mailto:", "tel:", "data:", "#")):
                continue
            if href in seen:
                continue
            ext = ext_of(href)
            if ext in _FILE_LINK_EXTS:
                continue
            seen.add(href)
            res.links.append(href)

        return res
