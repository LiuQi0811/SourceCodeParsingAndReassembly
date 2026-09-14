# utils/charset_detector.py
from typing import Optional
import re
from charset_normalizer import from_bytes

# 优先顺序：http header charset > html meta charset > charset-normalizer自动检测
def extract_charset_from_content(html_bytes: bytes) -> Optional[str]:
    """从html meta标签提取编码"""
    match = re.search(rb'<meta.*?charset\s*=\s*["\']?([a-zA-Z0-9_\-]+)["\']?', html_bytes, re.I)
    if match:
        return match.group(1).decode("ascii", errors="ignore").lower()
    return None


def auto_decode(content: bytes, header_charset: Optional[str]) -> str:
    """
    自动解码二进制页面，自动处理 utf-8 / gbk / gb2312 等
    :param content: response bytes
    :param header_charset: http header 里面的 charset
    :return: 解码后的文本 str
    """
    charset: Optional[str] = None
    # 1. HTTP header charset
    if header_charset:
        charset = header_charset.lower()
    # 2. HTML meta charset
    if not charset:
        charset = extract_charset_from_content(content)
    # 3. charset-normalizer 自动推测（替代cchardet）
    if not charset:
        result = from_bytes(content).best()
        if result:
            charset = result.encoding

    # fallback
    if not charset:
        charset = "utf-8"

    try:
        return content.decode(charset)
    except (UnicodeDecodeError, LookupError):
        # 探测编码失败，使用utf8 + 忽略错误字符兜底
        return content.decode("utf-8", errors="replace")
