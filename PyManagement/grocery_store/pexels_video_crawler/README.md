# Pexels 全站视频爬虫

## 逆向分析结论

经过完整逆向分析，**Pexels视频没有任何加密/DRM保护**，无需解密：

1. **无加密**: 所有视频都是标准MP4文件，通过CDN `videos.pexels.com` 明文分发
2. **反爬机制**: 只有HTML页面有Cloudflare TLS指纹检测，CDN视频域名完全无防护
3. **文件命名规律**:
    - URL格式: `https://videos.pexels.com/video-files/{VIDEO_ID}/{FILE_HASH}_{WIDTH}_{HEIGHT}_{FPS}fps.mp4`
    - 同一视频不同质量版本的FILE_HASH连续递增：
        - 360p(预览) = hash+0
        - 540p = hash+1
        - 720p = hash+2
        - 1080p = hash+3
        - 1440p(2K) = hash+4
        - 2160p(4K) = hash+5
4. **方案**: Playwright真实浏览器访问列表页提取视频ID和预览URL → 按hash规律构造各分辨率直链 → requests多线程高速下载CDN

## 安装依赖

`pip install requests tqdm playwright`\
`playwright install chromium`

## 使用方法

### 1. 下载热门视频

`# 下载热门30个1080p视频`\
`python pexels_video_crawler.py -m popular -n 30 -q 1080p -w 5`

### 2. 按关键词搜索下载

`# 搜索"nature"下载20个4K视频`\
`python pexels_video_crawler.py -m search -k nature -n 20 -q 2160p`

### 3. 参数说明

| 参数 | 说明 | 可选值 |
| --- | --- | --- |
| `-m, --mode` | 抓取模式 | popular(热门) / search(搜索) |
| `-k, --keyword` | 搜索关键词 | (search模式必填) |
| `-o, --output` | 保存目录 | 默认pexels_videos |
| `-q, --quality` | 视频质量 | 240p / 360p / 540p / **720p** / **1080p** / 1440p(2K) / 2160p(4K) |
| `-p, --pages` | 最大翻页数 | 默认10 |
| `-n, --max` | 最大下载视频数 | 默认30 |
| `-w, --workers` | 并发下载线程数 | 默认5（CDN无限制可加大） |

### 4. 支持的分辨率

- **2160p**: 4K超高清 (3840x2160 / 2160x3840)
- **1440p**: 2K超清 (2560x1440 / 1440x2560)
- **1080p**: 全高清 (1920x1080 / 1080x1920)
- **720p**: 高清 (1280x720 / 720x1280)
- 540p / 360p / 240p: 标清

## 特性

- ✅ 完美绕过Cloudflare反爬（Playwright真实浏览器）
- ✅ 视频无加密直链下载，无需逆向解密
- ✅ 支持从240p到4K(2160p)所有质量
- ✅ 自动识别横屏/竖屏方向
- ✅ 多线程高速下载（CDN无速度限制）
- ✅ 断点续传，支持中断后继续
- ✅ 下载历史记录，避免重复下载
- ✅ 热门视频流 + 关键词搜索两种模式