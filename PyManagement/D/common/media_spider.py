import asyncio
import hashlib
import os
import re
import subprocess
import functools
from abc import ABC, abstractmethod
from typing import Set, List, Optional, Dict, Callable
from urllib.parse import urljoin, urlparse, unquote

import aiohttp
from bs4 import BeautifulSoup
from playwright.async_api import Browser, async_playwright, Page, Response


# ------------------------------
# 异步重试装饰器
# ------------------------------
def async_retry(max_retries: int = 2, delay: float = 1.0):
    def decorator(func: Callable):
        @functools.wraps(func)
        async def wrapper(*args, **kwargs):
            last_exception = None
            for attempt in range(max_retries + 1):
                try:
                    return await func(*args, **kwargs)
                except Exception as e:
                    last_exception = e
                    if attempt >= max_retries:
                        break
                    await asyncio.sleep(delay)
            if last_exception is not None:
                print(f"[async_retry] {func.__name__} 重试 {max_retries + 1} 次后仍失败: "
                      f"{type(last_exception).__name__}: {last_exception}")
            return None
        return wrapper
    return decorator


# ------------------------------
# 媒体类型分类：收集与下载共用
# ------------------------------
MEDIA_EXTENSIONS: Dict[str, Set[str]] = {
    "image": {".jpg", ".jpeg", ".png", ".gif", ".webp", ".bmp", ".svg", ".ico", ".avif", ".jfif"},
    "video": {".mp4", ".webm", ".mov", ".m4v", ".mkv", ".avi", ".flv", ".ts", ".m3u8", ".wmv", ".mpg", ".mpeg"},
    "audio": {".mp3", ".wav", ".aac", ".flac", ".ogg", ".m4a", ".wma", ".opus", ".amr", ".aiff"},
    "document": {".pdf", ".doc", ".docx", ".xls", ".xlsx", ".ppt", ".pptx", ".txt", ".zip", ".rar", ".7z", ".epub", ".csv", ".md"},
}
# 全部媒体后缀（网络监听用）
MEDIA_SUFFIXES: Set[str] = set().union(*MEDIA_EXTENSIONS.values())

# 懒加载图片属性（按优先级取第一个非空）
LAZY_IMAGE_ATTRS = ("data-echo", "data-src", "data-original", "data-lazy-src", "data-lazy", "data-url", "data-image")
# 占位图：src 仅为占位时不作为有效资源
PLACEHOLDER_RE = re.compile(r"(?:blank|loading|placeholder|spacer|1x1|pixel)\.(?:gif|png|jpe?g)", re.I)

# 分页 URL 识别（路径形态）：/xxx/index_2.html、/xxx/page_2.html、/xxx_2.html、/list/page/2/、/list/2/
# 注意 [_-][1-9] 排除 etagid345-0 这类以 -0 结尾的标签/详情页误判；/sucai/50/ 分类ID不匹配
PAGINATION_RE = re.compile(
    r"(?:index[_-]?\d+|page[_-]?\d+|[_-][1-9]\d*|/page/\d+|/p/\d+|/list/\d+)(?:\.\w+)?/?$",
    re.I,
)
# 分页 URL 识别（查询参数形态）：?page=2、?p=2、?pn=2、?pageNum=2、?page_no=2 等
PAGINATION_QUERY_RE = re.compile(r"(?:^|[?&])(?:page|p|pn|pageNum|page_no|pageindex|pageno)=\d+", re.I)


def is_pagination_url(url: str, extra_patterns: Optional[List[str]] = None) -> bool:
    """判断 URL 是否为分页页（index_N.html / page_N / ?page=N / /page/N/ 等）。

    extra_patterns: 站点特有分页形态的自定义正则列表（作用于完整 URL）。
    """
    try:
        parsed = urlparse(url)
    except ValueError:
        return False
    if PAGINATION_RE.search(parsed.path):
        return True
    if PAGINATION_QUERY_RE.search(parsed.query):
        return True
    if extra_patterns:
        for pat in extra_patterns:
            try:
                if re.search(pat, url, re.I):
                    return True
            except re.error:
                continue
    return False


def categorize_url(url: str) -> Optional[str]:
    """按 URL 路径后缀识别媒体类别；无法识别返回 None"""
    try:
        path = urlparse(url).path
    except ValueError:
        return None
    ext = os.path.splitext(path)[1].lower()
    for category, exts in MEDIA_EXTENSIONS.items():
        if ext in exts:
            return category
    return None


