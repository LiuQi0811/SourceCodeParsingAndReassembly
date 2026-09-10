# 樱之空动漫 (skr.skr2.cc:666) 全站爬虫

## 站点特征分析
- 架构：**MacCMS V10**（路径 `voddetail / vodplay / vodshow`、`player_aaaa` 全局变量、`player.js` 标准播放器）
- 播放地址加密：`player_aaaa.encrypt = 2`
  - 加密方式：`unescape(base64(url))` 的逆过程 —— 即**自定义 Base64 解码后再 URL 解码**
  - 本项目 `maccms_b64decode()` 严格对齐官方 `player.js` 中的 base64 字符映射表，**100% 还原真实直链**（已验证：`JTY4JTc0JTc0JTcw...` → `https://vip.ffzy-play6.com/20230321/24179_bd4a3bf5/index.m3u8`）
- 列表分页 URL：`/vodshow/{tid}--------{page}---/`
- 有效分类 tid：`1,2,4,22,32,46,47,74,80,81,82,83,84,85,90,91,92`
- 播放页 URL：`/vodplay/{vod_id}-{sid}-{nid}/`（sid=源序号，nid=集数序号）

## 功能
- 多线程抓取（可配置并发数）
- 自动识别总页数，按分类→列表→详情→播放页全链路抓取
- **完美还原 encrypt=2 加密的真实 m3u8/mp4 直链**（同步兼容 encrypt=0/1）
- 抽取元数据：标题、封面、导演、主演、分类、简介、详情页URL
- 多播放源 + 所有分集 逐一解密
- **断点续爬**：程序中断后再次运行会跳过已抓取内容，自动从断点继续
- 多格式导出：
  - `skr_data/videos.json`（完整结构化数据，用于断点续爬）
  - `skr_data/videos.csv`（Excel 可直接打开的表格）
  - `skr_data/all.m3u`（全站汇总播放列表，扔给播放器直接看）
  - `skr_data/m3u/{id}_{标题}.m3u`（每部番单独的播放列表）

## 使用方法

### 1. 安装依赖
```bash
pip3 install requests beautifulsoup4
```

### 2. 运行
```bash
# 全量爬取全站所有分类（默认17个分类）
python3 skr_spider.py

# 指定分类（比如只抓日漫+剧场版，tid=1和46）
python3 skr_spider.py --tids 1,46

# 并发10线程
python3 skr_spider.py --workers 10

# 每分类最多爬5页（快速试用）
python3 skr_spider.py --pages 5

# 测试模式（每分类只爬前2页）
python3 skr_spider.py --test
```

### 3. 输出
所有产物在 `./skr_data/` 目录下：
```
skr_data/
├── videos.json         # 完整JSON（断点续爬用）
├── videos.csv          # Excel表格
├── all.m3u             # 全站M3U汇总
└── m3u/
    └── {id}_{标题}.m3u # 单部番M3U
```

把 `all.m3u` 用 PotPlayer / VLC / IINA / nPlayer 等播放器打开即可直接播放。

## 验证过的解密样例
| 加密值 (encrypt=2) | 解密后真实地址 |
|---|---|
| `JTY4JTc0JTc0JTcwJTczJTNBJTJGJTJGJTc2JTY5JTcwJTJFJTY2JTY2JTdBJTc5JTJEJTcwJTZDJTYxJTc5JTM2JTJFJTYzJTZGJTZEJTJGJTMyJTMwJTMyJTMzJTMwJTMzJTMyJTMxJTJGJTMyJTM0JTMxJTM3JTM5JTVGJTYyJTY0JTM0JTYxJTMzJTYyJTY2JTM1JTJGJTY5JTZFJTY0JTY1JTc4JTJFJTZEJTMzJTc1JTM4` | `https://vip.ffzy-play6.com/20230321/24179_bd4a3bf5/index.m3u8` |

## 注意
- 目标站点为 https，使用自签名证书，脚本已自动忽略证书校验
- 脚本内置请求延迟（每页 0.3s，每个播放页 0.15s）+ 失败重试3次，避免对站点造成压力
- 如需下载视频流，可用 ffmpeg / N_m3u8DL-CLI 对 M3U 中的地址进行下载
