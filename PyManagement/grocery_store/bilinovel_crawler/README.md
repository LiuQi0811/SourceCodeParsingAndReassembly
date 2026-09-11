# 哔哩轻小说(bilinovel.com)全站爬虫 - 完美逆向解密版

## 简介

这是一个专门为哔哩轻小说(www.bilinovel.com，原www.linovelib.com)开发的全站爬虫工具，**包含完整的逆向解密实现**，能够完美还原被网站打乱的章节段落顺序。

## ✨ 核心特性

- 🔓 **完美逆向解密**：完整实现chapterlog.js段落乱序还原算法，支持普通版和混淆版两种加密方式
- 📚 **完整功能**：支持小说信息抓取、目录解析、多页章节自动拼接、插图下载
- 📖 **多格式导出**：支持TXT纯文本和标准EPUB电子书格式
- 🖼️ **图片下载**：自动下载小说封面、卷封面、章节插图
- 🚀 **全站爬取**：支持批量爬取网站分类下的所有小说
- ⚡ **智能限流**：内置请求间隔和重试机制，避免被封禁
- 📱 **移动端模拟**：使用移动端UA，提高成功率

## 🔐 解密算法说明

网站使用`chapterlog.js`对章节正文段落进行Fisher-Yates洗牌乱序处理，采用LCG(线性同余生成器)作为随机数源：

`LCG公式: seed = (seed * a + c) % mod`

解密过程：

1. 动态加载并解析`chapterlog.js`，提取加密参数（支持代码混淆后的参数提取）
2. 根据章节ID计算初始种子：`seed = chapterId * seedMultiplier + seedOffset`
3. 前N个段落(`fixedLength`，默认20)固定不动
4. 对剩余段落模拟正向洗牌过程，建立逆映射还原正确顺序
5. 非段落元素（如插图、分隔符）保持原有位置不变

本工具100%还原了该算法，解密效果与原网站JavaScript渲染完全一致。

## 🚀 快速开始

### 1. 安装依赖

`pip install -r requirements.txt`

### 2. 使用方法

命令行模式

`# 下载单本小说`\
`python bilinovel_crawler.py -u https://www.bilinovel.com/novel/1234.html`\
`# 或直接使用小说ID`\
`python bilinovel_crawler.py -u 1234`\
\
`# 爬取全站小说`\
`python bilinovel_crawler.py -a -p 1 -m 100`\
\
`# 快速模式+仅TXT格式+不下载图片`\
`python bilinovel_crawler.py -u 1234 --fast --txt-only --no-image`

参数说明

| 参数 | 说明 |
| --- | --- |
| `-u, --url` | 小说URL或ID |
| `-a, --all` | 爬取全站所有小说 |
| `-p, --page` | 全站爬取起始页码，默认1 |
| `-m, --max` | 最大爬取小说数量，0=不限制 |
| `--no-image` | 不下载插图 |
| `--txt-only` | 仅保存TXT格式(不生成EPUB) |
| `--fast` | 快速模式，减少请求延迟 |

交互模式

直接运行程序进入交互模式：

`python bilinovel_crawler.py`

然后按照菜单提示操作即可。

代码调用

`from bilinovel_crawler import BiliNovelCrawler`\
\
`# 创建爬虫实例`\
`crawler = BiliNovelCrawler({`\
`    'download_images': True,`\
`    'output_format': ['txt', 'epub'],`\
`    'request_delay_min': 1.0,`\
`    'request_delay_max': 3.0`\
`})`\
\
`# 下载单本小说`\
`novel = crawler.download_novel('https://www.bilinovel.com/novel/1234.html')`\
\
`# 全站爬取`\
`# crawler.crawl_all(start_page=1, max_novels=50)`

## 📁 输出目录结构

`bilinovel_downloads/`\
`└── 小说标题/`\
`    ├── meta.json              # 小说元数据`\
`    ├── cover.jpg              # 小说封面`\
`    ├── 小说标题.txt           # 整本TXT`\
`    ├── 小说标题.epub          # EPUB电子书`\
`    ├── images/                # 所有插图`\
`    │   ├── vol1_chap1/`\
`    │   │   ├── 001.jpg`\
`    │   │   └── 002.jpg`\
`    │   └── ...`\
`    ├── 第一卷/`\
`    │   ├── 0001_序章.txt      # 单章TXT`\
`    │   ├── 0002_第一章.txt`\
`    │   └── ...`\
`    └── 第二卷/`\
`        └── ...`

## ⚙️ 配置说明

可以通过修改代码开头的`CONFIG`字典调整配置：

`CONFIG = {`\
`    'domain': 'https://www.bilinovel.com',  # 也可改为 https://www.linovelib.com`\
`    'request_timeout': 30,                   # 请求超时时间(秒)`\
`    'request_delay_min': 1.0,                # 最小请求间隔(秒)`\
`    'request_delay_max': 3.0,                # 最大请求间隔(秒)`\
`    'max_retries': 3,                        # 最大重试次数`\
`    'download_images': True,                 # 是否下载插图`\
`    'output_format': ['txt', 'epub'],        # 输出格式`\
`    'save_dir': './bilinovel_downloads',     # 保存目录`\
`    'crawl_all': False,                      # 是否全站爬取`\
`    'max_novels': 0,                         # 最大爬取小说数(0=不限制)`\
`}`

## 🔧 技术细节

### 反爬应对策略

1. **User-Agent轮换**：支持随机UA，默认使用移动端Chrome UA
2. **请求限流**：随机延迟请求，避免触发频率限制
3. **自动重试**：遇到网络错误自动重试，支持指数退避
4. **会话保持**：使用Cookie保持会话状态
5. **脚本缓存**：chapterlog.js解析结果缓存，避免重复请求

### 解密模块核心类

- `ExpressionEvaluator`: JavaScript表达式解析器，用于计算混淆后的加密参数
- `BiliNovelDecryptor`: 核心解密器，支持普通版和混淆版chapterlog.js解析
- `BiliNovelCrawler`: 爬虫主类，实现完整的抓取-解密-导出流程

## ⚠️ 免责声明

本工具仅供学习交流使用，请遵守相关法律法规和网站robots协议：

- 请勿用于商业用途
- 请控制爬取频率，避免对网站服务器造成压力
- 下载的内容请勿随意传播，请支持正版
- 如侵犯了您的权益，请联系删除

## 📝 更新日志

### v1.0 (2026-09-11)

- ✅ 完整实现chapterlog.js逆向解密算法，支持普通版和混淆版
- ✅ 小说基本信息、目录、章节内容抓取
- ✅ 自动多页拼接
- ✅ 图片下载与本地路径替换
- ✅ TXT和EPUB格式导出
- ✅ 全站爬取功能
- ✅ 智能限流与错误重试