# wallpapers-clan.com 全站爬虫使用说明

## 已完成的工作

✅ **逆向解密 / 反爬处理**

- 自动绕过 **Cloudflare Managed Challenge**（使用 curl_cffi 模拟 Chrome 120 TLS 指纹，比 cloudscraper 更稳定）
- 自动处理 Cloudflare 重新拦截（session 失效时自动重建）
- 429 速率限制自动退避重试
- 绕过 WP Rocket 延迟加载（`data:image/svg+xml` 占位图 + 真实图在 `data-src`/`srcset`）

✅ **下载机制完全逆向**（无需执行JS）

- **WordPress Download Manager (WPDM) 下载链接**：通过详情页 `data-downloadurl` 属性获取 `?wpdmdl=ID&refresh=xxx` 直链，直接 GET 即返回 4K 原图/ZIP包（`content-disposition` 带真实文件名）
- **直接展示型页面**（手机壁纸、头像、Ins封面）：解析主内容区 `<img>`，自动去 `-scaled` 后缀获取原图，自动回退 `-preview` 预览图

✅ **全站URL发现**：使用站点 sitemap.xml 精准获取 \~24000 个详情页URL，彻底避免分页被 WordPress 缓存插件欺骗的问题

## 覆盖板块

| 板块 | 资源类型 | 下载方式 | 详情页数量 |
| --- | --- | --- | --- |
| desktop-wallpapers | 4K桌面壁纸（JPG） | WPDM | \~10361 |
| wallpapers | 手机/综合壁纸（JPG） | 直链原图 | \~9650 |
| app-icons | App图标包（ZIP） | WPDM | \~155 |
| folder-icons | 文件夹图标包（ZIP） | WPDM | \~85 |
| pfp | 头像（GIF/PNG/JPG） | 直链多图 | \~208 |
| highlight-covers | Ins高亮封面（JPG） | 直链多图 | \~19 |
| sticker-png | 贴纸PNG包（ZIP/PNG） | WPDM | \~2743 |

## 文件说明

- `wallpapers_clan_spider.py` —— 爬虫主程序
- `wallpapers_clan_state.json` —— 断点续爬状态（已解析URL、已下载URL、失败次数）
- `wallpapers_clan_downloads/` —— 下载目录，按 `板块/壁纸标题/文件` 结构存储
- `run.log` / `wallpapers_clan_spider.log` —— 运行日志
- `README.md` —— 本说明

## 使用命令

`# 查看所有板块`\
`python3 wallpapers_clan_spider.py --list`\
\
`# 启动全量爬取（断点续爬）`\
`python3 wallpapers_clan_spider.py`\
\
`# 只爬指定板块`\
`python3 wallpapers_clan_spider.py -s desktop-wallpapers app-icons`\
\
`# 查看爬取进度`\
`python3 wallpapers_clan_spider.py --summary`\
\
`# 指定并发线程数（默认3，建议3-5，太大会被Cloudflare封）`\
`python3 wallpapers_clan_spider.py -w 5`

## 特性

- ✔ 断点续爬（中断后重新运行自动继续）
- ✔ 多线程并发（3线程约1张/秒，单日可下完整站）
- ✔ 失败自动重试（最多5次，指数退避）
- ✔ 文件去重（基于URL + 本地存在性双重判断）
- ✔ 文件名自动清洗（支持中文标题、特殊字符）
- ✔ 自动回退（原图URL 404 时自动用 preview 图作为备用）
- ✔ 速率随机抖动（避免触发WAF）

## 当前状态

爬虫已在后台运行（PID见日志），预计总数据量 50\~100 GB，完整下载需数小时。你可以随时 Ctrl+C 中断，再次运行将从断点继续。