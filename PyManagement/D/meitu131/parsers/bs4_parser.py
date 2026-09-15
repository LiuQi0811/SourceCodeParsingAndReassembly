# parsers/bs4_parser.py
from bs4 import BeautifulSoup
from urllib.parse import urljoin
from .base import BaseParser

class BS4Parser(BaseParser):
    name = "bs4"

    async def parse(self, html: str, base_url: str = "", **kwargs) -> dict:
        soup = BeautifulSoup(html, "lxml")
        links, resources = [], []
        title = soup.title.get_text(strip=True) if soup.title else ""

        for a in soup.select("a[href]"):
            href = urljoin(base_url, a["href"])
            if href.startswith("http"):
                links.append(href)

        for img in soup.select("img[src], img[data-src]"):
            src = img.get("data-src") or img.get("src", "")
            if src:
                resources.append({
                    "url": urljoin(base_url, src),
                    "type": "image",
                    "alt": img.get("alt", "")
                })
        return {"links": links, "resources": resources, "title": title}