# -*- coding: utf-8 -*-
"""全局配置"""
from dataclasses import dataclass, field


@dataclass
class Config:
    base_url: str = "https://www.mtyy5.com"
    start_urls: list = field(default_factory=lambda: ["https://www.mtyy5.com"])
    concurrency: int = 15
    timeout_total: int = 40
    timeout_connect: int = 15
    max_retries: int = 3
    retry_delay: float = 2.0
    output_dir: str = "./downloads_mtyy5"
    db_path: str = "./mtyy5_queue.db"
    queue_mode: str = "sqlite"          # "memory" | "sqlite"
    parsers: list = field(default_factory=lambda: ["bs4", "lxml", "regex"])
    max_depth: int = 4
    max_pages: int = 5000

    user_agent: str = (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/125.0.0.0 Safari/537.36"
    )

    headers: dict = field(default_factory=lambda: {
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
        "Connection": "keep-alive",
    })

    resource_types: dict = field(default_factory=lambda: {
        "image":    {"exts": [".jpg", ".jpeg", ".png", ".gif", ".webp", ".bmp", ".svg", ".ico"],
                     "dir": "images"},
        "video":    {"exts": [".mp4", ".mkv", ".avi", ".mov", ".wmv", ".webm"],
                     "dir": "videos"},
        "audio":    {"exts": [".mp3", ".wav", ".flac", ".aac", ".ogg", ".wma", ".m4a"],
                     "dir": "audios"},
        "document": {"exts": [".pdf", ".doc", ".docx", ".xls", ".xlsx", ".ppt", ".pptx",
                              ".txt", ".zip", ".rar", ".7z"],
                     "dir": "documents"},
        "stream":   {"exts": [".m3u8", ".mpd", ".flv", ".ts", ".m4s"],
                     "dir": "streams"},
    })

    allowed_domains: list = field(default_factory=list)   # 空 = 不限制