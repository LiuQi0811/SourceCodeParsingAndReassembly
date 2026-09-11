================================================================
bing.wdbyte.com 全站抓取包
================================================================

【内容】
  bing.wdbyte.com/        —— 已抓取的整站文件(可直接离线浏览)
       ├─ index.html               英文站首页
       ├─ zh-cn/                   中文站
       ├─ 2021-02.html ~ 2026-09.html  英文月归档 (68 个)
       ├─ day/YYYYMM/DD.html       英文每日壁纸详情
       ├─ zh-cn/day/YYYYMM/DD.html 中文每日壁纸详情
       ├─ css/w3.css               样式
       ├─ js/{w3,download,love,search}.js 脚本
       ├─ img/fav.jpg              图标
       ├─ images.json              全部壁纸元数据 (3411 条, 搜索功能依赖此文件)
       └─ report.txt               抓取报告

  bing_wdbyte_spider.py  —— 全站爬虫源码

【离线浏览】
  cd bing.wdbyte.com
  python3 -m http.server 8000
  浏览器打开 http://localhost:8000/  (英文) 或 http://localhost:8000/zh-cn/ (中文)

【下载 4K 原图 (可选)】
  默认只抓页面/脚本/样式，不下载壁纸原图(避免几 GB 流量)。
  如需全部 3411 张 UHD 4K 壁纸：
    python3 bing_wdbyte_spider.py --images --workers 10
  图片将保存到 bing.wdbyte.com/wallpapers/，命名：YYYY-MM-DD_region_OHRname.jpg
  支持断点续传（已下载的自动跳过）。

【爬虫特性】
  - 并发下载 + 失败自动重试(5次) + 断点续传
  - 基于 images.json 精确构造 URL，不瞎爬
  - 自动过滤 JS 模板字符串等伪链接
  - 无加密无需逆向（纯静态阿里云 OSS 站点）

