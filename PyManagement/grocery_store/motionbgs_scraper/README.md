# MotionBGS.com 全站动态壁纸下载器

针对 https://motionbgs.com/ 的全站爬虫，可批量下载网站上所有 Live Wallpaper（MP4 动态壁纸）。

## 网站逆向分析结论

经过对目标站点的完整分析，**该网站不存在 JS 加密、token 签名或视频流解密机制**：

| 项目 | 结论 |
|------|------|
| 列表分页 | `https://motionbgs.com/{page}/` （第1页为 `/`，共约 264 页，每页 24 个壁纸） |
| 详情页 URL | `https://motionbgs.com/{slug}` （⚠️ 末尾**不能**加斜杠 `/`，否则 404） |
| 4K 下载直链 | `https://motionbgs.com/dl/4k/{id}/` → 直接返回 MP4 文件（200 OK，`Content-Disposition: attachment`） |
| HD 下载直链 | `https://motionbgs.com/dl/hd/{id}/` → 同上 |
| 鉴权/加密 | **无**。无需登录、无 cookie 校验、无 referer 锁、无 JS 动态加载解密 |
| 反爬措施 | 仅 Cloudflare CDN 缓存，正常频率请求不会被封 |

> 所有下载链接均为 HTTP 直链，使用标准 `requests` 库直接 GET 即可获取 MP4 二进制文件，**不需要任何逆向解密**。

## 功能特性

- ✅ **全自动遍历**：自动探测总页数，遍历所有列表页收集全部壁纸
- ✅ **双画质支持**：可下载 4K（3840×2160）和/或 HD（1920×1080）版本
- ✅ **断点续爬**：中断后重新运行，已获取的详情页索引和已下载的文件自动跳过
- ✅ **断点续传**：支持 HTTP Range 头，大文件中断后从断点继续下载
- ✅ **多线程并发**：默认 8 线程并发，可通过 `--workers` 调整
- ✅ **封面图 + 元数据**：每张壁纸保存封面图和 info.json（含标题、分辨率、大小、ID 等）
- ✅ **限速防封**：内置随机 User-Agent、请求间隔、失败重试、429 自动退避
- ✅ **实时进度**：显示下载进度、速度、预计剩余时间
- ✅ **安全中断**：Ctrl+C 安全退出，自动保存进度

## 环境要求

- Python 3.8+
- 依赖：`requests`、`beautifulsoup4`、`lxml`

## 安装

```bash
cd motionbgs_downloader
pip install requests beautifulsoup4 lxml
```

## 使用方法

### 基本用法（默认下载全部 4K+HD，8 线程）

```bash
python motionbgs_scraper.py
```

### 常用命令

```bash
# 仅下载 4K 画质（节省空间）
python motionbgs_scraper.py --quality 4k

# 仅下载 HD 画质（省带宽，每个文件约 10MB）
python motionbgs_scraper.py --quality hd

# 12 线程加速下载
python motionbgs_scraper.py --workers 12

# 指定下载目录
python motionbgs_scraper.py --output /path/to/wallpapers

# 只下载前 5 页（约 120 个壁纸，用于测试）
python motionbgs_scraper.py --start-page 1 --end-page 5

# 从第 100 页开始继续下载（断点续爬）
python motionbgs_scraper.py --start-page 100

# 更短的请求间隔（速度更快，但可能触发限速）
python motionbgs_scraper.py --delay 0.1 --workers 12
```

### 完整参数说明

| 参数 | 默认值 | 说明 |
|------|--------|------|
| `--quality` | `both` | 下载画质：`both`（4K+HD）、`4k`、`hd` |
| `--workers` | `8` | 并发下载线程数 |
| `--start-page` | `1` | 起始页码 |
| `--end-page` | `0` | 结束页码（0=自动探测最后一页） |
| `--output` | `./motionbgs_downloads` | 文件保存根目录 |
| `--delay` | `0.3` | 请求间隔秒数（防封） |

## 目录结构

```
motionbgs_downloads/
├── index.json              # 全部壁纸的元数据索引（slug、id、标题、下载链接等）
├── progress.json           # 爬取进度记录（用于断点续爬）
└── wallpapers/
    ├── Gojo-vs-Mahoraga_9967/
    │   ├── info.json       # 该壁纸的详细信息
    │   ├── cover.jpg       # 封面缩略图
    │   ├── 4k_3840x2160.mp4   # 4K 动态壁纸（约 20-25MB）
    │   └── hd_1920x1080.mp4   # HD 动态壁纸（约 8-12MB）
    ├── Goku-Ultra-Instinct_1397/
    │   └── ...
    └── ...
```

## 全站规模预估

- 总壁纸数量：约 **6,300+** 个（264 页 × 24 个/页）
- 单壁纸大小：HD 约 8-12MB，4K 约 20-30MB
- 全量下载（both 画质）约需 **200-250 GB** 磁盘空间
- 全量下载（仅 4K）约需 **150-180 GB**
- 全量下载（仅 HD）约需 **60-80 GB**
- 以 8 线程、0.3s 延时估算，全量下载约需 **6-10 小时**（取决于网络带宽）

## 注意事项

1. **磁盘空间**：全量下载数据量很大，请确保有足够的磁盘空间。建议先用 `--end-page 5` 测试。
2. **中断恢复**：随时可以按 `Ctrl+C` 中断，再次运行相同命令会自动从断点继续。
3. **网络建议**：如果下载速度慢，可适当增加 `--workers`（建议不超过 16）并减小 `--delay`。
4. **遵守规则**：本工具仅用于个人学习/备份用途，请尊重网站版权和 robots.txt 规则，合理控制请求频率。
5. **网站改版**：如遇网站结构变化导致爬取失败，可重新分析页面 HTML 结构并调整 `parse_list_page` / `parse_detail_page` 函数中的 CSS 选择器。
