"""资源类型识别与分类目录保存。

- classify_resource：按 Content-Type / 魔数 / 扩展名识别资源类型
- sanitize_filename / sanitize_dirname：文件名安全化（标题命名目录）
- 目录结构：output_root/<任务标题>/<分类>/<文件名>
"""

from __future__ import annotations

import os
import re
from typing import Optional, Tuple
from urllib.parse import urlparse

from core.models import ResourceKind

# Content-Type → 类型
_CT_MAP = {
    "image/": ResourceKind.IMAGE,
    "video/": ResourceKind.VIDEO,
    "audio/": ResourceKind.AUDIO,
    "application/pdf": ResourceKind.DOC,
    "application/msword": ResourceKind.DOC,
    "application/vnd.openxmlformats-officedocument": ResourceKind.DOC,
    "application/vnd.ms-": ResourceKind.DOC,
    "application/zip": ResourceKind.ARCHIVE,
    "application/x-rar": ResourceKind.ARCHIVE,
    "application/x-7z": ResourceKind.ARCHIVE,
    "application/gzip": ResourceKind.ARCHIVE,
    "application/x-tar": ResourceKind.ARCHIVE,
    "application/javascript": ResourceKind.CODE,
    "text/css": ResourceKind.CODE,
    "text/x-python": ResourceKind.CODE,
    "application/json": ResourceKind.DATA,
    "text/csv": ResourceKind.DATA,
    "application/xml": ResourceKind.DATA,
    "text/html": ResourceKind.PAGE,
}

# 魔数 → 类型（兜底）
_MAGIC = [
    (b"\x89PNG", ResourceKind.IMAGE),
    (b"\xff\xd8\xff", ResourceKind.IMAGE),
    (b"GIF8", ResourceKind.IMAGE),
    (b"RIFF", ResourceKind.IMAGE),        # webp
    (b"\x1aE\xdf\xa3", ResourceKind.VIDEO),  # mkv
    (b"ftyp", ResourceKind.VIDEO),       # mp4（iso box）
    (b"PK\x03\x04", ResourceKind.ARCHIVE),   # zip/docx
    (b"Rar!", ResourceKind.ARCHIVE),
    (b"7z\xbc\xaf\x27\x1c", ResourceKind.ARCHIVE),
    (b"%PDF", ResourceKind.DOC),
    (b"\x1f\x8b", ResourceKind.ARCHIVE),  # gzip
]

# 扩展名 → 类型
_EXT_MAP = {
    ".jpg": ResourceKind.IMAGE, ".jpeg": ResourceKind.IMAGE, ".png": ResourceKind.IMAGE,
    ".gif": ResourceKind.IMAGE, ".webp": ResourceKind.IMAGE, ".bmp": ResourceKind.IMAGE,
    ".svg": ResourceKind.IMAGE, ".ico": ResourceKind.IMAGE, ".tif": ResourceKind.IMAGE,
    ".mp4": ResourceKind.VIDEO, ".mkv": ResourceKind.VIDEO, ".avi": ResourceKind.VIDEO,
    ".mov": ResourceKind.VIDEO, ".flv": ResourceKind.VIDEO, ".wmv": ResourceKind.VIDEO,
    ".webm": ResourceKind.VIDEO, ".ts": ResourceKind.VIDEO, ".m3u8": ResourceKind.VIDEO,
    ".mpd": ResourceKind.VIDEO, ".rmvb": ResourceKind.VIDEO, ".rm": ResourceKind.VIDEO,
    ".mp3": ResourceKind.AUDIO, ".wav": ResourceKind.AUDIO, ".aac": ResourceKind.AUDIO,
    ".flac": ResourceKind.AUDIO, ".ogg": ResourceKind.AUDIO, ".m4a": ResourceKind.AUDIO,
    ".pdf": ResourceKind.DOC, ".doc": ResourceKind.DOC, ".docx": ResourceKind.DOC,
    ".ppt": ResourceKind.DOC, ".pptx": ResourceKind.DOC, ".xls": ResourceKind.DOC,
    ".xlsx": ResourceKind.DOC, ".txt": ResourceKind.DOC, ".md": ResourceKind.DOC,
    ".zip": ResourceKind.ARCHIVE, ".rar": ResourceKind.ARCHIVE, ".7z": ResourceKind.ARCHIVE,
    ".tar": ResourceKind.ARCHIVE, ".gz": ResourceKind.ARCHIVE,
    ".py": ResourceKind.CODE, ".js": ResourceKind.CODE, ".css": ResourceKind.CODE,
    ".json": ResourceKind.DATA, ".csv": ResourceKind.DATA, ".xml": ResourceKind.DATA,
    ".html": ResourceKind.PAGE, ".htm": ResourceKind.PAGE,
}


def classify_resource(url: str = "", content_type: str = "",
                      content: Optional[bytes] = None,
                      custom_map: Optional[dict] = None) -> ResourceKind:
    """按 Content-Type → 魔数 → 扩展名 顺序识别资源类型。

    custom_map：自定义资源类型映射 {扩展名(不带点): ResourceKind 或 字符串}，
    优先于内置扩展名表（功能 8：支持自定义资源类型）。
    """
    if custom_map:
        ext = os.path.splitext(urlparse(url).path.lower())[1].lstrip(".")
        if ext in custom_map:
            kind = custom_map[ext]
            return kind if isinstance(kind, ResourceKind) else ResourceKind(kind)
    ct = (content_type or "").lower()
    for prefix, kind in _CT_MAP.items():
        if ct.startswith(prefix):
            return kind
    if content:
        for magic, kind in _MAGIC:
            if content.startswith(magic):
                return kind
    ext = os.path.splitext(urlparse(url).path.lower())[1]
    if ext in _EXT_MAP:
        return _EXT_MAP[ext]
    if ext:
        return ResourceKind.OTHER
    return ResourceKind.OTHER


def sanitize_filename(name: str, default: str = "untitled", max_len: int = 80) -> str:
    """文件名安全化：去除 Windows/Unix 非法字符与路径分隔符。"""
    name = (name or "").strip().replace("\n", " ").replace("\r", " ")
    name = re.sub(r'[\\/:*?"<>|\x00-\x1f]', "_", name)
    name = re.sub(r"\s+", " ", name).strip(" .")
    if not name:
        return default
    return name[:max_len]


def sanitize_dirname(title: str, default: str = "site") -> str:
    """目录名安全化（以标题命名目录）。"""
    return sanitize_filename(title, default=default, max_len=60)


def build_resource_path(output_root: str, task_title: str,
                        kind: ResourceKind, filename: str) -> str:
    """构造分类目录路径：output_root/<标题>/<分类>/<文件名>。"""
    title_dir = sanitize_dirname(task_title)
    kind_dir = kind.value if isinstance(kind, ResourceKind) else str(kind)
    directory = os.path.join(output_root, title_dir, kind_dir)
    os.makedirs(directory, exist_ok=True)
    return os.path.join(directory, filename)


def unique_path(path: str) -> str:
    """避免重名覆盖：追加 (n)。"""
    if not os.path.exists(path):
        return path
    root, ext = os.path.splitext(path)
    n = 1
    while os.path.exists(f"{root}_{n}{ext}"):
        n += 1
    return f"{root}_{n}{ext}"
