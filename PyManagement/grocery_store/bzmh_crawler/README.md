# bzmh.org（包子漫畫）全站爬虫 · 完美解密版

## 特性

- **完美解密**：直接调用站点官方 `chapter-decoder.js`（基于 Playwright 启动真实 Chromium 执行），
  100% 还原官方解密算法，**无需手动逆向密钥**，站点日后更新解密逻辑也能自动适配。
- **全站抓取**：自动遍历漫画列表 100 页（约 1800 部漫画），抓取每部元数据 + 所有章节图片。
- **双通道兜底**：下载时主线路失败自动切换备用 CDN，失败自动重试。
- **断点续传/跳过已下**：已下载的图片自动跳过，中断后重跑继续。
- **多线程并发**：图片下载使用线程池（默认 8 线程，可配置）。
- **规范目录输出**：`下载目录/漫画名/章节名/001.webp`，每部漫画生成 `meta.json`，根目录生成 `index.json` 总索引。

## 逆向说明

站点图片列表由后端 API (`https://v2.apikk.top/api/v2/chapter/getinfo?m=&c=`) 返回加密字符串，
前端通过 `/assets/runtime/chapter-decoder.js` 混淆脚本中的 `__cimg.r(encrypted)` 解密得到
真实图片路径数组。混淆脚本带有自防御/反调试代码，静态还原易错、易被站点更新绕过。
本爬虫采用**在浏览器原生环境执行官方 JS** 的方式，等价于"在真实 Chrome 里看漫画"，
解密结果与官方完全一致，是真正意义上的"完美逆向"。

## 安装

```bash
pip install -r requirements.txt
python -m playwright install chromium
```

## 使用

```bash
# 全站抓取（全部 ~1800 部漫画，所有章节）
python bzmh_crawler.py -o ./bzmh_downloads

# 只抓某一部漫画（按 slug 或标题关键字）
python bzmh_crawler.py --only-manga quanzhiduzheshijiao -o ./dl

# 只抓前 5 话测试
python bzmh_crawler.py --only-manga wuliandianfeng --max-chapters 5 -o ./dl

# 指定分页范围（例如只抓第1-3页的漫画）
python bzmh_crawler.py --start-page 1 --end-page 3 -o ./dl

# 只做索引，不下载图片
python bzmh_crawler.py --index-only -o ./dl

# 使用备用线路（t开头CDN）
python bzmh_crawler.py --host https://t-nd3-1.6wm.top -o ./dl

# 调整并发
python bzmh_crawler.py --concurrency 16 -o ./dl
```

## 输出结构

```
bzmh_downloads/
├── index.json                      # 全站索引 + 失败列表
└── 武炼巅峰/
    ├── cover.webp                  # 封面
    ├── meta.json                   # 本漫所有章节元数据
    ├── 1 扫地小厮/
    │   ├── 001.webp
    │   ├── 002.webp
    │   └── ...
    └── 2 撞破南墙不回头（一）/
        └── ...
```

## 参数

| 参数 | 说明 | 默认 |
|---|---|---|
| `-o, --out` | 下载根目录 | `./bzmh_downloads` |
| `--start-page` | 列表起始页 | 1 |
| `--end-page` | 列表结束页（0=自动全部） | 0 |
| `--only-manga` | 仅抓取匹配的漫画（URL/slug/标题关键字） | 空=全抓 |
| `--max-chapters` | 每部漫画最多抓几话（0=全部） | 0 |
| `--concurrency` | 图片下载并发线程数 | 8 |
| `--host` | 图片CDN线路主域名 | `https://c-nd3-1.6wm.top` |
| `--index-only` / `--no-image` | 仅拉索引，不下载图片 | 关闭 |

## 注意

- 首次运行需要下载 Chromium（约 150MB），请确保网络通畅。
- 全站抓取时间较长（约 1800 部 × 每部几十到几百话），建议按需使用 `--only-manga` 或 `--max-chapters` 先测试。
- 请遵守目标站点 robots 与版权法规，仅供个人学习使用。
