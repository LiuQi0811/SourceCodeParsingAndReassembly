"""HTML 解析模块 - 提取页面中的链接并过滤"""
from urllib.parse import urlparse
from typing import List, Tuple
from bs4 import BeautifulSoup

from .utils import normalize_url, is_same_domain, is_resource_url


class Parser:
    """HTML 链接提取器"""

    def __init__(self, config):
        self.config = config

    def extract_links(self, html: bytes, base_url: str) -> List[Tuple[str, str]]:
        """
        从 HTML 中提取所有链接，返回 [(absolute_url, link_text)]
        过滤：同域、符合扩展名白名单、非 mailto/javascript
        """
        links = []
        try:
            soup = BeautifulSoup(html, "lxml")
        except Exception:
            try:
                soup = BeautifulSoup(html, "html.parser")
            except Exception:
                return links

        for tag in soup.find_all("a", href=True):
            href = tag.get("href", "").strip()
            if not href:
                continue
            if href.startswith(("javascript:", "mailto:", "tel:", "#", "data:")):
                continue
            try:
                abs_url = normalize_url(href, base_url)
            except Exception:
                continue
            scheme = urlparse(abs_url).scheme
            if scheme not in ("http", "https"):
                continue
            if not is_same_domain(abs_url, self.config.allowed_domains):
                continue
            if not is_resource_url(abs_url, self.config.allowed_exts):
                continue
            text = tag.get_text(strip=True)[:80]
            links.append((abs_url, text))

        # 去重
        seen = set()
        unique = []
        for u, t in links:
            if u not in seen:
                seen.add(u)
                unique.append((u, t))
        return unique

    @staticmethod
    def clean_html(html: bytes) -> str:
        """返回解析后的 title，用于日志"""
        try:
            soup = BeautifulSoup(html, "lxml")
            title = soup.title.string.strip() if soup.title and soup.title.string else ""
            return title
        except Exception:
            return ""
