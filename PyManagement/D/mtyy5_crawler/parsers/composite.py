# -*- coding: utf-8 -*-
"""组合解析器：多种解析器结果取并集"""
import logging
from .base import BaseParser


class CompositeParser:
    def __init__(self, parsers: list[BaseParser]):
        self.parsers = parsers

    def _merge(self, method: str, *args, key=None):
        seen, out = set(), []
        for p in self.parsers:
            try:
                for item in getattr(p, method)(*args):
                    k = key(item) if key else item
                    if k in seen:
                        continue
                    seen.add(k)
                    out.append(item)
            except Exception as e:
                logging.debug(f"[{p.name}] {method} error: {e}")
        return out

    def parse_links(self, html_text: str, base_url: str) -> list[str]:
        return self._merge("parse_links", html_text, base_url)

    def parse_title(self, html_text: str) -> str:
        for p in self.parsers:
            try:
                t = p.parse_title(html_text)
                if t:
                    return t
            except Exception:
                continue
        return ""

    def parse_resources(self, html_text: str, base_url: str) -> list[dict]:
        return self._merge("parse_resources", html_text, base_url,
                           key=lambda x: x["url"])

    def parse_streams(self, html_text: str, base_url: str) -> list[dict]:
        return self._merge("parse_streams", html_text, base_url,
                           key=lambda x: x["url"])