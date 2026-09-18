"""网页字符集自动识别与编解码。

优先级：
1. HTTP 响应头 Content-Type 中的 charset
2. BOM（UTF-8/UTF-16）
3. HTML 内 <meta charset> / <meta http-equiv>
4. charset_normalizer 智能检测
5. 兜底：utf-8 → gbk → latin-1 逐级尝试
"""

from __future__ import annotations

import codecs
import re
from typing import Optional, Tuple

import charset_normalizer

_META_CHARSET_RE = re.compile(
    rb"""<meta[^>]+charset\s*=\s*["']?\s*([a-zA-Z0-9_\-]+)""", re.I)
_HTTP_EQUIV_RE = re.compile(
    rb"""<meta[^>]+http-equiv\s*=\s*["']?content-type["']?[^>]+content\s*=\s*["'][^"']*charset\s*=\s*([a-zA-Z0-9_\-]+)""",
    re.I)

# 常见中文编码别名归一化
_ENCODING_ALIAS = {
    "utf8": "utf-8", "utf-8": "utf-8", "utf_8": "utf-8",
    "gb2312": "gbk", "gb_2312": "gbk", "gb-2312": "gbk", "gbk": "gbk",
    "gb18030": "gb18030", "big5": "big5", "big-5": "big5",
    "latin1": "latin-1", "iso-8859-1": "latin-1", "cp1252": "cp1252",
    "utf16": "utf-16", "utf-16": "utf-16", "utf_16": "utf-16",
    "utf-16le": "utf-16-le", "utf-16be": "utf-16-be",
}


def normalize_encoding(name: str) -> str:
    """归一化编码名。"""
    return _ENCODING_ALIAS.get(name.strip().lower(), name.strip().lower())


def detect_encoding(headers: Optional[dict] = None, raw: Optional[bytes] = None) -> str:
    """识别网页字符集，返回编码名（小写）。"""
    # 1. HTTP 头
    if headers:
        ctype = (headers.get("Content-Type") or headers.get("content-type") or "")
        m = re.search(r"charset\s*=\s*[\"']?([\w\-]+)", ctype, re.I)
        if m:
            enc = normalize_encoding(m.group(1))
            if _can_decode(raw, enc):
                return enc

    if not raw:
        return "utf-8"

    # 2. BOM
    if raw.startswith(codecs.BOM_UTF8):
        return "utf-8-sig"
    if raw.startswith(codecs.BOM_UTF16_LE):
        return "utf-16"
    if raw.startswith(codecs.BOM_UTF16_BE):
        return "utf-16"

    # 3. HTML meta（前 4096 字节足够）
    head = raw[:4096]
    m = _META_CHARSET_RE.search(head)
    if not m:
        m = _HTTP_EQUIV_RE.search(head)
    if m:
        enc = normalize_encoding(m.group(1).decode("ascii", "ignore"))
        if _can_decode(raw, enc):
            return enc

    # 4. charset_normalizer 智能检测
    try:
        best = charset_normalizer.from_bytes(raw).best()
        if best is not None:
            enc = normalize_encoding(best.encoding)
            if _can_decode(raw, enc):
                return enc
    except Exception:  # noqa: BLE001
        pass

    # 5. 兜底：utf-8 → gbk → latin-1
    for enc in ("utf-8", "gbk", "latin-1"):
        if _can_decode(raw, enc):
            return enc
    return "utf-8"


def _can_decode(raw: Optional[bytes], enc: str) -> bool:
    """测试能否无损解码（存在可疑替换符时返回 False 以继续尝试）。"""
    if not raw:
        return True
    try:
        raw.decode(enc, errors="strict")
        return True
    except (LookupError, UnicodeDecodeError):
        return False


def decode_bytes(raw: bytes, headers: Optional[dict] = None,
                 force_encoding: Optional[str] = None) -> Tuple[str, str]:
    """自动解码字节 → (text, 实际编码)。force_encoding 可强制指定。"""
    enc = force_encoding or detect_encoding(headers, raw)
    try:
        text = raw.decode(enc, errors="replace")
    except (LookupError, UnicodeDecodeError):
        enc = "utf-8"
        text = raw.decode("utf-8", errors="replace")
    return text, enc
