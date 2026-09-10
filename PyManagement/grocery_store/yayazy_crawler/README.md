# 丫丫资源网 (yayazy1.com) 全站爬虫

## 站点逆向结论

经实测页面分析，该站点基于 **苹果CMS (MacCMS)** 搭建，使用 `yayazy` 模板：

- **无 JS 加密/混淆**：播放源 m3u8 地址直接以明文（形如 `第01集$https://v14.rstuuv.com/.../index.m3u8`）写在详情页 HTML 中，没有任何加密、签名或播放器二次跳转需要逆向。
- **无登录/付费墙/验证码**：全站资源公开可访问。
- **URL 规律清晰**：
  - 首页：`https://yayazy1.com/`
  - 分类列表：`/index.php/vod/type/id/{cid}.html`、分页 `/index.php/vod/type/id/{cid}/page/{n}.html`
  - 详情页：`/index.php/vod/detail/id/{vid}.html`
- 因此**不需要任何逆向解密**，`requests + BeautifulSoup` 直接 HTML 解析即可。

## 功能

1. 自动扫描首页导航，抓取所有一级/二级分类（电影、电视剧、综艺、动漫、短剧、伦理等）。
2. 自动遍历每个分类的所有分页。
3. 进入每个详情页抓取：
   - 标题、封面、年代、地区、类型、语言、导演、主演、简介、更新状态
   - 所有播放源下的每一集（集名 + **明文 m3u8 直链**）
4. 断点续爬（已抓过的详情页自动跳过，缓存文件 `output/seen_ids.json`）。
5. 失败重试、随机 UA、请求间隔控制。
6. 输出三种格式：
   - `output/videos.json` —— 结构化全量数据（一个视频一条记录，含全部播放源/集数）
   - `output/episodes.csv` —— 扁平化"视频-集-直链"表，Excel 直接打开，方便导入 NAS/播放器
   - `output/categories.json` —— 分类 ID/名称/父子关系映射表
   - 可选 `--download-m3u8`：为每个视频生成一个 `.m3u` 播放列表，直接丢给 VLC/Infuse/Kodi 播放

## 安装依赖

```bash
pip install requests beautifulsoup4 lxml
```

## 使用

```bash
# 全站抓取（所有分类 + 全部分页 + 全部详情）
python yayazy_spider.py

# 测试：每个分类只抓 1 页
python yayazy_spider.py --max-pages 1

# 只抓某个分类（例如国产剧 id=13）
python yayazy_spider.py --cat-id 13

# 只列出所有分类，不进详情
python yayazy_spider.py --only-cats

# 调整请求间隔（秒），默认 0.5，站点压力大可加大
python yayazy_spider.py --delay 1

# 抓取并同时生成每个视频的 .m3u 播放列表
python yayazy_spider.py --download-m3u8
```

中断后再运行同一条命令，会自动从 `output/seen_ids.json` 断点续爬、不会重复下载。

## 输出结构

```
yayazy_crawler/
├── yayazy_spider.py
└── output/
    ├── categories.json      # 分类表
    ├── videos.json          # 视频详情全集
    ├── episodes.csv         # 扁平化集数+m3u8
    ├── seen_ids.json        # 已抓缓存(断点续爬)
    └── m3u_playlists/       # 可选: 每个视频一个 .m3u
```

## 注意

- 脚本仅用于学习研究与个人合法备份，请遵守目标站点 robots.txt 及当地版权法规。
- 若目标站后续改版（例如接入 JS 播放器加密/DRM），只需在 `parse_detail()` 里补充对应逻辑即可；当前版本已对 m3u8 直链做了正则兜底，即使 DOM 变动也能抓到链接。
