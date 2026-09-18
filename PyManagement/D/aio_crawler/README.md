# aio_crawler — 通用异步爬虫框架

基于 **Python 3.14.7 + asyncio + aiohttp** 的全异步爬虫框架，融合策略模式、工厂模式、观察者模式，
提供双队列、三解析器、字符集自动识别、分类目录保存与流媒体合并能力。

> 使用边界：本框架为通用工程组件，请仅用于**你自己拥有权利、或已获授权**的内容与站点。
> 不提供任何 DRM / 商业流媒体加密的破解或规避能力；AES-128 加密 HLS 仅按 HLS 公开标准处理。

## 功能总览

| 需求 | 实现 |
|------|------|
| asyncio + aiohttp 异步 | `engine.py` 工作池 + `aiohttp.ClientSession` 连接池 |
| 双队列可切换 | `MemoryUrlQueue`（一次性加载）/ `SqliteUrlQueue`（边发现边入库、断点续爬） |
| 三解析器 | `BS4Parser` / `XPathParser` / `RegexParser`，支持全局/单任务切换与组合 |
| 字符集自动识别 | HTTP 头 → BOM → `<meta>` → 统计检测 → 回退，gbk/utf-8 等中文不乱码 |
| 资源分类保存 | `downloads/<标题>/images|videos|docs|audio|other/` + `manifest.json` |
| 流媒体合并 | HLS(m3u8) / DASH(mpd) / HTTP-FLV / RTMP / RTSP / WebRTC，ffmpeg 转封装 mp4 |
| 设计模式 | 策略（爬取策略）、工厂（队列/解析器/下载器/策略）、观察者（事件总线） |

## 目录结构

```
aio_crawler/
├── config.py            # 运行配置（dataclass + CLI 解析）
├── models.py            # Task / Page / ResourceRef / ParseResult / DownloadResult
├── charset.py           # 字符集识别与解码
├── urlutils.py          # URL 规范化、文件名清洗、资源分类
├── observer.py          # 观察者模式：EventBus + StatsObserver / LogObserver
├── savers.py            # 标题目录保存器（分组 + manifest）
├── strategies.py        # 策略模式：fullsite / resource_only / depth_limited
├── engine.py            # 爬取引擎（抓取→解码→解析→入队→下载）
├── main.py / __main__.py# 命令行入口
├── parsers/             # bs4 / xpath / re / composite + ParserFactory
├── queues/              # memory / sqlite + QueueFactory
└── downloaders/         # http / hls / dash / flv / live + DownloaderFactory
selftest/
├── site_builder.py      # 本地测试站点生成器（GBK 页、嵌套页、HLS/DASH/图片/PDF）
├── run_selftest.py      # 全链路自测（27 项断言）
└── REPORT.md            # 自测报告
```

## 安装与运行

```bash
pip install -r requirements.txt     # aiohttp / beautifulsoup4 / lxml / charset-normalizer / aiosqlite
ffmpeg -version                     # 视频合并可选，建议安装并加入 PATH
```

### 命令行

```bash
# 内存队列，全站抓取（默认组合解析器）
python -m aio_crawler https://example.com/

# SQLite 持久化队列 + 断点续爬
python -m aio_crawler https://example.com/ --queues sqlite --db crawl.db

# 指定解析器 / 限深 / 仅资源 / 覆盖保存
python -m aio_crawler https://example.com/ --parser xpath --depth 3
python -m aio_crawler https://example.com/ --strategy resource_only --no-download
python -m aio_crawler https://example.com/ --save-root downloads --overwrite

# 自定义抓取资源类型（类别过滤 / 扩展名白名单）
python -m aio_crawler https://example.com/ --resources image,video
python -m aio_crawler https://example.com/ --accept-exts jpg,png,mp4,m3u8,mpd

# 组合解析器（顺序可调）
python -m aio_crawler https://example.com/ --parser composite:bs4,xpath,re
```

### 代码方式

