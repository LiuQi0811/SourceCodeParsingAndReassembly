# spiderbuf_async_crawler — asyncio + aiohttp 异步全站资源抓取框架

基于 **Python 3.14.7 + asyncio + aiohttp** 的异步抓取框架，内置 **策略模式 / 工厂模式 / 观察者模式**，
并完整接入 **SpiderBuf 靶场 39 关解题**（与本项目同级的 `spiderbuf_crawler/spiders/` 同步式脚本零冲突，
本框架只引用不改动）。

## 功能总览

| # | 需求 | 实现位置 | 验证 |
|---|------|----------|------|
| 1 | 双队列可切换：内存一次性加载 / SQLite 持久化断点续爬 | `core/queue/memory.py`、`core/queue/sqlite.py` | ✅ 自测含断点恢复 |
| 2 | bs4 / xpath(lxml) / re 三解析器，全局/单任务切换 + 组合 | `core/parsers/`（含 `composite.py`） | ✅ 自测 |
| 3 | 自动识别字符集（HTTP 头→BOM→meta→智能检测），gbk/utf8 兼容不乱码；自动识别资源类型并分类目录保存（图片/视频/文档/压缩包等） | `core/encoding.py`、`core/resources.py` | ✅ 自测（gbk/big5/utf-16） |
| 4 | 逆向解密工具集：MD5/SHA/HMAC/Base64/XOR/RC4/AES-CBC(含 CryptoJS iv_prefix)/AES-ECB | `core/crypto.py` | ✅ 自测 + c03/c06/c07/c10/c11 真实签名 |
| 5 | 视频下载合并：HLS(m3u8，含 AES-128 分片解密)、DASH(.mpd)、HTTP-FLV、RTMP、RTSP；WebRTC 明确不可直接抓取并给替代方案 | `core/video.py`（ffmpeg concat/mux 无损合并） | ✅ HLS 本地端到端：2s mp4 可播放 |
| 6 | 目录以任务标题命名，内部按资源类型分子目录，一个任务可有多个资源分组 | `core/engine.py` `_save_resources` | ✅ 全量运行产出 |
| 7 | 自测：编码/解密/解析器/队列/视频 全链路 | `tests/`（`python -m tests.run_all`） | ✅ 全部通过 |
| 8 | 自定义资源类型：`custom_resource_types` 扩展名映射 | `core/resources.py classify_resource(custom_map=...)` | ✅ 自测 |
| 9 | 视频分片合并：ffmpeg `concat demuxer -c copy` + 音视频 mux + DASH 字节级拼接 | `core/video.py VideoMerger` | ✅ 自测 |
| 10 | 资源治理：URL 去重 + 域名过滤（广告/统计域名黑名单，任务级白名单覆盖） | `core/engine.py` | ✅ 全量运行验证 |
| 11 | 状态码级重试统一：限流/5xx 由 fetcher 抛 `RetryableError`，solver 不再各自判断 | `core/fetcher.py` | ✅ 全量运行验证 |
| 12 | 分片并发下载：HLS/DASH 分片 `asyncio.gather` 并发（信号量限流、结果保序），AES key 预取 | `core/video.py` | ✅ 自测 |
| 13 | 限流关错峰：任务级 `extra["pre_delay"]` 前置延迟（c07/c10 已配 1.5s） | `core/engine.py` | ✅ 运行验证 |
| 14 | 进度事件去刷屏：状态无变化不发布 PROGRESS | `core/engine.py` | ✅ 运行验证 |
| 15 | 数据非空校验（防假成功）：任务级 `extra["expect"]`，失败立即判失败不重试 | `core/engine.py` | ✅ 全量验证 |
| 16 | 日志文件系统：DEBUG 全链路落盘 `output/logs/run_*.log`，控制台只显 WARNING | `core/logging_util.py` | ✅ 运行验证 |
| 17 | 并发压力自测：本地慢服务 + workers=16，100 任务全成功（0.8s，串行需 10s+） | `tests/test_stress.py` | ✅ 自测 |
| 18 | 运行成绩单：每关状态/耗时/失败原因汇总，落盘 `output/report.json` | `core/engine.py`、`examples/demo_spiderbuf.py` | ✅ 全量验证 |
| 19 | 优雅退出：Ctrl+C 完成当前任务后停止，未完成任务保留（SQLite 断点续爬） | `core/engine.py` | ✅ 自测 |
| 20 | 优先级调度：`priority` 字段（内存堆/SQLite ORDER BY），c07/c10 限流关全量最后跑 | `core/queue/` | ✅ 全量验证 |

