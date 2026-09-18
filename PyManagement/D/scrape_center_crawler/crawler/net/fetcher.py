# -*- coding: utf-8 -*-
"""aiohttp 异步抓取器：编码自动识别、重试退避、流式下载、认证/SSL/代理支持"""
from __future__ import annotations

import asyncio
import logging
import random
import time
from dataclasses import dataclass, field
from typing import Any, Dict, Optional, Tuple

import aiohttp

from ..constants import DEFAULT_HEADERS
from .encoding import decode_bytes

logger = logging.getLogger("crawler.net")

_RETRYABLE = (
    aiohttp.ClientError,
    asyncio.TimeoutError,
    ConnectionError,
    OSError,
)

# 连接级错误：站点瞬断/拒绝连接/连接重置，需要更长退避等待站点恢复
_CONNECT_RETRYABLE = (
    aiohttp.ClientConnectorError,
    aiohttp.ClientOSError,
    ConnectionError,
    OSError,
)


class _TokenBucket:
    """全局 QPS 令牌桶：所有请求（页面/资源/视频分片）统一限速"""

    def __init__(self, rate: float) -> None:
        self.rate = rate
        self.tokens = float(rate)
        self.updated = time.monotonic()
        self._lock = asyncio.Lock()

    async def acquire(self) -> None:
        if self.rate <= 0:
            return
        async with self._lock:
            now = time.monotonic()
            self.tokens = min(self.rate, self.tokens + (now - self.updated) * self.rate)
            self.updated = now
            if self.tokens >= 1.0:
                self.tokens -= 1.0
                return
            wait = (1.0 - self.tokens) / self.rate
            self.tokens = 0.0
            self.updated = now + wait
        await asyncio.sleep(wait)


@dataclass
class FetchResult:
    """一次抓取的完整结果"""

    url: str
    status: int
    headers: Any = None
    raw: bytes = b""
    final_url: str = ""
    charset: str = ""
    encoding_source: str = ""
    elapsed: float = 0.0
    text: Optional[str] = None

    @property
    def content_type(self) -> str:
        return (self.headers.get("Content-Type") if self.headers else "") or ""

    @property
    def is_html(self) -> bool:
        ct = self.content_type.lower()
        return "html" in ct or (not ct and (self.raw[:1] in (b"<", b"\t", b"\n", b"\r")))

    @property
    def is_json(self) -> bool:
        return "json" in self.content_type.lower()

    def as_text(self) -> str:
        if self.text is None:
            return ""
        return self.text


