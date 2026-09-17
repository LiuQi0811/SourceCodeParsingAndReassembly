# 通用媒体采集爬虫框架（general_framework.py）

以 v1~v7 七个版本能力整合而成的**单文件企业级通用媒体采集框架**，支持图片 / 视频 / 音频 / 文档 / 静态资源五类资源收集与下载，内置 m3u8、DASH-MPD、TS 分片三种流媒体下载能力，以及按页面标题组织目录、双下载模式、断点续爬、持久化去重等生产级特性。

---

## 目录文件

| 文件 | 说明 |
|---|---|
| `general_framework.py` | **最终整合版**（约 90 KB，单文件，入口即配置） |
| `general_framework_v1.py` | v1 基座：五类资源收集下载 + m3u8 ffmpeg 合并 |
| `general_framework_v2.py` | v2：PagePool、Content-Type 识别、原子写入、防覆盖、磁盘检查 |
| `general_framework_v3.py` | v3：代理池、缩略图过滤、URL 去重、JS/CSS 提取、快照续爬 |
| `general_framework_v4.py` | v4：自动滚动懒加载、TS 分片捕获组装 |
| `general_framework_v5.py` | v5：单页媒体嗅探（HLS/DASH 嗅探、MPD 解析、分片合并） |
| `general_framework_v6.py` | v6：DASH-MPD 深度解析（SegmentList / SegmentTemplate+Timeline） |
| `general_framework_v7.py` | v7：SQLite 指纹去重、令牌桶 RPS、Prometheus 指标 |

---

## 核心能力

### 资源采集
- **五类资源**：图片（jpg/png/gif/webp…）、视频（mp4/m3u8/mpd/ts…）、音频（mp3/m4a/flac…）、文档（pdf/docx/xlsx/zip…）、静态（js/css/字体）
- **懒加载识别**：`data-src` / `data-original` / `data-echo` 等 7 种懒加载属性 + 自动滚动触发加载
- **JS/CSS 文本链接提取**、iframe 递归、`<base href>` 解析、Content-Type 无后缀识别
- **链接去重**：URL 动态参数剥离（`?t=_t&v=...`）、SQLite URL 指纹跨运行持久化去重

### 流媒体下载
| 类型 | 说明 |
|---|---|
| **m3u8** | ffmpeg 合并下载；嵌套变体自动跳转子流（可选 m3u8 库） |
| **DASH-MPD** | SegmentList / SegmentTemplate+Timeline 解析，分片下载 + ffmpeg 合并（纯 lxml 实现） |
| **TS 分片** | 页面 blob/分片视频捕获，组装虚拟 m3u8 后 ffmpeg 合并 |

### 反爬与工程能力
- 代理池（健康检测 + 故障剔除）、自定义 Referer/Cookie、域名白名单/黑名单
- 缩略图关键词过滤、最小文件大小、磁盘空间保护、单文件限速
- 令牌桶全局 RPS 限速、Prometheus metrics 导出（可选）
- 断点快照续爬（SIGINT 优雅关闭）、页面/资源失败分离记录、原子写入、文件名防覆盖

---

## 目录组织结构

### 按页面标题组织（默认，推荐）

`organize_by_title: True` —— 每个页面的**整组资源**（图片/视频/音频/文档混合）下载到以该页 `<title>` 命名的目录：

```
download/
├── 美女手机壁纸_高清美女手机壁纸大全/     ← 组内多资源混合
│   ├── c225a260....jpg
│   ├── photo2.jpg
│   ├── demo.mp4
│   └── manual.pdf
├── 高圆圆身穿红色连衣裙 温婉优雅妩媚/      ← 单数据也建目录
│   └── xxx.jpg
└── page_44747/                        ← 无标题页面回退 page_<hash>
```

- 中文标题完整保留，`\/:*?"<>|` 等非法字符自动替换为 `_`
- 同名标题自动递增：`标题`、`标题_1`、`标题_2`…
- m3u8 / MPD 合并产物、TS 组装视频同样落入本页标题目录

### 按类型分类

`organize_by_title: False` —— 回退到 `images/ videos/ audios/ docs/ static/` 分类目录。

---

## 双下载模式

`download_mode` 配置切换：

| 模式 | 行为 | 适用场景 |
|---|---|---|
| `"stream"`（默认） | **边采集边下载**：每页解析完立即落盘 | 小规模、需要实时看进度 |
| `"batch"` | **全部采集完成后统一下载**：先扫完站点收集资源清单，结束再落盘 | 大规模、先勘察全站再决定下载 |

两种模式均兼容按标题/按类型目录结构。

---

## 快速开始

### 1. 安装依赖

```bash
pip install aiohttp beautifulsoup4 lxml playwright
playwright install chromium          # 仅使用动态兜底时需要
```

