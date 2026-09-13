"""工具函数模块"""
import re
import hashlib
import logging
from urllib.parse import urlparse, urljoin, urldefrag
from pathlib import Path
from typing import Optional


def setup_logger(name: str = "spider", level: str = "INFO", log_file: Optional[str] = None) -> logging.Logger:
    logger = logging.getLogger(name)
    if logger.handlers:
        return logger
    logger.setLevel(getattr(logging, level.upper(), logging.INFO))
    fmt = logging.Formatter(
        "%(asctime)s [%(levelname)s] %(name)s - %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S"
    )
    ch = logging.StreamHandler()
    ch.setFormatter(fmt)
    logger.addHandler(ch)
    if log_file:
        fh = logging.FileHandler(log_file, encoding="utf-8")
        fh.setFormatter(fmt)
        logger.addHandler(fh)
    return logger


def normalize_url(url: str, base: Optional[str] = None) -> str:
    """URL 规范化：去锚点、补全相对路径、小写域名"""
    if base:
        url = urljoin(base, url)
    url, _ = urldefrag(url)
    parsed = urlparse(url)
    scheme = parsed.scheme.lower() or "http"
    netloc = parsed.netloc.lower()
    path = parsed.path or "/"
    qs = parsed.query
    normalized = f"{scheme}://{netloc}{path}"
    if qs:
        normalized += f"?{qs}"
    return normalized


def is_same_domain(url: str, allowed_domains: set) -> bool:
    """判断 url 是否在允许的域名集合中（含子域名）"""
    try:
        host = urlparse(url).netloc.lower().split(":")[0]
    except Exception:
        return False
    if host in allowed_domains:
        return True
    for d in allowed_domains:
        if host.endswith("." + d):
            return True
    return False


def url_to_filename(url: str, output_dir: str) -> Path:
    """将 URL 映射为本地文件路径（保留路径层级）"""
    parsed = urlparse(url)
    host = parsed.netloc
    path = parsed.path
    if not path or path.endswith("/"):
        path = path + "index.html"
    elif "." not in Path(path).name:
        path = path + ".html"
    # 防止非法字符
    safe_path = re.sub(r'[<>:"|?*]', "_", path.lstrip("/"))
    fp = Path(output_dir) / host / safe_path
    # 路径过长时截断 + hash
    if len(str(fp)) > 200:
        h = hashlib.md5(url.encode()).hexdigest()[:10]
        fp = Path(output_dir) / host / f"{h}_{Path(safe_path).name}"
    return fp


def is_resource_url(url: str, allowed_exts: set) -> bool:
    """判断是否为可抓取的页面（非静态资源）"""
    path = urlparse(url).path.lower()
    ext = Path(path).suffix
    if ext == "":
        return True
    return ext in allowed_exts


def extract_domain(url: str) -> str:
    """从 URL 提取域名"""
    return urlparse(url).netloc.lower().split(":")[0]
