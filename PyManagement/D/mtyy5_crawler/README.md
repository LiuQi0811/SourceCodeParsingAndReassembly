# mtyy5 全站异步爬虫

Python 3.14+ / asyncio / aiohttp，设计模式：策略 / 工厂 / 观察者。

## 安装

```bash
pip install -r requirements.txt
# 安装 ffmpeg（必需，用于视频合并）
# Windows: winget install ffmpeg
# macOS  : brew install ffmpeg
# Ubuntu : sudo apt install ffmpeg
```

## 运行

```bash
python main.py
```

## 项目结构

- `config.py`           全局配置
- `patterns/`           观察者、通用工厂
- `utils/`              编码识别、文件名净化、资源分类
- `queues/`             队列策略（memory / sqlite）
- `parsers/`            解析器（bs4 / lxml / regex）与工厂
- `downloader/`         流媒体下载器（HLS / DASH / ffmpeg）
- `engine/`             爬虫引擎
- `main.py`             入口