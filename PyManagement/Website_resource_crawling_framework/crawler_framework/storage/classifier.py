"""
资源分类识别模块
基于 Content-Type MIME、文件 Magic 字节特征与 URL 扩展名进行多维度精确识别
"""
import mimetypes
import os
import re
from urllib.parse import urlparse
from typing import Tuple
from crawler_framework.core.models import ResourceCategory


class ResourceClassifier:
    """资源类型智能分类器"""

    # 常见 MIME 到 ResourceCategory 的映射字典
    MIME_MAP = {
        # HTML 页面
        "text/html": ResourceCategory.PAGE,
        "application/xhtml+xml": ResourceCategory.PAGE,
        # 图片
        "image/jpeg": ResourceCategory.IMAGE,
        "image/png": ResourceCategory.IMAGE,
        "image/gif": ResourceCategory.IMAGE,
        "image/webp": ResourceCategory.IMAGE,
        "image/svg+xml": ResourceCategory.IMAGE,
        "image/x-icon": ResourceCategory.IMAGE,
        "image/bmp": ResourceCategory.IMAGE,
        "image/tiff": ResourceCategory.IMAGE,
        # 视频
        "video/mp4": ResourceCategory.VIDEO,
        "video/webm": ResourceCategory.VIDEO,
        "video/x-matroska": ResourceCategory.VIDEO,
        "video/quicktime": ResourceCategory.VIDEO,
        "video/x-msvideo": ResourceCategory.VIDEO,
        "video/x-flv": ResourceCategory.VIDEO,
        # 音频
        "audio/mpeg": ResourceCategory.AUDIO,
        "audio/ogg": ResourceCategory.AUDIO,
        "audio/wav": ResourceCategory.AUDIO,
        "audio/x-wav": ResourceCategory.AUDIO,
        "audio/aac": ResourceCategory.AUDIO,
        "audio/flac": ResourceCategory.AUDIO,
        "audio/mp4": ResourceCategory.AUDIO,
        # 文档
        "application/pdf": ResourceCategory.DOCUMENT,
        "application/msword": ResourceCategory.DOCUMENT,
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document": ResourceCategory.DOCUMENT,
        "application/vnd.ms-excel": ResourceCategory.DOCUMENT,
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": ResourceCategory.DOCUMENT,
        "application/vnd.ms-powerpoint": ResourceCategory.DOCUMENT,
        "application/vnd.openxmlformats-officedocument.presentationml.presentation": ResourceCategory.DOCUMENT,
        "text/plain": ResourceCategory.DOCUMENT,
        "text/markdown": ResourceCategory.DOCUMENT,
        "text/csv": ResourceCategory.DOCUMENT,
        # 压缩包
        "application/zip": ResourceCategory.ARCHIVE,
        "application/x-rar-compressed": ResourceCategory.ARCHIVE,
        "application/x-7z-compressed": ResourceCategory.ARCHIVE,
        "application/x-tar": ResourceCategory.ARCHIVE,
        "application/gzip": ResourceCategory.ARCHIVE,
        # 代码/样式/脚本
        "text/css": ResourceCategory.CODE,
        "application/javascript": ResourceCategory.CODE,
        "text/javascript": ResourceCategory.CODE,
        "application/x-javascript": ResourceCategory.CODE,
        # 数据接口
        "application/json": ResourceCategory.DATA,
        "text/xml": ResourceCategory.DATA,
        "application/xml": ResourceCategory.DATA,
    }

    # 扩展名到分类的映射
    EXTENSION_MAP = {
        # 图片
        ".jpg": ResourceCategory.IMAGE,
        ".jpeg": ResourceCategory.IMAGE,
        ".png": ResourceCategory.IMAGE,
        ".gif": ResourceCategory.IMAGE,
        ".webp": ResourceCategory.IMAGE,
        ".svg": ResourceCategory.IMAGE,
        ".ico": ResourceCategory.IMAGE,
        ".bmp": ResourceCategory.IMAGE,
        ".tiff": ResourceCategory.IMAGE,
        # 视频
        ".mp4": ResourceCategory.VIDEO,
        ".mkv": ResourceCategory.VIDEO,
        ".avi": ResourceCategory.VIDEO,
        ".mov": ResourceCategory.VIDEO,
        ".wmv": ResourceCategory.VIDEO,
        ".flv": ResourceCategory.VIDEO,
        ".webm": ResourceCategory.VIDEO,
        ".m4v": ResourceCategory.VIDEO,
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
        ".md": ResourceCategory.DOCUMENT,
        ".csv": ResourceCategory.DOCUMENT,
        # 压缩包
        ".zip": ResourceCategory.ARCHIVE,
        ".rar": ResourceCategory.ARCHIVE,
        ".7z": ResourceCategory.ARCHIVE,
        ".tar": ResourceCategory.ARCHIVE,
        ".gz": ResourceCategory.ARCHIVE,
        ".bz2": ResourceCategory.ARCHIVE,
        # 脚本/样式
        ".css": ResourceCategory.CODE,
        ".js": ResourceCategory.CODE,
        ".ts": ResourceCategory.CODE,
        # 数据
        ".json": ResourceCategory.DATA,
        ".xml": ResourceCategory.DATA,
        # 页面
        ".html": ResourceCategory.PAGE,
        ".htm": ResourceCategory.PAGE,
        ".shtml": ResourceCategory.PAGE,
    }

    # 文件头部 Magic 签名检测
    MAGIC_SIGNATURES = [
        (b"\x89PNG\r\n\x1a\n", ResourceCategory.IMAGE, ".png"),
        (b"\xff\xd8\xff", ResourceCategory.IMAGE, ".jpg"),
        (b"GIF87a", ResourceCategory.IMAGE, ".gif"),
        (b"GIF89a", ResourceCategory.IMAGE, ".gif"),
        (b"RIFF", ResourceCategory.IMAGE, ".webp"),  # 需辅助判断WEBP
        (b"%PDF", ResourceCategory.DOCUMENT, ".pdf"),
        (b"PK\x03\x04", ResourceCategory.ARCHIVE, ".zip"),  # docx/xlsx也是PK，后续细化
        (b"\x1f\x8b\x08", ResourceCategory.ARCHIVE, ".gz"),
        (b"Rar!\x1a\x07", ResourceCategory.ARCHIVE, ".rar"),
        (b"7z\xbc\xaf\x27\x1c", ResourceCategory.ARCHIVE, ".7z"),
    ]

    @classmethod
    def classify(cls, url: str, content_type_header: str = "", raw_bytes: bytes = b"") -> Tuple[ResourceCategory, str]:
        """
        综合分析判断资源所属分类及推荐扩展名
        :return: (ResourceCategory, 推荐文件扩展名如 ".jpg")
        """
        # 1. 优先从 Content-Type MIME 分析
        clean_mime = ""
        if content_type_header:
            clean_mime = content_type_header.split(";")[0].strip().lower()
            if clean_mime in cls.MIME_MAP:
                ext = mimetypes.guess_extension(clean_mime) or ""
                return cls.MIME_MAP[clean_mime], ext

        # 2. 从 URL 路径中提取扩展名
        parsed = urlparse(url)
        path = parsed.path
        _, ext = os.path.splitext(path)
        ext = ext.lower()
        if ext and ext in cls.EXTENSION_MAP:
            return cls.EXTENSION_MAP[ext], ext

        # 3. 从文件 Magic 字节签名判断
        if raw_bytes and len(raw_bytes) >= 16:
            for magic, cat, magic_ext in cls.MAGIC_SIGNATURES:
                if raw_bytes.startswith(magic):
                    if magic == b"RIFF" and b"WEBP" in raw_bytes[:16]:
                        return ResourceCategory.IMAGE, ".webp"
                    return cat, magic_ext

        # 4. 根据文本特征判断是否为 HTML
        if raw_bytes and len(raw_bytes) > 0:
            sample = raw_bytes[:512].lower()
            if b"<!doctype html" in sample or b"<html" in sample:
                return ResourceCategory.PAGE, ".html"

        # 5. 兜底为 OTHER
        return ResourceCategory.OTHER, ext or ".bin"
