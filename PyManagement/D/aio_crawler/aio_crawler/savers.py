# -*- coding: utf-8 -*-
"""资源保存策略：以页面标题建目录，按资源类型建分组子目录。"""
from __future__ import annotations

import asyncio
import json
import logging
import os
import re
from collections import defaultdict
from pathlib import Path

from .urlutils import sanitize_filename

logger = logging.getLogger(__name__)

GROUP_DIRS = {
    "images": "images",
    "videos": "videos",
    "docs": "docs",
    "audio": "audio",
    "other": "other",
}


class TitleSaver:
    """标题目录保存器。

    目录结构：
        <save_root>/<标题>/
            images/  videos/  docs/  audio/  other/
            manifest.json          # 该标题下的资源清单

    一个标题目录内可能包含多个资源分组；同名文件自动编号去重。
    """

    def __init__(self, root: str | Path, title_dir: bool = True,
                 overwrite: bool = False) -> None:
        self.root = Path(root).resolve()
        self.title_dir = title_dir
        self.overwrite = overwrite
        self.root.mkdir(parents=True, exist_ok=True)
        self._lock = asyncio.Lock()
        self._used: dict[str, set[str]] = defaultdict(set)   # 标题 -> 已用文件名
        self._title_dirs: dict[str, Path] = {}

    # ------------------------------------------------------------ 目录解析
    def resolve_title_dir(self, title: str | None) -> Path:
        """返回标题目录（不存在则创建）。"""
        name = sanitize_filename(title or "untitled")
        if name in self._title_dirs:
            return self._title_dirs[name]
        base = self.root / name
        if not base.exists():
            base.mkdir(parents=True, exist_ok=True)
        self._title_dirs[name] = base
        return base

    def resolve(self, title: str | None, group: str, ext: str) -> Path:
        """解析最终文件路径：<标题>/<分组>/<文件名>，同名自动编号。"""
        group_dir = GROUP_DIRS.get(group, "other")
        tdir = self.resolve_title_dir(title)
        gdir = tdir / group_dir
        gdir.mkdir(parents=True, exist_ok=True)

        used = self._used.setdefault(tdir.name, set())
        ext = (ext or "bin").lstrip(".").lower() or "bin"
        stem = sanitize_filename(title or "untitled", max_len=50) or "file"
        stem = re.sub(r"\s+", "_", stem)

        candidate = f"{stem}.{ext}"
        n = 2
        while candidate in used or (not self.overwrite and gdir.joinpath(candidate).exists()):
            candidate = f"{stem}_{n}.{ext}"
            n += 1
        used.add(candidate)
        return gdir / candidate

    # ------------------------------------------------------------ 清单
    def manifest_path(self, title: str | None) -> Path:
        return self.resolve_title_dir(title) / "manifest.json"

    async def record(self, title: str | None, item: dict) -> None:
        """把一条下载记录追加到标题目录的 manifest.json。"""
        mp = self.manifest_path(title)
        async with self._lock:
            records: list = []
            if mp.exists():
                try:
                    records = json.loads(mp.read_text(encoding="utf-8"))
                    if not isinstance(records, list):
                        records = []
                except Exception:
                    records = []
            records.append(item)
            mp.write_text(
                json.dumps(records, ensure_ascii=False, indent=2),
                encoding="utf-8",
            )

    # ------------------------------------------------------------ 统计
    def collect_stats(self) -> dict:
        """扫描保存根目录，统计标题目录与分组。"""
        stats: dict[str, dict] = {}
        for tdir in sorted(self.root.iterdir()):
            if not tdir.is_dir():
                continue
            groups = {}
            for g in GROUP_DIRS.values():
                p = tdir / g
                if p.is_dir():
                    files = [f for f in p.iterdir() if f.is_file()]
                    groups[g] = len(files)
            stats[tdir.name] = groups
        return stats

    def __repr__(self) -> str:  # pragma: no cover
        return f"<TitleSaver root={self.root}>"
