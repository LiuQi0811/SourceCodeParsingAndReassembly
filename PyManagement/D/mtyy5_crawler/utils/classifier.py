# -*- coding: utf-8 -*-
"""资源类型分类"""
import os
from pathlib import Path
from urllib.parse import urlparse

from config import Config
from utils.filenames import safe_name


class ResourceClassifier:
    def __init__(self, config: Config):
        self.config = config

    def classify(self, url: str, content_type: str = "") -> str:
        """按扩展名 + Content-Type 判断资源类型"""
        path = urlparse(url).path.lower()
        ext = os.path.splitext(path)[1].lower()
        for rtype, info in self.config.resource_types.items():
            if ext in info["exts"]:
                return rtype

        ct = (content_type or "").lower()
        if ct.startswith("image/"):
            return "image"
        if ct.startswith("video/"):
            return "video"
        if ct.startswith("audio/"):
            return "audio"
        if "mpegurl" in ct or "dash" in ct:
            return "stream"
        if ct.startswith(("application/pdf", "application/msword",
                          "application/zip", "application/x-rar",
                          "application/x-7z")):
            return "document"
        return "other"

    def get_dir(self, rtype: str, title: str) -> Path:
        """<output>/<标题>/<分类子目录>"""
        base = Path(self.config.output_dir) / safe_name(title)
        sub = self.config.resource_types.get(rtype, {}).get("dir", "others")
        return base / sub

    def get_ext(self, url: str) -> str:
        ext = os.path.splitext(urlparse(url).path)[1].lower()
        return ext if ext and len(ext) <= 8 else ".bin"