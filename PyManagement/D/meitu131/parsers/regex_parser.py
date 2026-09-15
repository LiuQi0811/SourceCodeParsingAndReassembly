# parsers/regex_parser.py
import re
from urllib.parse import urljoin
from .base import BaseParser

class RegexParser(BaseParser):
    name = "regex"

    RE_LINK = re.compile(r'''href\s*=\s*["']([^"']+)["']''', re.I)
    RE_IMG = re.compile(r'''<img[^>]+?(?:data-src|src)\s*=\s*["']([^"']+)["']''', re.I)
    RE_TITLE = re.compile(r"<title[^>]*>(.*?)</title>", re.I | re.S)

    async def parse(self, html: str, base_url: str = "", **kwargs) -> dict:
        links = [urljoin(base_url, m) for m in self.RE_LINK.findall(html)]
        links = [u for u in links if u.startswith("http")]

        resources = [{"url": urljoin(base_url, m), "type": "image"}
                     for m in self.RE_IMG.findall(html)]

        title_m = self.RE_TITLE.search(html)
        title = title_m.group(1).strip() if title_m else ""

        return {"links": links, "resources": resources, "title": title}