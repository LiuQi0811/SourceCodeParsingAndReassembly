# -*- coding: utf-8 -*-
"""基于正则的解析器"""
import re
from urllib.parse import urljoin

from .base import BaseParser, STREAM_PATTERNS


class RegexParser(BaseParser):
    name = "regex"

    def parse_links(self, html_text: str, base_url: str) -> list[str]:
        out = []
        for m in re.findall(r'href=["\']([^"\']+)["\']', html_text, re.I):
            if not m.startswith(("javascript:", "mailto:", "tel:", "#")):
                out.append(urljoin(base_url, m))
        return out

    def parse_title(self, html_text: str) -> str:
        m = re.search(r"<title[^>]*>(.*?)</title>", html_text, re.I | re.S)
        if m:
            return re.sub(r"\s+", " ", m.group(1)).strip()
        m = re.search(r"<h1[^>]*>(.*?)</h1>", html_text, re.I | re.S)
        return re.sub(r"\s+", " ", m.group(1)).strip() if m else ""

    def parse_resources(self, html_text: str, base_url: str) -> list[dict]:
        out = []
        pats = [
            r'<img[^>]+(?:src|data-src|data-original)=["\']([^"\']+)["\']',
            r'<video[^>]+src=["\']([^"\']+)["\']',
            r'<source[^>]+src=["\']([^"\']+)["\']',
            r'<audio[^>]+src=["\']([^"\']+)["\']',
            r'<a[^>]+href=["\']([^"\']+\.(?:jpg|jpeg|png|gif|webp|mp4|mkv|avi|mp3|'
            r'pdf|zip|rar|7z|doc|docx|xls|xlsx|ppt|pptx))["\']',
        ]
        for p in pats:
            for m in re.findall(p, html_text, re.I):
                out.append({"url": urljoin(base_url, m)})
        return out

    def parse_streams(self, html_text: str, base_url: str) -> list[dict]:
        seen, out = set(), []
        for pat, proto in STREAM_PATTERNS:
            for m in pat.findall(html_text):
                if m not in seen:
                    seen.add(m)
                    out.append({"url": m, "protocol": proto})
        return out