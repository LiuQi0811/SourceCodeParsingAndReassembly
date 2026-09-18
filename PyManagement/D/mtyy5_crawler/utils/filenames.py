# -*- coding: utf-8 -*-
"""文件名 / 目录名净化"""
import re

_WIN_RESERVED = {
    "CON", "PRN", "AUX", "NUL",
    *[f"COM{i}" for i in range(1, 10)],
    *[f"LPT{i}" for i in range(1, 10)],
}


def safe_name(name: str, max_len: int = 100) -> str:
    """过滤非法字符、Windows 保留字，并截断长度"""
    name = re.sub(r'[<>:"/\\|?*\x00-\x1f]', "_", name).strip(" .")
    if not name:
        name = "untitled"
    if name.upper().split(".")[0] in _WIN_RESERVED:
        name = "_" + name
    return name[:max_len]