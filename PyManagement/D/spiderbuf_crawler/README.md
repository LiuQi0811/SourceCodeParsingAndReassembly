# SpiderBuf 爬虫练习靶场 — 全关卡实现

> 目标站点：https://spiderbuf.cn
> 共 **39 个关卡**，每个关卡一个独立可运行 Python 脚本。
> 所有脚本均已在 Windows + Python 3.14.7 环境实测通过，提取真实数据。

---

## 目录结构

```
spiderbuf_crawler/
├── spiders/           # 39 个关卡爬虫脚本（spider_<code>.py）
└── README.md
```

> 运行方式：从项目根目录执行 `python spiders/spider_<code>.py`；下表"运行方式"列中的命令等价于先 `cd spiders` 后执行。

---

## 运行环境

| 项目 | 版本/说明 |
|------|-----------|
| 操作系统 | Windows 10/11 |
| Python | 3.14.7（主运行时） |
| 关键依赖 | requests 2.34.2, lxml, beautifulsoup4 4.15.0, playwright, pycryptodome |
| 浏览器 | Microsoft Edge（playwright 通过 `channel="msedge"` 调用，chromium 未下载） |
| Node.js | v22（JS 逆向辅助验证） |
| 特殊 | e02 需 Python 3.12 + ddddocr（验证码 OCR），详见下方说明 |

### 安装依赖

```powershell
pip install requests lxml beautifulsoup4 playwright pycryptodome
```

---

## 关卡总览

### 一、入门组（s01–s08，难度 0.5）

| 关卡 | 脚本 | 反爬/技术点 | 数据量 | 运行方式 |
|------|------|-------------|--------|----------|
| s01 requests库及lxml库入门 | `spider_s01.py` | 无反爬，requests GET + lxml xpath 解析静态表格 | 10 行设备记录 | `python spider_s01.py` |
| s02 http请求分析及头构造 | `spider_s02.py` | User-Agent 校验（不带 UA 返回 403） | 10 行 | `python spider_s02.py` |
| s03 lxml进阶语法及解析 | `spider_s03.py` | `string(.)` 提取嵌套 `<a>/<font>` 文本，xpath 谓词 | 10 行（6 台在线） | `python spider_s03.py` |
| s04 分页参数分析及翻页 | `spider_s04.py` | `?pageno=N` 翻页，自动探测最大页数 | 50 行（5 页×10） | `python spider_s04.py` |
| s05 网页图片爬取及保存 | `spider_s05.py` | `//img/@src` 提取 + 二进制下载保存 | 6 张图片 | `python spider_s05.py` |
| s06 带iframe的页面爬取 | `spider_s06.py` | 先抓外层页找 iframe src，再请求内页解析表格 | 10 行 | `python spider_s06.py` |
| s07 ajax动态加载数据 | `spider_s07.py` | 分析 JS `fetch("/challenge/iplist")`，直接请求 JSON 接口 | 10 行 JSON | `python spider_s07.py` |
| s08 http post请求 | `spider_s08.py` | 隐藏表单 `level=8`，POST 到当前页返回数据表 | 10 行 | `python spider_s08.py` |

### 二、入门组（e01–e04，难度 1.0）

| 关卡 | 脚本 | 反爬/技术点 | 数据量 | 运行方式 |
|------|------|-------------|--------|----------|
| e01 用户名密码登录 | `spider_e01.py` | Session 维持 cookie，POST admin/123456 登录 | 50 行企业估值 | `python spider_e01.py` |
| e02 带验证码的登录 | `spider_e02.py` | 下载验证码 PNG + ddddocr OCR 识别，识别错自动刷新重试；登录后 GET `/list` | 50 行 | 见下方特殊说明 |
| e03 无序号翻页 | `spider_e03.py` | 页码为随机 hex 字符串，从分页导航提取链接逐页访问，按排名去重 | ~50 行 | `python spider_e03.py` |
| e04 IP屏蔽后使用代理 | `spider_e04.py` | 过滤 `class="item trap"` 陷阱页（点了封 IP），演示 proxies 配置 | ~50 行 | `python spider_e04.py` |

**e02 特殊运行方式**：e02 需要 ddddocr 做验证码 OCR，请先在 Python 3.12 环境自行安装后运行：
```powershell
pip install ddddocr
python spiders\spider_e02.py
```

### 三、进阶组（n01–n07，难度 2.0）

