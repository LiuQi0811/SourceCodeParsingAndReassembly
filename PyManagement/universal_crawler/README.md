# 通用全站异步爬虫框架

一个功能完整、高度可配置的通用全站爬虫，支持多种抓取和解析模式，内置自动重试、断点续传、JS逆向解密能力。

## ✨ 核心特性

| 特性 | 说明 |
|------|------|
| 🚀 **异步高并发** | 基于 aiohttp 的全异步架构，高性能抓取 |
| 📊 **进度条显示** | tqdm 实时显示爬取和下载进度 |
| 🎯 **策略设计模式** | 抓取模式/解析模式可自由切换，易扩展 |
| 🔄 **自动重试** | 指数退避重试机制，网络波动自动恢复 |
| ⏸️ **断点续传** | 定期自动保存进度，异常终止后可从中断处恢复 |
| 🕷️ **两种抓取模式** | 内存队列模式 / 边爬边下模式，按需选择 |
| 🔍 **三种解析模式** | BeautifulSoup4 / XPath / 正则表达式，随意切换 |
| 🔐 **JS逆向解密** | 内置Base64/AES/RSA解密、Eval混淆检测 |
| 🌐 **反爬绕过** | User-Agent轮换、代理支持、请求间隔随机化 |
| 📁 **资源下载** | 自动下载图片、CSS、JS、视频等所有静态资源 |

## 🚀 快速开始

### 1. 安装依赖

```bash
pip install -r requirements.txt
```

依赖清单：
- `aiohttp` - 异步HTTP客户端
- `aiofiles` - 异步文件IO
- `tqdm` - 进度条
- `lxml` - XPath解析
- `beautifulsoup4` - HTML解析
- `fake-useragent` - UA轮换
- `pycryptodome` - 加密解密（用于JS逆向）

### 2. 基础使用

```python
import asyncio
from universal_crawler import UniversalCrawler

async def main():
    crawler = UniversalCrawler(
        start_url='https://example.com',    # 目标网站
        output_dir='./output',              # 保存目录
        crawl_mode='stream',                # 抓取模式: memory/stream
        parse_mode='bs4',                   # 解析模式: bs4/xpath/regex
        concurrency=15,                     # 并发数
    )
    await crawler.start()

asyncio.run(main())
```

### 3. 命令行直接运行

修改 `universal_crawler.py` 末尾 `main()` 函数中的 `start_url`，然后执行：

```bash
python universal_crawler.py
```

## 🎮 模式详解

### 两种抓取模式

#### 1. 内存队列模式 (`crawl_mode='memory'`)
- **工作流程**：第一阶段遍历全站收集所有URL，第二阶段统一批量下载
- **优点**：先摸清全站结构再下载，URL去重最彻底
- **缺点**：前期有等待时间，大型站点可能占用较多内存
- **适用场景**：中小型网站、需要完整站点地图、需要统计全站URL数量

#### 2. 边爬边下模式 (`crawl_mode='stream'`)
- **工作流程**：爬取到URL立即加入下载队列，爬取和下载同时进行
- **优点**：即时下载，内存占用小，大文件边爬边出结果
- **缺点**：URL发现和下载并行，无法提前获知总进度
- **适用场景**：大型网站、立即需要下载结果、资源较多的站点

### 三种解析模式

#### 1. BeautifulSoup模式 (`parse_mode='bs4'`)
- **优点**：语法友好、容错性强、API直观易上手
- **缺点**：速度相对较慢
- **适合场景**：简单页面提取、快速开发、不规范HTML

#### 2. XPath模式 (`parse_mode='xpath'`)
- **优点**：速度快、表达能力强、定位精准
- **缺点**：语法相对复杂，对HTML规范性有一定要求
- **适合场景**：结构化数据提取、需要精确定位元素

#### 3. 正则模式 (`parse_mode='regex'`)
- **优点**：速度最快、不依赖HTML结构、可提取任意文本
- **缺点**：复杂场景易写出难以维护的表达式
- **适合场景**：JS混淆页面、非标准HTML、特殊格式内容提取

### 运行时切换模式

```python
# 中途切换抓取模式
crawler.switch_crawl_mode('memory')  # 或 'stream'

# 中途切换解析模式
crawler.switch_parse_mode('xpath')   # 或 'bs4', 'regex'
```

## ⚙️ 完整配置参数