可选依赖（缺失自动降级）：`m3u8`（嵌套变体识别）、`prometheus_client`（指标导出）。
流媒体合并需要 [ffmpeg](https://www.gyan.dev/ffmpeg/builds/)（`ffmpeg` 已加入 PATH 或修改 `ffmpeg_path`）。

### 2. 修改配置

直接编辑 `general_framework.py` 顶部 `CONFIG` 字典，无需命令行参数：

```python
CONFIG = {
    "start_url": "https://example.com/",        # 入口地址
    "max_depth": 3,                             # 抓取深度
    "concurrency": 5,                           # 并发 worker 数
    "organize_by_title": True,                  # 按标题建目录
    "download_mode": "stream",                  # stream / batch
    "whitelist_domains": ["file.ertuba.com"],   # 只下载图床资源
    # ... 其余按需调整
}
```

### 3. 运行

```bash
python general_framework.py
```

或作为模块使用：

```python
import general_framework as gf
cfg = dict(gf.CONFIG)
cfg["start_url"] = "https://example.com/"
spider = gf.AsyncUniversalSpider(start_url=cfg["start_url"], cfg=cfg)
import asyncio; asyncio.run(spider.run())
```

### 4. 输出

| 产物 | 说明 |
|---|---|
| `download/` | 下载资源（按标题目录或类型分类） |
| `crawl_result.json` | 采集结果：页面记录（含标题/目录/资源清单）、下载元信息 |
| `assets.txt` | 全部资源链接清单（按类型分组） |
| `spider.log` | 运行日志 |
| `fail_urls.txt` / `fail_resources.txt` | 失败页面 / 失败资源 |
| `spider_snapshot.json` | 断点快照（中断后续爬） |
| `crawl_dedup.db` | SQLite URL 指纹去重库（启用时） |

---

## 关键配置速查

| 配置项 | 默认 | 说明 |
|---|---|---|
| `start_url` | 示例站 | 抓取入口 |
| `max_depth` / `concurrency` | 2 / 3 | 深度 / 并发 |
| `use_dynamic_fallback` | False | 静态抓取失败时启用浏览器兜底 |
| `scan_only_mode` | False | True=仅扫描收集不下载 |
| `organize_by_title` | True | 按标题建目录 / 按类型分类 |
| `download_mode` | "stream" | 边采边下 / 采完再下 |
| `download_enable` | True | 总下载开关 |
| `min_size` | 各类型阈值 | 小于该大小的文件跳过 |
| `min_disk_free_mb` | 50 | 磁盘剩余低于此值停止下载 |
| `block_domains` | 广告域名集 | 黑名单域名 |
| `whitelist_domains` | 空 | 白名单（空=不限制） |
| `thumbnail_keywords` | 缩略图词集 | 缩略图/小图过滤 |
| `custom_referer` / `custom_cookie` | 空 | 防盗链绕过 |
| `proxy_pool` | 空 | 代理池（空=不使用） |
| `download_rate_limit` | 0 | 单下载限速 bytes/s |
| `token_bucket_rps` | 0 | 全局 RPS 限速（0=关闭） |
| `enable_sqlite_dedup` | False | 跨运行 URL 指纹去重 |
| `enable_dash_download` / `enable_ts_assemble` | True / True | DASH / TS 组装 |
| `prometheus_enable` | False | Prometheus 指标导出 |

---

## 版本演进（v1 → v7 → 最终版）

```
v1 基座 ──→ v2 ──→ v3 ──→ v4 ──→ 最终版 general_framework.py
                                   │
v5 ──→ v6（单页媒体嗅探分支）──────┘
v7（通用文本爬虫分支）─────────────┘
```

| 版本 | 核心增量 |
|---|---|
| v1 | 五类资源收集下载、m3u8 ffmpeg 合并、防盗链、代理、限速 |
| v2 | PagePool 页面池、Content-Type 识别、原子写入、防覆盖、磁盘检查 |
| v3 | 代理池健康检测、缩略图过滤、URL 去重、JS/CSS 提取、快照续爬 |
| v4 | 自动滚动懒加载、TS 分片捕获 + 虚拟 m3u8 组装 |
| v5/v6 | HLS/DASH 嗅探、MPD 解析（SegmentList / SegmentTemplate+Timeline）、分片合并 |
| v7 | SQLite 指纹去重、令牌桶 RPS、Prometheus、任务超时隔离 |
| **最终版** | 以 v4 为基座整合 v5/v6 DASH 分片合并 + v7 去重/RPS/指标；修复 5 处历史缺陷 |

**历史缺陷修复**（相对 v1~v4）：
1. `UrlManager` 去除单例（多实例互不污染）
2. `PlaywrightFetcher` 异常改为 re-raise（让 `async_retry` 生效）
3. 浏览器仅在 `use_dynamic_fallback=True` 时启动（省资源）
4. `PagePool` Cookie 注入使用站点实际域名（原占位域名不生效）
5. 全文件统一 ASCII 连字符（原 v1/v7 存在 U+2011 导致 UA/编码失效）

**最终版新增**：
- 按页面标题建目录组织整组资源（含中文标题、同名递增、无标题回退）
- 双下载模式切换（stream 边采边下 / batch 采完再下）
- 短页面（单图/单视频）不再被 `is_html_valid` 误判为骨架页丢弃

---

## 验证

- 本地端到端测试：双站点（页面站 + 资源站）真实 HTTP 下载，覆盖图片/视频/音频/文档混合组、m3u8/DASH 真实 ffmpeg 合并、标题目录组织（含重复标题递增、单数据页、无标题回退）、双下载模式（batch 采集阶段 0 落盘）
- 真实站回归（meitu131.com）：`scan_only` 模式 695 张图全部来自图床 `file.ertuba.com`；按标题组织模式 73 页全部正确建目录

> 免责声明：本框架仅用于合法授权的数据采集，请遵守目标网站的 robots 协议与服务条款，控制抓取频率，勿用于侵犯版权的用途。
