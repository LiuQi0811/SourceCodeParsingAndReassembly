# 乐影院 (leyy.tv) 全站爬虫使用说明

## 站点结构

- 首页: https://leyy.tv/
- 分类列表: `/vodshow/{类型id}--------{页码}---.html`
- 播放/详情页: `/vodplay/{视频id}-{源id}-{集数id}.html`

| 类型id | 分类 | 大约页数 |
| --- | --- | --- |
| 1 | 电影 | 2272 |
| 2 | 电视剧 | 997 |
| 3 | 综艺 | \~ |
| 4 | 动漫 | \~ |
| 6 | 纪录片 | \~ |

## 依赖安装

`pip install requests beautifulsoup4 lxml`

## 使用方法

### 1. 全站爬取（所有分类，全部页码）

`python leyy_spider.py`

⚠️ 全站数据量较大（电影5万+部、电视剧2万+部...），耗时较长，建议用`--delay 0.6`或更大、配合`--resume`断点续爬。

### 2. 指定分类爬取

`# 只爬电影`\
`python leyy_spider.py -t 1`\
\
`# 爬电影+电视剧`\
`python leyy_spider.py -t 1 2`

### 3. 限定页数（用于快速测试/抽样）

`# 电影只爬前3页(约72部)`\
`python leyy_spider.py -t 1 --max-pages 3`\
\
`# 每个分类只爬首页`\
`python leyy_spider.py --max-pages 1`

### 4. 断点续爬（中断后继续）

`python leyy_spider.py -t 1 --resume`

程序每爬20部自动保存一次状态，中断后重新运行加 `--resume` 即可从上次位置继续。

### 5. 只爬列表（不含详情/播放地址）

`python leyy_spider.py --no-detail`

速度极快，仅获取视频ID/标题/封面，不进入详情页，适合快速建立索引。

### 6. 调整请求速度

`# 间隔1秒(更温和)`\
`python leyy_spider.py --delay 1.0`

## 输出文件

所有数据保存在 `leyy_data/` 目录：

| 文件名 | 格式 | 说明 |
| --- | --- | --- |
| `video_list.json` | JSON | 全部分类的视频列表（id/标题/封面/类型） |
| `video_detail_full.json` | JSON | 完整详情数据（含所有播放源/集数/真实m3u8地址） |
| `video_detail_full.csv` | CSV | 扁平化表格（每集一行，方便Excel/数据库导入） |
| `spider_state.json` | JSON | 断点续爬状态（`--resume`时自动使用） |

## 数据字段说明

每部视频包含：

- `id`: 视频唯一ID
- `title`: 片名
- `year`: 上映年份
- `score`: 评分(10分制)
- `area`: 国家/地区
- `genre`: 类型标签列表（如 \["爱情","惊悚","恐怖"\]）
- `director`: 导演列表
- `actor`: 演员列表
- `description`: 剧情简介
- `cover`: 封面图URL
- `type_name`: 所属分类
- `play_sources`: 播放源列表
  - `source_name`: 播放源名称（天堂/速播/金鹰/红牛/新浪/豆瓣/...）
  - `episodes`: 集数列表
    - `episode`: 集数标题（如"第1集"/"抢先版"/"HD"/"TC中字"）
    - `play_url`: 页面播放URL
    - `video_url`: **真实m3u8直链**（已通过RC4密钥 `i_love_you` 解密）

## 关键技术点

- 播放地址在页面JS中使用 **RC4加密** (key=`i_love_you`) 存储为hex字符串，爬虫已内置解密
- 页面通过 `application/ld+json` 结构化数据输出元数据，解析最为稳定
- 列表页支持按类型/地区/年代/排序筛选，可按需扩展
- 默认使用 `0.6秒` 请求间隔，请保持礼貌爬取

## 输出示例

`[电影] 总页数=2272, 解析到24部`\
`  id=120641  title=怨鬼网红`\
`详情: 怨鬼网红 | 年份:2026 评分:7.4 | 6个源, 6集`\
`  源: 天堂 -> 第1集 https://vip.dytt-network.com/20260908/39431_8010af36/index.m3u8`\
`  源: 速播 -> 第1集 https://play.xluuss.com/play/axk1P3re/index.m3u8`\
`  ...`