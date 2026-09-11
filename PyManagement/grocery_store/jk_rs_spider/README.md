# jk.rs 全站爬虫使用说明

## 站点逆向分析结论

| 维度 | 结论 |
| --- | --- |
| **建站程序** | WordPress (Mango-1.1.1 主题 by nicetheme) |
| **服务器** | Nginx + PHP |
| **前端框架** | Alpine.js + jQuery + Swiper + Bootstrap |
| **反爬强度** | 低 — 无Cloudflare、无Cookie验证、无字体反爬、无JS加密 |
| **数据接口** | WordPress REST API (`/wp-json/wp/v2/posts`) 完全开放，无需鉴权 |
| **图片加载** | jQuery 懒加载：`src` 为占位 gif，真实地址在 `data-src` 属性 |
| **隐藏内容** | 前端显示"评论可见"，但 REST API `content.rendered` 返回完整图片，**无需登录/评论** |
| **图片CDN** | `pic.imgdb.cn` / `pic1.imgdb.cn` → 302 跳转到 `wkphoto.cdn.bcebos.com` (百度智能云CDN) |
| **文章总数** | 890 篇 (7个分类，共约 9000+ 张图片) |

## 🔑 关键逆向：图片防盗链（Referer白名单）

这是全站唯一需要逆向处理的反爬点，已完美解决。

### 问题现象

直接用 `requests.get(url, allow_redirects=True)` 下载图片会返回 **403 Forbidden**， 响应头包含 `x-error-info: RefererWhite`。

### 原因分析

1. 图片链接 `pic1.imgdb.cn/item/xxx.jpg` 会 **302重定向** 到百度CDN `wkphoto.cdn.bcebos.com/xxx.jpg`
2. 源站 imgdb.cn 设置了 `Referrer-Policy: no-referrer` 响应头，浏览器收到后在跳转时**不会发送 Referer**，因此正常访问
3. 但 Python requests 的默认行为是：**重定向时自动把上一跳 URL 作为 Referer 发送**
4. 百度CDN配置了 Referer 白名单：只允许 **空Referer** 和 **百度系域名**（baike.baidu.com、image.baidu.com等），其他任何 Referer（包括 imgdb.cn 自身、jk.rs）均返回 403

### 逆向解决方案（两步下载法）

代码中已实现：

1. 第一次请求原 imgdb.cn URL，设置 `allow_redirects=False`，手动读取 `Location` 响应头得到百度CDN真实地址
2. 第二次请求对百度CDN地址发起 GET，**显式构造不带 Referer 的请求头**，成功下载

`# 核心代码`\
`r1 = session.get(imgdb_url, allow_redirects=False)      # 第一步：取302地址`\
`cdn_url = r1.headers["Location"]`\
`r2 = requests.get(cdn_url, headers={"User-Agent": ua})  # 第二步：无Referer下载`\
`# 注意：不要用session.get(), session中带的默认Referer会被发送`

### 实测验证

已验证域名与格式组合（全部100%成功）：

- ✅ `pic1.imgdb.cn` → `.jpg` (319张样本)
- ✅ `pic.imgdb.cn` → `.webp` (1302张样本)
- ✅ 站点自身 `www.jk.rs/wp-content/uploads/` 的原图

## 快速开始

`# 1. 安装依赖（仅需requests）`\
`pip3 install requests`\
\
`# 2. 完整全站抓取（含图片，支持断点续传）`\
`python3 jk_rs_spider.py`\
\
`# 3. 只抓前100篇测试（不下载图片，快速验证）`\
`python3 jk_rs_spider.py --pages 1 --no-images`\
\
`# 4. 8线程加速下载图片`\
`python3 jk_rs_spider.py --workers 8`\
\
`# 5. 中断后继续（默认已开启，可省略--resume）`\
`python3 jk_rs_spider.py`\
\
`# 6. 重置进度从头开始`\
`python3 jk_rs_spider.py --reset`

## 命令行参数

| 参数 | 说明 | 默认值 |
| --- | --- | --- |
| `--pages N` | 仅抓取文章列表前 N 页（每页100篇），用于小范围测试 | 全部9页 |
| `--workers N` | 图片下载并发线程数 | 4 |
| `--delay N` | 列表/详情请求间隔秒数（防封） | 0.5 |
| `--no-images` | 仅抓取文本和元数据，不下载图片 | 关闭（会下载） |
| `--reset` | 清空本地缓存，从头开始抓取 | 关闭 |
| `--no-resume` | 关闭断点续传功能 | 默认开启 |

## 输出目录结构

`jk_rs_output/`\
`├── images/                       # 图片资源（按文章分文件夹）`\
`│   └── 1017_往心里装一片阳光/`\
`│       ├── 1017_000_xxxx.jpg     # 图片文件: {文章ID}_{序号}_{URL哈希}.{ext}`\
`│       ├── 1017_001_xxxx.jpg`\
`│       └── _index.json           # URL→本地文件映射索引`\
`├── html/                         # 每篇文章本地HTML副本（可离线浏览）`\
`│   └── 1017_往心里装一片阳光.html`\
`├── meta/`\
`│   ├── posts/                    # 每篇文章结构化JSON（含完整正文HTML）`\
`│   │   └── 1017.json`\
`│   ├── posts_list.json           # 全量文章列表元数据`\
`│   ├── categories.json           # 分类信息`\
`│   ├── tags.json                 # 热门标签`\
`│   └── progress.json             # 断点续传进度`\
`├── logs/                         # 运行日志`\
`├── 文章清单.csv                  # 全量文章清单（可用Excel/WPS打开）`\
`└── 抓取报告.md                   # 抓取结果汇总报告`

## 功能特性

- ✅ **REST API直取**：不解析HTML分页，效率极高，数据结构化
- ✅ **懒加载兼容**：正则优先匹配 `data-src`，兜底提取 `src` 和正文直链
- ✅ **防盗链逆向**：两步法完美绕过百度CDN Referer白名单
- ✅ **断点续传**：文章列表、详情、图片三级缓存，Ctrl+C 后随时恢复
- ✅ **并发下载**：多线程下载图片，可通过 `--workers` 调节
- ✅ **错误重试**：HTTP 请求自动重试5次（指数退避），覆盖429/5xx
- ✅ **限速保护**：可配置请求间隔，避免对目标站造成压力
- ✅ **格式校验**：下载后验证文件大小和Content-Type，丢弃HTML错误页
- ✅ **完整记录**：CSV清单 + Markdown报告 + JSON元数据 + HTML副本 + 图片索引

## 磁盘与时间预估

- 全量890篇文章元数据：约200MB
- 全量下载图片：约 20-40 GB（按每篇约10张、每张2-4MB估算）
- 完整抓取耗时（4线程）：约1-3小时
- 建议：先 `--pages 1 --no-images` 测试，确认网络和磁盘正常再开启全量

## 注意事项

1. 本代码仅用于学习Python爬虫技术与HTTP协议分析，请遵守目标网站 robots.txt 与相关法律法规
2. 请勿在短时间内高并发请求，以免对目标站点造成压力或被封IP
3. 抓取的图片版权归原作者所有，请勿用于商业用途
4. 若未来网站升级反爬（如增加Cloudflare/JS加密），需重新逆向分析