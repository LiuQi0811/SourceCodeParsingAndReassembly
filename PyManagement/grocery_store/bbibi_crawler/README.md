# bbibi.cc (4K在线) 全站爬虫

## 逆向分析结论

经浏览器抓包与源码分析，**该站视频源无需任何逆向解密**：

| 项目 | 结论 |
| --- | --- |
| 加密方式 | **无加密**，视频地址明文输出 |
| 播放器 | iframe 嵌套，`/js/player/mtm3u8.html` |
| 真实m3u8获取 | 播放页 HTML 内嵌 JS 变量：`var now="https://xxx/index.m3u8";` |
| 第三方解析 | iframe 内会把 `now` 传给 `maotai888.vip:966/?url=`，但我们可以直接拿 `now` 直链绕过 |
| 签名/Token | 无 |
| 结论 | 正则直接提取 `var now="(.+\.m3u8[^"]*)"` 即可获得真实播放地址 |

## 站点URL结构（海洋CMS系）

| 页面 | URL规则 |
| --- | --- |
| 首页 | `https://www.bbibi.cc/` |
| 分类列表页 | `/list/?{typeId}.html`（第1页）<br>`/list/?{typeId}-{page}.html`（第N页） |
| 详情页 | `/detail/?{vid}.html` |
| 播放页 | `/video/?{vid}-{from}-{part}.html` |

**主分类ID**：

- 1 = 电影（约2681页）
- 2 = 电视剧
- 3 = 综艺
- 4 = 动漫

## 功能特性

- ✅ 全站分类遍历（电影/电视剧/综艺/动漫，也可自选子分类ID）
- ✅ 列表页分页自动探测（尾页识别）
- ✅ 详情页元数据爬取：标题、封面、年代、地区、导演、主演、类型、简介
- ✅ 多线路分集精确解析（按 `#playlistN` 区块定位，不会串入"猜你喜欢"推荐区）
- ✅ 每集明文m3u8提取（核心正则：`var now="..."`）
- ✅ 断点续爬（`crawl_state.json` 保存已收集vid）
- ✅ 多线程并发、随机延时、自动重试
- ✅ 输出 JSON + CSV（UTF-8-SIG，Excel直接打开不乱码）
- ✅ 可选：调用 ffmpeg 自动下载m3u8为MP4

## 环境依赖

`pip install requests beautifulsoup4`\
`# 如需下载视频：`\
`sudo apt install ffmpeg   # 或 https://ffmpeg.org/download.html`

## 使用方法

### 1. 爬取单部影片（测试用）

`# 只爬取信息和m3u8，不下载`\
`python3 bbibi_crawler.py --mode single --single 213675`\
\
`# 爬取并下载视频（需ffmpeg）`\
`python3 bbibi_crawler.py --mode single --single 213675 --download`

### 2. 小规模试用（只爬前N页）

`# 仅爬电影前2页，并发5线程`\
`python3 bbibi_crawler.py --mode all --cate 1 --max-pages 2 --workers 5`\
\
`# 爬取电影+电视剧各3页`\
`python3 bbibi_crawler.py --mode all --cate 1,2 --max-pages 3 --workers 5`

### 3. 全站爬取

`# 爬取全部4个分类所有页（耗时较长，建议后台运行）`\
`python3 bbibi_crawler.py --mode all --cate 1,2,3,4 --workers 5 --delay 0.8`\
\
`# 分阶段跑：先收完所有vid，再抓详情`\
`python3 bbibi_crawler.py --mode list --cate 1,2,3,4 --workers 5`\
`python3 bbibi_crawler.py --mode detail --workers 3`

### 4. 下载视频

`# 爬取详情并将所有m3u8下载为MP4到 ./downloads/`\
`python3 bbibi_crawler.py --mode all --cate 1 --max-pages 1 --download --video-dir ./downloads`

## 参数说明

| 参数 | 默认值 | 说明 |
| --- | --- | --- |
| `--mode` | `all` | 运行模式：`all`=全站；`list`=只收集vid；`detail`=抓详情+m3u8；`single`=单部 |
| `--cate` | `1,2,3,4` | 要爬的分类ID，逗号分隔 |
| `--max-pages` | 0 | 每个分类最多爬多少页，0=全部 |
| `--workers` | 5 | 并发线程数（详情页爬取时自动减半，防止给服务器过大压力） |
| `--delay` | 0.5 | 请求基础间隔（秒），实际为 0.6\~1.5 倍随机值 |
| `--download` | 关 | 是否调用ffmpeg下载视频为MP4 |
| `--video-dir` | `./downloads` | 视频保存目录 |
| `--single` | \- | 单部影片的URL或vid（mode=single时用） |
| `--output` | `bbibi_all.json` | 结果JSON输出文件名 |

## 输出文件

- `crawl_state.json` —— 爬取状态（已收集的所有vid列表），用于断点续爬
- `bbibi_all.json` —— 所有影片完整结构化数据，含每集m3u8
- `bbibi_all.csv` —— 扁平化的分集表格，便于Excel筛选/导入
- `downloads/` —— 视频保存目录（开启 --download 时）

## 输出数据结构示例

`{`\
`  "vid": "213675",`\
`  "title": "无情的拳头",`\
`  "cover": "https://xxx/cover.webp",`\
`  "year": "2026",`\
`  "area": "马来西亚",`\
`  "genre": "动作片",`\
`  "director": "...",`\
`  "actors": "Mierul Aiman / 艾迪·阿什拉夫 / ...",`\
`  "description": "剧情简介...",`\
`  "category": "电影",`\
`  "play_sources": [`\
`    {`\
`      "source_name": "mtm3u8",`\
`      "vfrom": 0,`\
`      "episodes": [`\
`        {`\
`          "ep_name": "正片",`\
`          "play_url": "https://www.bbibi.cc/video/?213675-0-0.html",`\
`          "vpart": 0,`\
`          "m3u8": "https://vodcnd17.uvjtih.cn/20260910/sfxqIgbC/index.m3u8"`\
`        }`\
`      ]`\
`    },`\
`    {`\
`      "source_name": "iKun资源站",`\
`      "vfrom": 1,`\
`      "episodes": [ /* ... */ ]`\
`    }`\
`  ]`\
`}`

## 注意事项

1. **合法使用**：本爬虫仅用于学习研究，请尊重版权，勿用于商业用途；下载内容请在24小时内删除。
2. **访问礼仪**：已默认加入随机延时；建议 `--workers` 不超过5，`--delay` 不低于0.5秒。
3. **断点续爬**：中断后重新执行同样命令即可，脚本会自动跳过已完成的条目。
4. **视频下载**：m3u8下载依赖ffmpeg；若某线路m3u8为空，可换另一线路的播放源。
5. **站点变动**：若后续站点改版（如加加密、换播放器），需要重新分析 `var now=` 附近的JS逻辑。