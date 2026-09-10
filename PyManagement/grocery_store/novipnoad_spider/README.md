# novipnoad.net 全站爬虫

一个功能完备的影视站全站抓取工具，针对 **NO视频(novipnoad.net)** 开发，集成 Cloudflare 绕过、接口自动解密、m3u8 视频下载等能力。

## 功能特性

### 反爬绕过
- **三级 Cloudflare 回退方案**：cloudscraper → undetected-chromedriver → playwright，自动处理 CF 5秒盾和人机验证
- 随机 User-Agent、请求延迟、浏览器指纹伪装
- 自动切换备用域名（该站频繁更换域名 .com/.net/.me/.uk/.us）

### 页面解析
- 自动识别 MacCms/AppleCMS/飞飞CMS 等常见影视站模板
- 解析首页/分类页/列表页/详情页/搜索页/播放页
- 提取标题/封面/导演/演员/类型/地区/简介/评分等完整元数据
- 多播放源、多剧集完整采集
- 智能分页、URL 去重

### 解密逆向（核心）
- **AES 自动解密**：自动从页面 JS 中提取密钥和 IV，暴力尝试 AES-CBC/ECB 多种填充
- **多层编码解码**：自动识别 Base64/URL/Hex 多层嵌套编码
- **player_aaaa 解析**：兼容 MacCms 标准加密播放器配置
- **m3u8 AES-128 分片解密**：自动下载密钥并解密 HLS 加密分片
- **iframe 嵌套穿透**：自动追踪并解析嵌套的第三方播放器

### 视频下载
- m3u8(HLS) 多线程分片下载（默认16并发）
- mp4 直链断点续传
- AES-128 加密分片自动解密合并
- 自动选择最高清晰度码流
- 下载进度条展示

### 工程化
- SQLite 数据库，断点续爬、任务队列
- HTML 本地镜像保存
- 完整日志记录
- JSON 数据导出

## 文件结构

```
novipnoad_spider/
├── main.py           # 主程序入口（CLI 命令）
├── config.py         # 配置文件（域名、路径、并发、密钥等）
├── requester.py      # HTTP 请求器（CF 三级绕过）
├── parser.py         # 页面解析器（首页/列表/详情/播放/搜索）
├── decryptor.py      # 解密模块（AES/Base64/CryptoJS）
├── database.py       # SQLite 数据库（任务队列 + 元数据）
├── downloader.py     # 视频下载器（m3u8/mp4，多线程）
├── requirements.txt  # Python 依赖
└── README.md         # 本文件
```

## 安装

```bash
cd novipnoad_spider
pip install -r requirements.txt

# 如需使用 playwright（最强 CF 绕过），执行：
playwright install chromium
```

## 使用方法

### 1. 爬取全站元数据（默认，不下载视频）
```bash
python main.py crawl
```

### 2. 爬取全站并下载所有视频（占带宽和磁盘）
```bash
python main.py crawl --download
```

### 3. 限制爬取数量
```bash
python main.py crawl --max 100
```

### 4. 只爬指定分类
```bash
python main.py crawl --category 美剧
python main.py crawl --category 电影
python main.py crawl --category 韩剧
```

### 5. 搜索关键词（自动爬取搜索结果）
```bash
python main.py search "权力的游戏"
python main.py search "Breaking Bad"
```

### 6. 直接下载单个视频
```bash
python main.py download "https://www.novipnoad.net/v/xxxxx.html"
```

### 7. 导出爬取数据
```bash
python main.py export --output videos.json
```

## 配置说明

编辑 `config.py`：

| 参数 | 说明 |
|------|------|
| `BASE_URL` / `ALT_DOMAINS` | 主域名和备用域名列表 |
| `MAX_WORKERS` | 并发数（默认5） |
| `REQUEST_DELAY` | 请求随机延迟范围（秒） |
| `DOWNLOAD_VIDEOS` | 是否下载视频文件（默认 False，仅抓元数据） |
| `M3U8_CONCURRENT` | m3u8 分片下载并发数（默认16） |
| `USE_PROXY` / `PROXY` | 是否使用代理 |
| `PREFERRED_QUALITY` | 首选清晰度 |
| `USE_BROWSER_CF_BYPASS` | 是否启用浏览器模式绕过 CF |

## 解密原理说明

影视站视频地址常见的加密方式及本工具的对策：

1. **CryptoJS AES 加密**：很多 MacCms 站使用 `CryptoJS.AES.encrypt(url, key, {iv: iv})` 加密播放地址。工具会：
   - 正则扫描页面 JS 提取可能的 key/iv
   - 尝试 MD5/SHA1/SHA256 派生密钥（CryptoJS 常用 passphrase 模式）
   - 遍历 CBC/ECB 模式和 PKCS7 填充

2. **多层 Base64/URL 编码**：工具通过循环尝试解码，直到输出不再变化。

3. **m3u8 EXT-X-KEY**：HLS 标准的 AES-128 分片加密，工具自动下载 key URI 对应的密钥并解密每个 TS 分片。

4. **Cloudflare 5秒盾**：普通 HTTP 库会被 CF 的 JS 挑战拦截，本工具使用 cloudscraper 模拟 JS 执行；如被更严格的规则拦截，自动回退到真实浏览器（undetected-chromedriver）完成验证再抓取。

## 输出目录

```
downloads/
├── html/          # 全站 HTML 镜像
├── videos/        # 下载的视频文件
├── images/        # 图片资源
├── logs/          # 运行日志
└── spider.db      # SQLite 数据库（任务+元数据）
```

## 注意事项

1. **仅供学习研究**：请尊重版权，不要用于商业用途或大规模传播
2. **控制爬取频率**：建议保持默认延迟，避免给目标站点造成过大压力
3. **视频下载会产生大量流量**：m3u8 下载会并发请求大量分片，请确保网络环境允许
4. **域名可能变化**：如访问失败，工具会自动尝试备用域名；若全部失效，可在 `config.py` 中更新
5. **Cloudflare 防护升级**：如 cloudscraper 失效，确保已安装 playwright/chromedriver，工具会自动用真实验证

## 常见问题

**Q: 遇到 403 / Cloudflare 拦截怎么办？**
A: 确保安装了 playwright 或 undetected-chromedriver，工具会自动回退到浏览器模式。

**Q: 某些视频解析不到真实地址？**
A: 部分视频使用第三方播放器嵌套，工具已做 iframe 穿透；如仍失败，可开启 `use_browser=True` 强制浏览器渲染，等待 JS 执行完毕后再提取。

**Q: m3u8 下载后无法播放？**
A: 检查分片是否全部下载成功（日志会提示失败分片数），重试即可；加密分片已自动解密，合并后的 .ts 文件可直接用 VLC/potplayer 播放。
