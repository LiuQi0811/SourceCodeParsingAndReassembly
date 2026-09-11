# AppleWalls 全站壁纸爬虫使用说明

## 站点逆向结论

- **站点技术栈**: Next.js 14 App Router（RSC 流式渲染）+ Cloudflare CDN
- **图片 CDN**: `https://static.applewalls.com/` —— **完全公开，无签名/鉴权/加密/防盗链**，无需任何逆向解密
- **数据位置**: 页面 `<script>self.__next_f.push(...)</script>` 的 RSC payload 中直接内嵌 JSON，包含每张壁纸的 `name / type / size / originPath / compressPath`
- **原图 URL 规则**: `https://static.applewalls.com/{URL编码后的originPath}`
- **预览图 URL 规则**: `https://static.applewalls.com/{URL编码后的compressPath}`
- 部分集合（如 Live 动态壁纸）带有 `"tag":""` 等额外字段，爬虫已兼容

## 已统计资源（中文站 zh）

| 项目 | 数量 |
| --- | --- |
| 壁纸集合 | 202 个 |
| 壁纸总数 | 1605 张 |
| 总大小（约） | 8.8 GB（原图） |
| 资源类型 | 静态壁纸 PNG/JPG + 动态壁纸 MP4（Live 壁纸） |

分类统计：

- iOS 系统壁纸: 372
- iPhone 设备壁纸: 331
- Apple Store 壁纸: 153
- WWDC 壁纸: 129
- iPad 设备壁纸: 105
- Mac 设备壁纸: 100
- macOS 系统壁纸: 89
- Live 动态壁纸(MP4): 82
- 新年主题壁纸: 74
- CarPlay 车载壁纸: 70
- Apple Pride 骄傲壁纸: 68
- iPadOS 系统壁纸: 32

## 快速使用

### 1. 仅生成元数据索引（不下图片，秒级）

`python3 applewalls_crawler.py --no-download`

输出 `applewalls_downloads/index.json`，可先查看全部壁纸信息再决定是否下载。

### 2. 下载全部原图（约 8.8GB）

`python3 applewalls_crawler.py`

- 默认 6 线程，可通过 `-w` 调整（例如 `-w 8`）
- 默认输出目录 `./applewalls_downloads`，可通过 `-o` 修改
- **断点续传**：中断后重新运行相同命令即可，已完成的文件会自动跳过
- `.part` 文件是未完成的临时文件，会自动续传

### 3. 仅下载预览图（省流量，快速预览，约 200MB）

`python3 applewalls_crawler.py --compress-only`

### 4. 同时下载原图 + 预览图

`python3 applewalls_crawler.py --preview`

### 5. 其他语言站点

`python3 applewalls_crawler.py -l en      # 英文`\
`python3 applewalls_crawler.py -l ja      # 日文`\
`python3 applewalls_crawler.py -l vi      # 越南文`\
`python3 applewalls_crawler.py -l zh-hant # 繁体中文`

### 6. 继续之前被中断的下载（跳过元数据扫描）

`python3 applewalls_crawler.py --resume`

## 目录结构

下载完成后目录结构如下：

`applewalls_downloads/`\
`├── index.json                 # 全量元数据索引（含本地路径映射）`\
`├── failed_downloads.json      # 下载失败清单（如有）`\
`├── apple-carplay/             # 分类目录`\
`│   ├── iOS 14 CarPlay/        # 集合（专辑）`\
`│   │   ├── ios-14-carplay-black-dark.png`\
`│   │   ├── ios-14-carplay-black-light.png`\
`│   │   └── ...`\
`│   │   └── _preview/          # 预览图（--preview 时生成）`\
`│   │       └── *.webp`\
`│   └── ...`\
`├── iphone/`\
`├── live/                      # 动态壁纸 .mp4`\
`├── mac/`\
`├── macos/`\
`├── ipad/`\
`├── ipados/`\
`├── ios/`\
`├── wwdc/`\
`├── new-year/`\
`├── apple-pride/`\
`└── apple-stores/`

## 索引 JSON 字段说明

`index.json` 示例：

`{`\
`  "site": "https://www.applewalls.com",`\
`  "lang": "zh",`\
`  "totals": {"collections": 202, "items": 1605, "approx_size_mb": 9025.1},`\
`  "collections": [`\
`    {`\
`      "page_url": "https://www.applewalls.com/zh/wallpapers/iphone/iphone-18-pro-wallpapers",`\
`      "category": "iphone",`\
`      "slug": "iphone-18-pro-wallpapers",`\
`      "collection": "iPhone 18 Pro Wallpapers",`\
`      "date": "2024/09/20",`\
`      "description": "...",`\
`      "items": [`\
`        {`\
`          "name": "iphone-18-pro-wallpaper-black-home-screen",`\
`          "type": "image/png",`\
`          "size": "4.12 MB",`\
`          "originPath": "iPhone/iPhone 18 Pro/origin/xxx.png",`\
`          "compressPath": "iPhone/iPhone 18 Pro/compress/xxx.webp",`\
`          "origin_url": "https://static.applewalls.com/...",`\
`          "compress_url": "https://static.applewalls.com/...",`\
`          "local_origin": "iphone/iPhone 18 Pro Wallpapers/xxx.png",`\
`          "local_compress": "iphone/iPhone 18 Pro Wallpapers/_preview/xxx.webp"`\
`        }`\
`      ]`\
`    }`\
`  ]`\
`}`

## 依赖

`pip install requests`

仅需 `requests` 一个第三方库，无需浏览器、无需 JS 执行、无需加解密库。

## 完整命令选项

`-o, --output DIR      输出目录（默认 ./applewalls_downloads）`\
`-w, --workers N       并发下载线程数（默认 6）`\
`-l, --lang LANG       语言 zh/en/ja/vi/zh-hant（默认 zh）`\
`--no-download         只生成元数据索引，不下载`\
`--preview             同时下载预览图`\
`--compress-only       只下载预览图`\
`--resume              使用已有 index.json 直接续传`