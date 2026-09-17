# -*- coding: utf-8 -*-
"""解析器工厂（工厂模式）：按全局模式 / 单任务模式创建解析器。"""
from __future__ import annotations

import re
from typing import Optional

from .base import BaseParser
from .bs4_parser import BS4Parser
from .composite import CompositeParser
from .regex_parser import RegexParser
from .xpath_parser import XPathParser

# 预注册单例
_INSTANCES = {
    "bs4": BS4Parser(),
    "xpath": XPathParser(),
    "re": RegexParser(),
}

# 内置组合名 -> 子解析器名
_BUILTIN_COMPOSITES = {
    "auto": ["bs4", "xpath", "re"],
    "composite": ["bs4", "xpath", "re"],
}


class ParserFactory:
    """解析器工厂。

    - 全局模式：构造时指定（bs4 / xpath / re / auto / composite:bs4,xpath）
    - 单任务覆盖：get(mode) 中 mode 非空时按该任务模式创建
    - 'auto' = bs4 + xpath + re 组合
    """

    def __init__(self, global_mode: str = "auto") -> None:
        self.global_mode = self._normalize(global_mode)
        self._cache: dict[str, BaseParser] = {}

    @staticmethod
    def _normalize(mode: str) -> str:
        mode = (mode or "auto").strip().lower()
        if mode in ("auto", "composite"):
            return "composite:bs4,xpath,re"
        return mode

    def _build(self, mode: str) -> BaseParser:
        mode = self._normalize(mode)
        if mode.startswith("composite:"):
            names = [n.strip() for n in mode.split(":", 1)[1].split(",") if n.strip()]
            parsers = [_INSTANCES[n] for n in names if n in _INSTANCES]
            if not parsers:
                parsers = [_INSTANCES["bs4"]]
            return CompositeParser(parsers)
        if mode in _INSTANCES:
            return _INSTANCES[mode]
        # 未知模式回退组合
        return self._build("auto")

    def get(self, mode: Optional[str] = None) -> BaseParser:
        """获取解析器。mode 非空时覆盖全局模式（单任务切换）。"""
        effective = self._normalize(mode) if mode else self.global_mode
        if effective not in self._cache:
            self._cache[effective] = self._build(effective)
        return self._cache[effective]

    def available(self) -> list[str]:
        return list(_INSTANCES)


def parse_mode_valid(mode: str) -> bool:
    mode = (mode or "").strip().lower()
    if mode in ("auto", "composite", "bs4", "xpath", "re"):
        return True
    if mode.startswith("composite:"):
        names = mode.split(":", 1)[1].split(",")
        return bool(names) and all(n.strip() in _INSTANCES for n in names)
    if re.fullmatch(r"composite:[\w,]+", mode):
        return True
    return False
