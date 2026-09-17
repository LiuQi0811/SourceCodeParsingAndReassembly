# -*- coding: utf-8 -*-
"""URL 工具与资源分类。"""
from __future__ import annotations

import re
from urllib.parse import urlsplit, urlunsplit, urljoin as _urljoin

# 扩展名 -> (kind, group)
EXT_KIND: dict[str, tuple[str, str]] = {
    # 图片
    "jpg": ("image", "images"), "jpeg": ("image", "images"), "png": ("image", "images"),
    "gif": ("image", "images"), "webp": ("image", "images"), "bmp": ("image", "images"),
    "svg": ("image", "images"), "ico": ("image", "images"), "avif": ("image", "images"),
    "heic": ("image", "images"), "tif": ("image", "images"), "tiff": ("image", "images"),
    # 视频
    "mp4": ("video", "videos"), "mkv": ("video", "videos"), "webm": ("video", "videos"),
    "avi": ("video", "videos"), "mov": ("video", "videos"), "wmv": ("video", "videos"),
    "flv": ("video", "videos"), "ts": ("video", "videos"), "m2ts": ("video", "videos"),
    "m3u8": ("video", "videos"), "mpd": ("video", "videos"), "m4v": ("video", "videos"),
    "3gp": ("video", "videos"), "rmvb": ("video", "videos"), "rm": ("video", "videos"),
    # 音频
    "mp3": ("audio", "audio"), "wav": ("audio", "audio"), "aac": ("audio", "audio"),
    "flac": ("audio", "audio"), "ogg": ("audio", "audio"), "m4a": ("audio", "audio"),
    "opus": ("audio", "audio"), "wma": ("audio", "audio"), "ape": ("audio", "audio"),
    # 文档
    "pdf": ("doc", "docs"), "doc": ("doc", "docs"), "docx": ("doc", "docs"),
    "xls": ("doc", "docs"), "xlsx": ("doc", "docs"), "ppt": ("doc", "docs"),
    "pptx": ("doc", "docs"), "txt": ("doc", "docs"), "md": ("doc", "docs"),
    "csv": ("doc", "docs"), "json": ("doc", "docs"), "xml": ("doc", "docs"),
    "epub": ("doc", "docs"), "mobi": ("doc", "docs"), "zip": ("doc", "docs"),
    "rar": ("doc", "docs"), "7z": ("doc", "docs"), "tar": ("doc", "docs"),
    "gz": ("doc", "docs"), "apk": ("doc", "docs"), "exe": ("doc", "docs"),
}

# 常见 MIME -> (kind, group)
MIME_KIND: dict[str, tuple[str, str]] = {
    "image/": ("image", "images"),
    "video/": ("video", "videos"),
    "audio/": ("audio", "audio"),
    "application/pdf": ("doc", "docs"),
    "application/msword": ("doc", "docs"),
    "application/zip": ("doc", "docs"),
    "text/": ("doc", "docs"),
}

# Windows 保留文件名
_RESERVED = {"CON", "PRN", "AUX", "NUL", *(f"COM{i}" for i in range(1, 10)), *(f"LPT{i}" for i in range(1, 10))}
_ILLEGAL = re.compile(r'[\\/:*?"<>|\r\n\t\x00-\x1f]')


def normalize_url(url: str, keep_params: bool = True) -> str:
    """规范化 URL：去片段、小写 scheme/host，可选保留查询参数。"""
    try:
        s = urlsplit(url.strip())
    except ValueError:
        return url.strip()
    scheme = s.scheme.lower()
    netloc = s.netloc.lower()
    path = s.path or "/"
    query = s.query if keep_params else ""
    return urlunsplit((scheme, netloc, path, query, ""))


def same_netloc(a: str, b: str) -> bool:
    try:
        return urlsplit(a).netloc.lower() == urlsplit(b).netloc.lower()
    except ValueError:
        return False


def urljoin(base: str, ref: str) -> str:
    return _urljoin(base, ref)


def ext_of(url: str) -> str:
    """从 URL 路径取扩展名（小写、不带点）。"""
    path = urlsplit(url).path
    if "." not in path:
        return ""
    seg = path.rsplit("/", 1)[-1]
    if "." not in seg:
        return ""
    return seg.rsplit(".", 1)[-1].lower().split(";")[0]


def classify_url(url: str) -> tuple[str, str]:
    """按 URL 扩展名分类 -> (kind, group)。"""
    e = ext_of(url)
    if e in EXT_KIND:
        return EXT_KIND[e]
    # 流协议兜底
    if "m3u8" in url.lower() or ".m3u8" in url.lower():
        return ("video", "videos")
    if ".mpd" in url.lower():
        return ("video", "videos")
    return ("other", "other")


def classify_content_type(ct: str) -> tuple[str, str]:
    ct = (ct or "").split(";")[0].strip().lower()
    if not ct:
        return ("other", "other")
    for prefix, kv in MIME_KIND.items():
        if ct.startswith(prefix):
            return kv
    return ("other", "other")


def sanitize_filename(name: str, max_len: int = 60) -> str:
    """清洗为 Windows 安全文件名，并保证非空。"""
    name = _ILLEGAL.sub("_", name or "").strip(" .")
    name = name.strip()
    if not name:
        name = "untitled"
    if name.upper() in _RESERVED:
        name = "_" + name
    if len(name) > max_len:
        name = name[:max_len].rstrip(" .")
    return name or "untitled"


def scheme_of(url: str) -> str:
    try:
        return urlsplit(url).scheme.lower()
    except ValueError:
        return ""
