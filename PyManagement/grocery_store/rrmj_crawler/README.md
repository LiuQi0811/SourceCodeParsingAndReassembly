# 人人视频 (https://mh.yichengwlkj.com/pc) 全站爬虫

## 逆向结果

### 技术栈
- Next.js 14 (App Router) + React 18
- 西瓜播放器(xgplayer) + veplayer DRM
- API 域名: `https://api.rrmj.plus`
- 前端CDN: `https://cdn.rrmj.plus/c-next/mapp/1.10.12/`
- 图片CDN: `https://img.bwcgee.cn/`

### 接口路径 (无 `/api/be` 前缀)
| 功能 | 路径 |
|------|------|
| 影视详情 | `/m-station/drama/intro?dramaId=` |
| 播放页数据 | `/m-station/drama/page?dramaId=&quality=AI4K&hsdrOpen=0&isAgeLimit=0&hevcOpen=0&tria4k=1` |
| 播放地址 | `/m-station/drama/play?dramaId=&quality=AI4K&hevcOpen=0` |
| 剧集/季列表 | `/m-station/drama/secondary?dramaId=` |
| 相关推荐 | `/m-station/drama/recommend?dramaId=&position=9` |
| 热搜 | `/m-station/top/hot/search` |
| 首页推荐 | `/m-station/top/home?pageNum=&pageSize=` |
| 即将上线 | `/m-station/schedule/play/upcoming/query` |
| 影视列表 | `/m-station/drama/list?dramaType=&pageNum=&pageSize=` |
| 搜索 | `/m-station/search/drama?keyword=&pageNum=&pageSize=` |
| 弹幕 | `/m-station/danmu/list?dramaId=&type=EPISODE&typeId=` |
| 评论 | `/m-station/drama/comment/list?dramaId=&pageNum=&pageSize=` |

### 请求头
```
token: ""                 // 登录后token
deviceId: UUID            // 设备ID (大写UUID)
umid: UUID                // 同deviceId
aliId: UUID               // 同deviceId
clientVersion: "1.0.0"
cv: "1.0.0"
clientType: "web_pc"      // PC网页端
ct: "web_pc"
uet: "9"
t: <毫秒时间戳>
x-ca-sign: <HMAC-SHA256签名>
Cookie: client_type=web_pc
```

### 签名算法 (HMAC-SHA256 Base64)
```python
# 密钥
secret = b"ES513W0B1CsdUrR13Qk5EgDAKPeeKZY"
# 待签消息
msg = f"{METHOD}\naliId:{aliId}\nct:{ct}\ncv:{cv}\nt:{timestamp}\n{querystring}"
# querystring 按参数添加顺序拼接(axios默认行为)
signature = base64.b64encode(hmac.new(secret, msg.encode(), sha256).digest())
```

### 响应解密 (AES-ECB Pkcs7)
```python
key = b"3b744389882a4067"
# 响应体为Base64密文 → AES-ECB解密 → Pkcs7去填充 → UTF-8 JSON
```

## 文件说明

| 文件 | 说明 |
|------|------|
| `rrmj_crawler.py` | 纯requests爬虫（无需浏览器），适合批量采集 |
| `rrmj_crawler_browser.py` | Playwright驱动爬虫（浏览器内发请求），100%兼容最新签名 |
| `rrmj_data/` | 抓取结果输出目录（JSON格式） |

## 使用方法

### 1. 安装依赖
```bash
pip install requests pycryptodome
# 浏览器版额外需要：
pip install playwright && playwright install chromium
```

### 2. 抓取单部影视
```bash
python3 rrmj_crawler.py --mode single --id 34838
```

### 3. 全站抓取
```bash
python3 rrmj_crawler.py --mode all --max 200
```

### 4. 浏览器版（推荐，零签名问题）
```bash
python3 rrmj_crawler_browser.py --mode single --id 34838
python3 rrmj_crawler_browser.py --mode all --max 200 --headless
```

## 数据结构
每个影视详情 JSON 包含：
- `meta`: 标题、封面、评分
- `intro`: 剧情简介、演员、年份、地区
- `secondary`: 季/集列表(含 episodeId)
- `page_info`: 播放页配置（画质、弹幕、推荐位）
- `play_info`: 视频播放地址（m3u8/mp4）
- `recommend`: 相关推荐
- `video_urls`: 提取出的视频直链
