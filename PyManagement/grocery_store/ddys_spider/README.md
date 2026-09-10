# 低端影视 ddys.io 全站爬虫

## ⚠️ 重要声明

1. 本工具仅供学习研究使用，禁止用于商业用途
2. 请尊重版权，下载的内容请在24小时内删除
3. 使用本工具产生的任何法律责任由使用者自行承担
4. 请合理控制抓取频率，避免对网站服务器造成压力

## 🔍 逆向分析结果

### 网站防护

- **Cloudflare 5秒盾**: 通过 `cloudscraper` 库自动绕过，无需手动处理Cookie
- **CSRF Token**: 仅用于评论/反馈等交互功能，视频列表和播放无需验证

### 加密机制逆向结论

**好消息：视频地址未做任何加密！**

经逆向分析，新版 ddys.io 网站直接将视频URL明文输出在页面内联JS中：

1. **视频源格式**: 直接嵌入 `const firstSource = {...}` 和 `switchSource()` 函数参数中
2. **多集格式**: 使用简单的分隔符编码 `第01集$URL1#第02集$URL2#...`
3. **网盘链接**: 使用标准 Base64 编码（JS中调用 `atob()` 解码）
4. **视频格式**: 全部为 HLS (m3u8) 格式，可直接用 ffmpeg 下载

> 历史版本 ddys.art 曾有 `/getvddr/video?id=加密字符串` 接口，新版已废弃。

## 📁 文件说明

| 文件 | 功能 |
| --- | --- |
| `ddys_spider.py` | 核心爬虫，支持列表抓取/详情抓取/视频下载 |
| `ddys_utils.py` | 辅助工具，CSV导出/网盘汇总/批量下载 |
| `ddys_data/` | 数据输出目录（自动创建） |

## 🚀 使用方法

### 1. 安装依赖

`pip install cloudscraper beautifulsoup4 requests tqdm lxml`\
\
`# 如需下载视频，请安装ffmpeg`\
`# Ubuntu/Debian:`\
`sudo apt install ffmpeg`\
`# macOS:`\
`brew install ffmpeg`\
`# Windows: 从ffmpeg.org下载后放入PATH`

### 2. 基础使用

抓取单个影视详情

`python ddys_spider.py --url https://ddys.io/movie/sheep-in-the-box`

输出示例：

`标题: 盒子里的羊`\
`ID: 6640`\
`播放源数量: 1`\
`  播放源1 (m3u8): 1集`\
`    正片: https://xxx/index.m3u8...`\
\
`网盘资源: 3个`\
`  [quark] https://pan.quark.cn/s/xxx`\
`  [baidu] https://pan.baidu.com/s/xxx?pwd=sgy5 提取码:sgy5`\
`  [xunlei] https://pan.xunlei.com/s/xxx?pwd=nj24 提取码:nj24`

抓取全站索引（所有影视列表）

`python ddys_spider.py --list`

- 遍历所有分类（电影/剧集/综艺/动漫）的分页
- 保存到 `ddys_data/index.json`
- 自动断点续传，重复运行跳过已抓取

抓取全站完整数据（含视频源/网盘）

`python ddys_spider.py --full --workers 3`

- 会先抓取列表，再逐个访问详情页解析视频地址
- 建议 `--workers` 不要超过3，避免被Cloudflare拦截
- 保存到 `ddys_data/full_data.json`

### 3. 视频下载

下载单个影视（需ffmpeg）

`python ddys_spider.py --download --url https://ddys.io/movie/xxx`

使用工具脚本下载JSON文件中的视频

`# 下载前3集`\
`python ddys_utils.py --download ddys_data/sheep-in-the-box.json --episodes 3`\
\
`# 指定播放源（多源时）`\
`python ddys_utils.py --download ddys_data/xxx.json --source 1`

### 4. 数据导出

导出为CSV表格（Excel可打开）

`python ddys_utils.py --csv ddys_data/full_data.json`

导出所有网盘链接汇总

`python ddys_utils.py --netdisk ddys_data/full_data.json`

输出到 `ddys_data/netdisk_links.txt`