## 设计模式落点

- **策略模式**：`QueueStrategy`（memory/sqlite）、`ParserStrategy`（bs4/xpath/re/composite）、
  `ExternalRunner`（外部脚本执行器）、`VideoDownloader`（hls/dash/flv/rtmp/rtsp/webrtc）
- **工厂模式**：`QueueFactory` / `ParserFactory` / `TaskFactory` / `VideoDownloaderFactory`
- **观察者模式**：`EventBus` 事件总线——`URL_DISCOVERED`（解析发现新链接自动入队）、
  `TASK_STARTED/COMPLETED/FAILED`、`RESOURCE_SAVED`、`VIDEO_MERGED`、`PROGRESS`

## 目录结构

```
spiderbuf_async_crawler/
├── core/                    # 框架核心
│   ├── queue/               # 双队列（memory / sqlite）
│   ├── parsers/             # 三解析器 + 组合
│   ├── engine.py            # 异步引擎（并发 worker + 事件流 + 资源管线）
│   ├── fetcher.py           # aiohttp 抓取器（重试/并发/代理/编码）
│   ├── encoding.py          # 字符集识别与编解码
│   ├── resources.py         # 资源类型识别 + 分类目录
│   ├── crypto.py            # 逆向解密工具
│   ├── video.py             # 视频下载合并
│   ├── factories.py         # 工厂门面
│   ├── events.py            # 观察者事件总线
│   └── models.py            # 数据模型
├── sites/spiderbuf/         # 靶场适配
│   ├── challenges.py        # 39 关任务定义（直抓/solver/外部三路径）
│   └── solvers.py           # 签名器（c01/c03/c06/c07/c10/c11/e01/s06...）
├── examples/                # 三个可直接运行示例
├── tests/                   # 自测套件
├── requirements.txt
└── README.md
```

## 快速开始

```powershell
# 安装依赖
pip install -r requirements.txt

# 1) 内存队列示例（3 个关卡）
python -m examples.demo_memory_queue

# 2) SQLite 断点续爬示例
python -m examples.demo_sqlite_queue

# 3) SpiderBuf 39 关全量解题
python -m examples.demo_spiderbuf
#    指定关卡 / 系列 / SQLite 队列
python -m examples.demo_spiderbuf --codes s01 c07
python -m examples.demo_spiderbuf --groups s,e
python -m examples.demo_spiderbuf --sqlite --db my_queue.sqlite

# 4) 自测
python -m tests.run_all
```

## SpiderBuf 39 关解题：三条路径

| 路径 | 说明 | 关卡 |
|------|------|------|
| **框架直抓** | 纯 GET/POST + 解析器，异步原生解题 | s01 s02 s03 s05 s07 s08 e04 n01 |
| **框架 solver** | 两步请求/签名（多步抓取 + 加密算法），异步原生解题 | s04 s06 e01 n03 c01 c03 c06 c07 c10 c11 h05 h06 |
| **外部执行器** | 复用 `spiderbuf_crawler/spiders/` 实测脚本（浏览器指纹/OCR/JS 求值/复杂解析） | e02 e03 n02 n04 n05 n06 n07 h01 h02 h03 h04 c02 c04 c05 c08 c09 c12 c13 c14 |

### 框架原生解法要点（solver 注册表见 `sites/spiderbuf/solvers.py`）

