"""HTTP 客户端：会话、重试、限流、防盗链头、流式下载。

这一层存在的意义是把「怎么发请求」和「抓什么」解耦。
防盗链（Referer）、UA、重试、限速这些脏活都收在这里，
上层 extractor / downloader 只管业务逻辑。
"""

from __future__ import annotations

import random
import threading
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Optional
from urllib.parse import urlparse
from urllib.robotparser import RobotFileParser

import requests
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry

DEFAULT_UA = ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
              "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36")

# 这些状态码才值得重试；404/403 重试没意义，直接判定失败
RETRY_STATUS = (429, 500, 502, 503, 504)


@dataclass
class FetchResult:
    """一次请求的结果，失败时 content 为空、error 有值。"""

    url: str
    status: int = 0
    content: bytes = b""
    content_type: str = ""
    final_url: str = ""
    error: str = ""
    size: int = 0  # download() 落盘的字节数断点续传时含已有部分
    etag: str = ""
    length: int = 0  # HEAD / GET 响应里的 Content-Length

    @property
    def ok(self) -> bool:
        return self.status in (200, 206) and not self.error


class HttpClient:
    """带礼貌策略的 HTTP 客户端。

    :param delay: 同一域名的两次请求最小间隔（秒），防止把对方打挂
    :param retries: 网络类错误的重试次数
    :param timeout: (连接超时, 读取超时)
    :param proxy: 形如 http://127.0.0.1:7890
    :param obey_robots: 是否遵守 robots.txt
    """

    def __init__(self,
                 user_agent: str = DEFAULT_UA,
                 delay: float = 0.0,
                 retries: int = 3,
                 timeout: tuple[float, float] = (10, 60),
                 proxy: Optional[str] = None,
                 headers: Optional[dict] = None,
                 cookies: Optional[dict] = None,
                 obey_robots: bool = True,
                 verify_ssl: bool = True):
        self.delay = max(0.0, delay)
        self.timeout = timeout
        self.obey_robots = obey_robots
        self.user_agent = user_agent

        self.session = requests.Session()
        self.session.headers.update({
            "User-Agent": user_agent,
            "Accept": "*/*",
            "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
        })
        if headers:
            self.session.headers.update(headers)
        if cookies:
            self.session.cookies.update(cookies)
        if proxy:
            self.session.proxies.update({"http": proxy, "https": proxy})
        self.session.verify = verify_ssl

        # 只在值得重试的状态码上重试，且对 POST 之类不重放
        retry = Retry(total=retries, connect=retries, read=retries,
                      status=retries, backoff_factor=0.5,
                      status_forcelist=RETRY_STATUS,
                      allowed_methods=frozenset({"GET", "HEAD"}),
                      raise_on_status=False)
        adapter = HTTPAdapter(max_retries=retry, pool_maxsize=64, pool_connections=32)
        self.session.mount("http://", adapter)
        self.session.mount("https://", adapter)

        self._last_hit: dict[str, float] = {}
        self._lock = threading.Lock()
        self._robots: dict[str, RobotFileParser | None] = {}
        self._robots_lock = threading.Lock()

    # ---------- 礼貌策略 ----------

    def _throttle(self, host: str) -> None:
        if self.delay <= 0:
            return
        with self._lock:
            last = self._last_hit.get(host, 0.0)
            wait = self.delay - (time.time() - last)
            if wait > 0:
                time.sleep(wait)
            self._last_hit[host] = time.time()

    def _robots_for(self, url: str) -> Optional[RobotFileParser]:
        parts = urlparse(url)
        origin = f"{parts.scheme}://{parts.netloc}"
        with self._robots_lock:
            if origin in self._robots:
                return self._robots[origin]
            parser: Optional[RobotFileParser] = RobotFileParser()
            parser.set_url(f"{origin}/robots.txt")
            try:
                parser.read()
            except Exception:
                parser = None  # 读不到就当没有限制
            self._robots[origin] = parser
            return parser

    def allowed(self, url: str) -> bool:
        if not self.obey_robots:
            return True
        parser = self._robots_for(url)
        if parser is None:
            return True
        try:
            return parser.can_fetch(self.user_agent, url)
        except Exception:
            return True

    # ---------- 核心请求 ----------

    def get(self, url: str, referer: Optional[str] = None,
            stream: bool = False, timeout: Optional[tuple[float, float]] = None,
            allow_redirects: bool = True) -> FetchResult:
        """发 GET 请求，自动带 Referer 并做限流。"""
        host = urlparse(url).netloc
        self._throttle(host)

        headers = {}
        if referer:
            headers["Referer"] = referer
        # 媒体资源常见的防盗链组合，带上能显著提高成功率
        headers.setdefault("Accept", "*/*")

        result = FetchResult(url=url)
        try:
            resp = self.session.get(url, headers=headers, stream=stream,
                                    timeout=timeout or self.timeout,
                                    allow_redirects=allow_redirects)
            result.status = resp.status_code
            result.final_url = resp.url
            result.content_type = resp.headers.get("Content-Type", "")
            if not stream:
                result.content = resp.content
            else:
                resp.close()  # 调用方另行用 head 探测，这里不持有连接
        except Exception as exc:
            result.error = f"{type(exc).__name__}: {exc}"
        return result

    def head(self, url: str, referer: Optional[str] = None) -> FetchResult:
        host = urlparse(url).netloc
        self._throttle(host)
        headers = {"Referer": referer} if referer else {}
        result = FetchResult(url=url)
        try:
            resp = self.session.head(url, headers=headers, timeout=self.timeout,
                                     allow_redirects=True)
            result.status = resp.status_code
            result.final_url = resp.url
            result.content_type = resp.headers.get("Content-Type", "")
            result.etag = resp.headers.get("ETag", "")
            try:
                result.length = int(resp.headers.get("Content-Length") or 0)
            except ValueError:
                result.length = 0
        except Exception as exc:
            result.error = f"{type(exc).__name__}: {exc}"
        return result

    # ---------- 断点续传 ----------

    @staticmethod
    def _sidecar(dest: Path) -> Path:
        """续传记录文件（隐藏文件，不污染输出目录的观感）。"""
        return dest.parent / ("." + dest.name + ".etag")

    def _resume_offset(self, url: str, dest: Path,
                       referer: Optional[str]) -> int:
        """判断能续传多少字节；不能证明安全就返回 0（重下）。

        只在"能证明本地内容是同一份资源的前缀"时才续传，否则
        往脏数据后面追加只会得到一个看起来完整、实际损坏的文件。
        """
        head = self.head(url, referer=referer)
        if not head.ok:
            return 0
        size = dest.stat().st_size
        if head.length and size >= head.length:
            return 0  # 已经装满了，重下更稳妥
        stored = self._sidecar(dest).read_text(encoding="utf-8").strip() \
            if self._sidecar(dest).exists() else None
        if stored is None:
            return 0  # 没有上次下载的记录，不敢续传
        if head.etag and stored != head.etag:
            return 0  # 远端资源已更新，前缀失效
        return size

    def fetch_bytes(self, url: str, referer: Optional[str] = None,
                    max_size: Optional[int] = None) -> FetchResult:
        """把整个响应读进内存，用于页面 HTML、m3u8 清单等小内容。

        :param max_size: 超过这个字节数就中断，避免把大文件读爆内存
        """
        host = urlparse(url).netloc
        self._throttle(host)
        headers = {"Referer": referer} if referer else {}
        result = FetchResult(url=url)
        try:
            with self.session.get(url, headers=headers, stream=True,
                                  timeout=self.timeout) as resp:
                result.status = resp.status_code
                result.final_url = resp.url
                result.content_type = resp.headers.get("Content-Type", "")
                chunks, total = [], 0
                for chunk in resp.iter_content(1 << 16):
                    chunks.append(chunk)
                    total += len(chunk)
                    if max_size and total > max_size:
                        result.error = f"响应超过 max_size={max_size}"
                        break
                result.content = b"".join(chunks)
        except Exception as exc:
            result.error = f"{type(exc).__name__}: {exc}"
        return result

    def download(self, url: str, dest, referer: Optional[str] = None,
                 resume: bool = True,
                 chunk_size: int = 1 << 16) -> FetchResult:
        """流式下载到文件，支持断点续传。

        注意：断点续传要求服务端支持 Range。不支持时会自动退回全量下载。
        """
        dest = Path(dest)
        dest.parent.mkdir(parents=True, exist_ok=True)
        result = FetchResult(url=url)

        headers = {"Referer": referer} if referer else {}
        done = 0
        if resume and dest.exists() and dest.stat().st_size > 0:
            done = self._resume_offset(url, dest, referer)
        mode = "ab" if done else "wb"
        if done:
            headers["Range"] = f"bytes={done}-"

        host = urlparse(url).netloc
        self._throttle(host)
        try:
            with self.session.get(url, headers=headers, stream=True,
                                  timeout=self.timeout) as resp:
                result.status = resp.status_code
                result.final_url = resp.url
                result.content_type = resp.headers.get("Content-Type", "")

                # 服务端不接受 Range，就从头再来，别把半截文件续上去
                if done and resp.status_code != 206:
                    done, mode = 0, "wb"
                if resp.status_code not in (200, 206):
                    result.error = f"HTTP {resp.status_code}"
                    return result

                total = done
                with dest.open(mode) as fh:
                    for chunk in resp.iter_content(chunk_size):
                        if not chunk:
                            continue
                        fh.write(chunk)
                        total += len(chunk)
                result.content = b""  # 大文件不驻留内存
                result.size = total
                result.etag = resp.headers.get("ETag", "")
                # 记下这一版的 ETag，下次中断才能安全地接着下
                self._sidecar(dest).write_text(
                    result.etag or "NO_ETAG", encoding="utf-8")
        except Exception as exc:
            result.error = f"{type(exc).__name__}: {exc}"
        return result

    def close(self) -> None:
        self.session.close()


def random_ua() -> str:
    """随机 UA，给需要轮换的场景用。"""
    versions = ["124.0.0.0", "125.0.0.0", "126.0.0.0", "127.0.0.0"]
    v = random.choice(versions)
    return (f"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
            f"(KHTML, like Gecko) Chrome/{v} Safari/537.36")
