# 西瓜卡通 (xgcartoon.com) 全站爬虫

针对 **https://cn1.xgcartoon.com/** 的全站爬虫，经实测完整支持：动漫列表抓取、详情解析、集数枚举、m3u8 视频源解析、视频下载（ffmpeg 合成为 mp4）、封面下载。

## 站点结构（逆向分析结果）

| 资源 | URL 模式 |
|------|---------|
| 首页 / 分类页 | `https://cn1.xgcartoon.com/`，`https://cn1.xgcartoon.com/type/{category}?page=N` |
| 动漫详情页 | `https://cn1.xgcartoon.com/detail/{slug}` |
| 集数跳转 | `GET /user/page_direct?cartoon_id={slug}&chapter_id={eid}` → 302 跳转到播放页 |
| **视频源 API（关键）** | `GET /user/amp/content_pframe_url?chapter_id={eid}&level={low\|middle\|high}&expires=3600`<br>返回 `{"data":"https://pframe.xgcartoon.com/pframe/player.htm?vid={UUID}","result":true}` |
| HLS 视频流 | `https://xgct-video.bzcdn.net/{vid}/playlist.m3u8`（自适应多码率 master playlist） |
| 缩略图 / 封面 | `https://xgct-video.bzcdn.net/{vid}/thumbnail.jpg` |

- `low`=480p，`middle`=720p（免费可看），`high`=1080p/4K（需要 VIP 账号 cookie）
- 视频流为标准 HLS（m3u8 + ts 分片），支持 ffmpeg 直接合并为 mp4

## 快速开始

### 1. 安装依赖

```bash
pip install -r requirements.txt
# 如需下载视频，请先安装 ffmpeg：
#   Ubuntu/Debian:  sudo apt install ffmpeg
#   macOS:          brew install ffmpeg
#   Windows:        从 https://ffmpeg.org/download.html 下载并加入 PATH
```

### 2. 三种运行模式

```bash
# 模式一：仅索引（抓取全部动漫+集数+视频URL，不下载任何媒体文件，最快）
python xg_cartoon_spider.py --index-only

# 模式二：解析视频源 + 下载封面（推荐先跑这个，数据量小）
python xg_cartoon_spider.py -w 8 -o ./xg_data

# 模式三：下载全部视频（m3u8 → mp4，需要 ffmpeg，耗流量/时间/磁盘）
python xg_cartoon_spider.py --download -w 4 -q middle -o ./xg_data
```

### 3. 参数说明

| 参数 | 说明 |
|------|------|
| `-o, --output DIR` | 输出目录，默认 `./xgcartoon_data` |
| `-w, --workers N` | 并发线程数，默认 4（下载视频时建议不超过 8） |
| `-q, --quality` | 清晰度：`low`(480p) / `middle`(720p，默认) / `high`(需VIP) |
| `--index-only` | 仅抓索引，不解析视频源、不下载 |
| `--download, -d` | 下载所有视频（mp4） |
| `--no-covers` | 不下载封面缩略图 |

## 输出结构

```
xgcartoon_data/
├── index.json          # 索引（动漫+集数列表）
├── full_data.json      # 完整数据（含每集 vid/m3u8/本地路径）
├── covers/
│   └── {动漫标题}/
│       ├── 第01话.jpg
│       └── ...
└── videos/
    └── {动漫标题}/
        ├── 第01话.mp4
        └── ...
```

`full_data.json` 单集数据示例：
```json
{
  "episode_id": "NrXmB8alFd",
  "cartoon_slug": "xianniguoyu-qieyingshi",
  "title": "第01话",
  "play_url": "https://www.cnxgct.com/video/xianniguoyu-qieyingshi/NrXmB8alFd.html",
  "vid": "52c2f320-d711-4368-995c-97ad843a89e7",
  "m3u8": "https://xgct-video.bzcdn.net/52c2f320-d711-.../playlist.m3u8",
  "thumbnail": "https://xgct-video.bzcdn.net/52c2f320-d711-.../thumbnail.jpg",
  "cover_local": ".../covers/仙逆【国语】（4K）/第01话.jpg",
  "video_local": ".../videos/仙逆【国语】（4K）/第01话.mp4"
}
```

## 工作原理

1. **列表采集**：遍历首页 + 所有分类页（自动翻页直到结果为空），通过 `/detail/xxx` 链接收集全站动漫。
2. **详情解析**：进入每部动漫详情页，从 `/user/page_direct?cartoon_id=...&chapter_id=...` 链接解析所有集数 ID，并自动按集号排序。
3. **视频源解析**：对每一集调用站点内部 API `/user/amp/content_pframe_url` 获取播放器 iframe URL（内含 vid UUID），再拼接 CDN 上的 m3u8 地址。
4. **增量断点**：每抓完一部动漫就写一次 `full_data.json`，中断后重跑会跳过已存在的本地文件。
5. **限速 + 重试**：默认请求间隔 0.25s，失败自动重试 3 次，避免对服务器造成压力。

## 注意事项

- 仅供个人学习/备份使用，请尊重版权，遵守目标站使用条款与当地法律法规。
- 单部动漫（如仙逆 157 集 720p）约 20~30GB，全站下载前请确认磁盘空间。
- 若 `--quality high` 返回错误，说明当前 IP/账号没有 VIP 权限，请改用 `middle`。
- 站点可能随时更新前端结构，如视频源解析失败，请提 issue 并附具体动漫 URL。
