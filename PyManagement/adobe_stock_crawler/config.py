"""
Adobe Stock 爬虫配置文件
"""
import os
from pathlib import Path

# ============================================================
# 基础配置
# ============================================================
BASE_URL = "https://stock.adobe.com/jp"
SEARCH_URL = f"{BASE_URL}/search"
OUTPUT_DIR = Path("output")
OUTPUT_DIR.mkdir(exist_ok=True)

# ============================================================
# 合规限速配置（请不要调低这些值）
# ============================================================
# 请求之间的随机延迟范围（秒）- 过低会触发封禁
MIN_DELAY = 2.0
MAX_DELAY = 8.0
# 单批次最大请求数（防止被判定为囤积行为）
MAX_REQUESTS_PER_SESSION = 50
# 每批次之间的休息时间（秒）
BATCH_REST_INTERVAL = 60
# 最大重试次数
MAX_RETRIES = 3
# 请求超时（秒）
REQUEST_TIMEOUT = 30

# ============================================================
# 请求头与反检测配置
# ============================================================
# 参考真实 Chrome 浏览器请求头
DEFAULT_HEADERS = {
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
    "Accept-Language": "ja,en-US;q=0.9,en;q=0.8,zh-CN;q=0.7,zh;q=0.6",
    "Accept-Encoding": "gzip, deflate, br",
    "Connection": "keep-alive",
    "Upgrade-Insecure-Requests": "1",
    "Sec-Fetch-Dest": "document",
    "Sec-Fetch-Mode": "navigate",
    "Sec-Fetch-Site": "none",
    "Sec-Fetch-User": "?1",
    "Sec-Ch-Ua": '"Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"',
    "Sec-Ch-Ua-Mobile": "?0",
    "Sec-Ch-Ua-Platform": '"Windows"',
    "DNT": "1",
}

# 备用 User-Agent 列表（fake-useragent 不可用时使用）
FALLBACK_USER_AGENTS = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Safari/605.1.15",
]

# ============================================================
# 代理配置（可选）
# ============================================================
# 格式："http://user:pass@host:port" 或 "http://host:port"
# 留空则不使用代理
HTTP_PROXY = os.getenv("HTTP_PROXY", "")
HTTPS_PROXY = os.getenv("HTTPS_PROXY", "")
PROXIES = {}
if HTTP_PROXY:
    PROXIES["http"] = HTTP_PROXY
if HTTPS_PROXY:
    PROXIES["https"] = HTTPS_PROXY

# ============================================================
# 浏览器自动化配置（用于绕过 Cloudflare）
# ============================================================
USE_SELENIUM = os.getenv("USE_SELENIUM", "false").lower() == "true"
HEADLESS = os.getenv("HEADLESS", "true").lower() == "true"
CHROME_DRIVER_PATH = os.getenv("CHROME_DRIVER_PATH", "")

# ============================================================
# 搜索参数配置
# ============================================================
# 素材类型映射
ASSET_TYPES = {
    "photos": "photos",
    "illustrations": "illustrations",
    "vectors": "vectors",
    "videos": "videos",
    "audio": "audio",
    "templates": "templates",
    "3d": "3d-assets",
    "free": "free",
}

# 排序方式
SORT_OPTIONS = {
    "relevance": "relevance",
    "newest": "newest",
    "popular": "popular",
    "price_asc": "price-asc",
    "price_desc": "price-desc",
    "undiscovered": "undiscovered",
}

# 每页结果数（Adobe Stock 通常每页约 100+ 个结果）
ITEMS_PER_PAGE = 100

# ============================================================
# 数据存储配置
# ============================================================
STORAGE_FORMAT = "json"  # json / csv / sqlite
DATABASE_PATH = OUTPUT_DIR / "adobe_stock.db"
SAVE_THUMBNAILS = False  # 是否保存缩略图（不建议，注意版权）
