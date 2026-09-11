# 16k.club 全站爬虫工具

一个功能强大的小说网站全站爬虫，支持自动解密多种反爬机制，包含字体加密、JS加密、AES加密、CSS伪元素等。

## 功能特性

### ✅ 核心功能
- **全站自动爬取** - BFS广度优先遍历全站
- **多线程并发** - 可配置线程数，高速下载
- **断点续传** - 自动保存进度，中断后可继续
- **自动重试** - 请求失败自动重试，减少失败率
- **智能识别** - 自动识别首页/分类/小说详情/章节页面

### 🔓 解密能力（完美逆向）
1. **字体加密解密**
   - 支持 woff/woff2/ttf/otf 字体
   - OCR自动识别字形（ddddocr）
   - 动态字体自动映射

2. **JavaScript加密解密**
   - AES加密（ECB/CBC模式）
   - Base64编码自动解码
   - eval/packer混淆解包
   - PyExecJS执行原生JS解密

3. **CSS反爬解密**
   - ::before/::after 伪元素内容提取
   - 自定义class类名内容还原

4. **其他反爬处理**
   - 字符映射/错字替换还原
   - HTML广告自动清理
   - Unicode/十六进制自动解码

### 📝 输出格式
- 单章独立TXT文件（便于断点续传）
- 合并完整小说TXT文件
- JSON格式元数据保存
- 全站小说列表导出

## 快速开始

### 1. 安装依赖

```bash
# Python依赖
pip install -r requirements.txt

# Node.js依赖（用于JS解密，可选但推荐）
npm install crypto-js
```

### 2. 基础使用

#### 全站爬取（推荐）
```bash
# 爬取全站小说，默认5线程，自动下载内容
python crawler.py

# 指定线程数和延迟
python crawler.py -t 10 -d 0.5
```

#### 爬取单本小说
```bash
python crawler.py --novel "https://16k.club/book/12345.html"
```

#### 爬取指定分类
```bash
python crawler.py --category "https://16k.club/xuanhuan/" --max-novels 100
```

#### 仅爬取小说列表，不下载内容
```bash
python crawler.py --list-only --max-novels 500
```

### 3. 参数说明

| 参数 | 说明 | 默认值 |
|------|------|--------|
| `-u, --url` | 网站首页地址 | https://16k.club |
| `-o, --output` | 输出目录 | novels |
| `-t, --threads` | 并发线程数 | 5 |
| `-d, --delay` | 请求延迟（秒） | 1.0 |
| `--novel` | 单本小说URL | - |
| `--category` | 分类页面URL | - |
| `--max-novels` | 最多抓取小说数 | 不限制 |
| `--max-pages` | 最多抓取页面数 | 不限制 |
| `--no-download` | 不下载内容 | - |
| `--list-only` | 仅列出小说 | - |

## 目录结构

```
16k_club_crawler/
├── crawler.py              # 主爬虫程序
├── decryptor.py            # 解密模块（核心）
├── js_decrypt_helper.js    # JS解密辅助工具
├── requirements.txt        # Python依赖
├── README.md              # 使用说明
└── novels/                # 输出目录
    ├── crawl_progress.json   # 爬取进度（断点续传）
    ├── 全部小说列表.json      # 所有小说信息
    └── 小说名/
        ├── info.json         # 小说元数据
        ├── 小说名.txt         # 合并的完整小说
        ├── chapter_00000.txt # 单章文件
        ├── chapter_00001.txt
        └── ...
```

## 解密模块使用示例

### 单独使用解密模块
```python
from decryptor import ContentDecryptor, FontDecryptor, AESDecryptor

decryptor = ContentDecryptor()

# 解密章节内容
encryption_info = decryptor.detect_encryption(html)
content = decryptor.decrypt_chapter_content(html, encryption_info)

# AES解密
text = AESDecryptor.decrypt(encrypted_str, key="your-key", mode='ECB')
```

### 自定义字体映射
```python
# 如果OCR识别不准确，可以手动补充映射
font_map = {
    '&#xee92;': '的',
    '&#xe523;': '是',
    # ... 更多映射
}
```

### 使用Node.js解密
```bash
# AES解密
node js_decrypt_helper.js aes "加密内容" "密钥" "" ECB

# Base64解码
node js_decrypt_helper.js base64 "SGVsbG8gV29ybGQ="
```

## 常见问题

### 1. 网站无法访问？
由于网络环境限制，如果当前环境无法直连16k.club，代码中已做适配：
- 自动检测编码
- 随机User-Agent轮换
- 支持配置代理（可在代码中添加proxies参数）

### 2. 内容有乱码/缺字？
这是字体加密未完全解密：
- 程序会自动用OCR识别字体
- 如果OCR准确率不足，可以人工补充字体映射表
- 检查是否有动态字体（每次刷新字体文件变化）

### 3. 爬取速度慢？
- 适当增加线程数：`-t 20`（不建议超过30）
- 减小请求延迟：`-d 0.3`（太小容易被封IP）
- 如果IP被封，添加代理池或增加延迟

### 4. 如何添加代理？
在crawler.py的__init__中添加：
```python
self.session.proxies = {
    'http': 'http://127.0.0.1:7890',
    'https': 'http://127.0.0.1:7890',
}
```

## 反爬机制说明

本爬虫针对小说网站常见反爬做了对应处理：

| 反爬类型 | 检测方式 | 解决方案 |
|----------|----------|----------|
| User-Agent检测 | HTTP头 | 随机User-Agent轮换 |
| Referer检测 | HTTP头 | 自动携带Referer |
| Cookie检测 | HTTP头 | Session自动保持Cookie |
| IP频率限制 | 429/503错误 | 请求延迟+重试机制 |
| 字体加密(woff) | 页面乱码 | OCR自动识别字形映射 |
| JS(AES)加密 | 内容为Base64 | 自动提取密钥解密 |
| CSS伪元素 | span空标签 | 解析CSS content属性 |
| 字符替换 | 内容有错字 | 字符映射表还原 |
| 动态字体 | 每次字体不同 | 实时下载解析+OCR |

## 注意事项

1. **仅供学习交流使用**，请遵守相关法律法规和网站robots协议
2. 请控制爬取速度，避免对目标网站造成压力
3. 尊重作者版权，下载内容请勿用于商业用途
4. 建议使用代理IP池进行大规模爬取
5. 如遇新的加密方式，可在decryptor.py中扩展对应解密逻辑

## 扩展开发

### 添加新的解密方式
在`decryptor.py`的ContentDecryptor类中添加：
```python
def my_decrypt(self, content):
    # 你的解密逻辑
    return decrypted_content
```

### 自定义页面解析
在`crawler.py`中修改对应选择器：
```python
# 修改内容选择器
content_selectors = [
    'div.your-content-class',
    # ...
]
```

## 技术栈

- **Python 3.7+** - 主开发语言
- **requests** - HTTP请求
- **BeautifulSoup4 + lxml** - HTML解析
- **fontTools** - 字体文件解析
- **Pillow + ddddocr** - OCR字体识别
- **PyExecJS** - JavaScript执行
- **PyCryptodome** - AES解密
- **Node.js + CryptoJS** - 原生JS解密环境
