# ikanju.cc (云播TV) 全站爬虫

## 网站技术分析

| 项目 | 详情 |
|------|------|
| **网站名称** | 云播TV (www.yunbo.net / www.ikanju.cc) |
| **建站程序** | MacCMS v10 (苹果CMS) |
| **CDN保护** | Cloudflare |
| **服务器** | Nginx + PHP |
| **视频类型** | 电影、电视剧、动漫、综艺 |
| **数据量** | 约 44,884+ 条视频 |
| **URL格式** | 详情页 `/vod-{id}.html`，播放页 `/play/{id}-{sid}-{nid}.html` |

## 加密逆向解密

播放器通过 `player_aaaa` JavaScript 变量传递配置，其中 `encrypt` 字段标识URL加密方式：

| encrypt值 | 加密方式 | 解密算法 |
|-----------|---------|---------|
| **0** | 明文 | 直接使用URL |
| **1** | URL编码 | `unescape(url)` → `urllib.parse.unquote(url)` |
| **2** | Base64+URL编码 | `unescape(base64_decode(url))` → `unquote(b64decode(url))` |

逆向自 `/static/js/player.js` 中 `MacPlayer.Init()` 初始化逻辑：
```javascript
if (player_data.encrypt == '2') {
    player_data.url = unescape(Base64.decode(player_data.url));
    player_data.url_next = unescape(Base64.decode(player_data.url_next));
} else if (player_data.encrypt == '1') {
    player_data.url = unescape(player_data.url);
    player_data.url_next = unescape(player_data.url_next);
}
```

## 播放机制

- 站内存储的URL指向各正版平台官方页面：爱奇艺(qiyi)、腾讯视频(qq)、优酷(youku)、芒果TV(mgtv)、哔哩哔哩(bilibili) 等
- ps="1" 的源（主流平台）通过第三方解析接口嵌入iframe播放：
  - 影视解析：`https://super.one-ai.cc/player/index.php?code=qw&amp;url={原始URL}`
  - M3U8解析：`https://super.yunbo.net/player/index.php?code=DP&amp;url={原始URL}`
- m3u8类源（lzm3u8/dnzm3u8/liangzi/hnm3u8）使用DPlayer播放器

## 功能特性

- ✅ **完整逆向解密**：支持 encrypt=0/1/2 三种加密URL的自动解密
- ✅ **Cloudflare兼容**：内置Session保持、Cookie管理、5秒盾自动重试
- ✅ **断点续爬**：SQLite数据库存储，重复运行自动跳过已爬取内容
- ✅ **多模式爬取**：全站爬取 / 分类爬取 / ID范围爬取 / 单视频爬取
- ✅ **多线程支持**：可配置并发线程数（建议1-3）
- ✅ **限速防封**：可配置请求间隔时间
- ✅ **数据导出**：支持导出为JSON和CSV格式
- ✅ **元数据完整**：片名/导演/主演/类型/地区/语言/年份/评分/海报/简介/集数/播放源

## 环境依赖

```bash
pip install requests beautifulsoup4
```

## 使用方法

### 1. 全站爬取（推荐）
```bash
python3 ikanju_spider.py --mode full --delay 1.0 --workers 2 --export
```

### 2. 仅爬取分类页可见视频
```bash
python3 ikanju_spider.py --mode category --delay 1.0
```

### 3. 按ID范围爬取
```bash
# 爬取ID 1~1000
python3 ikanju_spider.py --mode range --start 1 --end 1000 --delay 0.8
```

### 4. 爬取单个视频
```bash
python3 ikanju_spider.py --mode detail --id 44117
```

### 5. 导出已有数据
```bash
python3 ikanju_spider.py --mode export
```

## 参数说明

| 参数 | 说明 | 默认值 |
|------|------|--------|
| `--mode` | 爬取模式: full/category/range/detail/export | full |
| `--start` | 范围爬取起始ID | 1 |
| `--end` | 范围爬取结束ID（0表示自动探测） | 0 |
| `--id` | 单视频爬取时的视频ID | - |
| `--delay` | 请求间隔秒数，越小越快但越容易被封 | 1.0 |
| `--workers` | 并发线程数，建议不超过3 | 2 |
| `--db` | SQLite数据库文件路径 | ikanju_data.db |
| `--export` | 爬取完成后自动导出JSON和CSV | 否 |

## 输出文件

| 文件 | 说明 |
|------|------|
| `ikanju_data.db` | SQLite数据库，包含videos和play_sources两张表 |
| `ikanju_data.json` | JSON格式完整数据（导出后） |
| `ikanju_videos.csv` | CSV格式视频列表（导出后） |
| `ikanju_spider.log` | 爬虫运行日志 |

## 数据库结构

### videos 表（视频信息）
- vod_id: 视频ID（主键）
- type_name: 分类（电影/电视剧/动漫/综艺）
- vod_name: 片名
- vod_sub: 副标题/别名
- vod_director: 导演
- vod_actor: 主演
- vod_class: 类型标签
- vod_area: 地区
- vod_lang: 语言
- vod_year: 年份
- vod_score: 评分
- vod_pubdate: 上映日期
- vod_pic: 海报URL
- vod_blurb: 简介
- vod_hits: 播放量
- detail_url: 详情页URL

### play_sources 表（播放源/集数）
- vod_id: 所属视频ID（外键）
- source_from: 播放源代码（qq/qiyi/youku/mgtv/bilibili等）
- source_name: 播放源名称
- episode_name: 集数名称
- sid: 播放源序号
- nid: 集数序号
- encrypt: 加密方式（0=明文,1=URL编码,2=Base64）
- raw_url: 原始加密URL
- decrypted_url: 解密后URL
- parse_url: 解析接口iframe地址（可直接在浏览器中打开播放）
- play_url: 站内播放页URL

## 注意事项

1. **请求频率**：建议设置 `--delay 1.0` 以上，避免被Cloudflare封禁IP
2. **全站爬取时间**：全站约4.5万条视频，以delay=1、workers=2估算约需7-12小时
3. **视频内容**：该站聚合的是第三方平台页面链接，实际视频流由第三方解析接口提供，解析接口属于第三方服务，可能会有变动或失效
4. **Cloudflare**：如果遇到503验证（"Just a moment"），爬虫会自动等待重试；如果持续被拦截，可降低并发、增大间隔
5. **合法使用**：请遵守相关法律法规，仅用于个人学习研究，不得用于商业用途或侵犯版权
