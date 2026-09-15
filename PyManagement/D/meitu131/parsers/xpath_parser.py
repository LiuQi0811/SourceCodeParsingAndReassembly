# parsers/xpath_parser.py
from lxml import etree
from urllib.parse import urljoin
from .base import BaseParser

class XPathParser(BaseParser):
    name = "xpath"

    async def parse(self, html: str, base_url: str = "", **kwargs) -> dict:
        tree = etree.HTML(html)
        links, resources = [], []

        title_list = tree.xpath("//title/text()")
        title = title_list[0].strip() if title_list else ""

        for href in tree.xpath("//a/@href"):
            full = urljoin(base_url, href)
            if full.startswith("http"):
                links.append(full)

        for img in tree.xpath("//img"):
            src = img.get("data-src") or img.get("src", "")
            if src:
                resources.append({
                    "url": urljoin(base_url, src),
                    "type": "image",
                    "alt": img.get("alt", "")
                })
        return {"links": links, "resources": resources, "title": title}