```python
import asyncio
from aio_crawler.config import Config
from aio_crawler.engine import CrawlEngine

async def main():
    cfg = Config(start_urls=["https://example.com/"], queue_type="sqlite",
                 sqlite_path="crawl.db", parser_mode="auto")
    summary = await CrawlEngine(cfg).run()
    print(summary)

asyncio.run(main())
```

## 关键设计

### 1. 双队列（QueueFactory 切换）

- **memory**：起始 URL 一次性入队，进程内 `seen` 集合去重，BFS 天然有序；适合单次任务。
- **sqlite**：`urls` 表以 URL 为主键，状态机 `pending → in_progress → done/failed`；
  启动时 `in_progress` 自动复位为 `pending`，实现断点续爬；WAL 模式 + 行锁串行化，进程安全。

### 2. 三解析器（ParserFactory）

| 解析器 | 特点 |
|--------|------|
| bs4 | 标签遍历最稳，兼容畸形 HTML |
| xpath | lxml XPath 表达式，可精准抽取；显式 UTF-8 解析避免 meta 编码重判 |
| re | 轻量正则，零依赖，适合结构简单页面 |

- 全局：`Config.parser_mode`；单任务：`Task.parser_mode` 覆盖全局（工厂 `get(mode)`）。
- 组合：`CompositeParser` 按序运行、跨解析器去重合并，`auto` = bs4+xpath+re。

### 3. 字符集识别（charset.py）

识别优先级：HTTP 头 charset → BOM → `<meta charset>` → charset_normalizer 统计 → utf-8。
严格解码失败自动沿回退链重试，GBK 页面声明 utf-8 也不会乱码。

### 4. 分类目录保存（TitleSaver）

```
downloads/
└── 视频播放页-示例/          # 页面标题（清洗非法字符）
    ├── images/  videos/  docs/  audio/  other/
    ├── 视频播放页-示例.mp4    # 同名资源自动编号：_2, _3 ...
    └── manifest.json          # 资源清单（url/kind/group/path/size/method/error）
```

### 5. 流媒体合并（DownloaderFactory）

| 类型 | 处理方式 |
|------|----------|
| HLS m3u8 | master 自动选最高码率档位 → 分片并发下载 → 顺序合并 → ffmpeg 转封装 mp4；标准 AES-128 按 HLS 规范交 ffmpeg |
| DASH mpd | SegmentList / SegmentTemplate($Number$/$Time$/Timeline) → 视频/音频轨并发下载 → ffmpeg 混流 mp4 |
| HTTP-FLV | 直链流式下载；失败回退 ffmpeg 录制 |
| RTMP/RTSP/WebRTC | ffmpeg 录制（`-t` 限时，防止无限录制）；rtsp 默认 TCP 传输 |

## 设计模式映射

- **策略模式**：`CrawlStrategy`（fullsite / resource_only / depth_limited）决定链接过滤、资源过滤与停止条件。
- **工厂模式**：`QueueFactory`、`ParserFactory`、`DownloaderFactory`、`StrategyFactory` 统一创建。
- **观察者模式**：`EventBus` 发布 12 种事件（页面抓取/解析、资源发现/下载/失败、爬取起止等），
  `StatsObserver`（统计）与 `LogObserver`（日志）订阅，可自行扩展订阅者。

## 自测

```bash
python selftest/run_selftest.py
```

27 项断言全部通过，覆盖：GBK 中文解码（头部/meta/回退三种路径）、三解析器 + 组合 + 单任务切换、
内存队列全站抓取、标题目录与分组保存、HLS/DASH/直链视频合并与 ffprobe 可播放性校验、
SQLite 队列中断→续爬→完成、CLI 双队列模式。产物在 `selftest/downloads/`，报告在 `selftest/REPORT.md`。

## 已知限制

- `max_pages` 为软上限：并发在飞任务可能使实际抓取数略超上限（用于断点续爬测试足够）。
- DASH 仅支持 SegmentList / SegmentTemplate(+Timeline) 常见封装；其余 MPD 结构回退 ffmpeg。
- WebRTC 录制依赖 ffmpeg 构建支持（部分构建不支持 webrtc 输入）。
- DRM（Widevine/FairPlay/PlayReady）不在支持范围。
