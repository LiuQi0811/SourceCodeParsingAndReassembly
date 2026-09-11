# 搬书匠 (banshujiang.cn) 全站爬虫

## 功能特性

- ✅ **全站爬取**: 自动爬取所有电子书列表页和详情页
- ✅ **元数据提取**: 书名/作者/出版年份/语言/分类/出版社/完整简介
- ✅ **封面下载**: 自动下载所有书籍封面图片
- ✅ **下载链接提取**: 提取所有格式（PDF/EPUB/MOBI等）的网盘下载链接
- ✅ **断点续爬**: 中途停止后再次运行自动从断点继续
- ✅ **多线程并发**: 支持多线程加速爬取
- ✅ **防封策略**: 随机UA、随机延时、失败重试
- ✅ **双格式导出**: JSON + CSV 两种数据格式保存
- ✅ **无加密逆向**: 经实测该站为纯服务端渲染(SSR)，无JS加密、无字体反爬、无sign签名，直接HTTP请求即可获取完整数据

## 网站逆向分析结论

经实地分析 http://www.banshujiang.cn/ ：

| 项目 | 结论 |
|------|------|
| 渲染方式 | 服务端渲染(SSR)，HTML一次性返回完整数据 |
| JS加密 | ❌ 无，无webpack混淆、无动态sign签名 |
| 字体反爬 | ❌ 无，文字直接在HTML中 |
| Cookie/token | ❌ 无强制验证，不需要登录即可访问全部书籍信息 |
| 数据接口 | 纯静态HTML，无需调用XHR/API接口 |
| 下载链接 | 形式为 `/e_books/{id}/webstorage_links/{link_id}/to_link`，直接302跳转到城通网盘等第三方网盘 |

**说明**：电子书文件本身存储在城通网盘等第三方网盘平台，网盘侧的文件下载需要人工通过浏览器完成（含验证码/广告倒计时等机制），本爬虫负责抓取搬书匠站内全部书籍元数据及网盘跳转链接。

## 目录结构

```
banshujiang_data/
├── books.json        # 完整书籍数据(JSON格式)
├── books.csv         # 表格格式(可用Excel打开)
├── progress.json     # 爬取进度(断点续传用)
└── covers/           # 封面图片目录
    ├── 5318.jpeg
    ├── 5317.jpeg
    └── ...
```

## 快速开始

### 1. 安装依赖

```bash
pip install -r requirements.txt
```

### 2. 运行爬虫

**爬取全站全部内容**（约5300本书，266页）：
```bash
python banshujiang_spider.py
```

**指定页码范围**：
```bash
# 只爬第1到第10页
python banshujiang_spider.py --start 1 --end 10
```

**设置并发线程数**（默认3线程）：
```bash
python banshujiang_spider.py --threads 5
```

**不下载封面图片**（只抓元数据和链接）：
```bash
python banshujiang_spider.py --no-image
```

**查看爬取统计**：
```bash
python banshujiang_spider.py --stats
```

### 3. 命令行参数说明

| 参数 | 说明 | 默认值 |
|------|------|--------|
| `--start N` | 起始页码 | 1 |
| `--end N` | 结束页码(不指定则自动探测到最后一页) | None |
| `--threads N` | 并发线程数 | 3 |
| `--no-image` | 跳过封面图片下载 | False |
| `--stats` | 只显示统计信息不爬取 | False |

## 数据字段说明

每本书籍包含以下字段：

```json
{
  "id": "5318",                    // 书籍ID
  "title": "Visualizing Gene...",  // 书名
  "author": "Priyanka Vergadia...",// 作者
  "language": "英文",              // 语言
  "year": "2025",                  // 出版年份
  "publisher": "O'Reilly Media",   // 出版社
  "category": "人工智能",          // 分类
  "cover_url": "http://image.banshujiang.cn/5318.jpeg",  // 封面原图URL
  "cover_local": "banshujiang_data/covers/5318.jpeg",    // 封面本地路径
  "detail_url": "http://www.banshujiang.cn/e_books/5318",// 详情页URL
  "download_links": [              // 下载链接列表
    {
      "type": "PDF",               // 文件格式
      "name": "城通网盘",           // 网盘名称
      "url": "http://www.banshujiang.cn/e_books/5318/..."// 跳转链接
    }
  ],
  "summary_text": "书籍摘要...",    // 纯文本简介
  "summary_html": "<div>...",       // HTML格式简介(保留排版)
  "crawl_time": "2026-09-11T..."   // 爬取时间
}
```

## 使用下载链接

爬取到的 `download_links` 中的URL形如：
```
http://www.banshujiang.cn/e_books/5318/webstorage_links/24917/to_link
```

使用方式：
1. 将链接复制到浏览器中打开
2. 网站会自动302跳转到对应的城通网盘页面
3. 在网盘页面按提示下载文件（部分网盘可能需要看广告或输入验证码）

## 断点续爬说明

爬虫每次成功爬取一页/一本书后都会立即保存进度到 `progress.json`：
- 如果中途中断（Ctrl+C、网络故障等），再次运行相同命令会自动跳过已爬内容
- 若需要完全重新爬取，删除 `banshujiang_data` 目录即可

## 注意事项

1. **合理使用**：爬取时请保持适当延时，不要对网站服务器造成过大压力
2. **版权说明**：搬书匠书籍均收集自互联网，仅供学习研究使用，请勿用于商业用途
3. **网盘下载**：实际电子书文件在第三方网盘，需手动通过浏览器下载，网盘有自己的访问规则
4. **爬取时间**：全站5300余本书，3线程约需1.5~2小时完成
