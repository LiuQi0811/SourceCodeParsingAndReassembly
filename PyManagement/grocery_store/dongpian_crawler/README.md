# 懂片帝AI (dongpian1.com) 全站爬虫

针对 https://dongpian1.com 的全站影视数据抓取工具。

## 网站架构分析

| 项目 | 详情 |
|------|------|
| 站点类型 | SPA单页应用 (React + Vite) |
| API前缀 | `/v1/*`（同源API） |
| 认证方式 | **HMAC-SHA256 请求签名**（x-ai-movie-signature等自定义头） |
| 内容类型 | 电影、电视剧、短剧、动漫、综艺、韩剧/美剧/日剧/泰剧 |

### 主要路由
- `/` 首页（轮播 + 各分类推荐）
- `/short-drama` 短剧频道
- `/playlists/explore` 公开片单
- `/player/{av_id}` 影片播放页

### 核心API端点
| 端点 | 用途 |
|------|------|
| `GET /v1/runtime/bootstrap` | 站点配置 |
| `GET /v1/suggest?q=&limit=&mode=` | 搜索联想 |
| `POST /v1/threads` | 创建AI搜索会话 |
| `GET /v1/browse/catalog?...` | 搜索/目录结果 |
| `GET /v1/catalog/{av_id}` | 影片详情 |
| `GET /v1/catalog/{av_id}/variants` | 影片版本变体 |
| `GET /v1/catalog/{av_id}/episodes?limit=&offset=` | 剧集列表 |
| `POST /v1/playback/resolve-line` | 解析播放线路 |

### 请求签名机制
所有 `/v1/` API请求需要以下签名头：
```
x-ai-movie-build-version: dongpiandi-v{version}-web
x-ai-movie-client-name: movie-search-frontend
x-ai-movie-nonce: <32位hex随机数>
x-ai-movie-signature: <64位hex HMAC-SHA256签名>
x-ai-movie-timestamp: <毫秒时间戳>
```
签名密钥随前端构建版本变化，逆向成本高。本工具采用**浏览器网络监听**方案绕过签名问题。

## 文件说明

| 文件 | 说明 | 推荐度 |
|------|------|--------|
| **`dongpian_listener_crawler.py`** | **主爬虫**（推荐）—— 基于Playwright网络响应监听，自动处理签名 | ⭐⭐⭐⭐⭐ |
| `dongpian_inject_crawler.py` | 注入式爬虫（备选）—— 在浏览器页面内执行fetch | ⭐⭐⭐ |
| `dongpian_crawler.py` | 双模式爬虫（备选）—— Playwright + requests双实现 | ⭐⭐⭐ |
| `requirements.txt` | Python依赖 | - |
| `README.md` | 本文档 | - |

## 快速开始

### 1. 安装依赖
```bash
pip install playwright
playwright install chromium
```

### 2. 运行爬虫
```bash
# ===== 推荐：全站抓取（首页+分类+多关键词搜索+详情）=====
python dongpian_listener_crawler.py

# 搜索单个关键词
python dongpian_listener_crawler.py --keyword "仙逆"

# 演示模式（快速测试，少量数据）
python dongpian_listener_crawler.py --demo

# 显示浏览器窗口（调试）
python dongpian_listener_crawler.py --no-headless

# 只抓列表不抓详情（快速）
python dongpian_listener_crawler.py --no-details

# 限制详情抓取数量
python dongpian_listener_crawler.py --max-details 50

# 自定义滚动次数和延迟
python dongpian_listener_crawler.py --scrolls 20 --delay 2.0
```

## 输出数据

所有数据保存在 `dongpian_data/` 目录：

| 文件 | 格式 | 内容 |
|------|------|------|
| `movie_list_{时间戳}.json` | JSON | 完整影片列表 |
| `movie_list_{时间戳}.csv` | CSV | 影片列表（Excel可直接打开） |
| `movie_details_{时间戳}.json` | JSON | 影片详细信息 |
| `episodes_{时间戳}.csv` | CSV | 所有剧集清单 |

### 数据字段示例
```json
{
  "av_id": "av_NkrAHla5qn1ye-F961ytvu8JtxYLRlp...",
  "title": "仙逆",
  "year": 2023,
  "genres": ["修仙", "逆袭", "国产动漫"],
  "areas": ["中国大陆"],
  "language": "国语",
  "status": "更新至157集",
  "episode_count": 157,
  "rating": "",
  "content_type": "动漫",
  "overview": "……",
  "directors": [],
  "actors": [],
  "url": "https://dongpian1.com/player/av_NkrAHla...",
  "episodes": [
    {"episode_id": "episode:yj:...", "title": "第1集", "number": 1, "duration": 0}
  ]
}
```

## 技术方案说明

### 为什么用「网络监听式」爬虫？

直接用 `requests` 调用API会返回 `Missing request signature` 错误，因为：
1. 签名密钥嵌入在混淆后的前端JS中
2. 签名包含HMAC运算，nonce每次不同
3. 构建版本号可能随网站更新而变化
4. 纯requests模式需要持续维护签名逆向

**网络监听方案的工作流程：**
1. Playwright启动真实Chrome浏览器
2. 打开网站，让浏览器正常加载所有JS
3. 网站的HTTP客户端自动处理签名
4. 爬虫监听所有 `/v1/` 路径的JSON响应
5. 通过页面操作（滚动、搜索、点击）触发API调用
6. 从响应中自动提取影片、详情、剧集数据

**优势：**
- ✅ 无需逆向签名算法
- ✅ 自动处理Cookie/Session/CSRF
- ✅ 对网站版本更新有较强容错能力
- ✅ 能获取动态加载的所有数据

## 抓取策略

爬虫通过以下途径最大化数据覆盖率：

1. **首页推荐滚动加载**：滚动12+次，点击"继续下滑加载更多"
2. **分类页面遍历**：短剧、探索片单等频道
3. **多关键词搜索**：使用30+个覆盖各类型/年份/地区/题材的关键词
4. **影片播放页访问**：逐个打开播放页触发详情+剧集API
5. **DOM链接提取**：从HTML中提取所有 `/player/av_xxx` 链接

## 参数说明

```
--keyword, -k     搜索单个关键词
--demo            演示模式（少量数据，快速测试）
--all             全站抓取（默认模式）
--no-headless     显示浏览器窗口（调试用）
--no-details      跳过详情抓取（只抓列表，速度更快）
--max-details N   最多抓取N部影片详情（0=全部）
--scrolls N       首页滚动次数（默认12）
--delay SECONDS   请求间隔秒数（默认1.5）
```

## 注意事项

1. **合法合规**：本工具仅供技术学习研究，请遵守目标网站的robots.txt和使用条款
2. **请求频率**：默认设置了1.5秒间隔，请勿高频请求
3. **数据版权**：影视内容版权归原网站及合法版权方所有
4. **运行环境**：需要约500MB磁盘空间（Chromium浏览器），内存1GB+
5. **网络要求**：需能正常访问dongpian1.com

## 故障排查

| 问题 | 解决方法 |
|------|---------|
| Playwright安装失败 | `pip install playwright && playwright install --with-deps chromium` |
| 浏览器启动失败 | Linux环境需要安装依赖: `playwright install-deps chromium` |
| 抓取数量少 | 增加 --scrolls 参数，或使用 --all 模式等待完成 |
| 详情数据为空 | 确保未使用 --no-details，增加 --delay 参数 |
| CSV中文乱码 | CSV使用UTF-8 BOM编码，Excel打开应正常显示 |
| 超时错误 | 网络较慢时可适当调大延迟和timeout（修改源码中的timeout值） |