```python
crawler = UniversalCrawler(
    # 基础配置
    start_url='https://example.com',      # 起始URL（必填）
    output_dir='./crawler_output',        # 输出目录
    crawl_mode='stream',                  # 抓取模式: memory/stream
    parse_mode='bs4',                     # 解析模式: bs4/xpath/regex
    
    # 性能配置
    concurrency=10,                       # 并发数
    max_retries=3,                        # 失败最大重试次数
    retry_delay=1.0,                      # 重试基础延迟（指数退避）
    delay=0.5,                            # 请求间隔（秒）
    timeout=30,                           # 单次请求超时（秒）
    
    # 爬取范围
    allowed_domains=['example.com'],      # 允许爬取的域名列表（默认仅起始域名）
    download_resources=True,              # 是否下载静态资源
    save_html=True,                       # 是否保存HTML页面
    
    # 反爬配置
    user_agents=[...],                    # 自定义UA列表，为空则自动随机
    proxies=[                             # 代理列表
        'http://proxy1:port',
        'http://proxy2:port'
    ],
    
    # 断点续传
    resume=True,                          # 是否启用断点续传
    
    # 自定义解密
    custom_decryptor=my_decrypt_func      # 自定义内容解密函数
)
```

## 🔐 JS逆向解密

框架内置常见加密场景的解密能力：

### 自动检测的加密类型
- ✅ Base64 编码/解码
- ✅ AES-128/256-CBC/ECB 解密
- ✅ RSA 私钥解密
- ✅ Dean Edwards Packer eval 混淆检测
- ✅ 常见JS混淆检测（sojson、_0x变量名混淆等）
- ✅ URL加密参数自动解密

### 自定义解密器

针对特定网站的自定义加密，可以传入自定义解密函数：

```python
def my_custom_decrypt(html: str, url: str) -> str:
    """自定义解密逻辑"""
    # 示例：解密特定格式的加密内容
    if 'encrypted_data' in html:
        # 你的解密逻辑
        pass
    return html

crawler = UniversalCrawler(
    start_url='https://example.com',
    custom_decryptor=my_custom_decrypt
)
```

### 逆向扩展说明
对于强JS渲染、复杂签名、Cookie反爬等场景，建议配合以下方案：
- 动态渲染：集成 Playwright/Selenium 执行JS
- 签名算法：提取JS中的加密逻辑复写
- Cookie池：使用 `proxies` 参数接入代理Cookie池

## 📂 输出目录结构

```
crawler_output/
├── example.com/                    # 按域名分类
│   ├── index.html                  # 首页
│   ├── about/
│   │   └── index.html              # 关于页
│   ├── assets/
│   │   ├── css/
│   │   │   └── style.css           # 样式文件
│   │   ├── js/
│   │   │   └── main.js             # JS文件
│   │   └── images/
│   │       └── logo.png            # 图片资源
├── failed_urls.txt                 # 下载失败的URL列表（爬取结束后生成）
└── .crawler_checkpoint.pkl         # 断点文件（自动生成）
```

## ⏸️ 断点续传使用说明

1. 爬虫运行中每30秒自动保存一次断点
2. 遇到 Ctrl+C 中断或程序异常退出，会自动保存当前进度
3. 下次运行相同配置（`output_dir` 相同）时，自动从断点处继续
4. 已下载的文件不会重复下载，已访问过的URL不会重复爬取

```bash
# 中断后重新运行，自动续传
python universal_crawler.py
```

## ⚠️ 使用注意事项

1. **遵守robots协议**：请遵守目标网站的 `robots.txt` 规定，合理设置爬取频率
2. **控制并发数**：小型网站建议并发数设置为 5-10，避免对目标服务器造成压力
3. **设置请求延迟**：建议 `delay` 参数不小于 0.3 秒
4. **法律合规**：请勿用于非法用途，爬取内容请遵守相关法律法规
5. **代理使用**：遇到IP封禁时请配置代理池轮换

## 📝 高级扩展示例

### 只爬取特定路径
```python
def _is_allowed_url(self, url):
    if '/news/' not in url:
        return False
    return super()._is_allowed_url(url)
```

### 自定义内容提取
```python
# 爬取完成后用解析器提取内容
parser = BS4Parse()
with open('page.html', 'r', encoding='utf-8') as f:
    content = parser.parse_content(f.read(), selectors={
        'titles': 'h1.title',
        'dates': '.publish-date',
        'authors': '.author-name'
    })
    print(content['titles'])
```

## 🐛 常见问题

**Q: 为什么有些页面爬不到？**
- 可能是JS动态渲染页面，需要集成Playwright等浏览器渲染方案
- 可能有反爬机制，尝试配置代理、降低并发、增加延迟

**Q: 断点续传不生效？**
- 确保两次运行使用相同的 `output_dir`
- 确保程序有目录写入权限

**Q: pycryptodome安装失败？**
- Windows: `pip install pycryptodomex`
- Linux: 先安装 `sudo apt-get install python3-dev` 再pip安装

**Q: 中文乱码怎么办？**
- 框架已自动处理UTF-8编码，若遇特殊编码可自定义 `_fetch_with_retry` 方法中的编码检测
