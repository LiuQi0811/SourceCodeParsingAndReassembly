# Wallpics.app 全站壁纸爬虫

## 逆向分析结果

网站使用 **Next.js App Router + React Server Components (RSC)** 架构，**无加密**，无需逆向解密：

1. **列表分页**: 通过 `?page=N` 参数实现，每页24个壁纸，通过 `<link rel="next" href="/?page=N+1">` 指示下一页
2. **详情数据**: 壁纸元数据（原图URL、各分辨率、AI增强版、动态视频链接）以JSON格式内嵌在服务端渲染的RSC流 `self.__next_f.push([1,"..."])` 中，HTML直出，不需要调用额外API
3. **图片URL结构**:
   - 原图 (最高分辨率): `https://media.wallpics.app/wallpapers/YYYY/MM/DD/{HASH|UUID}.{png|jpeg}`
   - AI增强版 (4K放大): `https://media.wallpics.app/upscaled/YYYY/MM/DD/{HASH}.webp`
   - 多分辨率适配: 同目录下UUID命名的jpeg，覆盖iPhone/Android主流机型尺寸
   - 动态壁纸视频: `https://media.wallpics.app/videos/YYYY/MM/DD/{HASH}.mp4`
   - 缩略图: `https://media.wallpics.app/thumbnails/YYYY/MM/DD/{HASH}_xxx.{webp|jpg}`
4. **反爬**: media.wallpics.app 无防盗链，无Referer校验，可直接下载

## 支持抓取的分类

| 类型 | 路径 |
|------|------|
| Regular 静态壁纸 | `/` (首页) |
| Live 动态壁纸 | `/live-wallpapers` |
| Double 双层壁纸 | `/double-wallpapers` |
| Matching 配对壁纸 | `/matching-wallpapers` |
| Desktop 桌面壁纸 | `/desktop-wallpapers` |
| Hot 热门 | `/hot` |
| New 最新 | `/new` |
| PFP 头像 | `/profile-pictures` |
| Pets 宠物 | `/pets` |
| 主题分类（40+） | cars, anime-3, movies, nature, aesthetic, space, gaming-165, animals-4047, amoled, apple, abstract, cute, 4k, ... |

## 使用方法

```bash
# 安装依赖
pip install requests

# 全站抓取（所有分类，4线程，下载动态视频和AI增强版）
python3 wallpics_crawler.py

# 指定输出目录和线程数
python3 wallpics_crawler.py -o /path/to/save -w 8

# 仅抓取单个分类（例如动漫）
python3 wallpics_crawler.py --category /anime-3

# 不下载动态视频（节省空间）
python3 wallpics_crawler.py --no-video

# 不下载AI增强版
python3 wallpics_crawler.py --no-upscaled
```

## 目录结构

```
wallpics_download/
├── downloaded.json          # 下载记录（支持断点续爬）
├── wallpapers/
│   └── {ID}_{壁纸名}/
│       ├── meta.json        # 完整元数据（标题、作者、标签、分类、所有URL）
│       ├── original.png     # 原始最高分辨率
│       ├── upscaled.webp    # AI增强4K版
│       ├── apple-1170x2532.jpeg  # iPhone 12/13/14
│       ├── apple-1125x2436.jpeg  # iPhone X/XS/11 Pro
│       └── ...              # 其他分辨率适配版本
└── videos/
    └── {ID}_{壁纸名}.mp4    # Live动态壁纸视频
```

## 特性

- ✅ **多线程并发下载**（默认4线程，可用 `-w` 调整）
- ✅ **断点续爬**：自动记录已完成壁纸，中断后重新运行跳过已下载
- ✅ **自动分页**：遍历所有分类的所有页面直到末页
- ✅ **多分辨率下载**：自动下载所有iPhone/Android适配尺寸
- ✅ **Live壁纸视频**：动态壁纸自动抓取MP4视频
- ✅ **AI增强版**：下载Upscaled 4K增强版
- ✅ **元数据保存**：每个壁纸保存完整JSON元数据（标题、描述、作者、分类、标签、下载量等）
