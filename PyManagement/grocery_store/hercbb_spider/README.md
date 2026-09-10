# hercbb.com 全站爬虫 & 逆向解密套件

针对 https://hercbb.com/ 编写的生产级全站镜像爬虫。内置四层通道与通用逆向解密钩子，自动应对 TLS 指纹（JA3/JA4）、5 秒盾、Cloudflare、JS Cookie 挑战、AES/Base64 等常见反爬/前端加密。

## 文件结构

```
hercbb_spider/
├── spider.py           # 主爬虫（四层通道、断点续爬、并发、限速、离线镜像）
├── decrypt_utils.py    # 逆向/解密工具集（JS执行、AES、Packer解包、字体反爬、签名）
├── requirements.txt
├── output/             # 抓取结果（自动生成）
│   └── hercbb.com/
│       ├── index.html
│       ├── assets/...
│       └── .spider_state.json   # 断点续爬状态
```

## 快速开始

```bash
# 1. 安装依赖
pip install -r requirements.txt

# 2. 安装 Playwright 浏览器内核（强烈推荐，用于解密/绕过JS挑战）
python -m playwright install chromium

# 3. 开始全站抓取
python3 spider.py

# 4. 常用参数
python3 spider.py --workers 8 --depth 10 --mirror        # 8并发，离线镜像（重写链接可离线浏览）
python3 spider.py --proxy http://127.0.0.1:7890         # 使用代理
python3 spider.py --resume                              # 断点续爬（Ctrl+C后继续）
python3 spider.py --no-browser                          # 仅HTTP通道（不启动真实浏览器）
python3 spider.py --depth 5 --delay 1                   # 深度5，1秒随机延迟
```

## 反爬与解密说明

当前沙箱内对 hercbb.com 进行指纹探测发现：
- 服务器为 **nginx**（IP：47.76.172.25，阿里云IP段）
- 静态资源白名单：`.js / .css / .png / .jpg / .gif / .ico` 直接返回200/404
- 首页与无后缀路径会被 WAF 直接 TCP/RST 断开，属典型 **TLS指纹+JS Cookie 挑战**

本爬虫应对策略：
1. **优先 Playwright 真实 Chromium**：自动执行 JS、接收 Cookie、渲染 DOM；自动等待 `networkidle`。
2. **自动识别挑战页**：当返回内容包含 `jschl_vc / __jsl_clearance / cdn-cgi / 安全验证 / 请开启javascript` 等关键字，或页面只包含一个大 `<script>`，自动升级到浏览器通道。
3. **curl_cffi 指纹模拟**（Chrome 124）：浏览器获取 Cookie 后回落到此轻量通道，自动处理 HTTP/2 PROTOCOL_ERROR 回退 HTTP/1.1。
4. **断点续爬**：状态自动保存到 `output/.spider_state.json`，可随时中断继续。

## 针对站点做深度逆向（若发现特定加密）

1. 把网站真实 HTML/JS 响应拿到后，在 `spider.py` 的 `decrypt_payload()` 中替换为你的解密逻辑：
   ```python
   from decrypt_utils import *
   def decrypt_payload(raw, url, headers):
       # 例：若发现列表接口是 AES-CBC 加密
       # return try_decrypt_aes_cbc(raw_text, key=key, iv=iv)
       return raw
   ```

2. `decrypt_utils.py` 已预置：
   - `eval_js(js, expr)`：在真实浏览器上下文执行任意 JS，直接抠混淆代码来解
   - `static_reverse_eval_pack(js)`：静态解 p.a.c.k.e.r 压缩
   - `try_decrypt_aes_cbc / _ecb`：AES 解密
   - `solve_jschl(script)`：5秒盾 Cookie 自动解
   - `font_map_get(woff_url, fetcher)`：字体反爬骨架
   - `sign_api(params, token)`：接口签名模板

3. 调试建议：
   - 浏览器开 DevTools → Network → 看第一个 HTML 请求是不是返回了 200 但内容是一段 `<script>`（5秒盾）
   - 如果 HTML 返回空/被断开，说明是 TLS 指纹，必须用 Playwright 或 curl_cffi 通道
   - 如果数据走 XHR/fetch 接口且是加密密文，抠接口前的加密函数用 `eval_js()` 直接调用即可，**不必完全翻译到Python**

## 注意事项

- 请遵守目标站点 robots.txt 与相关法律法规，本代码仅作学习交流使用。
- 若 IP 被封禁，可加代理 `--proxy socks5://...` 或调大 `--delay`。
- 首次使用务必执行 `python -m playwright install chromium`，否则将无法自动通过 JS 挑战。
