# -*- coding: utf-8 -*-
"""解析器抽象基类 + 流媒体正则"""
import re
from abc import ABC, abstractmethod


# 各类型流媒体的 URL 匹配（用于全局兜底）
STREAM_PATTERNS = [
    (re.compile(r'https?://[^\s"\'<>\\]+\.m3u8[^\s"\'<>\\]*', re.I), "hls"),
    (re.compile(r'https?://[^\s"\'<>\\]+\.mpd[^\s"\'<>\\]*',  re.I), "dash"),
    (re.compile(r'https?://[^\s"\'<>\\]+\.flv[^\s"\'<>\\]*',  re.I), "flv"),
    (re.compile(r'rtmp://[^\s"\'<>\\]+', re.I), "rtmp"),
    (re.compile(r'rtsp://[^\s"\'<>\\]+', re.I), "rtsp"),
]


class BaseParser(ABC):
    """解析器抽象基类"""
    name: str = ""

    @abstractmethod
    def parse_links(self, html_text: str, base_url: str) -> list[str]: ...

    @abstractmethod
    def parse_title(self, html_text: str) -> str: ...

    @abstractmethod
    def parse_resources(self, html_text: str, base_url: str) -> list[dict]: ...

    @abstractmethod
    def parse_streams(self, html_text: str, base_url: str) -> list[dict]: ...