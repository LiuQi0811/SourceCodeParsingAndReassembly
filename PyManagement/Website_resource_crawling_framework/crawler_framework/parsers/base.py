"""
解析器抽象基类（Strategy Pattern）与结果对象定义
"""
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional
from urllib.parse import urljoin, urlparse


@dataclass
class ParseResult:
    """统一解析结果数据对象"""
    data: Dict[str, Any] = field(default_factory=dict)
    extracted_urls: List[str] = field(default_factory=list)
    resource_urls: List[str] = field(default_factory=list)
    raw_text: Optional[str] = None
    extra: Dict[str, Any] = field(default_factory=dict)


class BaseParser(ABC):
    """解析器抽象基类（策略模式）"""

    @property
    @abstractmethod
    def name(self) -> str:
        """解析器唯一标识名"""
        pass

    @abstractmethod
    def parse(
        self,
        html_or_text: str,
        base_url: str = "",
        rules: Optional[Dict[str, Any]] = None
    ) -> ParseResult:
        """
        解析页面并返回结构化数据及超链接列表
        """
        pass

    @staticmethod
    def normalize_url(url: str, base_url: str) -> Optional[str]:
        """将相对路径转为完整的绝对URL，并滤除非HTTP(S)协议"""
        if not url:
            return None
        url = url.strip()
        if url.startswith(("javascript:", "mailto:", "tel:", "#", "data:")):
            return None
        if base_url:
            full_url = urljoin(base_url, url)
        else:
            full_url = url
        parsed = urlparse(full_url)
        if parsed.scheme in ("http", "https"):
            return full_url
        return None


# 别名兼容
BaseParserStrategy = BaseParser