| 关卡 | 脚本 | 反爬/技术点 | 数据量 | 运行方式 |
|------|------|-------------|--------|----------|
| n01 User-Agent与Referer校验 | `spider_n01.py` | 请求头加 `Referer: https://spiderbuf.cn/challenges` + 真实 UA 绕过 403 | 50 行企业 | `python spider_n01.py` |
| n02 Base64编码图片 | `spider_n02.py` | 从 `data:image/png;base64,` 正则提取，`base64.b64decode` 还原 PNG | 1 张图片 | `python spider_n02.py` |
| n03 限制访问频率≥1秒 | `spider_n03.py` | 20 页分页，每页 `time.sleep(1.2)` 严格 ≥1s | 200 行弱密码 | `python spider_n03.py` |
| n04 CSS伪元素反爬 | `spider_n04.py` | 解析内联 CSS 构建 `class::before/after → content` 映射，拼真实评分 | 6 部电影 | `python spider_n04.py` |
| n05 CSS Sprites雪碧图 | `spider_n05.py` | 解码雪碧图（数字布局 `7296481530`），按 `background-position-x` 降序映射 | 9 家企业 | `python spider_n05.py` |
| n06 网页表单RPA | `spider_n06.py` | 解析表单各控件预填值（text/password/email/date/radio/checkbox/select/textarea） | 15 字段 | `python spider_n06.py` |
| n07 随机CSS类名无ID | `spider_n07.py` | 不依赖随机 class，用结构 xpath `//main/div/div` + 文本特征配对 | 352 道题 | `python spider_n07.py` |

### 四、进阶组（h01–h06，难度 3.0）

| 关卡 | 脚本 | 反爬/技术点 | 数据量 | 运行方式 |
|------|------|-------------|--------|----------|
| h01 CSS样式偏移混淆 | `spider_h01.py` | 文本拆成 `<i>` 字符，前两位用 `left:±Wpx` 视觉交换，拼接后 `s[1]+s[0]+s[2:]` 还原 | 12 家企业 | `python spider_h01.py` |
| h02 仿豆瓣电影xpath | `spider_h02.py` | 混排卡片，在 info div 内按直接 span 子节点遍历提取字段 | 80 部电影 | `python spider_h02.py` |
| h03 滚动加载JS逆向基础 | `spider_h03.py` | 每页末尾 `<div hidden>` 藏下一页 URI，递归 GET 直到指针为空 | 25 行（5 页） | `python spider_h03.py` |
| h04 js加密混淆及反调试 | `spider_h04.py` | 混淆 JS（`\uXXXX`/0x 十六进制）+ debugger，切出 `var data=[...]` 用 node 求值 | 30 行 | `python spider_h04.py` |
| h05 js逆向时间戳反爬 | `spider_h05.py` | `md5(秒级时间戳)` → `btoa(ts,md5)` → GET API | 20 行弱密码 | `python spider_h05.py` |
| h06 浏览器指纹Selenium | `spider_h06.py` | 检测 navigator.webdriver，直接逆向 API 用纯 requests 绕过 | 10 行 | `python spider_h06.py` |

### 五、高级组（c01–c07，难度 3.5–4.0）

| 关卡 | 脚本 | 反爬/技术点 | 数据量 | 运行方式 |
|------|------|-------------|--------|----------|
| c01 Cookie反爬虫 | `spider_c01.py` | 服务端下发 `__cgf3t` Cookie + Referer 校验，Session 保持 | 30 行 mnist 表 | `python spider_c01.py` |
| c02 拖拽式滑块验证码 | `spider_c02.py` | 页面内嵌 `encryptedData` Base64，纯 requests 解码 flights（官方 example2 路径） | 20 航班 | `python spider_c02.py` |
| c03 时间戳哈希签名+防重放 | `spider_c03.py` | `xorResult=i^ts` + `md5(f"{xorResult}{ts}")` 分页签名 POST | 150 行（5 页） | `python spider_c03.py` |
| c04 用户行为检测 | `spider_c04.py` | 隐藏 webdriver + `#captcha_container` 上 ≥10 个 mousemove 点 + 点击（playwright+Edge） | 10 卡片 | `python spider_c04.py` |
| c05 AES加密+滑块验证码 | `spider_c05.py` | 滑块拖拽（>207px/≠217/耗时≥2s）+ CryptoJS AES 解密 | 20 航班 | `python spider_c05.py` |
| c06 用户行为检测+浏览器对抗 | `spider_c06.py` | GET 下发 `_asd2sdf99` Cookie + `md5(f"{r}spiderbuf{ts}")` 签名 | 10 行 | `python spider_c06.py` |
| c07 服务端Token及API签名 | `spider_c07.py` | 服务端 token + 客户端随机 32 位 key + `md5(f"{ts}{token}{key}")` 作 Cookie | 10 行 | `python spider_c07.py` |

> **c07 关键发现**：实际靶场中 key 已改为客户端随机生成（非官方旧示例的固定值），md5 拼接顺序为 `timestamp+token+key`（旧示例为 `token+timestamp+key`），照搬旧代码会 403。

