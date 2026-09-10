# ikanbot.com (爱看机器人) 全站爬虫 v2.0

## 🔓 完美逆向解密说明

本爬虫针对 https://www.ikanbot.com/ 完成了两项核心逆向工作：

### 1. Cloudflare 防护绕过
- **技术方案**: 使用 `curl_cffi` 模拟 Chrome 120 浏览器的 TLS 指纹 (JA3/JA4)
- **效果**: 100% 绕过 Cloudflare 5秒盾和拦截，无需浏览器
- **关键**: 模拟真实浏览器的请求头顺序、TLS 扩展、HTTP/2 帧

### 2. 播放源 Token 加密算法逆向 ⭐
完全还原了网站混淆 JavaScript 中的 token 生成逻辑：

```
原混淆JS: 控制流平坦化 + 数组移位 + 十六进制索引
还原算法:
  输入: videoId (如 "1012121") + e_token (页面隐藏字段)
  步骤:
    1. 取 videoId 最后4位字符 → "2121"
    2. 对每位数字计算 offset = (digit % 3) + 1
    3. 从 e_token 第 offset 位开始截取8个字符
    4. e_token 滑动窗口前进 offset+8 位
    5. 拼接4个8字符片段得到32位token
  输出: token → 用于调用 /api/getResN 获取播放源
```

## 📁 文件说明

| 文件 | 说明 |
|------|------|
| `ikanbot_spider.py` | 完整全站爬虫代码 |
| `README.md` | 本说明文档 |
| `test_spider.py` | 功能测试脚本 |

## 🚀 快速开始

### 安装依赖
```bash
pip install curl_cffi beautifulsoup4
```

### 基本使用

```python
from ikanbot_spider import IkanbotSpider

spider = IkanbotSpider(delay=(2, 4))  # 建议延迟2-4秒避免被封

# 1. 获取单部影片详情+所有播放源
movie = spider.get_movie_detail("1012121", mtype=1)
print(movie.title, movie.year)
for src in movie.sources:
    print(f"[{src['name']}] {src['url']}")

# 2. 搜索影片
results = spider.search("蜘蛛侠")

# 3. 获取分类列表
movies = spider.get_category_list('movie', '热门', page=1)
dramas = spider.get_category_list('tv', '热门', page=1)

# 4. 批量抓取整个分类
all_movies = spider.crawl_category_all('movie', '科幻', max_pages=5)

# 5. 导出数据
spider.save_json(all_movies, "科幻电影.json")
spider.save_m3u(all_movies, "科幻电影.m3u")  # 可直接用VLC/MPV播放
```

## 🎬 支持的分类

**电影分类**: 热门、最新、经典、豆瓣高分、冷门佳片、华语、欧美、韩国、日本、动作、喜剧、爱情、科幻、悬疑、恐怖、文艺

**剧集分类**: 热门、最新、经典、豆瓣高分、冷门佳片、华语、欧美、韩国、日本、国产剧、美剧、韩剧、日剧、港剧、台剧、英剧

## 📊 数据结构

```python
@dataclass
class Movie:
    video_id: str        # 影片ID
    title: str           # 标题
    alt_title: str       # 又名/别名
    year: str            # 年份
    region: str          # 地区
    creators: str        # 导演/演员
    cover_url: str       # 封面图
    mtype: int           # 1=电影, 2=剧集
    sources: List[Dict]  # 播放源列表
    crawl_time: str      # 抓取时间
```

播放源格式:
```python
{
    'line': 1,           # 线路编号
    'name': 'HD中字',    # 清晰度/版本
    'url': 'https://.../index.m3u8',  # m3u8直链
    'site_id': 60        # 源站ID
}
```

## ⚠️ 注意事项

1. **请求频率**: 建议设置 `delay=(2,4)` 秒以上，过快会触发Cloudflare临时封禁
2. **mtype参数**: 电影=1，剧集=2；获取剧集播放源时传入mtype=2
3. **IP限制**: 如遇大量403，建议切换IP或增大延迟
4. **合法使用**: 本代码仅供学习研究使用，请遵守相关法律法规
5. **播放源失效**: m3u8链接来自第三方资源站，可能随时失效

## 🔧 技术细节

- **HTTP客户端**: curl_cffi (TLS指纹模拟)
- **解析库**: BeautifulSoup4
- **核心API**: `GET /api/getResN?videoId={id}&mtype={type}&token={tk}`
- **认证方式**: e_token + 滑动窗口算法生成的动态token
- **反爬绕过**: TLS指纹模拟 + 随机延迟 + Session预热 + 自动重试

## ✅ 验证状态

- [x] Cloudflare 5秒盾绕过
- [x] 动态Token算法还原
- [x] 影片元数据提取
- [x] m3u8播放源解析
- [x] 搜索功能
- [x] 分类分页
- [x] M3U播放列表导出
