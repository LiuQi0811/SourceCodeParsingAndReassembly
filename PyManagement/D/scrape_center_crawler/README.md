# scrape.center 通用异步爬虫框架

基于 **Python 3.14 + asyncio + aiohttp** 的通用异步爬虫框架，已在 **scrape.center 全站 54 个子站点**上完成真实抓取验证，99 项自测全部通过。

## 核心特性（对照需求）

| # | 需求 | 实现 |
|---|------|------|
| 1 | 两种可切换队列 | `--queue memory`（一次性加载全量 URL）/ `--queue sqlite`（边发现边入库，`--resume` 断点续爬，崩溃安全：启动时把遗留 `processing` 重置为 `pending`） |
| 2 | 三种解析器 | bs4 / xpath(lxml) / re 正则，`--parser bs4|xpath|regex|bs4,xpath`（逗号组合，全局/单任务可切换） |
| 3 | 字符集自动识别 | BOM → HTTP 头 → HTML meta → 嗅探器（chardet + charset-normalizer 双候选，CJK 族优先防 GBK 误判 cp949），gbk/utf-8/big5 等中文不乱码 |
| 4 | 逆向解密插件 | NaopPlugin / MD5TokenPlugin（时间戳+MD5 签名盐位）/ TimeStampPlugin / Base64Plugin / AESPlugin（pycryptodome ECB/CBC），URL 变换 + 响应解密管线 |
| 5 | 全协议视频下载合并 | m3u8（master 选最高带宽、分片并发、AES-128 解密、ffmpeg 校验转封装）/ mpd（SegmentTemplate/SegmentList、并行下载、ffmpeg 原生 dash demux 合并）/ FLV（静态流下载转封装、直播 ffmpeg 限时拉流）/ RTMP / RTSP（ffmpeg 拉流）；WebRTC 为实时 P2P 无法离线合并（明确报错） |
| 6 | 标题命名 + 分组目录 | 目录以页面 `<title>` 命名（清洗非法字符），目录内按资源类型分子目录（images/videos/audios/documents/archives/...）；保存先写 `.part` 临时文件再原子改名（崩溃不留半成品），文件名含 URL hash、同 URL 幂等复用（重跑不产生重复文件） |
| 7 | 自测保证可运行 | `python main.py --self-test`：99 项（单元 + 本地 aiohttp 集成 + **真实 HLS/DASH/FLV** 媒体合并 ffprobe 校验 + 合并失败重试分片复用 + SQLite 断点续爬双轮 + 确定性失败缓存 + 全局 QPS 限速 + 403 反盗链对抗 + 跨任务 URL 去重 + 失败原因分布 + 产物索引 + 统计报告 + ssr1 联网冒烟）全部通过 |
| 8 | 视频合并失败重试 | HLS/DASH 合并失败时**保留已下载分片**，上层自动复用分片重试一次（只重跑合并，不重新下载全部分片）；重试仍失败才清理分片并标记失败 |
| 9 | 产物索引页 | 抓取结束后在输出目录生成 `index.html`：按任务/标题目录列出全部资源（文件名 + 大小 + 相对链接），浏览器直接浏览 1 万+ 资源 |
| 10 | 跨任务 URL 去重 | 会话级"已下载/下载中"URL 集合（含并发 in-flight 登记）：跨任务/跨页面引用同一资源只物理下载一次。全站实测物理资源请求 **11954 → 4236（省 64.6%）**，磁盘文件不减少（标题目录聚合） |
| 11 | 可观测性 | 报告含**失败原因分布**（HTTP 4xx/5xx、超时、连接错误、连接重置等分类）与**分任务明细**（每站页面/资源成功失败、字节）；`--progress` 每 10s 打印实时进度；`--log-file` 详细日志落盘；收尾自动生成结构化 `report.json` |
| 8 | 自定义资源类型 | `--config` 配置文件 + `ResourceClassifier` 自定义扩展名/Content-Type/魔法字节三通道 |
| 9 | 资源自动识别分类 | 魔法字节嗅探 → Content-Type → 扩展名三级识别，自动建分类目录保存图片/视频/文档等 |
| 10 | 视频分片合并 | HLS `.ts` 二进制拼接 + ffmpeg 转封装；DASH fMP4 init+分片并行下载 + ffmpeg 合并；分片失败自动重试 |

