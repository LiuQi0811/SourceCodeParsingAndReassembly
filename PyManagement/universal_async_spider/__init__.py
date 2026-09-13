"""
通用异步全站爬虫框架 Universal Async Spider
支持：异步并发、进度条、设计模式、自动重试、断点续传、JS/AES/Base64 解密插件
"""

from .config import Config
from .spider import UniversalSpider

__all__ = ["Config", "UniversalSpider"]
__version__ = "1.0.0"
