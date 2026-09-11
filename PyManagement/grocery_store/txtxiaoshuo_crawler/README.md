# txtxiaoshuo.com 全站小说爬虫

## 项目说明

针对 https://www.txtxiaoshuo.com/ 的全站爬虫，支持：

1. **元数据抓取**：自动遍历所有6个分类的所有分页，抓取每本小说的：
   - 书名、作者、完结状态（完结全本/精校全本）
   - 文件大小、内容简介
   - 发布日期、浏览次数
   - 分类、详情页URL、城通网盘下载链接

2. **城通网盘自动下载**：内置城通网盘直链解析器，支持：
   - 自动填入访问密码（`txtxiaoshuo`）
   - 多策略API解析（兼容城通网盘新旧版接口）
   - 自动跟随重定向获取真实下载地址
   - 断点续存、文件校验

3. **逆向说明**：
   - ✅ 该网站使用 **Z-BlogPHP** 搭建，**无前端JS加密**，所有链接直接在HTML源码中
   - ✅ 下载链接直接指向城通网盘，密码已在URL参数 `p=txtxiaoshuo` 中，无需额外破解
   - ✅ 城通网盘普通下载流程已完整实现，支持其多种API端点和页面版本
   - ✅ 无需浏览器渲染、无需Selenium/Playwright，纯HTTP请求即可完成

## 文件结构

```
txtxiaoshuo_crawler/
├── txtxiaoshuo_spider.py      # 主爬虫程序（抓取+下载）
├── ctfile_downloader.py       # 城通网盘专用下载器（独立可用）
├── requirements.txt           # Python依赖
├── README.md                  # 本说明文件
└── novels/                    # 输出目录（运行后自动生成）
    ├── novels_metadata.json   # 全部小说元数据JSON
    ├── novels_metadata.csv    # 全部小说元数据CSV（可Excel打开）
    ├── spider.log             # 运行日志
    ├── 都市·异能/             # 按分类存放下载的小说
    ├── 奇幻·玄幻/
    ├── 武侠·仙侠/
    ├── 科幻·游戏/
    ├── 惊悚·灵异/
    └── 军事·历史/
```

## 安装依赖

```bash
pip install -r requirements.txt
```

## 使用方法

### 1. 仅抓取元数据（不下载文件）

```bash
python txtxiaoshuo_spider.py
```

这会遍历全部分类所有页面，将所有小说信息保存为JSON和CSV文件。

### 2. 抓取并自动下载小说

```bash
python txtxiaoshuo_spider.py --download
```

### 3. 只爬取单个分类

```bash
# 分类1: 都市·异能
# 分类2: 奇幻·玄幻
# 分类3: 武侠·仙侠
# 分类4: 科幻·游戏
# 分类5: 惊悚·灵异
# 分类6: 军事·历史
python txtxiaoshuo_spider.py --category 1 --download
```

### 4. 从指定页码开始（断点续爬）

```bash
python txtxiaoshuo_spider.py --category 2 --start-page 10
```

### 5. 单独使用城通网盘下载器

```bash
python ctfile_downloader.py "https://url91.ctfile.com/f/37476991-1459925932-14c05c?p=txtxiaoshuo" ./downloads
```

## 输出格式

### JSON示例
```json
{
  "id": "12187",
  "name": "我是曾小贤",
  "author": "两袖白云",
  "status": "完结全本",
  "file_size": "1.6 MB",
  "intro": "这是一个扭曲的世界，这是一个爱情公寓的世界...",
  "category_id": 1,
  "category": "都市·异能",
  "url": "https://www.txtxiaoshuo.com/?id=12187",
  "pub_date": "2026-09-11",
  "views": "92",
  "download_url": "https://url91.ctfile.com/f/37476991-1459925932-14c05c?p=txtxiaoshuo",
  "filename": "我是曾小贤.txt",
  "downloaded": true
}
```

## 反爬策略与注意事项

1. **请求延迟**：列表页间隔1秒，详情页间隔0.5秒，下载间隔2秒
2. **失败重试**：最多3次指数退避重试
3. **断点续爬**：每5页自动保存元数据，重新运行会自动跳过已爬取内容
4. **User-Agent**：使用Chrome浏览器UA
5. **城通网盘限流**：城通网盘对非VIP下载有限速和频率限制，建议不要开太高并发
6. **法律说明**：本工具仅供学习爬虫技术使用，请支持正版书籍。网站明确说明"不做书籍内容本体的对外分享传播与售卖"，下载的文件请于24小时内删除。

## 逆向分析记录

### 网站架构
- 后端：Z-BlogPHP
- 无前端JavaScript加密框架
- 小说详情页直接在HTML中输出城通网盘链接
- 下载链接格式：`https://urlXX.ctfile.com/f/{uid}-{fid}-{hash}?p=txtxiaoshuo`

### 城通网盘解析流程
1. 分享页URL中已包含访问密码参数 `p=txtxiaoshuo`，打开即自动通过验证
2. 无需等待倒计时即可通过 `webapi.ctfile.com/getfile.php` API获取下载信息
3. API返回JSON包含 `file.downurl` 字段即为临时直链（有时效性，约数小时）
4. 直链支持HTTP Range请求，可断点续传