# ------------------------------
# 失败URL管理器：记录+加载用于补爬
# ------------------------------
class FailUrlManager:
    def __init__(self, file_path: str = "fail_urls.txt"):
        self.file_path = file_path

    def record_fail(self, url: str, reason: str):
        with open(self.file_path, "a", encoding="utf-8") as f:
            f.write(f"{url} | {reason}\n")

    def load_failed_urls(self) -> List[str]:
        urls = []
        try:
            with open(self.file_path, "r", encoding="utf-8") as f:
                for line in f:
                    line = line.strip()
                    if "|" in line:
                        u, _ = line.split("|", maxsplit=1)
                        urls.append(u.strip())
        except FileNotFoundError:
            pass
        return urls


# ------------------------------
# HTML有效性校验：过滤JS骨架空白页面
# ------------------------------
def is_html_valid(html: Optional[str]) -> bool:
    if not html:
        return False
    if len(html) < 300:
        return False
    if "<body" not in html.lower():
        return False
    return True


# ------------------------------
# 策略模式：抓取器抽象
# ------------------------------
class BaseFetcher(ABC):
    @abstractmethod
    async def fetch(self, url: str) -> Optional[str]:
        pass


class RequestsFetcher(BaseFetcher):
    def __init__(self, headers: Dict, timeout: int, proxy: Optional[str] = None):
        self.headers = headers
        self.timeout = timeout
        self.proxy = proxy

    @async_retry(max_retries=2, delay=1.2)
    async def fetch(self, url: str) -> Optional[str]:
        async with aiohttp.ClientSession() as session:
            async with session.get(
                url,
                headers=self.headers,
                proxy=self.proxy or None,
                timeout=aiohttp.ClientTimeout(total=self.timeout),
                allow_redirects=True
            ) as resp:
                if resp.status == 404:
                    return None
                if resp.status >= 400:
                    raise Exception(f"Http status:{resp.status}")
                return await resp.text(encoding="utf-8", errors="ignore")


class PlaywrightFetcher(BaseFetcher):
    """纯异步playwright，返回page对象，支持网络抓媒体请求"""
    def __init__(
        self,
        headers: Dict,
        timeout: int,
        browser: Browser,
        net_media_set: Set[str],
        proxy: Optional[str] = None,
        cookies: Optional[str] = None,
        referer: Optional[str] = None,
    ):
        self.ua = headers.get("User-Agent", "")
        self.timeout = timeout
        self.browser = browser
        self._net_media_set = net_media_set  # 外部传入集合，收集网络捕获媒体
        self.proxy = proxy
        self.cookie_str = cookies or ""
        self.referer = referer

    async def fetch(self, url: str) -> Optional[str]:
        raise NotImplementedError("请使用 fetch_with_page 替代 fetch")

    @async_retry(max_retries=1, delay=2.0)
    async def fetch_with_page(self, url: str) -> Optional[Page]:
        page: Optional[Page] = None
        try:
            page_args = {"user_agent": self.ua}
            if self.proxy:
                page_args["proxy"] = {"server": self.proxy}
            page = await self.browser.new_page(**page_args)

            # 注入 Cookie 与防盗链 Referer（登录态/来源站场景）
            if self.cookie_str:
                cookies = []
                for part in self.cookie_str.split(";"):
                    part = part.strip()
                    if "=" in part:
                        k, v = part.split("=", maxsplit=1)
                        cookies.append({"name": k.strip(), "value": v.strip(), "url": url})
                if cookies:
                    await page.context.add_cookies(cookies)
            if self.referer:
                page.set_default_http_headers({"Referer": self.referer})

            # 注册网络响应监听，捕获媒体资源（图片/视频/音频/文档）
            def on_response(resp: Response):
                u = resp.url
                if not u.startswith(("http://", "https://")):
                    return
                lower_url = u.lower()
                if any(suffix in lower_url for suffix in MEDIA_SUFFIXES):
                    self._net_media_set.add(u)

            page.on("response", on_response)

            await page.goto(url, timeout=self.timeout * 1000)
            await page.wait_for_load_state("networkidle", timeout=self.timeout*1000)
            await page.wait_for_timeout(1800)  # 延长等待，给分片请求完成时间
            return page
        except Exception:
            if page:
                await page.close()
            raise  # 抛出给 async_retry 触发重试，避免重试装饰器形同虚设


