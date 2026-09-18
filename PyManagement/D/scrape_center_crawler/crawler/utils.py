# -*- coding: utf-8 -*-
"""通用工具函数：文件名清洗、URL 处理、字节格式化等"""
from __future__ import annotations

import hashlib
import json
import re
import time
from pathlib import Path, PurePosixPath
from typing import Optional
from urllib.parse import urljoin, urlparse, urlunparse

# Windows / 通用非法文件名字符
_ILLEGAL_FS = re.compile(r'[<>:"/\\|?*\x00-\x1f]')
_TRAILING_DOT_SPACE = re.compile(r"[. ]+$")
_CONTROL = re.compile(r"[\x00-\x1f\x7f]")

_SAFE_EXT_RE = re.compile(r"^[A-Za-z0-9]{1,10}$")


def sanitize_filename(name: str, max_len: int = 120, fallback: str = "untitled") -> str:
    """把任意标题清洗成合法文件名（保留中文），用于按标题创建目录"""
    name = (name or "").strip()
    name = _CONTROL.sub("", name)
    name = _ILLEGAL_FS.sub("_", name)
    name = _TRAILING_DOT_SPACE.sub("", name)
    name = re.sub(r"\s+", " ", name).strip()
    if not name:
        name = fallback
    if len(name) > max_len:
        name = name[:max_len].rstrip(" _-")
    return name or fallback


def url_filename(url: str, default: str = "file") -> str:
    """从 URL 提取文件名（无则返回 default）"""
    try:
        path = urlparse(url).path
        if not path or path.endswith("/"):
            return default
        base = PurePosixPath(path).name
        base = base.split("?")[0]
        if base and not base.startswith("."):
            return base
    except Exception:
        pass
    return default


def ext_from_url(url: str) -> str:
    """从 URL 提取小写扩展名（无点），无则返回空串"""
    try:
        path = urlparse(url).path
        name = PurePosixPath(path).name
        if "." in name:
            ext = name.rsplit(".", 1)[1].lower()
            if _SAFE_EXT_RE.match(ext):
                return ext
    except Exception:
        pass
    return ""


def normalize_url(url: str, base: Optional[str] = None) -> Optional[str]:
    """URL 规范化：合并相对地址、去 fragment、统一 scheme/host 大小写"""
    try:
        if base:
            url = urljoin(base, url)
        parts = urlparse(url.strip())
        if parts.scheme not in ("http", "https"):
            return None
        scheme = parts.scheme.lower()
        netloc = parts.netloc.lower()
        path = parts.path or "/"
        # 保留 query，丢弃 fragment
        query = parts.query
        return urlunparse((scheme, netloc, path, "", query, ""))
    except Exception:
        return None


def same_domain(url_a: str, url_b: str) -> bool:
    try:
        return urlparse(url_a).netloc == urlparse(url_b).netloc
    except Exception:
        return False


def domain_of(url: str) -> str:
    try:
        return urlparse(url).netloc.lower()
    except Exception:
        return ""


def is_http_url(url: str) -> bool:
    try:
        return urlparse(url).scheme.lower() in ("http", "https")
    except Exception:
        return False


def file_sha1(data: bytes) -> str:
    return hashlib.sha1(data).hexdigest()


def now_iso() -> str:
    return time.strftime("%Y-%m-%d %H:%M:%S")


def human_size(n: float) -> str:
    n = float(n or 0)
    for unit in ("B", "KB", "MB", "GB", "TB"):
        if n < 1024 or unit == "TB":
            return f"{n:.2f} {unit}" if unit != "B" else f"{int(n)} B"
        n /= 1024
    return f"{n:.2f} TB"


def write_json_report(output_dir: str, summary: dict, extra: Optional[dict] = None) -> Optional[str]:
    """把抓取统计 summary 落盘为 report.json（与 index.html 互补，供程序化消费/历史对比）。
    返回报告文件绝对路径；失败返回 None。"""
    try:
        out = Path(output_dir)
        out.mkdir(parents=True, exist_ok=True)
        rep = dict(summary)
        rep["output_dir"] = str(out.resolve())
        rep["generated_at"] = now_iso()
        if extra:
            rep.update(extra)
        path = out / "report.json"
        path.write_text(json.dumps(rep, ensure_ascii=False, indent=2), encoding="utf-8")
        return str(path.resolve())
    except Exception:
        return None
