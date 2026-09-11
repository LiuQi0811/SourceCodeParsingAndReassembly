# English e-Reader 全站电子书镜像

来源：https://english-e-reader.net/

## 内容统计
- **书籍总数**：565 本英文分级读物（A1 ~ C2 共 8 个级别）
- **文件格式**：epub、mobi、fb2、rtf、txt 五种格式（共 2824 个电子书文件）
- **封面图片**：565 张封面
- **总大小**：约 207 MB

## 目录结构
```
books/
├── starter/            # A1 入门级 (71本)
├── elementary/         # A2 初级 (210本)
├── pre-intermediate/   # B1 中初级 (133本)
├── intermediate/       # B1+ 中级 (40本)
├── intermediate-plus/  # B2 中高级 (56本)
├── upper-intermediate/ # B2+ 高中级 (15本)
├── advanced/           # C1 高级 (36本)
├── unabridged/         # C2 原版 (4本)
├── covers/             # 全部书籍封面图
├── books_index.json    # 书籍元数据索引（标题/作者/级别/简介/标签/字数等）
└── download_progress.json  # 下载进度（断点续传用）
```

## 关于网站加密
经过对该站的逆向分析，**全站内容没有任何加密**：
- 电子书下载链接为公开直链，格式为 `/download?link=<book-slug>&format=<epub|mobi|fb2|rtf|txt>`
- 服务器返回 302 重定向到真实文件 CDN 地址（`/booklink/<token>/...`），token 由服务器临时签发，
  但 HTTP 客户端自动跟随重定向即可下载，**无需逆向、无需登录、无需解密**。
- 在线阅读器页面正文也直接以 HTML 返回，无 JS 解密/字体反爬。

## 爬虫脚本
`english_ereader_crawler.py` —— 可重复运行的全站爬虫，特性：
- 自动爬取所有级别列表页 + 书籍详情页（标题、作者、简介、标签、字数、难度）
- 并发下载（默认 8 线程）、随机延时、自动重试（3次）
- 断点续传：已下载文件自动跳过，中断后重跑即可继续
- 线程独立 Session，避免 cookie 冲突
- 封面一并下载

### 重新运行（用于增量更新/补漏）
```bash
cd english-e-reader
python3 english_ereader_crawler.py
```
依赖：`pip install requests beautifulsoup4`
