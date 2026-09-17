# -*- coding: utf-8 -*-
"""核心数据模型。"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Optional


# ---------------------------------------------------------------- 任务
@dataclass(slots=True)
class Task:
    """一个待抓取页面任务。"""

    url: str
    depth: int = 0
    parser_mode: Optional[str] = None   # 单任务解析器覆盖（None = 跟随全局）
    referer: Optional[str] = None       # 来源页，便于防盗链
    title: Optional[str] = None         # 来源页标题（目录命名参考）

    def to_row(self) -> tuple:
        return (self.url, self.depth, self.parser_mode, self.referer, self.title)


@dataclass(slots=True)
class Page:
    """抓取并解码后的页面。"""

    url: str
    text: str
    charset: str
    raw: bytes
    headers: dict = field(default_factory=dict)
    status: int = 0
    title: Optional[str] = None


# ---------------------------------------------------------------- 解析结果
@dataclass(slots=True)
class ResourceRef:
    """页面中发现的资源引用。"""

    url: str
    kind: str = "other"        # image / video / doc / audio / other
    group: str = "other"       # 目录分组名（images/videos/docs/audio/other）
    ext: str = ""              # 不带点的扩展名
    referer: Optional[str] = None
    from_parser: str = ""      # 由哪个解析器发现


@dataclass(slots=True)
class ParseResult:
    """解析器统一输出。"""

    title: Optional[str] = None
    links: list[str] = field(default_factory=list)
    resources: list[ResourceRef] = field(default_factory=list)
    parser_used: list[str] = field(default_factory=list)
    notes: dict = field(default_factory=dict)


# ---------------------------------------------------------------- 下载结果
@dataclass(slots=True)
class DownloadResult:
    """资源下载/合并结果。"""

    url: str
    ok: bool
    kind: str = "other"
    group: str = "other"
    path: Optional[str] = None     # 绝对路径
    rel_path: Optional[str] = None # 相对保存根目录的路径
    size: int = 0
    error: str = ""
    method: str = ""               # 使用的下载/合并方式

    def as_manifest(self) -> dict[str, Any]:
        return {
            "url": self.url,
            "ok": self.ok,
            "kind": self.kind,
            "group": self.group,
            "path": self.rel_path,
            "size": self.size,
            "error": self.error,
            "method": self.method,
        }
