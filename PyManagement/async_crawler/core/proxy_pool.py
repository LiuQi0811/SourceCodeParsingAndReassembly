# core/proxy_pool.py
import aiohttp
import random
from typing import List, Optional


class ProxyPool:
    def __init__(self, proxy_list: List[str]):
        self.proxy_list = proxy_list
        self.bad_proxy = set()

    async def check_proxy(self, proxy: str) -> bool:
        """检测代理是否可用"""
        try:
            async with aiohttp.ClientSession() as session:
                async with session.get("https://www.baidu.com", proxy=proxy, timeout=aiohttp.ClientTimeout(total=5)):
                    return True
        except Exception:
            return False

    async def get_proxy(self) -> Optional[str]:
        """获取可用代理，失败代理自动剔除"""
        available = [p for p in self.proxy_list if p not in self.bad_proxy]
        if not available:
            return None
        proxy = random.choice(available)
        if not await self.check_proxy(proxy):
            self.bad_proxy.add(proxy)
            return await self.get_proxy()
        return proxy
