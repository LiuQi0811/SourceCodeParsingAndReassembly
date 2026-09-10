# 4kvm.net 全站爬虫

## 逆向解密说明

本爬虫已**完美逆向**该网站的WASM视频地址加密：

1. **加密机制分析**：网站使用 Rust 编译的 WebAssembly (WASM) 模块 `nbmovie_wasm_bg.wasm` 生成签名请求URL
2. **核心函数**：`build_play_url(dataid, secret_key, quality, play_key)` 接收4个参数生成带有签名、时间戳、用户key的API路径
3. **签名算法**：内置XTEA加密 + MD5签名，验证时间戳和用户key防止爬取
4. **逆向方案**：直接复用原始WASM二进制文件，通过Node.js加载调用，100%还原浏览器端行为，无任何兼容性问题

## 文件结构

```
scraper/
├── scraper.py              # Python爬虫主程序 (列表爬取+详情提取+数据存储)
├── decrypt_server.mjs      # Node.js WASM解密服务 (100%原始WASM)
├── nbmovie_wasm.js         # 原始WASM JS加载器 (从网站下载)
├── nbmovie_wasm_bg.wasm    # 原始WASM二进制文件 (从网站下载，解密核心)
├── package.json            # Node依赖
└── README.md               # 本说明
```

运行后自动生成：
```
4kvm_data/
├── scraper.db              # SQLite数据库 (断点续爬)
├── 4kvm_all_videos.json    # 所有视频数据JSON导出
└── scraper.log             # 运行日志
```

## 环境要求

- Python 3.8+
- Node.js 16+
- Python依赖: `pip install requests beautifulsoup4`
- Node依赖: 自动安装 (node-fetch，仅测试用，服务本身无需任何依赖)

## 使用方法

### 快速测试（验证解密是否工作）
```bash
python3 scraper.py --test
```

### 爬取电影分类前3页
```bash
python3 scraper.py --max-pages 3
```

### 全站爬取（电影+电视剧+动漫）
```bash
python3 scraper.py
```

### 自定义参数
```bash
python3 scraper.py \
  --max-pages 10 \      # 每个分类最多爬10页
  --max-videos 50 \     # 最多爬50个视频详情
  --max-episodes 200    # 最多解密200集视频地址
```

## 数据格式

导出的JSON结构：
```json
{
  "site": "https://www.4kvm.net",
  "crawl_time": "2026-xx-xx",
  "stats": {
    "videos": 1000,
    "details": 1000,
    "episodes": 50000,
    "ep_done": 50000
  },
  "videos": [
    {
      "vod_id": "206",
      "secret_key": "cgzobzuhl",
      "title": "甄嬛传: 第1季 - 第1集",
      "cover": "https://...jpg",
      "description": "...",
      "year": "2011",
      "episodes": [
        {
          "dataid": "815",
          "episode_num": 1,
          "line_name": "alists",
          "secret_key": "cgzobzuhl",
          "title": "第1集",
          "video_url": "https://oss.douyinbit.com/m3u8/xxx.m3u8",
          "video_type": "m3u8",
          "quality": "1080p",
          "status": "done"
        }
      ]
    }
  ]
}
```

## 特性

✅ **WASM完美逆向** - 直接调用原始WASM，签名100%正确，永久有效  
✅ **断点续爬** - SQLite存储进度，中断后可继续  
✅ **自动去重** - URL和数据库双重去重  
✅ **多线程** - 线程池并发爬取详情和解密  
✅ **自动重试** - 网络错误自动重试3次  
✅ **自动管理** - 自动启动/停止WASM解密服务  
✅ **JSON导出** - 结构化数据方便二次使用  

## 注意事项

1. 首次运行会自动启动Node.js解密子进程 (端口29527)
2. 请控制爬取速度，避免对服务器造成压力
3. 视频地址为带时效的m3u8链接，不建议永久存储
4. 仅供学习研究使用，请遵守相关法律法规
