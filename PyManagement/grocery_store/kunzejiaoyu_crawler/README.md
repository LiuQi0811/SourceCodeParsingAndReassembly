# 看片狂人 (kunzejiaoyu.net) 全站爬虫

## 站点逆向结论

| 项目 | 结论 |
|---|---|
| 建站程序 | **苹果CMS(maccms) v10**，URL 规则完全符合标准苹果CMS路径 |
| 视频源格式 | **HLS / m3u8** |
| 是否加密 | **完全未加密**（播放页全局变量 `player_aaaa.encrypt=0`）|
| 链接获取方式 | 正则提取 `var player_aaaa = {...};` JSON，取 `url` 字段即明文 m3u8 直链 |
| 反爬强度 | 无JS加密、无字体反爬、无签名；仅常规 UA / Referer 校验 |

**关键逆向片段（播放页源码中直接可见，不需要任何解密）：**
```js
var player_aaaa={
  "flag":"play",
  "encrypt":0,           // ← 0 表示完全明文
  "url":"https://v4.ppqrrs.com/wjv4/202609/08/caAa9nAQwQ95/video/index.m3u8",
  "from":"wjm3u8",
  "id":"106576","sid":1,"nid":1
};
```
因此无需任何逆向解密，直接提取即可，100% 还原真实播放地址。

## URL 结构速查

| 类型 | 规则 | 示例 |
|---|---|---|
| 首页 | `/` | `https://kunzejiaoyu.net/` |
| 分类列表 | `/kuvodtype/{slug}.html` | `/kuvodtype/dianying.html` |
| 分类分页 | `/kuvodtype/{slug}-{page}.html` | `/kuvodtype/dianying-3.html` |
| 详情页 | `/kuvoddetail/{vod_id}.html` | `/kuvoddetail/106576.html` |
| 播放页 | `/kuvodplay/{vod_id}-{sid}-{nid}.html` | `/kuvodplay/106576-1-1.html` |

当前顶级分类：`dianying`(电影)、`dianshiju`(电视剧)、`zongyi`(综艺)、`dongman`(动漫)。

## 安装依赖

```bash
pip install -r requirements.txt
```

如需把 m3u8 下载合并为本地 `.mp4`，**强烈推荐**安装 `ffmpeg`（比 Python 原生下载快且兼容）：

```bash
# Ubuntu/Debian
sudo apt install -y ffmpeg
# CentOS
sudo yum install -y ffmpeg
# macOS
brew install ffmpeg
# Windows: 到 https://ffmpeg.org/download.html 下载后加入 PATH
```

脚本会自动检测 `ffmpeg`，如果检测不到会回退到内置原生多线程 TS 下载器（自动解析嵌套 m3u8、断点续传）。

## 使用方法

### 1. 快速测试单部影片（推荐首次运行）
```bash
python kunzejiaoyu_spider.py --mode single --vod-id 106576
```
仅抓取 `vod_id=106576`（热血部落），写入 `output/meta/106576.json`。

### 2. 全站元数据索引（最快，建议先跑这步）
遍历电影 / 电视剧 / 综艺 / 动漫 四个分类所有分页，抓取每部影片的标题、导演、演员、简介、每一集的 m3u8 直链，汇总成 CSV 索引，**不下载视频本体**：
```bash
python kunzejiaoyu_spider.py --mode meta --workers 6 --delay 0.8
```
跑完后会生成：
- `output/meta/*.json` —— 每部影片一个完整 JSON
- `output/vod_index.csv` —— 可直接用 Excel 打开的全量索引（含 m3u8 直链）
- `output/progress.json` —— 进度文件，中断后重跑自动跳过已抓取 ID，断点续爬

### 3. 全站抓取（元数据 + 下载全部视频为 mp4）
```bash
python kunzejiaoyu_spider.py --mode full --workers 4 --delay 1
```
视频会保存到 `output/videos/<片名>/<集名>.mp4`。
> 该站视频总量巨大，全量下载耗时极长且占大量磁盘，请先跑 meta 模式看索引体量再决定。

### 4. 单部影片 + 下载
```bash
python kunzejiaoyu_spider.py --mode single --vod-id 106576 --download
```

### 常用参数
| 参数 | 说明 | 默认 |
|---|---|---|
| `--workers N` | 并发线程数 | 6 |
| `--delay S` | 请求之间基础延时（秒），随机0~S抖动 | 0.8 |
| `--max-pages N` | 每个分类最多爬 N 页（调试用）| 不限 |
| `--download` | 显式开启视频下载 | 关（full 模式自动开）|

## 输出目录结构
```
output/
├── progress.json        # 断点续爬进度
├── vod_index.csv        # 全量索引（vod_id / 标题 / 分类 / 集数 / m3u8 / 页面URL）
├── meta/
│   ├── 106576.json
│   └── ...
└── videos/
    └── 热血部落/
        └── HD.mp4
```

## 合规声明
本工具仅用于技术学习与网站结构研究。请尊重版权方权益，抓取到的内容请勿擅自传播、商用或二次分发；若站点存在版权内容，请在下载后 24 小时内删除。使用本工具所产生的任何法律责任由使用者自行承担。
