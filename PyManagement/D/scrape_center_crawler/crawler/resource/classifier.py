# -*- coding: utf-8 -*-
"""
资源类型自动识别（分类器）
识别依据优先级：magic bytes（内容嗅探） -> Content-Type -> URL 扩展名
支持自定义资源类型（扩展名 / Content-Type / magic 三通道匹配）。
"""
from __future__ import annotations

import mimetypes
from typing import Dict, List, Optional

from ..constants import ResourceType
from ..utils import ext_from_url

# 扩展名 -> 内置类型
_EXT_TYPES: Dict[str, str] = {
    # image
    "jpg": ResourceType.IMAGE, "jpeg": ResourceType.IMAGE, "png": ResourceType.IMAGE,
    "gif": ResourceType.IMAGE, "webp": ResourceType.IMAGE, "bmp": ResourceType.IMAGE,
    "svg": ResourceType.IMAGE, "ico": ResourceType.IMAGE, "avif": ResourceType.IMAGE,
    "heic": ResourceType.IMAGE, "tiff": ResourceType.IMAGE,
    # video
    "mp4": ResourceType.VIDEO, "mkv": ResourceType.VIDEO, "avi": ResourceType.VIDEO,
    "mov": ResourceType.VIDEO, "flv": ResourceType.VIDEO, "ts": ResourceType.VIDEO,
    "m3u8": ResourceType.VIDEO, "mpd": ResourceType.VIDEO, "wmv": ResourceType.VIDEO,
    "webm": ResourceType.VIDEO, "rmvb": ResourceType.VIDEO, "rm": ResourceType.VIDEO,
    "m4v": ResourceType.VIDEO, "3gp": ResourceType.VIDEO,
    # audio
    "mp3": ResourceType.AUDIO, "wav": ResourceType.AUDIO, "ogg": ResourceType.AUDIO,
    "flac": ResourceType.AUDIO, "aac": ResourceType.AUDIO, "m4a": ResourceType.AUDIO,
    "wma": ResourceType.AUDIO, "opus": ResourceType.AUDIO, "amr": ResourceType.AUDIO,
    # document
    "pdf": ResourceType.DOCUMENT, "doc": ResourceType.DOCUMENT, "docx": ResourceType.DOCUMENT,
    "xls": ResourceType.DOCUMENT, "xlsx": ResourceType.DOCUMENT, "ppt": ResourceType.DOCUMENT,
    "pptx": ResourceType.DOCUMENT, "txt": ResourceType.DOCUMENT, "rtf": ResourceType.DOCUMENT,
    "epub": ResourceType.DOCUMENT, "mobi": ResourceType.DOCUMENT, "md": ResourceType.DOCUMENT,
    "html": ResourceType.DOCUMENT, "htm": ResourceType.DOCUMENT,
    # archive
    "zip": ResourceType.ARCHIVE, "rar": ResourceType.ARCHIVE, "7z": ResourceType.ARCHIVE,
    "tar": ResourceType.ARCHIVE, "gz": ResourceType.ARCHIVE, "bz2": ResourceType.ARCHIVE,
    "xz": ResourceType.ARCHIVE, "zst": ResourceType.ARCHIVE,
    # code
    "js": ResourceType.CODE, "css": ResourceType.CODE, "py": ResourceType.CODE,
    "java": ResourceType.CODE, "c": ResourceType.CODE, "cpp": ResourceType.CODE,
    "h": ResourceType.CODE, "go": ResourceType.CODE, "rs": ResourceType.CODE,
    "json": ResourceType.DATA, "xml": ResourceType.DATA, "csv": ResourceType.DATA,
    "yaml": ResourceType.DATA, "yml": ResourceType.DATA, "sql": ResourceType.DATA,
}

# magic bytes 嗅探：bytes 前缀 -> 类型（含可用的扩展名）
_MAGIC_SNIFFERS: List[Dict[str, str]] = [
    {"type": ResourceType.IMAGE, "ext": "jpg", "magic": b"\xff\xd8\xff"},
    {"type": ResourceType.IMAGE, "ext": "png", "magic": b"\x89PNG\r\n\x1a\n"},
    {"type": ResourceType.IMAGE, "ext": "gif", "magic": b"GIF8"},
    {"type": ResourceType.IMAGE, "ext": "webp", "magic": b"RIFF"},
    {"type": ResourceType.IMAGE, "ext": "bmp", "magic": b"BM"},
    {"type": ResourceType.IMAGE, "ext": "svg", "magic": b"<svg"},
    {"type": ResourceType.VIDEO, "ext": "flv", "magic": b"FLV"},
    {"type": ResourceType.VIDEO, "ext": "webm", "magic": b"\x1a\x45\xdf\xa3"},
    {"type": ResourceType.VIDEO, "ext": "mp4", "magic": b"\x00\x00\x00"},
    {"type": ResourceType.AUDIO, "ext": "mp3", "magic": b"ID3"},
    {"type": ResourceType.AUDIO, "ext": "ogg", "magic": b"OggS"},
    {"type": ResourceType.AUDIO, "ext": "flac", "magic": b"fLaC"},
    {"type": ResourceType.DOCUMENT, "ext": "pdf", "magic": b"%PDF"},
    {"type": ResourceType.ARCHIVE, "ext": "zip", "magic": b"PK\x03\x04"},
    {"type": ResourceType.ARCHIVE, "ext": "rar", "magic": b"Rar!"},
    {"type": ResourceType.ARCHIVE, "ext": "7z", "magic": b"7z\xbc\xaf\x27\x1c"},
    {"type": ResourceType.ARCHIVE, "ext": "gz", "magic": b"\x1f\x8b"},
    {"type": ResourceType.DOCUMENT, "ext": "doc", "magic": b"\xd0\xcf\x11\xe0\xa1\xb1\x1a\xe1"},
]

