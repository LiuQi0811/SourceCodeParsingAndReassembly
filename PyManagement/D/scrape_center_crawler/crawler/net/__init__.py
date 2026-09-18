# -*- coding: utf-8 -*-
"""网络层：字符集自动识别与解码、URL 工具"""
from .encoding import decode_bytes, detect_charset
from .fetcher import AsyncFetcher, FetchResult

__all__ = ["decode_bytes", "detect_charset", "AsyncFetcher", "FetchResult"]
