# IndieLens.org 全站抓取工具

## 逆向分析摘要

| 项目 | 结论 |
|------|------|
| 前端框架 | **Angular 17+**（SSR/预渲染，带 hash bundle） |
| 后端 API | `https://api.indielens.org/` — **TMDB v3 兼容代理，免 API Key**，无加密/签名/反爬 |
| 备用 API | `https://api.tubiii.com/`（同站多域） |
| 字幕接口 | `https://sub.wyzie.io` |
| 图片 CDN | `https://image.tmdb.org/t/p/{size}/` 与 `https://media.themoviedb.org/t/p/` |
| 视频播放器 | 第三方 iframe：`vidsrcme.ru/embed/...`、`player.videasy.net/...`（外站，不镜像） |
| i18n | 10 种语言（de, en, es, fr, hi, ja, ko, pt, ru, zh），`/i18n/{lang}.json` |
| 反爬 | 无 Cloudflare 验证、无 JS 加密、无签名算法；仅需普通 UA 即可访问 |
| 特殊路由 | `/anime` = tv + genre=16；`/topics/:id` = discover/movie?with_keywords=xxx |

**注意**：TMDB 协议有原生 **500 页（10000 条）** 上限，脚本默认按"年份×genre"切片绕过，`--full` 模式会按 `genre × year(1900-2026)` 全部切片覆盖上百万条目。

## 目录结构

```
indielens_dump/
├── index.json                      # 总索引（统计/路由/配置）
├── site/                           # 前端静态镜像
│   ├── index.html                  # 入口 HTML（含内联关键 CSS）
│   ├── main-Q77O7MF6.js            # 主 bundle（960KB）
│   ├── polyfills-7R4CRVNH.js       # polyfills
│   ├── styles-PTW22QSW.css         # 样式
│   ├── monetag.js                  # 广告脚本
│   ├── no-image.svg / no-photo.svg # 占位图
│   ├── sites/indielens/            # 站点品牌资源（brand.svg/favicon/manifest）
│   ├── _external/cdnjs.cloudflare.com/.../animate.min.css
│   └── i18n/{de,en,es,fr,hi,ja,ko,pt,ru,zh}.json
└── api/
    ├── configuration/countries.json     # 251 个国家
    ├── genres/{movie,tv,anime}.json     # 类型分类
    ├── trending/trending.json           # day/week × movie/tv/all
    ├── topics/topics.json               # 25 个主题（含作品列表）
    ├── search/{q}.json                  # 搜索 demo
    ├── discover/slices.json             # 切片索引
    ├── person/popular.json              # 热门人物
    ├── movies/{id}.json                 # 电影详情（含videos/images/keywords/credits/similar/recommendations/reviews）
    ├── tv/{id}.json                     # 剧集详情
    ├── tv/seasons/{tv_id}_{n}.json      # 季详情
    ├── persons/{id}.json                # 人物详情（含combined_credits/images）
    └── collections/{id}.json            # 合集详情
```

## 使用方法

```bash
# 安装依赖
pip install requests tqdm

# 1) 默认模式（推荐快速体验）：静态资源 + 约 200 movie + 200 tv + 300 person + 所有 topics
python3 indielens_scraper.py

# 2) 带海报/剧照下载（输出会明显变大，时间增加）
python3 indielens_scraper.py --out ./indielens_full --concurrency 8

# 3) 全量抓取（按 genre×year 切片绕过 500 页上限，耗时数小时，产出 ~百万条元数据）
python3 indielens_scraper.py --full --out ./indielens_mega --concurrency 12

# 4) 指定语言、限速、并发
python3 indielens_scraper.py --lang zh-CN --concurrency 6 --rate-limit 0.2 --no-images
```

### 参数

| 参数 | 默认 | 说明 |
|------|------|------|
| `--out` | `./indielens_dump` | 输出目录 |
| `--concurrency` | 6 | 并发线程数 |
| `--rate-limit` | 0.15 | 单线程最小请求间隔（秒） |
| `--no-images` | off | 不下载图片（仅拉取元数据） |
| `--lang` | `en-US` | API 语言（TMDB 语言代码） |
| `--full` | off | 全量模式（百万级条目） |

## 本次样例抓取统计

- movies 详情：**193** 部
- tv 详情：**200** 部
- tv 季详情：**59** 个
- person 详情：**300** 位（按出现频次 top300）
- collection 合集：**67** 个
- topics 主题：**25** 个（每个 40 条作品）
- trending 榜单：6 组（day/week × movie/tv/all）
- i18n 语言包：**10** 个
- 站点静态资源：**21** 个
- 总体积：约 **85 MB**（未含图片）

## "解密" 说明

经过完整逆向，indielens.org **没有任何加密/混淆/签名逻辑**：
1. API 是对 TMDB 的公开透传代理，无需 token 即可访问，请求路径、参数、响应格式与 TMDB v3 完全一致；
2. 前端 main.js 为标准 Angular AOT 编译产物（变量名被压缩但字符串、URL、参数结构完整保留），通过静态分析即可还原全部接口；
3. Topics 页的关键词 id 列表硬编码在 main bundle 中（已硬编码入脚本的 `TOPICS` 常量）；
4. Anime 路由只是 TV discover + `with_genres=16`（Animation）；
5. 视频播放通过 iframe 嵌入第三方站点（vidsrcme / videasy），真正的视频源不在 indielens.org 本站。

如需扩展抓取范围（例如抓所有年份、下载所有图片），直接使用 `--full` 参数或调整脚本中 `YEARS`/`max_pages_per_slice` 即可。
