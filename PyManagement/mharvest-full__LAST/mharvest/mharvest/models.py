"""资源数据模型与类型判定。

判定一个 URL 是图片、视频还是音频，决定了它落到哪个目录、
用什么方式下载（普通文件 vs 流式清单），所以这里是整个框架的地基。

判定分两步：
1. 发现阶段看 URL 扩展名（快，但可能没有扩展名或被伪装）
2. 下载后看 Content-Type（准，可纠正第一步的误判）
"""

from __future__ import annotations

import mimetypes
import re
from dataclasses import dataclass, field
from typing import Optional
from urllib.parse import unquote, urlparse

# 扩展名分档
IMAGE_EXT = {"jpg", "jpeg", "png", "gif", "bmp", "webp", "avif", "svg", "ico",
             "tif", "tiff", "heic", "heif", "jfif", "pjpeg"}
VIDEO_EXT = {"mp4", "m4v", "webm", "mkv", "flv", "avi", "mov", "wmv", "3gp", "m4s"}
AUDIO_EXT = {"mp3", "wav", "ogg", "oga", "opus", "m4a", "aac", "flac", "weba", "aiff"}
# 有歧义的扩展名：.ts 既是 MPEG-TS 视频流，也是 TypeScript 源码。
# 放进 VIDEO_EXT 才能发现散装视频分片，但下载后必须做内容嗅探区分，
# 否则会把一堆 .ts 源码文件当视频抓下来。
AMBIGUOUS_VIDEO_EXT = {"ts", "m2ts", "mts"}
FONT_EXT = {"woff", "woff2", "ttf", "otf", "eot"}
STREAM_EXT = {"m3u8", "mpd"}  # 流式清单，需要二次解析，不能直接当文件存
DOC_EXT = {"pdf", "doc", "docx", "xls", "xlsx", "ppt", "pptx", "zip", "rar", "7z"}

# 内容类型 → 归类，用于纠正扩展名缺失或伪装的情况
MIME_KIND = [
    (re.compile(r"^image/", re.I), "image"),
    (re.compile(r"^video/", re.I), "video"),
    (re.compile(r"^audio/", re.I), "audio"),
    (re.compile(r"^font/|^application/(?:font|.*woff|.*ttf)", re.I), "font"),
    (re.compile(r"application/(?:vnd\.apple\.mpegurl|mpegurl|x-mpegURL)", re.I), "stream"),
    (re.compile(r"application/dash\+xml", re.I), "stream"),
]

# 内容类型 → 扩展名，给没有扩展名的 URL 补后缀
MIME_EXT = {
    "image/jpeg": "jpg", "image/jpg": "jpg", "image/png": "png", "image/gif": "gif",
    "image/webp": "webp", "image/avif": "avif", "image/svg+xml": "svg",
    "image/x-icon": "ico", "image/bmp": "bmp", "image/heic": "heic",
    "video/mp4": "mp4", "video/webm": "webm", "video/x-matroska": "mkv",
    "video/quicktime": "mov", "video/x-flv": "flv", "video/x-msvideo": "avi",
    "video/mp2t": "ts",
    "audio/mpeg": "mp3", "audio/mp4": "m4a", "audio/aac": "aac", "audio/wav": "wav",
    "audio/x-wav": "wav", "audio/ogg": "ogg", "audio/opus": "opus", "audio/flac": "flac",
    "font/woff": "woff", "font/woff2": "woff2", "font/ttf": "ttf", "font/otf": "otf",
    "application/vnd.apple.mpegurl": "m3u8", "application/x-mpegURL": "m3u8",
    "application/dash+xml": "mpd",
}

# 抓取时会跳过的明显无效链接
BAD_SCHEMES = ("javascript:", "mailto:", "tel:", "sms:", "about:", "data:")


