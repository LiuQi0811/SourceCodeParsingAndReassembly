# parser/leyytv_parser.py
"""
leyy.tv 专用解析器。
leyy.tv 基于 MacCMS，播放页视频地址以 RC4 加密的十六进制字符串
存储在 JS 变量 urlDictionary 中，密钥为 "i_love_you"。
本解析器负责提取并解密这些地址，输出真实的 m3u8 / mp4 链接。
"""
from __future__ import annotations

import re
from typing import Any

from .base import ParserStrategy


class LeyyTvParser(ParserStrategy):
    """leyy.tv 播放页解析器：提取 urlDictionary 并 RC4 解密"""

    RC4_KEY = "i_love_you"

    # 匹配 urlDictionary[sid][nid] = "hex_string"
    _DICT_RE = re.compile(
        r'urlDictionary\s*\[\s*(\d+)\s*\]\s*\[\s*(\d+)\s*\]\s*=\s*"([0-9a-fA-F]+)"'
    )
    # 匹配当前播放的 firstSid / firstNid
    _FIRST_RE = re.compile(r'var\s+first(Sid|Nid)\s*=\s*(\d+)')

    def parse(self, content: str, rule: dict[str, Any]) -> dict[str, list]:
        result: dict[str, list] = {k: [] for k in rule}

        # 1. 提取加密地址并解密
        encrypted = self._DICT_RE.findall(content)
        m3u8_urls: list[str] = []
        for sid, nid, hex_str in encrypted:
            try:
                url = self._rc4_decrypt(hex_str)
                if url and url.startswith(("http://", "https://")):
                    m3u8_urls.append(url)
            except Exception:
                continue

        # 去重保序
        seen = set()
        unique_urls = []
        for u in m3u8_urls:
            if u not in seen:
                seen.add(u)
                unique_urls.append(u)

        # 2. 根据 URL 类型分配到对应字段
        videos: list[str] = []
        m3u8: list[str] = []
        mpd: list[str] = []
        for u in unique_urls:
            if ".m3u8" in u:
                m3u8.append(u)
            elif ".mpd" in u:
                mpd.append(u)
            else:
                videos.append(u)

        if "videos" in result:
            result["videos"] = videos
        if "m3u8" in result:
            result["m3u8"] = m3u8
        if "mpd" in result:
            result["mpd"] = mpd

        # 3. 标题提取（兼容通用规则）
        if "title" in rule:
            title_m = re.search(r'<title>([^<]+)</title>', content, re.I)
            if title_m:
                result["title"] = [title_m.group(1).strip()]

        # 4. 页面链接提取（兼容通用规则，用于继续爬取）
        if "links" in rule:
            links = re.findall(r'<a[^>]*href=["\']([^"\']+)["\']', content, re.I)
            result["links"] = links

        # 5. 图片提取
        if "images" in rule:
            images = re.findall(r'<img[^>]*src=["\']([^"\']+)["\']', content, re.I)
            result["images"] = images

        return result

    @classmethod
    def _rc4_decrypt(cls, encrypted_hex: str, key: str | None = None) -> str:
        """RC4 解密：十六进制密文 -> 明文 URL"""
        k = (key or cls.RC4_KEY).encode("utf-8")
        data = bytes.fromhex(encrypted_hex)

        # KSA
        s = list(range(256))
        j = 0
        klen = len(k)
        for i in range(256):
            j = (j + s[i] + k[i % klen]) % 256
            s[i], s[j] = s[j], s[i]

        # PRGA
        i = 0
        j = 0
        out = bytearray()
        for byte in data:
            i = (i + 1) % 256
            j = (j + s[i]) % 256
            s[i], s[j] = s[j], s[i]
            ks = s[(s[i] + s[j]) % 256]
            out.append(byte ^ ks)

        return out.decode("utf-8", errors="replace")
