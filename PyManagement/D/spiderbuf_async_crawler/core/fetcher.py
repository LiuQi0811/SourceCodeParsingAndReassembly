"""aiohttp 异步抓取器：编码自动识别、重试、并发限流、代理。"""

from __future__ import annotations

import asyncio
import logging
from dataclasses import dataclass
from typing import Any, Dict, Optional, Tuple

import aiohttp

from core.encoding import decode_bytes
from core.models import RetryableError

logger = logging.getLogger(__name__)

# HTTP 状态码 → 可重试（限流/临时性反爬/瞬时 5xx），fetch 命中即抛 RetryableError
DEFAULT_RETRYABLE_STATUS = {403, 408, 425, 429, 500, 502, 503, 504}


@dataclass
class FetchResult:
    status: int
    headers: Dict[str, str]
    raw: bytes
    text: str
    encoding: str
    final_url: str


class Fetcher:
    """aiohttp 会话封装。

    参数：
    - headers: 全局默认请求头
    - timeout: 单请求超时（秒）
    - retries: 失败重试次数（指数退避）
    - concurrency: 全局并发上限（信号量）
    - proxy: 代理 URL（可选）
    - cookies: 预置 cookie 字典
    """

    def __init__(self, headers: Optional[Dict[str, str]] = None,
                 timeout: float = 20.0, retries: int = 2,
                 concurrency: int = 16, proxy: Optional[str] = None,
                 cookies: Optional[Dict[str, str]] = None,
                 retry_statuses: Optional[set] = None) -> None:
        self.default_headers = {
            "User-Agent": ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                           "AppleWebKit/537.36 (KHTML, like Gecko) "
                           "Chrome/124.0.0.0 Safari/537.36"),
            "Accept": "*/*",
            "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
            **(headers or {}),
        }
        self.timeout = timeout
        self.retries = retries
        self.proxy = proxy
        # 命中这些状态码直接抛 RetryableError（由上层指数退避重试），默认限流/5xx
        self.retry_statuses = (
            set(retry_statuses) if retry_statuses is not None
            else set(DEFAULT_RETRYABLE_STATUS))
        self._sem = asyncio.Semaphore(concurrency)
        self._session: Optional[aiohttp.ClientSession] = None
        self._cookie_seed = dict(cookies or {})

    async def start(self) -> None:
        jar = aiohttp.CookieJar(unsafe=True)
        self._session = aiohttp.ClientSession(
            cookie_jar=jar, timeout=aiohttp.ClientTimeout(total=self.timeout))
        # 预置 cookie
        for name, value in self._cookie_seed.items():
            jar.update_cookies({name: value})

    async def close(self) -> None:
        if self._session is not None:
            await self._session.close()
            self._session = None

    @property
    def session(self) -> aiohttp.ClientSession:
        assert self._session is not None, "Fetcher.start() 尚未调用"
        return self._session

    async def fetch(self, url: str, *, method: str = "GET",
                    headers: Optional[Dict[str, str]] = None,
                    data: Optional[Dict[str, Any]] = None,
                    json: Optional[Dict[str, Any]] = None,
                    force_encoding: Optional[str] = None,
                    referer: Optional[str] = None,
                    allow_redirects: bool = True,
                    retry_statuses: Optional[set] = None) -> FetchResult:
        """抓取 URL，自动识别编码并解码文本。

        - 默认跟随重定向（POST 302 自动转 GET，cookie 由 jar 维护）
        - 网络异常按 retries 指数退避重试
        - HTTP 状态命中 retry_statuses（默认限流/5xx）→ 抛 RetryableError，
          由引擎/调用方做任务级退避重试（状态码级重试与网络级重试分开）
        """
        request_headers = dict(self.default_headers)
        if headers:
            request_headers.update(headers)
        if referer:
            request_headers["Referer"] = referer
        status_set = self.retry_statuses if retry_statuses is None else set(retry_statuses)

        last_err: Optional[Exception] = None
        for attempt in range(self.retries + 1):
            try:
                async with self._sem:
                    async with self.session.request(
                            method, url, headers=request_headers,
                            data=data, json=json, proxy=self.proxy,
                            allow_redirects=allow_redirects) as resp:
                        raw = await resp.read()
                if resp.status in status_set:
                    raise RetryableError(f"HTTP {resp.status}（可重试）")
                headers_out = {k.lower(): v for k, v in resp.headers.items()}
                text, encoding = decode_bytes(raw, headers_out, force_encoding)
                return FetchResult(status=resp.status, headers=headers_out,
                                   raw=raw, text=text, encoding=encoding,
                                   final_url=str(resp.url))
            except (aiohttp.ClientError, asyncio.TimeoutError) as exc:
                last_err = exc
                if attempt < self.retries:
                    await asyncio.sleep(0.5 * (2 ** attempt))
        raise RuntimeError(f"抓取失败 {url}: {last_err}")

    async def download(self, url: str, *,
                       headers: Optional[Dict[str, str]] = None,
                       referer: Optional[str] = None) -> Tuple[bytes, Dict[str, str]]:
        """下载二进制资源（图片/视频分片等），返回 (bytes, headers)。"""
        request_headers = dict(self.default_headers)
        if headers:
            request_headers.update(headers)
        if referer:
            request_headers["Referer"] = referer
        for attempt in range(self.retries + 1):
            try:
                async with self._sem:
                    async with self.session.get(
                            url, headers=request_headers, proxy=self.proxy) as resp:
                        resp.raise_for_status()
                        raw = await resp.read()
                return raw, {k.lower(): v for k, v in resp.headers.items()}
            except (aiohttp.ClientError, asyncio.TimeoutError) as exc:
                if attempt < self.retries:
                    await asyncio.sleep(0.5 * (2 ** attempt))
                else:
                    raise RuntimeError(f"下载失败 {url}: {exc}") from exc
        raise RuntimeError(f"下载失败 {url}")