@dataclass
class Resource:
    """一条待抓取的资源记录。"""

    url: str
    kind: str = "other"          # image / video / audio / font / stream / other
    source: str = ""             # 在哪个页面发现的
    referer: str = ""            # 请求时要带的 Referer，过防盗链用
    content_type: str = ""
    size: int = 0                # 落盘字节数
    path: str = ""               # 相对输出目录的保存路径
    status: int = 0              # HTTP 状态码，0 表示请求失败
    error: str = ""
    extra: dict = field(default_factory=dict)  # 宽度、码率、分片数等附加信息

    @property
    def ok(self) -> bool:
        return self.status == 200 and bool(self.path)

    def to_dict(self) -> dict:
        return {
            "url": self.url, "kind": self.kind, "source": self.source,
            "content_type": self.content_type, "size": self.size,
            "path": self.path, "status": self.status, "error": self.error,
            "extra": self.extra or None,
        }


def url_ext(url: str) -> str:
    """取 URL 路径里的扩展名（小写、不含点），忽略 query 里的干扰。

    例：https://x.com/a/b.PNG?v=1 -> png
    """
    path = unquote(urlparse(url).path)
    m = re.search(r"\.([A-Za-z0-9]{1,6})$", path)
    return m.group(1).lower() if m else ""


def kind_from_ext(ext: str) -> Optional[str]:
    if not ext:
        return None
    if ext in IMAGE_EXT:
        return "image"
    if ext in VIDEO_EXT or ext in AMBIGUOUS_VIDEO_EXT:
        return "video"
    if ext in AUDIO_EXT:
        return "audio"
    if ext in FONT_EXT:
        return "font"
    if ext in STREAM_EXT:
        return "stream"
    if ext in DOC_EXT:
        return "other"
    return None


def kind_from_mime(content_type: str) -> Optional[str]:
    """从 Content-Type 反推归类，去掉 ;charset= 之类的参数。"""
    if not content_type:
        return None
    base = content_type.split(";")[0].strip()
    for pattern, kind in MIME_KIND:
        if pattern.search(base):
            return kind
    return None


def ext_from_mime(content_type: str) -> str:
    if not content_type:
        return ""
    base = content_type.split(";")[0].strip().lower()
    if base in MIME_EXT:
        return MIME_EXT[base]
    guessed = mimetypes.guess_extension(base)  # 兜底，可能返回 .jpe 这类
    return guessed.lstrip(".") if guessed else ""


def guess_kind(url: str, content_type: str = "") -> str:
    """先信 Content-Type，再看扩展名，最后按其他处理。"""
    return (kind_from_mime(content_type)
            or kind_from_ext(url_ext(url))
            or "other")


def is_bad_url(url: str) -> bool:
    """过滤掉不该发请求的伪链接。"""
    return not url or url.strip().lower().startswith(BAD_SCHEMES)


# MPEG-TS 的同步字节，188 字节一包，每包首字节都是它
TS_SYNC_BYTE = 0x47
TS_PACKET_SIZE = 188


def looks_like_ts_stream(data: bytes) -> bool:
    """凭文件头判断是不是真正的 MPEG-TS 视频流。

    判据：首字节是同步字节 0x47，且第二个包（偏移 188）也是。
    连续两个位置都对上，误判概率极低。

    TypeScript 源码是纯文本，首字节必然是可读 ASCII 字符，
    不会是 0x47——这就是区分二者的依据。
    """
    if len(data) < TS_PACKET_SIZE + 1:
        # 太短没法用两个包判断，只看第一个字节
        return len(data) > 0 and data[0] == TS_SYNC_BYTE
    return data[0] == TS_SYNC_BYTE and data[TS_PACKET_SIZE] == TS_SYNC_BYTE


def looks_like_text(data: bytes) -> bool:
    """粗判是不是文本文件（用于识别 TypeScript / JS 源码）。"""
    if not data:
        return False
    sample = data[:512]
    # 控制字符（换行制表符除外）多的话就不是文本
    printable = sum(1 for b in sample
                    if 0x20 <= b < 0x7F or b in (0x09, 0x0A, 0x0D))
    return printable / len(sample) > 0.9


def resolve_ambiguous_kind(url: str, data: bytes, fallback: str) -> str:
    """对 .ts 这类有歧义的扩展名，用内容决定最终归类。

    :return: "video" 或 "other"
    """
    if url_ext(url) not in AMBIGUOUS_VIDEO_EXT:
        return fallback
    if looks_like_ts_stream(data):
        return "video"
    if looks_like_text(data):
        return "other"   # TypeScript / JavaScript 源码，不是视频
    return fallback
