# -*- coding: utf-8 -*-
"""基于 BeautifulSoup 的解析器"""
from urllib.parse import urljoin
from bs4 import BeautifulSoup

from .base import BaseParser, STREAM_PATTERNS


class BS4Parser(BaseParser):
    name = "bs4"

    def _soup(self, h: str) -> BeautifulSoup:
        return BeautifulSoup(h, "lxml")

    def parse_links(self, html_text: str, base_url: str) -> list[str]:
        soup = self._soup(html_text)
        out = []
        for a in soup.find_all("a", href=True):
            href = a["href"].strip()
            if href and not href.startswith(("javascript:", "mailto:", "tel:", "#")):
                out.append(urljoin(base_url, href))
        return out

    def parse_title(self, html_text: str) -> str:
        soup = self._soup(html_text)
        if soup.title and soup.title.string:
            return soup.title.string.strip()
        h1 = soup.find("h1")
        return h1.get_text(strip=True) if h1 else ""

    def parse_resources(self, html_text: str, base_url: str) -> list[dict]:
        soup = self._soup(html_text)
        out = []
        pairs = [
            ("img", "src"), ("img", "data-src"), ("img", "data-original"),
            ("video", "src"), ("source", "src"), ("audio", "src"),
            ("a", "href"), ("link", "href"),
        ]
        for tag, attr in pairs:
            for el in soup.find_all(tag):
                u = (el.get(attr) or "").strip()
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