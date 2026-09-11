# free-stock.video 全站爬虫 & 下载器

## 逆向分析结论

| 项目 | 结论 |
|------|------|
| 网站架构 | **服务端渲染 (SSR)**，HTML 直接包含所有资源地址 |
| 视频加密 | **无加密、无 m3u8/HLS/DASH 分片、无 JS 解密** |
| 视频地址 | 直接写在 `<video src="https://cdn.free-stock.video/...-small.mp4">` 和下载按钮 `<a href="...">` 中 |
| CDN | `cdn.free-stock.video`，文件格式 `{slug}-{id}-small.mp4`（视频）、`{slug}-{id}-cover.jpg`（封面） |
| 防盗链 | 无签名 Token，仅需正常 Referer/User-Agent，支持 HTTP Range 断点续传 |
| 全站页面 | 共 **3698 个视频** + **53 个 Packs**，sitemap.xml 已全部列出 |
| 分页 | `/videos?page=N`，简单 GET 参数分页 |

## 安装依赖

```bash
pip install -r requirements.txt
```

## 使用方法

### 1. 一键全站抓取+下载（默认推荐）
```bash
python crawler.py
```
默认下载到 `./downloads/videos/`（视频）和 `./downloads/covers/`（封面），同时输出 `metadata.json` / `metadata.csv` 索引。

### 2. 仅抓取元数据（不下载文件，快速生成索引）
```bash
python crawler.py --metadata-only
```

### 3. 指定并发数与输出目录
```bash
python crawler.py --workers 10 --output /path/to/save
```

### 4. 限制下载数量（测试用）
```bash
python crawler.py --max-videos 20
```

### 5. 不下载封面图
```bash
python crawler.py --no-cover
```

### 6. 强制重新下载（忽略已存在文件）
```bash
python crawler.py --no-resume
```

## 参数说明

| 参数 | 默认值 | 说明 |
|------|--------|------|
| `--output, -o` | `./downloads` | 输出目录 |
| `--workers, -j` | `5` | 并发下载线程数 |
| `--metadata-only` | 关 | 仅抓取元数据，不下载视频 |
| `--no-cover` | 关 | 不下载封面图 |
| `--no-resume` | 关 | 关闭断点续传，强制重下 |
| `--max-videos` | `0`（全部） | 最多处理的视频数量 |
| `--pages-only` | 关 | 仅使用分页列表，不读取 sitemap |
| `--delay` | `0.2` | 抓取详情页之间的间隔（秒） |

## 输出文件结构

```
downloads/
├── videos/              # 所有 .mp4 视频文件
│   ├── 视频标题__3709.mp4
│   └── ...
├── covers/              # 所有封面图（-cover.jpg）
│   ├── 视频标题__3709.jpg
│   └── ...
├── metadata.json        # 完整元数据（JSON 格式）
├── metadata.csv         # 完整元数据（CSV 格式，可用 Excel 打开）
├── failed_pages.txt     # 抓取失败的页面 URL（若有）
└── download_errors.json # 下载失败的文件列表（若有）
```

## metadata 字段说明

| 字段 | 含义 |
|------|------|
| `title` | 视频标题 |
| `page_url` | 详情页 URL |
| `video_url` | CDN 视频直链 |
| `cover_url` | CDN 封面直链 |
| `slug` | URL 别名 |
| `cdn_folder` | CDN 日期文件夹名 |
| `filename` | CDN 原始文件名 |
| `video_id` | 视频数字 ID |
