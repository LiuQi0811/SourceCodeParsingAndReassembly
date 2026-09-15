# core/encoding.py
import re
from charset_normalizer import from_bytes

RE_META_CHARSET = re.compile(
    rb'''<meta[^>]+?charset\s*=\s*["']?\s*([a-zA-Z0-9_-]+)''', re.I
)

def detect_encoding(response, raw_bytes: bytes) -> str:
    """
    三级编码检测：
    1. HTTP Content-Type 头中的 charset
    2. HTML meta 标签中的 charset
    3. charset-normalizer 统计推断
    """
    # Level 1: HTTP header
    if response.charset and response.charset.lower() not in ("iso-8859-1",):
        return response.charset

    # Level 2: HTML meta tag（只扫描前 4096 字节）
    m = RE_META_CHARSET.search(raw_bytes[:4096])
    if m:
        detected = m.group(1).decode("ascii", errors="ignore").lower()
        alias_map = {"gb2312": "gbk", "gb-2312": "gbk",
                     "utf8": "utf-8", "utf-8": "utf-8"}
        return alias_map.get(detected, detected)

    # Level 3: charset-normalizer 统计推断
    result = from_bytes(raw_bytes[:10240]).best()
    if result and result.encoding:
        return result.encoding

    return "utf-8"  # 最终回退

async def fetch_text(session, url: str, **kwargs) -> tuple[str, str]:
    """获取网页文本，返回 (text, encoding)。"""
    async with session.get(url, **kwargs) as resp:
        raw = await resp.read()
        encoding = detect_encoding(resp, raw)
        try:
            text = raw.decode(encoding, errors="replace")
        except (LookupError, UnicodeDecodeError):
            text = raw.decode("utf-8", errors="replace")
            encoding = "utf-8"
        return text, encoding