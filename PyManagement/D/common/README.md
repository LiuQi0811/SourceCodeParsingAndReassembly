# media_spider.py — 通用媒体采集爬虫框架

异步通用爬虫框架：抓取整站/栏目页面，自动识别并收集**图片 / 视频 / 音频 / 文档**四类媒体资源，支持分页链抓全、懒加载识别、防盗链、代理、域名白名单过滤，并按类别下载到本地。m3u8 流媒体走 ffmpeg 自动合并转封装为 mp4。

单文件实现，无外部配置，构造参数即配置。

---

## 功能特性

| 能力 | 说明 |
|---|---|
| 四类资源收集 | 图片 / 视频 / 音频 / 文档（`<a>` 指向文档后缀也会收集），DOM + 网络抓包双通道 |
| m3u8 支持 | ffmpeg `-c copy` 合并转封装 mp4（不重编码），自动处理 AAC 位流；需系统安装 ffmpeg |
| 分页链抓全 | 识别 `index_2.html` / `page_2` / `xxx_2` / `/page/2/` / `?page=2` 等 7 类分页形态，分页同层入队不消耗深度；支持自定义正则 + `max_pages` 上限 |
| 懒加载识别 | 7 种懒加载属性（`data-echo` / `data-src` / `data-original` / `data-lazy-src` / `data-lazy` / `data-url` / `data-image`），自动过滤 blank/loading/placeholder 占位图 |
| 路径聚焦 | `include_paths` / `exclude_paths` 路径白名单/黑名单，只爬目标栏目、跳过登录页/搜索页等无关区块 |
| 域名白名单 | `whitelist_domains` 只保留指定域名（如图床 `file.ertuba.com`）的媒体，自动剔除站内 logo/图标污染；同时允许跨域白名单链接跟随 |
| 防盗链 | `referer`（默认站点根地址）+ `cookies`（Cookie 字符串注入 headers 与浏览器）+ 抓取/浏览器/下载全链路 `proxy` 代理 |
| 下载模式 | `download_mode="after"` 采集完再下载 / `"live"` 边采集边下载（独立下载队列，可随时切换） |
| 下载治理 | 流式下载 `.part` 临时文件、Content-Length 完整性校验、已存在跳过、并发信号量限流、失败自动重试、`download_rate_limit` 单下载限速、`min_resource_size` 最小文件阈值、超长文件名 hash 降级 |
| 失败管理 | 抓取失败 / 下载失败自动记录 `fail_urls.txt`，支持 `retry_failed()` 补爬 |

---

## 环境要求

- Python 3.9+（开发环境 3.14.7 验证通过）
- 依赖：`aiohttp`、`beautifulsoup4`(lxml)、`playwright`（仅 `use_dynamic_fallback=True` 时需要，且需 `python -m playwright install chromium`）
- m3u8 下载需要系统 PATH 中有 `ffmpeg`（`ffmpeg -version` 可验证）；不需要 m3u8 时可设 `use_ffmpeg=False`

安装：

```powershell
pip install aiohttp beautifulsoup4 lxml playwright
# 若需动态渲染兜底：
python -m playwright install chromium
```

---

## 快速开始

```python
import asyncio
from media_spider import AsyncUniversalSpider

async def main():
    spider = AsyncUniversalSpider(
        start_url="https://www.meitu131.com/shouji/meinv/",
        max_depth=2,
        concurrency=3,
        sleep_sec=1.0,
    )
    await spider.run()

asyncio.run(main())
```

运行后：

- 收集到的媒体清单写入 `assets.txt`（按图片/视频/音频/文档分区）
- 四类资源下载到 `download/` 目录（`download/image/`、`download/video/`、`download/audio/`、`download/document/`）
- 抓取/下载失败的 URL 记录到 `fail_urls.txt`

命令行直接运行（文件末尾自带入口示例）：

```powershell
python media_spider.py
```

---

## 参数说明

`AsyncUniversalSpider(start_url, **kwargs)` 全部参数：

