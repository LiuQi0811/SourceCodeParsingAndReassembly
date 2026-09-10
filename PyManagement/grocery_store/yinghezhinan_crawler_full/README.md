# 硬核指南全站抓取工具使用说明

## 📋 项目说明

本工具用于抓取 **硬核指南 (https://yinghezhinan.com/)** 导航网站的所有资源信息，
支持导出多种格式方便使用。

## 🚀 快速开始

### 环境要求
- Python 3.7+
- requests
- beautifulsoup4

### 安装依赖
```bash
pip install requests beautifulsoup4 pandas openpyxl
```
- pandas/openpyxl 可选，用于导出Excel格式

### 运行爬虫
```bash
python yinghezhinan_crawler.py
```

## 📁 输出文件

运行后会在 `yinghezhinan_data_YYYYMMDD/` 目录下生成以下文件：

| 文件 | 格式 | 说明 |
|------|------|------|
| `yinghezhinan_all.json` | JSON | 完整结构化数据，包含所有字段 |
| `yinghezhinan_all.csv` | CSV | 逗号分隔表格，可用Excel直接打开 |
| `硬核指南导航大全.md` | Markdown | 按分类整理的导航文档 |
| `index.html` | HTML | 可直接浏览器打开的离线导航页面（美观卡片式） |

## 📊 数据字段说明

每条资源包含以下信息：

| 字段 | 说明 |
|------|------|
| id | 资源编号 |
| name | 网站/软件名称 |
| url | 官方网址 |
| description | 功能简介 |
| icon | 图标地址 |
| category | 所属分类 |
| platforms | 支持平台（Android/iOS/TV/PC/Windows/macOS/Linux等） |
| is_new | 是否为新品 |
| is_hot | 是否热门 |

## 🔧 功能特性

1. **自动发现分类** - 自动识别并遍历所有分类页面
2. **分页支持** - 自动翻页抓取分类下所有内容
3. **自动去重** - 自动过滤重复的网站链接
4. **请求延迟** - 内置延时，避免给服务器造成压力
5. **多种导出格式** - JSON/CSV/Markdown/HTML一次全部生成
6. **静态抓取优先** - 优先使用轻量级requests抓取
7. **可扩展动态渲染** - 代码预留Playwright动态渲染接口

## 📂 主要分类

- 🎬 视频：在线影视追剧网站、APP
- 🎮 二次元：动漫、漫画追番平台
- 🎵 音乐：听歌、无损音乐下载工具
- 📚 阅读：电子书、小说、古籍资源
- 🎮 游戏：单机、Switch、VR游戏下载
- 📺 娱乐：电视直播、壁纸
- 🧰 工具箱：AI助手、视频音频处理、办公工具
- 💰 省钱助手：外卖、打车优惠券
- 🔗 友情链接：其他优质导航站

## ⚠️ 注意事项

1. 本工具仅供学习交流使用
2. 抓取时请遵守网站robots.txt规则
3. 资源版权归各网站所有，请支持正版
4. 如网站改版导致抓取失败，可根据实际HTML结构调整选择器

## 🎨 HTML预览

生成的 `index.html` 是一个精美的响应式导航页面：
- 卡片式布局，支持搜索分类跳转
- 图标展示，悬停动画效果
- 移动端自适应
- 可直接双击在浏览器打开使用

---
*数据抓取时间：见各文件内元数据*
