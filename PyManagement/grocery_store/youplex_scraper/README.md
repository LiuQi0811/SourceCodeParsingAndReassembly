# Youplex.site 全站抓取工具

> 结论先行：**youplex.site 自身没有任何加密/解密逻辑**。
> - 站点是 Next.js (App Router + Turbopack + RSC) SSR 应用，所有影片元数据直连 TMDB 官方 API，前端代码里明文内置了 TMDB Bearer Token；
> - 播放页只是把第三方播放器（VidLink / VidNest / VidFast / VidEasy / Vidsrc / Vidup / Rive）通过固定模板拼成 `<iframe>` 塞进页面，无签名、无加密参数；
> - 视频本体由第三方平台托管，本工具负责从 youplex 页面解析出所有可播放 iframe 直链（每个影片会给出全部 8 个 server 的 URL）。如果某第三方源本身有 DRM，那是第三方的行为，不属于 youplex 的"加密"。

## 功能

1. **静态镜像**：BFS 全站爬取 `https://youplex.site/` 下所有 HTML/CSS/JS/图片/字体，保存到 `output/site/`。
2. **全站元数据**：通过从站点 JS 中提取的 TMDB Bearer Token，抓取 trending/popular/top_rated/now_playing/upcoming/airing_today/on_the_air 等 12 个列表，再并发拉取每部影片的详情（含 credits/videos/images/similar/recommendations/keywords/external_ids）。
3. **播放源解析**：
   - 对每部电影生成全部 8 个第三方 server 的播放页 URL（`server/movie/{tmdbId}`）；
   - 对每部剧集按季×集生成（`server/tv/{tmdbId}/{season}/{episode}`）；
   - 额外请求 youplex 的 `/watch/...` 页面，把 SSR 直接返回的默认 iframe URL 兜底收录；
4. **图片**：下载所有海报到 `output/images/`。
5. **本地索引**：生成 `output/index.html`，浏览器直接打开即可浏览镜像 + 一键跳转播放。

## 安装

```bash
pip install -r requirements.txt
```

## 使用

```bash
# 默认：静态页 + TMDB 全量目录 + 播放源 + 海报
python scraper.py --out ./youplex_output

# 仅抓 youplex 站点自身页面
python scraper.py --static-only

# 每类列表抓 3 页（快速预览）
python scraper.py --pages 3

# 额外自定义搜索
python scraper.py --search "batman" "inception"

# 不下载图片
python scraper.py --no-media
```

## 输出目录

```
youplex_output/
├── site/               # youplex 静态页镜像
├── data/               # TMDB 元数据 JSON
│   ├── genres.json
│   ├── list_*.json     # 各类列表
│   ├── search.json
│   └── details/        # 每部影片的完整详情 JSON
├── watch/              # 每部影片的播放源解析结果
│   ├── movie_*.json
│   └── tv_*.json
├── images/             # 海报
├── catalog.json        # 全量目录清单（id/标题/评分/类型...）
└── index.html          # 本地浏览入口
```

每个 `watch/movie_<id>.json` 结构示例：

```json
{
  "url": "https://youplex.site/watch/movie/avengers-endgame?id=299534",
  "title": "Watch Avengers: Endgame - Youplex",
  "media_type": "movie",
  "tmdb_id": 299534,
  "servers": [
    {"server_id": "vidlink",   "server_name": "Server 1 (VidLink Pro)", "iframe": "https://vidlink.pro/movie/299534"},
    {"server_id": "vidsrc_to", "server_name": "Server 2 (VIP)",         "iframe": "https://vidsrc.to/embed/movie/299534"},
    {"server_id": "videasy",   "server_name": "Server 3 (VidEasy)",     "iframe": "https://player.videasy.net/movie/299534"},
    {"server_id": "vidsrc_me", "server_name": "Server 4 (Vidsrc)",      "iframe": "https://vsembed.ru/embed/movie/299534"},
    {"server_id": "vidup",     "server_name": "Server 5 (Vidup)",       "iframe": "https://vidup.to/movie/299534"},
    {"server_id": "rivestream","server_name": "Server 6 (Rive)",        "iframe": "https://rivestream.org/embed/movie/299534"}
  ]
}
```

## 逆向说明（供学习）

1. 用浏览器/curl 打开首页 → 发现是 Next.js + Turbopack，HTML 无 5 秒盾。
2. `/watch/...` 页面 SSR 里直接出现 `<iframe src="https://player.videasy.net/movie/299534">`，首屏即暴露默认播放器。
3. 下载 `_next/static/chunks/*.js`：
   - `0w3.kbi2j51mu.js` 内 `axios.create({baseURL:"https://api.themoviedb.org/3"})`，拦截器里设置 `Authorization="Bearer eyJhbGciOiJIUzI1NiJ9...."`，即 TMDB v3 Read Access Token；
   - `055sxhtb_rad8.js` 里 `er=[{id:"vidlink",...},{id:"vidsrc_to",...},...]` 定义了全部 8 个播放 server，URL 模板为 `` `${baseUrl}/movie/${tmdbId}` `` / `` `${baseUrl}/tv/${tmdbId}/${season}/${episode}` ``。
4. 站点没有 `/api/` 数据层调用（分页靠客户端 fetch TMDB 官方接口），因此没有签名/加密可逆——所有参数就是公开的 TMDB ID。

## 注意事项

- 请遵守 youplex.site 与 TMDB 的使用条款；本脚本仅作技术学习演示，抓取频率已做并发与退避控制。
- 第三方播放器（vidsrc/vidlink 等）若做了反盗链/DRM，需要你在浏览器/播放器侧处理 Referer、User-Agent 或解密 m3u8 key，这部分与 youplex 无关。
- 脚本会并发请求，请合理设置 `--pages` 控制抓取量。
