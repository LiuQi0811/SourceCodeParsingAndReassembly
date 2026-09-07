# mharvest —— 通用媒体资源抓取框架

给一个网址，把站点里的图片、视频、音频抓下来。

它不是"另一个爬虫"，而是专门解决**资源层**的问题：常规爬虫框架（Scrapy 等）
擅长抓 HTML 和数据，但对"怎么把站里的图、音视频真正拿下来"这件事帮助有限——
尤其是视频站，给你的从来不是 mp4 直链，而是一个 m3u8 文本清单。

## 快速开始

```bash
pip install -r requirements.txt

# 抓一个页面上的所有资源
python -m mharvest https://example.com

# 往下翻两层，只要图片和视频，丢掉小于 20KB 的占位图
python -m mharvest https://example.com -o ./out --depth 2 \
    --kind image,video --min-size 20480

# 直接给一个 m3u8 地址，下 720p 那一路
python -m mharvest https://site.com/hls/master.m3u8 --hls 720p

# 先看看这个流有哪些码率
python -m mharvest https://site.com/hls/master.m3u8 --list-variants
```

当 Python 库用：

```python
from mharvest import Crawler, CrawlConfig, HttpClient, FileStore

client = HttpClient(delay=0.5, proxy="http://127.0.0.1:7890")
store = FileStore("./downloads")
crawler = Crawler(client, store, CrawlConfig(depth=2, kinds={"image", "video"}))
report = crawler.run("https://example.com")

print(report.summary())
report.save("manifest.json")     # 每条资源的来源页、路径、大小、状态
```

## 它到底能抓到什么

真实网页藏资源的手段远比想象的多，下面这些是实测覆盖的：

| 藏法 | 示例 | 是否支持 |
|---|---|---|
| 常规标签 | `<img src>` `<video src>` `<audio src>` | ✅ |
| 懒加载 | `data-src` `data-original` `data-lazy-src` 等 18 种属性 | ✅ |
| 响应式图 | `srcset="a.jpg 1x, b.jpg 2x"` 拆成多条 | ✅ |
| picture / source | `<source srcset>`，按父标签判定是图还是视频 | ✅ |
| CSS 背景图 | 外部 `.css` 的 `url()`、`@font-face`、内联 `style` | ✅ |
| JS 里的地址 | `<script>` 内 JSON 配置里的 m3u8、mp4、图片直链 | ✅ |
| 内联 base64 | `<img src="data:image/png;base64,...">` 直接解码落盘 | ✅ |
| meta 标签 | `og:image` `twitter:image` | ✅ |
| 资源型链接 | `<a href="/a.mp4">` | ✅ |
| HLS 流 | m3u8 多码率选流、AES-128 解密、分片合并成 mp4 | ✅ |
| **blob / MSE 视频** | `video.src = blob:...` 的播放器 | ✅ **需 `--browser`** |
| DASH 流 | `.mpd` | ❌ 需 ffmpeg 或 N_m3u8DL |
| DRM 加密内容 | Widevine / FairPlay | ❌ 架构层面不可行 |

## 参数

| 参数 | 说明 | 默认 |
|---|---|---|
| `-o, --out` | 输出目录 | `./downloads` |
| `--depth` | 页面递归层数，`1` = 只抓入口页 | 1 |
| `--max-pages` | 最多翻多少页 | 30 |
| `--max-resources` | 最多抓多少资源，`0` 不限 | 0 |
| `--workers` | 下载并发数 | 8 |
| `--kind` | 只抓指定类型：`image,video,audio,font,stream,other` | 全部 |
| `--min-size` | 小于该字节数的丢弃（过滤 1x1 占位图） | 0 |
| `--max-size` | 大于该字节数的跳过 | 0 |
| `--hls` | m3u8 选流：`best` / `worst` / `720p` | best |
| `--list-variants` | 只列码流不下 | - |
| `--all-domains` | 允许抓其他域名的资源（默认资源不限域，此开关控制翻页） | - |
| `--delay` | 同域名请求间隔秒数 | 0 |
| `--proxy` / `--cookie` / `--header` / `--ua` | 反爬与身份相关 | - |
| `--no-robots` | 不遵守 robots.txt | - |
| `--no-ffmpeg` | 禁用 ffmpeg，分片只做裸拼接 | - |
| `-q` | 只输出摘要 | - |

## 目录结构

```
downloads/
├── images/     视频封面、CSS 背景图、base64 内联图……
├── videos/     mp4 直链 + m3u8 合并产物
├── audio/
├── fonts/
└── manifest.json   每条资源的 URL、来源页、落盘路径、大小、状态
```

