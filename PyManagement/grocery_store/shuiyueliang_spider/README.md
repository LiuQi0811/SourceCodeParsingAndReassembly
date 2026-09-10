# 水月亮影视 (shuiyueliang.com) 全站爬虫

## 功能特点

- ✅ 基于苹果CMS(maccms)结构自动识别
- ✅ 自动爬取全站 60+ 分类（电影/电视剧/综艺/动漫/短剧等）
- ✅ 三层爬取：分类列表 → 视频详情 → 播放源地址
- ✅ 自动提取 m3u8/mp4 真实播放地址
- ✅ 数据三格式保存：SQLite数据库 / JSON / CSV
- ✅ 支持断点续爬（已爬过的不会重复爬）
- ✅ 随机 User-Agent + 请求间隔，降低被封风险
- ✅ 支持多线程并发
- ✅ 可选下载封面图
- ✅ 详细日志记录

## 安装依赖

`pip install -r requirements.txt`

## 使用方法

### 1. 完整爬取（推荐）

爬取列表+详情+播放地址：

`python shuiyueliang_spider.py`

### 2. 只爬列表（快速获取全站视频索引）

`python shuiyueliang_spider.py --list-only`

### 3. 跳过播放页（只获取元数据）

`python shuiyueliang_spider.py --no-play`

### 4. 测试模式（每个分类只爬前2页）

`python shuiyueliang_spider.py --max-pages 2`

### 5. 下载封面图

`python shuiyueliang_spider.py`\
`# 封面默认不下载，如需下载请去掉代码里的 --no-images 限制`

### 6. 查看爬取统计

`python shuiyueliang_spider.py --stats`

## 命令行参数

| 参数 | 说明 |
| --- | --- |
| `--list-only` | 只爬列表，不爬详情和播放 |
| `--no-detail` | 不爬详情页 |
| `--no-play` | 不爬播放页 |
| `--no-images` | 不下载封面图 |
| `--max-pages N` | 每个分类最大爬取页数（测试用） |
| `--workers N` | 并发线程数（默认3） |
| `--stats` | 显示爬取统计信息 |

## 输出目录结构

`shuiyueliang_data/`\
`├── shuiyueliang.db    # SQLite数据库（主数据，支持断点续爬）`\
`├── videos.json        # 完整JSON数据`\
`├── videos.csv         # CSV表格数据（可用Excel打开）`\
`├── spider.log         # 爬取日志`\
`└── images/            # 封面图目录（可选）`\
`    ├── 12345.jpg`\
`    └── ...`

## 数据字段说明

| 字段 | 说明 |
| --- | --- |
| id | 视频ID |
| title | 视频标题 |
| url | 详情页链接 |
| category | 分类路径 |
| category_name | 分类名称 |
| cover | 封面图URL |
| year | 年份 |
| area | 地区 |
| language | 语言 |
| director | 导演 |
| actors | 主演 |
| genres | 类型 |
| description | 剧情简介 |
| rating | 评分 |
| total_episodes | 总集数 |
| update_status | 更新状态 |
| m3u8_urls | 真实播放地址列表(m3u8/mp4) |
| play_urls | 各集播放页链接 |

## 注意事项

1. **请合理控制爬取速度**：默认1-3秒随机延迟，不要设置太高并发
2. **仅供学习研究使用**：请遵守目标网站robots.txt及相关法律法规
3. **断点续爬**：爬虫中途中断可直接重新运行，会自动跳过已爬内容
4. **播放地址**：部分视频使用第三方解析，可能需要配合解析接口使用
5. **如遇访问限制**：可适当调大 DELAY_MIN 和 DELAY_MAX 参数

## 爬取范围

自动覆盖全站所有分类：

- 电影片、连续剧、综艺片、动漫片、短剧、体育赛事
- 爱情片、动作片、科幻片、恐怖片、喜剧片、纪录片等
- 国产剧、韩剧、日剧、欧美剧、泰剧、台剧等
- 国产动漫、日本动漫、韩国动漫、欧美动漫等
- 共60+细分分类

## 网站URL结构

- 首页：`https://shuiyueliang.com/`
- 分类页：`https://shuiyueliang.com/vod/{分类id}/`
- 分类分页：`https://shuiyueliang.com/vod/{分类id}/{页码}.html`
- 详情页：`https://shuiyueliang.com/vod/{分类id}/{视频id}.html`
- 播放页：`https://shuiyueliang.com/vod/play/{视频id}/{集数id}.html`