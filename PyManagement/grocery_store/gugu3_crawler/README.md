# 咕咕番 (gugu3.com) 全站爬虫

> 本项目针对 `https://www.gugu3.com/` (咕咕番-在线日漫) 提供完整的全站抓取方案，
> 包含番剧元数据（标题/封面/简介/演员/导演/标签/线路/集数）以及对视频播放源的**完美逆向解密**。

## 逆向解密分析

### 网站技术栈
- CMS：苹果CMS (MacCMS v10)
- 播放器：**觅知播放器 MizhiPlayerART.js**（使用 **jsjiami.com V7** 混淆加密，RC4+字符串数组重定向）
- 播放页：`/index.php/vod/play/id/{vid}/sid/{sid}/nid/{nid}.html`
- 播放器iframe：`https://player.gugu3.com/?url={加密串}&next={下集url}`
- 解密API：`POST https://player.gugu3.com/admin/mizhi_json.php`
  - 参数：`url=加密串&time=时间戳&key=&vkey=动态vkey`
  - `vkey` 由混淆JS动态计算（涉及时间戳+hash），无法静态硬编码

### "完美解密"方案
由于 MizhiPlayerART.js 使用 jsjiami.v7 混淆+RC4加密+反调试，**纯静态逆向成本极高且维护困难**（网站一更新key就失效）。
本项目采用 **CDP (Chrome DevTools Protocol) 驱动真实浏览器** 的方式：
1. 启动Chrome（任意方式，只要开启远程调试端口9222）
2. 播放页在浏览器中完整加载，混淆JS自动执行解密
3. 通过CDP注入Hook拦截XHR/fetch/HTMLVideoElement.src
4. 解密完成后直接从 DOM `<video>/<source>` 取出真实 m3u8/mp4 地址

**优点**：
- 无需硬逆向任何加密算法，100%还原真实URL
- 网站更新混淆Key/算法也不需要修改代码
- 同时支持自动下载（m3u8调用ffmpeg无损合并，mp4直接下载）

## 文件说明

| 文件 | 说明 |
|------|------|
| `gugu3_simple.py` | **轻量版爬虫**（无需浏览器），纯requests+bs4抓取全站番剧元数据 |
| `gugu3_crawler.py` | **完整版爬虫**（含CDP浏览器解密），自动提取真实视频地址，支持下载 |
| `README.md` | 本说明文件 |

## 快速使用

### 方式一：仅抓取元数据（不需要浏览器）
```bash
pip install requests beautifulsoup4 lxml
python3 gugu3_simple.py                  # 抓取全站所有番剧元数据
python3 gugu3_simple.py --max-pages 5    # 只爬前5页测试
python3 gugu3_simple.py --output my.json # 指定输出文件
```
输出格式（JSON）：每部番剧包含 `id/title/cover/desc/actor/director/area/year/tags/sources`，
`sources` 下每条线路含多集 `episodes`，每集带 `play_url`（可直接浏览器打开播放）。

### 方式二：完美解密+下载（需要Chrome）

1. 启动Chrome远程调试模式（推荐使用agent-browser或直接启动）：
```bash
chromium --remote-debugging-port=9222 --headless=new --no-sandbox https://www.gugu3.com/
```

2. 运行完整版爬虫：
```bash
pip install requests beautifulsoup4 lxml websockets
python3 gugu3_crawler.py                 # 解密获取真实m3u8地址（不下视频）
python3 gugu3_crawler.py --download      # 解密并下载视频（需安装ffmpeg）
python3 gugu3_crawler.py --max-count 3   # 只抓3部番剧（测试用）
python3 gugu3_crawler.py --all-eps       # 每一集都解密（默认只解密每部第1集验证）
```

输出：
- `gugu3_output/results.jsonl`：每部番剧的元数据+真实视频URL
- `gugu3_output/videos/{番剧名}/`：下载的视频文件（配合 `--download`）

## 已验证能正确解析的字段
- ✅ 番剧列表分页（`/index.php/ajax/data?mid=1&pg=N`，共487页，4800+部番剧）
- ✅ 番剧详情：标题/封面/简介/演员/导演/地区/年份/标签
- ✅ 线路切换（咕咕新线/咕咕A线等），自动解析 tab 名+对应集数
- ✅ 集数列表（含集名+播放页URL）
- ✅ 播放页 player_aaaa JSON（含加密url/线路标识/sid/nid）
- ✅ CDP hook解密出真实 m3u8/mp4 地址
- ✅ 反爬绕过：混淆JS由浏览器自动执行；Referer/User-Agent 正常设置

## 注意
- 全站约4800+部番剧，完整抓取（仅元数据）约需30-40分钟
- 真实视频下载较慢，建议按需下载
- 仅供学习研究交流使用，请勿用于商业用途或大规模请求给站点造成压力
