"""BS4 解析器：BeautifulSoup4。"""

from __future__ import annotations

from typing import Any, Dict

from bs4 import BeautifulSoup, Tag

from core.models import ParseResult, ResourceItem, ResourceKind
from core.parsers.base import ParserStrategy, kind_from_url, resolve_url


class BS4Parser(ParserStrategy):
    """基于 BeautifulSoup4 的通用 HTML 解析。

    config 可选键：
    - table: bool（默认 True）提取页面第一张表格为 data
    - extract_links: bool（默认 True）提取 a[href]
    - extract_resources: bool（默认 True）提取 img/script/link/video/source
    - selectors: dict[str, str] 自定义 CSS 选择器 → data 字段名（如 {"标题": "h1"}）
    - list_selectors: dict[str, str] 自定义 CSS 选择器 → 文本列表字段名
      （如 {"公司": "h2"} 提取页面全部 h2 文本为列表）
    """

    name = "bs4"

    def __init__(self, config: Optional[Dict[str, Any]] = None) -> None:
        super().__init__(config)
        self._soup: Optional[BeautifulSoup] = None

    def parse(self, html: str, url: str = "", **kwargs: Any) -> ParseResult:
        result = ParseResult()
        soup = BeautifulSoup(html, "lxml")
        self._soup = soup

        # 标题
        if soup.title and soup.title.string:
            result.title = soup.title.string.strip()
        elif soup.h1:
            result.title = soup.h1.get_text(strip=True)

        # 链接
        if self.config.get("extract_links", True):
            for a in soup.find_all("a", href=True):
                href = a.get("href", "")
                full = resolve_url(url, href)
                if full:
                    result.links.append(full)

        # 资源
        if self.config.get("extract_resources", True):
            for img in soup.find_all("img"):
                src = img.get("src") or img.get("data-src") or ""
                full = resolve_url(url, src)
                if full:
                    result.resources.append(ResourceItem(
                        url=full, kind=ResourceKind.IMAGE,
                        name=(img.get("alt") or "").strip() or _auto_name(full),
                        referer=url))
            for tag in soup.find_all(["script", "link", "iframe", "embed"]):
                attr = "src" if tag.name != "link" else "href"
                src = tag.get(attr, "")
                full = resolve_url(url, src)
                if full:
                    result.resources.append(ResourceItem(
                        url=full, kind=kind_from_url(full),
                        name=_auto_name(full), referer=url))
            for vtag in soup.find_all(["video", "audio", "source", "track"]):
                src = vtag.get("src", "")
                if src:
                    full = resolve_url(url, src)
                    if full:
                        result.resources.append(ResourceItem(
                            url=full, kind=kind_from_url(full),
                            name=_auto_name(full), referer=url))
            # <a> 指向的资源文件
            for a in soup.find_all("a", href=True):
                full = resolve_url(url, a.get("href", ""))
                if full and kind_from_url(full) != ResourceKind.OTHER:
                    result.resources.append(ResourceItem(
                        url=full, kind=kind_from_url(full),
                        name=a.get_text(strip=True) or _auto_name(full), referer=url))

        # 表格数据
        if self.config.get("table", True):
            data = self._extract_table(soup)
            if data:
                result.data = {"table": data}

        # 自定义 CSS 选择器
        for field, selector in (self.config.get("selectors") or {}).items():
            node = soup.select_one(selector)
            if node:
                result.data.setdefault("selectors", {})[field] = node.get_text(" ", strip=True)

        # 自定义 CSS 列表选择器（提取多个节点文本为列表）
        for field, selector in (self.config.get("list_selectors") or {}).items():
            items = [n.get_text(" ", strip=True)
                     for n in soup.select(selector)
                     if n.get_text(" ", strip=True)]
            if items:
                result.data.setdefault("lists", {})[field] = items

        return self._finish(result, url)

    @staticmethod
    def _extract_table(soup: BeautifulSoup) -> list:
        table = soup.find("table")
        if not table:
            return []
        headers = [th.get_text(" ", strip=True) for th in table.find_all("th")]
        rows: list = []
        for tr in table.find_all("tr"):
            cells = [td.get_text(" ", strip=True) for td in tr.find_all("td")]
            if not cells:
                continue
            if headers and len(cells) == len(headers):
                rows.append(dict(zip(headers, cells)))
            else:
                rows.append(cells)
        return rows


def _auto_name(full_url: str) -> str:
    """从 URL 推断文件名（不带扩展名）。"""
    path = full_url.split("?")[0].rstrip("/")
    name = path.rsplit("/", 1)[-1]
    root, _, _ = name.rpartition(".")
    return root or "resource"
