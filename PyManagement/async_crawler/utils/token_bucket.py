# utils/token_bucket.py
import asyncio
import time
from typing import Dict

class AsyncTokenBucket:
    """异步令牌桶，用于RPS限速，每个域名独立实例"""
    def __init__(self, capacity: float, refill_rate: float):
        """
        :param capacity: 令牌桶最大容量（最大突发请求数）
        :param refill_rate: 每秒补充令牌数量(RPS)
        """
        self.capacity = capacity
        self.refill_rate = refill_rate
        self.tokens = capacity
        self.last_refill_ts = time.time()
        self._lock = asyncio.Lock()

    async def acquire(self, count: float = 1.0):
        """获取令牌，不足则阻塞等待"""
        async with self._lock:
            now = time.time()
            delta = now - self.last_refill_ts
            self.tokens = min(self.capacity, self.tokens + delta * self.refill_rate)
            self.last_refill_ts = now

            while self.tokens < count:
                need = count - self.tokens
                sleep_sec = need / self.refill_rate
                await asyncio.sleep(sleep_sec)
                now = time.time()
                delta = now - self.last_refill_ts
                self.tokens = min(self.capacity, self.tokens + delta * self.refill_rate)
                self.last_refill_ts = now
            self.tokens -= count


class DomainRateLimiter:
    """域名级令牌桶管理器，不同域名独立限速"""
    def __init__(self, default_rps: float = 2.0, default_burst: float = 2.0):
        self.default_rps = default_rps
        self.default_burst = default_burst
        self.bucket_map: Dict[str, AsyncTokenBucket] = dict()
        self._lock = asyncio.Lock()

    async def get_bucket(self, domain: str) -> AsyncTokenBucket:
        async with self._lock:
            if domain not in self.bucket_map:
                # 可以在这里配置单独域名的自定义RPS
                self.bucket_map[domain] = AsyncTokenBucket(capacity=self.default_burst, refill_rate=self.default_rps)
            return self.bucket_map[domain]

    async def wait(self, domain: str):
        bucket = await self.get_bucket(domain)
        await bucket.acquire(1.0)
