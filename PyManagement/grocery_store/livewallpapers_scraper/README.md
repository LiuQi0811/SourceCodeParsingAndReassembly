# LiveWallpapers4Free.com 全站爬虫

## 逆向解密说明

### 网站分析
- 网站类型: WordPress + Download Monitor 插件
- 内容: 动态壁纸(MP4视频格式), 提供HD/2K/4K多种分辨率
- 总页数: 约361页, 总计约7000+壁纸

### 下载链接逆向发现
网站使用 WordPress Download Monitor 插件管理下载，`/download/ID/` 格式链接有以下行为:
1. **普通GET请求(无Range头)**: 返回HTML页面(浏览器环境可能通过JS处理)
2. **带Range头的请求(关键发现!)**: 直接返回真实视频流, HTTP 206 Partial Content, Content-Type: video/mp4

**无需复杂的JavaScript逆向、加密解密、token计算**，只需在请求头中加入 `Range: bytes=0-` 即可直接获取原始MP4文件。这是该网站下载机制的"后门"式利用。

预览视频文件名包含特征字符串 `VIDEO-zxcv`，可直接访问，无需任何特殊处理。

## 功能特性

- ✅ 通过 WordPress REST API (`/wp-json/wp/v2/posts`) 遍历全站文章，高效稳定
- ✅ 自动解析每个壁纸详情页的所有下载链接(HD/2K/4K)
- ✅ 利用Range头机制直接下载，完美绕过Download Monitor的前端验证
- ✅ 支持断点续传，中断后重新运行自动跳过已下载文件
- ✅ 多线程并发下载(可配置)
- ✅ 自动创建分类目录，按壁纸标题分文件夹保存
- ✅ 同时下载预览视频、缩略图、保存元数据信息
- ✅ 自动去重，已下载ID持久化记录
- ✅ 详细日志输出

## 文件说明

| 文件 | 说明 |
|------|------|
| `scraper.py` | **主爬虫程序**, 全站抓取+下载 |
| `probe.py` | 网站结构探测脚本 |
| `probe_detail.py` | 详情页分析脚本 |
| `test_single.py` / `quick_test.py` | 单文件下载测试 |
| `scraper.log` | 运行日志(自动生成) |
| `downloaded_ids.json` | 已下载ID记录(自动生成，用于断点续爬) |
| `downloads/` | 下载文件保存目录(自动创建) |

## 使用方法

### 环境准备
```bash
pip install requests beautifulsoup4
```

### 基本使用
```bash
# 全量爬取(从第1页爬到最后一页)
python3 scraper.py
```

### 配置选项
编辑 `scraper.py` 开头的配置区:

```python
MAX_WORKERS = 3       # 并发线程数，建议不要超过5避免被封IP
START_PAGE = 1        # 起始页码(断点续爬用)
END_PAGE = None       # 结束页码，None=爬完全站
DOWNLOAD_PREVIEW = True  # 是否同时下载预览视频
SAVE_DIR = Path("./downloads")  # 保存目录
```

### 断点续爬
爬虫会自动在 `downloaded_ids.json` 中记录已完成下载的壁纸ID，意外中断后直接重新运行即可，自动跳过已下载项目。

如果需要从指定页码开始，修改 `START_PAGE` 参数即可。

## 目录结构

下载完成后目录结构如下:
```
downloads/
├── Anime Live Wallpapers/
│   ├── Goku - Fury of the Saiyan/
│   │   ├── goku-fury-of-the-saiyan-HD-live.mp4
│   │   ├── goku-fury-of-the-saiyan-2k-live.mp4
│   │   ├── goku-fury-of-the-saiyan-4k-live.mp4
│   │   ├── preview_goku-fury-of-the-saiyan-VIDEO-zxcv.mp4
│   │   ├── thumbnail.jpg
│   │   └── info.json        # 包含标题、分类、链接等元数据
│   └── ...
├── Games Live Wallpapers/
├── Nature Live Wallpapers/
└── ...
```

## 注意事项

1. **网络要求**: 视频文件较大(HD~10-20MB, 4K~30-60MB)，全站下载需要较大磁盘空间和稳定网络
2. **请求频率**: 代码已内置延迟，不建议将并发数设置过高(>5)，避免IP被封禁
3. **使用范围**: 本工具仅用于学习研究，请遵守网站robots.txt和相关版权规定
4. **中断处理**: Ctrl+C中断后已下载的文件不会丢失，重新运行自动继续

## 技术细节

### WordPress REST API端点
- 文章列表: `GET /wp-json/wp/v2/posts?page=N&per_page=20&_embed=true`
- 分类列表: `GET /wp-json/wp/v2/categories?per_page=100`
- 响应头 `X-WP-TotalPages` 提供总页数，`X-WP-Total` 提供总文章数

### Download Monitor链接绕过
请求 `/download/ID/` 时必须包含:
- `Range: bytes=0-` 或 `Range: bytes=起始字节-`
- 适当的 `Referer` 头(可选，增强稳定性)

服务器将直接返回MP4字节流，HTTP状态码206，无需任何token、cookie或JavaScript执行。
