"""配置模块 - 单例模式管理全局配置"""
from dataclasses import dataclass, field
from typing import Set, Optional, Dict, Any
from pathlib import Path


@dataclass
class Config:
    """爬虫全局配置类（单例使用）"""
    # ===== 基础配置 =====
    start_urls: list = field(default_factory=list)
    allowed_domains: Set[str] = field(default_factory=set)
    output_dir: str = "output"

    # ===== 并发与限速 =====
    concurrency: int = 20                 # 最大并发数
    delay: float = 0.3                    # 请求基础间隔（秒）
    random_delay: bool = True             # 随机抖动
    max_depth: int = 10                   # 最大爬取深度
    timeout: int = 30                     # 单次请求超时（秒）

    # ===== 重试配置 =====
    max_retries: int = 5                  # 最大重试次数
    retry_on_status: tuple = (429, 500, 502, 503, 504)
    retry_delay: float = 1.0
    retry_backoff: float = 2.0            # 指数退避系数

    # ===== 断点续传 =====
    resume: bool = True                   # 是否启用断点续传
    state_file: str = ".spider_state.json"

    # ===== 请求头 / 反爬 =====
    user_agent: Optional[str] = None
    headers: Dict[str, str] = field(default_factory=dict)
    cookies: Dict[str, str] = field(default_factory=dict)
    proxy: Optional[str] = None
    verify_ssl: bool = True

    # ===== 内容过滤 =====
    allowed_exts: Set[str] = field(default_factory=lambda: {
        ".html", ".htm", ".shtml", ".xhtml", ".jsp", ".asp", ".aspx",
        ".php", ".do", ".action", "", "/"
    })
    save_html: bool = True
    save_resources: bool = False          # 是否抓取静态资源

    # ===== 解密 / 逆向 =====
    decryption: str = "auto"              # auto / none / js / aes / custom
    decryption_key: Optional[str] = None
    decryption_iv: Optional[str] = None

    # ===== 日志 =====
    log_level: str = "INFO"
    log_file: Optional[str] = "spider.log"

    def ensure_output_dir(self):
        Path(self.output_dir).mkdir(parents=True, exist_ok=True)
        return Path(self.output_dir)
