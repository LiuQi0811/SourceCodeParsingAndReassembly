"""
自动字符集智能识别与转码模块（彻底杜绝中文乱码）
支持 HTTP Header、HTML Meta、charset-normalizer 字节分析以及 GB18030/GBK/GB2312/UTF-8 多级回退
"""
import re
from typing import Tuple, Optional
import charset_normalizer


class SmartCharsetDecoder:
    """智能字符集解码器"""

    # 正则提取 HTTP Header 中的 charset
    HEADER_CHARSET_RE = re.compile(r"charset=([a-zA-Z0-9_\-]+)", re.IGNORECASE)

    # 正则提取 HTML meta 标签中的 charset
    META_CHARSET_RE1 = re.compile(rb'<meta[^>]+charset=["\']?([a-zA-Z0-9_\-]+)', re.IGNORECASE)
    META_CHARSET_RE2 = re.compile(
        rb'<meta[^>]+http-equiv=["\']?content-type["\']?[^>]+content=["\'][^"\']*charset=([a-zA-Z0-9_\-]+)',
        re.IGNORECASE
    )

    # 常见别名映射规范化
    ENCODING_ALIASES = {
        "gb2312": "gb18030",
        "gbk": "gb18030",
        "gb-2312": "gb18030",
        "cp936": "gb18030",
        "windows-936": "gb18030",
        "utf8": "utf-8",
        "big-5": "big5",
    }

    @classmethod
    def detect_and_decode(
        cls,
        raw_bytes: bytes,
        content_type_header: str = "",
        default_encoding: str = "utf-8"
    ) -> Tuple[str, str]:
        """
        自动检测网页字符集，完成解码并保证中文不乱码
        :param raw_bytes: 原始字节流
        :param content_type_header: HTTP Content-Type 响应头
        :param default_encoding: 兜底编码
        :return: (解码后的文本, 探测到的编码名称)
        """
        if not raw_bytes:
            return "", "utf-8"

        detected_charset: Optional[str] = None

        # 1. 从 HTTP Content-Type Header 中提取
        if content_type_header:
            m = cls.HEADER_CHARSET_RE.search(content_type_header)
            if m:
                detected_charset = m.group(1).strip().lower()

        # 2. 从 HTML 头部的前 4096 字节中检测 meta 标签
        if not detected_charset:
            head_bytes = raw_bytes[:4096]
            m1 = cls.META_CHARSET_RE1.search(head_bytes)
            if m1:
                detected_charset = m1.group(1).decode("ascii", errors="ignore").strip().lower()
            else:
                m2 = cls.META_CHARSET_RE2.search(head_bytes)
                if m2:
                    detected_charset = m2.group(1).decode("ascii", errors="ignore").strip().lower()

        # 3. 规范化别名（如将 gbk, gb2312 提升为更大字符集的 gb18030，全面覆盖罕见汉字与符号）
        if detected_charset:
            detected_charset = cls.ENCODING_ALIASES.get(detected_charset, detected_charset)

        # 4. 尝试根据检测到的编码解码
        if detected_charset:
            try:
                text = raw_bytes.decode(detected_charset)
                return text, detected_charset
            except (UnicodeDecodeError, LookupError):
                pass

        # 5. 使用 charset-normalizer 探测真实编码
        try:
            results = charset_normalizer.from_bytes(raw_bytes)
            best_match = results.best()
            if best_match:
                encoding_name = best_match.encoding.lower()
                encoding_name = cls.ENCODING_ALIASES.get(encoding_name, encoding_name)
                try:
                    text = raw_bytes.decode(encoding_name)
                    return text, encoding_name
                except Exception:
                    pass
        except Exception:
            pass

        # 6. 多级回退尝试链：优先针对中文网页（UTF-8 -> GB18030 -> BIG5 -> CP1252）
        fallback_encodings = ["utf-8", "gb18030", "big5", "windows-1252", "latin-1"]
        for enc in fallback_encodings:
            try:
                text = raw_bytes.decode(enc)
                return text, enc
            except UnicodeDecodeError:
                continue

        # 7. 终极容错保障：utf-8 replace 模式，避免程序抛出异常崩溃
        return raw_bytes.decode("utf-8", errors="replace"), "utf-8-lossy"
