# 美剧窝 (mjwo.net) 全站爬虫

针对 https://www.mjwo.net/ 网站（基于 MacCMS v10 苹果CMS模板）开发的全站爬虫工具。

## 功能特性

- ✅ **全部分类抓取**：支持美剧、电影、港剧、动作片、喜剧片、爱情片、科幻片、恐怖片、剧情片、战争片、动画片等所有频道
- ✅ **自动翻页**：自动识别最大页数，按分类分页爬取
- ✅ **详情字段完整**：标题、年份、地区、类型、豆瓣评分、导演、主演、简介、封面、更新状态
- ✅ **播放列表提取**：每部影片所有集数/播放源的链接
- ✅ **播放页解析**：提取播放器数据、下一集/上一集、视频地址、iframe嵌入
- ✅ **多线程支持**：可配置并发数（默认2线程，避免给服务器造成压力）
- ✅ **断点续爬**：已爬取的视频ID会记录在 `crawled_db.json`，中断后再次运行自动跳过
- ✅ **双格式导出**：同时导出 JSON（完整结构化数据）和 CSV（Excel友好）
- ✅ **增量保存**：每20条自动保存一次，防止意外中断数据丢失
- ✅ **多种模式**：支持全站爬、仅列表、单条测试、播放页解析
- ✅ **请求容错**：自动重试 + 随机延迟 + UA伪装

## 项目结构

```
mjwo_crawler/
├── mjwo_spider.py        # 主爬虫脚本
├── requirements.txt      # 依赖
├── README.md            # 本文档
└── output/              # 输出目录（运行后生成）
    ├── crawler.log         # 运行日志
    ├── crawled_db.json    # 已爬ID记录（断点续爬）
    ├── movies_detail.json # 完整数据（JSON）
    └── movies_detail.csv  # 表格数据（CSV）
```

## 安装

```bash
cd mjwo_crawler
pip install -r requirements.txt
```

## 使用方法

### 1. 测试：单条抓取（快速验证）

```bash
# 通过ID抓取单部影片详情
python mjwo_spider.py --mode single --url 23042

# 通过URL抓取
python mjwo_spider.py --mode single --url https://www.mjwo.net/vod/23042/
```

### 2. 解析播放页（获取视频源信息）

```bash
python mjwo_spider.py --mode play --url https://www.mjwo.net/play/18231-1-1/
```

### 3. 仅抓取列表（不进详情页，速度快）

```bash
# 仅美剧列表
python mjwo_spider.py --mode list --categories meiju

# 多个分类列表
python mjwo_spider.py --mode list --categories meiju dianying
```

### 4. 全站抓取（完整详情，推荐）

```bash
# 抓取全部11个分类（默认，数据量约数万条，耗时较长）
python mjwo_spider.py --mode all

# 指定分类抓取
python mjwo_spider.py --mode all --categories meiju dianying

# 小批量测试（抓取前20条验证）
python mjwo_spider.py --mode all --max 20

# 调整并发线程数（默认2，不建议超过5）
python mjwo_spider.py --mode all --workers 3
```

### 5. 分类名称对照

| 参数名 | 中文名 | URL路径 |
|--------|--------|---------|
| `dianying` | 电影 | /type/dianying/ |
| `meiju` | 美剧 | /type/meiju/ |
| `gangju` | 港剧 | /type/gangju/ |
| `dongzuopian` | 动作片 | /type/dongzuopian/ |
| `xijupian` | 喜剧片 | /type/xijupian/ |
| `aiqingpian` | 爱情片 | /type/aiqingpian/ |
| `kehuanpian` | 科幻片 | /type/kehuanpian/ |
| `kongbupian` | 恐怖片 | /type/kongbupian/ |
| `juqingpian` | 剧情片 | /type/juqingpian/ |
| `zhanzhengpian` | 战争片 | /type/zhanzhengpian/ |
| `donghuapian` | 动画片 | /type/donghuapian/ |

## URL 规则

| 页面类型 | URL 格式 | 示例 |
|----------|----------|------|
| 首页 | `/` | https://www.mjwo.net/ |
| 分类列表(第1页) | `/type/{cat}/` | /type/meiju/ |
| 分类列表(分页) | `/type/{cat}-{page}/` | /type/meiju-2/ |
| 详情页 | `/vod/{id}/` | /vod/23042/ |
| 播放页 | `/play/{id}-{sid}-{ep}/` | /play/23042-1-1/ |

## 输出字段说明

| 字段 | 说明 |
|------|------|
| `id` | 影片唯一ID |
| `title` | 片名 |
| `year` | 年份 |
| `category_name` | 所属分类 |
| `douban_score` | 豆瓣评分 |
| `director` | 导演 |
| `actor` | 主演（多人用" / "分隔）|
| `type` | 类型（如：剧情 / 喜剧 / 爱情）|
| `area` | 地区/国家 |
| `language` | 语言 |
| `total_episodes` | 总集数 |
| `update_status` | 更新状态（HD高清 / 更新至N集 / N集全）|
| `cover` | 封面图URL |
| `url` | 详情页链接 |
| `description` | 剧情简介 |
| `episodes` | 播放列表（含每集名称、链接、源ID、集号）|
| `crawl_time` | 抓取时间 |

## 注意事项

1. **请遵守 robots.txt 与版权法规**：本工具仅用于学习研究，请勿用于商业用途或大规模侵犯版权
2. **控制并发与频率**：默认2线程+随机延迟，已能稳定运行；过高并发可能导致IP被封禁
3. **断点续爬**：中断后直接再次运行相同命令即可继续，已抓取ID保存在 `output/crawled_db.json`
4. **播放页加密**：该站播放页的视频地址是 MacCMS 动态加密的（JS解混淆），爬虫提取了原始加密数据（`encrypted_url`字段），如需获取m3u8直链，需配合浏览器JS环境解密
5. **数据增量**：删除 `output/crawled_db.json` 可强制重新抓取全部

## 运行示例

```
$ python mjwo_spider.py --mode all --categories meiju --max 20
============================================================
开始全站抓取，目标分类: ['美剧']
已爬取记录数: 0
============================================================
========== 开始抓取分类: 美剧 ==========
分类 [美剧] 共 288 页
  [美剧] 第 1/288 页，新增 42 条，累计 42
  已达到上限 25，停止翻页
列表收集完成，共 42 个不重复视频
测试模式，限制抓取 20 条
详情页进度: 20/20，成功: 20
JSON 已保存: output/movies_detail.json
CSV 已保存: output/movies_detail.csv
抓取完成！共获取 20 条详细数据
```
