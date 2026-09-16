# utils/encoding.py
from __future__ import annotations

import re
from typing import Optional

import chardet


_META_CHARSET = re.compile(
    rb'<meta[^>]+charset\s*=\s*["\']?\s*([a-zA-Z0-9_\-]+)',
    re.IGNORECASE,
)
_CHARSET_NORMALIZE = {
    "gb2312": "gb18030",
    "gbk": "gb18030",
    "gb-2312": "gb18030",
    "utf8": "utf-8",
    "utf-8-sig": "utf-8",
}


def _normalize(enc: str | None) -> str | None:
    if not enc:
        return None
    e = enc.lower().strip()
    return _CHARSET_NORMALIZE.get(e, e)


def detect_encoding(content: bytes, default: str = "utf-8") -> str:
    """
    多级字符集检测：
    1. HTML meta charset
    2. chardet
    3. default
    """
    if not content:
        return default

    m = _META_CHARSET.search(content[:4096])
    if m:
        enc = _normalize(m.group(1).decode("ascii", errors="ignore"))
        if enc:
            return enc

    result = chardet.detect(content[:65536]) or {}
    if result.get("confidence", 0) > 0.7:
        enc = _normalize(result.get("encoding"))
        if enc:
            return enc

    return default


def safe_decode(content: bytes, encoding: Optional[str] = None) -> str:
    """
    安全解码：优先使用指定/自动识别编码，
    逐级回退到常见中文编码，永不抛异常。
    """
    if content is None:
        return ""

    tried: list[str] = []
    if encoding:
        tried.append(_normalize(encoding) or encoding)

    auto = detect_encoding(content)
    if auto not in tried:
        tried.append(auto)

    for fb in ("gb18030", "utf-8", "gbk", "big5", "latin-1"):
        if fb not in tried:
            tried.append(fb)

    for enc in tried:
        try:
            return content.decode(enc)
        except (UnicodeDecodeError, LookupError):
            continue

    return content.decode("utf-8", errors="replace")