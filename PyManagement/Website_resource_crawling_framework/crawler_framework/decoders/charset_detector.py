"""
字符集自动探测与无乱码解码器
智能识别 HTTP Header、HTML Meta、BOM头及 charset-normalizer 分析
全面兼容 GBK、GB2312、GB18030、UTF-8、Big5、Windows-1252、ISO-8859-1 等，确保中文绝不乱码
"""
import re
from typing import Dict, List, Optional, Tuple
import charset_normalizer


class CharsetDetector:
    """字符集探测与智能解码器"""

    # 常见编码优先级列表（中文优先容错顺序）
    CHINESE_ENCODING_CANDIDATES = [
        "utf-8",
        "gb18030",
        "gbk",
        "gb2312",
        "big5",
        "utf-16",
        "latin1"
    ]

    @classmethod
    def decode(
        cls,
        raw_bytes: bytes,
        content_type_header: Optional[str] = None
    ) -> Tuple[str, str]:
        """
        全自动多级字符集检测与解码
        :param raw_bytes: 原始响应字节流
        :param content_type_header: HTTP 响应头 Content-Type，例如 'text/html; charset=gbk'
        :return: (解码后的文本, 检测出的编码名称)
        """
        if not raw_bytes:
            return "", "utf-8"

        detected_encoding: Optional[str] = None

        # 1. 尝试从 HTTP Header 提取 charset
        if content_type_header:
            detected_encoding = cls._extract_charset_from_header(content_type_header)

        # 2. 如果未检测到，尝试检测前几个字节的 BOM (Byte Order Mark)
        if not detected_encoding:
            detected_encoding = cls._detect_bom(raw_bytes)

        # 3. 如果仍未检测到，从 HTML 内容的前 4096 字节正则提取 <meta charset>
        if not detected_encoding:
            detected_encoding = cls._extract_charset_from_meta(raw_bytes[:4096])

        # 4. 如果前面有提取到编码，先尝试使用该编码进行严谨解码
        if detected_encoding:
            norm_encoding = cls._normalize_encoding_name(detected_encoding)
            try:
                text = raw_bytes.decode(norm_encoding)
                return text, norm_encoding
            except (UnicodeDecodeError, LookupError):
                pass

        # 5. 多候选解码评分：normalizer 全部候选 + 中文回退链，按文本质量选优
        candidates: List[Tuple[Optional[str], str]] = []
        try:
            results = charset_normalizer.from_bytes(raw_bytes)
            norm_encs = []
            for m in results:
                if m.encoding:
                    norm_encs.append(cls._normalize_encoding_name(m.encoding))
            candidates.extend(cls._collect_candidates(raw_bytes, norm_encs))
        except Exception:
            pass
        candidates.extend(cls._collect_candidates(raw_bytes, cls.CHINESE_ENCODING_CANDIDATES))
        if candidates:
            text, enc = max(candidates, key=lambda t: cls._score_text(t[0]))
            return text, enc

        # 6. 终极容错：以 utf-8 errors='replace' 解码
        return raw_bytes.decode("utf-8", errors="replace"), "utf-8"

    @classmethod
    def _extract_charset_from_header(cls, content_type: str) -> Optional[str]:
        match = re.search(r"charset=([\w\-]+)", content_type, re.IGNORECASE)
        if match:
            return match.group(1).strip("'\" ")
        return None

    @classmethod
    def _detect_bom(cls, raw_bytes: bytes) -> Optional[str]:
        if raw_bytes.startswith(b"\xef\xbb\xbf"):
            return "utf-8-sig"
        elif raw_bytes.startswith(b"\xff\xfe"):
            return "utf-16-le"
        elif raw_bytes.startswith(b"\xfe\xff"):
            return "utf-16-be"
        return None

    @classmethod
    def _extract_charset_from_meta(cls, sample_bytes: bytes) -> Optional[str]:
        # 宽容方式转为 ascii 忽略错误后查找 meta 标签
        sample_str = sample_bytes.decode("ascii", errors="ignore")
        # <meta charset="gb2312">
        m1 = re.search(r'<meta[^>]+charset=["\']?([\w\-]+)["\']?', sample_str, re.IGNORECASE)
        if m1:
            return m1.group(1).strip()
        # <meta http-equiv="Content-Type" content="text/html; charset=gbk">
        m2 = re.search(r'content=["\'][^"\']*charset=([\w\-]+)[^"\']*["\']', sample_str, re.IGNORECASE)
        if m2:
            return m2.group(1).strip()
        return None

    @classmethod
    def _normalize_encoding_name(cls, encoding: str) -> str:
        enc = encoding.lower().strip()
        if enc in ("gb2312", "gbk"):
            # 在现代 Python 中，使用 gb18030 超集解码 gbk/gb2312 最安全，涵盖生僻字且不报错
            return "gb18030"
        if enc in ("utf8", "utf_8"):
            return "utf-8"
        return enc

    @classmethod
    def _try_chinese_fallbacks(cls, raw_bytes: bytes) -> Tuple[Optional[str], str]:
        for enc in cls.CHINESE_ENCODING_CANDIDATES:
            try:
                text = raw_bytes.decode(enc)
                return text, enc
            except (UnicodeDecodeError, LookupError):
                continue
        return None, "utf-8"

    @classmethod
    def _collect_candidates(cls, raw_bytes: bytes, encodings: List[str]) -> List[Tuple[str, str]]:
        """收集解码成功且 round-trip 校验一致的候选 (text, encoding)"""
        seen: Dict[str, Tuple[str, str]] = {}
        for enc in encodings:
            if not enc:
                continue
            try:
                text = raw_bytes.decode(enc)
            except (UnicodeDecodeError, LookupError):
                continue
            try:
                if text.encode(enc) != raw_bytes:
                    continue
            except Exception:
                continue
            seen.setdefault(enc, (text, enc))
        return list(seen.values())

    @classmethod
    def _score_text(cls, text: str) -> float:
        """文本质量评分：CJK 汉字加权，日文假名/韩文音节降权，替换字符重罚。
        用于在编码混淆（如 big5 内容被 normalizer 误判为 cp949）时选出正确编码。"""
        score = 0.0
        for ch in text:
            o = ord(ch)
            if 0x4E00 <= o <= 0x9FFF:      # CJK 统一汉字
                score += 3
            elif 0x3040 <= o <= 0x30FF:    # 日文假名
                score -= 5
            elif 0xAC00 <= o <= 0xD7AF:    # 韩文音节
                score -= 5
            elif ch == "\ufffd":           # 替换字符
                score -= 10
            elif ch.isascii() and (ch.isalnum() or ch.isspace()):
                score += 1
        return score
