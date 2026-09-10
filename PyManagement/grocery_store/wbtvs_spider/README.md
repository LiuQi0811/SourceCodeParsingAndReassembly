# wbtvs.cc 全站爬虫工具

针对 https://www.wbtvs.cc/ 网站的全站爬虫，内置Cloudflare绕过、JS加密逆向解密、M3U8视频自动解密下载功能。

## ✨ 功能特性

| 功能 | 说明 |
|------|------|
| 🛡️ **Cloudflare绕过** | 自动绕过Cloudflare 5秒盾防护 |
| 🔓 **JS逆向解密** | 支持Base64、Unicode、Eval Packer等多层加密解密 |
| 🎬 **M3U8解密** | 自动识别并解密AES-128-CBC加密的视频流 |
| 📊 **全站遍历** | 自动爬取电影、电视剧、动漫全部分类 |
| 💾 **数据存储** | 数据自动存入SQLite数据库，支持导出JSON |
| ⚡ **多线程下载** | 多线程并发下载TS片段，速度飞快 |
| 🔄 **断点续传** | 下载中断后自动跳过已完成片段 |
| 📝 **详细日志** | 完整记录爬取和下载过程 |

## 📁 文件说明

```
├── wbtvs_spider.py      # 主爬虫程序
├── m3u8_decryptor.py    # 独立的M3U8解密下载工具
├── requirements.txt     # Python依赖包
└── README.md           # 使用说明
```

## 🚀 快速开始

### 1. 安装依赖

```bash
pip install -r requirements.txt
```

或者手动安装：
```bash
pip install cloudscraper beautifulsoup4 lxml requests m3u8 pycryptodome aiohttp aiofiles tqdm
```

### 2. 运行爬虫

#### 仅爬取影片信息（不下载视频）
```bash
# 爬取所有分类前10页
python wbtvs_spider.py -p 10

# 只爬取电影分类
python wbtvs_spider.py -c dianying -p 5
```

#### 爬取信息并下载视频
```bash
# 爬取所有分类并下载视频
python wbtvs_spider.py --download -p 3

# 指定线程数
python wbtvs_spider.py -d -w 10 -p 2
```

### 3. 使用独立M3U8下载工具

如果你已经有了M3U8地址，可以直接使用独立工具下载：

```bash
# 基础下载（自动解密）
python m3u8_decryptor.py https://example.com/video.m3u8 -o 电影名.mp4

# 带Referer绕过防盗链
python m3u8_decryptor.py https://example.com/video.m3u8 -r https://www.wbtvs.cc/ -o output.mp4

# 自定义密钥解密
python m3u8_decryptor.py https://example.com/video.m3u8 -k your_key_hex

# 解密播放器JS文件提取地址
python m3u8_decryptor.py --decrypt-js player.js
```

## 🔧 解密功能说明

### 支持的JS加密类型

爬虫内置的JSDecryptor类支持以下加密类型自动解密：

1. **Base64编码** - 自动识别并解码Base64字符串
2. **Unicode转义** - 解密 `\uXXXX` 格式编码
3. **Hex编码** - 16进制字符串还原
4. **Eval Packer加密** - 这是苹果CMS最常用的加密方式，格式为：
   ```javascript
   eval(function(p,a,c,k,e,d){...}(...))
   ```
5. **多层嵌套加密** - 递归解密最多5层嵌套

### M3U8视频加密支持

- **AES-128-CBC** - 标准HLS加密，自动获取密钥并解密
- **自定义IV** - 支持M3U8中指定的IV或自动按序列号生成
- **多级M3U8** - 自动识别Master列表并选择最高画质
- **TS片段解密** - 每个TS片段独立解密后合并

## 📂 输出文件结构

运行后会生成 `wbtvs_downloads/` 目录：

```
wbtvs_downloads/
├── wbtvs.db                    # SQLite数据库，存放所有影片信息
├── wbtvs_all_videos.json       # 导出的JSON数据文件
└── videos/                     # 视频下载目录
    ├── 电影名1.mp4
    ├── 电影名2.mp4
    └── ...
```

### 数据库字段说明

| 字段 | 说明 |
|------|------|
| vod_id | 影片ID |
| title | 影片标题 |
| category | 分类 (电影/电视剧/动漫) |
| cover_url | 封面图片地址 |
| year | 年份 |
| area | 地区 |
| type | 类型 |
| director | 导演 |
| actors | 主演 |
| description | 剧情简介 |
| detail_url | 详情页URL |
| m3u8_urls | 视频播放地址列表 |
| download_status | 下载状态 |

## ⚠️ 注意事项

1. **访问频率** - 爬虫已内置随机延迟（2-5秒），请勿修改过小以免被封IP
2. **Cloudflare** - 如遇403或503错误，爬虫会自动重试，无需手动干预
3. **版权声明** - 本工具仅供学习研究使用，请遵守相关法律法规
4. **网络环境** - 建议在网络稳定的环境下运行，视频下载需要较大带宽

## 🛠️ 常见问题

### Q: 提示触发Cloudflare验证怎么办？
A: 爬虫会自动重试，一般等待几秒后会自动通过。如果持续失败可以：
- 增加 `delay_min` 和 `delay_max` 配置
- 减少 `max_workers` 线程数
- 等待几分钟后再运行

### Q: 视频下载失败或无法播放？
A: 可能的原因：
- M3U8地址有防盗链，需要指定正确的Referer
- 密钥获取失败，可以手动指定key参数
- 视频链接已失效，可以重新爬取获取最新地址

### Q: 如何只下载某一部影片？
A: 先爬取信息到数据库，找到对应m3u8地址，然后用m3u8_decryptor.py单独下载。

### Q: 解密功能没找到视频地址？
A: 可以将播放页的JS文件保存下来，使用：
```bash
python m3u8_decryptor.py --decrypt-js your_js_file.js
```

## 📋 命令参数详解

### wbtvs_spider.py 参数

```
-c, --category   指定爬取分类，可选: dianying dianshiju dongman
-p, --pages      每个分类爬取的最大页数
-d, --download   爬取后自动下载视频
-w, --workers    并发线程数，默认5
--demo-decrypt   演示解密功能
```

### m3u8_decryptor.py 参数

```
url              M3U8视频地址
-o, --output     输出MP4文件名
-k, --key        自定义解密密钥（hex格式）
--iv             自定义IV（hex格式）
-r, --referer    指定Referer防盗链地址
-w, --workers    下载线程数，默认15
--decrypt-js     解密本地JS文件并提取视频地址
```

## 🔬 技术实现原理

1. **Cloudflare绕过**：使用cloudscraper库模拟真实浏览器TLS指纹，自动解决JS挑战
2. **JS解密引擎**：递归检测加密特征，逐层解密直到获得明文代码
3. **M3U8解析**：使用m3u8库解析播放列表，自动处理多级码率
4. **AES解密**：使用pycryptodome实现标准AES-128-CBC解密，自动处理PKCS7填充
5. **并发下载**：ThreadPoolExecutor实现线程池，tqdm显示下载进度

---

**免责声明**：本工具仅供学习交流使用，请勿用于非法用途。使用本工具产生的一切后果由使用者自行承担。
