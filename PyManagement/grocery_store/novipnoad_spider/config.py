#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
novipnoad.net 全站爬虫 - 配置文件
"""
import os

# ======================== 基础配置 ========================
BASE_URL = "https://www.novipnoad.net"
# 备用域名（该站经常换域名）
ALT_DOMAINS = [
    "https://www.novipnoad.com",
    "https://www.novipnoad.me",
    "https://www.novipnoad.uk",
    "https://www.novipnoad.us",
]

# 保存目录
SAVE_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "downloads")
HTML_DIR = os.path.join(SAVE_DIR, "html")
VIDEO_DIR = os.path.join(SAVE_DIR, "videos")
IMAGE_DIR = os.path.join(SAVE_DIR, "images")
LOG_DIR = os.path.join(SAVE_DIR, "logs")
DB_PATH = os.path.join(SAVE_DIR, "spider.db")

# 请求头
HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
    "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
    "Accept-Encoding": "gzip, deflate, br",
    "Connection": "keep-alive",
    "Upgrade-Insecure-Requests": "1",
    "Sec-Fetch-Dest": "document",
    "Sec-Fetch-Mode": "navigate",
    "Sec-Fetch-Site": "none",
    "Sec-Fetch-User": "?1",
    "Cache-Control": "max-age=0",
}

# ======================== 爬虫配置 ========================
# 并发数
MAX_WORKERS = 5
# 请求间隔（秒）
REQUEST_DELAY = (1, 3)  # 随机延迟范围
# 超时
TIMEOUT = 30
# 重试次数
MAX_RETRIES = 5
# 是否使用代理
USE_PROXY = False
PROXY = None  # 例: "http://127.0.0.1:7890"

# ======================== 视频下载配置 ========================
# 并发下载分片数
M3U8_CONCURRENT = 16
# 视频分片超时
SEGMENT_TIMEOUT = 30
# 是否下载视频
DOWNLOAD_VIDEOS = False  # 默认只爬取页面和元数据，避免大流量
# 视频最大清晰度: 1080p, 720p, 480p, 360p
PREFERRED_QUALITY = "1080p"

# ======================== 分类配置 ========================
CATEGORIES = {
    "tv": "电视剧",
    "movie": "电影",
    "anime": "动漫",
    "variety": "综艺",
    "drama": "日剧",
    "korea": "韩剧",
    "us": "美剧",
    "thailand": "泰剧",
    "hk": "港剧",
    "tw": "台剧",
}

# ======================== Cloudflare 配置 ========================
# 使用 undetected-chromedriver 绕过 CF
USE_BROWSER_CF_BYPASS = True
# 如果 cloudscraper 失败，回退到浏览器模式
FALLBACK_TO_BROWSER = True

# ======================== 解密配置 ========================
# 视频接口通常加密，以下为常见解密密钥（根据实际响应动态调整）
# 若网站使用 CryptoJS 加密，在此配置密钥和 IV
CRYPTO_KEYS = {
    "default_key": "NHZ3DdJm9aKsxQ2t",  # 示例密钥，实际会自动提取
    "default_iv": "0123456789abcdef",
}
