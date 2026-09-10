# 樱花动漫全站爬虫使用说明

## 功能特点

✅ **全站爬取** - 自动爬取网站所有动漫
✅ **AES-128自动解密** - 完美支持加密m3u8视频自动解密
✅ **多线程下载** - 32线程高速下载TS片段
✅ **断点续传** - 支持中断后继续下载
✅ **自动合并** - 下载完成自动合并为MP4格式
✅ **元数据保存** - 自动保存动漫详情和封面
✅ **多种模式** - 支持全站爬取、关键词搜索、单部下载

## 安装依赖

```bash
pip install -r requirements.txt
```

## 使用方法

### 1. 全站爬取
```bash
# 爬取全站所有动漫
python yhdm_crawler.py --mode all

# 只爬取前10页
python yhdm_crawler.py --mode all --max_pages 10

# 只爬取前5部动漫测试
python yhdm_crawler.py --mode all --max_anime 5
```

### 2. 关键词搜索下载
```bash
# 搜索下载指定动漫
python yhdm_crawler.py --mode search --keyword "海贼王"
python yhdm_crawler.py --mode search --keyword "火影忍者"
```

### 3. 单部动漫下载
```bash
# 通过动漫ID下载
python yhdm_crawler.py --mode single --anime_id 20260241
```

### 4. 自定义线程数
```bash
python yhdm_crawler.py --mode all --workers 16 --ts_workers 64
```

## 文件结构
```
樱花动漫下载/
├── 动漫名称1/
│   ├── info.json          # 动漫详情信息
│   ├── poster.jpg         # 封面图片
│   ├── 第01集.mp4         # 视频文件
│   ├── 第02集.mp4
│   └── ...
├── 动漫名称2/
│   └── ...
└── progress.json          # 下载进度记录
```

## 技术说明

### 逆向解密说明
1. **m3u8地址提取**: 直接访问`/_player_x_/xxxx`播放器iframe页面，源码中直接包含`<source>`标签的m3u8地址，无需JS解密
2. **AES-128解密**: 
   - 自动检测`#EXT-X-KEY:METHOD=AES-128`标签
   - 自动获取key密钥(16字节)
   - 自动解析IV(优先使用m3u8中IV，否则使用片段序号)
   - AES-CBC模式解密，自动去除PKCS7填充
3. **TS片段合并**: 按序号顺序合并解密后的TS片段，输出标准MP4文件

### 反爬处理
- 随机User-Agent
- 自动Referer携带
- 请求失败自动重试(指数退避)
- 请求间隔防封禁

## 注意事项

1. 下载速度取决于网络带宽和线程数，建议ts_workers不超过64
2. 视频文件较大，请确保磁盘空间充足
3. 仅用于个人学习使用，请支持正版
4. 如遇部分线路无法播放，代码自动优先处理可用线路
