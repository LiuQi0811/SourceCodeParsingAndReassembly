# 永乐视频 (tv.59v.net) 全站爬虫

## 逆向分析结论
- 站点基于 **MacCMS v10（苹果CMS）** 魔改模板。
- 官方 JSON 采集接口 `/api.php/provide/vod/` 已被站长关闭（返回 `closed`），**本爬虫走 HTML 解析路线**。
- 播放页核心变量 `var player_aaaa = {…}` 中直接暴露真实 m3u8 地址，`encrypt=0` 表示**未加密**；
  代码内置 base64 解密逻辑，兼容后续若开启 `encrypt=1` 的加密线路。
- 视频 m3u8 托管在第三方 CDN（如 `hn.bfvvs.com`、`y6fb.vhmzy.com` 等），以明文 ts 分片为主；
  存在 `ffmpeg` 时优先使用 ffmpeg 下载；否则 Python 原生下载并自动解密 AES-128 加密的 EXT-X-KEY 流（需安装 `pycryptodome`）。

## 站点结构
- 首页：`https://tv.59v.net/`
- 分类列表：`https://tv.59v.net/vodshow/{cid}-----------/`（第1页），分页为 `…/vodshow/{cid}--------{page}---/`
  - 分类ID：`1=电影`、`2=剧集`、`3=综艺`、`4=动漫`
- 详情页：`https://tv.59v.net/voddetail/{vid}/`
- 播放页：`https://tv.59v.net/play/{vid}-{sid}-{nid}/`
  - `sid`：播放源序号（1=自营1线、2=自营2线…）
  - `nid`：集数序号

## 使用方法

### 1) 抓取全站元数据 + m3u8 地址（不下载视频，推荐先跑）
```bash
python3 spider.py
```
产物：
- `data/catalog.jsonl` — 每行一条视频，含标题/封面/简介/年份/地区/导演/演员/标签/每集m3u8
- `data/catalog.csv`   — 扁平化总索引，可直接 Excel 打开
- `data/visited.txt`   — 已完成的 vod_id，断点续爬
- `data/failed.txt`    — 抓取失败的视频（下次重跑自动重试）
- `data/crawl.log`     — 运行日志（终端 + 文件双输出）

### 2) 只爬某个分类（如电影）
```bash
python3 spider.py --cat 1
# 1=电影 2=剧集 3=综艺 4=动漫，逗号分隔，如 --cat 1,2
```

### 3) 调试：每个分类只爬前 N 页
```bash
python3 spider.py --max-pages 2
```

### 4) 同时下载视频（m3u8 → mp4）
```bash
python3 spider.py --download
```
- 视频保存到 `videos/{分类名}/{剧名}_EP{n}.mp4`
- 会下载所抓剧集的**全部剧集**（默认只下第1条播放源；如需全源：加 `--all-sources`）
- 已存在的 mp4 会自动跳过，可随时中断重跑
- 注意：全站共约 500+ 页、数万集，磁盘空间和耗时都很可观

### 5) 根据 catalog.jsonl 按需下载单部视频
```bash
python3 download_video.py --vod-id 126231
# 或按关键字：
python3 download_video.py --keyword "怒之杀"
# 可选：--sid 2 换线路；--out xxx.mp4 指定输出路径（仅单集时生效）
```

## 参数总览
| 参数 | 说明 |
|---|---|
| `--cat` | 分类ID，默认 `1,2,3,4` 全爬 |
| `--max-pages N` | 每类最多翻 N 页，0=全部 |
| `--download` | 边爬边下载 mp4 |
| `--all-sources` | 抓取全部播放线路（默认仅第1条源） |
| `--threads N` | 并发处理视频的线程数，默认 8；下载并发固定为 2 |

## 并发、断点与日志
- **并发**：视频级默认 8 线程（`--threads` 调整），剧集级 m3u8 抓取每部最多 4 并发，下载并发固定为 2；
- **断点续爬**：全部剧集 m3u8 均获取成功的视频写入 `data/visited.txt`，中断后重跑会自动跳过已完成项；
- **失败重试**：有剧集失败的视频写入 `data/failed.txt`（不标记完成），下次重跑自动重试；
- **日志**：终端与 `data/crawl.log` 双输出，可用 `tail -f data/crawl.log` 实时查看进度；
- 想完全重爬：删除 `data/` 目录即可。

## 依赖
```bash
pip install requests beautifulsoup4 lxml tqdm pycryptodome
# 可选：有 ffmpeg 时下载更稳（推荐安装）
brew install ffmpeg        # macOS
apt-get install -y ffmpeg  # Debian/Ubuntu
```
