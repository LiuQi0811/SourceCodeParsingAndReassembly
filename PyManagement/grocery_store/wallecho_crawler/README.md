# 壁響 wallecho.com 全站壁纸爬虫

## 逆向分析结论

| 项目 | 结论 |
| --- | --- |
| 站点类型 | 繁体中文壁纸下载站（「壁響」） |
| 渲染方式 | 服务端渲染 (SSR)，HTML 直接含全部图片链接 |
| 图片托管 | Cloudflare R2 存储：`https://r2.wallecho.com/YYYY/MM/DD/<id>.jpg` |
| 图片是否加密 | **无加密**。`<img src>` 直接暴露原图 URL，直链可下载 |
| JS 反爬 | 无签名参数、无动态 Token、无接口加密 |
| Cloudflare | 仅作为 CDN 使用（未开启五秒盾/Under Attack 模式） |
| 结论 | 无需逆向解密，普通 HTTP 请求即可抓取完整站点 |

## 环境依赖

`pip install requests beautifulsoup4 lxml tqdm cloudscraper`

> `cloudscraper` 为兜底方案（若未来开启 CF 五秒盾会自动启用），平时不会触发。

## 快速使用

`# 1) 默认：抓取全站全部壁纸（电脑+手机，所有分类+所有分页）`\
`python3 wallecho_crawler.py`\
\
`# 2) 指定 16 线程并发下载，输出到 D 盘`\
`python3 wallecho_crawler.py -w 16 -o D:/wallpapers`\
\
`# 3) 只抓电脑桌布`\
`python3 wallecho_crawler.py --only-desktop`\
\
`# 4) 只抓手机桌布`\
`python3 wallecho_crawler.py --only-mobile`\
\
`# 5) 测试：每个分类只抓 2 页（快速验证）`\
`python3 wallecho_crawler.py --max-pages 2`\
\
`# 6) 仅抓取元数据（URL/标题/浏览数），不下载图片`\
`python3 wallecho_crawler.py --no-download`

## 参数说明

| 参数 | 缩写 | 默认值 | 说明 |
| --- | --- | --- | --- |
| `--output` | `-o` | `./wallecho_wallpapers` | 图片输出目录 |
| `--workers` | `-w` | `8` | 下载并发线程数 |
| `--only-desktop` | — | 关闭 | 仅抓取电脑桌布 |
| `--only-mobile` | — | 关闭 | 仅抓取手机桌布 |
| `--max-pages` | — | 不限 | 每个分类最大抓取页数（测试用） |
| `--no-download` | — | 关闭 | 只抓取元数据，不下载图片 |

## 输出结构

`wallecho_wallpapers/`\
`├── metadata.json                # 所有壁纸元数据（URL/标题/浏览/下载量/本地路径）`\
`├── 電腦桌布/`\
`│   ├── 動漫/`\
`│   │   ├── 動漫 插畫 唯美 少女壁紙/`\
`│   │   │   └── 4071322237.jpg`\
`│   │   ├── 風景/`\
`│   │   └── ...`\
`│   ├── 風景/`\
`│   └── ...`\
`└── 手機桌布/`\
`    ├── 動漫/`\
`    └── ...`

## 功能特性

1. **两阶段遍历**：先从首页+顶级入口收集全部 87 个分类/标签链接，再逐分类翻页抓取，彻底避免重复访问
2. **自动翻页**：每页 20 张，空页或不足 20 张时自动停止，支持 `?page=N` 分页
3. **多线程下载**：默认 8 线程并发，可调（建议 ≤16 避免被限流）
4. **断点续传/续爬**：自动保存 `metadata.json`，中断后再次运行会跳过已下载项
5. **失败重试**：指数退避重试（最多 5 次）+ 随机 UA 轮换 + 随机请求间隔防封
6. **Cloudflare 兜底**：若站点未来开启 CF 五秒盾，自动切换 `cloudscraper` 过盾
7. **实时进度**：tqdm 进度条显示当前分类/页码/新增/累计数量
8. **元数据记录**：每张壁纸保留标题、浏览数、下载数、分类路径、文件大小、下载时间

## 注意事项

- 请遵守目标网站 `robots.txt` 与使用条款，合理控制爬取频率
- 仅供个人学习/收藏壁纸使用，请勿用于商业用途
- 全网站大约 1600\~2000 张壁纸，按 200KB/张估算约 300\~400MB
- 若中途 Ctrl+C 中断，再次运行同一命令会自动断点续爬