## 📊 数据格式说明

### index.json（列表索引）

`[`\
`  {`\
`    "url": "https://ddys.io/movie/sheep-in-the-box",`\
`    "slug": "sheep-in-the-box",`\
`    "title": "盒子里的羊",`\
`    "category": "movie",`\
`    "rating": 5.7,`\
`    "year": 2026,`\
`    "poster": "https://img.ddys.io/...",`\
`    "page": 1`\
`  }`\
`]`

### full_data.json（完整详情）

`[`\
`  {`\
`    "movie_id": 6640,`\
`    "title": "盒子里的羊",`\
`    "url": "https://ddys.io/movie/sheep-in-the-box",`\
`    "rating": 5.7,`\
`    "poster": "https://img.ddys.io/...",`\
`    "description": "...",`\
`    "video_sources": [`\
`      {`\
`        "source_id": 40128,`\
`        "source_name": "播放源1",`\
`        "format": "m3u8",`\
`        "quality": "1080P",`\
`        "episode_count": 14,`\
`        "episodes": [`\
`          {`\
`            "name": "第01集",`\
`            "url": "https://xxx/index.m3u8"`\
`          }`\
`        ]`\
`      }`\
`    ],`\
`    "netdisk_resources": [`\
`      {`\
`        "type": "baidu",`\
`        "url": "https://pan.baidu.com/s/xxx?pwd=sgy5",`\
`        "password": "sgy5"`\
`      }`\
`    ]`\
`  }`\
`]`

## 🛠️ 技术要点

### 1. Cloudflare绕过

使用 `cloudscraper` 库，它能够：

- 自动解析Cloudflare JavaScript挑战
- 模拟正确的TLS指纹（JA3）
- 维护有效的Cookie会话

### 2. 反检测措施

- 随机User-Agent（Chrome浏览器）
- 请求间随机延迟（1\~3秒）
- 合理的Referer链
- 低并发（默认3线程）

### 3. 多集解析算法

`// 网站原始JS的解析逻辑`\
`function parseEpisodes(url) {`\
`    const episodes = [];`\
`    const parts = url.split('#');`\
`    for (const part of parts) {`\
`        if (part.indexOf('$') !== -1) {`\
`            const [name, epUrl] = part.split('$');`\
`            episodes.push({name, url: epUrl});`\
`        }`\
`    }`\
`    return episodes;`\
`}`

本爬虫的Python实现完全复现了该逻辑。

### 4. 网盘解码

`# 网站JS: url = atob(encodedUrl);`\
`# Python等价:`\
`import base64`\
`url = base64.b64decode(encoded_url).decode('utf-8')`

## 📝 分类URL结构

| 分类 | URL路径 | 预计数量 |
| --- | --- | --- |
| 电影 | `/movie` | \~3000部 |
| 剧集 | `/series` | \~1500部 |
| 综艺 | `/variety` | \~300部 |
| 动漫 | `/anime` | \~500部 |
| 分页 | `/page/N` | 每页24部 |

## ⚡ 性能优化建议

1. **先用--list索引，再用--full详情**：分步执行可随时中断
2. **workers不要超过5**：过高并发会触发Cloudflare临时封禁
3. **下载视频选对源**：一个影视通常有2-3个源，优先选速度快的CDN
4. **使用m3u8下载器**：如需更高下载速度，可将导出的URL用N_m3u8DL-CLI等专用工具下载

## ❓ 常见问题

**Q: 为什么返回403 Forbidden**?A: Cloudflare拦截了请求，等待几分钟后再试，或降低并发数。

**Q: 视频下载速度慢**?A: 这是第三方CDN的速度限制，不是爬虫问题，可以尝试切换不同播放源。

**Q: m3u8下载后无法播放**?A: 部分CDN有防盗链，需要在ffmpeg中设置正确的Referer，代码中已自动处理。

**Q: 抓取中断了怎么办**?A: 直接重新运行命令，已抓取的数据会自动跳过。

## 📜 版本历史

- 2026-09: 适配新版 ddys.io，移除旧版src1解密逻辑，视频地址已明文