# ------------------------------
# URL管理器：规范化、同域判断、去重（每个爬虫实例独立，避免多实例状态污染）
# ------------------------------
class UrlManager:
    def __init__(self, base_domain: str):
        self.base_domain = base_domain
        self.visited: Set[str] = set()

    def normalize_url(self, url: str) -> str:
        url = urljoin(self.base_domain, url)
        return re.sub(r"#.*$", "", url)

    def is_same_domain(self, url: str) -> bool:
        p1 = urlparse(url)
        p2 = urlparse(self.base_domain)
        return p1.netloc == p2.netloc

    def is_visited(self, url: str) -> bool:
        return url in self.visited

    def mark_visited(self, url: str):
        self.visited.add(url)


# ------------------------------
# 抓取器工厂
# ------------------------------
class FetcherFactory:
    @staticmethod
    def get_static_fetcher(headers: Dict, timeout: int, proxy: Optional[str] = None) -> RequestsFetcher:
        return RequestsFetcher(headers, timeout, proxy)

    @staticmethod
    def get_dynamic_fetcher(
        headers: Dict,
        timeout: int,
        browser: Browser,
        net_video_set: Set[str],
        proxy: Optional[str] = None,
        cookies: Optional[str] = None,
        referer: Optional[str] = None,
    ) -> PlaywrightFetcher:
        return PlaywrightFetcher(headers, timeout, browser, net_video_set, proxy, cookies, referer)


# ------------------------------
# 页面解析器：DOM提取图片、视频，支持iframe
# ------------------------------
class PageParser:
    @staticmethod
    def extract_media_from_html(html: str, base_domain: str) -> Dict[str, Set[str]]:
        """静态提取四类媒体：图片/视频/音频/文档(a标签链接)，返回 {类别: URL集合}"""
        result: Dict[str, Set[str]] = {cat: set() for cat in MEDIA_EXTENSIONS}
        soup = BeautifulSoup(html, "lxml")

        # 图片（支持懒加载属性 data-echo/data-src 等；src 为占位图时忽略）
        for img in soup.find_all("img"):
            src = (img.get("src") or "").strip()
            lazy = next((img.get(attr, "").strip() for attr in LAZY_IMAGE_ATTRS if img.get(attr)), "")
            if lazy:
                src = lazy
            if not src or src.startswith("data:") or PLACEHOLDER_RE.search(src):
                continue
            full = urljoin(base_domain, src)
            if full.startswith(("http://", "https://")):
                result["image"].add(full)

        # video / audio / source（source 归属由父标签决定）
        for tag in soup.find_all(["video", "audio", "source"], src=True):
            src = tag["src"].strip()
            if src.startswith("data:"):
                continue
            full = urljoin(base_domain, src)
            if not full.startswith(("http://", "https://")):
                continue
            if tag.name == "video":
                result["video"].add(full)
            elif tag.name == "audio":
                result["audio"].add(full)
            else:  # source
                parent = tag.parent.name if tag.parent else ""
                if parent == "audio":
                    result["audio"].add(full)
                elif parent == "video":
                    result["video"].add(full)
                else:
                    cat = categorize_url(full)
                    if cat:
                        result[cat].add(full)

        # 文档链接（a 标签指向文档后缀）
        for a_tag in soup.find_all("a", href=True):
            href = a_tag["href"].strip()
            full = urljoin(base_domain, href)
            if not full.startswith(("http://", "https://")):
                continue
            if categorize_url(full) == "document":
                result["document"].add(full)
        return result

    @staticmethod
    async def extract_media_from_page(page: Page, base_url: str) -> Dict[str, Set[str]]:
        """playwright JS读取DOM，捕获动态渲染+iframe媒体（图片/视频/音频）"""
        result = await page.evaluate("""() => {
            const imgs = new Set();
            const videos = new Set();
            const audios = new Set();
            const addMedia = (el, set) => {
                const s = el.getAttribute('data-echo') || el.getAttribute('data-src') ||
                          el.getAttribute('data-original') || el.src || '';
                if (s && !s.startsWith('data:') &&
                    !/(blank|loading|placeholder|spacer|1x1|pixel)\\.(gif|png|jpe?g)/i.test(s)) set.add(s);
            };
            const scan = (root) => {
                root.querySelectorAll('img[src]').forEach(el=>addMedia(el, imgs));
                root.querySelectorAll('video[src]').forEach(el=>addMedia(el, videos));
                root.querySelectorAll('audio[src]').forEach(el=>addMedia(el, audios));
                root.querySelectorAll('source[src]').forEach(el=>{
                    const p = el.parentElement ? el.parentElement.tagName.toLowerCase() : '';
                    if (p === 'audio') addMedia(el, audios); else addMedia(el, videos);
                });
            };
            scan(document);
            document.querySelectorAll('iframe').forEach(iframe=>{
                try{
                    const idoc = iframe.contentDocument || iframe.contentWindow.document;
                    scan(idoc);
                }catch(e){}
            });
            return {imgs:Array.from(imgs), videos:Array.from(videos), audios:Array.from(audios)};
        }""")
        output: Dict[str, Set[str]] = {cat: set() for cat in MEDIA_EXTENSIONS}
        for key, cat in (("imgs", "image"), ("videos", "video"), ("audios", "audio")):
            for u in result.get(key, []):
                if u.startswith(("http://", "https://")):
                    output[cat].add(u)
        return output

    @staticmethod
    def extract_links_from_html(html: str, base_domain: str) -> List[str]:
        soup = BeautifulSoup(html, "lxml")
        links = []
        for a_tag in soup.find_all("a", href=True):
            href = a_tag["href"]
            full = urljoin(base_domain, href)
            links.append(full)
        return links


