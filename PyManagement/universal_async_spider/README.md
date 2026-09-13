# 通用异步全站爬虫 Universal Async Spider

一个**生产级**的 Python 异步全站爬虫框架，开箱即用，内置：

| 特性 | 说明 |
|------|------|
| ⚡ **异步高并发** | 基于 `aiohttp`，默认 20 并发，支持自定义 |
| 📊 **实时进度条** | `tqdm` 实时显示成功/失败/速率/速度/最近一页 |
| 🏛️ **设计模式** | 工厂模式 + 策略模式 + 单例模式 + 观察者模式 |
| 🔁 **智能重试** | 指数退避 + 状态码重试（429/5xx），默认 5 次 |
| 💾 **断点续传** | JSON 状态文件持久化，`Ctrl+C` 中断后下次自动恢复 |
| 🔐 **逆向解密** | 内置 Base64 / AES-CBC(PKCS7) / JSON包裹 自动解密；支持注册自定义 JS 解密器 |
| 🎭 **反爬友好** | 随机 UA、随机抖动延迟、代理、Cookie、自定义 Header |
| 🗂️ **镜像保存** | 按域名+原路径保存 HTML，URL 自动映射为本地文件 |

---

## 一、快速安装

```bash
cd universal_async_spider
pip install -r requirements.txt
```

---

## 二、一行命令开始爬

```bash
# 最简用法
python -m universal_async_spider https://books.toscrape.com/

# 指定并发、间隔、深度、输出目录
python -m universal_async_spider https://example.com -c 50 --delay 0.2 -o ./my_site --depth 8

# 使用代理 + AES 解密（逆向场景）
python -m universal_async_spider https://encrypted.example.com \
    --proxy http://127.0.0.1:7890 \
    --decryption aes --key "0123456789abcdef0123456789abcdef" --iv "abcdef9876543210"

# 跳过 SSL 校验（自签证书网站）
python -m universal_async_spider https://self-signed.badssl.com --no-verify-ssl

# 禁用断点续传，从零开始
python -m universal_async_spider https://example.com --no-resume
```

---

## 三、代码方式调用

```python
from universal_async_spider import Config, UniversalSpider

cfg = Config(
    start_urls=["https://books.toscrape.com/"],
    output_dir="./books",
    concurrency=30,
    delay=0.2,
    max_depth=10,
    max_retries=5,
    resume=True,
)
UniversalSpider(cfg).run()
```

运行完毕后，`./books/` 目录下会按网站原路径层级保存所有 HTML，失败链接记录在 `failed_urls.txt`。

---

## 四、命令行参数全览

| 参数 | 默认 | 说明 |
|------|------|------|
| `url` | 必填 | 起始 URL，多个用逗号分隔 |
| `-d/--domain` | 自动 | 允许域名，可多次指定（未指定则只爬起始域名） |
| `-o/--output` | `output` | 输出目录 |
| `-c/--concurrency` | `20` | 并发协程数 |
| `--delay` | `0.3` | 请求基础间隔（秒），实际会随机抖动 0.5~1.5 倍 |
| `--depth` | `10` | 最大抓取深度 |
| `--retries` | `5` | 最大重试次数 |
| `--timeout` | `30` | 单次请求超时（秒） |
| `--proxy` | 无 | HTTP/HTTPS 代理 |
| `--user-agent` | 随机 | 自定义 UA |
| `--decryption` | `auto` | `auto/none/aes/base64/json` |
| `--key` / `--iv` | 无 | AES 解密的密钥与 IV |
| `--no-resume` | 关 | 忽略已有断点状态，从头开始 |
| `--no-verify-ssl` | 关 | 跳过 SSL 证书校验 |

---

## 五、断点续传机制

- 运行时会在当前目录维护 `.spider_state.json`，实时记录：
  - `visited`：已成功下载的 URL
  - `queued`：已发现但尚未处理的 URL
  - `failed`：重试全部失败的 URL
- `Ctrl+C` 中断或程序崩溃后，**再次运行同一条命令**即可自动从断点继续，不会重复下载。
- 如果想重新开始：删除 `.spider_state.json`，或加 `--no-resume` 参数。

