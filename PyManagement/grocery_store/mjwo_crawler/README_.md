# 美剧窝 (mjwo.net) 全站爬虫（含 m3u8 直链解密）

针对 https://www.mjwo.net/ 网站（基于 MacCMS v10 苹果CMS模板）开发的全站爬虫工具，支持破解播放混淆、直接获取 m3u8 视频直链。

## 功能特性

- ✅ **全部分类抓取**：支持美剧、电影、港剧、动作片、喜剧片、爱情片、科幻片、恐怖片、剧情片、战争片、动画片等所有频道
- ✅ **自动翻页**：自动识别最大页数，按分类分页爬取
- ✅ **详情字段完整**：标题、年份、地区、类型、豆瓣评分、导演、主演、简介、封面、更新状态
- ✅ **播放列表提取**：每部影片所有集数/播放源的链接
- ✅ **🔓 播放混淆破解**：解密 player_aaaa 中的加密视频ID，直接获取真实 m3u8 播放直链
- ✅ **多线路支持**：每集解析出 6 条不同 CDN 线路的 m3u8 直链
- ✅ **整部剧批量解析**：一条命令解析整部剧所有集的 m3u8 直链，导出 m3u8 列表文件
- ✅ **多线程支持**：可配置并发数（默认2线程，避免给服务器造成压力）
- ✅ **断点续爬**：已爬取的视频ID会记录在 `crawled_db.json`，中断后再次运行自动跳过
- ✅ **双格式导出**：同时导出 JSON（完整结构化数据）和 CSV（Excel友好）
- ✅ **增量保存**：每20条自动保存一次，防止意外中断数据丢失
- ✅ **多种模式**：全站爬、仅列表、单条测试、播放页解析、m3u8 直链解析、整部剧批量解析
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

# 全站抓取同时解析每部剧第1集的m3u8直链（较慢）
python mjwo_spider.py --mode all --categories meiju --max 10 --with-m3u8
```

### 5. 🔓 m3u8 直链破解（核心功能）

#### 5.1 解析单集的 m3u8 直链

```bash
# 通过播放页URL
python mjwo_spider.py --mode resolve --url https://www.mjwo.net/play/23042-1-1/

# 通过播放ID格式 23042-1-1 (vid-sid-ep)
python mjwo_spider.py --mode resolve --url 23042-1-1
```

输出示例：
```
✓ 成功破解，获取到 6 条 m3u8 直链：
  [线路 1] https://six.svipplay.com/lzm3u8/xxx.m3u8?token=xxx&expires=xxx
  [线路 2] https://cdn.yzzyvip-29.com/xxx/index.m3u8
  [线路 3] https://vv.jisuzyv.com/play/xxx/index.m3u8
  ...
```

#### 5.2 批量解析整部剧所有集的 m3u8 直链

```bash
# 通过影片ID
python mjwo_spider.py --mode resolve-all --url 23042

# 通过详情页URL
python mjwo_spider.py --mode resolve-all --url https://www.mjwo.net/vod/23042/
```

输出文件：
- `output/m3u8_{vid}.json` — 完整结构化数据（含6条线路的所有m3u8）
- `output/m3u8_{vid}_list.txt` — 纯列表（集名 + 主线路m3u8，每行一条，方便导入下载工具）

#### 5.3 破解原理说明

网站播放器流程：
1. 播放页 `player_aaaa.url` 中存放一个加密视频ID（如 `CODE2MDlfMGp1aGU=`）
2. `encrypt=0` 表示不加密，但该ID不是真实地址，而是第三方聚合API的参数
3. 播放器通过 iframe 加载 `edge.apiimg.com/super.php?id=xxx`
4. 该API返回的 HTML 中 `window.PLAYER_CONFIG.lineList` 包含 6 条真实 m3u8 直链

爬虫直接请求该聚合API并提取 `lineList`，即可拿到所有线路的视频播放源地址。

> **注意**：线路1通常带 token + expires 时效（约几小时），线路2-6多为永久直链；爬虫默认选取线路2作为 `direct_m3u8`。

### 6. 分类名称对照

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