# Content-Type 前缀 -> 类型
_CT_TYPES: Dict[str, str] = {
    "image/": ResourceType.IMAGE,
    "video/": ResourceType.VIDEO,
    "audio/": ResourceType.AUDIO,
    "application/pdf": ResourceType.DOCUMENT,
    "text/html": ResourceType.DOCUMENT,
    "text/plain": ResourceType.DOCUMENT,
    "application/zip": ResourceType.ARCHIVE,
    "application/x-rar": ResourceType.ARCHIVE,
    "application/x-7z": ResourceType.ARCHIVE,
    "application/gzip": ResourceType.ARCHIVE,
    "application/json": ResourceType.DATA,
    "text/csv": ResourceType.DATA,
    "application/xml": ResourceType.DATA,
    "text/xml": ResourceType.DATA,
    "application/javascript": ResourceType.CODE,
    "text/css": ResourceType.CODE,
}

# 页面类扩展名：这些仍应作为页面链接跟踪
_PAGE_LIKE_EXTS = {"html", "htm", "xhtml", "php", "aspx", "jsp", "shtml", "asp"}


def looks_like_resource(url: str) -> bool:
    """判断 URL 是否直接指向非页面资源（用于不把资源当页面链接跟踪）"""
    ext = ext_from_url(url)
    if not ext:
        return False
    if ext in _PAGE_LIKE_EXTS:
        return False
    return ext in _EXT_TYPES


class ResourceClassifier:
    """资源分类器：内置类型 + 自定义类型"""

    def __init__(self, custom_types: Optional[List[Dict]] = None) -> None:
        self.custom: List[Dict] = []
        if custom_types:
            for ct in custom_types:
                self.custom.append({
                    "name": ct.get("name") or ct.get("dir") or ResourceType.OTHER,
                    "dir": ct.get("dir") or ct.get("name") or ResourceType.OTHER,
                    "extensions": [e.lower().lstrip(".") for e in (ct.get("extensions") or [])],
                    "content_types": [s.lower() for s in (ct.get("content_types") or [])],
                    "magic": [bytes.fromhex(m) if isinstance(m, str) else m for m in (ct.get("magic") or [])],
                })

    def _match_custom(self, ext: str, content_type: str, raw: Optional[bytes]) -> Optional[str]:
        for ct in self.custom:
            if ext and ext in ct["extensions"]:
                return ct["name"]
            if content_type and any(content_type.startswith(c) for c in ct["content_types"]):
                return ct["name"]
            if raw and any(raw.startswith(m) for m in ct["magic"]):
                return ct["name"]
        return None

    def classify(
        self,
        url: Optional[str] = None,
        content_type: Optional[str] = None,
        raw: Optional[bytes] = None,
    ) -> str:
        """识别资源类型；返回 ResourceType 或自定义类型名"""
        ext = ext_from_url(url or "")
        ct = (content_type or "").lower().split(";")[0].strip()

        # 1. 自定义类型优先
        custom = self._match_custom(ext, ct, raw)
        if custom:
            return custom

        # 2. 内容嗅探（magic bytes）——最高可信度
        if raw and len(raw) >= 8:
            for s in _MAGIC_SNIFFERS:
                if raw.startswith(s["magic"]):
                    return s["type"]

        # 3. Content-Type
        if ct:
            for prefix, rtype in _CT_TYPES.items():
                if ct.startswith(prefix):
                    return rtype

        # 4. 扩展名
        if ext:
            return _EXT_TYPES.get(ext, ResourceType.OTHER)

        return ResourceType.OTHER

    def ext_for(self, url: Optional[str], content_type: Optional[str], raw: Optional[bytes]) -> str:
        """确定保存用的扩展名（无点）"""
        ext = ext_from_url(url or "")
        ct = (content_type or "").lower().split(";")[0].strip()
        if ext:
            return ext
        if raw and len(raw) >= 8:
            for s in _MAGIC_SNIFFERS:
                if raw.startswith(s["magic"]):
                    return s["ext"]
        if ct:
            guessed = mimetypes.guess_extension(ct)
            if guessed:
                return guessed.lstrip(".")
        return "bin"

    def dir_name(self, rtype: str) -> str:
        """分类目录名（自定义类型用其 dir 字段）"""
        for ct in self.custom:
            if ct["name"] == rtype:
                return ct["dir"]
        return ResourceType.DIR_NAMES.get(rtype, ResourceType.DIR_NAMES[ResourceType.OTHER])


def classify(
    url: Optional[str] = None,
    content_type: Optional[str] = None,
    raw: Optional[bytes] = None,
    classifier: Optional[ResourceClassifier] = None,
) -> str:
    """便捷函数"""
    if classifier is None:
        classifier = _DEFAULT
    return classifier.classify(url, content_type, raw)


_DEFAULT = ResourceClassifier()
