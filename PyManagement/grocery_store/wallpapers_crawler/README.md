# Wallpapers.com 全站爬虫使用说明

## 🔍 逆向分析结论

**重要：该网站图片CDN完全开放，无需任何逆向解密！**

经过完整的逆向分析发现：
- ✅ **无JavaScript加密** - 图片URL直接出现在HTML中
- ✅ **无签名认证** - CDN链接可直接访问无需token
- ✅ **无Referer防盗链强校验** - 只需携带基础浏览器UA即可
- ✅ **URL规律极其简单** - 缩略图URL直接替换路径即可获得高清原图

### URL转换规则（核心发现）
```
缩略图: https://wallpapers.com/images/thumbnail/{name}-{id}.jpg
高清HD: https://wallpapers.com/images/hd/{name}-{id}.jpg    ← 直接替换路径即可!
```

## 📁 文件说明

| 文件 | 说明 |
|------|------|
| `wallpapers_crawler_v2.py` | ✅ **推荐使用** - 完整功能全站爬虫 |
| `fast_download.py` | 快速批量下载脚本（简化版） |
| `wallpapers_crawler.py` | 完整功能版（支持进度断点续传） |
| `demo_wallpapers/` | 演示下载的32张样例壁纸 |

## 🚀 快速开始

### 1. 下载全部栏目前10页测试
```bash
python3 wallpapers_crawler_v2.py -p 10 -s all
```

### 2. 只下载wallpapers栏目全部页面
```bash
python3 wallpapers_crawler_v2.py -s wallpapers
```

### 3. 下载指定栏目
```bash
python3 wallpapers_crawler_v2.py -s wallpapers backgrounds pictures png svg
```

### 4. 自定义参数
```bash
python3 wallpapers_crawler_v2.py \
  -o my_wallpapers \     # 保存目录
  -w 10 \                # 并发线程数
  -p 50 \                # 每个栏目下载页数
  -s wallpapers          # 指定栏目
```

## 📋 参数说明

| 参数 | 说明 | 默认值 |
|------|------|--------|
| `-o, --output` | 保存目录 | wallpapers_hd |
| `-w, --workers` | 并发下载线程数 | 8 |
| `-p, --pages` | 每个栏目最大页数(不指定则爬取全部) | None(全部) |
| `-s, --sections` | 指定栏目: wallpapers/backgrounds/pictures/png/svg/all | wallpapers |
| `--delay` | 请求延迟范围(秒) | 0.2 1.0 |

## 📊 网站规模估计

- Wallpapers栏目: 约 3800+ 页 × 32张 ≈ **120,000+ 张高清壁纸**
- Backgrounds栏目: 数千张
- Pictures栏目: 数千张
- PNG/SVG栏目: 数万张透明素材

## ⚠️ 注意事项

1. **爬取全部内容需要较长时间**（约12万张×200KB≈24GB），建议先小页数测试
2. 脚本支持**断点续传**，中断后再次运行会自动跳过已下载文件
3. 请合理设置并发数和延迟，避免对服务器造成过大压力
4. 下载的图片版权归原作者所有，请勿用于商业用途
5. 图片分辨率为 **1920×1080 HD** 起步，大部分为4K质量

## 📂 目录结构

下载后的文件组织：
```
wallpapers_hd/
├── wallpapers/      # 壁纸栏目
├── backgrounds/     # 背景栏目
├── pictures/        # 图片栏目
├── png/             # PNG透明素材
├── svg/             # SVG矢量图
└── progress.json    # 下载进度记录
```

## 🔧 技术细节

### 爬取流程
1. 访问列表页 `https://wallpapers.com/{section}/page/{n}`
2. 解析所有`<img>`标签的`src`和`data-src`（懒加载）属性
3. 将`/images/thumbnail/`替换为`/images/hd/`得到高清原图URL
4. 多线程并发下载，自动去重，支持断点续传

### 反爬绕过
- 使用真实浏览器User-Agent
- 随机请求延迟（0.2-1秒可配置）
- 自动重试失败请求
- 不依赖浏览器渲染，纯HTTP请求高效快速

---

**爬虫开发完成时间**: 2026年
**逆向结果**: 无需解密，CDN完全开放直连下载
