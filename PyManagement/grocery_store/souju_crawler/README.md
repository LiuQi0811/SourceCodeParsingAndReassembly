# 搜剧AI (ai.baipiaozhe.com / souju.ai) 全站爬虫

## 逆向说明

本项目已完美完成前端HMAC-SHA256签名算法的逆向还原，无需浏览器即可直接调用所有API。

### 签名机制 (已逆向)

前端JS将签名逻辑打包在动态chunk `assets/movie-card-runtime-DAvo4EEk.js` 中，
通过 `Headers.prototype.set` 动态注入以下请求头：

| Header | 值说明 |
|--------|--------|
| `x-ai-movie-build-version` | 前端构建版本号 |
| `x-ai-movie-client-name` | 客户端标识 `movie-search-frontend` |
| `x-ai-movie-client-version` | 客户端版本 `1.0.0` |
| `x-ai-movie-protocol-version` | API协议版本 |
| `x-ai-movie-timestamp` | 当前时间戳(毫秒) |
| `x-ai-movie-nonce` | 16字节随机数(hex, 32字符) |
| `x-ai-movie-signature` | **HMAC-SHA256签名** |

**签名算法还原**：

```
签名串 = "{HTTP_METHOD}\n{PATH}{QUERY}\n{TIMESTAMP_MS}\n{NONCE}"
签名   = HMAC_SHA256_HEX(HARDCODED_SECRET, 签名串)
```

- HMAC密钥（硬编码在JS chunk中）：`f39d73aa7a6426203cdee1ef17b31d3b7ea8c23f4c59c62a3a8aa0f39ee5e79d`
- **注意**：请求body不参与签名计算！
- Query参数必须经过URL编码（与浏览器URLSearchParams编码一致）
- 播放源ticket二次解析（JWT换取m3u8）也是普通POST请求，使用相同签名即可

### 关于视频流

所有播放线路解析后直接返回**明文m3u8直链**，无需额外解密：
- 部分线路的m3u8是标准HLS AES-128加密（密钥在m3u8同目录），ffmpeg原生支持自动解密下载
- 已实测66条线路均可正常获取真实m3u8地址

## 环境要求

- Python 3.8+
- 依赖库：`requests`
- 可选：`ffmpeg`（用于将m3u8下载保存为mp4）

```bash
pip install requests
# 如需下载视频：
#   apt install ffmpeg      (Debian/Ubuntu)
#   brew install ffmpeg     (macOS)
```

## 使用方法

### 1. 命令行工具

```bash
# 搜索影视
python souju_crawler.py search "凡人修仙传"
python souju_crawler.py search "蜘蛛侠" --pages 5

# 获取影片详情、剧集列表，并解析所有播放源
python souju_crawler.py detail <variant_id>
python souju_crawler.py detail av_4LkwDmEzlCeauSiddbiSYLi3KptCQXcAAHFJW1phBULRblgs-71m4X0TdMbXZ3q7h0HCtRNYmOEbTn4 --ep 0

# 获取详情+解析播放源+调用ffmpeg下载为mp4
python souju_crawler.py detail <variant_id> --ep 0 --download

# 获取短剧推荐流
python souju_crawler.py shortdrama

# 全站抓取(仅片库列表元数据，保存为JSON)
python souju_crawler.py crawl -o movies.json --max-pages 20

# 全站抓取(含详情、剧集列表、m3u8播放源)
python souju_crawler.py crawl -k "电影" -o full_data.json --max-pages 5 --episodes --playback
```

### 2. 作为Python库调用

```python
from souju_crawler import SoujuCrawler, download_m3u8

crawler = SoujuCrawler()

# 搜索
results = crawler.search("凡人修仙传", page=1, limit=20)
for card in results["cards"]:
    print(card["title"], card["year"], card["id"])

# 详情 + 剧集
detail = crawler.get_detail("av_4LkwDmEzlCeauSiddbiSYLi3KptCQXcAAHFJW1phBULRblgs-71m4X0TdMbXZ3q7h0HCtRNYmOEbTn4")
episodes = crawler.get_all_episodes("av_4LkwDmEzlCeauSiddbiSYLi3KptCQXcAAHFJW1phBULRblgs-71m4X0TdMbXZ3q7h0HCtRNYmOEbTn4")

# 解析播放源 -> 拿到明文m3u8
first_ep_token = episodes[0]["token"]
play_urls = crawler.get_playback_urls(first_ep_token)
for src in play_urls:
    if src["resolved"]:
        print(f"{src['provider']}: {src['url']}")

# 下载 (需ffmpeg)
best_url = play_urls[0]["url"]
download_m3u8(best_url, "凡人修仙传_第1集.mp4")
```

## 已封装API接口列表

| API | 方法 | 说明 |
|-----|------|------|
| `search(keyword, page, limit)` | GET | 关键词搜索 |
| `browse_catalog(...)` | GET | 片库浏览（支持分页/类型/年份/地区过滤） |
| `iterate_catalog(...)` | GET | 自动翻页迭代器 |
| `get_detail(variant_id)` | GET | 获取影片详情 |
| `get_episodes(variant_id)` | GET | 获取剧集列表 |
| `get_all_episodes(variant_id)` | GET | 获取全部剧集（自动翻页） |
| `resolve_playback(episode_token)` | GET | 解析播放（获取所有线路） |
| `resolve_line(ticket)` | POST | 二次解析ticket为真实m3u8 |
| `get_playback_urls(episode_token)` | - | 一步获取所有线路明文m3u8 |
| `short_drama_feed(limit)` | GET | 短剧推荐流 |
| `calendar(date)` | GET | 追剧日历 |
| `get_danmaku_source(episode_id)` | GET | 弹幕源 |
| `get_comments(variant_id)` | GET | 评论列表 |
| `create_thread(title, metadata)` | POST | 创建AI搜索会话线程 |

## 文件说明

- `souju_crawler.py` — 爬虫主程序（含签名逆向、CLI、全站抓取、ffmpeg下载）
- `index.js` — 下载的主站前端JS（用于分析）
- `movie-card-runtime.js` — 下载的签名chunk JS（签名密钥/算法来源）
- `sw.js` — 下载的Service Worker脚本

## 免责声明

本工具仅用于学习研究Web前端安全与逆向技术，请勿用于商业用途或大规模爬取。
使用请遵守目标网站robots.txt协议及相关法律法规。
