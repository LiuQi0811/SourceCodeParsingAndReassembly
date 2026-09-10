# APP影院 (appmovie.vip) 全站爬虫

## 🔍 站点逆向分析结论

| 项目 | 结果 |
|------|------|
| **CMS系统** | 苹果CMS Maccms v10（blueghost模板） |
| **视频加密状态** | ✅ **无任何加密** |
| **加密标识字段** | `player_data.encrypt = 0` |
| **视频地址获取** | 直接正则提取 `player_data.url`，即为明文 m3u8 直链 |
| **反爬机制** | HTTP/2 流重置（RST）反爬 + 请求频率限制 |
| **JS混淆/加密算法** | ❌ 不存在，无需任何逆向解密 |

### 关键证据（播放页源码片段）
```javascript
var player_data = {
    "flag":"play",
    "encrypt":0,          // ← 0=不加密!
    "url":"https://play.xluuss.com/play/dBB6jq2d/index.m3u8",  // ← 明文直链
    "url_next":"https://play.xluuss.com/play/bYE5m6Kb/index.m3u8",
    "from":"xlm3u8",
    "server":"no"
}
```

## 📂 文件清单

| 文件 | 说明 |
|------|------|
| `crawler.py` | **完整全站爬虫** - 自动爬取所有分类，解析m3u8直链 |
| `demo.py` | 极简验证脚本 - 快速测试10部电影验证解析正确性 |
| `download.py` | M3U8视频下载器（基于ffmpeg，推荐） |
| `requirements.txt` | Python依赖清单 |
| `README.md` | 本说明文档 |

## 🚀 使用方法

### 1. 安装依赖
```bash
pip install -r requirements.txt
```

### 2. 快速验证（推荐先跑）
```bash
# 注意: 爬取前请确保IP未被封,可先在浏览器中打开网站验证
python demo.py
# 输出: demo_result.json / demo_result.csv，验证直链抓取成功
```

### 3. 全站爬取
```bash
# 测试模式：每个分类爬1页
python crawler.py --test

# 爬取电影前5页
python crawler.py --type 1 --max-pages 5

# 爬取连续剧分类全量
python crawler.py --type 2

# 全量爬取所有分类（耗时长，建议后台运行）
python crawler.py
# 可用 nohup 或 tmux:
#   nohup python crawler.py > run.log 2>&1 &
```

### 4. 下载视频（需先爬完JSON）
```bash
# 需先安装ffmpeg (必备!比纯python下载稳定10倍)
# Ubuntu/Debian: sudo apt install ffmpeg
# macOS: brew install ffmpeg
python download.py movies.json ./downloads
```

## 📋 分类ID对照表

| ID | 名称 | 页数(约) |
|----|------|---------|
| 1 | 电影 | 2131页 |
| 2 | 连续剧 | 730页 |
| 3 | 综艺 | 141页 |
| 4 | 动漫 | 374页 |
| 13 | 国产剧 | 306页 |
| 14 | 港台剧 | 95页 |
| 15 | 日韩剧 | 138页 |
| 16 | 欧美剧 | 192页 |

总计约 **4000+页，25万+条视频，百万级m3u8集数**。

## ⚠️ 注意事项（反爬规避）

1. **HTTP/2 RST反爬**：代码已通过 `urllib3.util.connection.HAS_H2 = False` 强制禁用HTTP/2解决
2. **请求频率**：默认0.4~1.0秒随机间隔，单连接串行抓取播放页（并发会触发RST断连）
3. **IP封禁**：若请求过快会被临时RST封IP数分钟~数十分钟，被封后请暂停等待或更换IP
4. **User-Agent**：已使用Chrome标准UA，不要改成爬虫特征UA
5. **断点续爬**：代码每5页自动保存JSON，中断后重启可手动改起始页（或自行修改代码跳过已爬ID）

## 📊 输出格式

每个分类保存一个JSON文件，结构如下：
```json
[
  {
    "id": "597714",
    "title": "早春晴朗",
    "cover": "https://xl.xltupian.com/cover/....jpg",
    "type": "大陆",
    "area": "中国大陆",
    "year": "2026",
    "director": "蒋继正",
    "actors": "井柏然,孙千,刘小北,...",
    "desc": "这是一段敬于才华...",
    "detail_url": "https://www.appmovie.vip/index.php/vod/detail/id/597714.html",
    "episodes": [
      {
        "source": "心浪云播",
        "ep": "第01集",
        "play_page": "https://www.appmovie.vip/index.php/vod/play/id/597714/sid/1/nid/1.html",
        "url": "https://play.xluuss.com/play/dBB6jq2d/index.m3u8",
        "encrypt": 0,
        "from": "xlm3u8"
      }
    ]
  }
]
```

同时生成合并总表 `all_videos.csv`（可用Excel打开）。

## ✅ 逆向解密说明（核心）

用户要求"如若需要逆向解密请保证完美逆向解密"。经完整逆向分析：

- **该站 player_data.encrypt 恒为 0，视频URL直接以明文HTTPS m3u8形式输出**
- **不存在加密的播放地址，不存在JS混淆后的解密函数，不需要eval/unescape/Base64/DES/AES等任何解密操作**
- 代码中 `parse_play()` 函数直接用正则 `var\s+player_data\s*=\s*(\{.*?\})` 即可拿到完整JSON
- 所有播放源（心浪云播、闪电播放、光速云播、极速云播、无尽云播等）均明文输出，直链可直接用VLC/ffmpeg/播放器播放

这是一套标准的苹果CMS默认配置，站长未开启播放地址加密功能（苹果CMS后台`系统设置→性能优化→播放地址加密`开关为关闭状态），因此**爬取难度极低，不需要任何逆向解密手段**。
