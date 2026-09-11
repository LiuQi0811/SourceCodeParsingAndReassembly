# Coverr.co 全站爬虫 - 完美逆向版

## 逆向分析结果

### CDN防盗链机制分析与破解

经过对 coverr.co 网站的完整逆向分析，发现其CDN（cdn.coverr.co）防盗链机制如下：

1. **直接GET请求** → 返回 `301 Moved Permanently` 重定向到首页 `https://coverr.co`
2. **HEAD请求** → 不管带什么头都返回 `301` 重定向
3. **完美破解方法**: 在HTTP请求头中加入 `Range: bytes=0-` 即可获取完整文件，返回 `200 OK` 或 `206 Partial Content`
4. 必须同时携带浏览器 User-Agent 和 Referer 头

### 视频URL结构

- CDN域名: `https://cdn.coverr.co`
- 视频路径: `/videos/{video_id}/{resolution}.mp4`
- 可用分辨率: `original.mp4`, `1080p.mp4`, `720p.mp4`, `480p.mp4`, `360p.mp4`
- 缩略图: `/videos/{video_id}/thumbnail?width=640`

### 视频数据来源

- 全站视频列表通过官方Sitemap获取: `https://coverr.co/sitemap/sitemap_videos.xml`
- 总共约 **8000+ 个免费视频**
- 每个视频条目包含：标题、描述、时长、标签、缩略图、CDN路径

## 文件说明

| 文件 | 说明 |
| --- | --- |
| `coverr_scraper.py` | 主爬虫程序，Python编写 |
| `README_爬虫使用说明.md` | 本说明文档 |
| `coverr_downloads/` | 默认下载目录 |

## 使用方法

### 环境要求

`pip install requests`

### 基本用法

`# 下载所有视频（默认1080p，8并发）`\
`python3 coverr_scraper.py`\
\
`# 指定分辨率 (可选: original, 1080p, 720p, 480p, 360p)`\
`python3 coverr_scraper.py -r original`\
\
`# 指定输出目录`\
`python3 coverr_scraper.py -o /path/to/save`\
\
`# 指定并发数（根据带宽调整）`\
`python3 coverr_scraper.py -w 16`\
\
`# 限制下载数量（测试用）`\
`python3 coverr_scraper.py -l 10`\
\
`# 仅列出视频不下载`\
`python3 coverr_scraper.py --list-only`\
\
`# 不下载网站静态页面`\
`python3 coverr_scraper.py --no-pages`

### 完整参数说明

`-o, --output      输出目录（默认: ./coverr_downloads）`\
`-r, --resolution  视频分辨率: original/1080p/720p/480p/360p（默认: 1080p）`\
`-w, --workers     并发下载线程数（默认: 8）`\
`-l, --limit       限制下载视频数量，0=全部（默认: 0）`\
`--no-pages        不下载网站静态页面`\
`--list-only       仅列出视频信息不下载`

## 下载内容结构

`coverr_downloads/`\
`├── video_index.json           # 全部视频索引（含元数据）`\
`├── videos/`\
`│   ├── A/                     # 按首字母分目录`\
`│   │   ├── A girl ..._720p.mp4`\
`│   │   ├── A girl ..._thumb.jpg`\
`│   │   └── A girl ..._meta.json`\
`│   └── ...`\
`└── pages/                     # 网站静态页面`\
`    ├── index.html`\
`    ├── about.html`\
`    └── ...`

## 预估存储空间需求

- 360p: \~5-15 MB/个 → 总计约 40-120 GB
- 720p: \~10-40 MB/个 → 总计约 80-320 GB
- 1080p: \~20-80 MB/个 → 总计约 160-640 GB
- original: \~50-200 MB/个 → 总计约 400-1600 GB

建议首次使用 720p 或 360p 测试，根据磁盘空间选择合适分辨率。

## 技术特点

- ✅ **完美逆向**: 破解CDN Range检测防盗链
- ✅ **断点续传逻辑**: 已下载文件自动跳过
- ✅ **自动降级**: 请求的分辨率不存在时自动尝试更低分辨率
- ✅ **并发下载**: 多线程高并发下载
- ✅ **重试机制**: 网络错误自动重试5次
- ✅ **元数据保存**: 每个视频保存标题/标签/描述/时长信息JSON
- ✅ **缩略图下载**: 同时下载视频缩略图
- ✅ **完整索引**: 生成全站视频索引JSON

## 免责声明

本工具仅用于学习研究爬虫技术，请遵守coverr.co网站的使用条款和相关版权规定。 下载的视频资源请遵循其原有的授权协议使用。