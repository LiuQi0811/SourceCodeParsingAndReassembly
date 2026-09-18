# -*- coding: utf-8 -*-
"""网页字符集自动识别与解码"""
import re
import charset_normalizer


def detect_encoding(content: bytes, headers: dict) -> str:
    """三级检测：HTTP header → HTML meta → charset-normalizer"""
    # 1. HTTP header
    ct = headers.get("Content-Type") or headers.get("content-type") or ""
    m = re.search(r"charset=([^\s;]+)", ct, re.I)
    if m:
        enc = m.group(1).strip().strip('"').strip("'").lower()
        if enc not in ("iso-8859-1", "latin-1"):
            return enc

    # 2. HTML meta
    head = content[:4096].decode("ascii", errors="ignore")
    m = re.search(r'charset=["\']?([^\s"\'>;]+)', head, re.I)
    if m:
        enc = m.group(1).strip().strip('"').strip("'").lower()
        if enc not in ("iso-8859-1", "latin-1"):
            return enc

    # 3. charset-normalizer
    try:
        best = charset_normalizer.from_bytes(content).best()
        if best and best.encoding:
            enc = best.encoding.lower()
            if enc in ("gb2312", "gb18030"):
                enc = "gbk"
            return enc
    except Exception:
        pass

    return "utf-8"


def decode_content(content: bytes, headers: dict) -> str:
    """多编码兜底解码，中文不乱码"""
    enc = detect_encoding(content, headers)
    tried = []
    for e in [enc, "utf-8", "gbk", "gb18030", "big5"]:
        if e in tried:
            continue
        tried.append(e)
        try:
            return content.decode(e, errors="strict")
        except (UnicodeDecodeError, LookupError):
            continue
    return content.decode("utf-8", errors="replace")