| 参数 | 默认值 | 说明 |
|---|---|---|
| `start_url` | 必填 | 起始页 URL |
| `max_depth` | `3` | 最大抓取深度（分页页不消耗深度） |
| `concurrency` | `3` | 页面抓取并发数 |
| `sleep_sec` | `0.8` | 每页抓取后的休眠秒数（礼貌限速） |
| `timeout` | `15` | 单请求超时（秒）；m3u8 下载超时 600s |
| `use_dynamic_fallback` | `True` | 静态抓取失败时是否用 Playwright 动态渲染兜底（需装浏览器） |
| `output_file` | `"assets.txt"` | 媒体清单输出文件 |
| `fail_file` | `"fail_urls.txt"` | 失败记录文件 |
| `enable_download` | `True` | 是否下载媒体资源 |
| `download_dir` | `"download"` | 下载根目录 |
| `download_concurrency` | `None` | 下载并发数，默认取 `concurrency` |
| `ffmpeg_bin` | `"ffmpeg"` | ffmpeg 可执行文件路径 |
| `use_ffmpeg` | `True` | 是否用 ffmpeg 处理 m3u8（False 时 m3u8 报错跳过） |
| `max_pages` | `None` | 分页页抓取上限，None=不限（如 18 表示最多抓 18 个分页页） |
| `referer` | `None` | 下载防盗链 Referer，默认 `start_url` 站点根地址 + `/` |
| `extra_pagination_patterns` | `None` | 站点特有分页形态自定义正则列表（作用于完整 URL） |
| `include_paths` | `None` | 路径白名单，只爬这些前缀的页面（空=不限） |
| `exclude_paths` | `None` | 路径黑名单，跳过这些前缀的页面 |
| `download_mode` | `"after"` | `"after"` 采集完再下载 / `"live"` 边采集边下载；其他值抛 `ValueError` |
| `proxy` | `None` | 代理，如 `"http://127.0.0.1:7890"`，抓取/浏览器/下载全链路生效 |
| `cookies` | `None` | Cookie 字符串 `"k1=v1; k2=v2"`，注入抓取 headers、浏览器与 ffmpeg 分片请求 |
| `whitelist_domains` | `None` | 域名白名单列表，如 `["file.ertuba.com"]`；媒体过滤 + 跨域链接跟随 |
| `download_rate_limit` | `0` | 单下载限速 bytes/s，0=不限 |
| `min_resource_size` | `0` | 最小资源字节数，Content-Length 已知且低于阈值时跳过，0=不限 |

---

## 使用示例

### 1. 栏目聚焦 + 图床白名单（剔除站内 logo 污染）

meitu131 站内 logo `/statics/images/logo.png` 会被误收集，设置白名单只保留真实图床：

```python
spider = AsyncUniversalSpider(
    start_url="https://www.meitu131.com/",
    max_depth=2,
    include_paths=["/shouji/meinv/"],       # 只爬美女栏目，不爬 login/search/rank 等
    whitelist_domains=["file.ertuba.com"],  # 只保留图床域名媒体 → logo 自动剔除
    use_dynamic_fallback=False,             # 静态站可关闭浏览器节省资源
)
```

### 2. 边采集边下载

```python
spider = AsyncUniversalSpider(
    start_url="https://example.com/gallery/",
    download_mode="live",                   # 边采集边下载
    download_concurrency=4,                 # 下载并发独立控制
    download_rate_limit=512 * 1024,         # 单文件限速 512KB/s
)
```

### 3. m3u8 视频下载（需 ffmpeg）

```python
spider = AsyncUniversalSpider(
    start_url="https://example.com/videos/",
    use_ffmpeg=True,
    ffmpeg_bin="ffmpeg",
    referer="https://example.com/",         # 防盗链 Referer
    cookies="token=abc123; uid=42",         # 登录态/鉴权 Cookie
)
# 收集到的 .m3u8 清单自动经 ffmpeg 合并为 download/video/xxx.mp4
```

### 4. 自定义分页形态（站点特有）

```python
spider = AsyncUniversalSpider(
    start_url="https://example.com/list/",
    extra_pagination_patterns=[r"/list-\d+\.html$"],  # 追加站点特有分页正则
    max_pages=50,                                     # 最多抓 50 个分页页
)
```

