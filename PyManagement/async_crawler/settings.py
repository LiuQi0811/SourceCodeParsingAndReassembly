# settings.py
from typing import List

# ====================== 爬虫全局配置 ======================
# 全局最大并发
GLOBAL_SEM: int = 10
# 每个域名最大并发
DOMAIN_SEM: int = 3
# 请求超时 (连接超时, 读取超时)
TIMEOUT_CONNECT: int = 10
TIMEOUT_READ: int = 30
# 请求重试配置
MAX_RETRY: int = 3
RETRY_DELAY_BASE: float = 1.0  # 指数退避基数
# 资源保存根目录
SAVE_ROOT = "./crawl_resources"
# UA池
UA_POOL: List[str] = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
]
# 是否启用代理池
USE_PROXY_POOL = False
# 代理池地址列表
PROXY_LIST: List[str] = [
    # "http://127.0.0.1:7890"
]
# 响应体最大大小，防止超大页面OOM，单位 byte
MAX_RESPONSE_SIZE = 10 * 1024 * 1024

# 域名默认RPS令牌桶配置
DOMAIN_DEFAULT_RPS = 2.0
DOMAIN_DEFAULT_BURST = 2.0

# ====================== HLS (m3u8) 配置 ======================
# ffmpeg 可执行文件路径(系统 PATH 中可找到时直接用 "ffmpeg")
FFMPEG_PATH = "ffmpeg"
# 单个 m3u8 内 ts 分片并发下载数
M3U8_TS_CONCURRENCY = 8
# 单个 ts 分片最大字节数(防止异常大分片拖垮内存)
M3U8_TS_MAX_SIZE = 100 * 1024 * 1024
# 合并后是否保留 ts 分片(默认清理)
M3U8_KEEP_TS_SEGMENTS = False

# ====================== B 站配置 ======================
# SESSDATA cookie:登录态凭据,用于下载高清(1080P+/4K)和会员视频
# 获取方式:登录 bilibili.com → 浏览器开发者工具 → Application → Cookies → SESSDATA
# 留空仅能下载公开免费内容(360P/480P 等低清晰度)
# 仅用于下载你自己有权访问的内容,遵守平台服务条款
BILIBILI_SESSDATA = ""
