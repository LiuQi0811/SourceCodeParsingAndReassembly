"""异步下载器模块 - 工厂模式创建 ClientSession，带重试、代理、UA 随机"""
import asyncio
import random
from typing import Optional, Tuple
import aiohttp
from fake_useragent import UserAgent

from .config import Config
from .utils import setup_logger

logger = setup_logger("spider.downloader")


class Downloader:
    """异步 HTTP 下载器"""

    def __init__(self, config: Config):
        self.config = config
        self._session: Optional[aiohttp.ClientSession] = None
        self._ua = UserAgent(fallback="Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                                       "AppleWebKit/537.36 (KHTML, like Gecko) "
                                       "Chrome/125.0.0.0 Safari/537.36")
        self._semaphore: Optional[asyncio.Semaphore] = None

    async def init(self):
        if self._session is not None and not self._session.closed:
            return
        connector = aiohttp.TCPConnector(
            limit=self.config.concurrency,
            ssl=self.config.verify_ssl,
            ttl_dns_cache=300,
            enable_cleanup_closed=True
        )
        timeout = aiohttp.ClientTimeout(total=self.config.timeout)
        self._session = aiohttp.ClientSession(connector=connector, timeout=timeout)
        self._semaphore = asyncio.Semaphore(self.config.concurrency)
        logger.info(f"Downloader 初始化完成，并发={self.config.concurrency}")

    async def close(self):
        if self._session and not self._session.closed:
            await self._session.close()
            logger.info("Downloader 已关闭")

    def _build_headers(self) -> dict:
        headers = {
            "User-Agent": self.config.user_agent or self._ua.random,
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
            "Accept-Encoding": "gzip, deflate",
            "Connection": "keep-alive",
        }
        headers.update(self.config.headers)
        return headers

    async def fetch(self, url: str) -> Tuple[Optional[bytes], int, dict]:
        """
        下载单个 URL，内部带重试。
        返回 (content_bytes, status_code, response_headers)；失败返回 (None, 0, {})
        """
        await self.init()
        last_err = None
        for attempt in range(1, self.config.max_retries + 1):
            try:
                async with self._semaphore:
                    # 请求间隔
                    delay = self.config.delay
                    if self.config.random_delay:
                        delay = delay * random.uniform(0.5, 1.5)
                    await asyncio.sleep(delay)

                    proxy = self.config.proxy
                    async with self._session.get(
                        url,
                        headers=self._build_headers(),
                        cookies=self.config.cookies,
                        proxy=proxy,
                        allow_redirects=True,
                        max_redirects=10,
                    ) as resp:
                        if resp.status in self.config.retry_on_status and attempt < self.config.max_retries:
                            raise aiohttp.ClientResponseError(
                                resp.request_info, resp.history,
                                status=resp.status, message=f"retry status {resp.status}"
                            )
                        content = await resp.read()
                        if 200 <= resp.status < 400:
                            return content, resp.status, dict(resp.headers)
                        else:
                            logger.warning(f"[{resp.status}] {url}")
                            return None, resp.status, dict(resp.headers)
            except (aiohttp.ClientError, asyncio.TimeoutError, OSError) as e:
                last_err = e
                wait = self.config.retry_delay * (self.config.retry_backoff ** (attempt - 1))
                logger.warning(f"尝试 {attempt}/{self.config.max_retries} 失败: {url} -> {e}, {wait:.1f}s 后重试")
                await asyncio.sleep(wait)
        logger.error(f"下载失败（已重试 {self.config.max_retries} 次）: {url} -> {last_err}")
        return None, 0, {}
