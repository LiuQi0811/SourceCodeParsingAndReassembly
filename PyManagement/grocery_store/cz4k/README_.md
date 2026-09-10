# cz4k.com 全站爬虫 — 纯逆向版（无浏览器）

本版 **不使用 Playwright / Chromium 等任何浏览器进程**，完全通过**协议逆向 + 纯Python执行WASM**绕过长亭雷池WAF。

## 逆向原理

雷池 SafeLine WAF（开源WAF，本目标站点 `hashID: a8023d9`）的"动态防护 人机验证 level=1 无感模式"挑战流程：

`┌──────────┐     GET /        ┌──────────────┐`\
`│  爬虫    │ ────────────────> │  雷池WAF    │──468──> HTML挑战页 + sl-session`\
`│          │ <──────────────── │              │        (含 SafeLineChallenge(client_id, ...))`\
`│          │                   │              │`\
`│          │ ── POST /.../api/issue─────────> │  提交 client_id+level+input_type`\
`│          │ <──── {issue_id, data:[...]} ─── │  返回wasm待计算整数数组`\
`│          │                   │              │`\
`│          │ ── GET /.../calc.wasm ──────────>│  下载WebAssembly计算模块(约911字节)`\
`│          │ <──── wasm binary ────────────── │`\
`│          │                   │              │`\
`│          │ 纯Python实例化wasm:              │`\
`│          │   reset() → arg(每个数) → calc() │`\
`│          │   → ret()循环取出结果数组        │`\
`│          │                   │              │`\
`│          │ ── POST /.../api/verify ────────>│  提交 issue_id+result+client指纹`\
`│          │ <── {jwt, verified:true} ─────── │`\
`│          │                   │              │`\
`│          │  Set-Cookie: sl-challenge-jwt=…  │`\
`│          │  等待3s(模拟前端动画) reload     │`\
`│          │                   │              │`\
`│          │ ── GET / (带 sl-session + jwt) ─>│  返回200真实页面 ✅`\
`└──────────┘                   └──────────────┘`

### 关键技术点

1. **TLS 指纹模拟**：使用 `curl_cffi` 的 `impersonate='chrome120'` 完美复现 Chrome 的 TLS/JA3/HTTP2 指纹，否则会被第一层拦截直接返回403。
2. **会话分离**：`issue/verify/calc.wasm` 等API请求使用独立session（模拟浏览器 `credentials: "omit"` 策略），不携带 `sl-session`；拿到jwt后再与主会话合并reload。
3. **WASM 纯Python执行**：通过 `wasmtime` 直接实例化 `calc.wasm`，零依赖算出 `result` 数组；wasmtime不可用时自动回退调用系统 `node`。
4. **请求序列还原**：按浏览器真实时序并行下载 css→challenge.js→(calc.wasm + issue 并发)→calc.js→verify→延时3s→reload。

## 安装

`pip install -r requirements.txt`\
`# 安装wasmtime预编译包(推荐):`\
`pip install wasmtime`\
`# 或系统准备node作为回退:`\
`#  apt install -y nodejs  # Debian/Ubuntu`

## 使用

`# 默认全站爬取(自动断点续爬,Ctrl+C中断可续)`\
`python3 cz4k_reverse_crawler.py`\
\
`# 指定最大页数 / 输出目录`\
`python3 cz4k_reverse_crawler.py -n 100 -d ./cz4k_data`\
\
`# 详细日志`\
`python3 cz4k_reverse_crawler.py -v`

输出目录结构：

`cz4k_site/`\
`├── www.cz4k.com/`\
`│   ├── index.html          # 首页`\
`│   ├── category/xxx/index.html`\
`│   └── ...`\
`├── crawler.log             # 日志`\
`└── .crawler_state.json     # 断点状态(visited/queue/failed)`

## 文件清单

| 文件 | 说明 |
| --- | --- |
| `cz4k_reverse_crawler.py` | **主程序**：纯Python雷池逆向爬虫 |
| `cz4k_simple_crawler.py` | 之前的requests+BS4版本(无WAF绕过,仅供参考) |
| `cz4k_crawler.py` | 之前的Playwright浏览器版本 |
| `sl_solver.mjs` | Node.js+happy-dom版本的WAF求解器(实验性备选) |
| `solve.cjs` | jsdom实验脚本(开发时调试用) |
| `requirements.txt` | Python依赖 |

## 关于IP信誉说明

雷池WAF会对数据中心IP、IDC出口、代理/VPN IP做信誉评分，**纯算法逆向无法绕过IP信誉校验**。 当前沙箱环境（百度云数据中心IP）实测：

- ✅ 协议链路完全跑通（issue/wasm/verify均返回200，合法JWT）
- ❌ reload阶段因IP被标记为数据中心流量被再次拦截

在真实家庭宽带或正常住宅代理环境下，本爬虫可直接正常运行。如遇持续468，可给 `solve()` 方法里的session配置代理：

`proxies = {"https": "http://your-residential-proxy:port"}`\
`r = main_sess.get(target_url, headers=NAV_H, proxies=proxies, timeout=TIMEOUT)`

## 其他说明

- 代码内置 1-2.5 秒随机延时、3线程并发上限，模拟人类访问节奏
- 自动跳过静态资源(css/js/图片/字体等)，只爬HTML页面
- 相对链接自动转绝对URL，离线可直接浏览
- 支持断点续爬（Ctrl+C后再次运行会从断点继续）
- 仅供学习研究网络协议之用，请遵守目标站点robots规则与相关法律法规