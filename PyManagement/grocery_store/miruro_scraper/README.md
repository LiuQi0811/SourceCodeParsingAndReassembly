# Miruro.tv 全站爬虫 (完整逆向解密版)

一个对 [Miruro.tv](https://www.miruro.tv/) 的 **100% 逆向** 全站爬取工具，完全还原了前端加密/混淆逻辑。

## 🔑 逆向成果

经过对前端 JS Bundle 的完整逆向分析，恢复出以下关键机制：

### 1. API 传输层加密 (`/api/secure/pipe`)
- **请求格式**：`GET /api/secure/pipe?e=<base64url>`
  - `e` = `base64url(JSON({path, method, query, body}))`
- **响应解密**（响应头含 `x-obfuscated: 2` 时）：
  ```
  base64url_decode → XOR(PIPE_OBF_KEY, 循环密钥) → gzip 解压 → JSON
  ```

### 2. 硬编码密钥（从 `env2.js` 提取）
| 常量 | 值 | 用途 |
|---|---|---|
| `VITE_PIPE_OBF_KEY` | `71951034f8fbcf53d89db52ceb3dc22c` | API 响应 XOR 密钥 (16 字节) |
| `VITE_PROXY_OBF_KEY` | `a54d389c18527d9fd3e7f0643e27edbe` | 视频分片 XOR 密钥 (16 字节) |
| `VITE_PROXY_A` | `https://s1.watami.win/` | 视频代理节点 A |
| `VITE_PROXY_B` | `https://s1.piltover.li/` | 视频代理节点 B |
| `VITE_REFERER_ORIGIN` | `https://strm.cx` | 代理 Referer |

### 3. 视频分片解密
Miruro 的所有 native provider（`bee/hop/kiwi/ally/bonk/pewe/moo`）启用了 `proxy.segments=true`，即：
- HLS `.m3u8` 是明文，但 `.m4s/.ts` 分片响应体被 **循环 XOR** 加密。
- 必须用 `PROXY_OBF_KEY` 对每个字节做 `b ^ key[i % 16]` 还原后再送给 ffmpeg。
- 脚本自动通过文件头魔数（`0x47` TS 头 / `ftyp` fMP4 头 / `1f8b` gzip 头等）判断是否需要解密，避免二次 XOR。

### 4. 官方域名
- 流媒体站：`miruro.tv`、`miruro.to`、`miruro.bz`、`miruro.ru`（脚本自动探测可用域名）
- `miruro.com` 是落地 marketing 页，并非流媒体 API 所在域。

## 🚀 快速开始

### 依赖
```bash
pip install requests
# 下载mp4功能需要ffmpeg:
#   sudo apt install ffmpeg   /   brew install ffmpeg   /   choco install ffmpeg
```

### 运行示例

| 命令 | 功能 | 需要过CF? |
|---|---|---|
| `python3 miruro_scraper.py` | 默认：抓取当前 Trending 榜单 (SSR) | ❌ 不需要 |
| `python3 miruro_scraper.py --browse` | 同上 | ❌ 不需要 |
| `python3 miruro_scraper.py --info 21` | 获取 ONE PIECE (id=21) 的详情 | ❌ SSR即可 |
| `python3 miruro_scraper.py --search "one piece"` | 搜索番剧 | ❌ SSR即可 |
| `python3 miruro_scraper.py --episodes 21 --provider kiwi` | 获取集数列表 | ✅ 需要 |
| `python3 miruro_scraper.py --watch 21 1 sub` | 获取第1集字频版m3u8 | ✅ 需要 |
| `python3 miruro_scraper.py --download 21 1 sub` | 下载第1集为mp4 (自动解密+ffmpeg合并) | ✅ 需要 |
| `python3 miruro_scraper.py --full-site` | 全站元数据抓取 | 部分 |

### 🔓 关于 Cloudflare 拦截

Miruro 的 `/api/*` 端点启用了 Cloudflare 防护（沙箱服务器IP通常会被拦，但家庭宽带大多直连可用）。三种解决方案：

**方案1：使用代理（最简单）**
```bash
python3 miruro_scraper.py --download 21 1 sub --proxy http://127.0.0.1:7890
```

**方案2：注入浏览器Cookie**
1. 用 Chrome 打开 `https://www.miruro.tv/`，过一次Cloudflare验证
2. 按 F12 → Application → Cookies → 复制 `cf_clearance` 的值
3. 同时复制当前浏览器的 User-Agent（必须与请求一致）
```bash
python3 miruro_scraper.py --episodes 21 \
    --cf-clearance "xxxxxxx" \
    --user-agent "Mozilla/5.0 ... 你的UA"
```

**方案3：仅用SSR模式（默认）**
不指定 `--episodes/--watch/--download` 时，脚本走 SSR HTML 路径抓取榜单、基本详情、OG图、provider配置，这些公开页面**不经过Cloudflare验证**，可以在任何网络下直接使用。

## 📁 输出结构
```
downloads/
├── trending.json                 # 热门榜单
├── info_21.json                  # 番剧基础信息(SSR)
├── info_21_full.json             # 番剧完整信息(API,需过CF)
├── episodes_21_kiwi.json         # 集数列表
├── sources_21_ep1_sub.json       # 片源原始响应
└── anime_21_ep1_sub.mp4          # 下载好的视频
```

## 🧩 API 端点一览（已逆向）

| Pipe path | 说明 |
|---|---|
| `config` | 全局配置（含所有provider、密钥、能力） |
| `search/browse` | 分类/排序浏览 |
| `search` | 关键词搜索 |
| `info/{id}` | 番剧详情 |
| `info/anilist/{id}` | Anilist 元数据 |
| `episodes/{id}` | 集数列表 (query: provider, dub) |
| `sources` | 播放源 (query: episodeId, provider, category, live, _t) |
| `schedule` | 每周时间表 |
| `reports` | 上报接口 |
| `random-pool.json` | 随机推荐池（静态文件） |
| `health` | 健康检查 |

## 🎬 Provider 列表（从 SSR Config 实时提取）
- Native HLS (支持m3u8直接下载+XOR分片解密): **kiwi / bee / hop / ally / bonk / pewe / moo**
- Iframe 嵌入: nun / bun / cog / twin / telli（需要额外解析iframe，通常native源已够用）

## 🔧 技术细节

1. **XOR 解密**：所有加密层都是简单的**循环异或**，无 AES/RSA，这是该站为了规避DMCA抄袭检测而做的轻量混淆。
2. **JWE 模式**：POST 请求走 ECDH-ES JWE 加密（ECDH-P256 + A256GCM），但 GET 模式（我们使用的）仅走简单 XOR，完全够用。
3. **分片识别**：自动根据文件头魔数判断是否需要 XOR 解密，确保对明文/密文分片双兼容。
4. **m3u8 解析**：自动选取 master playlist 中带宽最高的流，自动处理相对路径、HLS-AES128 key（交给ffmpeg）。

## ⚠️ 免责声明
本工具仅用于技术研究与个人离线观看。请支持正版，遵守当地法律法规和站点 ToS。下载的内容请勿二次传播。
