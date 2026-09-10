# 嘀嗒影视 (didahd.xyz) 全站爬虫

## 📁 文件说明

| 文件 | 说明 |
| --- | --- |
| `didahd_spider.py` | 爬虫主脚本（Python3） |
| `requirements.txt` | Python依赖清单 |
| `README.md` | 本使用说明 |

运行后会自动创建 `didahd_data/` 输出目录，包含：

- `didahd_all_videos.json` — 完整数据（含所有元信息+播放源+网盘链接+每集信息）
- `didahd_videos_list.csv` — 视频简表（可直接用 Excel 打开）
- `didahd.db` — SQLite 数据库（可用 DB Browser for SQLite 查看）
- `covers/` — 封面图片目录（需启用 `--download`）
- `README.md` — 本次抓取报告

## 🚀 快速开始

### 1. 安装依赖

`pip3 install requests beautifulsoup4 lxml`

### 2. 运行爬虫

`# 全站抓取（5大分类：电影/电视剧/纪录片/动漫/综艺）`\
`python3 didahd_spider.py`\
\
`# 只抓电影 + 电视剧`\
`python3 didahd_spider.py --type 1 2`\
\
`# 测试：每个分类只抓前2页`\
`python3 didahd_spider.py --max-pages 2`\
\
`# 慢速防封（间隔2秒，单线程，更稳定）`\
`python3 didahd_spider.py --delay 2 --workers 1`\
\
`# 同时下载封面图片`\
`python3 didahd_spider.py --download`\
\
`# 断点续爬：重新运行会自动跳过已爬取的内容`\
`python3 didahd_spider.py`\
\
`# 只重新导出已有数据库（不重新爬取）`\
`python3 didahd_spider.py --export-only`

## ⚙️ 参数说明

| 参数 | 默认值 | 说明 |
| --- | --- | --- |
| `--type` | 全部 | 指定分类ID：`1`电影 `2`电视剧 `3`纪录片 `4`动漫 `5`综艺，可多个 |
| `--max-pages` | 不限制 | 每个分类最多抓取多少页（用于测试） |
| `--delay` | 1.5 | 请求间隔秒数，越小越快，但建议≥1秒以免被封IP |
| `--workers` | 3 | 并发线程数，建议1-5之间 |
| `--download` | 关闭 | 同时下载封面图片到 `covers/` 目录 |
| `--export-only` | 关闭 | 不抓取新内容，只从已有数据库重新导出 |

## 📊 分类ID对照

| ID | 分类 |
| --- | --- |
| 1 | 电影 |
| 2 | 电视剧 |
| 3 | 纪录片 |
| 4 | 动漫 |
| 5 | 综艺 |

## 📋 抓取字段说明

每个视频包含以下字段：

- **id** — 视频站内ID
- **title** — 影片标题
- **category_name** — 分类名称
- **rating** — 豆瓣评分
- **status** — 更新状态（如"更新至第07集"、"HD中字"、"已完结"）
- **area** — 制片地区
- **language** — 语言
- **year** — 上映年份
- **director** — 导演
- **actors** — 主演列表
- **tags** — 类型标签
- **total_episodes** — 总集数
- **cover_url** — 封面图片URL
- **description** — 剧情简介
- **detail_url** — 详情页链接
- **quark_url** — 夸克网盘下载链接
- **baidu_url** — 百度网盘下载链接（含提取码pwd=）
- **play_sources** — 播放源列表，每个播放源包含：
  - `source_name`：线路名（如"超清G"、"超清B"、"夸克网盘"、"百度网盘"）
  - `episodes`：该线路下所有集数的播放页链接
- **episodes** — 每集详情（含播放页URL和解析出的真实视频地址）

## 🔒 合规声明

1. 本脚本仅供学习、研究Python网络爬虫技术使用。
2. 请遵守 `robots.txt` 协议及目标网站的服务条款，合理控制抓取频率。
3. 抓取到的内容版权归原网站所有，请勿用于商业用途或非法传播。
4. 因使用本脚本产生的任何法律责任由使用者自行承担。

## 🛠️ 技术特性

- ✅ **断点续爬**：基于SQLite记录已爬URL，中断后重跑自动续传
- ✅ **多线程并发**：可配置并发数，提高抓取效率
- ✅ **随机UA**：每次请求随机切换User-Agent，降低被封概率
- ✅ **失败重试**：网络错误自动重试3次，带指数退避
- ✅ **限速保护**：可配置请求间隔，礼貌抓取
- ✅ **多格式导出**：同时导出JSON（完整）、CSV（简洁）、SQLite（可查询）
- ✅ **自动解密**：自动识别并解密播放页中 encrypt=1/2 的视频直链
- ✅ **封面下载**：可选项，自动下载海报到本地