"""asyncio + aiohttp 异步请求器"""
import asyncio
import aiohttp
from .encoding_detector import EncodingDetector


class HttpFetcher:
    DEFAULT_HEADERS = {
        "User-Agent": (
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
            "AppleWebKit/537.36 (KHTML, like Gecko) "
            "Chrome/131.0.0.0 Safari/537.36"
        ),
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
        "Connection": "keep-alive",
    }

    def __init__(self, concurrency: int = 20, timeout: int = 30,
                 retries: int = 3, headers: dict | None = None):
        self.semaphore = asyncio.Semaphore(concurrency)
        self.timeout = aiohttp.ClientTimeout(total=timeout)
        self.retries = retries
        # 用户自定义请求头（Cookie、UA、Referer 等）合并进全局默认
        self.extra_headers = dict(headers or {})
        self._session: aiohttp.ClientSession | None = None

    @property
    def default_headers(self) -> dict:
        merged = dict(self.DEFAULT_HEADERS)
        merged.update(self.extra_headers)
        return merged
        self.semaphore = asyncio.Semaphore(concurrency)
        self.timeout = aiohttp.ClientTimeout(total=timeout)
        self.retries = retries
        self._session: aiohttp.ClientSession | None = None

    async def start(self):
        if not self._session or self._session.closed:
            connector = aiohttp.TCPConnector(
                limit=self.semaphore._value * 2,
                ttl_dns_cache=300,
                enable_cleanup_closed=True,
            )
            self._session = aiohttp.ClientSession(
                connector=connector,
                timeout=self.timeout,
                headers=self.default_headers,
            )

    async def close(self):
        if self._session and not self._session.closed:
            await self._session.close()

    async def fetch_text(self, url: str) -> tuple[int, str, str]:
        last_exc: Exception | None = None
        for attempt in range(self.retries):
            try:
                async with self.semaphore:
                    async with self._session.get(url) as resp:
                        raw = await resp.read()
                        content_type = resp.headers.get("Content-Type", "")
                        text = EncodingDetector.decode(raw, content_type)
                        return resp.status, text, content_type
            except (aiohttp.ClientError, asyncio.TimeoutError) as e:
                last_exc = e
                if attempt == self.retries - 1:
                    raise
                await asyncio.sleep(2 ** attempt)
        raise last_exc if last_exc else RuntimeError("fetch_text failed")

    async def fetch_bytes(self, url: str,
                          headers: dict | None = None) -> bytes:
        req_headers = dict(self.default_headers)
        if headers:
            req_headers.update(headers)
        async with self.semaphore:
            async with self._session.get(url, headers=req_headers) as resp:
                resp.raise_for_status()
                return await resp.read()