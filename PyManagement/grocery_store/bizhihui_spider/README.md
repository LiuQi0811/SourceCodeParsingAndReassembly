# 壁纸汇 (bizhihui.com) 全站爬虫

## 关于逆向说明

经过完整分析，**bizhihui.com 壁纸没有任何加密或反爬措施**：

- 网站采用 Z-Blog PHP 搭建
- 图片托管在阿里云 OSS CDN (`s.panlai.com`)
- 页面上直接暴露原图链接：
    - 缩略图URL带后缀：`xxx.png-arthumbs` (文章页主图) 或 `xxx.jpg-pcthumbs` (侧边推荐)
    - **原图URL就是去掉** `-arthumbs` **或** `-pcthumbs` **后缀的地址**，可直接访问下载
    - 各尺寸(电脑3840x2160/手机978x2160)通过OSS图片处理参数 `?x-oss-process=...` 生成
- 无需登录、无需cookie、无JS加密、无签名验证
- 仅需设置合理的请求间隔即可稳定下载

## 功能特性

- ✅ 全站15个分类全覆盖
- ✅ 支持原图/电脑版(3840x2160)/手机版(978x2160)三种尺寸下载
- ✅ 多线程并发下载（默认5线程）
- ✅ 自动断点续传、失败重试
- ✅ 保存完整元数据（标题、标签、分类、分辨率等）
- ✅ 自动生成爬取统计报告
- ✅ 支持按分类爬取、限制页数

## 文件结构

`bizhihui_spider.py      # 主爬虫程序`\
`README.md               # 使用说明`\
`bizhihui_wallpapers/    # 默认下载目录`\
`├── original/           # 原图`\
`├── pc_3840x2160/       # 电脑横屏版`\
`├── phone_978x2160/     # 手机竖屏版`\
`├── metadata.json       # 所有壁纸元数据`\
`├── progress.json       # 下载进度记录`\
`└── report.txt          # 爬取统计报告`\
`spider.log              # 运行日志`

## 快速开始

### 安装依赖

`pip install requests beautifulsoup4`

### 命令行使用

`# 1. 爬取全站所有壁纸（仅下载原图，默认推荐）`\
`python bizhihui_spider.py`\
\
`# 2. 同时下载原图+电脑版+手机版`\
`python bizhihui_spider.py -o -p -m`\
\
`# 3. 只爬取指定分类（如动漫、风景）`\
`python bizhihui_spider.py -c dongman fengjing`\
\
`# 4. 只爬取每个分类前5页（测试用）`\
`python bizhihui_spider.py --max-pages 5`\
\
`# 5. 指定下载目录`\
`python bizhihui_spider.py -d D:/wallpapers`\
\
`# 6. 设置10线程加速下载`\
`python bizhihui_spider.py --workers 10`\
\
`# 7. 只爬取元数据，暂不下载图片`\
`python bizhihui_spider.py --skip-download`\
\
`# 8. 跳过爬取，直接下载之前未完成的图片`\
`python bizhihui_spider.py --skip-crawl`

### 作为模块调用

`from bizhihui_spider import WallpaperSpider`\
\
`# 创建爬虫实例`\
`spider = WallpaperSpider(`\
`    save_dir="./my_wallpapers",`\
`    download_original=True,   # 下载原图`\
`    download_pc=True,         # 下载电脑版`\
`    download_phone=False      # 不下载手机版`\
`)`\
\
`# 运行爬虫`\
`spider.run()`\
\
`# 或者只爬特定分类`\
`spider.run(categories={"卡通动漫": "/dongman/"}, max_pages=3)`

## 参数说明

| 参数 | 说明 | 默认值 |
| --- | --- | --- |
| `-d, --dir` | 保存目录 | `./bizhihui_wallpapers` |
| `-o, --original` | 下载原图 | 开启 |
| `-p, --pc` | 下载电脑横屏版 3840×2160 | 关闭 |
| `-m, --phone` | 下载手机竖屏版 978×2160 | 关闭 |
| `-c, --category` | 指定爬取分类（可多个） | 全部 |
| `--max-pages` | 每个分类最大爬取页数 | 自动探测到最后 |
| `--workers` | 并发下载线程数 | 5 |
| `--skip-crawl` | 跳过爬取，直接下载 | 关闭 |
| `--skip-download` | 只爬元数据，不下载 | 关闭 |

## 网站分类列表

| 分类名 | URL路径 |
| --- | --- |
| 首页（全部） | `/` |
| 卡通动漫 | `/dongman/` |
| 人物画照 | `/renwu/` |
| 风景静物 | `/fengjing/` |
| 影视体育 | `/yingshi/` |
| 游戏视觉 | `/youxi/` |
| 美食果蔬 | `/meishi/` |
| 唯美治愈 | `/weimei/` |
| 动物萌宠 | `/mengchong/` |
| 艺术绘画 | `/yishu/` |
| 宇宙星空 | `/yuzhou/` |
| 军事科技 | `/keji/` |
| 简约主义 | `/jianyue/` |
| 机车 | `/jiche/` |
| 其它风格 | `/qita/` |

## 元数据格式 (metadata.json)

`{`\
`  "24085": {`\
`    "id": "24085",`\
`    "url": "https://www.bizhihui.com/p/24085.html",`\
`    "title": "简洁背景 黑色背景 操作系统娘 紫色 4K壁纸",`\
`    "original_title": "简洁背景 黑色背景 操作系统娘 紫色 4K壁纸",`\
`    "category": "首页",`\
`    "tags": ["4K壁纸", "紫色", "动漫"],`\
`    "date": "2026-09-10",`\
`    "resolution": "3840x2160",`\
`    "thumb_url": "https://s.panlai.com/...-arthumbs",`\
`    "original_url": "https://s.panlai.com/....png",`\
`    "pc_url": "https://s.panlai.com/....png?x-oss-process=...",`\
`    "phone_url": "https://s.panlai.com/....png?x-oss-process=...",`\
`    "extension": "png",`\
`    "downloaded": true,`\
`    "download_time": "2026-09-11T10:30:07"`\
`  }`\
`}`

## 注意事项

1. **请合理控制爬取速度**：默认已设置0.5\~1.5秒随机延迟，请勿移除延迟
2. **断点续传**：程序会自动保存进度，中断后重新运行即可继续
3. **磁盘空间**：每张原图约300KB\~3MB，全站约2万+张，预计总容量 5GB\~20GB
4. **版权声明**：爬取内容仅供个人学习使用，请勿用于商业用途