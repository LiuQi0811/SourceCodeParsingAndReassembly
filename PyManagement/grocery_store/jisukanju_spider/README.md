# 极速看剧 (jisukanju.com) 全站爬虫

针对 `https://www.jisukanju.com/` (MacCMS v10架构影视站) 开发的完整全站抓取工具集。

---

## 文件说明

| 文件 | 功能 |
| --- | --- |
| `jisukanju_spider.py` | **全站爬虫主程序** - 抓取所有影视分类、详情页信息、播放链接 |
| `jisukanju_parser.py` | **播放地址解析工具** - 提取M3U8/MP4真实播放地址 |
| `requirements.txt` | Python依赖包 |

---

## 快速开始

### 1. 安装依赖

`pip install -r requirements.txt`

### 2. 全站抓取

`# 抓取全站所有分类、所有页面`\
`python jisukanju_spider.py`\
\
`# 只抓取电影分类(type=1)`\
`python jisukanju_spider.py --type 1`\
\
`# 每个分类只抓前5页（快速测试）`\
`python jisukanju_spider.py --pages 5`\
\
`# 导出为CSV格式（方便Excel查看）`\
`python jisukanju_spider.py --export csv`\
\
`# 5线程加速抓取`\
`python jisukanju_spider.py --workers 5`

**MacCMS分类ID参考：**

- 1 = 电影
- 2 = 电视剧
- 3 = 综艺
- 4 = 动漫

### 3. 单页提取（测试用）

`# 提取单个影视详情页信息`\
`python jisukanju_spider.py --url https://www.jisukanju.com/vod/detail/id/xxxxx.html`

### 4. 关键词搜索

`python jisukanju_spider.py --search "庆余年"`

### 5. 播放地址解析（提取M3U8）

`# 解析单个播放页，获取真实视频地址`\
`python jisukanju_parser.py https://www.jisukanju.com/vod/play/id/xxxxx/sid/1/nid/1.html`\
\
`# 解析某个详情页下所有剧集的播放地址`\
`python jisukanju_parser.py https://www.jisukanju.com/vod/detail/id/xxxxx.html --all`\
\
`# 批量解析（urls.txt每行一个URL）`\
`python jisukanju_parser.py --batch urls.txt`

---

## 抓取字段说明

每个视频条目包含以下字段：

`{`\
`  "id": "视频ID",`\
`  "url": "详情页URL",`\
`  "title": "视频标题",`\
`  "cover": "封面图片URL",`\
`  "description": "剧情简介",`\
`  "director": "导演",`\
`  "actors": "主演",`\
`  "category": "影片类型",`\
`  "area": "地区",`\
`  "year": "年份",`\
`  "language": "语言",`\
`  "score": "评分",`\
`  "update_status": "更新状态",`\
`  "tags": ["标签1", "标签2"],`\
`  "play_sources": {`\
`    "播放源1": [`\
`      {"name": "第01集", "url": "播放页URL"}`\
`    ]`\
`  },`\
`  "download_links": [`\
`    {"name": "链接名", "url": "下载URL"}`\
`  ]`\
`}`

---

## 功能特性

✅ **全站遍历** - 自动发现分类，遍历所有分页 ✅ **断点续爬** - 中断后再次运行会从断点继续，不重复抓取 ✅ **多线程** - 支持并发加速（默认3线程） ✅ **自动重试** - 网络失败自动重试3次 ✅ **请求延时** - 内置随机延时1-3秒，避免被封IP ✅ **数据导出** - 支持JSON和CSV两种格式 ✅ **实时保存** - 每抓取50条自动保存检查点 ✅ **播放源解析** - 支持MacCMS的player_aaaa配置解析 ✅ **M3U8提取** - 自动识别并提取m3u8/mp4直链 ✅ **Base64解码** - 自动处理MacCMS常见的URL编码

---

## 输出文件

所有抓取结果保存在 `jisukanju_data/` 目录：

- `jisukanju_all_YYYYMMDD_HHMMSS.json` - 按时间戳命名的完整数据
- `jisukanju_all_YYYYMMDD_HHMMSS.csv` - CSV格式（选csv导出时）
- `jisukanju_latest.json` - 最新数据
- `videos_checkpoint.json` - 断点续爬数据
- `episodes_xxxxx.json` - 单视频所有剧集解析结果
- `.progress.json` - 访问进度记录（用于断点续爬）

---

## MacCMS URL结构说明

本网站基于MacCMS v10，URL结构固定：

| 页面 | URL格式 |
| --- | --- |
| 首页 | `/` |
| 分类页 | `/vod/type/id/{cid}.html` |
| 列表页 | `/vod/show/id/{cid}/page/{page}.html` |
| 详情页 | `/vod/detail/id/{vid}.html` |
| 播放页 | `/vod/play/id/{vid}/sid/{sid}/nid/{nid}.html` |
| 搜索 | `/vod/search.html?wd=关键词` |

---

## 注意事项

1. **合理使用**：请遵守网站robots.txt规定，不要过于频繁请求
2. **延时设置**：默认1-3秒随机延时，可修改代码中的`DELAY_MIN/DELAY_MAX`
3. **线程数**：建议不要超过5线程，避免给服务器造成压力
4. **网络问题**：该网站国内访问偶尔不稳定，程序已内置重试机制
5. **版权声明**：抓取的数据仅供个人学习研究使用，请勿用于商业用途

---

## 常见问题

**Q: 抓取很慢怎么办**？A: 可以适当增加线程数 `--workers 5`，但不建议超过8。

**Q: 中途断了怎么办**？A: 直接再次运行同一命令，程序会自动从断点继续。

**Q: 为什么有些视频没有播放地址**？A: 部分播放源嵌套在第三方iframe中，需要用`jisukanju_parser.py`进一步解析。

**Q: 如何下载视频**？A: 用parser提取出m3u8地址后，可使用ffmpeg或N_m3u8DL-CLI等工具下载：

`ffmpeg -i "m3u8地址" -c copy output.mp4`