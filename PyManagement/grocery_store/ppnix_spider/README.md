# PPnix 全站爬虫 (ppnix_spider.py)

针对 https://www.ppnix.com/cn/ 中文站的全站爬虫，自动抓取电影和电视剧的全部列表、详情元数据及 m3u8 播放地址。

## 特性

- ✅ **全站覆盖**：电影 + 电视剧自动翻页抓取（支持 `--max-pages` 限制）
- ✅ **元数据解析**：标题（含原名）、年份、评分、导演、主演、类型、地区、简介、集数
- ✅ **播放地址提取**：通过逆向站点播放器接口 `/info/m3u8/{id}/{ep}.m3u8`，直接拿到 m3u8 直链
  - 电影：按清晰度输出（如 1080P）
  - 电视剧：按集数输出每一集的 m3u8 直链
- ✅ **多线程**：详情页多线程并发抓取，速度可调
- ✅ **断点续爬**：默认开启，中断后再次运行会基于已保存 JSON 增量抓取
- ✅ **随机 UA + 限速 + 重试**：降低被风控概率
- ✅ **代理支持**：`--proxy http://127.0.0.1:7890`
- ✅ **封面下载**：`--download-cover` 可选下载海报到本地
- ✅ **输出 JSON + CSV**：结构化数据便于后续处理

## 环境依赖

`pip install requests beautifulsoup4`

## 使用方法

`# 1) 完整全站抓取（电影+电视剧全部页面，默认5线程）`\
`python ppnix_spider.py`\
\
`# 2) 仅抓电影，每个类别最多 3 页，8 线程`\
`python ppnix_spider.py --movies-only --max-pages 3 --workers 8`\
\
`# 3) 仅抓电视剧，并下载封面`\
`python ppnix_spider.py --tv-only --download-cover`\
\
`# 4) 只抓列表（不访问详情页，最快速度拿全站片名+ID）`\
`python ppnix_spider.py --list-only`\
\
`# 5) 使用代理`\
`python ppnix_spider.py --proxy http://127.0.0.1:7890`\
\
`# 6) 自定义输出目录`\
`python ppnix_spider.py -o ./my_ppnix_data`

## 输出结构

`ppnix_data/`\
`├── list.json       # 全站列表 [{id,title,year,cover,cate,url}, ...]`\
`├── detail.json     # 详情元数据 + 播放源（完整JSON）`\
`├── detail.csv      # 同上的扁平表格版（Excel可直接打开）`\
`└── covers/         # 封面图（--download-cover 时生成）`

### detail.json 字段示例

**电影：**

`{`\
`  "id": 8501,`\
`  "cate": "movie",`\
`  "title": "四渡",`\
`  "year": 2026,`\
`  "rating": 4.4,`\
`  "director": ["徐展雄"],`\
`  "actors": ["刘烨", "王雷", "于适", "..."],`\
`  "genres": ["历史", "战争"],`\
`  "regions": ["中国大陆"],`\
`  "description": "...",`\
`  "cover": "https://...",`\
`  "play_sources": [`\
`    {`\
`      "name": "PPnix-movie",`\
`      "type": "m3u8",`\
`      "url": "https://www.ppnix.com/info/m3u8/8501/1080P.m3u8",`\
`      "qualities": [`\
`        {"quality": "1080P", "url": "https://www.ppnix.com/info/m3u8/8501/1080P.m3u8"}`\
`      ]`\
`    }`\
`  ]`\
`}`

**电视剧：**

`{`\
`  "id": 8502,`\
`  "cate": "tv",`\
`  "title": "韩国制造 第二季",`\
`  "year": 2026,`\
`  "rating": 0.0,`\
`  "play_sources": [`\
`    {`\
`      "name": "PPnix-tv",`\
`      "type": "m3u8",`\
`      "url": "https://www.ppnix.com/info/m3u8/8502/1.m3u8",`\
`      "episodes": [`\
`        {"num": 1, "name": "1", "url": "https://www.ppnix.com/info/m3u8/8502/1.m3u8"},`\
`        {"num": 2, "name": "2", "url": "https://www.ppnix.com/info/m3u8/8502/2.m3u8"}`\
`      ]`\
`    }`\
`  ]`\
`}`

## 参数说明

| 参数 | 说明 | 默认值 |
| --- | --- | --- |
| `-o/--out` | 输出目录 | `ppnix_data` |
| `--movies-only` | 仅抓电影 | 关 |
| `--tv-only` | 仅抓电视剧 | 关 |
| `--list-only` | 只抓列表，不抓详情/播放源 | 关 |
| `--max-pages N` | 每个类别最多抓 N 页（0=全部） | 0 |
| `--workers N` | 详情抓取线程数 | 5 |
| `--sleep MIN MAX` | 随机请求间隔（秒） | 0.5 1.5 |
| `--download-cover` | 下载封面海报 | 关 |
| `--proxy URL` | HTTP/HTTPS 代理 | 无 |
| `--resume/--no-resume` | 是否断点续爬 | 开启 |

## 注意事项

1. 输出的 m3u8 链接本身带 AES-128 加密，需支持 HLS 的播放器（VLC / MPV / PotPlayer / N_m3u8DL-CLI 等）方可播放。
2. 爬取时请控制频率（默认 `--sleep 0.5 1.5`），对目标站点友好。
3. 仅供学习与个人使用，请遵守目标网站的 robots.txt 与当地法律法规。