"""落盘：目录规划、安全命名、内容去重。

文件名是抓包类工具最容易翻车的地方：
- URL 里带中文、斜杠、问号，直接当文件名会写失败
- 不同 URL 却同名（/a/logo.png 和 /b/logo.png），后下的会覆盖先下的
- 有些图是 1x1 的占位图或纯色图标，抓下来一堆垃圾

这里一次性处理掉：非法字符替换、重名加序号、内容级去重。
"""

from __future__ import annotations

import re
from hashlib import sha1
from pathlib import Path
from typing import Optional
from urllib.parse import unquote, urlparse

from .models import ext_from_mime

KIND_DIR = {
    "image": "images",
    "video": "videos",
    "audio": "audio",
    "font": "fonts",
    "stream": "streams",
    "other": "other",
}

INVALID_CHARS = re.compile(r'[\\/:*?"<>|\r\n\t\x00-\x1f]')
RESERVED = {"con", "prn", "aux", "nul", "com1", "com2", "lpt1", "lpt2"}


def safe_filename(name: str, max_len: int = 120) -> str:
    """把任意字符串洗成能落盘的文件名。"""
    name = INVALID_CHARS.sub("_", name).strip(" .")
    name = re.sub(r"\s+", "_", name)
    name = re.sub(r"_{2,}", "_", name)
    if name.lower() in RESERVED:
        name = "_" + name
    if len(name) > max_len:
        name = name[:max_len].rstrip("._")
    return name or "asset"


def suggest_name(url: str, content_type: str = "",
                 fallback_ext: str = "bin") -> str:
    """根据 URL 和 Content-Type 推断一个文件名。

    URL 带 query 时补一段短哈希，避免 /a.jpg?x=1 和 /a.jpg?x=2 互相覆盖。
    """
    parsed = urlparse(url)
    basename = unquote(parsed.path).rsplit("/", 1)[-1]

    stem, dot, ext = basename.rpartition(".")
    if not dot:
        stem, ext = basename, ""
    ext = ext.lower()

    # 扩展名缺失或不合法，用 Content-Type 补一个
    if not ext or len(ext) > 6 or not ext.isalnum():
        ext = ext_from_mime(content_type) or fallback_ext
    # Content-Type 明确说是图但扩展名是 php/aspx 之类，以 Content-Type 为准
    elif content_type:
        from .models import kind_from_mime
        if kind_from_mime(content_type) == "image" and ext not in (
                "jpg", "jpeg", "png", "gif", "webp", "avif", "bmp", "svg", "ico"):
            ext = ext_from_mime(content_type) or ext

    stem = safe_filename(stem) or "asset"
    if parsed.query:
        stem = f"{stem}_{sha1(url.encode('utf-8', 'ignore')).hexdigest()[:8]}"
    return f"{stem}.{ext}"


class FileStore:
    """管理输出目录与文件名分配。

    :param dedup: 是否做内容级去重（同一张图只存一份）
    """

    def __init__(self, root: str | Path, dedup: bool = True):
        self.root = Path(root)
        self.dedup = dedup
        self._used: set[str] = set()
        self._by_hash: dict[str, str] = {}

    def dir_for(self, kind: str) -> Path:
        return self.root / KIND_DIR.get(kind, "other")

    def allocate(self, kind: str, filename: str) -> Path:
        """在对应分类目录下分配一个不冲突的路径。"""
        directory = self.dir_for(kind)
        directory.mkdir(parents=True, exist_ok=True)

        candidate = directory / filename
        if str(candidate) not in self._used and not candidate.exists():
            self._used.add(str(candidate))
            return candidate

        stem, dot, ext = filename.rpartition(".")
        for i in range(2, 10000):
            new_name = f"{stem}-{i}.{ext}" if dot else f"{stem}-{i}"
            candidate = directory / new_name
            if str(candidate) not in self._used and not candidate.exists():
                self._used.add(str(candidate))
                return candidate
        # 极端情况，用哈希兜底
        digest = sha1(filename.encode("utf-8", "ignore")).hexdigest()[:12]
        candidate = directory / f"{digest}.{ext if dot else 'bin'}"
        self._used.add(str(candidate))
        return candidate

    def plan(self, kind: str, url: str, content_type: str = "") -> Path:
        """一步到位：推断文件名 + 分配路径。"""
        return self.allocate(kind, suggest_name(url, content_type))

    def find_duplicate(self, data: bytes) -> Optional[Path]:
        """内容已存在时返回原文件路径，否则返回 None。"""
        if not self.dedup:
            return None
        digest = sha1(data).hexdigest()
        existing = self._by_hash.get(digest)
        return Path(existing) if existing else None

    def remember(self, data: bytes, path: Path) -> None:
        if self.dedup:
            self._by_hash[sha1(data).hexdigest()] = str(path)

    def relative(self, path: Path) -> str:
        """输出相对路径，让 manifest 可移植。"""
        try:
            return str(Path(path).relative_to(self.root))
        except ValueError:
            return str(path)

    def write_data_uri(self, kind: str, data: bytes, ext: str,
                       hint: str = "inline") -> Path:
        """保存从 data: URI 解出来的内联资源。"""
        name = f"{safe_filename(hint)}-{sha1(data).hexdigest()[:8]}.{ext}"
        return self.allocate(kind, name)
