# storage/file_manager.py
from __future__ import annotations

import re
from pathlib import Path
from urllib.parse import urlparse


class ResourceClassifier:
    """资源类型识别"""

    EXT_MAP = {
        "image": {".jpg", ".jpeg", ".png", ".gif", ".webp", ".bmp",
                  ".svg", ".ico", ".avif"},
        "video": {".mp4", ".mkv", ".avi", ".mov", ".webm", ".flv",
                  ".ts", ".m3u8", ".mpd", ".m4v", ".wmv"},
        "audio": {".mp3", ".aac", ".flac", ".wav", ".ogg", ".m4a",
                  ".opus", ".wma"},
        "document": {".pdf", ".doc", ".docx", ".xls", ".xlsx", ".ppt",
                     ".pptx", ".txt", ".md", ".epub"},
        "archive": {".zip", ".rar", ".7z", ".tar", ".gz", ".bz2", ".xz"},
    }

    @classmethod
    def classify(cls, url: str, content_type: str = "") -> str:
        ct = (content_type or "").lower()
        if ct:
            if ct.startswith("image/"):
                return "image"
            if ct.startswith("video/"):
                return "video"
            if ct.startswith("audio/"):
                return "audio"
            if "mpegurl" in ct or "dash+xml" in ct:
                return "video"
            # text/html 是页面，需要解析而非下载；纯文本才算 document
            if "pdf" in ct or "word" in ct or "excel" in ct \
                    or "powerpoint" in ct \
                    or (ct.startswith("text/") and not ct.startswith("text/html")):
                return "document"
            if "zip" in ct or "rar" in ct or "compressed" in ct:
                return "archive"

        ext = Path(urlparse(url).path).suffix.lower()
        for rtype, exts in cls.EXT_MAP.items():
            if ext in exts:
                return rtype
        return "other"


class FileManager:
    """
    文件管理器：以标题为顶级目录，按资源类型子目录分类。
    支持资源分组（同一标题下的多条线路）。
    """

    _ILLEGAL = re.compile(r'[<>:"/\\|?*\x00-\x1f]')

    def __init__(self, base_dir: str | Path = "./downloads"):
        self.base_dir = Path(base_dir)
        self.base_dir.mkdir(parents=True, exist_ok=True)

    def get_save_path(
        self,
        title: str | None,
        resource_type: str,
        group: str | None = None,
        filename: str | None = None,
    ) -> Path:
        dir_path = self.base_dir / self._sanitize(title or "untitled")
        dir_path = dir_path / self._sanitize(resource_type or "other")
        if group:
            dir_path = dir_path / self._sanitize(group)
        dir_path.mkdir(parents=True, exist_ok=True)

        if filename:
            return dir_path / self._sanitize_filename(filename)
        return dir_path

    @classmethod
    def _sanitize(cls, name: str) -> str:
        name = cls._ILLEGAL.sub("_", str(name)).strip(". ")
        return (name[:200] or "untitled")

    @classmethod
    def _sanitize_filename(cls, filename: str) -> str:
        p = Path(filename)
        stem = cls._sanitize(p.stem)
        suffix = p.suffix[:16]
        return f"{stem}{suffix}"
