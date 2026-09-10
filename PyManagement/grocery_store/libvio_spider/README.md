# LIBVIO (libvio.host) 全站抓取工具

## 逆向说明

站点有两层反爬保护，已完美逆向：

### 1. TLS 指纹识别（JA3/JA4）
直接用 `requests`/`curl` 请求返回 `403 Forbidden: browser verification required`（44字节纯文本）。
**解决方案**：使用 `curl_cffi` 库模拟 Chrome 124 的 TLS 指纹（`impersonate='chrome124'`），绕过后会返回挑战页。

### 2. CDN PoW 5秒盾（SHA256 哈希算力证明）
首次访问返回一个 HTML 验证页（"Checking your browser"/"正在验证您的浏览器"），页面内嵌 JS：
```js
var TS = "1789027952", SIG = "5c54521f01ec...", DIFF = "0000", MODE = "auto";
var POW = "__cdn_pow";
// Worker 中循环找 nonce：SHA256(SIG + nonce) 以 DIFF 开头
// 找到后写 Cookie：__cdn_pow = {TS}_{MODE}_{nonce}_{SIG} 然后 location.reload()
```
**解决方案**：纯 Python 复现 SHA256 碰撞求解（难度 `0000` = 4 个 hex 零前缀，期望 65536 次，Python 约 0.02-0.15s），算完直接带上 Cookie 访问，**无需浏览器、无需 Playwright**。

### 3. 视频源
MacCMS v10 架构，播放页通过 `<script>var player_aaaa={...};</script>` 暴露视频地址，无真正加密（`encrypt:3` 只是程序标记，URL 明文）。源分几种：
- `from: vr2` 等 → MP4 直链 `https://v.vimsec.app/...mp4`，可直接下载
- `from: kuake` → 夸克网盘链接
- `from: xunlei` → 迅雷网盘链接

## 安装

```bash
pip install -r requirements.txt
```

## 使用

```bash
# 1) 抓取全站元数据+MP4直链（先跑这个，JSON 保存到 output/libvio_all.json）
python libvio_spider.py --crawl-meta

# 2) 只抓某分类（1=电影 2=剧集 4=番剧 15=日韩 16=欧美）
python libvio_spider.py --crawl-meta --types 2 4

# 3) 测试：每分类只抓 2 页
python libvio_spider.py --crawl-meta --max-pages 2

# 4) 下载视频（默认下载所有MP4直链，断点续传）
python libvio_spider.py --download
python libvio_spider.py --download --max-vods 5   # 只下前5部测试

# 5) 导出 M3U 播放列表（用 VLC / PotPlayer / IINA 等直接播放）
python libvio_spider.py --export-m3u
# 生成 output/libvio_all.m3u

# 6) 关键词搜索
python libvio_spider.py --search "海贼王"
```

## 输出结构

```
output/
├── libvio_all.json       # 全站元数据+直链（含断点续爬，边爬边存）
├── libvio_all.m3u        # M3U 播放列表（导出后生成）
└── videos/               # 下载的视频
    └── 电影/
        └── 逃亡者/
            └── 1080P.mp4
```

## JSON 字段示例

```json
{
  "title": "逃亡者",
  "detail_url": "https://libvio.host/detail/xxxxxxx.html",
  "cover": "https://libvio.host/...jpg",
  "score": "0.0",
  "category": "电影",
  "category_id": 1,
  "episodes": [
    {
      "ep_name": "1080P",
      "play_url": "https://libvio.host/w/xxxxxxx-1-1.html",
      "source": "default",
      "mp4_url": "https://v.vimsec.app/.../The.Runner.2026.1080p.mp4",
      "source_type": "mp4"
    }
  ]
}
```

`source_type` 可能值：
- `mp4` / `m3u8`：可直接下载或播放
- `quark`：夸克网盘，需要夸克客户端下载
- `xunlei`：迅雷网盘，需要迅雷客户端下载
- `other`：其他未知源

## 说明

- 断点续爬：脚本每抓完一部影视立即写入 `libvio_all.json.tmp` 并原子替换，中断后重跑会跳过已抓取的详情页。
- 断点续传：下载 MP4 时使用 `Range` 请求，中断后重跑自动续传。
- 自动反爬：当 cookie 过期或被重新挑战时，脚本会自动重新求解 PoW。
- 随机延时：每页/每部之间随机 sleep 0.3~1 秒，降低被封风险。

⚠ **版权声明**：本工具仅供学习网络爬虫技术、逆向工程研究使用。请遵守当地法律法规，下载受版权保护的内容请先获得授权。
