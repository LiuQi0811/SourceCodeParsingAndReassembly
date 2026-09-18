# -*- coding: utf-8 -*-
"""
字符集自动识别与解码
识别顺序：BOM -> HTTP Content-Type charset -> HTML <meta> charset -> charset-normalizer/chardet -> utf-8
保证 gbk / utf8 / gb2312 / big5 等中文编码不乱码。
"""
from __future__ import annotations

import re
from typing import Optional, Tuple

# BOM 表
_BOMS = (
    (b"\xef\xbb\xbf", "utf-8-sig"),
    (b"\xff\xfe\x00\x00", "utf-32-le"),
    (b"\x00\x00\xfe\xff", "utf-32-be"),
    (b"\xff\xfe", "utf-16-le"),
    (b"\xfe\xff", "utf-16-be"),
)

_META_CHARSET_RE = re.compile(
    rb"""<meta[^>]+charset\s*=\s*["']?\s*([a-zA-Z0-9_\-]+)""", re.I
)
_HTTP_CHARSET_RE = re.compile(r"charset\s*=\s*[\"']?([\w\-]+)", re.I)

# 常用中文编码（探测命中时按此顺序解码）
_CN_ORDER = ["utf-8", "gb18030", "gbk", "gb2312", "big5", "utf-16"]

# CJK 兼容编码族（中文兼容性优先，避免 GBK 被误判为韩文 cp949 等）
_CJK_FAMILY = {"gb18030", "big5", "euc-kr", "cp949", "euc-jp", "shift-jis", "shift_jis", "sjis", "hz"}


def _sniffer_candidates(raw: bytes) -> list:
    """收集 chardet / charset-normalizer 的候选 (编码, 置信度)"""
    candidates = []
    try:
        import chardet

        res = chardet.detect(raw[:65536])
        if res and res.get("encoding"):
            candidates.append((res["encoding"], float(res.get("confidence") or 0)))
    except Exception:
        pass
    try:
        from charset_normalizer import from_bytes

        best = from_bytes(raw[:65536]).best()
        if best is not None and best.encoding:
            candidates.append((best.encoding, float(getattr(best, "coherence", 0) or 0)))
    except Exception:
        pass
    return candidates


def _detect_by_bom(raw: bytes) -> Optional[str]:
    for bom, enc in _BOMS:
        if raw.startswith(bom):
            return enc
    return None


def _detect_by_headers(headers) -> Optional[str]:
    if headers is None:
        return None
    ct = None
    if hasattr(headers, "get"):
        ct = headers.get("Content-Type") or headers.get("content-type")
    if not ct:
        return None
    m = _HTTP_CHARSET_RE.search(str(ct))
    return m.group(1) if m else None


def _detect_by_meta(raw: bytes) -> Optional[str]:
    head = raw[:4096]
    m = _META_CHARSET_RE.search(head)
    return m.group(1).decode("ascii", "ignore") if m else None


def _detect_by_sniffer(raw: bytes) -> Optional[str]:
    """使用 chardet / charset-normalizer 统计探测；CJK 编码族优先（中文兼容）"""
    candidates = _sniffer_candidates(raw)
    if not candidates:
        return None
    # 1) CJK 编码族优先（gb18030/big5 等），避免中文被误判为 cp949 等
    for enc, _ in candidates:
        norm = _normalize(enc)
        if norm in ("gb18030", "big5"):
            return enc
    # 2) 其它候选取置信度最高者
    candidates.sort(key=lambda x: x[1], reverse=True)
    return _normalize(candidates[0][0])


def _normalize(enc: str) -> str:
    e = str(enc).lower().replace("_", "-")
    aliases = {
        "gb2312": "gb18030", "gb-2312": "gb18030", "cp936": "gb18030",
        "gbk": "gb18030", "windows-1252": "utf-8",
        "ascii": "utf-8", "utf8": "utf-8", "utf-8-sig": "utf-8-sig",
    }
    return aliases.get(e, e)


def detect_charset(
    raw: bytes,
    headers=None,
    html_meta: bool = True,
    fallback: str = "utf-8",
    prefer: Optional[str] = None,
) -> Tuple[str, str]:
    """返回 (charset, 来源)。来源: bom/http/meta/sniffer/fallback"""
    if prefer:
        return _normalize(prefer), "forced"
    enc = _detect_by_bom(raw)
    if enc:
        return enc, "bom"
    enc = _detect_by_headers(headers)
    if enc:
        return _normalize(enc), "http"
    if html_meta:
        enc = _detect_by_meta(raw)
        if enc:
            return _normalize(enc), "meta"
    enc = _detect_by_sniffer(raw)
    if enc:
        return enc, "sniffer"
    return fallback, "fallback"


def decode_bytes(
    raw: bytes,
    headers=None,
    html_meta: bool = True,
    forced: Optional[str] = None,
) -> Tuple[str, str, str]:
    """解码字节流为文本。返回 (text, charset, source)。

    forced 指定时强制使用该编码；解码失败自动降级到 utf-8(替换) 保证不抛异常。
    """
    charset, source = detect_charset(raw, headers, html_meta, prefer=forced)
    try:
        text = raw.decode(charset)
        return text, charset, source
    except (UnicodeDecodeError, LookupError):
        # 中文兼容降级：gb18030 是 gbk/gb2312 的超集
        if charset in ("utf-8", "utf-8-sig"):
            for cn in ("gb18030", "big5", "utf-16"):
                try:
                    return raw.decode(cn), cn, f"fallback({cn})"
                except (UnicodeDecodeError, LookupError):
                    continue
        try:
            return raw.decode("utf-8", errors="replace"), "utf-8", "replace"
        except Exception:
            return raw.decode("latin-1", errors="replace"), "latin-1", "replace"
