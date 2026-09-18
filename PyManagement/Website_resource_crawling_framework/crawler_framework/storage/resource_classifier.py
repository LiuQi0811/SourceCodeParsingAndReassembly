"""
资源类型自动分类与推断器
依据 HTTP Content-Type、URL 后缀扩展名与魔数 (Magic Bytes) 综合判定
归类到图片、视频、音频、文档、压缩包、代码、数据接口等分类
"""
import mimetypes
import os
import re
from typing import Optional, Tuple
from urllib.parse import urlparse
from crawler_framework.core.models import ResourceCategory


class ResourceClassifier:
    """全站资源类型识别器"""

    # 扩展名与分类映射表
    EXTENSION_MAP = {
        # 图片
        ".jpg": ResourceCategory.IMAGE,
        ".jpeg": ResourceCategory.IMAGE,
        ".png": ResourceCategory.IMAGE,
        ".gif": ResourceCategory.IMAGE,
        ".webp": ResourceCategory.IMAGE,
        ".svg": ResourceCategory.IMAGE,
        ".bmp": ResourceCategory.IMAGE,
        ".ico": ResourceCategory.IMAGE,
        ".tiff": ResourceCategory.IMAGE,
        ".avif": ResourceCategory.IMAGE,
        # 视频
        ".mp4": ResourceCategory.VIDEO,
        ".mkv": ResourceCategory.VIDEO,
        ".webm": ResourceCategory.VIDEO,
        ".avi": ResourceCategory.VIDEO,
        ".mov": ResourceCategory.VIDEO,
        ".flv": ResourceCategory.VIDEO,
        ".wmv": ResourceCategory.VIDEO,
        ".m3u8": ResourceCategory.VIDEO,
        ".ts": ResourceCategory.VIDEO,
        # 音频
        ".mp3": ResourceCategory.AUDIO,
        ".wav": ResourceCategory.AUDIO,
        ".ogg": ResourceCategory.AUDIO,
        ".flac": ResourceCategory.AUDIO,
        ".aac": ResourceCategory.AUDIO,
        ".m4a": ResourceCategory.AUDIO,
        # 文档
        ".pdf": ResourceCategory.DOCUMENT,
        ".doc": ResourceCategory.DOCUMENT,
        ".docx": ResourceCategory.DOCUMENT,
        ".xls": ResourceCategory.DOCUMENT,
        ".xlsx": ResourceCategory.DOCUMENT,
        ".ppt": ResourceCategory.DOCUMENT,
        ".pptx": ResourceCategory.DOCUMENT,
        ".txt": ResourceCategory.DOCUMENT,
        ".csv": ResourceCategory.DOCUMENT,
        ".epub": ResourceCategory.DOCUMENT,
        # 压缩包
        ".zip": ResourceCategory.ARCHIVE,
        ".tar": ResourceCategory.ARCHIVE,
        ".gz": ResourceCategory.ARCHIVE,
        ".7z": ResourceCategory.ARCHIVE,
        ".rar": ResourceCategory.ARCHIVE,
        # 脚本与样式
        ".js": ResourceCategory.CODE,
        ".css": ResourceCategory.CODE,
        ".scss": ResourceCategory.CODE,
        ".less": ResourceCategory.CODE,
        ".ts": ResourceCategory.CODE,
        # 网页
        ".html": ResourceCategory.PAGE,
        ".htm": ResourceCategory.PAGE,
        ".shtml": ResourceCategory.PAGE,
        ".jsp": ResourceCategory.PAGE,
        ".php": ResourceCategory.PAGE,
        ".asp": ResourceCategory.PAGE,
        ".aspx": ResourceCategory.PAGE,
        # 数据接口
        ".json": ResourceCategory.DATA,
        ".xml": ResourceCategory.DATA,
    }

    # MIME 前缀映射表
    MIME_PREFIX_MAP = {
        "image/": ResourceCategory.IMAGE,
        "video/": ResourceCategory.VIDEO,
        "audio/": ResourceCategory.AUDIO,
        "application/pdf": ResourceCategory.DOCUMENT,
        "application/msword": ResourceCategory.DOCUMENT,
        "application/vnd.openxmlformats": ResourceCategory.DOCUMENT,
        "application/vnd.ms-": ResourceCategory.DOCUMENT,
        "application/zip": ResourceCategory.ARCHIVE,
        "application/x-rar": ResourceCategory.ARCHIVE,
        "application/x-7z": ResourceCategory.ARCHIVE,
        "application/x-tar": ResourceCategory.ARCHIVE,
        "application/gzip": ResourceCategory.ARCHIVE,
        "text/javascript": ResourceCategory.CODE,
        "application/javascript": ResourceCategory.CODE,
        "text/css": ResourceCategory.CODE,
        "application/json": ResourceCategory.DATA,
        "text/xml": ResourceCategory.DATA,
        "application/xml": ResourceCategory.DATA,
        "text/html": ResourceCategory.PAGE,
    }

    @classmethod
    def classify(
        cls,
        url: str,
        content_type: Optional[str] = None,
        raw_bytes: Optional[bytes] = None
    ) -> ResourceCategory:
        """
        综合判断资源所属类别
        :param url: 请求的URL
        :param content_type: 响应头 Content-Type
        :param raw_bytes: 原始响应字节（可辅助魔数判断）
        :return: ResourceCategory 分类枚举
        """
        # 1. 优先通过 Content-Type 判定
        if content_type:
            ct = content_type.split(";")[0].strip().lower()
            for prefix, cat in cls.MIME_PREFIX_MAP.items():
                if ct.startswith(prefix):
                    return cat

        # 2. 通过 URL 路径后缀扩展名判定
        parsed = urlparse(url)
        path = parsed.path.lower()
        _, ext = os.path.splitext(path)
        if ext and ext in cls.EXTENSION_MAP:
            return cls.EXTENSION_MAP[ext]

        # 3. 通过文件魔数 (Magic Bytes) 判定
        if raw_bytes and len(raw_bytes) >= 8:
            cat = cls._classify_by_magic(raw_bytes)
            if cat is not None:
                return cat

        # 4. 默认如果包含 <html 视作网页，否则视作其他
        if raw_bytes and b"<html" in raw_bytes[:1024].lower():
            return ResourceCategory.PAGE

        return ResourceCategory.OTHER

    @classmethod
    def _classify_by_magic(cls, data: bytes) -> Optional[ResourceCategory]:
        # JPEG: FF D8 FF
        if data.startswith(b"\xff\xd8\xff"):
            return ResourceCategory.IMAGE
        # PNG: 89 50 4E 47 0D 0A 1A 0A
        if data.startswith(b"\x89PNG\r\n\x1a\n"):
            return ResourceCategory.IMAGE
        # GIF: GIF87a 或 GIF89a
        if data.startswith(b"GIF87a") or data.startswith(b"GIF89a"):
            return ResourceCategory.IMAGE
        # WEBP: RIFF....WEBP
        if data.startswith(b"RIFF") and b"WEBP" in data[:12]:
            return ResourceCategory.IMAGE
        # PDF: %PDF-
        if data.startswith(b"%PDF-"):
            return ResourceCategory.DOCUMENT
        # ZIP / Office openxml: PK\x03\x04
        if data.startswith(b"PK\x03\x04"):
            return ResourceCategory.ARCHIVE
        # MP3 (ID3)
        if data.startswith(b"ID3"):
            return ResourceCategory.AUDIO
        # MP4 (ftyp)
        if len(data) >= 12 and data[4:8] == b"ftyp":
            return ResourceCategory.VIDEO
        return None
