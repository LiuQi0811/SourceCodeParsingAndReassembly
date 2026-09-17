# -*- coding: utf-8 -*-
"""解析器抽象基类。"""
from __future__ import annotations

from abc import ABC, abstractmethod

from ..models import Page, ParseResult


class BaseParser(ABC):
    """解析器统一接口。"""

    name: str = "base"

    @abstractmethod
    def parse(self, page: Page, referer: str | None = None) -> ParseResult:
        """解析页面，输出标题 / 链接 / 资源引用。"""
        raise NotImplementedError
