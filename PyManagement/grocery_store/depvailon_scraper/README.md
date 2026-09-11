# Depvailon.com 全站抓取工具

针对 https://www.depvailon.com/ 的全站爬取与逆向解密工具集。
该站点使用 **Cloudflare CDN** 保护，工具内置了 Cloudflare 5秒盾 / Turnstile 自动绕过、JS 动态渲染内容解密、静态资源本地化下载等功能。

---

## 📁 文件结构

```
depvailon_scraper/
├── scraper.py          # 主爬虫：全站递归抓取 + CF绕过 + 资源下载
├── decryptor.py        # 独立解密工具：CF邮箱/AES/XOR/Base64/状态提取
├── requirements.txt    # Python 依赖
├── README.md           # 本说明
├── scraper.log         # 运行日志（运行后生成）
├── .crawl_state.json   # 断点续爬状态（运行后生成）
└── depvailon_site/     # 站点镜像输出目录（运行后生成）
```

---

## 🚀 快速开始

### 1. 安装依赖

```bash
cd depvailon_scraper
pip install -r requirements.txt
```

> DrissionPage 需要本地已安装 Chrome/Chromium 浏览器（大多数系统自带）。
> 如果环境没有 Chrome，可以使用 `pip install DrissionPage` 后它会自动提示下载。

### 2. 一键全站抓取

```bash
# 默认从首页开始全站抓取（推荐）
python scraper.py

# 从指定页面开始
python scraper.py --url https://www.depvailon.com/xxx

# 调整并发和爬取深度
python scraper.py --workers 3 --depth 20 --delay 1.0

# 断点续爬（上次中断后继续）
python scraper.py --resume

# 显示浏览器窗口（便于人工介入过验证码/登录）
python scraper.py --no-headless
```

抓取完成后，完整站点镜像会保存在 `depvailon_site/` 目录下，用浏览器打开其中的 `index.html` 即可**离线浏览**。

### 3. 单独使用解密工具

```bash
# 解密一个已保存的HTML文件中的加密内容
python decryptor.py saved_page.html

# 直接解密一段HTML
python decryptor.py --html '<a href="/cdn-cgi/l/email-protection#...">...</a>'

# 暴力尝试解密一段密文（自动尝试 Base64/AES常见密钥/XOR/ROT13）
python decryptor.py --string "U2FsdGVkX1+xxxxxxxxx..."

# 拉取URL并解密
python decryptor.py https://www.depvailon.com/xxx
```

---

## 🔓 已支持的逆向 / 解密能力

| 场景 | 说明 | 处理模块 |
|------|------|---------|
| **Cloudflare 5秒盾** | 通过本地 Chromium 模拟真实浏览器，等待 JS Challenge 自动通过 | `scraper.py` CFBypassSession |
| **Cloudflare Turnstile** | 自动定位并点击人机验证复选框 | `scraper.py` CFBypassSession |
| **Cloudflare Email Protection** | 自动解密 `data-cfemail` 保护的邮箱地址，转为明文 mailto | `decryptor.py` + `scraper.py` JSDecryptor |
| **JS 动态渲染内容** | 浏览器模式下等待页面完全渲染（DOM + 异步数据）后再取 HTML | DrissionPage |
| **SPA 状态提取** | 自动识别 `__NEXT_DATA__` / `__NUXT__` / `__INITIAL_STATE__` / `__PRELOADED_STATE__` 等服务端渲染数据 | `decryptor.py` |
| **Base64 编码链接** | 自动识别并解码 HTML 属性中的 Base64/Base64URL 编码 | `decryptor.py` |
| **CryptoJS AES 加密** | 支持 ECB/CBC/PKCS7，兼容 CryptoJS 自带的 OpenSSL KDF (Salted__)，内置数十个常见弱密钥自动爆破 | `decryptor.py` |
| **XOR 单字节加密** | 自动遍历 0x01–0xFF 单字节 XOR 密钥解密 | `decryptor.py` |
| **CSS url() 资源** | 递归解析并下载 `<style>`、`style=` 属性以及外链 CSS 文件中的 url() 引用资源 | `scraper.py` |
| **懒加载图片** | 处理 `data-src` / `data-original` / `data-lazy-src` / `srcset` 属性 | `scraper.py` |
| **Cloudflare 挑战脚本** | 自动清理已无意义的 `/cdn-cgi/challenge-platform/` 脚本标签 | `scraper.py` JSDecryptor |

---

## ⚙️ 工作流程

```
启动
 │
 ▼
┌─────────────────────────────┐
│ 启动本地 Chromium 浏览器     │
│ (DrissionPage 控制)          │
└─────────────┬───────────────┘
              ▼
┌─────────────────────────────┐
│ 访问首页，等待CF验证通过     │
│ (检测标题/页面内容，自动点   │
│  Turnstile 复选框)           │
└─────────────┬───────────────┘
              ▼
┌─────────────────────────────┐
│ 把浏览器cookies同步到requests│
└─────────────┬───────────────┘
              ▼
┌─────────────────────────────┐
│ BFS 队列爬取：               │
│  1. 浏览器获取页面HTML       │
│  2. 解密CF邮箱/加密内容      │
│  3. 解析并下载所有静态资源   │
│  4. 改写链接为本地相对路径   │
│  5. 发现新页面入队           │
│  6. 每5页保存一次断点状态    │
└─────────────┬───────────────┘
              ▼
┌─────────────────────────────┐
│ 抓取完成 → depvailon_site/   │
│ 打开 index.html 离线浏览     │
└─────────────────────────────┘
```

---

## 🛠️ 常见问题

### Q1: 一直卡在 "Cloudflare 验证超时"？
- 运行时加 `--no-headless` 显示浏览器窗口，手动完成验证（可能遇到更复杂的Captcha）。
- 尝试切换代理/更换网络环境（数据中心IP容易被Cloudflare重点检测）。
- 在系统中安装最新版 Chrome。

### Q2: 图片/样式显示不正常？
- 确认终端输出中没有大量"下载资源失败"的警告。
- 直接双击 `depvailon_site/index.html` 即可，图片路径已改写为相对路径。
- 若某些资源被外链域名加载，默认保留原URL，需要联网显示。

### Q3: 如何只抓特定路径？
- 修改 `scraper.py` 中 `_enqueue` 方法，添加路径过滤，例如：
  ```python
  if not urlparse(url).path.startswith("/products/"):
      return
  ```

### Q4: 抓取中断了怎么办？
- 直接加 `--resume` 参数继续，工具会自动读取 `.crawl_state.json` 从断点位置继续。

### Q5: 页面内容是 AES 加密的怎么办？
- 将加密字符串复制出来，使用 `python decryptor.py -s "密文"` 尝试自动解密。
- 如果是自定义密钥，可以在 `decryptor.py` 的 `COMMON_KEYS` 列表中加入你的密钥。
- 也可以在浏览器 DevTools 中观察网络请求，找到密钥后调用 `try_aes_decrypt()` 函数。

---

## ⚠️ 免责声明

本工具仅用于**合法的安全研究、个人存档和学习目的**。
请在抓取前确认目标网站的 robots.txt 与使用条款，遵守所在地区法律法规。
使用者须对其行为独立承担法律责任，作者不对任何滥用行为负责。