---

## 六、逆向解密（高级用法）

### 6.1 内置策略

| 策略名 | 适用场景 |
|--------|---------|
| `noop` | 普通明文 HTML（默认） |
| `base64` | 响应为纯 Base64 编码的 HTML/JSON |
| `aes` | AES-CBC/PKCS7 加密（最常见的接口加密） |
| `json` | 形如 `{"code":0,"data":"<加密内容>"}` 的包裹响应 |

`auto` 模式下会自动嗅探 `base64` 和 `json` 两种；`aes` 需要你提供密钥后显式开启。

### 6.2 自定义 JS 逆向解密

如果你需要执行网站的 JS 来还原内容（如混淆过的 `__jsl_clearance`、`webpack` 打包等），只需继承 `Decryptor` 并注册：

```python
import execjs
from universal_async_spider.decryptor import Decryptor, DecryptorFactory

class JSDecryptor(Decryptor):
    name = "site_js"
    def __init__(self):
        self.ctx = execjs.compile(open("site_crypto.js").read())
    def match(self, content, headers, url):
        return True   # 或根据特征判断
    def decrypt(self, content, key=None, iv=None):
        return self.ctx.call("decryptResponse", content.decode()).encode()

DecryptorFactory.register("site_js", JSDecryptor())
# 然后在 Config 中设置 decryption="site_js"
```

完整示例见 `examples/example_custom_decryptor.py`。

---

## 七、设计模式说明

| 模式 | 位置 | 作用 |
|------|------|------|
| **工厂模式** | `DecryptorFactory`、`Downloader` | 解耦对象创建，运行时灵活切换策略 |
| **策略模式** | `decryptor.py` 中各 `Decryptor` 子类 | 新增解密算法不改主流程，只需新增一个类并注册 |
| **单例模式** | `setup_logger()` | 全局复用同一个 logger，避免重复 Handler |
| **观察者模式** | `Progress` 组件 | 下载事件驱动进度条更新，便于扩展其他监听 |

---

## 八、目录结构

```
universal_async_spider/
├── __init__.py            # 包入口
├── __main__.py            # CLI 入口 (python -m universal_async_spider)
├── config.py              # 配置类
├── downloader.py          # 异步下载器 (aiohttp + 重试 + 代理 + 随机UA)
├── parser.py              # HTML 链接解析 (BeautifulSoup/lxml)
├── decryptor.py           # 解密/逆向策略引擎 (策略+工厂)
├── state.py               # 断点续传状态管理 (JSON)
├── progress.py            # tqdm 进度条 + 实时统计
├── spider.py              # 主爬虫调度核心
├── utils.py               # 工具函数
├── requirements.txt       # 依赖
├── README.md              # 本文件
└── examples/
    ├── example_basic.py               # 基础示例
    ├── example_aes.py                 # AES 解密示例
    └── example_custom_decryptor.py    # 自定义 JS 逆向示例
```

---

## 九、常见问题

**Q: 如何登录后爬取？**
A: 在 `Config.cookies` 里填入浏览器复制的 Cookie 字符串即可；若更复杂，可在 `Config.headers` 中带上 `Authorization` 等字段。

**Q: 如何爬取需要 JS 渲染的页面（如 Vue/React SPA）？**
A: 本框架专注 HTTP 抓取，JS 渲染建议结合 `playwright` 或 `pyppeteer` 自定义一个下载器替换 `Downloader`（继承后重写 `fetch` 方法）。

**Q: 如何爬取图片/CSS/JS 等静态资源？**
A: 将 `Config.save_resources=True`，并在 `allowed_exts` 中加入对应的扩展名（如 `.jpg`, `.png`, `.css`, `.js`）。

**Q: 被封 IP 怎么办？**
A: 调小 `concurrency`、加大 `delay`，或配置代理池 `proxy`；必要时自定义 Middleware 轮换代理。

---

## 十、法律声明

本工具仅供**学习研究**及抓取**自身拥有版权/已授权**的网站使用。请遵守目标网站的 `robots.txt` 及当地法律法规，使用者自行承担使用责任。
