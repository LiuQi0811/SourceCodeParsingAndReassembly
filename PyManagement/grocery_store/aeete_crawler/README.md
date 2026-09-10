# Auete 影视网全站爬虫 (https://www.aeete.com/)

## 🔍 加密逆向分析结论

该站播放页使用的是**标准 Base64 编码**加密 m3u8 地址，无 JS 混淆、无签名 token、无 cookie 校验、无加密滑块/验证码，属于最简单的可逆向站点。

- **加密位置**：播放页内联脚本中 `var now = base64decode("xxxx");`
- **加密算法**：标准 UTF-8 Base64（与 Python `base64.b64decode` 完全一致）
- **解密方式**：对引号内字符串做 Base64 解码即可得到真实 m3u8 地址
- **站点 `base64decode` 函数**：`/js/function.js` 中实现，即标准 RFC 4648 Base64

实测解密示例：

| 加密值 (base64) | 解密后 (m3u8) |
|---|---|
| `aHR0cHM6Ly92aXAuZHl0dC1zZWUuY29tLzIwMjYwOTEwLzQzODI1XzFhMzE4NTZjL2luZGV4Lm0zdTg=` | `https://vip.dytt-see.com/20260910/43825_1a31856c/index.m3u8` |

## 📁 文件结构

```
aeete_crawler/
├── aeete_spider.py         # 主爬虫（全量抓取 + Base64解密）
├── m3u8_downloader.py      # 可选：用 ffmpeg 下载 m3u8 为 mp4
├── requirements.txt        # Python 依赖
├── README.md               # 本文件
└── output/                 # 运行后生成
    ├── aeete.db            # SQLite 数据库（所有影片结构化数据）
    ├── index.csv           # CSV 索引表（Excel可直接打开）
    ├── json/               # 每部影片一个 JSON 详情文件
    ├── covers/             # 封面图目录（加 --no-covers 则不下载）
    └── spider.log          # 运行日志
```

## 🚀 快速开始

```bash
# 1. 安装依赖
pip install -r requirements.txt

# 2. 小范围测试（每分类抓前2页，推荐先跑一下验证环境）
python aeete_spider.py --max-pages 2 --delay 0.8 --no-covers

# 3. 全量全站抓取（电影/电视剧/综艺/动漫/其他，共约 20000+ 部）
python aeete_spider.py --delay 1.0 --workers 3

# 4. 只抓指定分类
python aeete_spider.py --cats 电影,电视剧 --max-pages 5

# 5. 需要走代理（如境外IP被限）
python aeete_spider.py --proxy http://127.0.0.1:7890
```

### 参数说明

| 参数 | 默认 | 说明 |
|---|---|---|
| `--max-pages` | 0(全部) | 每个分类最多抓取的列表页数 |
| `--delay` | 1.0 | 请求间隔秒数（建议≥0.8，避免被封） |
| `--workers` | 3 | 详情页并发线程数 |
| `--proxy` | 无 | HTTP/SOCKS 代理 |
| `--no-covers` | False | 不下载封面图 |
| `--cats` | 全部分类 | 指定分类，逗号分隔：`电影,电视剧,综艺,动漫,其他` |

## 📥 （可选）下载视频

爬虫**仅抓取元数据和 m3u8 直链**，不自动下载视频（版权和带宽原因）。如需下载某部影片：

```bash
# 系统需要先安装 ffmpeg
apt install ffmpeg     # Ubuntu/Debian
brew install ffmpeg    # macOS

# 方式1：直接传 m3u8
python m3u8_downloader.py "https://xxx/index.m3u8" 电影名.mp4

# 方式2：从爬虫输出的 JSON 自动读取第一集
python m3u8_downloader.py --from-json output/json/buchenggongchuanyuezhinan.json
```

## 📊 抓取字段

每部影片包含：

- **基础信息**：vid / 片名 / 别名 / 导演 / 编剧 / 主演 / 分类标签 / 语言 / 地区 / 上映年份 / 时长 / 备注 / 评分 / 热度 / 更新时间 / 封面URL
- **简介**：剧情介绍全文
- **剧集列表**：每一集的名称 + 详情页URL + **解密后的真实 m3u8 地址** + 下一集m3u8

## 🛡 反爬应对

- ✅ 随机 User-Agent 池（4个主流浏览器轮换）
- ✅ 随机延时、带 Referer
- ✅ 请求失败自动重试（最多3次）
- ✅ 断点续爬（已入库的影片下次自动跳过）
- ✅ 多线程隔离 Session，避免 Cookie 污染
- ✅ 支持 HTTP 代理

## ⚠️ 免责声明

本工具仅用于学习爬虫技术与逆向分析研究。请勿用于商业用途，请遵守目标网站的 `robots.txt` 与当地法律法规。视频版权归原站点及片方所有。
