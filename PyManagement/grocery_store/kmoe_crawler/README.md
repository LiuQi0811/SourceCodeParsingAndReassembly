# Kmoe (kxx.moe) 全站爬虫工具

> ⚠️ **免责声明**: 本工具仅供Web技术学习研究使用。请支持正版漫画，尊重知识产权。使用本工具造成的任何法律责任由使用者自行承担。

## 项目概述

本项目是针对 kxx.moe (Kmoe) 漫画网站的全站爬虫框架，包含两种实现方案：

1. **纯HTTP爬虫** (`kmoe_crawler.py`) - 基于requests的API爬虫，已实现请求签名逆向
2. **浏览器自动化** (`browser_downloader.py`) - 基于Playwright的真人模拟方案，无需完全逆向验证码

## 目录结构

```
kmoe_crawler/
├── kmoe_crawler.py       # 主爬虫程序（元数据抓取+请求签名）
├── browser_downloader.py # 浏览器自动化下载（推荐使用）
├── captcha_handler.py    # 验证码处理模块
├── requirements.txt      # Python依赖
├── 逆向分析报告.md       # 详细的JS逆向分析文档
└── README.md            # 本文件
```

## 安装依赖

### 基础依赖（元数据抓取）
```bash
pip install -r requirements.txt
```

### 浏览器自动化（推荐，支持下载）
```bash
pip install playwright
playwright install chromium
```

### OCR验证码识别（可选）
```bash
pip install ddddocr
```

## 使用方法

### 一、元数据全站抓取

不登录也可抓取所有漫画的公开元数据：

```bash
# 抓取前10页列表+详情元数据
python kmoe_crawler.py --mode metadata --max-pages 10

# 抓取特定页码列表
python kmoe_crawler.py --mode list --start-page 5

# 查看单本详情
python kmoe_crawler.py --mode detail --book-id 25519
```

元数据将保存在 `kmoe_data/books_metadata.json`，包含：
- 漫画ID、标题、评分
- 作者、地区、语言、状态
- 封面图地址
- 简介、分类标签
- 卷列表信息
- 热度、订阅、收藏数

### 二、浏览器自动化下载（推荐）

使用Playwright模拟真实浏览器操作，自动处理动态JS，验证码时可人工介入：

```bash
# 交互模式（推荐）- 会打开浏览器，手动登录后自动下载
python browser_downloader.py --mode download --max-pages 1

# 单本下载
python browser_downloader.py --mode single --url https://kxx.moe/c/25519.htm

# 仅获取列表不下载
python browser_downloader.py --mode list --max-pages 5

# 指定下载格式
python browser_downloader.py --mode download --file-type mobi --max-books 3
```

**使用流程**:
1. 运行后自动打开Chrome浏览器
2. 如果未登录，会停在登录页，请手动完成登录
3. 按回车后程序开始自动抓取和下载
4. 如果遇到验证码，在浏览器中手动完成即可
5. 下载的文件保存在 `kmoe_downloads/` 目录

### 三、登录说明

该网站下载需要满足以下条件：
- 注册账号并登录
- 验证Kindle邮箱或手机号（Lv2权限）
- 部分内容需要VIP会员
- R18内容需要Lv3权限

## 逆向成果

已完成的逆向分析：

| 项目 | 状态 | 说明 |
|------|------|------|
| 请求签名 X-KM-FROM | ✅ 已完成 | KMOE/3.0.0(WEB) METHOD PATH |
| 列表页URL结构 | ✅ 已完成 | /l/--/{page}.htm |
| 详情页URL结构 | ✅ 已完成 | /c/{bookid}.htm |
| 下载URL格式 | ✅ 已完成 | /dl/{bookid}/{volid}/{line}/{type}/{seq}/0/ |
| 卷数据提取 | ✅ 已完成 | 从arr_voldata JS数组解析 |
| API接口 | ✅ 已完成 | data_book.php, data_list.php |
| 密码加密 | ⚠️ 待验证 | 可能为MD5或明文 |
| 验证码完整流程 | ⚠️ 部分 | 建议用浏览器方案绕过 |
| 真实CDN地址 | ⚠️ 部分 | 验证后返回 |

详细逆向过程见 `逆向分析报告.md`。

## 下载URL格式说明

```
https://kxx.moe/dl/{bookid}/{volid}/{line}/{type}/{file_count}/0/
```

参数说明：
- `bookid`: 漫画ID (如 25519)
- `volid`: 卷ID (如 1001)
- `line`: 下载线路 (0=普通线1, 1=VIP线2)
- `type`: 文件类型 (0=zip源图, 1=mobi, 2=epub, 3=推送)
- `file_count`: 文件序号 (单卷=1，批量从1递增)

示例：
- epub下载: `/dl/25519/1001/0/2/1/0/`
- mobi下载: `/dl/25519/1001/0/1/1/0/`
- 源图zip: `/dl/25519/1001/0/0/1/0/`

## 请求头签名

所有AJAX请求需要携带特殊请求头（已在爬虫中实现）：

```
X-KM-FROM: KMOE/3.0.0(WEB) GET /path
X-KM-FROM: KMOE/3.0.0(WEB) POST /path
X-KM-FROM: KMOE/3.0.0(WEB) DOWN /path
```

## 反爬应对

该网站的反爬措施：
1. **请求签名校验** - 已逆向并在爬虫中实现
2. **验证码** - 下载时触发，建议使用浏览器方案人工处理
3. **登录权限** - 下载需登录账号
4. **VIP权限** - 部分内容/线路需要VIP
5. **频率限制** - 批量下载间隔4秒，代码中已加入延时
6. **流量额度** - 普通用户有限额，VIP每月40G

## 注意事项

1. **请勿高并发请求**，建议请求间隔2-5秒
2. **支持正版**，下载的资源请于24小时内删除
3. **遵守网站规定**，不要用于商业用途
4. 大规模爬取建议使用代理IP池
5. 网站结构可能更新，如遇失效请重新逆向

## 常见问题

### Q: 为什么下载按钮点了没反应？
A: 需要登录且账号达到Lv2权限（验证邮箱或手机）。

### Q: 如何处理验证码？
A: 推荐使用 `browser_downloader.py`，遇到验证码时在弹出的浏览器中手动完成即可。

### Q: 元数据可以不登录抓取吗？
A: 可以，列表和详情页的公开信息不需要登录。

### Q: 为什么有些漫画下载不了？
A: 可能是需要VIP、需要Lv3权限(R18)、或文件正在制作中。

## 法律声明

本项目仅用于Web安全技术和爬虫技术的学习研究。使用者应当遵守当地法律法规，尊重版权方合法权益。作者不对滥用本工具造成的任何后果承担责任。
