"""mharvest —— 通用媒体资源抓取框架。

给一个网址，把站点里的图片、视频、音频抓下来。
支持懒加载属性、srcset、CSS 背景图、JS 里藏的地址，
以及 m3u8 流媒体（多码率选流 / AES-128 解密 / 分片合并）。

最简用法：
    from mharvest import Crawler, CrawlConfig, HttpClient, FileStore

    client = HttpClient(delay=0.5)
    store = FileStore("./downloads")
    crawler = Crawler(client, store, CrawlConfig(depth=2))
    report = crawler.run("https://example.com")
    print(report.summary())
"""

__version__ = "1.0.0"

from .crawler import ALL_KINDS, CrawlConfig, Crawler, Report
from .http import DEFAULT_UA, HttpClient
from .store import FileStore

__all__ = [
    "Crawler", "CrawlConfig", "Report", "HttpClient", "FileStore",
    "ALL_KINDS", "DEFAULT_UA", "__version__",
]
