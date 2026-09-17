# -*- coding: utf-8 -*-
"""bs4(BeautifulSoup) 解析器。"""
from __future__ import annotations

import logging
from urllib.parse import urlsplit

from bs4 import BeautifulSoup

from ..models import Page, ParseResult, ResourceRef
from ..urlutils import classify_url, ext_of, urljoin
from .base import BaseParser

logger = logging.getLogger(__name__)

# 标签 -> 属性
_TAG_ATTRS = {
    "a": "href",
    "img": "src",
    "video": "src",
    "audio": "src",
    "source": "src",
    "embed": "src",
    "iframe": "src",
    "link": "href",
    "script": "src",
    "track": "src",
}

# a 标签 href 视为资源链接的扩展名（相对页面链接做区分）
_FILE_LINK_EXTS = {
    "jpg", "jpeg", "png", "gif", "webp", "bmp", "svg", "ico", "avif", "heic",
    "mp4", "mkv", "webm", "avi", "mov", "wmv", "flv", "ts", "m2ts",
    "m3u8", "mpd", "m4v", "3gp", "rmvb", "rm", "mp3", "wav", "aac",
    "flac", "ogg", "m4a", "opus", "pdf", "doc", "docx", "xls", "xlsx",
    "ppt", "pptx", "txt", "md", "csv", "json", "xml", "epub", "zip",
    "rar", "7z", "tar", "gz", "apk", "exe",
}


class BS4Parser(BaseParser):
    """基于 BeautifulSoup + lxml 的解析器，同时采集 src/href。"""

    name = "bs4"

    def parse(self, page: Page, referer: str | None = None) -> ParseResult:
        res = ParseResult(parser_used=[self.name])
        soup = BeautifulSoup(page.text, "lxml")

        # 标题
        t = soup.find("title")
        if t and t.get_text(strip=True):
            res.title = t.get_text(strip=True)

        base = page.url
        # 页面内 <base href>
        base_tag = soup.find("base", href=True)
        if base_tag:
            base = urljoin(page.url, base_tag["href"])

        seen_href: set[str] = set()
        for tag, attr in _TAG_ATTRS.items():
            for el in soup.find_all(tag):
                val = el.get(attr)
                if not val or not str(val).strip():
                    continue
                href = urljoin(base, str(val).strip())
                if not href or href.startswith(("javascript:", "mailto:", "tel:", "data:", "#")):
                    continue
                if href in seen_href:
                    continue
                seen_href.add(href)

                ext = ext_of(href)
                if tag == "a" and ext not in _FILE_LINK_EXTS:
                    res.links.append(href)          # 页面链接
                else:
                    kind, group = classify_url(href)
                    res.resources.append(
                        ResourceRef(url=href, kind=kind, group=group, ext=ext,
                                    referer=referer or page.url, from_parser=self.name)
                    )
        return res