## 架构（设计模式落点）

```
crawler/
├── constants.py        # ResourceType / VideoProtocol / EventType
├── events.py           # 观察者模式：事件总线 + LoggingObserver / StatsObserver
├── engine.py           # CrawlEngine 异步引擎：并发 worker、max_pages 原子配额、限速、JSON/HTML/二进制分流
├── utils.py            # sanitize_filename / normalize_url / domain_of 等
├── tasks.py            # TaskSpec / Settings 数据模型
├── factory/            # 工厂模式：Registry 注册表（queue_factory / parser_factory / crypto_factory）
├── queue/              # 策略模式：QueueStrategy 抽象 + MemoryQueue + SQLiteQueue（持久化、崩溃恢复）
├── parser/             # 策略模式：ParserStrategy + Bs4Parser / XPathParser / RegexParser + CompositeParser（组合去重）
├── net/                # AsyncFetcher（aiohttp 封装：重试/认证/SSL/流式下载）+ encoding.py 字符集识别
├── resource/           # classifier.py（魔法字节/Content-Type/扩展名三级）+ storage.py（标题目录 + 分类子目录）
├── crypto/             # 逆向解密插件族（URL 签名 + 响应解密）
├── video/              # 视频合并器：hls_merger / dash_merger / flv_merger / rtmp_rtsp / ffmpeg_utils
└── download/           # http_downloader.py + video_downloader.py（协议识别 → 合并器工厂）
```

## 安装与运行

```bash
pip install -r requirements.txt          # aiohttp beautifulsoup4 lxml chardet charset-normalizer pycryptodome
# ffmpeg 需在 PATH（视频合并用），Windows 下需含 libx264 与 dash/hls muxer

# 自测（99 项，含真实媒体合并与联网冒烟，约 2-4 分钟）
python main.py --self-test

# 抓取单个站点（内存队列）
python main.py --site ssr1 --queue memory --concurrency 8 --output output/ssr1

# 抓取单个站点（SQLite 持久化队列，支持断点续爬）
python main.py --site ssr1 --queue sqlite --db output/q.db --concurrency 8 --output output/ssr1
python main.py --site ssr1 --queue sqlite --db output/q.db --resume          # 中断后续爬

# 全站抓取（scrape.center 54 个子站）
python main.py --site ssr1,ssr2,...,app9 --queue sqlite --db output/all.db --concurrency 8 --output output/all
python main.py --site ssr1,ssr2,...,app9 --queue sqlite --db output/all.db --concurrency 8 --output output/all --qps 20   # 全局限速 20 req/s
python main.py --site ssr1 --output output/ssr1 --max-pages 3 --progress --log-file output/ssr1/crawler.log   # 实时进度 + 日志落盘

# 自定义 URL / 解析器 / 配置
python main.py --url https://example.com --parser bs4,xpath --depth 2 --max-pages 100
python main.py --config config.json
```

站点预设（main.py `_site_task`）已按站点特性配置：ssr2 关闭 SSL 校验、ssr3 加 Basic Auth(admin/admin)、ssr4 加长超时、spa1 走 JSON API + 正则提取、tool1 走代理池接口。

**CLI 参数覆盖站点预设**：`--max-pages` / `--depth` 显式传入时覆盖 `--site` 预设值（预设内部按站点写死 40/5 等），未传入则保持预设。`--max-pages 0` 表示不设限，可全量抓取大站（如 ssr1 全量 111 个页面）。

**确定性失败缓存**：HTTP 4xx（403 反盗链等）为确定性失败，落库时标记 `final_retriable=0`。之后无论 `--resume` 还是全新重跑，同一 URL 再次入队会被直接跳过、不再发请求（旧库自动迁移回填）。重试耗尽（5xx/网络抖动）的失败不缓存，重跑会重新尝试。

