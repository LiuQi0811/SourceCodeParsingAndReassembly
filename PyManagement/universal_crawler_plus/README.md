# 通用全站异步爬虫框架

一个功能完备、高度可扩展的Python通用全站爬虫框架，整合了生产环境爬虫所需的全部高级特性。

## ✨ 核心特性

### 🔄 两种抓取模式（可随意切换）
| 模式 | 说明 | 适用场景 |
|------|------|----------|
| `memory_queue` | 一次性内存加载队列后下载 | 中小型站点、需要完整URL列表后统一调度 |
| `stream_queue` | 边解析边存队列边下载（流式） | 大型站点、深度爬取、内存敏感场景 |

### 🔍 三种解析模式（可随意切换）
| 模式 | 说明 | 优势 |
|------|------|------|
| `bs4` | BeautifulSoup4 + lxml | 容错性强、API友好、适合HTML |
| `xpath` | lxml XPath | 速度快、选择器精准、适合结构化页面 |
| `regex` | 正则表达式 | 最快速、适合简单提取、JS渲染内容 |

### 🛡️ 企业级特性
- **全异步架构**：基于`aiohttp` + `asyncio`，高并发高性能
- **信号量并发控制**：精确控制并发数，避免被封IP
- **智能重试**：指数退避重试，针对429/5xx自动重试，4xx不重试
- **断点续爬续传**：自动保存进度，中断后重启可从断点继续；下载支持HTTP Range断点续传
- **防重复下载**：URL级去重 + 文件级去重，避免重复请求
- **动态代理池**：支持轮询/随机/最少使用三种代理轮换策略，自动健康检测、失败剔除
- **自动目录分组**：按资源类型(html/css/js/image/video/audio/font等)自动创建目录分类存储
- **实时进度条**：基于tqdm的多维度进度显示，实时统计成功/失败/跳过/数据量/速率
- **逆向解密框架**：自动处理Gzip/Deflate/Brotli解压、Base64/实体/Unicode解码，支持AES/DES对称解密、JS混淆执行还原（可扩展自定义解密处理器）
- **流媒体下载（HLS/DASH）**：自动解析 m3u8（多码率Master、AES-128解密）与 mpd（SegmentTemplate/Timeline/List、选轨），并发下载分片并合并为可播放的 ts/mp4；支持 HLS 外挂 WebVTT 字幕轨下载与分片级进度条（详见下文“视频等媒体资源下载”）
- **自动编码检测**：基于chardet自动识别网页编码，解决乱码问题
- **请求头随机化**：User-Agent随机轮换，模拟真实浏览器
- **域名/深度/页数限制**：灵活控制爬取范围
- **URL规范化**：自动去除锚点、跟踪参数，标准化URL格式
- **责任链/工厂/策略/单例/观察者/生产者消费者**：大量设计模式保证代码可扩展性

### 🎬 视频等媒体资源下载
- **直链音视频（已支持）**：自动识别 `mp4/webm/mov/mkv/avi/flv/m4v/wmv/mpg` 与 `mp3/m4a/aac/wav/ogg` 等扩展名；抓取 `<video>/<source>/<audio>` 的 `src`、`data-src`、`poster`，并兜底扫描内联脚本中的媒体直链（含协议相对地址 `//...`）。统一流式分块落盘到 `output/video|audio/`，支持 HTTP Range 断点续传；分块大小由 `CrawlerConfig.download_chunk_size` 控制（默认 64KB，兼顾大文件吞吐与内存）。
- **HLS（m3u8）流媒体（已支持自动下载合并）**：识别到 `.m3u8` 后自动解析清单——支持 Master 多码率（默认选最高码率，`hls_prefer_variant` 可切 lowest）、相对路径补全、分片有界并发下载与失败重试、`#EXT-X-KEY:METHOD=AES-128` 解密（显式 IV 或按媒体序列号推导 IV，仅末片去 PKCS7 填充），最终按序合并为可直接播放的 `.ts`（**纯 Python、无外部依赖**）；若系统装有 ffmpeg，会再用 `-c copy` 无损转封装为 `.mp4`。相关配置：`hls_segment_concurrency`（分片并发，默认8，DASH 也复用）、`hls_segment_retries`（单片重试）、`hls_max_segments`（分片上限防失控）、`hls_merge_format`（auto/ts/mp4）。暂不支持 SAMPLE-AES、EXT-X-BYTERANGE 与 `blob:` 地址；直播流（无 `#EXT-X-ENDLIST`）只下载当前清单内分片、不持续追流。
- **DASH（mpd）流媒体（已支持自动下载合并）**：识别到 `.mpd` 后用标准库解析 MPD（`urn:mpeg:dash` 命名空间），支持多级 BaseURL 相对补全、`SegmentTemplate`（`$Number$`/`$Number%05d$`/`$Time$`/`$RepresentationID$`）、`SegmentTimeline`（含 `S@r` 重复）、`SegmentList`；视频/音频各取最高带宽轨，fMP4 按 `[初始化段][媒体段…]` 二进制拼接。音视频同轨直接产出 `.mp4`（纯 Python）；音视频分离时分别落盘 `.video.mp4`/`.audio.m4a`，有 ffmpeg 则 `-c copy` 合流为最终 `.mp4`，无 ffmpeg 则保留两个文件。开关 `dash_enabled`（默认开）。暂不支持 ContentProtection 通用加密（CENC/CBCS）、SegmentBase(indexRange) 与多周期（Multi-Period，仅取首个 Period）；`type="dynamic"` 直播只下当前分片。
- **外挂字幕与分片进度**：HLS Master 中的 `EXT-X-MEDIA TYPE=SUBTITLES` 字幕轨会随视频一并下载，把多个 WebVTT 分片合并为单个 `<片名>.<语言>.vtt`，并依据 `X-TIMESTAMP-MAP` 把各分片 cue 对齐到全局时间轴（字幕加密暂不支持，失败不影响主视频）。HLS/DASH 分片下载均带 tqdm 分片级进度条（未安装 tqdm 或 `show_progress=False` 时自动静默降级）。

