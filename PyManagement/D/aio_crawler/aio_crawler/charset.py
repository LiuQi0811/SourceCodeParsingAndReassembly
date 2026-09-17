# -*- coding: utf-8 -*-
"""网页字符集自动识别与编码解码（gbk / utf-8 等，中文不乱码）。

识别优先级：
1. HTTP 响应头 Content-Type 中的 charset
2. BOM
3. HTML <meta charset=...> / <meta http-equiv="Content-Type" ...>
4. charset_normalizer 内容统计检测
5. 兜底 utf-8
"""
from __future__ import annotations

import codecs
import re
from typing import Optional

try:
    from charset_normalizer import from_bytes as _cn_from_bytes
except Exception:  # pragma: no cover
    _cn_from_bytes = None

_META_RE = re.compile(
    rb"""<meta[^>]+(?:charset\s*=\s*["']?\s*([\w-]+)|http-equiv\s*=\s*["']content-type["'][^>]*content\s*=\s*["'][^"']*charset\s*=\s*([\w-]+))""",
    re.IGNORECASE,
)
_BOMS = [
    (codecs.BOM_UTF8, "utf-8-sig"),
    (codecs.BOM_UTF32_LE, "utf-32-le"),
    (codecs.BOM_UTF32_BE, "utf-32-be"),
    (codecs.BOM_UTF16_LE, "utf-16-le"),
    (codecs.BOM_UTF16_BE, "utf-16-be"),
]

_ALIASES = {
    "gb2312": "gbk", "gb_2312": "gbk", "gb-2312": "gbk", "chinese": "gbk",
    "cp936": "gbk", "ms936": "gbk", "gb18030": "gb18030",
    "utf8": "utf-8", "utf-8-sig": "utf-8-sig", "latin1": "latin-1", "latin-1": "latin-1",
}


def _canonical(cs: str) -> str:
    cs = (cs or "").strip().strip("\"'").lower()
    if not cs:
        return ""
    cs = _ALIASES.get(cs, cs)
    try:
        codecs.lookup(cs)
        return cs
    except LookupError:
        # 尝试规范化常见误写
        repl = re.sub(r"[\s_\-]", "", cs)
        for alias, real in [("gb2312", "gbk"), ("utf8", "utf-8"), ("cp936", "gbk"),
                            ("latin1", "latin-1"), ("iso88591", "latin-1")]:
            if repl == alias.replace("-", ""):
                return real
        return ""


def _from_http_header(content_type: Optional[str]) -> str:
    if not content_type:
        return ""
    m = re.search(r"charset\s*=\s*[\"']?([\w-]+)", content_type, re.IGNORECASE)
    return _canonical(m.group(1)) if m else ""


def _from_bom(raw: bytes) -> str:
    for bom, name in _BOMS:
        if raw.startswith(bom):
            return name
    return ""


def _from_meta(raw: bytes) -> str:
    m = _META_RE.search(raw[:8192])
    if m:
        g = (m.group(1) or m.group(2) or b"").decode("ascii", errors="ignore")
        return _canonical(g)
    return ""


def _from_statistics(raw: bytes) -> str:
    if _cn_from_bytes is None or not raw:
        return ""
    try:
        best = _cn_from_bytes(raw[:200_000]).best()
        if best is not None:
            return _canonical(best.encoding or "")
    except Exception:
        pass
    return ""


def detect_charset(
    raw: bytes,
    content_type: Optional[str] = None,
    fallback: Optional[str] = None,
) -> str:
    """按优先级识别字符集，返回规范编码名。"""
    if fallback:
        c = _canonical(fallback)
        if c:
            return c
    for cs in (_from_http_header(content_type), _from_bom(raw), _from_meta(raw)):
        if cs:
            return cs
    cs = _from_statistics(raw)
    if cs:
        return cs
    return "utf-8"


def decode(
    raw: bytes,
    content_type: Optional[str] = None,
    fallback: Optional[str] = None,
) -> tuple[str, str]:
    """解码字节流 -> (text, 实际使用的字符集)。严格优先，失败自动回退。"""
    if not isinstance(raw, (bytes, bytearray)):
        return (raw if isinstance(raw, str) else str(raw), "utf-8")
    raw = bytes(raw)

    charset = detect_charset(raw, content_type, fallback)
    try:
        return raw.decode(charset), charset
    except (LookupError, UnicodeDecodeError):
        pass

    # 严格解码失败：尝试按检测链逐级回退
    for cs in (
        _from_meta(raw), _from_bom(raw),
        _from_statistics(raw) or "utf-8", "gbk", "latin-1",
    ):
        if not cs or cs == charset:
            continue
        try:
            return raw.decode(cs), cs
        except (LookupError, UnicodeDecodeError):
            continue
    return raw.decode("utf-8", errors="replace"), "utf-8"