**403 反盗链对抗**：下载器遇 403 时自动用资源源站域名作 Referer 重试一次（美团 CDN 等反盗链校验 Referer 域名的场景可完整救回，全站实测 1203 个 403 → 0 失败）；仍失败才进入确定性失败缓存。

**全局 QPS 限速**：`--qps N` 设置全局限速（页面/资源/视频分片统一走令牌桶），0=不限速（默认）。对目标站更友好，大站全量时可显著降低被封风险。

**视频合并失败重试（分片复用）**：HLS/DASH 分片合并（拼接/ffprobe 校验/ffmpeg 转封装）任一步失败时，`.parts` 分片目录**不再被清理**，上层自动复用已下载分片重试一次——只重跑合并步骤，不重新下载全部分片（几十上百分片的大视频省时数量级）；重试仍失败才清理分片、标记视频失败（下一次运行全新下载）。AES-128 加密分片改为合并时边读边解密，源分片始终保持原样，重试复用安全。

**产物索引页**：抓取结束自动在输出目录生成 `index.html`——按任务/标题目录分组，列出每个文件的文件名、大小与相对链接（可点击浏览），顶部汇总任务数/文件数/总大小。全站 1.2 万+ 文件的索引 0.14s 生成，浏览器直接打开即用。

**跨任务 URL 去重**：队列去重按 `(url, task_id)`，同一 URL 被多个任务/页面引用时会重复入队、重复请求（全站实测每 URL 平均下载 2.8 次）。引擎层新增会话级 `done/in-flight` URL 集合（并发下原子登记，失败自动移出可重试）——同一 URL 整个会话只物理下载一次。全站 v6 实测：物理资源请求 **11954 → 4236（-64.6%）**，磁盘唯一文件不变（同标题聚合目录），耗时 197.8s（较 v5 的 209.6s 更快，且本轮页面多抓 9 个）。`resources_downloaded` 统计口径：含"已下载/下载中跳过"项（成功处理数），物理请求数显著更少。

**可观测性**：最终报告除汇总外新增两块——**失败原因分布**（按错误文本分类：HTTP 4xx/5xx、超时、连接错误、连接重置、SSL/TLS、DNS 等，一眼看出站点健康问题）与**分任务明细**（每站独立列出页面成功/失败、资源成功/失败、下载字节，便于定位问题站点）。长任务可加 `--progress`：每 10s 打印一行实时进度（页面/资源成功失败、下载字节、当前失败原因分布）。`--log-file crawler.log` 把详细日志（事件级：抓取/解析/下载/合并/失败，带时间戳与模块）同时写盘，终端关闭后仍可追溯完整请求链；抓取结束自动在输出目录生成结构化 **`report.json`**（完整 summary + 站点列表 + 生成时间），供程序化消费与多轮版本对比（如 v5/v6/v7 的请求数/失败数趋势）。

**视频协议转封装**：HLS/DASH/HTTP-FLV 下载合并后统一经 ffmpeg 转封装 **mp4**（FLV 转后同样 ffprobe 校验可播放，校验失败回退保留 `.flv`）；RTMP/RTSP 经 ffmpeg 拉流转 mp4。**真实媒体验证覆盖 HLS / DASH / FLV 三种协议**（本地 ffmpeg 生成真实分片/文件，自测中完整走完下载→合并→转封装→ffprobe 校验链路）；RTMP/RTSP 因无本地流媒体服务器未纳入自测，WebRTC 为实时 P2P 流明确报错。

**多轮报告对比**：`python compare_reports.py output/…/report.json …` 输出多轮抓取关键指标演进表（耗时/页面/资源成功失败/下载字节/失败原因分布），配合 `report.json` 做版本复盘与回归确认。

## 自测结果

```
结果: 99 通过 / 0 失败 / 共 99 项   （退出码 0）
```

