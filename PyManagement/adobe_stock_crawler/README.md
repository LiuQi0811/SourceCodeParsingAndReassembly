# Adobe Stock (stock.adobe.com/jp) 爬虫框架

## ⚠️ 重要法律声明（请务必阅读）

本代码**仅供教育与学习研究目的**使用。使用前请注意：

1. **Adobe Stock 服务条款禁止**：根据 Adobe Stock 产品专属条款第 9.4(C)(2) 条，禁止「使用自动指令码、机器人或类似技术存取或下载内容」，违规可能导致账号被封禁、IP 被封、甚至法律追责。

2. **API 访问限制**：自 2024年11月起，Adobe Stock API **仅面向 Enterprise 企业客户**开放，普通用户无法获得 API 密钥。

3. **版权保护**：Adobe Stock 上的所有图片/视频/音频素材均受版权保护，未经授权下载和使用原素材构成侵权。

4. **本框架的边界**：
   - 仅爬取**公开可访问的元数据**（标题、关键词、作者、缩略图预览链接等公开索引信息）
   - **不下载原始高清/付费素材**
   - **不绕过付费墙/登录墙**
   - **不用于批量内容囤积**（单日下载超过100个资产即被视为囤积行为）

5. **使用建议**：如需正式大规模获取 Adobe Stock 数据，请：
   - 联系 Adobe 购买 Enterprise 计划并使用官方 API
   - 加入 Adobe Affiliate Program（联盟营销计划）获得授权访问
   - 仅获取自己已购买授权的素材

## 项目结构

```
adobe_stock_crawler/
├── README.md              # 本文件 - 法律声明与使用说明
├── requirements.txt       # Python 依赖
├── config.py              # 配置文件（请求头、限速、代理等）
├── crawler_base.py        # 基础爬虫类（会话管理、限速、重试、日志）
├── search_crawler.py      # 搜索结果页爬虫（按关键词抓取素材列表）
├── category_crawler.py    # 分类页爬虫（按类别浏览抓取）
├── detail_crawler.py      # 详情页爬虫（单素材元数据提取）
├── contributor_crawler.py # 作者（贡献者）主页爬虫
├── storage.py             # 数据存储模块（CSV/JSON/SQLite）
├── main.py                # 主入口 - 命令行调度
└── utils/
    ├── __init__.py
    ├── anti_detect.py     # 反检测工具（User-Agent轮换、浏览器指纹模拟）
    └── parser.py          # HTML 解析工具
```

## 环境要求

- Python 3.8+
- 建议使用虚拟环境

## 安装

```bash
pip install -r requirements.txt
```

## 使用方法

### 1. 按关键词搜索抓取
```bash
python main.py search --keyword "東京 風景" --max-pages 5 --output results/tokyo
```

### 2. 按分类抓取
```bash
python main.py category --url "https://stock.adobe.com/jp/photos" --max-pages 3
```

### 3. 抓取单个素材详情
```bash
python main.py detail --url "https://stock.adobe.com/jp/photo/xxxxxxx"
```

### 4. 抓取作者作品集
```bash
python main.py contributor --url "https://stock.adobe.com/jp/contributor/xxxxx" --max-pages 2
```

## 反爬与限速策略

代码内置以下合规友好策略：
- 请求间隔随机延迟（2-8秒）
- User-Agent 轮换
- 真实浏览器请求头模拟
- 失败自动重试（指数退避）
- 会话复用（Cookie持久化）
- 可选代理支持
- 遵守 robots.txt 规则

## 输出数据字段

每个素材条目包含：
- `id`: Adobe Stock 素材 ID
- `title`: 标题
- `asset_type`: 类型（photo/illustration/video/audio/template等）
- `thumbnail_url`: 缩略图 URL（预览图，低分辨率带水印）
- `preview_url`: 预览图 URL
- `details_url`: 详情页链接
- `contributor_name`: 作者名
- `contributor_id`: 作者ID
- `keywords`: 关键词列表
- `category`: 分类
- `price_info`: 价格信息（公开显示部分）
- `license_type`: 授权类型
- `width`/`height`: 尺寸（详情页）
- `created_at`: 创建时间（详情页）
- `crawled_at`: 抓取时间戳

## 免责声明

使用者因违反 Adobe 服务条款或相关法律法规所造成的一切后果，由使用者自行承担，代码作者不承担任何责任。请遵守当地法律及网站服务条款，负责任地使用网络爬虫技术。