- **c01**：GET 关卡页触发 `__cgf3t` Cookie 下发 → 带 Cookie+Referer GET `/mnist`
- **c03**：每页 `xorResult=i^ts`、`hash=md5(f"{xor}{ts}")` → POST JSON（防重放）
- **c06**：GET 拿 `_asd2sdf99` → `md5(f"3006spiderbuf{ts}")` 签名 POST
- **c07**：GET 拿 `<input id="token">` → 随机 32 位 key → `md5(f"{ts}{token}{key}")` 写入 cookie_jar（aiohttp 不支持 headers 里写 Cookie）
- **c10**：403 下发 `__jsluid_h=<a>-<b>` → 构造 `__jsl_clearance=ts-md5(ts+b)` 双 Cookie 重放
- **c11**：双重 HMAC-SHA256（cookie 名即 t、s 参数 key=tt、msg=`currency+chip+memory+t`），GET `/api` 遍历 M4×USD/EUR×16GB/24GB
- **h05/h06**：`md5(秒级时间戳)` → `b64(ts,md5)` → GET `/api/<payload>`（路径拼接）

## 注意事项

1. **e02** 需要 ddddocr（验证码 OCR，Python 3.12）——原 `pylibs312` 目录已随整理删除，
   运行前请自行 `pip install ddddocr`（3.12 环境）；框架已支持 `extra.python` 指定解释器。
2. **WebRTC** 无法直接下载（DTLS-SRTP 加密 + 信令协商），框架明确报错并给替代方案。
3. **c04/c05/c12/c13/c14** 需本机 Edge 浏览器（playwright `channel="msedge"`）。
4. **h04** 需 Node.js（混淆 JS `var data=[...]` 求值）。
5. **限流与重试**：引擎内置任务级重试（HTTP 403/408/429/5xx → 指数退避 `2^n`s，默认 3 次，可用 `extra["max_retries"]/["retry_backoff"]/["pre_delay"]` 按任务覆盖——c07 已配置 4 次/2s 起步 + 1.5s 错峰，c10/e01 同样配置错峰）。全量并发时 **c07/c10** 可能 403：服务端对 JS 反爬路径有限流窗口（单跑稳定，连续多次全量运行后窗口变长），请间隔 1-2 分钟或调低 `--workers`。
6. 礼貌抓取：所有请求间隔 ≥1s（n03 严格 1.2s）。
7. **资源域名过滤**：默认跳过广告/统计域名（pagead2.googlesyndication.com 等）；任务可配 `extra["resource_domains"]` 白名单精确限定。输出不再有 adsbygoogle.js 噪音。
8. **外部执行器**：超时可配置（默认 180s），stdout/stderr 完整落盘 `output/external_logs/<标题>.log`；旧项目 `spiderbuf_crawler` 目录自动定位（或设 `SPIDERBUF_SPIDERS_DIR`）。
9. **数据校验（防假成功）**：引擎默认校验解析结果 `data` 非空才算成功（`extra["expect"]` 可配字段列表或 `False` 跳过）——页面改版/反爬页返回空数据会立即判失败而非假装成功。**n01**（公司列表，非表格）通过 bs4 `list_selectors` 提取 50 项；**e01** 登录依赖重定向跟随（aiohttp 默认不跟随，框架已改为默认跟随）。
10. **日志文件**：每次运行完整 DEBUG 链路落盘 `output/logs/run_<时间戳>.log`（重试/资源过滤明细），控制台只显 WARNING；失败任务同样记录（`logging.error`）。

## 自测结果（实测）

```
tests.test_encoding  ✔ gbk/big5/utf-8/utf-16 全兼容
tests.test_crypto    ✔ md5/hmac/b64/xor/rc4/AES 往返 + 关卡签名样式
tests.test_parsers   ✔ bs4/xpath/re/composite（含 list_selectors 列表提取）
tests.test_queues    ✔ 内存队列 + SQLite 断点续爬
tests.test_video     ✔ HLS 基础 / AES-128 加密分片解密 / media_sequence+KEY 切换 /
                     ✔ EXT-X-BYTERANGE 字节范围分片 / DASH 合并+mux / $Time$ timeline /
                     ✔ 多 Period / 无 timeline 探测 / $Time$ 无 timeline 明确报错
tests.test_stress    ✔ 并发压力：100 任务×100ms 延迟 / workers=16 → 0.8s 全成功
tests.test_graceful_stop ✔ 温和停止：处理 6/20 后退出，剩余任务保留无异常
SpiderBuf 39 关全量   ✔ 36/39（e02 缺 ddddocr 依赖；c07/c10 见注意事项 5 限流窗口）
```