# ------------------------------
# 媒体下载器：四类资源流式下载；m3u8 用 ffmpeg 合并转封装
# ------------------------------
class MediaDownloader:
    def __init__(
        self,
        headers: Dict,
        timeout: int = 30,
        concurrency: int = 3,
        download_dir: str = "download",
        ffmpeg_bin: str = "ffmpeg",
        use_ffmpeg: bool = True,
        m3u8_timeout: int = 600,
        referer: Optional[str] = None,
        proxy: Optional[str] = None,
        rate_limit: int = 0,
        min_resource_size: int = 0,
    ):
        self.headers = headers
        if referer:
            self.headers = dict(headers)
            self.headers["Referer"] = referer  # 防盗链：资源请求携带站内来源
        self.timeout = timeout
        self.sem = asyncio.Semaphore(concurrency)
        self.download_dir = download_dir
        self.ffmpeg_bin = ffmpeg_bin
        self.use_ffmpeg = use_ffmpeg
        self.m3u8_timeout = m3u8_timeout
        self.proxy = proxy            # 下载代理
        self.rate_limit = rate_limit  # 单下载限速 bytes/s，0=不限
        self.min_resource_size = min_resource_size  # 最小资源字节，0=不限制
        # ffmpeg -headers 参数（把 UA/Referer/Cookie 带给 m3u8 分片请求，防盗链）
        self.ffmpeg_headers = "".join(f"{k}: {v}\r\n" for k, v in self.headers.items())
        self.stats = {"success": 0, "skipped": 0, "failed": 0}
        self.failed_urls: List[str] = []

    def _dest_path(self, url: str, category: str) -> str:
        dir_path = os.path.join(self.download_dir, category)
        os.makedirs(dir_path, exist_ok=True)
        path = unquote(urlparse(url).path)
        name = os.path.basename(path)
        if not name or "." not in name:
            ext = os.path.splitext(path)[1]
            name = hashlib.md5(url.encode("utf-8")).hexdigest()[:12] + ext
        name = re.sub(r'[\\/:*?"<>|\s]+', "_", name)
        if len(name) > 180:  # 文件名超长时降级为 hash 命名，避免路径过长
            ext = os.path.splitext(name)[1]
            name = hashlib.md5(url.encode("utf-8")).hexdigest()[:12] + ext
        return os.path.join(dir_path, name)

    @async_retry(max_retries=2, delay=1.5)
    async def _download_binary(self, url: str, dest: str) -> bool:
        """流式下载单个文件，校验 Content-Length；失败由装饰器重试"""
        if os.path.exists(dest) and os.path.getsize(dest) > 0:
            self.stats["skipped"] += 1
            return True
        tmp = dest + ".part"
        try:
            async with aiohttp.ClientSession(headers=self.headers) as session:
                async with session.get(
                    url,
                    proxy=self.proxy or None,
                    timeout=aiohttp.ClientTimeout(total=self.timeout)
                ) as resp:
                    if resp.status >= 400:
                        raise Exception(f"HTTP {resp.status}")
                    total = int(resp.headers.get("Content-Length") or 0)
                    if self.min_resource_size and total and total < self.min_resource_size:
                        # 小于最小资源阈值：视为已处理跳过（不落盘）
                        self.stats["skipped"] += 1
                        return True
                    written = 0
                    with open(tmp, "wb") as f:
                        async for chunk in resp.content.iter_chunked(65536):
                            f.write(chunk)
                            written += len(chunk)
                            if self.rate_limit > 0:  # 限速：按已写字节数计算休眠
                                await asyncio.sleep(len(chunk) / self.rate_limit)
                    if total and written != total:
                        raise Exception(f"长度不匹配 {written}/{total}")
            os.replace(tmp, dest)
            self.stats["success"] += 1
            return True
        except Exception:
            if os.path.exists(tmp):
                os.remove(tmp)
            raise

    @async_retry(max_retries=1, delay=2.0)
    async def _download_m3u8(self, url: str, dest: str) -> bool:
        """用 ffmpeg 下载 m3u8 清单并合并转封装为 mp4（-c copy 不重编码）"""
        if os.path.exists(dest) and os.path.getsize(dest) > 0:
            self.stats["skipped"] += 1
            return True
        if not self.use_ffmpeg:
            raise Exception("ffmpeg 未启用（use_ffmpeg=False），无法处理 m3u8")
        tmp = dest + ".part.mp4"
        # TS 分片内 AAC 音频需要 aac_adtstoasc 位流过滤器；失败时去掉过滤器重试一次
        last_code = -1
        for extra in (["-bsf:a", "aac_adtstoasc"], []):
            if os.path.exists(tmp):
                os.remove(tmp)
            cmd = [self.ffmpeg_bin, "-y"]
            if self.ffmpeg_headers:
                cmd += ["-headers", self.ffmpeg_headers]  # 把 UA/Referer/Cookie 带给分片请求
            cmd += ["-i", url, "-c", "copy"] + extra + [tmp]
            proc = await asyncio.create_subprocess_exec(
                *cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
            try:
                await asyncio.wait_for(proc.wait(), timeout=self.m3u8_timeout)
            except asyncio.TimeoutError:
                proc.kill()
                raise Exception("m3u8 下载超时")
            last_code = proc.returncode
            if last_code == 0:
                break
        if last_code != 0:
            raise Exception(f"ffmpeg 合并失败 returncode={last_code}")
        os.replace(tmp, dest)
        self.stats["success"] += 1
        return True

    async def download(self, url: str, category: str) -> bool:
        """下载入口：m3u8 走 ffmpeg 合并，其余走流式下载。返回 True=成功/跳过，False=失败"""
        async with self.sem:
            try:
                dest = self._dest_path(url, category)
                if url.lower().endswith(".m3u8"):
                    dest = os.path.splitext(dest)[0] + ".mp4"
                    ok = await self._download_m3u8(url, dest)
                else:
                    ok = await self._download_binary(url, dest)
                if ok is True:
                    return True
                self.stats["failed"] += 1
                self.failed_urls.append(url)
                return False
            except Exception as e:
                self.stats["failed"] += 1
                self.failed_urls.append(url)
                print(f"[download FAIL] {category}: {url} | {type(e).__name__}: {e}")
                return False

    def print_stats(self):
        print(f"[download] 成功:{self.stats['success']} 跳过(已存在):{self.stats['skipped']} "
              f"失败:{self.stats['failed']}")
        for u in self.failed_urls:
            print(f"  [download FAIL URL] {u}")


# ------------------------------
# 核心爬虫类：DOM媒体 + 网络抓包视频合并
# ------------------------------
class AsyncUniversalSpider:
    def __init__(
        self,
        start_url: str,
        max_depth: int = 3,
        concurrency: int = 3,
        sleep_sec: float = 0.8,
        timeout: int = 15,
        use_dynamic_fallback: bool = True,
        output_file: str = "assets.txt",
        fail_file: str = "fail_urls.txt",
        enable_download: bool = True,
        download_dir: str = "download",
        download_concurrency: Optional[int] = None,
        ffmpeg_bin: str = "ffmpeg",
        use_ffmpeg: bool = True,
        max_pages: Optional[int] = None,
        referer: Optional[str] = None,
        extra_pagination_patterns: Optional[List[str]] = None,
        include_paths: Optional[List[str]] = None,
        exclude_paths: Optional[List[str]] = None,
        download_mode: str = "after",
        proxy: Optional[str] = None,
        cookies: Optional[str] = None,
        whitelist_domains: Optional[List[str]] = None,
        download_rate_limit: int = 0,
        min_resource_size: int = 0,
    ):
        if download_mode not in ("after", "live"):
            raise ValueError(f"download_mode 仅支持 'after'(采集完再下载) / 'live'(边采集边下载)，收到: {download_mode!r}")
        self.start_url = start_url
        parsed = urlparse(start_url)
        self.base_domain = f"{parsed.scheme}://{parsed.netloc}"
        self.max_depth = max_depth
        self.concurrency = concurrency
        self.sleep_sec = sleep_sec
        self.timeout = timeout
        self.use_dynamic_fallback = use_dynamic_fallback
        self.output_file = output_file
        self.fail_file = fail_file
        self.enable_download = enable_download
        self.download_dir = download_dir
        self.download_concurrency = download_concurrency
        self.ffmpeg_bin = ffmpeg_bin
        self.use_ffmpeg = use_ffmpeg
        self.max_pages = max_pages  # 分页页抓取上限，None 表示不限制
        self.pagination_count = 0    # 已抓取的分页页计数（统计）
        self.pagination_enqueued = 0  # 已入队的分页页计数（限制用）
        self.referer = referer or (self.base_domain + "/")  # 下载防盗链 Referer，默认站点根地址
        self.extra_pagination_patterns = extra_pagination_patterns or []
        self.include_paths = include_paths or []  # 只爬这些路径前缀的页面（空=不限）
        self.exclude_paths = exclude_paths or []  # 不爬这些路径前缀的页面
        self.download_mode = download_mode  # "after" 采集完再下载 / "live" 边采集边下载
        self.dl_queue: asyncio.Queue = asyncio.Queue()  # 边采集边下载模式下的下载队列
        self.downloaded: Set[str] = set()  # 已投递下载队列的 URL（去重）
        self.proxy = proxy            # 全链路代理（抓取/浏览器/下载）
        self.cookies = cookies        # Cookie 字符串 "k1=v1; k2=v2"（抓取/浏览器/下载）
        self.whitelist_domains = [d.lower() for d in (whitelist_domains or [])]  # 媒体/跨域链接域名白名单
        self.download_rate_limit = download_rate_limit  # 单下载限速 bytes/s
        self.min_resource_size = min_resource_size      # 最小资源字节

        self.headers = {
            "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 13_5) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36",
            "Accept-Language": "zh-CN,zh;q=0.9",
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8"
        }
        if self.cookies:
            self.headers["Cookie"] = self.cookies  # 登录态/防盗链 Cookie

        self.url_manager = UrlManager(self.base_domain)
        self.fail_manager = FailUrlManager(self.fail_file)

        self.browser: Optional[Browser] = None
        self.pw_context = None
        self.fetcher_static: Optional[RequestsFetcher] = None
        self.fetcher_dynamic: Optional[PlaywrightFetcher] = None
        self.task_queue: asyncio.Queue = asyncio.Queue()

        # 分类媒体集合：image / video / audio / document
        self.all_media: Dict[str, Set[str]] = {cat: set() for cat in MEDIA_EXTENSIONS}
        self.net_capture_media: Set[str] = set()  # 网络监听器捕获的媒体
        self.downloader: Optional[MediaDownloader] = None

    async def init_browser(self):
        # 静态抓取器始终可用；仅当启用动态兜底时才启动 playwright 浏览器
        self.fetcher_static = FetcherFactory.get_static_fetcher(self.headers, self.timeout, self.proxy)
        if self.use_dynamic_fallback:
            launch_args = {"headless": True}
            if self.proxy:
                launch_args["proxy"] = {"server": self.proxy}
            self.pw_context = await async_playwright().start()
            self.browser = await self.pw_context.chromium.launch(**launch_args)
            self.fetcher_dynamic = FetcherFactory.get_dynamic_fetcher(
                self.headers, self.timeout, self.browser, self.net_capture_media,
                self.proxy, self.cookies, self.referer,
            )
        if self.enable_download:
            dl_conc = self.download_concurrency if self.download_concurrency else self.concurrency
            self.downloader = MediaDownloader(
                headers=self.headers,
                timeout=self.timeout,
                concurrency=dl_conc,
                download_dir=self.download_dir,
                ffmpeg_bin=self.ffmpeg_bin,
                use_ffmpeg=self.use_ffmpeg,
                referer=self.referer,
                proxy=self.proxy,
                rate_limit=self.download_rate_limit,
                min_resource_size=self.min_resource_size,
            )

    async def close_browser(self):
        if self.browser:
            await self.browser.close()
        if self.pw_context:
            await self.pw_context.stop()

    def save_media_to_file(self):
        # 网络抓包媒体按类别归并，与 DOM 媒体合并去重后按类别写出
        net_by_cat: Dict[str, Set[str]] = {cat: set() for cat in MEDIA_EXTENSIONS}
        for u in self.net_capture_media:
            cat = categorize_url(u)
            if cat:
                net_by_cat[cat].add(u)
        filepath = self.output_file
        with open(filepath, "w", encoding="utf-8") as f:
            for cat in ("image", "video", "audio", "document"):
                f.write(f"===== {cat.upper()} LINKS =====\n")
                for u in sorted(self.all_media[cat].union(net_by_cat[cat])):
                    f.write(u + "\n")
                f.write("\n")
        total = sum(len(self.all_media[c]) for c in MEDIA_EXTENSIONS)
        net_total = len(self.net_capture_media)
        print(f"已保存 {filepath}，媒体总数:{total}（网络抓包:{net_total}）")

    def _path_allowed(self, url: str) -> bool:
        """路径过滤：include_paths 非空时须命中其一；命中 exclude_paths 则拒绝"""
        path = urlparse(url).path
        if self.include_paths and not any(path.startswith(p) for p in self.include_paths):
            return False
        if any(path.startswith(p) for p in self.exclude_paths):
            return False
        return True

    def _media_allowed(self, url: str) -> bool:
        """域名白名单：whitelist_domains 为空放行；否则 host（或含端口的 netloc）须命中任一白名单。
        子串匹配，兼容 "file.ertuba.com" 与 "127.0.0.1:18088" 两种写法。
        用于媒体资源过滤（如只保留图床域名、剔除站内 logo）与跨域链接跟随"""
        if not self.whitelist_domains:
            return True
        parsed = urlparse(url)
        host = (parsed.hostname or "").lower()
        netloc = (parsed.netloc or "").lower()
        if not (host or netloc):
            return False
        return any(w in host or w in netloc for w in self.whitelist_domains)

    async def worker(self):
        while True:
            try:
                url, depth = await self.task_queue.get()
            except asyncio.CancelledError:
                break
            try:
                page: Optional[Page] = None
                if self.url_manager.is_visited(url) or depth > self.max_depth:
                    continue
                self.url_manager.mark_visited(url)
                if is_pagination_url(url):
                    self.pagination_count += 1
                print(f"[worker] depth={depth} url={url}")

                html: Optional[str] = None
                html = await self.fetcher_static.fetch(url)
                if not is_html_valid(html):
                    html = None

                if html is None and self.use_dynamic_fallback:
                    page = await self.fetcher_dynamic.fetch_with_page(url)

                media: Dict[str, Set[str]] = {cat: set() for cat in MEDIA_EXTENSIONS}
                links: List[str] = []

                if page is not None:
                    dynamic_media = await PageParser.extract_media_from_page(page, url)
                    html = await page.content()
                    links = PageParser.extract_links_from_html(html, url)
                    media = PageParser.extract_media_from_html(html, url)
                    for cat in media:
                        media[cat].update(dynamic_media.get(cat, set()))
                elif html is not None:
                    media = PageParser.extract_media_from_html(html, url)
                    links = PageParser.extract_links_from_html(html, url)
                else:
                    print(f"[FAIL] {url} | static+dynamic all failed")
                    self.fail_manager.record_fail(url, "static+dynamic all failed")
                    continue

                # 域名白名单过滤（如只保留图床域名、剔除站内 logo），过滤后计数
                if self.whitelist_domains:
                    for cat in media:
                        media[cat] = {u for u in media[cat] if self._media_allowed(u)}
                media_count = sum(len(v) for v in media.values())
                for cat in media:
                    self.all_media[cat].update(media[cat])
                print(f"[OK] {url} | media:{media_count} ({'/'.join(f'{c}:{len(media[c])}' for c in media)})")

                # 边采集边下载：本页媒体立即投递下载队列（去重后）
                if self.download_mode == "live" and self.downloader:
                    for cat, urls in media.items():
                        for u in urls:
                            if u not in self.downloaded:
                                self.downloaded.add(u)
                                await self.dl_queue.put((u, cat))

                # 链接入队：分页链接不消耗深度（同一系列抓全）；媒体 URL 只收集不当作页面
                for link in links:
                    norm_link = self.url_manager.normalize_url(link)
                    if categorize_url(norm_link):
                        continue  # 媒体资源只收集不当作页面继续爬
                    if not self._path_allowed(norm_link):
                        continue  # 路径白名单/黑名单过滤，聚焦目标栏目
                    same_or_white = (self.url_manager.is_same_domain(norm_link)
                                     or self._media_allowed(norm_link))
                    if not (same_or_white and not self.url_manager.is_visited(norm_link)):
                        continue
                    if is_pagination_url(norm_link, self.extra_pagination_patterns):
                        if self.max_pages is not None and self.pagination_enqueued >= self.max_pages:
                            continue
                        self.pagination_enqueued += 1
                        await self.task_queue.put((norm_link, depth))  # 分页与当前页同层
                    else:
                        await self.task_queue.put((norm_link, depth + 1))

                await asyncio.sleep(self.sleep_sec)
            except Exception as e:
                print(f"[worker exception] {str(e)}")
            finally:
                if page is not None:
                    await page.close()
                self.task_queue.task_done()

    async def download_worker(self):
        """边采集边下载：消费下载队列，逐条下载；失败记入 fail 清单"""
        while True:
            try:
                url, cat = await self.dl_queue.get()
            except asyncio.CancelledError:
                break
            try:
                ok = await self.downloader.download(url, cat)
                if ok is False:
                    self.fail_manager.record_fail(url, "download failed")
                else:
                    print(f"[download OK] {cat}: {url}")
            finally:
                self.dl_queue.task_done()

    def _feed_net_capture(self) -> None:
        """把网络抓包捕获的媒体补投到下载队列（无界队列，put_nowait 安全）"""
        for u in list(self.net_capture_media):
            if u in self.downloaded:
                continue
            cat = categorize_url(u)
            if not cat:
                continue
            self.downloaded.add(u)
            self.dl_queue.put_nowait((u, cat))

    async def capture_feeder(self):
        """边采集边下载：周期扫描网络抓包媒体（动态渲染加载的视频等），补投下载队列"""
        while True:
            self._feed_net_capture()
            await asyncio.sleep(0.5)

    async def download_media(self):
        """将收集到的四类媒体下载到 download_dir；m3u8 走 ffmpeg 合并"""
        if not self.downloader:
            print("[download] 下载未启用（enable_download=False）")
            return
        tasks = []
        seen: Set[str] = set()
        # DOM 媒体
        for cat in MEDIA_EXTENSIONS:
            for u in self.all_media[cat]:
                if u in seen:
                    continue
                seen.add(u)
                tasks.append((u, cat))
        # 网络抓包媒体（按后缀归类，避免与 DOM 重复）
        for u in self.net_capture_media:
            if u in seen:
                continue
            cat = categorize_url(u)
            if not cat:
                continue
            seen.add(u)
            tasks.append((u, cat))

        print(f"[download] 待下载 {len(tasks)} 个媒体资源")
        results = await asyncio.gather(
            *(self.downloader.download(u, c) for u, c in tasks),
            return_exceptions=True
        )
        self.downloader.print_stats()
        # 下载失败同样记录到 fail 清单，便于补下
        for (u, _c), res in zip(tasks, results):
            if res is False:
                self.fail_manager.record_fail(u, "download failed")

    async def run(self):
        await self.init_browser()
        await self.task_queue.put((self.start_url, 0))
        workers = [asyncio.create_task(self.worker()) for _ in range(self.concurrency)]

        # 边采集边下载：启动下载 worker + 网络抓包投递器
        feeder = None
        dl_workers: List[asyncio.Task] = []
        if self.download_mode == "live" and self.downloader:
            dl_conc = self.download_concurrency or self.concurrency
            feeder = asyncio.create_task(self.capture_feeder())
            dl_workers = [asyncio.create_task(self.download_worker()) for _ in range(dl_conc)]

        await self.task_queue.join()  # 等全部页面采集完成

        for w in workers:
            w.cancel()
        await asyncio.gather(*workers, return_exceptions=True)

        if dl_workers:
            # 采集结束：补投最后的抓包媒体，等下载队列清空
            if feeder:
                feeder.cancel()
                await asyncio.gather(feeder, return_exceptions=True)
            self._feed_net_capture()
            await self.dl_queue.join()
            for w in dl_workers:
                w.cancel()
            await asyncio.gather(*dl_workers, return_exceptions=True)
            self.downloader.print_stats()

        await self.close_browser()
        self.save_media_to_file()
        if self.download_mode == "after":
            await self.download_media()

    async def retry_failed(self):
        fail_urls = self.fail_manager.load_failed_urls()
        for u in fail_urls:
            await self.task_queue.put((u, 0))
        print(f"准备补爬 {len(fail_urls)} 个失败链接")


if __name__ == "__main__":
    async def main():
        spider = AsyncUniversalSpider(
            start_url="https://www.meitu131.com/",
            max_depth=2,
            concurrency=3,
            sleep_sec=1.0,
            use_dynamic_fallback=True,
            download_mode="after"
        )
        await spider.run()

    asyncio.run(main())