class AsyncFetcher:
    """异步抓取器：封装 aiohttp，统一编码探测/解码与重试"""

    def __init__(
        self,
        session: Optional[aiohttp.ClientSession] = None,
        *,
        timeout: float = 30.0,
        max_retries: int = 3,
        retry_backoff: float = 1.0,
        connect_backoff: float = 10.0,
        connect_max_retries: int = 2,
        qps: float = 0.0,
        verify_ssl: bool = True,
        headers: Optional[Dict[str, str]] = None,
    ) -> None:
        self.session = session
        self.timeout = timeout
        self.max_retries = max_retries
        self.retry_backoff = retry_backoff
        self.connect_backoff = connect_backoff
        self.connect_max_retries = connect_max_retries
        self.qps = qps
        self._bucket = _TokenBucket(qps)
        self.verify_ssl = verify_ssl
        self.headers = dict(headers or DEFAULT_HEADERS)

    async def _ensure_session(self) -> aiohttp.ClientSession:
        if self.session is None or self.session.closed:
            connector = aiohttp.TCPConnector(
                limit=64, limit_per_host=16, ssl=False if not self.verify_ssl else None, ttl_dns_cache=300
            )
            self.session = aiohttp.ClientSession(connector=connector, headers=self.headers)
        return self.session

    def _ssl(self, verify_ssl: Optional[bool]) -> Any:
        if verify_ssl is False:
            return False
        return None

    async def fetch(
        self,
        url: str,
        *,
        method: str = "GET",
        headers: Optional[Dict[str, str]] = None,
        params: Optional[Dict[str, Any]] = None,
        data: Any = None,
        timeout: Optional[float] = None,
        encoding: Optional[str] = None,
        binary: bool = False,
        auth: Optional[Tuple[str, str]] = None,
        referer: str = "",
        verify_ssl: Optional[bool] = None,
        cookies: Optional[Dict[str, str]] = None,
    ) -> FetchResult:
        """抓取 URL；失败按指数退避重试；返回 FetchResult（二进制资源 raw 完整保留）"""
        session = await self._ensure_session()
        ssl_flag = self._ssl(verify_ssl if verify_ssl is not None else self.verify_ssl)
        tmo = aiohttp.ClientTimeout(total=timeout or self.timeout)
        headers = {**self.headers, **(headers or {})}
        if referer:
            headers.setdefault("Referer", referer)
        if auth:
            headers.setdefault("Authorization", _basic_auth(*auth))

        last_err: Optional[Exception] = None
        for attempt in range(self.max_retries + 1):
            await self._bucket.acquire()   # 全局 QPS 限速（重试同样占额度）
            started = time.perf_counter()
            try:
                async with session.request(
                    method, url, headers=headers, params=params, data=data,
                    timeout=tmo, ssl=ssl_flag, cookies=cookies, allow_redirects=True,
                ) as resp:
                    raw = await resp.read()
                    result = FetchResult(
                        url=url,
                        status=resp.status,
                        headers=resp.headers,
                        raw=raw,
                        final_url=str(resp.url),
                        elapsed=time.perf_counter() - started,
                    )
                    if resp.status >= 400:
                        raise aiohttp.ClientResponseError(
                            resp.request_info, resp.history, status=resp.status,
                            message=f"HTTP {resp.status} for {url}",
                        )
                    if not binary:
                        text, result.charset, result.encoding_source = decode_bytes(
                            raw, resp.headers, html_meta=True, forced=encoding
                        )
                        result.text = text
                    return result
            except _RETRYABLE as exc:
                last_err = exc
                if isinstance(exc, aiohttp.ClientResponseError):
                    # 4xx/5xx：400/404 不重试，5xx/429 重试
                    if exc.status in (400, 403, 404, 405, 406, 410, 422):
                        raise
                if isinstance(exc, _CONNECT_RETRYABLE):
                    # 连接级错误：站点瞬断/拒绝连接/连接重置，长退避等待恢复
                    if attempt >= self.connect_max_retries:
                        break
                    await asyncio.sleep(self.connect_backoff * (2 ** attempt) + random.uniform(0, 0.5))
                else:
                    if attempt >= self.max_retries:
                        break
                    await asyncio.sleep(self.retry_backoff * (2 ** attempt) + random.uniform(0, 0.3))
        raise last_err if last_err else RuntimeError(f"抓取失败: {url}")

    async def stream_to_file(
        self,
        url: str,
        dest_path: str,
        *,
        headers: Optional[Dict[str, str]] = None,
        timeout: Optional[float] = None,
        auth: Optional[Tuple[str, str]] = None,
        referer: str = "",
        verify_ssl: Optional[bool] = None,
        chunk_size: int = 65536,
    ) -> Tuple[int, Dict[str, str]]:
        """流式下载到本地文件，返回 (字节数, 响应头)"""
        import os

        session = await self._ensure_session()
        ssl_flag = self._ssl(verify_ssl if verify_ssl is not None else self.verify_ssl)
        tmo = aiohttp.ClientTimeout(total=timeout or max(self.timeout, 300))
        headers = {**self.headers, **(headers or {})}
        if referer:
            headers.setdefault("Referer", referer)
        if auth:
            headers.setdefault("Authorization", _basic_auth(*auth))

        last_err: Optional[Exception] = None
        for attempt in range(self.max_retries + 1):
            await self._bucket.acquire()   # 全局 QPS 限速（重试同样占额度）
            try:
                async with session.get(url, headers=headers, timeout=tmo, ssl=ssl_flag) as resp:
                    if resp.status >= 400:
                        raise aiohttp.ClientResponseError(
                            resp.request_info, resp.history, status=resp.status,
                            message=f"HTTP {resp.status} for {url}",
                        )
                    os.makedirs(os.path.dirname(dest_path) or ".", exist_ok=True)
                    total = 0
                    resp_headers = {k: v for k, v in resp.headers.items()}
                    with open(dest_path, "wb") as f:
                        async for chunk in resp.content.iter_chunked(chunk_size):
                            f.write(chunk)
                            total += len(chunk)
                    return total, resp_headers
            except _RETRYABLE as exc:
                last_err = exc
                if isinstance(exc, aiohttp.ClientResponseError) and exc.status in (400, 403, 404, 410):
                    raise
                if isinstance(exc, _CONNECT_RETRYABLE):
                    # 连接级错误：长退避等待站点恢复
                    if attempt >= self.connect_max_retries:
                        break
                    await asyncio.sleep(self.connect_backoff * (2 ** attempt) + random.uniform(0, 0.5))
                else:
                    if attempt >= self.max_retries:
                        break
                    await asyncio.sleep(self.retry_backoff * (2 ** attempt) + random.uniform(0, 0.3))
        raise last_err if last_err else RuntimeError(f"下载失败: {url}")

    async def close(self) -> None:
        if self.session is not None and not self.session.closed:
            await self.session.close()


def _basic_auth(user: str, pwd: str) -> str:
    import base64

    token = base64.b64encode(f"{user}:{pwd}".encode("utf-8")).decode("ascii")
    return f"Basic {token}"
