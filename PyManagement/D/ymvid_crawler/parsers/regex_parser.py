import re
from urllib.parse import urljoin
from .base import BaseParser


class RegexParser(BaseParser):
    def parse_links(self, text: str, base_url: str) -> list[dict]:
        links = []
        for m in re.finditer(r'<a[^>]+href\s*=\s*["\']([^"\']+)["\']',
                             text, re.I):
            href = m.group(1).strip()
            if href.startswith(("javascript:", "#", "mailto:", "tel:")):
                continue
            links.append({"url": urljoin(base_url, href), "type": "page"})
        return links

    def parse_resources(self, text: str, base_url: str) -> list[dict]:
        resources = []
        patterns = {
            "img": r'<img[^>]+(?:src|data-src|data-original)\s*=\s*["\']([^"\']+)["\']',
            "video": r'(?:<video[^>]+src|<source[^>]+src)\s*=\s*["\']([^"\']+)["\']',
            "video_attr": r'data-(?:video|video-src|video-url)\s*=\s*["\']([^"\']+)["\']',
            "meta_video": r'<meta[^>]+content\s*=\s*["\']([^"\']+\.(?:mp4|m3u8|webm|mkv|mov|flv|mpd)(?:[?#][^"\']*)?)["\']',
            "media_link": r'<a[^>]+href\s*=\s*["\']([^"\']+\.(?:mp4|m3u8|webm|mkv|mov|flv|mpd|ts)(?:[?#][^"\']*)?)["\']',
            "js_config": r'["\'](?:url|src|video|play_url|mp4_url|hls_url)["\']\s*:\s*["\']([^"\']+\.(?:m3u8|mp4|mpd|webm|mkv)(?:[?#][^"\']*)?)["\']',
            "css": r'<link[^>]+href\s*=\s*["\']([^"\']+\.css[^"\']*)["\']',
            "js": r'<script[^>]+src\s*=\s*["\']([^"\']+)["\']',
        }
        for _rtype, pat in patterns.items():
            for m in re.finditer(pat, text, re.I):
                url = urljoin(base_url, m.group(1))
                resources.append({"url": url, "type": "video" if "video" in _rtype or _rtype in ("meta_video", "media_link", "js_config") else _rtype})
        return resources

    def parse_title(self, text: str) -> str:
        m = re.search(r'<title[^>]*>(.*?)</title>', text, re.I | re.S)
        return m.group(1).strip() if m else ""
