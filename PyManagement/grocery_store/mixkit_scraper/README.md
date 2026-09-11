# Mixkit.co 全站爬虫

Mixkit (https://mixkit.co/) 是 Envato 旗下免费可商用素材平台，提供视频、音乐、音效、插画、视频模板等资源。

## 逆向分析结论

经过对网站 HTML/JS/API 的完整逆向分析：

- **无加密、无签名、无需登录**：所有资源直接通过可预测的 CDN 直链下载，不存在 JS 加密参数、Token 签名、Cookie 验证等反爬机制
- **robots.txt 允许爬取**（`Allow: /`），且提供了完整 sitemap
- 资源全部托管在 Amazon S3 + CloudFront CDN（`assets.mixkit.co`）

### 已逆向出的直链模式

| 资源类型 | 直链 URL 格式 | 分辨率/规格 |
| --- | --- | --- |
| 视频 (Stock Video) | `https://assets.mixkit.co/videos/{id}/{id}-{res}.mp4` | 360p / 720p / 1080p / 2160p(4K) |
| 音乐 (Stock Music) | `https://assets.mixkit.co/music/{id}/{id}.mp3` | 256kbps MP3 |
| 音效 (SFX) | `https://assets.mixkit.co/active_storage/sfx/{id}/{id}.wav` | WAV 无损；预览版为 `{id}-preview.mp3` |
| 插画 (Stock Art) | `https://assets.mixkit.co/art/{id}/{id}-{size}.png` | original / phone-wallpaper / desktop-wallpaper |
| 视频模板 (Templates) | `https://assets.mixkit.co/video-templates/{id}/mixkit-{id}.zip` | ZIP 包（含 Pr/AE/FCP/DaVinci 工程文件） |

### 规模估算（截至 2026-09）

- **视频**：约 46,000+ 个（从 sitemap-video 分片索引完整获取）
- **音乐**：约 1,200+ 首
- **音效**：约 3,000+ 个
- **插画**：约 550+ 张
- **视频模板**：约 600+ 个

## 环境要求

`pip install requests beautifulsoup4 tqdm`

## 使用方法

`# 基本用法 —— 默认下载全部视频（1080p）`\
`python mixkit_scraper.py`\
\
`# 指定资源类型和分辨率`\
`python mixkit_scraper.py --type video --res 2160      # 下载全部 4K 视频`\
`python mixkit_scraper.py --type video --res 720       # 下载 720p 视频`\
`python mixkit_scraper.py --type music                 # 下载全部音乐`\
`python mixkit_scraper.py --type sfx                   # 下载全部音效(WAV)`\
`python mixkit_scraper.py --type sfx --sfx-preview-only  # 只下载音效预览MP3(更小)`\
`python mixkit_scraper.py --type art                   # 下载全部原画插画`\
`python mixkit_scraper.py --type art --art-size phone-wallpaper   # 手机壁纸尺寸`\
`python mixkit_scraper.py --type template              # 下载全部视频模板`\
`python mixkit_scraper.py --type all --res 1080        # 下载全部所有类型`\
\
`# 并发和输出控制`\
`python mixkit_scraper.py --type video --workers 10    # 10个并发下载`\
`python mixkit_scraper.py --type music --output /data/mixkit  # 指定输出目录`\
`python mixkit_scraper.py --type video --max-id 1000   # 只下载ID≤1000的视频`\
\
`# 测试模式 —— 只下载每个类别的前3个文件验证可用性`\
`python mixkit_scraper.py --type video --test`\
`python mixkit_scraper.py --type all --test`

## 参数说明

| 参数 | 默认值 | 说明 |
| --- | --- | --- |
| `--type` | `video` | 资源类型：`video`/`music`/`sfx`/`art`/`template`/`all` |
| `--res` | `1080` | 视频分辨率：`360`/`720`/`1080`/`2160`（2160即4K） |
| `--art-size` | `original` | 插画尺寸：`original`/`phone-wallpaper`/`desktop-wallpaper` |
| `--sfx-preview-only` | 关 | 音效只下载预览 MP3，不下载 WAV 无损（节省空间） |
| `--workers` | `5` | 并发下载线程数 |
| `--output` | `./mixkit_downloads` | 下载根目录 |
| `--max-id` | `0`（不限制） | 最大 ID 限制，用于分批下载 |
| `--test` | 关 | 测试模式，每类只下载前3个文件 |
| `--no-resume` | 关 | 不使用断点续传，已存在文件强制重下 |

## 输出目录结构

`mixkit_downloads/`\
`├── videos/`\
`│   ├── 360p/`\
`│   ├── 720p/`\
`│   ├── 1080p/`\
`│   └── 2160p/`\
`│       ├── traveling-at-high-speed-through-clouds-3d-27172-2160p.mp4`\
`│       └── ...`\
`├── music/`\
`│   ├── track-1-1.mp3`\
`│   └── ...`\
`├── sfx/`\
`│   ├── sfx-1-1.wav        # WAV 无损`\
`│   └── ...`\
`├── art/`\
`│   └── original/`\
`│       ├── art-1-1-original.png`\
`│       └── ...`\
`├── templates/`\
`│   ├── free-premiere-pro-templates/`\
`│   ├── free-after-effects-templates/`\
`│   ├── free-final-cut-pro-templates/`\
`│   ├── free-davinci-resolve-templates/`\
`│   └── free-video-templates/`\
`│       ├── tpl-12-12.zip`\
`│       └── ...`\
`└── mixkit_manifest_YYYYMMDD_HHMMSS.csv   # 下载清单（含URL、是否成功等元数据）`

## 特性

- ✅ **断点续传**：已下载的完整文件自动跳过，部分下载的文件自动续传
- ✅ **并发下载**：可配置并发线程数（默认5）
- ✅ **失败重试**：网络错误自动重试3次，指数退避
- ✅ **进度条**：每个文件和全局都有 tqdm 进度显示
- ✅ **Sitemap 缓存**：sitemap 文件缓存到本地，避免重复下载
- ✅ **CSV 清单**：自动生成下载清单，记录每个文件的类型、ID、URL、是否成功
- ✅ **ID探测**：音乐/音效/插画/模板使用并发HEAD探测，快速找到全部有效ID
- ✅ **无依赖加密**：纯 Python 实现，无需浏览器、JS 引擎或签名逆向

## 存储估算

| 类型 | 数量 | 单文件大小 | 总空间估算 |
| --- | --- | --- | --- |
| 视频 1080p | \~46,000 | \~40MB | \~1.8 TB |
| 视频 720p | \~46,000 | \~10MB | \~460 GB |
| 视频 4K | \~46,000 | \~55MB | \~2.5 TB |
| 音乐 | \~1,200 | \~5MB | \~6 GB |
| 音效 WAV | \~3,000 | \~0.5-2MB | \~3 GB |
| 插画 PNG | \~550 | \~1-3MB | \~1 GB |
| 模板 ZIP | \~600 | \~1-10MB | \~3 GB |

> ⚠️ 全量下载（尤其是4K视频）需要大量磁盘空间和带宽，建议分批使用 `--max-id` 或选择较低分辨率。

## 法律声明

Mixkit 素材遵循 Mixkit Stock Video Free License 等各类型许可证，大多数素材可免费用于个人和商业项目，无需署名。请参考 https://mixkit.co/license/ 了解详细许可条款，使用时请遵守相关法律法规和网站服务条款。本工具仅供学习研究使用。