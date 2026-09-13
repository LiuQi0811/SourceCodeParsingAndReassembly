"""
URL工具类
处理URL规范化、过滤、类型判断等
"""
import re
import hashlib
from urllib.parse import urljoin, urlparse, urldefrag, unquote
from pathlib import Path
from typing import Optional, Set
from core.config import EXTENSION_MAP, ResourceType, get_config


def normalize_url(url: str, base_url: str = "") -> str:
    """规范化URL"""
    if not url:
        return ""
    # 去除锚点
    url, _ = urldefrag(url)
    # 解码并重新编码
    url = unquote(url)
    # 相对路径转绝对路径
    if base_url:
        url = urljoin(base_url, url)
    # 去除协议无关URL的前缀问题
    if url.startswith("//"):
        url = "https:" + url
    # 规范化末尾斜杠
    parsed = urlparse(url)
    path = parsed.path.rstrip("/")
    if not path:
        path = "/"
    normalized = f"{parsed.scheme}://{parsed.netloc}{path}"
    if parsed.query:
        normalized += f"?{parsed.query}"
    return normalized


def get_domain(url: str) -> str:
    """获取域名"""
    try:
        return urlparse(url).netloc
    except Exception:
        return ""


def is_same_domain(url: str, domain: str) -> bool:
    """判断是否同域名"""
    url_domain = get_domain(url)
    return url_domain == domain or url_domain.endswith("." + domain)


def get_resource_type(url: str, content_type: str = "") -> ResourceType:
    """根据URL扩展名或Content-Type判断资源类型"""
    # 先根据扩展名判断
    path = urlparse(url).path
    ext = Path(path).suffix.lower()
    if ext in EXTENSION_MAP:
        return EXTENSION_MAP[ext]

    # 再根据Content-Type判断
    ct = content_type.lower()
    if "text/html" in ct:
        return ResourceType.HTML
    elif "text/css" in ct:
        return ResourceType.CSS
    elif "javascript" in ct or "js" in ct:
        return ResourceType.JS
    elif "image/" in ct:
        return ResourceType.IMAGE
    elif "video/" in ct:
        return ResourceType.VIDEO
    elif "audio/" in ct:
        return ResourceType.AUDIO
    elif "font/" in ct or "application/font" in ct:
        return ResourceType.FONT
    elif "application/json" in ct:
        return ResourceType.JSON
    elif "application/xml" in ct or "text/xml" in ct:
        return ResourceType.XML
    elif "application/pdf" in ct:
        return ResourceType.PDF
    return ResourceType.OTHER


def url_to_filename(url: str) -> str:
    """将URL转换为安全的文件名"""
    parsed = urlparse(url)
    # 使用hash避免文件名过长和特殊字符问题
    url_hash = hashlib.md5(url.encode()).hexdigest()[:10]
    path = parsed.path.strip("/")
    if not path:
        path = "index"
    # 取路径最后部分作为文件名主体
    name_part = path.split("/")[-1]
    name_part = re.sub(r'[<>:"/\\|?*]', '_', name_part)
    if len(name_part) > 80:
        name_part = name_part[:80]
    ext = Path(path).suffix
    if not ext:
        ext = ".html"
    return f"{name_part}_{url_hash}{ext}"


def should_exclude(url: str, patterns: list) -> bool:
    """判断URL是否匹配排除模式"""
    for pattern in patterns:
        if re.search(pattern, url, re.IGNORECASE):
            return True
    return False


def is_valid_url(url: str) -> bool:
    """验证URL格式有效性"""
    try:
        result = urlparse(url)
        return all([result.scheme in ("http", "https"), result.netloc])
    except Exception:
        return False


def clean_url(url: str) -> str:
    """清理URL中的跟踪参数"""
    # 移除常见跟踪参数
    tracking_params = re.compile(r'(utm_|spm_|from_|ref_|source=|gclid=|fbclid=)', re.IGNORECASE)
    parsed = urlparse(url)
    if parsed.query:
        query_parts = []
        for part in parsed.query.split("&"):
            if not tracking_params.search(part):
                query_parts.append(part)
        new_query = "&".join(query_parts)
        if new_query:
            return f"{parsed.scheme}://{parsed.netloc}{parsed.path}?{new_query}"
    return f"{parsed.scheme}://{parsed.netloc}{parsed.path}"
