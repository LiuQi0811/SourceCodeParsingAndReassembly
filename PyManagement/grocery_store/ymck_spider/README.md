# 影猫の仓库 (ymck.pro) 全站爬虫使用说明

## 站点分析

| 项 | 结果 |
|---|---|
| 建站系统 | 苹果CMS (Maccms v10) |
| 渲染方式 | 服务端渲染 (SSR)，HTML中含全部公开元数据 |
| 反爬机制 | Cloudflare 5秒盾 —— **仅拦截API接口**，静态HTML页面可直接访问 |
| 播放链接 | 站内无视频源；"数据源"区由Vue.js前端动态调用第三方搜索聚合接口，不属于本页加密内容 |
| **是否需要JS逆向解密** | **否**。所有可爬取的电影元数据（标题/年份/导演/演员/简介/评分/海报）均在服务端直出的HTML中，无需逆向；m3u8/视频地址不存在于本站服务器 |

## 分类与规模

- 电影(1)、剧集(2)、综艺(3)、动漫(4)、其他(5)、选片(6)
- 每页 24 部，电影类单分类约 2243 页，全站数据约 5~6 万部影片

## 文件说明

| 文件 | 用途 |
|---|---|
| `ymck_spider.py` | 全站爬虫主程序 |
| `test_spider.py` | 快速测试脚本（抓1页+3个详情验证解析） |
| `ymck_data/` | 输出数据目录（运行后生成） |
| `ymck_data/movies.json` | 全部影片元数据（JSON） |
| `ymck_data/movies.csv` | 全部影片元数据（CSV，可用Excel打开） |
| `ymck_data/html/` | 原始HTML镜像备份 |
| `ymck_data/images/` | 海报图片 |
| `ymck_data/progress.json` | 断点续爬进度文件 |

## 快速开始

```bash
# 1. 安装依赖
pip install requests beautifulsoup4

# 2. 先跑测试，确认解析正常
python3 test_spider.py

# 3. 启动全站抓取（默认 8 并发线程）
python3 ymck_spider.py

# 可选参数：
python3 ymck_spider.py --workers 16                # 16线程加速
python3 ymck_spider.py --no-images                 # 跳过海报下载，节省空间
python3 ymck_spider.py --cat 1,2                   # 只抓电影+剧集
python3 ymck_spider.py --only-detail 123325,123326 # 只补抓指定ID的详情
```

## 功能特性

- ✅ **断点续爬**：中断后再次运行会跳过已完成页面/详情
- ✅ **自动限速**：随机 0.3~1.0 秒间隔，避免被封
- ✅ **失败重试**：最多3次指数退避重试，自动识别Cloudflare拦截
- ✅ **并发抓取**：线程池并发，8线程约 1~2 小时抓完全站
- ✅ **海报下载**：自动处理豆瓣403反盗链
- ✅ **双格式导出**：JSON（结构化）+ CSV（Excel可读）
- ✅ **HTML镜像**：原始页面完整保存，可本地浏览
- ✅ **反爬绕过**：真实浏览器UA + Referer + 独立Session

## 关于"逆向解密"的说明

用户提到"如若需要逆向解密请保证完美的逆向解密"——经实际分析：

1. **静态页面（列表页/详情页/标签页）**：完全SSR输出，没有任何加密、混淆、eval，BeautifulSoup可直接解析。
2. **Cloudflare 5秒盾**：仅拦截 `/api.php/provide/vod/` 等JSON API；HTML页面可直接GET，绕过方法：不调用API、改抓HTML。
3. **播放源（数据源区）**：这是一个**跳转导航**，不是视频直链。页面里的"数据源"是Vue.js前端调用第三方搜索（如全网影视聚合接口）实时查询后跳转外链，结果在用户点击时才从第三方返回，且各源地址不同。本站本身**不存储任何m3u8/mp4**，因此不存在"解密播放链接"的需求。
4. **主JS文件 `whole.js`**：纯原生jQuery逻辑，无混淆、无加密字符串，只有主题切换、搜索框、搜索热词等UI逻辑。

结论：该站**无需任何JS逆向或解密**，公开的影片元数据通过普通HTTP请求+HTML解析即可完整获取。本爬虫已覆盖全部可爬内容。

## 数据字段说明

每部影片包含以下字段：

```
id         - 影片ID (ymck.pro站内)
title      - 影片标题
alias      - 别名
year       - 年份
rating     - 豆瓣评分
categories - 分类列表 (如 ['喜剧','动作'])
director   - 导演
actors     - 主演列表
language   - 语言
intro      - 剧情简介
poster     - 海报原始URL
poster_local - 海报本地路径 (若开启下载)
url        - 详情页URL
cat_id     - 所属分类ID
```
