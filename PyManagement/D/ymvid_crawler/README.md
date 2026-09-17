# ymvid_crawler

ymvid.com 全站资源异步抓取框架：从种子 URL 出发抓取网页链接、解析页面内的图片 / 视频 / 音频 / 文档等资源，并自动分类下载到本地目录。支持 HLS、DASH、直播流（RTMP/RTSP/HTTP-FLV/WebRTC）等多种视频资源。

## 功能特性

- **异步高并发**：基于 `asyncio + aiohttp`，默认 20 并发、5 个工作协程，可调
- **可插拔队列**：内存队列（`memory`）或 SQLite 队列（`sqlite`，支持断点续爬）
- **可组合解析器**：bs4 / xpath / regex 可自由组合，结果自动去重
- **观察者模式**：事件总线解耦抓取过程通知（页面抓取、资源发现、下载完成、错误等）
- **视频全链路**：直链文件、HLS（m3u8）、DASH（mpd）、直播流（rtmp/rtsp/flv/webrtc）
- **HLS 加密支持**：AES-128 解密（需 `pycryptodome`），未显式指定 IV 时按规范使用分片序号作为 IV
- **防盗链配置**：支持自定义 User-Agent、Cookie 及任意额外请求头（`--ua` / `--cookie` / `-H`）
- **资源过滤**：`--video-only` 只下载视频类资源，跳过图片 / 音频 / 文档等噪音
- **链接过滤**：`--link-include` / `--link-exclude` 用正则只跟进或跳过指定页面（如登录、搜索页）
- **资源自动分类**：按扩展名 / Content-Type / 流协议分类，落地到结构化目录
- **独立分片合并**：`merge_ts.py` 可把手头任意 TS 分片按文件名顺序合并成 mp4（FFmpeg concat，无损）

## 环境要求

| 依赖 | 说明 |
| --- | --- |
| Python | ≥ 3.10 |
| FFmpeg | 必须安装并加入 PATH（HLS 合并、DASH、直播流录制依赖；纯直链下载不需要） |
| Python 包 | 见 `requirements.txt` |

安装 Python 依赖：

```bash
pip install -r requirements.txt
```

> `pycryptodome` 用于解密 AES-128 加密的 HLS 流；不装的话加密流会静默跳过解密，合并产物损坏。

## 快速开始

```bash
# 最小示例：内存队列 + bs4/xpath 解析器，抓取并下载
python main.py -u https://www.ymvid.com/

# SQLite 队列（断点续爬）+ 组合解析器
python main.py -u https://www.ymvid.com/ -q sqlite -p bs4 xpath re

# 高并发 + 深度 3
python main.py -u https://www.ymvid.com/ -c 50 -d 3

# 携带 Cookie 与自定义请求头（防盗链站点）
python main.py -u https://www.ymvid.com/ \
    --cookie "sessionid=xxx; token=yyy" \
    -H "Origin: https://www.ymvid.com"

# 只下载视频 + 只跟进播放页链接（跳过图片、登录页、搜索页等噪音）
python main.py -u https://www.ymvid.com/play/7061 \
    --video-only \
    --link-include ".*/play/.*" \
    --link-exclude "/login|/search|/user|/captcha"
```

## 命令行参数

| 参数 | 简写 | 默认值 | 说明 |
| --- | --- | --- | --- |
| `--url` | `-u` | 必填 | 起始 URL（可多个） |
| `--queue-mode` | `-q` | `memory` | 队列模式：`memory` / `sqlite` |
| `--parsers` | `-p` | `bs4 xpath` | 解析器组合：`bs4` `xpath` `lxml` `re` `regex` |
| `--concurrency` | `-c` | `20` | 并发数 |
| `--depth` | `-d` | `3` | 最大爬取深度 |
| `--output` | `-o` | `./downloads` | 输出目录 |
| `--db` | — | `crawl_queue.db` | SQLite 数据库路径 |
| `--timeout` | `-t` | `30` | 请求超时（秒） |
| `--workers` | `-w` | `5` | 工作协程数 |
| `--user-agent` | `--ua` | 内置 Chrome UA | 自定义 User-Agent |
| `--cookie` | — | 空 | 自定义 Cookie（登录态 / 防盗链） |
| `--header` | `-H` | 无 | 额外请求头 `NAME:VALUE`，可多次使用 |
| `--video-only` | — | 关 | 只下载视频类资源（video / hls / dash / flv / rtmp / rtsp / webrtc） |
| `--link-include` | — | 无 | 只跟进匹配正则的链接，可多次使用 |
| `--link-exclude` | — | 无 | 跳过匹配正则的链接（登录 / 搜索 / 验证码等），可多次使用 |

## 工作流程

```
起始 URL
   │
   ▼
frontier 队列 ──► fetcher 请求页面 ──► 解析器提取链接 / 资源
(memory/sqlite)                        │
                                       ▼
                           ┌────── 是 HTML？──────┐
                           │                      │
                           ▼                      ▼
                  提取新链接(≤深度)          ResourceClassifier 分类
                  链接过滤                    │
                  (include/exclude)          ▼
                           │         --video-only 时
                           │         非视频资源跳过
                           ▼                      │
                           └──────────► 分发下载器
                                        ├─ FileDownloader   直链文件
                                        ├─ HlsDownloader    .m3u8 → TS 分片 → FFmpeg 合并
                                        ├─ DashDownloader   .mpd  → FFmpeg 拉流
                                        └─ StreamDownloader rtmp/rtsp/flv/webrtc 录制
                                        │
                                        ▼
                              downloads/<标题>/<分类>/...
```

核心调度在 `core/orchestrator.py`：`_process_url` 判断页面/资源 → HTML 走 `parse_resources` 提取视频标签 → `_download_resource` 分类（并应用 `--video-only` 过滤）后交给对应下载器；`_handle_html_page` 在入队前对链接应用 `_link_allowed` 过滤。

