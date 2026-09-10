# 粤漫之家 (ymvid.com) 全站爬虫

完美逆向 AES 加密的粤语/国语动漫资源站爬虫，支持全站抓取、断点续传、多线程下载。

## 🔐 逆向要点

| 保护项 | 逆向结果 |
|--------|----------|
| 视频地址加密 | **AES-ECB / PKCS7**，密钥 `AVSI6788^765idue` (16字节) |
| 密文格式 | 页面 `<input type="hidden">` 里存放 Hex 编码密文，解密后为 `/allocate/playlist/{HEX}?t={token}` |
| m3u8 真实地址 | `{base}/{seriesId}?t={token}&vId={videoId}` (seriesId 来自集数链接 `/play/{vid}/{sid}`) |
| Browser-Code 指纹 | `AES_ECB(visitorId_YYYY-MM-DD)`，使用固定 visitorId 即可（服务端不校验真实性，只校验格式+日期+session一致性） |
| 视频协议 | HLS (m3u8 + ts分片)，部分视频用 AES-128 加密（m3u8 内已带 key URI，ffmpeg 可直接处理） |

## 📦 安装

```bash
pip install -r requirements.txt
```

依赖：
- `requests` — HTTP 请求
- `beautifulsoup4` + `lxml` — HTML 解析
- `pycryptodome` — AES 加解密

合并视频为 MP4 需安装 **ffmpeg**：
```bash
# Ubuntu/Debian
sudo apt install ffmpeg
# macOS
brew install ffmpeg
# Windows: 从 https://ffmpeg.org/download.html 下载后加入 PATH
```

## 🚀 使用

### 1. 单视频测试（推荐先试）
```bash
python ymvid_crawler.py --single 7055 --max-episodes 2
# 或传完整URL
python ymvid_crawler.py --single https://www.ymvid.com/play/7055
```

### 2. 只抓元数据（不下载视频）
```bash
# 粤语动画第1页
python ymvid_crawler.py -c 1 --start-page 1 --end-page 1 --meta-only

# 全站所有分类元数据
python ymvid_crawler.py -c 1,2,4 --meta-only
```

### 3. 小流量试跑（每部动画最多下载3集）
```bash
python ymvid_crawler.py -c 1 -w 2 -t 8 --max-episodes 3 --end-page 2
```

### 4. 全站下载
```bash
# 粤语动画全部（87页，约2000+部）
python ymvid_crawler.py -c 1 -w 2 -t 8

# 粤语+国语+连载 全部分类
python ymvid_crawler.py -c 1,2,4 -w 2 -t 8
```

## ⚙️ 参数说明

| 参数 | 说明 | 默认 |
|------|------|------|
| `-o, --output` | 输出目录 | `./ymvid_downloads` |
| `-c, --categories` | 分类ID (1=粤语动画,2=国语动画,4=连载动画)，逗号分隔 | `1` |
| `-w, --workers` | 视频并发数（同时下载几部动画） | `2` |
| `-t, --ts-workers` | 单个视频内 ts 分片并发下载线程数 | `8` |
| `--start-page` | 列表起始页 | `1` |
| `--end-page` | 列表结束页（不指定=全部） | 无 |
| `--meta-only` | 只抓取元数据，不下载视频 | 关 |
| `--max-episodes` | 每部动画最多下载多少集（试跑用） | 全部 |
| `--single` | 只抓单个视频（传入ID或URL） | 无 |

## 📂 输出目录结构

```
ymvid_downloads/
├── index.json                          # 全站索引（所有视频元数据+m3u8地址）
└── videos/
    └── 粤语动画/
        └── 大儒侠史艳文/
            ├── cover.jpg               # 封面
            ├── meta.json               # 该动画元数据
            ├── EP001_01/
            │   ├── index.m3u8          # 本地 m3u8 索引（已改写为本地路径/key）
            │   ├── concat_list.txt     # ffmpeg concat 列表
            │   ├── merge.sh            # Linux/Mac 合并脚本
            │   ├── merge.bat           # Windows 合并脚本
            │   └── segments/
            │       ├── seg_00000.ts
            │       ├── seg_00001.ts
            │       └── ...
            └── EP002_02/
                └── ...
```

## 🎬 合并为 MP4

下载完成后，进入每个 `EPxxx_xxx/` 目录，运行：
```bash
# Linux/Mac
bash merge.sh
# Windows
merge.bat
```

或手动执行：
```bash
ffmpeg -allowed_extensions ALL -i index.m3u8 -c copy "../EP001.mp4"
```

批量合并（Linux/Mac）：
```bash
find ymvid_downloads/videos -name "merge.sh" -exec bash {} \;
```

## 📌 注意事项

1. **合法使用**：本工具仅供个人学习研究使用，请遵守版权法规，下载内容请勿传播或商用。
2. **礼貌爬取**：默认线程数较保守（2 视频并发 + 8 ts 并发），调高线程可能被封禁 IP。
3. **断点续传**：脚本自动跳过已下载的 ts 分片，中途中断可重新运行，不会重复下载。
4. **Cookie/指纹**：脚本内置固定 visitorId 生成 Browser-Code，首次访问首页时自动种 cookie，无需浏览器。
5. **视频CDN**：ts 分片托管在 `video.acvid.top`，下载速度通常较快。
