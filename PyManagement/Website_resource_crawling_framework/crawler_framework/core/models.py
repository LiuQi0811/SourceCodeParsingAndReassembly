"""
异步全站资源通用抓取框架 - 核心数据模型
支持 Python 3.12+ / 3.14+ 现代异步环境
"""
from dataclasses import dataclass, field
from enum import Enum
from typing import Any, Dict, List, Optional, Union
import time
import uuid


class TaskStatus(str, Enum):
    """抓取任务状态"""
    PENDING = "pending"         # 待抓取
    PROCESSING = "processing"   # 正在抓取
    COMPLETED = "completed"     # 抓取完成
    FAILED = "failed"           # 抓取失败
    CANCELLED = "cancelled"     # 已取消


class QueueMode(str, Enum):
    """队列工作模式"""
    MEMORY = "memory"           # 一次性全量加载内存队列
    SQLITE = "sqlite"           # SQLite持久化断点续爬队列


class ParserMode(str, Enum):
    """解析器类型"""
    BS4 = "bs4"                 # BeautifulSoup4
    XPATH = "xpath"             # XPath (lxml)
    REGEX = "regex"             # 正则表达式 (re)
    COMPOSITE = "composite"     # 组合式解析器


class ResourceCategory(str, Enum):
    """资源分类"""
    PAGE = "pages"              # 网页文本/HTML
    IMAGE = "images"            # 图片
    VIDEO = "videos"            # 视频
    AUDIO = "audios"            # 音频
    DOCUMENT = "documents"      # 办公/PDF文档
    ARCHIVE = "archives"        # 压缩包
    CODE = "scripts_styles"     # JS/CSS等脚本样式
    DATA = "data"               # JSON/XML/CSV等数据接口
    OTHER = "others"            # 未知或其他类型


@dataclass
class CrawlTask:
    """抓取任务数据对象"""
    url: str
    task_id: str = field(default_factory=lambda: str(uuid.uuid4()))
    depth: int = 0
    max_depth: int = 3
    method: str = "GET"
    headers: Dict[str, str] = field(default_factory=dict)
    params: Dict[str, Any] = field(default_factory=dict)
    data: Optional[Any] = None
    json_data: Optional[Any] = None
    priority: int = 0
    status: TaskStatus = TaskStatus.PENDING
    retry_count: int = 0
    max_retries: int = 3
    parser_type: Optional[str] = None  # 针对当前任务指定的解析器名称，若为None则用全局默认
    parser_rules: Optional[Dict[str, Any]] = None  # 任务专属提取规则字典
    decrypt_type: Optional[str] = None  # 逆向解密方案，如 "aes", "base64", "xor", "custom_js"
    decrypt_params: Dict[str, Any] = field(default_factory=dict)
    extra: Dict[str, Any] = field(default_factory=dict)
    created_at: float = field(default_factory=time.time)
    updated_at: float = field(default_factory=time.time)


@dataclass
class CrawlResponse:
    """抓取响应数据对象"""
    task: CrawlTask
    status_code: int
    url: str
    headers: Dict[str, str]
    content_type: str
    raw_content: bytes
    text: Optional[str] = None
    encoding: str = "utf-8"
    category: ResourceCategory = ResourceCategory.OTHER
    saved_path: Optional[str] = None
    file_size: int = 0
    extracted_urls: List[str] = field(default_factory=list)
    parsed_data: Dict[str, Any] = field(default_factory=dict)
    decrypted_content: Optional[Union[str, bytes, dict]] = None
    elapsed: float = 0.0
    error: Optional[str] = None
