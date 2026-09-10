# 泥视频(nivod.vip)全站爬虫

## 站点分析结论

经实测逆向分析，该站基于 **MacCMS10（苹果CMS）** 模板搭建，关键结论：

| 项 | 结果 |
|---|---|
| 页面入口 | 首页 / 分类 / 详情 / 播放页 全部为服务端渲染HTML |
| 列表URL | `/k/{typeId}--------{page}---/` (如 `/k/1--------2---/`) |
| 详情URL | `/nivod/{vod_id}/` |
| 播放URL | `/niplay/{vod_id}-{source_id}-{episode_id}/` |
| 播放地址存储 | 播放页源码内联 `<script>var player_aaaa = {...}</script>` |
| **加密状态** | **`player_aaaa.encrypt=0`，m3u8 明文直出**，**无需任何JS逆向/解密** |
| 播放源 | 共 7 条线路(自营1/2线、大陆0/3/5/6线、全球3线)，均已解析 |
| 反爬强度 | 极弱。仅UA校验，无签名/无cookie/无加密参数 |

> 你担心的「逆向解密」在这个站点上是**不需要的**——播放地址直接以JSON写死在HTML里，json.loads 即可拿到完整 m3u8/mp4 链接。

## 文件结构

```
nivod_crawler/
├── nivod_spider.py     # 主爬虫
└── data/
    ├── nivod_all.json  # 完整结构化数据(含每集m3u8)
    ├── nivod_episodes.csv   # 每集一行的清单
    └── done_{typeId}.txt    # 断点续爬记录
```

## 环境要求

```bash
pip install requests beautifulsoup4 lxml tqdm
# 若需下载视频，请先安装 ffmpeg:
#   apt install ffmpeg  /  brew install ffmpeg  /  Windows下载官网包
```

## 使用方法

### 1. 爬取全站元数据 + 所有 m3u8 直链（推荐）

```bash
# 四大分类全量抓取(电影/剧集/综艺/动漫)
python nivod_spider.py

# 只抓电影+剧集(节省时间)
python nivod_spider.py --types 1,2

# 指定并发(默认4，建议不超过8，避免被封IP)
python nivod_spider.py --concurrency 8

# 每分类只抓前3页(快速预览)
python nivod_spider.py --max-pages 3
```

### 2. 断点续爬

中途中断后，加 `--resume` 会自动跳过已完成视频：

```bash
python nivod_spider.py --resume
```

### 3. 直接下载视频（调用ffmpeg）

```bash
# 先下载前10集测试
python nivod_spider.py --download --max-download 10 --download-dir ./videos

# 全量下载(不设--max-download则把抓取到的全部下完,体积很大,慎用)
python nivod_spider.py --download --download-dir /mnt/nivod
```

ffmpeg 会使用 `-c copy` 直接封装，**不重新编码**，速度接近网速极限。

## 输出字段说明

### `nivod_all.json` 结构

```json
[
  {
    "id": "126374",
    "title": "尼诺",
    "url": "https://www.nivod.vip/nivod/126374/",
    "cover": "https://.../xxx.jpg",
    "tags": ["2025", "法国", "剧情", "剧情片", "波利娜·洛克"],
    "description": "...",
    "type_name": "电影",
    "sources": [
      {
        "source_id": 1,
        "source_name": "大陆0线",
        "episodes": [
          {
            "nid": 1,
            "title": "正片",
            "play_url": "https://www.nivod.vip/niplay/126374-1-1/",
            "m3u8": "https://hn.bfvvs.com/play/bW6qkmoa/index.m3u8",
            "provider": "bfvvs"
          }
        ]
      }
    ]
  }
]
```

### `nivod_episodes.csv` 字段

| type | vid | title | source | episode_no | episode_title | play_page | m3u8_url |
|---|---|---|---|---|---|---|---|
| 电影 | 126374 | 尼诺 | 大陆0线 | 1 | 正片 | https://.../niplay/... | https://...m3u8 |

## 实测验证

首次小批量跑测（电影分类第1页72部电影）：
- 抓取视频：72 个
- 抓取集数：337 集
- 解析 m3u8 成功率：**337/337 (100%)**
- 覆盖线路：大陆0线 / 大陆5线 / 全球3线等 7条线路全部成功

## 注意事项

1. **m3u8链接有时效性**：第三方CDN的m3u8链接一般数小时到数天有效，建议抓完后尽快下载或转存。
2. **全量数据量**：电影559页（约1.2万部），加上剧集/综艺/动漫全量预计在 4-5万条视频、约 50-100万集，全量跑+全量下载需要较长时间和较大磁盘，建议按分类分批执行。
3. **并发控制**：默认4线程，每请求间0.2-0.5秒随机延迟。如遇到403/503可降低到2线程。
4. **合法性提示**：本脚本仅供学习交流使用，请尊重版权，下载内容请勿用于商业传播。
