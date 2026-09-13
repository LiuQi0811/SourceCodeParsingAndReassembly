"""
动态代理池模块
支持多种代理轮换策略、自动检测可用性、失败剔除
设计模式：策略模式 + 观察者模式
"""
import asyncio
import random
from typing import List, Optional, Dict, Set
from dataclasses import dataclass, field
from enum import Enum
from abc import ABC, abstractmethod

from utils.logger import get_logger

logger = get_logger("ProxyPool")


class ProxyRotationStrategy(Enum):
    ROUND_ROBIN = "round_robin"
    RANDOM = "random"
    LEAST_USED = "least_used"


@dataclass
class Proxy:
    """代理节点信息"""
    url: str
    is_valid: bool = True
    use_count: int = 0
    fail_count: int = 0
    last_used: float = 0.0
    response_time: float = 0.0
    protocol: str = "http"


class RotationStrategy(ABC):
    """轮换策略抽象基类"""
    @abstractmethod
    def select(self, proxies: List[Proxy]) -> Optional[Proxy]:
        pass


class RoundRobinStrategy(RotationStrategy):
    """轮询策略"""
    def __init__(self):
        self._index = 0

    def select(self, proxies: List[Proxy]) -> Optional[Proxy]:
        valid = [p for p in proxies if p.is_valid]
        if not valid:
            return None
        proxy = valid[self._index % len(valid)]
        self._index += 1
        return proxy


class RandomStrategy(RotationStrategy):
    """随机策略"""
    def select(self, proxies: List[Proxy]) -> Optional[Proxy]:
        valid = [p for p in proxies if p.is_valid]
        return random.choice(valid) if valid else None


class LeastUsedStrategy(RotationStrategy):
    """最少使用策略"""
    def select(self, proxies: List[Proxy]) -> Optional[Proxy]:
        valid = [p for p in proxies if p.is_valid]
        if not valid:
            return None
        return min(valid, key=lambda p: p.use_count)


STRATEGY_MAP = {
    ProxyRotationStrategy.ROUND_ROBIN: RoundRobinStrategy(),
    ProxyRotationStrategy.RANDOM: RandomStrategy(),
    ProxyRotationStrategy.LEAST_USED: LeastUsedStrategy(),
}


class ProxyPool:
    """动态代理池（单例）"""
    _instance = None

    def __init__(self):
        self._proxies: List[Proxy] = []
        self._strategy: RotationStrategy = RoundRobinStrategy()
        self._lock = asyncio.Lock()
        self._blacklist: Set[str] = set()
        self._max_fail_count = 3
        self._test_url = "http://httpbin.org/ip"
        self._test_timeout = 5

    @classmethod
    def get_instance(cls) -> "ProxyPool":
        if cls._instance is None:
            cls._instance = ProxyPool()
        return cls._instance

    def set_strategy(self, strategy: ProxyRotationStrategy):
        """设置代理轮换策略"""
        self._strategy = STRATEGY_MAP.get(strategy, RoundRobinStrategy())
        logger.info(f"代理轮换策略设置为: {strategy.value}")

    def add_proxy(self, proxy_url: str):
        """添加代理"""
        if proxy_url in self._blacklist:
            return
        # 去重
        for p in self._proxies:
            if p.url == proxy_url:
                return
        proxy = Proxy(url=proxy_url)
        if proxy_url.startswith("socks"):
            proxy.protocol = "socks"
        self._proxies.append(proxy)
        logger.debug(f"添加代理: {proxy_url}")

    def add_proxies(self, proxy_urls: List[str]):
        """批量添加代理"""
        for url in proxy_urls:
            self.add_proxy(url)

    async def get_proxy(self) -> Optional[str]:
        """获取一个可用代理"""
        async with self._lock:
            proxy = self._strategy.select(self._proxies)
            if proxy:
                proxy.use_count += 1
                import time
                proxy.last_used = time.time()
                return proxy.url
            return None

    async def report_success(self, proxy_url: str, response_time: float = 0.0):
        """报告代理使用成功"""
        async with self._lock:
            for p in self._proxies:
                if p.url == proxy_url:
                    p.fail_count = 0
                    p.response_time = response_time
                    p.is_valid = True
                    break

    async def report_fail(self, proxy_url: str):
        """报告代理使用失败，连续失败超过阈值则拉黑"""
        async with self._lock:
            for p in self._proxies:
                if p.url == proxy_url:
                    p.fail_count += 1
                    if p.fail_count >= self._max_fail_count:
                        p.is_valid = False
                        self._blacklist.add(proxy_url)
                        logger.warning(f"代理 {proxy_url} 连续失败{p.fail_count}次，已加入黑名单")
                    break

    async def check_proxy(self, proxy: Proxy, session=None) -> bool:
        """检测单个代理可用性"""
        import aiohttp
        try:
            if session is None:
                session = aiohttp.ClientSession()
                should_close = True
            else:
                should_close = False
            start = asyncio.get_event_loop().time()
            async with session.get(
                self._test_url,
                proxy=proxy.url,
                timeout=aiohttp.ClientTimeout(total=self._test_timeout)
            ) as resp:
                if resp.status == 200:
                    elapsed = asyncio.get_event_loop().time() - start
                    proxy.is_valid = True
                    proxy.response_time = elapsed
                    proxy.fail_count = 0
                    if should_close:
                        await session.close()
                    return True
        except Exception:
            pass
        proxy.is_valid = False
        if should_close and session:
            await session.close()
        return False

    async def health_check(self):
        """对所有代理进行健康检测"""
        import aiohttp
        async with aiohttp.ClientSession() as session:
            tasks = [self.check_proxy(p, session) for p in self._proxies]
            results = await asyncio.gather(*tasks, return_exceptions=True)
        valid_count = sum(1 for r in results if r is True)
        logger.info(f"代理健康检测完成，可用代理数: {valid_count}/{len(self._proxies)}")

    def valid_count(self) -> int:
        return sum(1 for p in self._proxies if p.is_valid)

    def total_count(self) -> int:
        return len(self._proxies)

    def load_from_file(self, file_path: str):
        """从文件加载代理列表，每行一个代理URL"""
        from pathlib import Path
        path = Path(file_path)
        if not path.exists():
            logger.warning(f"代理文件不存在: {file_path}")
            return
        with open(path, "r", encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith("#"):
                    self.add_proxy(line)
        logger.info(f"从 {file_path} 加载代理 {self.total_count()} 个")

    def reset(self):
        """重置代理池"""
        self._proxies.clear()
        self._blacklist.clear()
