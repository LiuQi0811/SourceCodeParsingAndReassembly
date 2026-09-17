"""
URL工具类
处理URL规范化、过滤、类型判断等
"""
import re
import hashlib
from urllib.parse import urljoin, urlparse, urldefrag, unquote
from pathlib import Path
from typing import Optional, Set, List, Tuple
from core.config import EXTENSION_MAP, ResourceType, get_config


def normalize_url(url: str, base_url: str = "") -> str:
    """规范化URL"""
    if not url:
        return ""
    # 去除锚点
    url, _ = urldefrag(url)
    # 去除协议无关URL的前缀问题（先补全，保证 urljoin 语义）
    if url.startswith("//"):
        url = "https:" + url
    # 相对路径转绝对路径（在解码之前做，避免 %xx 被提前展开影响拼接）
    if base_url:
        url = urljoin(base_url, url)
    # 规范化末尾斜杠
    parsed = urlparse(url)
    # 仅对 path 解码；query 保持原样——解码整个 URL 会破坏时效签名参数
    # （auth_key 等常含 %26/%3D，%26 解码后会把参数拆开导致服务端验签 403）
    path = unquote(parsed.path)
    path = path.rstrip("/")
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


# 常见泛化文件名：两个不同视频都叫这些名字时，必须附加稳定 hash 防止冲突
_GENERIC_STEMS = {
    "index", "media", "playlist", "master", "main", "default",
    "manifest", "stream", "movie", "video", "audio", "file", "home",
}


def stable_stem(url: str) -> str:
    """生成稳定的成片文件名主干（不含扩展名）。

    与 url_to_filename 的区别：忽略时效签名 query（auth_key/token 等），
    只对 scheme://netloc/path 计算 hash——同一视频在签名刷新后仍得到
    相同文件名，断点续传与去重才可靠。

    优先使用路径最后一段（内容 hash/文件名，可读性好）；
    若是 index/media 等泛化名则附加稳定短 hash 防冲突。
    """
    parsed = urlparse(url)
    stable_url = f"{parsed.scheme}://{parsed.netloc}{parsed.path}"
    digest = hashlib.md5(stable_url.encode()).hexdigest()[:8]
    name_part = Path(parsed.path).stem
    name_part = re.sub(r'[<>:"/\\|?*]', '_', name_part).strip("._")
    if len(name_part) > 80:
        name_part = name_part[:80]
    if not name_part or name_part.lower() in _GENERIC_STEMS:
        return f"{name_part or 'media'}_{digest}"
    return name_part


def is_stream_url(url: str) -> bool:
    """是否为 HLS/DASH 清单地址（.m3u8/.mpd）"""
    try:
        path = urlparse(url).path.lower()
    except Exception:
        return False
    return path.endswith(".m3u8") or path.endswith(".mpd")


def filter_h265_resources(resources: List[str], h265_resources: List[str],
                          skip: bool = True) -> List[str]:
    """默认跳过 H265 备用流（如 DPlayer 的 url_h265），只下普通流。

    若普通资源里没有任何流媒体清单（.m3u8/.mpd），说明页面只有 H265 流，
    此时降级保留 H265，避免什么都下不到。纯函数，供爬虫入队前调用。
    """
    if not h265_resources or not skip:
        return list(resources)
    h265 = set(h265_resources)
    has_other_stream = any(is_stream_url(u) for u in resources)
    if has_other_stream:
        return list(resources)
    return list(resources) + [u for u in h265 if u not in resources]


# 内联音视频直链 / HLS/DASH 清单地址（覆盖 JS 动态赋值、DPlayer 配置等场景）
_INLINE_MEDIA_RE = re.compile(
    r'''["'](?:https?:)?//[^\s"'<>]+?\.(?:m3u8|mp4|webm|mov|mkv|avi|flv|m4v|wmv|mpg|mpeg|ts|m4s|mpd|mp3|m4a|aac|wav|ogg)(?:[?#][^\s"'<>]*)?["']''',
    re.IGNORECASE,
)


def split_inline_media(text: str, base_url: str = "") -> Tuple[List[str], List[str]]:
    """从原始文本中扫描内联音视频直链，返回 (普通资源, H265备用流)。

    识别依据：URL 本身或匹配位置前文（如 DPlayer 配置键名 url_h265/video_h265）
    含 h265/hevc 字样。H265 流单独返回，供上层默认跳过、只下普通流；
    若页面只有 H265 流，上层仍会降级保留。
    """
    found: List[str] = []
    h265: List[str] = []
    if not text:
        return found, h265
    # 归一化 JSON/JS 转义斜杠：DPlayer 等播放器配置常写成 https:\/\/host\/a.m3u8
    scan_text = text.replace("\\/", "/")
    for match in _INLINE_MEDIA_RE.finditer(scan_text):
        raw = match.group(0)[1:-1]  # 去掉两端引号
        full = normalize_url(raw, base_url)
        if not full or get_resource_type(full) not in (ResourceType.VIDEO, ResourceType.AUDIO):
            continue
        # 前文 60 字符内出现 h265/hevc（通常是键名如 url_h265）或 URL 本身含 h265/hevc
        context = scan_text[max(0, match.start() - 60): match.end()]
        if re.search(r"h265|hevc", context, re.IGNORECASE):
            h265.append(full)
        else:
            found.append(full)
    return found, h265


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