## 📦 安装

```bash
cd universal_crawler
pip install -r requirements.txt
```

## 🚀 快速开始

### 命令行使用

```bash
# 最简使用
python main.py -u https://example.com

# 流式爬取 + XPath解析 + 20并发
python main.py -u https://example.com --fetch-mode stream --parse-mode xpath -c 20

# 使用代理池 + 深度限制3 + 最多1000页
python main.py -u https://example.com --proxies proxies.txt --depth 3 --max-pages 1000

# 仅爬取HTML不下载资源，允许外链
python main.py -u https://example.com --no-resources --external

# 启用自动逆向解密
python main.py -u https://example.com --decrypt
```

### 代理文件格式（proxies.txt）
```
http://user:pass@ip:port
http://ip:port
socks5://ip:port
```

### 编程方式使用

```python
import asyncio
from pathlib import Path
from core.config import CrawlerConfig, FetchMode, ParseMode
from core.crawler import Crawler

async def main():
    config = CrawlerConfig(
        base_url="https://example.com",
        output_dir=Path("./output"),
        fetch_mode=FetchMode.STREAM_QUEUE,
        parse_mode=ParseMode.XPATH,
        max_concurrent=15,
        max_depth=2,
        request_delay=0.3,
        enable_decrypt=True,
    )

    async with Crawler(config) as crawler:
        # 链式调用配置
        crawler.set_concurrency(20) \
               .set_delay(1.0) \
               .enable_resource_download(True)

        # 添加自定义回调
        def on_page_parsed(result):
            print(f"爬取页面: {result.title} - {result.url}")
        crawler.set_parse_callback(on_page_parsed)

        # 启动爬取
        await crawler.start("https://example.com")

asyncio.run(main())
```

## 📁 项目结构

```
universal_crawler/
├── core/                    # 核心引擎
│   ├── config.py           # 全局配置 + 枚举定义
│   ├── models.py           # 数据模型
│   ├── queue_manager.py    # URL队列管理器（两种模式）
│   └── crawler.py          # 爬虫主引擎（门面）
├── parsers/                 # 解析器模块
│   └── base_parser.py      # BS4/XPath/Regex三种解析器 + 工厂
├── downloaders/             # 下载器模块
│   ├── downloader.py       # 异步下载器（重试/断点续传/代理/m3u8·mpd分流）
│   ├── hls_downloader.py   # HLS下载器（m3u8解析/分片并发/AES-128/字幕/合并ts·mp4）
│   └── dash_downloader.py  # DASH下载器（MPD解析/选轨/fMP4拼接/ffmpeg音视频合流）
├── proxies/                 # 代理池模块
│   └── proxy_pool.py       # 动态代理池（多策略轮换+健康检测）
├── decryptors/              # 逆向解密模块
│   └── decryptor.py        # 解密责任链（解压/解码/AES/JS执行）
├── utils/                   # 工具模块
│   ├── url_utils.py        # URL处理工具
│   ├── logger.py           # 彩色日志
│   └── progress.py         # 进度条管理
├── output/                  # 输出目录（自动创建）
│   ├── html/
│   ├── css/
│   ├── js/
│   ├── image/
│   └── ...
├── main.py                  # 主入口 + CLI
├── requirements.txt         # 依赖清单
└── README.md               # 本文件
```

## 🔧 扩展开发

### 自定义解析器
```python
from parsers.base_parser import BaseParser, ParserFactory
from core.config import ParseMode

class MyCustomParser(BaseParser):
    def parse(self, html, url, headers=None):
        # 自定义解析逻辑
        result = ParseResult(url=url, success=True)
        # ...
        return result

# 注册自定义解析器
ParserFactory.register_parser(ParseMode.CUSTOM, MyCustomParser)
```

### 自定义解密处理器
```python
from decryptors.decryptor import DecryptHandler, register_decrypt_handler

class MyCustomDecryptor(DecryptHandler):
    def can_handle(self, content, headers, context):
        # 判断是否需要你的解密逻辑
        return headers.get("X-Encrypted") == "my-algo"

    def decrypt(self, content, headers, context):
        # 自定义解密逻辑
        return my_decrypt(content)

register_decrypt_handler(MyCustomDecryptor())
```

## ⚠️ 免责声明
本工具仅供学习研究和合法合规的站点抓取使用，请遵守目标网站的`robots.txt`和相关法律法规，请勿用于非法用途。