## 架构：五个可替换的模块

```
mharvest/
├── models.py      类型判定：URL 扩展名 + Content-Type 双重判定，后者可纠错
├── http.py        HTTP 层：重试、限流、Referer 防盗链、断点续传
├── extractors.py  提取层：HTML 流式解析 + CSS/JS 正则兜底
├── hls.py         HLS：多码率选流 / AES-128 解密 / 分片并发下载 / ffmpeg 合并
├── blob.py        blob/MSE：拦截 appendBuffer + 网络响应，fMP4 拼接（需 Playwright）
├── store.py       落盘：安全命名、重名加序号、内容级去重（同图只存一份）
└── crawler.py     调度：先 BFS 翻页收集并去重，再开线程池并发下载
```

`blob.py` 是可选模块，不装 Playwright 也能用其余全部功能。

想扩展的话，两处最常用的切入点：

- **新的资源藏法** → 在 `extractors.py` 的 `LAZY_ATTRS` / `TAG_ATTRS` 里加属性或标签
- **新的流媒体协议** → 在 `crawler.py` 的 `_download_stream()` 里加分支（DASH 可以从这里接）

## m3u8 这块做了什么

视频站给的是清单不是文件，完整链路是：

```
入口 m3u8
  ├─ master（多码率）→ 按 --hls 策略挑一路（默认最高码率）
  └─ media（分片表）→ 并发下载 N 个 ts 分片
         ├─ EXT-X-KEY  → 取密钥，AES-128-CBC 解密
         ├─ EXT-X-MAP  → 先写 fMP4 初始化段
         └─ 合并      → ffmpeg -c copy 转封装成 mp4（不重编码，秒级）
```

几个容易踩的坑，都处理了：

- **属性里的逗号**：`CODECS="avc1.4d401f,mp4a.40.2"` 不能按逗号无脑切，用了引号感知的分割
- **IV 缺省**：按规范用 media sequence 的 128 位大端序
- **PKCS7 填充**：解密后不去掉，合并出的视频末尾会多一截垃圾
- **并发保序**：分片并发下，但严格按 index 合并
- **无 ffmpeg**：自动退回裸拼接，产物为 `.ts`（播放器可直接打开）

## 断点续传

下载中断后再跑一次，会从断点继续（HTTP 206）。

这里有个坑值得一提：如果本地残留文件**不是**该文件的前缀（比如远端资源更新过），
盲目追加会得到一个"大小正常、内容损坏"的文件，这种错误极难发现。
所以续传前会校验 ETag：能证明是同一份资源才续传，否则整份重下。
续传记录存在隐藏文件 `.<文件名>.etag` 里。

## blob / MSE 视频：为什么抓不到，怎么才能抓到

### 问题在哪

`blob:https://site.com/uuid-xxxx` **服务端根本不存在这个地址**。
它是浏览器调用 `URL.createObjectURL()` 在内存里生成的临时引用，页面一关就失效。
所以拿它去发 HTTP 请求，必然失败——这不是代码没写好，是方向错了。

真实的数据流是这样的：

```
JS 下载真实分片  →  appendBuffer() 喂给 MediaSource  →  video.src = blob: 地址
                    ↑
              数据在这里，要拦就拦这一步
```

### 抓法

```bash
# 先确认环境（会告诉缺什么）
python -m mharvest --check-blob

# 抓 blob 视频
python -m mharvest https://site.com/page --browser -o ./out

# 需要点播放按钮才能加载的
python -m mharvest https://site.com/page --browser --click "#play-btn"

# 视频较长，给足等待时间
python -m mharvest https://site.com/page --browser --wait 60
```

模块内部做了两件事，先试前者、不行自动退回后者：

1. **拦截 `appendBuffer`**（主）：Hook `SourceBuffer.appendBuffer()`，
   拿到的是播放器实际消费的字节流，天然按顺序、且已包含初始化段
2. **拦截网络响应**（兜底）：MSE 没抓到时，用网络层捕获的所有媒体响应

### 前置条件

| 条件 | 必需 | 说明 |
|---|---|---|
| `pip install playwright` | ✅ | Python 包 |
| `playwright install chromium` | ✅ | 浏览器内核，约 150MB |
| 视频必须真实播放 | ✅ | 很多播放器滚动到视口才加载，或要点播放 |
| ffmpeg | ⬜ | 仅 TS 分片需要；**fMP4 不需要** |
| 登录态 | ⬜ | 用 `--browser --proxy` 配合 Cookie，或先手动登录 |