覆盖：工具函数、编码识别（GBK/UTF-8/Big5）、资源分类器、三种解析器 + 组合去重、5 个解密插件、内存/SQLite 队列（含确定性失败缓存）、存储目录结构（幂等保存 + .part 原子写入）、事件总线（含失败原因分类）、全局 QPS 令牌桶、连接类长退避、视频分片复用、跨任务 URL 去重、产物索引与统计报告；本地 aiohttp 服务器集成（GBK 中文页、链式页面、PNG 资源、403 反盗链对抗、HLS/DASH/FLV 真实媒体、合并失败重试、跨任务去重）；HLS 与 DASH 分片合并、FLV 转封装后均用 ffprobe 验证可播放（时长 2.0s）；SQLite 断点续爬两轮（第一轮 2 页 → 第二轮补齐 3 页）；ssr1 联网冒烟（max_pages 原子配额下恰好 2 页）。

## 真实抓取验证（scrape.center 全站）

`python main.py --site <54站> --queue sqlite --concurrency 8 --output output/allsites_v6`

- **最新全站（跨任务 URL 去重版）：耗时 198s；页面成功 169，页面最终失败 6；资源成功处理 13771（物理请求仅 4236 个唯一 URL，其余零请求跳过），资源最终失败 0；总下载约 122MB**
- 物理资源请求较 v5 减少 64.6%（11954 → 4236），磁盘唯一文件 4247 个不变（跨任务同标题聚合），`.part` 残留 0
- 会话统计与 SQLite 队列终态一致：`crawl_queue` 中 `failed` 行 = 6 页面（站点侧问题）+ 0 资源
- 失败页面明细（均为站点侧问题，非框架缺陷）：`ssr1/ssr2/ssr3/antispider2/antispider5` 的 `/page/11`（站点本身只有 10 页，返回 500，重试 3 次耗尽后正确标记失败）；`spa16`（站点侧连接重置）、`captcha6`（站点拒绝连接）
- 历史对比：v2 首版 1203 资源失败 → v4 确定性失败缓存（重跑跳过 945 请求）→ v5 403 换 Referer 重试（失败归零）→ v6 跨任务 URL 去重（物理请求 -64.6%）
- 断点续爬实测：ssr1 抓取进行中强杀进程（DB 留有 2559 条 pending），`--resume` 重启后 32s 补齐剩余 2081 个资源
- `--max-pages 0` 全量实测：ssr1 全站 111 页 / 20782 资源（预设 40 页只能抓 1/3）
- 全局 QPS 实测：`--qps 20` 下 ssr1 3 页 940 资源请求耗时 45s（无限制同规模约 8s），令牌桶精确限速

## 统计口径说明

会话统计与 SQLite 队列终态严格一致，两个维度分开计数：

| 指标 | 含义 |
|---|---|
| `pages_failed` / `resources_failed` | **最终失败**：重试耗尽（5xx/网络错误重试 3 次后仍失败）或不可重试（HTTP 4xx 确定性失败直接终态）。与会话 `crawl_queue` 表中 `state='failed'` 的行数一致 |
| `pages_attempts_failed` / `resource_attempts_failed` | **尝试失败**：单次抓取/下载失败事件数（含重试过程），反映重试强度 |

资源下载失败会进入重试队列（可重试时），重试耗尽才落 `failed` 终态；HTTP 4xx（403 反盗链等）直接终态不浪费重试，并写入确定性失败缓存（重跑跳过，见上文）。不再出现"会话统计 1200 次失败 vs DB 0 失败行"的口径矛盾。

**连接类错误长退避**：连接重置/拒绝连接等连接级错误（非 HTTP 状态码）使用 10s/20s 长退避重试（最多 2 次额外重试），给站点瞬断留恢复时间；HTTP 5xx/429 仍用 1s/2s/4s 快速退避。

## 已知边界

- WebRTC 为实时 P2P 流，无法离线下载合并，框架明确报错
- 资源保存为确定性文件名（`<url名>_<url-hash8>.<ext>`）：同 URL 恒同路径、幂等复用；如需保留原始 URL 文件名，可显式传 `filename`
