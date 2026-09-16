# config.py
from dataclasses import dataclass, field


@dataclass
class CrawlerConfig:
    """全局配置"""

    # 队列类型: "memory" | "sqlite"
    queue_type: str = "memory"
    sqlite_path: str = "crawler_queue.db"

    # 解析器: "bs4" | "xpath" | "regex" | "leyytv" | ["xpath", "regex", "leyytv"]
    parser_type: str | list = "leyytv"

    # 输出目录
    output_dir: str = "./downloads"

    # 并发（过高会被 CDN 限流/断连）
    max_concurrency: int = 16
    worker_count: int = 2
    hls_segment_concurrency: int = 8
    request_timeout: int = 30

    # 抓取范围
    max_depth: int = 3
    # 注意: leyy.tv 视频资源托管在外部 CDN 域名，必须关闭同域名限制
    same_domain_only: bool = False

    # 请求头
    headers: dict = field(default_factory=lambda: {
        "User-Agent": (
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
            "AppleWebKit/537.36 (KHTML, like Gecko) "
            "Chrome/123.0.0.0 Safari/537.36"
        ),
        "Accept": "*/*",
        "Accept-Language": "zh-CN,zh;q=0.9",
        "Referer": "https://leyy.tv/",
    })

    # 解析规则（针对目标站点自定义）
    parse_rules: dict = field(default_factory=lambda: {
        "title": "//title/text()",
        "links": "//a/@href",
        "images": "//img/@src",
        "videos": "//video/@src | //source/@src",
        "m3u8": r"(https?://[^\s\"']+\.m3u8[^\s\"']*)",
        "mpd":  r"(https?://[^\s\"']+\.mpd[^\s\"']*)",
    })

    # 种子 URL
    seed_urls: list = field(default_factory=lambda: ["https://leyy.tv/"])
