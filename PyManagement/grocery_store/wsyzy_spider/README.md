# 无水印资源站 (www.wsyzy.cc) 全站抓取工具

一个功能完善的 Python 爬虫工具，专门用于抓取「无水印资源站」的全站影视数据。

## ✨ 功能特性

- ✅ **基于官方API抓取**（推荐）：通过苹果CMS标准JSON接口，稳定快速
- ✅ **HTML页面爬取**：备用方案，API不可用时使用
- ✅ **多线程并发**：支持自定义线程数，加速抓取
- ✅ **多种导出格式**：JSON、CSV、Excel、SQLite 数据库
- ✅ **分类筛选**：支持按分类抓取（电影、电视剧、国产剧、综艺、动漫等）
- ✅ **关键词搜索**：支持按影片名称搜索抓取
- ✅ **增量更新**：仅抓取最近N小时更新的内容
- ✅ **断点续爬**：中断后可继续，不重复抓取
- ✅ **封面下载**：自动下载影片封面图
- ✅ **m3u8解析**：内置播放链接解析
- ✅ **自动重试**：网络异常自动重试，高容错性

## 📋 站点概况

- **站点地址**: https://www.wsyzy.cc/
- **数据总量**: 约 12.5 万条视频
- **分类数量**: 70+ 个分类（电影、电视剧、综艺、动漫、短剧、伦理等）
- **数据接口**: 苹果CMS标准JSON API
- **视频格式**: m3u8 流媒体

## 🚀 快速开始

### 1. 安装依赖

```bash
cd wsyzy_spider
pip install -r requirements.txt
```

### 2. 最简单使用

```bash
# 抓取全站所有数据，保存为JSON
python wsyzy_spider.py
```

### 3. 常用命令

```bash
# 查看帮助
python wsyzy_spider.py --help

# 列出所有分类
python wsyzy_spider.py --list-types

# 导出为JSON+CSV+Excel三种格式
python wsyzy_spider.py --format json,csv,excel

# 仅抓取指定分类（电影+国产剧）
python wsyzy_spider.py --type 电影,国产剧

# 按关键词搜索抓取
python wsyzy_spider.py --keyword 庆余年

# 增量模式：仅抓最近24小时更新的（每日更新推荐）
python wsyzy_spider.py --recent 24

# 抓取前10页，8线程加速
python wsyzy_spider.py --start 1 --pages 10 --threads 8

# 下载封面图片
python wsyzy_spider.py --download-images

# 使用HTML爬取模式（API不可用时备用）
python wsyzy_spider.py --mode html

# 断点续爬
python wsyzy_spider.py --resume
```

## 📁 文件结构

```
wsyzy_spider/
├── wsyzy_spider.py      # 主爬虫程序
├── demo.py              # 使用示例脚本
├── requirements.txt     # Python依赖
├── README.md            # 本文档
└── output/              # 输出目录（运行后自动生成）
    ├── wsyzy_*.json     # JSON格式数据
    ├── wsyzy_*.csv      # CSV格式数据
    ├── wsyzy_*.xlsx     # Excel格式数据
    ├── wsyzy_*.db       # SQLite数据库
    ├── spider.log       # 运行日志
    └── images/          # 封面图片目录
```

## 📊 数据字段说明

### 视频主表字段

| 字段 | 说明 |
|------|------|
| vod_id | 视频唯一ID |
| type_name | 分类名称 |
| vod_name | 影片名称 |
| vod_sub | 副标题 |
| vod_actor | 主演 |
| vod_director | 导演 |
| vod_year | 年份 |
| vod_area | 地区 |
| vod_lang | 语言 |
| vod_remarks | 更新备注（如"更新第08集"） |
| vod_score | 评分 |
| vod_blurb | 简介摘要 |
| vod_content | 详细剧情介绍 |
| vod_pic | 封面图URL |
| vod_time | 最后更新时间 |
| total_episodes | 总集数 |
| play_sources | 播放源列表（含各集m3u8地址） |

### 播放地址格式

每个视频包含一个或多个播放源，每个播放源下有多集：

```json
{
  "play_sources": [
    {
      "source": "wsym3u8",
      "episodes": [
        {
          "episode": "第01集",
          "url": "https://xxx.m3u8"
        }
      ]
    }
  ]
}
```

## 🔧 API接口说明

本工具使用的苹果CMS标准API接口：

| 接口 | 参数 | 说明 |
|------|------|------|
| `/api.php/provide/vod/?ac=list&pg=N` | pg=页码 | 获取视频列表 |
| `/api.php/provide/vod/?ac=detail&ids=ID` | ids=视频ID | 获取视频详情 |
| `/api.php/provide/vod/?ac=list&t=TYPE_ID` | t=分类ID | 按分类筛选 |
| `/api.php/provide/vod/?ac=list&wd=KEYWORD` | wd=关键词 | 搜索 |
| `/api.php/provide/vod/?ac=list&h=HOURS` | h=小时数 | 按时间筛选 |

## 💡 使用示例（代码调用）

```python
from wsyzy_spider import WsyzyAPISpider, DataExporter, M3U8Parser

# 创建爬虫实例
spider = WsyzyAPISpider()

# 1. 获取分类列表
categories = spider.get_categories()
print(categories)  # {1: '电影', 2: '电视剧', ...}

# 2. 抓取最近24小时更新
data = spider.fetch_all(recent_hours=24, threads=4)

# 3. 按分类抓取（如电影）
data = spider.fetch_all(type_id=1, max_pages=10)

# 4. 搜索
data = spider.fetch_all(keyword="流浪地球")

# 5. 导出数据
exporter = DataExporter(data, "./output")
exporter.to_json()     # JSON
exporter.to_csv()      # CSV
exporter.to_excel()    # Excel
exporter.to_sqlite()   # SQLite

# 6. m3u8解析
play_url = M3U8Parser.get_parse_url("https://xxx.m3u8")
```

## ⚠️ 注意事项

1. **合理使用**：请控制抓取频率，避免对目标服务器造成过大压力
2. **仅供学习**：抓取的数据仅供个人学习研究使用，请勿用于商业用途
3. **版权尊重**：请尊重视频版权，支持正版内容
4. **遵守规则**：请遵守目标网站的robots.txt协议
5. **API优先**：优先使用API模式抓取，效率更高且对服务器更友好

## 🐛 常见问题

**Q: 抓取速度很慢怎么办？**
A: 增大线程数 `--threads 8`，但建议不要超过16。

**Q: 导出Excel报错？**
A: 确保安装了openpyxl: `pip install openpyxl pandas`

**Q: 抓取中断了怎么办？**
A: 使用 `--resume` 参数支持断点续爬。

**Q: API接口失效了怎么办？**
A: 使用 `--mode html` 切换到HTML页面爬取模式。

**Q: 如何每天自动更新数据？**
A: 使用 `--recent 24` 参数配合系统定时任务（cron/计划任务）即可实现每日增量更新。

## 📜 免责声明

本工具仅用于学习和研究爬虫技术，使用者需自行遵守相关法律法规，尊重网站版权和robots协议。因不当使用造成的任何后果由使用者自行承担。
