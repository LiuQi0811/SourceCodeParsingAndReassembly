# -*- coding: utf-8 -*-
"""
资源存储：按「标题」创建任务目录，目录内按资源类型建立分组子目录
例如：output/<页面标题>/images/...、output/<页面标题>/videos/...
支持自定义资源类型分组。

原子性与幂等：
  - 保存先写 <name>.part 临时文件，再 os.replace 原子改名，保证最终文件永远完整（崩溃不留半成品）
  - 文件名含 URL hash，同一 URL 恒同路径；已存在时直接复用（幂等），崩溃重跑不产生重复文件
"""
from __future__ import annotations

import hashlib
import os
import re
import time
from pathlib import Path
from typing import Optional, Tuple

from ..utils import human_size as _human
from ..utils import sanitize_filename, url_filename
from .classifier import ResourceClassifier


class ResourceStorage:
    """资源落地存储"""

    def __init__(self, base_dir: str | Path, classifier: Optional[ResourceClassifier] = None) -> None:
        self.base_dir = Path(base_dir)
        self.base_dir.mkdir(parents=True, exist_ok=True)
        self.classifier = classifier or ResourceClassifier()
        self._task_dirs: dict = {}

    # ---------- 目录 ----------
    def task_dir(self, task_id: str, title: str = "") -> Path:
        """标题命名目录；缓存避免同任务重复创建"""
        key = task_id
        if key in self._task_dirs:
            return self._task_dirs[key]
        safe = sanitize_filename(title or task_id, max_len=120, fallback=task_id)
        d = self.base_dir / safe
        d.mkdir(parents=True, exist_ok=True)
        self._task_dirs[key] = d
        return d

    def group_dir(self, task_id: str, rtype: str, title: str = "") -> Path:
        """资源分组目录：<标题目录>/<分类目录名>"""
        task = self.task_dir(task_id, title)
        group = self.classifier.dir_name(rtype)
        d = task / group
        d.mkdir(parents=True, exist_ok=True)
        return d

    # ---------- 路径计算 ----------
    @staticmethod
    def _deterministic_name(base: str, ext: str, url: str) -> str:
        """确定性文件名：<stem>_<url_hash8>.<ext>；同一 URL 恒同路径"""
        h = hashlib.sha1((url or "").encode("utf-8")).hexdigest()[:8] if url else ""
        stem = base.rsplit(".", 1)[0] if "." in base else base
        if ext:
            return f"{stem}_{h}.{ext}" if h else f"{stem}.{ext}"
        return f"{stem}_{h}" if h else stem

    def resolve_path(
        self,
        task_id: str,
        rtype: str,
        url: str = "",
        title: str = "",
        filename: Optional[str] = None,
        content_type: str = "",
    ) -> Path:
        """计算确定性保存路径（不写入）；供下载前存在性检查 / 流式下载分配"""
        group = self.group_dir(task_id, rtype, title)
        if filename:
            fname = sanitize_filename(filename, max_len=120)
        else:
            ext = self.classifier.ext_for(url or "", content_type, None)
            base = sanitize_filename(url_filename(url or "", default="resource"), max_len=100)
            fname = self._deterministic_name(base, ext, url)
        return group / fname

    # ---------- 保存 ----------
    def save_bytes(
        self,
        task_id: str,
        rtype: str,
        data: bytes,
        url: str = "",
        title: str = "",
        filename: Optional[str] = None,
        content_type: str = "",
        overwrite: bool = False,
    ) -> Path:
        """保存二进制资源：先写 .part 临时文件再原子改名；同 URL 幂等（已存在则复用）。
        返回最终路径。"""
        path = self.resolve_path(task_id, rtype, url, title, filename, content_type)
        if path.exists() and not overwrite:
            return path  # 幂等：同一 URL 已下载过，直接复用
        part = path.with_name(path.name + ".part")
        part.write_bytes(data)
        os.replace(part, path)
        return path

    def new_save_path(
        self,
        task_id: str,
        rtype: str,
        url: str,
        title: str = "",
        filename: Optional[str] = None,
    ) -> Path:
        """为流式下载预先分配保存路径（确定性）"""
        return self.resolve_path(task_id, rtype, url, title, filename)

    def _unique_path(self, path: Path) -> Path:
        if not path.exists():
            return path
        stem, suffix = path.stem, path.suffix
        for i in range(1, 10000):
            cand = path.with_name(f"{stem}_{i}{suffix}")
            if not cand.exists():
                return cand
        return path.with_name(f"{stem}_{int(time.time())}{suffix}")

    # ---------- 产物索引 ----------
    def build_index(self) -> Path:
        """扫描 base_dir 下全部任务产物，生成 index.html 浏览索引（相对链接）"""
        import html

        index = self.base_dir / "index.html"
        sections: list = []
        total_files = 0
        total_bytes = 0

        for td in sorted((d for d in self.base_dir.iterdir() if d.is_dir()), key=lambda p: p.name.lower()):
            groups = []
            for gd in sorted((d for d in td.iterdir() if d.is_dir()), key=lambda p: p.name.lower()):
                files = sorted(
                    (f for f in gd.iterdir() if f.is_file() and not f.name.endswith(".part")),
                    key=lambda p: p.name.lower(),
                )
                if not files:
                    continue
                items = []
                for f in files:
                    size = f.stat().st_size
                    total_files += 1
                    total_bytes += size
                    rel = f.relative_to(self.base_dir).as_posix()
                    items.append(
                        f'<li><a href="{html.escape(rel)}" title="{html.escape(rel)}">'
                        f"{html.escape(f.name)}</a> <span class=sz>{_human(size)}</span></li>"
                    )
                groups.append(
                    f'<div class="group"><h3>{html.escape(gd.name)} ({len(files)})</h3>'
                    f"<ul>{''.join(items)}</ul></div>"
                )
            if groups:
                sections.append(
                    f'<section><h2>{html.escape(td.name)}</h2>{"".join(groups)}</section>'
                )

        html_doc = f"""<!DOCTYPE html>
<html lang="zh-CN"><head><meta charset="utf-8">
<title>抓取产物索引</title>
<style>
body{{font-family:system-ui,-apple-system,'Segoe UI',Microsoft YaHei,sans-serif;margin:24px auto;max-width:1080px;padding:0 16px;color:#222}}
h1{{font-size:22px}} h2{{font-size:17px;border-bottom:1px solid #e3e3e3;padding-bottom:6px;margin-top:28px}}
h3{{font-size:13px;color:#666;margin:14px 0 6px}}
ul{{list-style:none;padding:0;margin:0;columns:3;column-gap:28px;font-size:12px}}
li{{margin:2px 0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}}
a{{color:#0366d6;text-decoration:none}} a:hover{{text-decoration:underline}}
.sz{{color:#999;margin-left:6px}}
.summary{{background:#f6f8fa;border-radius:6px;padding:10px 14px;font-size:13px;color:#444}}
@media(max-width:720px){{ul{{columns:1}}}}
</style></head><body>
<h1>抓取产物索引</h1>
<div class="summary">共 <b>{len(sections)}</b> 个任务目录 / <b>{total_files}</b> 个文件 / <b>{_human(total_bytes)}</b></div>
{''.join(sections)}
</body></html>"""
        index.write_text(html_doc, encoding="utf-8")
        return index

    # ---------- 页面保存 ----------
    def save_page(self, task_id: str, url: str, text: str, title: str = "") -> Path:
        from ..utils import file_sha1

        task = self.task_dir(task_id, title)
        pages = task / "pages"
        pages.mkdir(parents=True, exist_ok=True)
        name = sanitize_filename(url_filename(url, default="page"), max_len=80)
        path = pages / f"{name}_{file_sha1(url.encode('utf-8'))[:10]}.html"
        path = self._unique_path(path)
        path.write_text(text, encoding="utf-8")
        return path

    def save_structured(self, task_id: str, url: str, data: dict, title: str = "") -> Path:
        import json

        from ..utils import file_sha1

        task = self.task_dir(task_id, title)
        data_dir = task / "data"
        data_dir.mkdir(parents=True, exist_ok=True)
        name = sanitize_filename(url_filename(url, default="item"), max_len=80)
        path = data_dir / f"{name}_{file_sha1(url.encode('utf-8'))[:10]}.json"
        path = self._unique_path(path)
        path.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
        return path
