"""
全局配置模块
使用单例模式管理爬虫所有配置项
"""
import os
from enum import Enum
from pathlib import Path
from typing import Optional, List, Dict, Any
from dataclasses import dataclass, field
from urllib.parse import urlparse


class FetchMode(Enum):
    """抓取模式枚举"""
    MEMORY_QUEUE = "memory_queue"       # 一次性内存加载队列后下载
    STREAM_QUEUE = "stream_queue"       # 边存队列边下载（流式）


class ParseMode(Enum):
    """解析模式枚举"""
    BS4 = "bs4"                         # BeautifulSoup4解析
    XPATH = "xpath"                     # XPath解析
    REGEX = "regex"                     # 正则表达式解析


class ResourceType(Enum):
    """资源类型枚举，用于目录分组"""
    HTML = "html"
    CSS = "css"
    JS = "js"
    IMAGE = "image"
    VIDEO = "video"
    AUDIO = "audio"
    FONT = "font"
    JSON = "json"
    XML = "xml"
    PDF = "pdf"
    OTHER = "other"


# 文件扩展名到资源类型的映射
EXTENSION_MAP = {
    '.html': ResourceType.HTML, '.htm': ResourceType.HTML, '.shtml': ResourceType.HTML,
    '.css': ResourceType.CSS,
    '.js': ResourceType.JS, '.mjs': ResourceType.JS,
    '.jpg': ResourceType.IMAGE, '.jpeg': ResourceType.IMAGE, '.png': ResourceType.IMAGE,
    '.gif': ResourceType.IMAGE, '.webp': ResourceType.IMAGE, '.svg': ResourceType.IMAGE,
    '.bmp': ResourceType.IMAGE, '.ico': ResourceType.IMAGE, '.tiff': ResourceType.IMAGE,
    '.mp4': ResourceType.VIDEO, '.webm': ResourceType.VIDEO, '.avi': ResourceType.VIDEO,
    '.mov': ResourceType.VIDEO, '.mkv': ResourceType.VIDEO, '.flv': ResourceType.VIDEO,
    '.m4v': ResourceType.VIDEO, '.wmv': ResourceType.VIDEO, '.mpg': ResourceType.VIDEO,
    '.mpeg': ResourceType.VIDEO, '.3gp': ResourceType.VIDEO,
    # HLS / DASH 流媒体（直链分片或清单，按视频类资源归档）
    '.m3u8': ResourceType.VIDEO, '.ts': ResourceType.VIDEO, '.m4s': ResourceType.VIDEO,
    '.mpd': ResourceType.VIDEO,
    '.mp3': ResourceType.AUDIO, '.wav': ResourceType.AUDIO, '.ogg': ResourceType.AUDIO,
    '.flac': ResourceType.AUDIO, '.aac': ResourceType.AUDIO, '.m4a': ResourceType.AUDIO,
    '.woff': ResourceType.FONT, '.woff2': ResourceType.FONT, '.ttf': ResourceType.FONT,
    '.eot': ResourceType.FONT, '.otf': ResourceType.FONT,
    '.json': ResourceType.JSON,
    '.xml': ResourceType.XML, '.rss': ResourceType.XML,
    '.pdf': ResourceType.PDF,
}


