# 七味网 (pkavi.com) 全站爬虫使用说明

## 功能特性

- ✅ **完美逆向解密**：还原网站 player.js 中的三种加密逻辑
  - `encrypt=0`：明文直出
  - `encrypt=1`：unescape URL解码
  - `encrypt=2`：Base64解码 + unescape
- ✅ **全站爬取**：自动遍历电影/剧集/综艺/动漫/短剧全部分类
- ✅ **自动分页**：智能识别总页数，支持断点续爬
- ✅ **详情解析**：标题、年份、导演、编剧、主演、类型、地区、语言、豆瓣/IMDB评分、简介、封面
- ✅ **播放源解析**：自动解析每个播放源每一集的真实m3u8地址（西瓜/天堂/暴风/非凡/如意/ikun/量子/奇异/牛牛/猫眼/无尽/光速/红牛等13+线路）
- ✅ **磁力链接**：自动提取迅雷磁力下载链接
- ✅ **反爬策略**：随机UA、请求延迟、自动重试、支持代理
- ✅ **数据导出**：JSON + CSV 双格式输出
- ✅ **视频下载**：可选调用ffmpeg下载m3u8视频为本地mp4文件

## 安装依赖

`pip install requests beautifulsoup4 lxml`\
\
`# 如需下载视频，安装ffmpeg:`\
`# Ubuntu/Debian:  sudo apt install ffmpeg`\
`# macOS:         brew install ffmpeg`\
`# Windows:       从 https://ffmpeg.org 下载并加入PATH`

## 快速开始

`# 1. 快速解析单个影片（推荐先测试）`\
`python pkavi_spider.py --url https://www.pkavi.com/mv/469621.html`\
\
`# 2. 快速解析单个播放页（直接获取m3u8地址）`\
`python pkavi_spider.py --url https://www.pkavi.com/py/469621-12-1.html`\
\
`# 3. 爬取全站（所有分类）`\
`python pkavi_spider.py`\
\
`# 4. 只爬电影分类，每个分类最多5页`\
`python pkavi_spider.py --types 1 --max-page 5`\
\
`# 5. 爬取多个分类`\
`python pkavi_spider.py --types 1 2 4   # 电影+剧集+动漫`\
\
`# 6. 爬取并下载视频（需要ffmpeg）`\
`python pkavi_spider.py --types 1 --max-page 3 --download`\
\
`# 7. 使用代理`\
`python pkavi_spider.py --proxy http://127.0.0.1:7890`\
\
`# 8. 调整速度`\
`python pkavi_spider.py --delay 2 --workers 3`

## 参数说明

| 参数 | 默认值 | 说明 |
| --- | --- | --- |
| `--types` | 全部(1,2,3,4,30) | 分类ID：1=电影 2=剧集 3=综艺 4=动漫 30=短剧 |
| `--max-page` | 全部页 | 每个分类最大爬取页数 |
| `--delay` | 1.5秒 | 请求间隔秒数（越小越快，建议≥1） |
| `--workers` | 3 | 并发线程数（建议≤5） |
| `--download` | 否 | 同时下载视频（需ffmpeg） |
| `--proxy` | 无 | HTTP/HTTPS代理地址 |
| `--output` | pkavi_data | 输出目录 |
| `--url` | 无 | 快速解析单个URL，不启动全站爬取 |

## 输出文件

运行后在 `pkavi_data/` 目录生成：

- `all_movies.json` — 完整结构化数据（含所有字段和m3u8地址）
- `all_movies.csv` — 表格格式，方便Excel打开
- `progress.json` — 断点续爬进度文件（中断后重新运行会自动跳过已爬的影片）
- `videos/` — （可选）下载的视频文件

## JSON数据结构示例

`{`\
`  "id": 469621,`\
`  "title": "欢迎来龙餐馆",`\
`  "year": "2026",`\
`  "director": ["文牧野"],`\
`  "writer": ["文牧野", "郎群力", "钟伟"],`\
`  "actors": ["沈腾", "蒋奇明", ...],`\
`  "category": ["剧情", "战争", "人性"],`\
`  "area": ["大陆"],`\
`  "language": ["国语", "阿拉伯语", "英语"],`\
`  "douban_rating": "8.7",`\
`  "imdb_rating": "8.3",`\
`  "description": "...",`\
`  "cover": "https://...",`\
`  "play_sources": [`\
`    {`\
`      "source_id": 1,`\
`      "source_name": "西瓜",`\
`      "episodes": [`\
`        {`\
`          "ep_name": "HD国语",`\
`          "ep_id": 1,`\
`          "ep_url": "https://www.pkavi.com/py/469621-1-1.html",`\
`          "video_url": "https://vip.dytt-see.com/.../index.m3u8",`\
`          "encrypt_level": 0`\
`        }`\
`      ]`\
`    }`\
`  ],`\
`  "magnet_links": [`\
`    {"name": "...", "url": "magnet:?xt=urn:btih:..."}`\
`  ]`\
`}`

## 逆向解密原理

网站 player.js 中的 MacPlayer.Init() 解密逻辑：

`if (player_data.encrypt == '1') {`\
`    player_data.url = unescape(player_data.url);`\
`} else if (player_data.encrypt == '2') {`\
`    player_data.url = unescape(base64decode(player_data.url));`\
`}`

爬虫完整还原了以上三种加密模式，使用括号匹配法精确提取 `player_aaaa={...}` JSON对象，完美处理所有加密情况。

## 注意事项

1. 请遵守目标网站robots.txt和相关法律法规，仅用于个人学习研究
2. 建议设置合理的请求延迟（≥1秒），避免对目标服务器造成压力
3. 视频m3u8地址有时效性，爬取后请尽快使用
4. 部分播放源可能因地区或版权限制无法访问，可尝试其他播放源
5. 如遇爬取失败可适当增大delay、减少workers或使用代理