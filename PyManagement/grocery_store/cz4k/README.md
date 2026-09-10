# cz4k.com 全站爬虫

## 文件说明

| 文件 | 说明 |
| --- | --- |
| `cz4k_crawler.py` | **推荐使用** - 基于 Playwright 无头浏览器，自动渲染 JS，绕过雷池WAF检测，支持断点续爬、并发控制、静态资源保存 |
| `cz4k_simple_crawler.py` | 轻量版本，基于 requests + BeautifulSoup，无需浏览器，适合无WAF或简单页面 |
| `requirements.txt` | Python依赖包 |

## 快速开始

### 1. 安装依赖

`pip install -r requirements.txt`\
`playwright install chromium`

### 2. 运行爬虫（推荐Playwright版本）

`python cz4k_crawler.py`

### 3. 运行轻量版本

`python cz4k_simple_crawler.py`

## 功能特性

### Playwright 版本特性

- ✅ 自动绕过雷池WAF JS检测
- ✅ 无头浏览器渲染完整页面（含JS动态内容）
- ✅ BFS广度优先遍历全站
- ✅ 断点续爬（中断后再次运行自动继续）
- ✅ 自动限速随机延时，模拟人类访问
- ✅ 并发数可配置
- ✅ 完整保存HTML到本地
- ✅ URL自动转换为本地文件路径
- ✅ 自动处理重定向
- ✅ 日志记录到 crawler.log

### 可配置参数（cz4k_crawler.py 头部）

`MAX_DEPTH = 10              # 最大爬取深度`\
`MAX_CONCURRENT = 3          # 并发浏览器数`\
`MIN_DELAY = 1.0             # 最小延时秒`\
`MAX_DELAY = 3.0             # 最大延时秒`\
`SAVE_STATIC = True          # 保存静态资源`\
`PROXY = None                # 代理，例 "http://127.0.0.1:7890"`

## 输出目录结构

`cz4k_site/`\
`├── index.html              # 首页`\
`├── about/`\
`│   └── index.html          # 关于页`\
`├── static/`\
`│   ├── css/`\
`│   ├── js/`\
`│   └── images/`\
`└── ...`\
\
`crawler_state.json          # 断点续爬状态文件（不要删除）`\
`crawler.log                 # 爬取日志`

## 注意事项

1. **遵守robots.txt和网站规定**：本代码仅供学习研究使用，请勿用于非法用途
2. **控制爬取频率**：默认已添加随机延时，不要设置过小的DELAY
3. **WAF说明**：该网站使用长亭雷池WAF，如果遇到拦截会自动等待JS解密后再抓取内容
4. **断点续爬**：随时按 Ctrl+C 中断，下次运行自动从断点继续
5. **如果被拦截**：可以适当增大延时，或设置 `headless=False` 显示浏览器窗口人工过验证

## 常见问题

**Q: 提示 WAF 拦截**？A: 使用 Playwright 版本，它会自动等待WAF JS验证完成。如果仍然拦截，可以把 `headless=True` 改成 `headless=False` 手动过验证。

**Q: 如何只爬取某个目录**？A: 修改 `is_same_domain` 函数，添加路径判断即可。

**Q: 如何爬取需要登录的页面**？A: 在浏览器上下文中添加Cookie，或设置 `headless=False` 手动登录后继续爬取。