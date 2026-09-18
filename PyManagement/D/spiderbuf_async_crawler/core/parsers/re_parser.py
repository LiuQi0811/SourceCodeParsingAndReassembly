"""Re 正则解析器。"""

from __future__ import annotations

import re
from typing import Any, Dict, List, Optional, Pattern

from core.models import ParseResult, ResourceItem, ResourceKind
from core.parsers.base import ParserStrategy, kind_from_url, resolve_url


class ReParser(ParserStrategy):
    """基于正则表达式的解析。

    config 键：
    - patterns: dict[str, str] 字段名 → 正则（含一个捕获组）
    - link_pattern: str 提取链接的正则（默认 r'href=["\\']([^"\\']+)["\\']'）
    - resource_pattern: str 提取资源的正则（默认 r'src=["\\']([^"\\']+)["\\']'）
    - flags: int 正则标志（默认 re.I | re.S）
    """

    name = "re"

    def __init__(self, config: Optional[Dict[str, Any]] = None) -> None:
        super().__init__(config)
        flags = self.config.get("flags", re.I | re.S)
        self._link_re: Pattern = re.compile(
            self.config.get("link_pattern", r'''href=["']([^"']+)["']'''), flags)
        self._res_re: Pattern = re.compile(
            self.config.get("resource_pattern", r'''src=["']([^"']+)["']'''), flags)
        self._field_res: Dict[str, Pattern] = {
            k: re.compile(v, flags) for k, v in (self.config.get("patterns") or {}).items()}

    def parse(self, html_text: str, url: str = "", **kwargs: Any) -> ParseResult:
        result = ParseResult()

        # 标题
        m = re.search(r"<title[^>]*>(.*?)</title>", html_text, re.I | re.S)
        if m:
            result.title = m.group(1).strip()

        # 字段
        for field, pattern in self._field_res.items():
            found = pattern.findall(html_text)
            if found:
                result.data.setdefault("fields", {})[field] = [
                    f.strip() if isinstance(f, str) else str(f) for f in found]

        # 链接
        for href in self._link_re.findall(html_text):
            full = resolve_url(url, href)
            if full:
                result.links.append(full)

        # 资源
        for src in self._res_re.findall(html_text):
            full = resolve_url(url, src)
            if full:
                result.resources.append(ResourceItem(
                    url=full, kind=kind_from_url(full),
                    name=_auto_name(full), referer=url))

        return self._finish(result, url)


def _auto_name(full_url: str) -> str:
    path = full_url.split("?")[0].rstrip("/")
    name = path.rsplit("/", 1)[-1]
    root, _, _ = name.rpartition(".")
    return root or "resource"
