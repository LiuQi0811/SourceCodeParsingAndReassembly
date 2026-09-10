# 次元城动画 (cycani.org) 全站爬虫

## 逆向分析说明（2026-09-10）

- 站点是 **React + Vite** 构建的 SPA。前端代码通过 `__vite__mapDeps` 进行代码分割，核心 JS 主 bundle：`/assets/index-BysvtvH-.js`。
- 所有元数据接口均为 **RESTful JSON** 接口，**无任何加密/混淆**，返回标准格式 `{code, msg, data}`（code=0 代表成功）。
- 公共请求头必须带：
  - `X-App-Name: cyc_web`
  - `X-App-Version: cycweb`
  - `X-Time-Zone: Asia/Shanghai`
  - `Referer: https://www.cycani.org/`（拉取 JS chunk、图片 CDN 时需要）
- 视频真实播放地址接口 `/api/v2/sections/{section_id}/play-url` **需要登录 Bearer Token**，返回的 URL 为标准 HLS(m3u8)/DASH(mpd)，视频流本身 **无 DRM 加密**，可直接用 ffmpeg/yt-dlp 下载。
- 图片使用 `gimg1.baidu.com` 反代，真实地址在查询参数 `src=` 里（形如 `img2.cycimg.me/pic/...`）。爬虫已自动解析并从源站下载。
- 列表、选集分页 `page_size` 上限 100；弹幕 `segment_index` 必须 ≥ 1（不传则返回全部分段）。

## 已覆盖接口

| 接口 | 用途 | 是否需登录 |
|------|------|-----------|
| `GET /api/video-zones` | 分区列表（TV番组 / 剧场番组 + 筛选项） | 否 |
| `GET /api/app/adverts?position=banner` | 首页 Banner 广告 | 否 |
| `GET /api/index/recommend` | 首页推荐分区 + 推荐番剧 | 否 |
| `GET /api/index/weekday` | 周表（新番更新表） | 否 |
| `GET /api/ranks` | 榜单分类 | 否 |
| `GET /api/ranks/{id}/videos` | 榜单内番剧 | 否 |
| `GET /api/videos?zone_id=&page=&page_size=&tag=&area=&language=&year=&order_by=` | 分类/分区翻页 | 否 |
| `GET /api/videos/search?q=&page=` | 搜索 | 否 |
| `GET /api/videos/{id}` | 番剧详情 | 否 |
| `GET /api/videos/{id}/sections?player_code=&page=&page_size=` | 选集列表 | 否 |
| `GET /api/videos/{id}/comments?order_by=time&page=&page_size=` | 评论（含回复） | 否 |
| `GET /api/videos/{id}/recommendations?limit=` | 相关推荐 | 否 |
| `GET /api/sections/{id}/danmaku` | 弹幕 | 否 |
| `GET /api/v2/sections/{id}/play-url` | **视频真实播放地址** | **是（Bearer Token）** |

> 登录相关接口（`/auth/login`、`/auth/refresh`、`/user/favorites`、`/user/histories` 等）已在前端代码中逆向出来，但因涉及账号密码和播放历史等私有数据，本爬虫默认不采集。

## 快速开始

```bash
# 1. 安装依赖
pip install requests

# 2. 单部番剧测试（例如 ID=3829）
python3 cycani_crawler.py --only-video 3829 -o ./cycani_data --comment-pages 1

# 3. 全站抓取（建议调低并发，避免被封）
python3 cycani_crawler.py -o ./cycani_data -w 3 --page-size 50 --comment-pages 2

# 4. 全站抓取 + 获取播放地址（需要你自己的登录 Token）
#    获取方式：浏览器登录后 F12 → Network → 任意 api 请求 → 复制 Authorization: Bearer xxx 里的 xxx
python3 cycani_crawler.py -o ./cycani_data -t "你的Token" -w 3

# 5. 可选：根据 play_url 下载视频（需要安装 yt-dlp 和 ffmpeg）
#    结果里的 detail.json 的 play_urls[section_id] 会返回 {name, url}，
#    脚本里已内置 download_video_from_playurl() 函数可以直接调用。
pip install yt-dlp
# 系统需安装 ffmpeg
```

## 输出目录结构

```
cycani_data/
├── metadata/
│   ├── zones.json          # 分区列表
│   ├── home.json           # 首页 Banner/推荐/周表/榜单
│   ├── all_video_ids.json  # 全站番剧 ID 汇总
│   └── index.json          # 所有番剧的精简索引（标题/标签/评分/热度/封面本地路径）
├── images/
│   ├── covers/             # 番剧封面
│   └── ads/                # Banner/广告图
├── videos/
│   └── {video_id}/
│       └── detail.json     # 详情 + 选集 + 弹幕 + 评论 + 推荐 + play_url
└── static/                 # 镜像的前端 SPA 入口（index.html + assets）
```

`detail.json` 结构示例：

```json
{
  "detail":        { /* 番剧元数据：标题/简介/封面/导演/声优/标签/评分/热度... */ },
  "sections_by_source": {
    "cychub": { "title": "CYC_Main", "sections": [ {"id": 51301, "title": "第01集"}, ... ] }
  },
  "danmaku":       { "51301": [ {"id","user_id","content","time_point","mode","color","create_time"}, ... ] },
  "comments":      [ ... ],
  "recommendations": [ {"video_id","title","cover_url",...} ],
  "play_urls":     { "51301": {"name": "...", "url": "https://...m3u8"} },   // 仅当传 -t 时填充
  "local":         { "cover": "images/covers/xxx.jpg" }
}
```

## 常用参数

| 参数 | 说明 | 默认 |
|------|------|------|
| `-o, --out` | 输出目录 | `./cycani_data` |
| `-t, --token` | 登录 Bearer Token（可选，用于获取播放地址） | 无 |
| `-w, --workers` | 并发线程数 | 4 |
| `--page-size` | 列表分页大小（最大 100） | 50 |
| `--no-images` | 不下载图片 | 否 |
| `--no-danmaku` | 不抓弹幕 | 否 |
| `--no-comments` | 不抓评论 | 否 |
| `--comment-pages` | 每部最多抓多少页评论（每页 50） | 3 |
| `--only-video ID` | 只抓单部番剧（调试用） | 无 |

## 反爬/限流注意

- 内置 250ms 请求间隔、3 次自动重试、429 自动等待 5s。
- 建议 `-w 2~4` 慢爬，避免给站方造成压力。
- 如需下载视频文件，请使用自己账号的 Token，尊重版权，仅供个人学习研究使用。
