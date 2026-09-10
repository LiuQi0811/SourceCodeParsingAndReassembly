# Animoe.org 全站爬虫使用说明

## 逆向解密说明

该网站的视频流使用自定义魔改加密（响应头4字节为 `enc!` 标记），并非标准HLS AES-128加密。
加密由前端播放器 `assplayer`（github.elemecdn.com/assplayer@1.1.0/dist.js）内的自定义XHR loader完成。

**解密方案**：由于加密算法嵌入在混淆的JS中且通过Hls.js自定义loader在浏览器内完成，
本爬虫不硬破解算法，而是**直接利用浏览器中的Hls.js实例**（通过Chrome DevTools Protocol）
让浏览器自行解密并从Hls.js的`LEVEL_LOADED`事件中读取已解析的manifest和fragments列表，
重建标准的fMP4-HLS m3u8文件，再通过ffmpeg下载合并。

因此运行前需要：
1. 先在Chrome（CDP调试端口 9222）中打开 https://animoe.org/ 任意页面（首页或播放页均可）
2. 保持浏览器窗口处于运行状态

## 文件说明

- `m3u8_decryptor.py`  — 单集解密模块（CDP调用浏览器解密m3u8）
- `animoe_crawler.py`  — 全站爬虫主程序
- `downloads/`         — 下载目录，按番剧名建子目录
- `crawl_state.json`   — 断点续爬状态文件（已下载列表、番剧列表缓存）

## 使用方法

```bash
# 1. 单集下载测试
python3 animoe_crawler.py --mode single --url "https://animoe.org/play/926-2-1.html"

# 2. 抓取番剧列表（不下载）
python3 animoe_crawler.py --list-only

# 3. 全站下载（先抓列表，再下载所有集数）
python3 animoe_crawler.py --mode all

# 4. 只下载已有的列表（跳过抓列表步骤）
python3 animoe_crawler.py --mode download

# 5. 限制下载前N部番剧
python3 animoe_crawler.py --mode all --limit 5

# 6. 从某部番剧开始断点续爬
python3 animoe_crawler.py --mode all --start-from "某番剧名"
```

## 前置条件

- Chrome/Chromium 浏览器已启动并开启远程调试端口9222（agent-browser沙箱环境已内置）
- ffmpeg 已安装（用于下载并合并fMP4分片）
- Python依赖：`websocket-client`（已安装）

## 技术细节

- 列表抓取：遍历3个分类（连载中/已完结/剧场版）分页，解析 `/info/ID.html` 链接
- 集数抓取：进入详情页解析 `/play/VID-SID-NID.html` 链接
- m3u8解密：通过CDP在assplayer iframe中创建Hls实例，监听LEVEL_LOADED事件，
  从`details.fragments`和`details.keys`重建标准m3u8（包含EXT-X-MAP fMP4 init段）
- 视频下载：ffmpeg直接读取重建的m3u8，合并为MP4（-c copy 无损）
- 字幕：自动下载.ass字幕文件
- 断点续爬：`crawl_state.json`记录已下载的集数，重复运行跳过已完成项
