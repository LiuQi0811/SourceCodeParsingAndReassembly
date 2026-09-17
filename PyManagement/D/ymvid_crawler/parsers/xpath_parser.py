from lxml import etree
from urllib.parse import urljoin
from .base import BaseParser


class XPathParser(BaseParser):
    def parse_links(self, text: str, base_url: str) -> list[dict]:
        tree = etree.HTML(text)
        if tree is None:
            return []
        links = []
        for href in tree.xpath("//a/@href"):
            href = href.strip()
            if href.startswith(("javascript:", "#", "mailto:", "tel:")):
                continue
            links.append({"url": urljoin(base_url, href), "type": "page"})
        return links

    def parse_resources(self, text: str, base_url: str) -> list[dict]:
        tree = etree.HTML(text)
        if tree is None:
            return []
        resources = []
        for src in tree.xpath("//img/@src"):
            resources.append({"url": urljoin(base_url, src), "type": "img"})
        for src in tree.xpath("//img/@data-src"):
            resources.append({"url": urljoin(base_url, src), "type": "img"})
        for src in tree.xpath("//video/@src | //video/source/@src"):
            resources.append({"url": urljoin(base_url, src), "type": "video"})
        return resources

    def parse_title(self, text: str) -> str:
        tree = etree.HTML(text)
        if tree is None:
            return ""
        titles = tree.xpath("//title/text()")
        return titles[0].strip() if titles else ""