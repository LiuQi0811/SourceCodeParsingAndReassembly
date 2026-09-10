# 播剧网 (ysxq.cc) 全站爬虫 / 逆向说明

## 🔍 站点逆向分析

该站基于 **MacCMS v10 + dsn2模板**，全程无加密、无混淆，无需JS渲染即可获取全部数据：

### 1. 列表数据接口
- URL: `POST https://ysxq.cc/index.php/ds_api/vod`
- 参数（从列表页 `#dataList` 元素的 `data-*` 属性读取）:
  ```
  type=1          # 分类ID(1电影/2连续剧/3综艺/4动漫/45体育/60短剧)
  class/area/year/lang/version/state/letter/weekday = ''   # 过滤条件
  by=''           # 排序方式
  page=1          # 页码
  ```
- 返回 JSON：`{code:1, page:1, pagecount:3862, total:154470, list:[{vod_id, vod_name, vod_pic, vod_remarks, vod_actor, vod_blurb, ...}]}`
- 每页 40 条，JSON 直出，无需登录/签名/cookie

### 2. 视频播放直链（核心逆向点）
- 播放页URL规则：`https://ysxq.cc/vodplay/{vid}-{sid}-{nid}.html`
  - vid = 影片ID，sid = 播放源序号（1,2,3...），nid = 集数序号（从1开始）
- 页面内直接嵌入三个暴露点（**完全不需要解密**）：
  1. `episodeDataBase64` 变量：Base64 编码的 JSON 数组，一次性包含该播放源**全部集数**的 `{name, url(m3u8直链), index}`
  2. `mac_player_info` 变量：JS 对象，含 `url`(当前集m3u8直链) 与 `url_next`(下集)
  3. `<iframe id="wg-player" src="https://player.91ju.cc/?url=<URL编码的m3u8>&name=...">` ：iframe 的 src 参数直接带出 m3u8
- **关键技巧**：访问 `/vodplay/{vid}-1-1.html`（第一源第一集），通过 `episodeDataBase64` 解码即可一次拿到该源**所有集数**的 m3u8 直链，**无需逐集请求**

### 3. 注意点
- 部分页面 JS 变量被嵌套在字符串中，引号呈现为 `\"` 转义形式，正则匹配前需先 `replace('\\"', '"')`
- m3u8 分片实际托管在第三方CDN（`vip.dytt-tvs.com`、`cdn.yzzy31-play.com`、`v13.wsyzym3u8.com` 等），下载时需要带 Referer
- 若 sid=1 不可用，可依次尝试 sid=2、sid=3

## 🚀 使用方法

```bash
# 安装依赖
pip install requests tqdm beautifulsoup4 lxml

# 基本用法(全量抓所有影片元数据 + m3u8直链,不下载视频)
python crawler.py

# 只抓前2页测试
python crawler.py --max-pages 2

# 只抓电影和连续剧
python crawler.py --categories 1,2

# 仅抓列表元数据(最快,不解析m3u8)
python crawler.py --list-only

# 抓前100部 + 下载视频为mp4(需系统已安装ffmpeg)
python crawler.py --limit 100 --download

# 调整并发数
python crawler.py --workers 10
```

## 📁 输出产物

```
data/
├── videos.json       # 全部影片元数据 + 每集m3u8直链(核心产物)
├── index.html        # 可离线浏览的影视索引页(带搜索/分类过滤,仿站风格)
├── covers/           # 影片封面图
└── videos/           # (--download 时)下载的mp4视频
```

## 📦 videos.json 字段说明
```json
{
  "id": 536493,
  "title": "舒克贝塔之微缩人类",
  "cover": "https://vod.xiguazyimg.com/...jpg",
  "score": 8.0,
  "remarks": "HD中字",
  "actor": "杨凝,张放,...",
  "blurb": "剧情简介...",
  "category_name": "电影",
  "detail_url": "https://ysxq.cc/voddetail/536493.html",
  "play_page": "https://ysxq.cc/vodplay/536493-1-1.html",
  "episode_count": 1,
  "has_m3u8": 1,
  "episodes": [
    {
      "name": "HD",
      "m3u8": "https://v13.wsyzym3u8.com/202609/09/YPvWT8JikG27/video/index.m3u8",
      "index": 0,
      "page": "https://ysxq.cc/vodplay/536493-1-1.html"
    }
  ]
}
```

## ⚠️ 免责声明

本脚本仅作为**技术学习/网络协议研究**用途，抓取数据请遵循当地法律法规与网站robots协议，下载的内容不得用于商业用途或非法传播。
