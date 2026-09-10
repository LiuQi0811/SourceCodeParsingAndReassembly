# gqc.ink 全站爬虫使用说明

针对影视站 **https://gqc.ink/** (共青春影院) 编写的全站抓取脚本。单文件 Python，零外部依赖外仅需 `requests` + `beautifulsoup4`。

## 功能特性

- ✅ **全栏目覆盖**：电影、连续剧、综艺、动漫、短剧五大栏目
- ✅ **自动分页**：识别每个分类总页数（电影约 1600+ 页）
- ✅ **元数据完整**：标题、封面、导演、主演、分类、地区、年份、更新时间、简介
- ✅ **多线路/多集数解析**：自动识别 LZ线、YZ线、BF线、腾视、芒视、爱奇等线路，连续剧解析每一集
- ✅ **真实直链提取**：进入播放页解析 iframe 的 `data-play`，直接拿到 m3u8/mp4 地址（LZ/BF/YZ等自备线路可拿到纯直链；腾讯/芒果/爱奇艺等官方源返回解析跳转链接）
- ✅ **三种输出格式**：JSON（全字段）、CSV（表格友好）、SQLite（可 SQL 查询）
- ✅ **批量下载清单**：`--download` 输出 aria2 格式的下载列表，可直接批量下载
- ✅ **断点续爬**：SQLite 记录已完成的视频 ID，中断后重跑自动跳过
- ✅ **反爬友好**：随机 UA、可配置间隔与并发数、失败自动重试

## 目录结构

`gqc_spider.py      # 爬虫主程序`\
`gqc_data/          # 输出目录（运行后生成）`\
`├── gqc_all.json   # 完整 JSON 数据`\
`├── gqc_all.csv    # CSV 表格`\
`├── gqc.db         # SQLite 数据库`\
`└── download_list.txt  # 直链下载清单(需加 --download)`

## 依赖安装

`pip install requests beautifulsoup4`

## 使用方法

### 1. 全量爬取（五大栏目所有页，建议后台跑）

`python3 gqc_spider.py`

### 2. 只爬电影

`python3 gqc_spider.py --cate dianying`

### 3. 爬多个栏目

`python3 gqc_spider.py --cate dianying lianxuju dongman`

可选栏目：`dianying`(电影)、`lianxuju`(连续剧)、`zongyi`(综艺)、`dongman`(动漫)、`duanju`(短剧)

### 4. 测试：每个栏目只爬前 3 页

`python3 gqc_spider.py --pages 3`

### 5. 提高并发 + 限速

`python3 gqc_spider.py --workers 8 --delay 0.5`

### 6. 只抓元数据不解析视频（最快）

`python3 gqc_spider.py --no-video`

### 7. 生成批量下载列表，配合 aria2 使用

`python3 gqc_spider.py --cate dianying --download`\
`# 下载:`\
`aria2c -i gqc_data/download_list.txt -d ./movies/ -j 5`\
`# 或 m3u8 用 ffmpeg 下载:`\
`# ffmpeg -i "m3u8地址" -c copy output.mp4`

## 输出数据字段说明

每条视频记录包含以下字段：

| 字段 | 说明 |
| --- | --- |
| id | 影片 ID |
| title | 影片标题 |
| url | 详情页地址 |
| cover | 海报封面 URL |
| director | 导演 |
| actors | 主演列表 |
| category | 分类(动作片/剧情片/台剧/日剧等) |
| region | 地区 |
| year | 年份 |
| update | 更新标签 |
| rating | 评分 |
| intro | 剧情简介 |
| play_sources | 线路列表(含每集播放页URL) |
| real_videos | 真实视频直链列表(m3u8/mp4) |

## 命令行参数

| 参数 | 默认值 | 说明 |
| --- | --- | --- |
| `--cate` | 全部 | 指定栏目 |
| `--pages` | 0(全部) | 每个栏目最多爬取页数 |
| `--workers` | 4 | 并发线程数 |
| `--delay` | 0.8 | 两次请求间最小间隔(秒) |
| `--no-video` | False | 不解析播放页直链 |
| `--download` | False | 生成 aria2 下载清单 |

## URL 规律备忘（代码中已自动处理）

- 首页：`https://gqc.ink/`
- 分类列表第 N 页：`https://gqc.ink/vodshow/{cate}--------N---.html`
- 影片详情页：`https://gqc.ink/neirong/{id}.html`
- 播放页：`https://gqc.ink/bofang/{id}-{线路}-{集数}.html`
- 播放页真实直链：iframe 的 `data-pars` + `data-play` 属性拼接

## 法律声明

本脚本仅供学习爬虫技术使用，抓取的视频版权归原网站及制片方所有，请遵守相关法律法规，勿用于非法用途。