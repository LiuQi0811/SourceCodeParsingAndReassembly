"""
自动字符集智能识别与转码模块（彻底杜绝中文乱码）
支持 HTTP Header、HTML Meta、charset-normalizer 字节分析以及 GB18030/GBK/GB2312/UTF-8 多级回退
"""
import re
from typing import Dict, List, Optional, Tuple
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

        # 3.5 声明编码优先尝试（声明是最强信号）
        if detected_charset:
            try:
                text = raw_bytes.decode(detected_charset)
                return text, detected_charset
            except (UnicodeDecodeError, LookupError):
                pass

        # 4. 多候选解码评分：normalizer 全部候选 + 中文回退链，按文本质量选优
        candidates: List[Tuple[str, str]] = []
        try:
            results = charset_normalizer.from_bytes(raw_bytes)
            norm_encs = []
            for m in results:
                if m.encoding:
                    enc = cls.ENCODING_ALIASES.get(m.encoding.lower(), m.encoding.lower())
                    norm_encs.append(enc)
            candidates.extend(cls._collect_candidates(raw_bytes, norm_encs))
        except Exception:
            pass
        candidates.extend(cls._collect_candidates(
            raw_bytes, ["utf-8", "gb18030", "big5", "windows-1252", "latin-1"]
        ))
        if candidates:
            text, enc = max(candidates, key=lambda t: cls._score_text(t[0]))
            return text, enc

        # 5. 终极容错保障：utf-8 replace 模式，避免程序抛出异常崩溃
        return raw_bytes.decode("utf-8", errors="replace"), "utf-8-lossy"

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
            # round-trip 校验：重编码必须还原原始字节，排除错乱映射
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
