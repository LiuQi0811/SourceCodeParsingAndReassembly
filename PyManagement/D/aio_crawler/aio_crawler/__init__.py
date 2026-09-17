# -*- coding: utf-8 -*-
"""aio_crawler - 基于 asyncio + aiohttp 的通用异步爬虫框架。

包含：策略模式（CrawlStrategy）、工厂模式（ParserFactory / QueueFactory /
DownloaderFactory / StrategyFactory）、观察者模式（EventBus + 观察者）。

特性：
- 双队列可切换：内存队列 / SQLite 持久化队列（断点续爬）
- 三种解析器：bs4 / lxml.xpath / re，支持全局与单任务切换、组合使用
- 自动识别网页字符集（gbk/utf8 等），中文不乱码
- 自动识别资源类型，按「标题/分组」建立分类目录保存
- HLS(m3u8) / DASH(mpd) / HTTP-FLV / RTMP / RTSP / WebRTC 资源抓取与合并
"""

__version__ = "1.0.0"
