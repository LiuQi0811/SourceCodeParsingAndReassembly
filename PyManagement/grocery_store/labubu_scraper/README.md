# Labubu Live Wallpaper 全站抓取工具

> 针对 [labubulivewallpaper.com](https://labubulivewallpaper.com/) 的全站抓取脚本与数据镜像

---

## 📖 项目介绍

本项目提供了一套完整的 Labubu Live Wallpaper 全站抓取方案，包含 Python 抓取脚本和预先下载好的整站资源包。站点为 React + Vite 构建的 SPA，壁纸数据全部硬编码在前端 JS bundle 中，资源通过 Cloudflare CDN 公开直链分发，**无加密、无混淆、无鉴权**，抓取零逆向难度。

---

## 🔍 站点结构分析

| 层级 | 技术 | 说明 |
|---|---|---|
| 前端框架 | React + Vite | 纯静态 SPA，部署于 Vercel |
| 资源 CDN | Cloudflare R2 + CDN | `imgs.labubulivewallpaper.com` |
| 数据存储 | 硬编码在主 JS bundle | 约 377KB 的 `index-*.js` 中明文存储 216 个壁纸对象 |
| 接口 | 无后端 API | 纯静态站点，无服务端请求 |
| 反爬 | 仅有 Cloudflare 基础限流 | 降低并发 + 重试即可绕过 |
| 多语言 | `/zh` `/ja` `/de` `/es` `/fr` `/ru` | 同一份 SPA，仅文本语言切换 |

### 壁纸格式

- **静态壁纸**：JPG / PNG / JPEG，分辨率多为 1170×2532（手机）、2048×2732（平板）
- **动态壁纸（Live）**：Apple **HEIC** 实况照片（Live Photo）格式，iOS 原生支持设为实时壁纸
- **视频资源**：首页 Hero 区 5 个演示视频（mp4 / mov）

---

## ✨ 功能特性

- ✅ 自动解析 JS bundle 提取 216 张壁纸完整元数据
- ✅ 下载站点全部静态资源（首页、多语言页、CSS、JS、favicon、robots、sitemap）
- ✅ 并发下载原图、预览图、缩略图
- ✅ 下载首页 5 个演示视频
- ✅ **断点续传**：中断后重新运行自动跳过已下载文件，`.part` 临时文件自动续传
- ✅ **失败重试**：5 次指数退避重试 + 二次单线程兜底重试
- ✅ 生成壁纸元数据清单（JSON）
- ✅ 生成下载统计报告
- ✅ 命令行参数可配置并发数、跳过视频/缩略图

---

## 🚀 快速开始

### 环境要求

- Python 3.8+
- 依赖：`requests`

```bash
pip install requests
```

### 基本使用

```bash
# 全量下载（默认 8 并发）
python3 crawler.py --out ./downloads

# 提高并发速度
python3 crawler.py --out ./downloads --workers 16

# 跳过视频（节省 ~41MB）
python3 crawler.py --out ./downloads --no-videos

# 跳过缩略图（仅下载原图 + 预览图）
python3 crawler.py --out ./downloads --no-thumbnails

# 断点续传：中断后直接重新运行即可
python3 crawler.py --out ./downloads
```

### 命令行参数

| 参数 | 说明 | 默认值 |
|---|---|---|
| `--out` | 下载根目录 | `./downloads` |
| `--workers` | 并发下载线程数 | `8` |
| `--no-videos` | 跳过首页视频下载 | 关闭 |
| `--no-thumbnails` | 跳过缩略图下载 | 关闭 |
| `--languages` | 要抓取的多语言页 | `zh ja de es fr ru` |

---

## 📂 目录结构

```
downloads/
├── crawler.py                      # 增强版抓取脚本（推荐）
├── labubu_scraper.py               # 基础版抓取脚本
├── README.md                       # 本说明文档
├── wallpapers_manifest.json        # 壁纸完整元数据清单
├── download_report.json            # 下载统计报告
├── site/                           # 前端站点镜像
│   ├── index.html                  # 首页
│   ├── zh.html                     # 中文页
│   ├── ja.html                     # 日文页
│   ├── de.html / es.html / fr.html / ru.html
│   ├── assets/                     # JS / CSS bundle
│   │   ├── index-*.js              # 主 JS（包含全部壁纸数据）
│   │   └── index-*.css
│   ├── robots.txt
│   ├── sitemap.xml
│   └── favicon.ico
├── images/                         # 壁纸原图（217 个文件）
│   ├── *.jpg / *.jpeg / *.png      # 静态壁纸
│   ├── *.HEIC                      # 动态壁纸（Apple Live Photo）
│   └── logo.png / favicon.ico
├── previews/                       # 预览图（216 个，多数与原图同尺寸）
├── thumbnails/                     # CDN 裁剪缩略图（700×1000）
│   └── 001_xxx.webp / 002_xxx.jpeg （按 id 排序，便于浏览）
└── videos/                         # 首页演示视频
    ├── apple.mov
    ├── labubu_video.mp4
    ├── labubu_video2.mp4
    ├── labubu_video3.mov
    └── labubu_video5.mov
```

---

## 📋 壁纸元数据字段

`wallpapers_manifest.json` 中每个壁纸对象包含以下字段：

```json
{
  "id": 1,
  "thumbnail": "https://imgs.labubulivewallpaper.com/cdn-cgi/image/.../xxx.jpg",
  "preview": "https://imgs.labubulivewallpaper.com/xxx.jpg",
  "downloadUrl": "https://imgs.labubulivewallpaper.com/xxx.jpg",
  "category": "static",
  "deviceType": "phone",
  "resolution": "1170 x 2532",
  "fileSize": "1.5 MB",
  "filename": "xxx.jpg"
}
```

| 字段 | 类型 | 说明 |
|---|---|---|
| `id` | int | 壁纸唯一编号（1–216） |
| `category` | string | 分类：`static`（静态）/ `dynamic`（动态） |
| `deviceType` | string | 设备类型：`phone` / `tablet` / `desktop` |
| `resolution` | string | 分辨率，如 `1170 x 2532` |
| `fileSize` | string | 文件大小（人类可读格式） |
| `thumbnail` | string | 缩略图 URL（CDN 实时裁剪，约 700×1000） |
| `preview` | string | 预览图 URL（与原图通常相同） |
| `downloadUrl` | string | 原图下载 URL |
| `filename` | string | 从 downloadUrl 解析出的文件名 |

---

## 🎨 壁纸统计

| 维度 | 分类 | 数量 |
|---|---|---|
| 分类 | static（静态） | 192 |
| 分类 | dynamic（动态） | 24 |
| 设备 | phone（手机） | 211 |
| 设备 | tablet（平板） | 3 |
| 设备 | desktop（桌面） | 2 |
| 格式 | jpg / jpeg / png | 192 |
| 格式 | HEIC | 24 |

---

## 📱 HEIC 动态壁纸说明

24 张动态壁纸采用 **Apple HEIC Live Photo（实况照片）** 格式：

### iOS / macOS
- 原生支持，直接导入相册即可长按预览动态效果
- iPhone 可直接设为「实况壁纸」，锁屏长按播放

### Windows
- 需安装 **Microsoft Store 的「HEVC 视频扩展」**（付费）或免费的 **HEIF 图像扩展**
- 推荐使用 [VLC 播放器](https://www.videolan.org/) 或 [ImageGlass](https://imageglass.org/) 查看

### Android
- 原生不支持 HEIC 动态壁纸
- 可使用 HEIC 转 MP4 转换工具转为视频后，使用第三方动态壁纸 App 设置

### 转换工具
- **命令行**：`libheif`（`heif-convert` 命令）
- **在线工具**：CloudConvert、Convertio 等
- **Python**：`pillow-heif` 库

```bash
# 安装并批量转换 HEIC → JPG
pip install pillow-heif
python3 -c "
import os
from pillow_heif import register_heif_opener
from PIL import Image
register_heif_opener()
for f in os.listdir('images'):
    if f.lower().endswith('.heic'):
        img = Image.open(f'images/{f}')
        img.save(f'images/{f.rsplit(".",1)[0]}.jpg', 'JPEG', quality=95)
"
```

---

## 🔧 技术细节

### 数据逆向方式

站点数据硬编码在 `index-*.js` 中，壁纸对象以字面量形式存储：

```js
{id:"1",thumbnail:"https://...",preview:"https://...",downloadUrl:"https://...",category:"static",deviceType:"phone",resolution:"1170 x 2532",fileSize:"1.5 MB"}
```

脚本使用正则表达式 `WALLPAPER_OBJ_RE` 直接匹配提取，无需 AST 解析或混淆还原。

### 断点续传原理

1. 下载前先检查目标文件是否存在且大小与 Content-Length 一致
2. 若存在 `.part` 临时文件，发送 `Range: bytes={size}-` 请求续传
3. 下载完成后将 `.part` 重命名为最终文件名

### 反爬应对

- 设置合理的 User-Agent 和 Referer
- 5 次指数退避重试（针对 429 / 5xx）
- 默认 8 并发，可根据网络情况调整
- 失败任务二次单线程兜底重试

---

## ❓ 常见问题

**Q: 下载失败的文件怎么办？**
A: 直接重新运行脚本，已下载的会自动跳过，失败的会重新尝试。查看 `download_report.json` 的 `failed_urls` 字段了解哪些失败。

**Q: 为什么预览图和原图看起来一样？**
A: 该站点 preview 字段多数情况下指向与 downloadUrl 相同的文件，主要用于页面懒加载逻辑。

**Q: 缩略图为什么是 webp 格式？**
A: 缩略图经过 Cloudflare Image Resizing（`/cdn-cgi/image/`）处理，CDN 根据请求头自动选择最优格式。

**Q: 可以只下载某一类壁纸吗？**
A: 当前脚本默认下载全部。可修改 `wallpapers` 列表按 `category` 或 `deviceType` 过滤后再生成下载任务。

---

## 📜 免责声明

本脚本仅供学习研究使用。下载的壁纸版权归原站点及创作者所有，请勿用于商业用途。请遵守目标站点的 robots.txt 及使用条款，合理控制抓取频率。