@dataclass
class CrawlerConfig:
    """爬虫全局配置（单例）"""
    # ---------- 基础设置 ----------
    base_url: str = ""
    domain: str = ""
    output_dir: Path = field(default_factory=lambda: Path("./output"))
    user_agent: str = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"

    # ---------- 模式切换 ----------
    fetch_mode: FetchMode = FetchMode.MEMORY_QUEUE
    parse_mode: ParseMode = ParseMode.BS4

    # ---------- 并发与速率 ----------
    max_concurrent: int = 10            # 信号量最大并发数
    max_connections: int = 50           # 连接器最大连接数
    request_delay: float = 0.5          # 请求间隔秒数（随机浮动0~delay）
    timeout: int = 30                   # 请求超时秒数
    download_chunk_size: int = 64 * 1024  # 流式下载分块大小（字节），大视频用更大块以提升吞吐

    # ---------- 重试机制 ----------
    max_retries: int = 3                # 最大重试次数
    retry_delay: float = 1.0            # 初始重试延迟
    retry_backoff: float = 2.0          # 重试退避系数
    retry_on_status: tuple = (429, 500, 502, 503, 504)

    # ---------- 断点续传 ----------
    enable_resume: bool = True          # 是否启用断点续爬
    state_file: str = "crawl_state.json"  # 断点状态文件

    # ---------- 防重复 ----------
    deduplicate: bool = True            # 是否去重
    check_file_size: bool = True        # 下载时比对文件大小防重复

    # ---------- 范围控制 ----------
    stay_in_domain: bool = True         # 是否限制在同域名内
    max_depth: int = -1                 # 最大爬取深度，-1表示无限
    max_pages: int = -1                 # 最大抓取页面数，-1表示无限
    max_file_size: int = -1             # 单文件最大字节数，-1表示不限

    # ---------- 资源过滤 ----------
    download_resources: bool = True     # 是否下载静态资源
    follow_robots: bool = False         # 是否遵守robots.txt
    allowed_extensions: Optional[set] = None
    excluded_patterns: List[str] = field(default_factory=list)

    # ---------- 代理 ----------
    enable_proxy: bool = False
    proxy_pool: List[str] = field(default_factory=list)
    proxy_rotation_strategy: str = "round_robin"  # round_robin / random / least_used
    proxy_test_url: str = "http://httpbin.org/ip"

    # ---------- 逆向解密 ----------
    enable_decrypt: bool = False
    decrypt_handlers: Dict[str, Any] = field(default_factory=dict)

    # ---------- HLS(m3u8) 流媒体 ----------
    hls_enabled: bool = True
    # DASH(mpd) 流媒体下载开关；分片并发/重试/上限复用上面的 hls_segment_* 配置
    dash_enabled: bool = True             # 识别到 .m3u8 是否自动下载分片并合并成片
    hls_segment_concurrency: int = 8     # 单个 m3u8 内部分片下载并发数
    hls_segment_retries: int = 3         # 单个分片失败重试次数
    hls_max_segments: int = -1           # 最多合并的分片数，-1 表示不限（防止超大直播流失控）
    hls_merge_format: str = "auto"       # auto=有ffmpeg则转mp4否则保留ts / ts=强制ts / mp4=尽力转mp4
    hls_prefer_variant: str = "highest"  # master 清单选变体：highest=最高码率 / lowest=最低码率

    # ---------- 请求头 ----------
    headers: Dict[str, str] = field(default_factory=dict)
    cookies: Dict[str, str] = field(default_factory=dict)

    # ---------- 日志 ----------
    log_level: str = "INFO"
    show_progress: bool = True

    def __post_init__(self):
        if self.base_url:
            parsed = urlparse(self.base_url)
            self.domain = parsed.netloc
        if not self.headers:
            self.headers = {
                "User-Agent": self.user_agent,
                "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
                "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
                "Accept-Encoding": "gzip, deflate",
                "Connection": "keep-alive",
            }
        self.output_dir = Path(self.output_dir)
        self.output_dir.mkdir(parents=True, exist_ok=True)
        # 各资源类型子目录改为下载时按需创建（见 downloader._get_local_path），
        # 避免空跑也生成全部空目录。

    def ensure_resource_dirs(self):
        """显式创建全部资源类型子目录（可选调用）"""
        for rt in ResourceType:
            (self.output_dir / rt.value).mkdir(parents=True, exist_ok=True)


# 全局单例实例
_config_instance: Optional[CrawlerConfig] = None


def get_config() -> CrawlerConfig:
    global _config_instance
    if _config_instance is None:
        _config_instance = CrawlerConfig()
    return _config_instance


def set_config(new_config: CrawlerConfig):
    global _config_instance
    _config_instance = new_config


def reset_config():
    global _config_instance
    _config_instance = None
