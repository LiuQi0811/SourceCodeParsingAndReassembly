"""自动识别网页字符集，兼容 GBK/UTF-8，中文不乱码"""
import re
from charset_normalizer import from_bytes


class EncodingDetector:
    @staticmethod
    def detect_from_content(raw: bytes, content_type: str = "") -> str:
        if content_type:
            m = re.search(r'charset=["\']?([a-zA-Z0-9_-]+)',
                          content_type, re.I)
            if m:
                enc = m.group(1).lower()
                if enc in ("gb2312", "gbk"):
                    return "gb18030"
                return enc
        return ""

    @staticmethod
    def detect_from_meta(raw: bytes, max_check: int = 4096) -> str:
        head = raw[:max_check].decode("ascii", errors="ignore")
        patterns = [
            r'<meta[^>]+charset=["\']?([a-zA-Z0-9_-]+)',
            r'<meta[^>]+content=["\'][^"\']*charset=([a-zA-Z0-9_-]+)',
        ]
        for pat in patterns:
            m = re.search(pat, head, re.I)
            if m:
                enc = m.group(1).lower()
                if enc in ("gb2312", "gbk"):
                    return "gb18030"
                return enc
        return ""

    @classmethod
    def decode(cls, raw: bytes, content_type: str = "") -> str:
        enc = cls.detect_from_content(raw, content_type)
        if not enc:
            enc = cls.detect_from_meta(raw)

        if enc:
            try:
                return raw.decode(enc, errors="replace")
            except (LookupError, UnicodeDecodeError):
                pass

        try:
            result = from_bytes(raw).best()
            if result and result.encoding:
                return str(result)
        except Exception:
            pass

        return raw.decode("utf-8", errors="replace")