"""资源类型识别与分类目录规划"""
import re
from pathlib import Path
from urllib.parse import urlparse


class ResourceClassifier:
    EXT_CATEGORY = {
        ".jpg": "images", ".jpeg": "images", ".png": "images",
        ".gif": "images", ".webp": "images", ".svg": "images", ".bmp": "images",
        ".mp4": "videos", ".mkv": "videos", ".avi": "videos",
        ".mov": "videos", ".flv": "videos", ".webm": "videos",
        ".ts": "videos/ts_segments",
        ".m3u8": "videos/playlists", ".mpd": "videos/playlists",
        ".mp3": "audio", ".aac": "audio", ".ogg": "audio", ".flac": "audio",
        ".pdf": "documents", ".docx": "documents", ".doc": "documents",
        ".xlsx": "documents", ".pptx": "documents",
        ".zip": "archives", ".rar": "archives", ".7z": "archives",
        ".json": "data", ".xml": "data", ".csv": "data",
        ".css": "web_assets", ".js": "web_assets",
    }

    STREAM_PATTERNS = {
        "hls": re.compile(r'\.m3u8(?:\?|$)', re.I),
        "dash": re.compile(r'\.mpd(?:\?|$)', re.I),
        "flv": re.compile(r'\.flv(?:\?|$)', re.I),
        "rtmp": re.compile(r'^rtmps?://', re.I),
        "rtsp": re.compile(r'^rtsp://', re.I),
        "webrtc": re.compile(r'^wss?://.*(?:webrtc|rtc)', re.I),
    }

    @classmethod
    def classify_by_url(cls, url: str, content_type: str = "") -> str:
        for stream_type, pattern in cls.STREAM_PATTERNS.items():
            if pattern.search(url):
                return stream_type

        ext = cls.get_ext(url)
        if ext in cls.EXT_CATEGORY:
            cat = cls.EXT_CATEGORY[ext]
            if cat.startswith("images"):    return "image"
            if cat.startswith("videos"):    return "video"
            if cat.startswith("audio"):     return "audio"
            if cat.startswith("documents"): return "document"
            if cat.startswith("archives"):  return "archive"
            return "other"

        if content_type:
            ctype = content_type.split(";")[0].strip().lower()
            if ctype.startswith("image/"): return "image"
            if ctype.startswith("video/"): return "video"
            if ctype.startswith("audio/"): return "audio"
            if ctype == "application/pdf": return "document"

        return "unknown"

    @classmethod
    def get_save_dir(cls, base_dir: str, title: str, url: str,
                     content_type: str = "") -> Path:
        safe_title = cls.sanitize_filename(title)
        res_type = cls.classify_by_url(url, content_type)

        category_map = {
            "image": "images", "video": "videos", "audio": "audio",
            "document": "documents", "archive": "archives",
            "other": "other", "unknown": "other",
            "hls": "videos/hls", "dash": "videos/dash", "flv": "videos/flv",
            "rtmp": "videos/streams", "rtsp": "videos/streams",
            "webrtc": "videos/streams",
        }
        sub = category_map.get(res_type, "other")
        return Path(base_dir) / safe_title / sub

    @staticmethod
    def get_ext(url: str) -> str:
        path = urlparse(url).path
        return Path(path).suffix.lower()

    @staticmethod
    def sanitize_filename(name: str) -> str:
        name = re.sub(r'[<>:"/\\|?*\x00-\x1f]', "_", name)
        name = re.sub(r'\s+', " ", name).strip()
        return (name[:120] or "untitled")