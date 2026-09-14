# utils/url_utils.py
import hashlib
from urllib.parse import urlparse, urlunparse
from typing import Optional


def url_fingerprint(url: str) -> str:
    """生成URL指纹用于去重"""
    return hashlib.md5(url.strip().encode("utf-8")).hexdigest()


def normalize_url(raw_url: str, base_url: Optional[str] = None) -> str:
    """简单URL规范化，移除锚点"""
    parsed = urlparse(raw_url)
    return urlunparse((parsed.scheme, parsed.netloc, parsed.path, parsed.params, parsed.query, ""))


def get_domain(url: str) -> str:
    parsed = urlparse(url)
    return parsed.netloc
