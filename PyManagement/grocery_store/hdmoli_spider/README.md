# HDmoli 全站爬虫 (hdmoli.com)

一个针对 https://www.hdmoli.com/ 的全站影视资源抓取脚本，支持分类遍历、自动翻页、
网盘下载链接解析（夸克 / 百度网盘 / PikPak / 阿里云盘 / 迅雷 / 115 / 磁力等）、封面下载、
断点续爬、CSV + JSON 双格式导出。

## 关于"逆向解密"

经对站点首页、分类列表页、详情页的完整 HTML / JS 分析：
- **该站点网盘下载链接直接以明文 HTML 输出**（在 `<p class="text-muted col-pd">` 区块），
  没有经过前端 JS 混淆 / 加密 / Base64 编码 / AES 加密等任何处理；
- 百度网盘提取码以 `?pwd=xxxx` 查询参数形式直接附带在链接中，夸克/PikPak 无需提取码；
- 站点使用 Cloudflare 但当前对正常 UA 的 GET 请求不触发任何 JS 5 秒盾（无需执行浏览器 JS）。

因此**本脚本无需任何逆向解密**，纯 HTTP 请求 + HTML 解析即可拿到全部下载链接。
脚本已在 `parse_detail()` 中预留解密钩子：若站点后续升级为 JS 动态加载/混淆，
可直接在该函数内补充解密逻辑（atob/Playwright 渲染等），不影响其它模块。

## 站点结构（已解析）

| 类型 | URL 模式 | 备注 |
| --- | --- | --- |
| 首页 | `/` | |
| 分类列表 | `/mlist/index{cid}.html` | cid = 1电影 / 2剧集 / 41动画 / 5动作 / 6爱情 / 7科幻 / 8恐怖 / 9战争 / 10喜剧 / 11纪录片 / 12剧情 / 30犯罪 / 13日剧 / 14中国 / 15美剧 / 16韩剧 / 29泰剧 / 32动画 / 34英剧 / 38其他 / 39综艺 / 42日本 / 43其他 |
| 分类翻页 | `/mlist/index{cid}-{page}.html` | |
| 影片详情 | `/movie/index{id}.html` | 所有分类影片详情统一使用此路径 |

## 安装依赖

```bash
pip install requests beautifulsoup4 lxml tqdm
```

## 使用

```bash
# 1) 全站抓取（所有分类全部分页）
python3 hdmoli_spider.py

# 2) 指定输出目录 + 下载封面图 + 请求间隔 1 秒
python3 hdmoli_spider.py --output ./moli_data --download-covers --delay 1

# 3) 测试：每个分类只抓 2 页
python3 hdmoli_spider.py --max-pages 2 --delay 0.5

# 4) 断点续爬（中途中断后继续，已抓过的 ID 自动跳过）
python3 hdmoli_spider.py --resume

# 5) 调试：只抓指定详情页
python3 hdmoli_spider.py --only-detail \
    https://www.hdmoli.com/movie/index3588.html \
    https://www.hdmoli.com/movie/index3561.html
```

## 输出目录结构

```
hdmoli_output/
├── hdmoli_movies.json     # 全量结构化数据（JSON，含完整 downloads 数组）
├── hdmoli_movies.csv      # CSV（UTF-8 BOM，Excel 可直接打开，夸克/百度/PikPak 列独立）
├── failed.txt             # 抓取失败的 URL
├── .crawled_ids.txt       # 已抓取 ID 状态文件（断点续爬用）
└── covers/                # 封面图（仅 --download-covers 时）
    ├── 3588.jpg
    └── ...
```

## JSON 字段说明

```jsonc
{
  "id": "3588",                        // 影片ID
  "title": "夜王 高清版",              // 标题
  "rating": "豆瓣评分：7.8",           // 评分
  "category": "电影",                  // 分类
  "cover": "https://.../p2929...jpg", // 封面URL
  "intro": "...",                      // 剧情简介
  "short_comment": "...",              // 短评
  "url": "https://.../movie/index3588.html",
  "downloads": [                       // 所有网盘链接
    {"type":"quark","name":"夸 克","url":"https://pan.quark.cn/s/xxx","pwd":""},
    {"type":"baidu","name":"百 度","url":"https://pan.baidu.com/s/xxx?pwd=moil","pwd":"moil"},
    {"type":"pikpak","name":"海 外","url":"https://mypikpak.com/s/xxx","pwd":""}
  ]
}
```

## 注意事项

1. 脚本内置了随机 User-Agent、Referer 伪装、失败重试（3 次）、请求延时控制，
   请合理设置 `--delay`（建议 ≥0.5 秒），避免对站点造成压力。
2. 所有下载链接均来自第三方网盘（夸克/百度/PikPak），实际下载文件需在对应网盘客户端完成，
   本脚本只抓取链接元数据，**不下载影视文件本身**，请在法律允许范围内使用。
3. 若后续站点改版导致解析失败，可打开 `--only-detail` 调试单个页面，在 `parse_detail()`
   函数中调整 CSS 选择器；若加入 JS 加密，可在函数内接入 Playwright 执行 JS 后再解析。
