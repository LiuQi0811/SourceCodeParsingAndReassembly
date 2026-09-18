"""日志配置工具：文件 DEBUG 全量落盘 + 控制台分级输出。"""

from __future__ import annotations

import logging
import os
from datetime import datetime
from typing import Optional


def setup_logging(log_dir: str = "output/logs",
                  console_level: int = logging.WARNING,
                  file_level: int = logging.DEBUG) -> str:
    """配置 root logger：文件记录 file_level 级别（默认 DEBUG，含重试/下载明细），
    控制台只输出 console_level（默认 WARNING）。

    返回日志文件绝对路径。重复调用会重建 handlers（幂等覆盖）。
    """
    os.makedirs(log_dir, exist_ok=True)
    log_path = os.path.join(
        log_dir, f"run_{datetime.now():%Y%m%d_%H%M%S}.log")

    root = logging.getLogger()
    root.setLevel(logging.DEBUG)
    for h in list(root.handlers):
        root.removeHandler(h)
        h.close()

    file_fmt = logging.Formatter(
        "%(asctime)s %(levelname)-7s %(name)s: %(message)s")
    console_fmt = logging.Formatter("%(levelname)s:%(name)s: %(message)s")

    fh = logging.FileHandler(log_path, encoding="utf-8")
    fh.setLevel(file_level)
    fh.setFormatter(file_fmt)

    ch = logging.StreamHandler()
    ch.setLevel(console_level)
    ch.setFormatter(console_fmt)

    root.addHandler(fh)
    root.addHandler(ch)
    return log_path