### 5. 失败补爬

```python
spider = AsyncUniversalSpider(start_url="https://example.com/")
await spider.run()
await spider.retry_failed()   # 读取 fail_urls.txt 重新入队补爬
```

---

## 输出产物

### `assets.txt` — 媒体清单

按四类分区，DOM 收集 ∪ 网络抓包 去重合并：

```
===== IMAGE LINKS =====
https://file.ertuba.com/xxx/1.jpg
...

===== VIDEO LINKS =====
https://example.com/v/1.mp4
https://example.com/live/index.m3u8
...

===== AUDIO LINKS =====

===== DOCUMENT LINKS =====
https://example.com/doc/手册.pdf
```

### `fail_urls.txt` — 失败记录

每行 `URL | 失败原因`，供 `retry_failed()` 补爬/补下：

```
https://example.com/other/ | static+dynamic all failed
https://example.com/v/2.mp4 | download failed
```

### `download/` — 下载目录

```
download/
├── image/    图片（jpg/png/gif/webp...）
├── video/    视频（mp4/webm/mkv...；m3u8 合并为同名 .mp4）
├── audio/    音频（mp3/wav/flac...）
└── document/ 文档（pdf/doc/zip...）
```

文件名处理：无扩展名 → md5 前 12 位 + 扩展名；含非法字符（`\ / : * ? " < > |` 及空白）自动替换为 `_`；超 180 字符 → hash 降级。

---

## 核心模块

| 模块 | 职责 |
|---|---|
| `async_retry` | 异步重试装饰器，抓取/下载失败自动重试（指数级次数上限） |
| `MEDIA_EXTENSIONS` / `categorize_url` | 四类媒体后缀表 + URL 分类 |
| `is_pagination_url` | 分页 URL 识别（路径 + 查询参数 + 自定义正则；排除 `-0` 结尾标签页、分类 ID） |
| `FailUrlManager` | 失败 URL 记录与加载（补爬） |
| `is_html_valid` | HTML 有效性校验，过滤 JS 骨架空白页（<300 字符或无 `<body>`） |
| `RequestsFetcher` | 静态抓取器（aiohttp），404 直接返回 None、4xx 抛错触发重试 |
| `PlaywrightFetcher` | 动态渲染抓取器：Cookie/Referer 注入、response 监听捕获媒体、`networkidle` 等待 |
| `UrlManager` | URL 规范化、同域判断、访问去重（每个实例独立，不污染多实例） |
| `PageParser` | DOM 提取四类媒体（懒加载属性、`<source>` 按父标签归属、`<a>` 文档链接、iframe 穿透） |
| `MediaDownloader` | 流式下载：`.part` 临时文件、完整性校验、限速、最小阈值、ffmpeg m3u8 合并 |
| `AsyncUniversalSpider` | 主爬虫：队列调度、深度控制、路径/域名过滤、双下载模式、输出与补爬 |

---

## 运行日志说明

- `[worker] depth=N url=...` — 正在抓取的页面（depth 为层数）
- `[OK] url | media:x (image:a/video:b/audio:c/document:d)` — 页面抓取成功及媒体统计
- `[FAIL] url | static+dynamic all failed` — 双通道均失败，已记录
- `[download] 待下载 N 个媒体资源` / `成功:x 跳过(已存在):y 失败:z` — 下载汇总
- `[download OK] cat: url` — 单条下载成功（live 模式）

---

## 已知限制

- 动态渲染兜底依赖 Playwright + Chromium 浏览器二进制，未安装时 `use_dynamic_fallback=True` 会报错；纯静态站建议设为 `False`。
- m3u8 合并是 `-c copy` 转封装（快但不重编码），个别加密/特殊编码的流可能失败，此时会记录到 fail 清单。
- 分页识别基于 URL 形态，极端自定义的分页（纯 JS 翻页、无 URL 变化）需配合 `extra_pagination_patterns` 或动态兜底。
- 请遵守目标网站 robots 协议与当地法律法规，控制并发与请求频率（`sleep_sec` 建议 ≥ 0.5）。
