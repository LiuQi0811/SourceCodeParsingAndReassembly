# 饭搭子影视 (fdzys.com) 全站爬虫

> 站点类型：MacCMS v10（米知/mizhiady 模板）
> 无需加密逆向——播放页 `encrypt=0`，播放源页返回明文相对 m3u8，JS 解析已实现

## ✨ 功能特性

- ✅ 全站 6 大分类完整抓取：电影、电视剧、动漫、综艺、短剧、体育
- ✅ 自动探测每个分类的最大页数（二分探测）
- ✅ 详情页元数据：标题 / 封面 / 导演 / 主演 / 类型 / 地区 / 年份 / 评分 / 简介 / 备注
- ✅ 全线路+全集数抓取（每个播放源、每一集的站点播放URL）
- ✅ **自动逆向解析真实 m3u8 直链**（已逆向验证：访问播放页 → 取 `const url` → 拼接绝对路径）
- ✅ 随机 UA、随机延迟、失败自动重试
- ✅ 断点续爬（SQLite 去重）
- ✅ 封面图本地下载
- ✅ 数据双格式保存：`SQLite (.db)` + `JSON`
- ✅ 可选：调用 `ffmpeg` 下载 m3u8 合并为 mp4

## 📂 目录结构

```
fdzys_crawler/
├── fdzys_crawler.py      # 主程序
├── requirements.txt
└── README.md

运行后会在同级目录生成：
fdzys_data/
├── fdzys.db              # SQLite 数据库（videos / episodes 两张表）
├── fdzys_all.json        # 全部数据JSON导出
├── crawl.log             # 日志
├── images/               # 封面图
└── videos/               # 下载的视频（开启 --download-video 时）
```

## 🚀 使用方法

### 1. 安装依赖
```bash
pip install -r requirements.txt
```

### 2. 快速开始（只抓元数据 + m3u8，不下载视频，推荐）
```bash
python fdzys_crawler.py
```

### 3. 指定分类 / 页数
```bash
# 只抓电影前10页、电视剧前10页
python fdzys_crawler.py --categories movie tv --max-pages 10
```

支持的分类名：
| 参数 | 分类 |
|------|------|
| `movie` | 电影 |
| `tv` | 电视剧 |
| `dongman` | 动漫 |
| `zongyi` | 综艺 |
| `duanju` | 短剧 |
| `tiyu` | 体育 |

### 4. 下载视频（需 ffmpeg，慎开）
```bash
python fdzys_crawler.py --download-video
```
> 注：视频文件较大，全站下载需要极大磁盘空间和带宽，建议先只抓元数据。

## 🔍 逆向说明

该站基于 MacCMS v10，mizhiady 模板。播放地址逆向过程：

1. **详情页** 内嵌 JS 变量 `var player_aaaa = {...}`，其中包含：
   - `url`: 播放源分享页（如 `https://vip.dytt-see.com/share/2ddd93f...`）
   - `from`: 线路标识
   - `encrypt: 0` → 无需解密
2. **播放源分享页** 返回 HTML 里直接写了：
   ```js
   const vid = "2ddd93f42feeba056d189ad5a84f1793";
   const url = "/20260830/43779_2ddd93f4/index.m3u8?sign=434fc0807eb...";
   ```
3. **拼接绝对路径**：`urljoin(play_src_page, const_url)` 即为真实 m3u8 地址。
4. 用 ffmpeg 带 Referer 头下载合并即可得到 mp4。

## ⚠️ 免责声明

本工具仅用于学习交流爬虫技术，抓取内容版权归原网站所有。
请遵守当地法律法规，请勿将抓取的内容用于商业用途或非法传播。
