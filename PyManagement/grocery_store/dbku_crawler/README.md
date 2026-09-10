# 独播库（dbku.tv）全站爬虫

针对影视站 **https://www.dbku.tv/** 开发的全站数据抓取工具，支持列表、详情、播放直链（m3u8）三级数据抓取，并提供视频下载能力。

## 网站结构分析

该站基于**苹果CMS（MyTheme 模板）**构建：

| 层级 | URL 模式 | 说明 |
|------|----------|------|
| 首页 | `/` | 推荐、各分类精选 |
| 分类列表第1页 | `/vodshow/{cid}-----------.html` 或 `/vodtype/{cid}.html` | 主分类：电影=1 / 连续剧=2 / 综艺=3 / 动漫=4；子分类：陆剧=13 / 台泰剧=14 / 日韩剧=15 / 短剧=21 等 |
| 分类列表分页 | `/vodshow/{cid}--------{page}---.html`（cid 和 page 之间 8 个 `-`） | 每页 48 条 |
| 详情页 | `/voddetail/{vid}.html` | 包含标题、评分、分类/地区/年份/主演/导演/简介、更新时间、各线路播放列表 |
| 播放页 | `/vodplay/{vid}-{sid}-{nid}.html` | 页面 JS 注入 `var player_data = {...}`，其中 `url` 是 base64 + URL-encode 加密的真实视频地址 |

**视频地址解密逻辑**（已在代码中实现）：

```python
# encrypt=2 时，URL 字段做了两层编码
video_url = urllib.parse.unquote(base64.b64decode(player_data["url"]).decode())
# 可直接得到 https://vid.dbokutv.com/xxx/chunklist.m3u8
```

## 依赖安装

```bash
pip install requests beautifulsoup4 lxml
# 如需下载视频，请确保系统安装 ffmpeg
sudo apt install ffmpeg    # Ubuntu/Debian
brew install ffmpeg        # macOS
```

## 快速开始

```bash
# 1. 默认抓取全部 4 大主分类（电影/连续剧/综艺/动漫）的元数据
python dbku_crawler.py

# 2. 只抓连续剧 + 电影，每分类最多抓 3 页
python dbku_crawler.py --types 1 2 --max-pages 3

# 3. 抓取元数据 + 每集视频直链（m3u8 地址）
python dbku_crawler.py --fetch-play-url --workers 8

# 4. 下载视频到本地（自动调用 ffmpeg 合并 m3u8 → mp4）
python dbku_crawler.py --fetch-play-url --download --download-dir ./videos

# 5. 下载封面图
python dbku_crawler.py --download-covers

# 6. 断点续爬（中途中断后重新执行会自动跳过已抓过的条目）
python dbku_crawler.py --fetch-play-url --resume
```

## 输出文件

所有产物默认保存到 `./output/`：

| 文件 | 说明 |
|------|------|
| `dbku_index.json` | 影视索引（id、标题、评分、集数、封面、所属分类） |
| `dbku_detail.json` | 详情数据（导演、主演、地区、年份、简介、各线路播放列表） |
| `dbku_play_urls.json` | 播放直链（键 `vid-sid-nid` → m3u8 真实地址） |
| `dbku_videos.csv` | 表格形式索引，可直接用 Excel 打开 |
| `images/` | 封面图（加 `--download-covers` 时生成） |
| `videos/` | 下载的视频 mp4（加 `--download` 时生成） |

## 主要参数

| 参数 | 默认值 | 说明 |
|------|--------|------|
| `--types` | 1 2 3 4 | 要抓的分类ID（可指定多个） |
| `--max-pages` | 0（全部分页） | 每分类最多翻多少页 |
| `--workers` | 4 | 并发线程数（建议 4~10，过高会触发风控） |
| `--delay` | 0.3 | 基础请求延迟（秒），实际会在 delay~2*delay 随机化 |
| `--fetch-play-url` | 关 | 是否抓取每集真实播放地址 |
| `--download` | 关 | 是否用 ffmpeg 下载视频（需配合 `--fetch-play-url`） |
| `--download-covers` | 关 | 是否下载封面图 |
| `--output` | ./output | 输出目录 |
| `--resume` | 关 | 断点续爬（基于已有 JSON 文件跳过已抓条目） |

## 代码结构

```
dbku_crawler.py
├── make_session()            # 建立带重试机制的 requests Session
├── polite_get()              # 带随机延迟的礼貌请求
├── decrypt_url()             # 解密 player_data.url 得到 m3u8 直链
├── fetch_category_ids()      # 扫描所有可用分类
├── parse_list_page()         # 解析单页列表 + 识别分页
├── crawl_category()          # 按分类抓全部分页列表
├── crawl_detail()            # 抓详情页元数据
├── crawl_play_url()          # 抓播放页并解密视频直链
├── download_cover()          # 下载封面
└── download_video_ffmpeg()   # 调用 ffmpeg 下载 m3u8 视频
```

## 合规提示

- 本工具仅用于个人学习、研究数据抓取技术之用。
- 请遵守目标网站的 `robots.txt` 与服务条款，合理控制抓取频率（已内置随机延迟，默认 `--delay 0.3`）。
- 抓取到的影视内容版权归原网站/版权方所有，请勿用于商业用途或公开传播。
