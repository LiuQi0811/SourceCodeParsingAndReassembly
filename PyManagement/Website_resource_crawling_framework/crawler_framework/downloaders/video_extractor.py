"""
视频流媒体资源 URL 提取器
从 HTML 中识别 HLS(m3u8)、DASH(mpd)、HTTP-FLV、RTMP、RTSP、WebRTC 等流媒体地址
"""
import re
from typing import Any, Dict, List, Optional
from urllib.parse import urldefrag, urljoin
from bs4 import BeautifulSoup


# 流媒体协议 URL 正则
STREAM_PATTERNS = [
    (re.compile(r'https?://[^\s"\'<>]+\.m3u8[^\s"\'<>]*', re.I), "hls"),
    (re.compile(r'https?://[^\s"\'<>]+\.mpd[^\s"\'<>]*', re.I), "dash"),
    (re.compile(r'https?://[^\s"\'<>]+\.flv[^\s"\'<>]*', re.I), "flv"),
    (re.compile(r'rtmp://[^\s"\'<>]+', re.I), "rtmp"),
    (re.compile(r'rtsp://[^\s"\'<>]+', re.I), "rtsp"),
    (re.compile(r'wss?://[^\s"\'<>]+', re.I), "webrtc"),
]

# 常见视频文件后缀
VIDEO_EXT_PATTERN = re.compile(r"\.(mp4|mkv|webm|avi|mov|m3u8|flv|ts)(?:\?|$)", re.I)

# JSON 配置中的视频字段
JSON_URL_PATTERN = re.compile(
    r'"(?:src|url|source|file|m3u8|videoUrl|playUrl|stream|video)"\s*:\s*"([^"]+)"',
    re.I,
)


class VideoExtractor:
    """从页面中提取所有流媒体视频地址"""

    @classmethod
    def extract(cls, html: str, base_url: str) -> List[Dict[str, Any]]:
        if not html:
            return []
        results: List[Dict[str, Any]] = []
        seen: set = set()

        # 1. 正则扫描全文流媒体 URL
        for pattern, stream_type in STREAM_PATTERNS:
            for match in pattern.finditer(html):
                url = match.group(0).rstrip(",;)")
                clean = cls._clean(url, base_url)
                if clean and clean not in seen:
                    seen.add(clean)
                    results.append({"url": clean, "type": stream_type, "source": "regex"})

        # 2. 解析 HTML 标签
        soup = BeautifulSoup(html, "html.parser")
        for tag in soup.find_all(["video", "source", "amp-video", "embed", "object", "param"]):
            src = tag.get("src") or tag.get("data-src") or tag.get("data-original") or ""
            value = tag.get("value") or ""
            for cand in (src, value):
                if cand and (any(p[0].search(cand) for p in STREAM_PATTERNS) or VIDEO_EXT_PATTERN.search(cand)):
                    clean = cls._clean(cand, base_url)
                    if clean and clean not in seen:
                        seen.add(clean)
                        results.append({"url": clean, "type": cls._guess_type(clean), "source": "tag"})

        # 3. JSON 配置中的视频地址（播放器配置）
        for match in JSON_URL_PATTERN.finditer(html):
            url = match.group(1)
            if any(p[0].search(url) for p in STREAM_PATTERNS) or VIDEO_EXT_PATTERN.search(url):
                clean = cls._clean(url, base_url)
                if clean and clean not in seen:
                    seen.add(clean)
                    results.append({"url": clean, "type": cls._guess_type(clean), "source": "json"})

        return results[:50]

    @staticmethod
    def _clean(url: str, base_url: str) -> Optional[str]:
        url = url.strip().replace("\\/", "/")
        if url.startswith(("javascript:", "data:", "#")):
            return None
        abs_url = urljoin(base_url, url)
        defrag, _ = urldefrag(abs_url)
        if not defrag.startswith(("http://", "https://", "rtmp://", "rtsp://", "ws://", "wss://")):
            return None
        return defrag

    @staticmethod
    def _guess_type(url: str) -> str:
        low = url.lower()
        if ".m3u8" in low:
            return "hls"
        if ".mpd" in low:
            return "dash"
        if ".flv" in low:
            return "flv"
        if low.startswith("rtmp"):
            return "rtmp"
        if low.startswith("rtsp"):
            return "rtsp"
        if low.startswith("ws"):
            return "webrtc"
        return "video"