## 目录结构

```
ymvid_crawler/
├── main.py                    # 入口，命令行参数解析
├── merge_ts.py                # 独立分片合并工具（TS → mp4）
├── requirements.txt
├── core/
│   ├── orchestrator.py        # 爬虫调度器（核心）
│   ├── events.py              # 事件定义
│   ├── event_bus.py           # 事件总线（观察者模式）
│   └── observers.py           # 控制台 / 统计观察者
├── frontier/
│   ├── base.py                # 队列抽象
│   ├── memory_queue.py        # 内存队列
│   └── sqlite_queue.py        # SQLite 队列（断点续爬）
├── fetcher/
│   ├── http_fetcher.py        # aiohttp 异步请求器（支持自定义请求头）
│   └── encoding_detector.py   # 编码探测
├── parsers/
│   ├── base.py                # 解析器抽象
│   ├── bs4_parser.py          # BeautifulSoup 解析器
│   ├── xpath_parser.py        # XPath 解析器
│   ├── regex_parser.py        # 正则解析器（含 og:video / data-video / JS 配置）
│   └── factory.py             # 解析器工厂 + 组合去重
└── downloader/
    ├── resource_classifier.py # 资源类型识别与分类目录规划
    ├── file_downloader.py     # 直链文件下载
    ├── hls_downloader.py      # HLS (m3u8) 下载与合并
    ├── dash_downloader.py     # DASH (mpd) 下载
    └── stream_downloader.py   # 直播流录制
```

## 支持的下载类型

| 类型 | 触发条件 | 下载方式 | 依赖 |
| --- | --- | --- | --- |
| 视频/图片/文档等直链 | `.mp4` `.mkv` `.webm` `.jpg` `.pdf` 等扩展名或 Content-Type | aiohttp 直接拉取 | 无 |
| HLS | `.m3u8`（master 自动选最高码率） | 并发下载 TS 分片 → FFmpeg 合并 | FFmpeg；AES-128 加密另需 pycryptodome |
| DASH | `.mpd` | FFmpeg `-c copy` 拉流合并 | FFmpeg |
| 直播流 | `rtmp://` `rtsp://` `http-flv` `webrtc` | FFmpeg 录制（copy 失败自动转码重试） | FFmpeg |

### HLS 细节

- master playlist：解析 `#EXT-X-STREAM-INF` 并按 `BANDWIDTH` 自动选择最高码率变体
- media playlist：并发下载全部 TS 分片（默认 16 并发）
- 加密：支持 `#EXT-X-KEY:METHOD=AES-128`；显式 `IV=` 时按声明使用，未声明时按 HLS 规范以分片媒体序号作为 IV
- 合并：FFmpeg concat demuxer，缺失分片会告警并跳过

## 输出目录

```
downloads/
└── <页面标题>/                 # 非法字符替换为 _，截断 120 字符
    ├── images/
    ├── videos/
    │   ├── hls/               # m3u8 合并产物 (.mp4)
    │   ├── dash/              # mpd 合并产物 (.mp4)
    │   ├── flv/
    │   └── streams/           # rtmp/rtsp/webrtc 录制
    ├── audio/
    ├── documents/
    ├── archives/
    └── other/
```

## 反爬 / 防盗链

- 所有下载器与页面请求共享同一份请求头：默认 UA + `--ua`/`--cookie`/`-H` 追加项
- HLS / 直链下载会自动带上当前页 URL 作为 `Referer`
- DASH 与 HTTP-FLV 通过 FFmpeg `-headers` 透传自定义请求头
- 若目标站点需要 JS 渲染出视频地址、或校验更严格的签名/时间戳，本框架（纯静态抓取）无法直接获取，需要配合浏览器渲染或提供可用的直链/流地址

## 断点续爬

使用 `-q sqlite` 时，抓取状态（待处理/完成/失败）持久化在 `--db` 指定的数据库中。中断后重跑同一命令会恢复：启动时自动重置上次未完成的任务，已完成的页面不会重复处理。

## 抓取统计

运行结束打印统计：`fetched`（抓取页面数）、`parsed`（解析页面数）、`resources`（发现资源数）、`downloaded`（成功下载数）、`skipped`（被 `--video-only` 过滤跳过的资源数）、`errors`（失败数）。

## 分片合并工具（merge_ts.py）

独立于爬虫的工具：把任意目录下的一批 TS/MPEG-TS 分片按**文件名自然排序**（playlist2.ts < playlist10.ts）合并成单个 mp4，采用 FFmpeg concat 流复制（`-c copy`，不转码、画质无损）。

```bash
# 合并目录内所有 *.ts，输出 merged.mp4
python merge_ts.py downloads/某集/videos

# 自定义文件名匹配与输出
python merge_ts.py <目录> --pattern "playlist*.ts" -o episode.mp4

# 直接指定分片文件
python merge_ts.py a.ts b.ts c.ts -o out.mp4
```

行为说明：
- 空文件自动跳过并告警；缺失序号不影响其他分片合并
- 需要本机 FFmpeg 且在 PATH 中
- concat 列表为临时文件，合并成功后自动清理

## 已知限制

- 只解析静态 HTML 中的 `<video>` / `<source>` / `og:video` / `data-video` 及 JS 配置中的常见字段；SPA 页面或对播放地址做客户端加密的站点（如对 m3u8 地址做 AES 加密后由 JS 解密的播放器）需另行处理
- 无代理 / 无验证码处理；被站点封禁（429/403）会按重试策略失败并计入统计
- `requirements.txt` 中的 `m3u8` 包当前未被代码使用（播放列表为自研解析），可留可删