有个好消息：**fMP4 分片（.m4s）直接拼起来就是合法 mp4**，
`cat init.mp4 seg_*.m4s > out.mp4` 即可播放，连 ffmpeg 都不用装。
现代站点（B站、腾讯视频、YouTube）大多用 fMP4。

### 抓不到时怎么排查

```
没抓到任何视频数据。常见原因：
  1. 需要点击播放按钮（用 --click 指定选择器）
  2. 需要登录或 Cookie
  3. 视频在 iframe 里（直接对 iframe 的地址用 --browser）
  4. 等待时间不够（加大 --wait）
  5. 内容是 DRM 加密的，抓不到
```

调试技巧：加 `--headed --wait 60` 看着浏览器窗口跑，能直观看到卡在哪一步。

### 已验证的部分

浏览器二进制在开发沙盒里装不上（CDN 和镜像都被墙），
所以**浏览器端的完整链路没能实机跑通**。已做到的验证：

- ✅ 注入脚本语法：全部通过
- ✅ Hook 逻辑：在 Node 里模拟 MSE 环境跑了 12 项断言，全过
  （含最容易出错的 `slice(0)` 复制语义、50 万字节的 base64 往返、
  hook 重复注入不叠加）
- ✅ fMP4 拼装：`init + 分片` 直接拼接，ffprobe 校验通过
  （1280x720 / H.264+AAC / 10.13 秒）
- ⬜ 真实浏览器端到端：需要你本地跑一次

测试站里准备了两个 blob 页面，拿去验证：

```bash
cd tests && python -m http.server 8877
python -m mharvest http://127.0.0.1:8877/mse_simple.html --browser --click "#play" -o ./out
python -m mharvest http://127.0.0.1:8877/mse_api.html    --browser --click "#play" -o ./out
```

两个页面的差别很有代表性：

| 页面 | 分片地址 | 纯 HTTP 结果 | `--browser` 结果 |
|---|---|---|---|
| `mse_simple.html` | 硬编码在 JS 数组 | 只抓到 1.3KB 初始化段，5 个分片全漏 | 完整视频 |
| `mse_api.html` | 由 `/api/segments.json` 动态返回 | **一条都抓不到** | 完整视频 |

## 已知限制

- **DASH（.mpd）** 暂不支持，需要 ffmpeg 或专业下载器
- **DRM 内容**（Widevine / FairPlay / PlayReady）抓不到，
  这是浏览器安全架构层面的限制，且涉及法律风险
- **需要登录的站点** 用 `--cookie` 传入，不支持交互式登录流程
- **SPA 站点** 首屏 HTML 里没内容，建议用 `--browser` 或直接给接口地址

## 合规提醒

默认遵守 `robots.txt`。请控制 `--delay` 和 `--workers`，别对第三方站点做高压抓取；
商用前确认目标站的使用条款与内容版权。

## 本地跑起来看效果

压缩包里**已经内置了测试站和全部素材**（图片、音频、mp4、加密 m3u8、多码率流），
解压后直接跑，不用先装 ffmpeg、也不用生成素材。

```bash
pip install requests cryptography     # 只有两个依赖

cd mharvest/tests
python -m http.server 8877           # 起本地测试站，这个窗口保持开着

# 另开一个终端
cd mharvest
python -m mharvest http://127.0.0.1:8877/index.html -o ./out --depth 2
```

跑完看 `./out` 目录和 `./out/manifest.json`。预期结果：

```
audio/sound.mp3      videos/clip.mp4      ← 音视频直链
videos/master.mp4    ← m3u8 多码率流（默认选最高码率 720p）
videos/enc.mp4       ← m3u8 AES-128 加密流（解密后合并）
images/*.jpg|png|webp  ← 含懒加载图、CSS 背景图、og:image、base64 内联图
```

**关于 ffmpeg**：它是可选的，只用来把 m3u8 分片合并成 mp4。
没装也能完整跑一遍，只是 `enc.mp4` / `master.mp4` 会变成 `.ts` 文件
（播放器能直接打开，内容不缺）。装上之后：

```bash
# Ubuntu / Debian
sudo apt install ffmpeg
# macOS
brew install ffmpeg
# Windows：去 ffmpeg.org 下载，解压后把 bin 目录加进 PATH
```

**素材想重新生成**（比如想改测试视频时长）：
```bash
bash tests/make_media.sh     # 需要 ffmpeg，会覆盖 media/ 下的音视频
python tests/build.py        # 重新生成测试页面
```

## 测试

```bash
python tests/test_resume.py    # 断点续传（含"脏数据不续传"安全性验证）
```

## Windows 注意

如果控制台中文乱码，先执行 `chcp 65001` 切换成 UTF-8 再运行。