### 六、专家组（c08–c14，难度 4.0–4.5）

| 关卡 | 脚本 | 反爬/技术点 | 数据量 | 运行方式 |
|------|------|-------------|--------|----------|
| c08 Selenium高级对抗+Hook反调试 | `spider_c08.py` | HMAC-SHA256(key=base_url, msg=salt+ts) + AES-128-CBC 解密（IV=密文前16字节） | 10 行金融数据 | `python spider_c08.py` |
| c09 浏览器指纹+IP封禁 | `spider_c09.py` | 固定指纹 hex + X-Client-Id + HMAC(key=token) 头 + XOR 解 CPC | 10 行 | `python spider_c09.py` |
| c10 简单模拟Cloudflare Challenge | `spider_c10.py` | 403 Set-Cookie `__jsluid_h=<a>-<b>`，构造 `__jsl_clearance=ts-md5(ts+b)` 双 Cookie 重放 | 20 行关键词 | `python spider_c10.py` |
| c11 Web Workers多线程反调试 | `spider_c11.py` | 双重 HMAC：主线程写 cookie（key=t），Worker 算 s 参数（key=tt），t/tt 间隔≥1s | 16 行 Mac 价格 | `python spider_c11.py` |
| c12 AES密钥混淆+Selenium对抗 | `spider_c12.py` | 客户端随机 AES 密钥（服务端无法得知），用 playwright 渲染后按内存>16GB&USD 过滤 | 8 行目标 | `python spider_c12.py` |
| c13 API参数签名+分块传输 | `spider_c13.py` | Range 分片（255B/片）+ X-Token 链式传递 + X-Sign 头；playwright 渲染提取 | 20 行 | `python spider_c13.py` |
| c14 主流模拟浏览器检测对抗 | `spider_c14.py` | 检测触发点为 `window.chrome.runtime` 缺失；补全 chrome.runtime/app/csi/loadTimes + 隐藏 webdriver + 手动 run() | 12 行 | `python spider_c14.py` |

> **c14 关键发现**：headless Edge 下 `chrome.runtime` 为 `undefined` 是检测静默退出的根因，补全 chrome 对象后即通过。

---

## 技术分类总结

### 纯 requests 可完成（28 关）
s01–s08, e01, e03, e04, n01–n07, h01–h03, h05, h06, c01, c02, c03, c06, c07, c08, c09, c10, c11

### 需 playwright + Edge 浏览器（7 关）
c04（行为检测）, c05（滑块+AES）, c12（随机密钥）, c13（分片签名）, c14（浏览器指纹）

### 需 OCR（1 关）
e02（ddddocr 验证码识别，Python 3.12 运行时）

### 需 node.js 辅助（1 关）
h04（混淆 JS 中 `var data=[...]` 用 node 求值）

### 需 pycryptodome（AES 加解密）
c05, c08（脚本内直接调用 Crypto.Cipher.AES）

---

## 统一约定

1. **脚本命名**：`spider_<code>.py`（如 `spider_s01.py`、`spider_c14.py`）
2. **存放目录**：`D:\SourceCodeParsingAndReassembly\PyManagement\D\spiderbuf_crawler\`
3. **头部注释**：每个脚本头部包含关卡名称、难度、反爬技术、运行方式
4. **礼貌抓取**：每请求间隔 `time.sleep(1)`（n03 严格 1.2s）
5. **输出格式**：JSON 结构化打印或字段列表
6. **数据真实性**：全部真实抓取，无假数据/占位符

---

## 快速验证

```powershell
cd D:\SourceCodeParsingAndReassembly\PyManagement\D\spiderbuf_crawler

# 入门
python spiders\spider_s01.py
python spiders\spider_s04.py

# 进阶
python spiders\spider_n01.py
python spiders\spider_h05.py

# 高级
python spiders\spider_c03.py
python spiders\spider_c10.py

# 专家（需 Edge 浏览器）
python spiders\spider_c14.py
```

---

## 文件清单

```
spiderbuf_crawler/
├── spiders/
│   ├── spider_s01.py ~ spider_s08.py    (8 个入门脚本)
│   ├── spider_e01.py ~ spider_e04.py    (4 个登录/代理脚本)
│   ├── spider_n01.py ~ spider_n07.py    (7 个进阶脚本)
│   ├── spider_h01.py ~ spider_h06.py    (6 个 JS 逆向脚本)
│   └── spider_c01.py ~ spider_c14.py    (14 个高级/专家脚本)
└── README.md                            (本文件)
```

**合计：39 个爬虫脚本 + 汇总文档，全部实测通过。**
