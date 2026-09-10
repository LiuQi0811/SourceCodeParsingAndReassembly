"""
反检测工具模块 - 模拟真实浏览器行为，降低被反爬系统识别的概率
"""
import random
import time
from typing import Optional

import requests
from fake_useragent import UserAgent

from config import DEFAULT_HEADERS, FALLBACK_USER_AGENTS, PROXIES, MIN_DELAY, MAX_DELAY


class AntiDetectSession:
    """具备反检测能力的会话包装器"""

    def __init__(self):
        self.session = requests.Session()
        self._ua = None
        try:
            self._ua = UserAgent(browsers=['chrome', 'firefox', 'safari'])
        except Exception:
            self._ua = None  # fake-useragent 在线获取失败时使用备用列表
        self._init_session()

    def _init_session(self):
        """初始化会话，设置基础请求头"""
        self.rotate_user_agent()
        self.session.headers.update(DEFAULT_HEADERS)
        if PROXIES:
            self.session.proxies.update(PROXIES)
        # 设置一些初始 cookies 模拟真实访问
        self._warmup()

    def rotate_user_agent(self):
        """轮换 User-Agent"""
        if self._ua:
            try:
                ua = self._ua.random
            except Exception:
                ua = random.choice(FALLBACK_USER_AGENTS)
        else:
            ua = random.choice(FALLBACK_USER_AGENTS)
        self.session.headers["User-Agent"] = ua
        return ua

    def _warmup(self):
        """预热会话：先访问首页建立 cookie，模拟真实用户行为"""
        try:
            # 访问首页获取初始 cookies
            self.session.get(
                "https://stock.adobe.com/jp",
                timeout=15,
                allow_redirects=True,
            )
            time.sleep(random.uniform(1.0, 3.0))
        except Exception:
            pass  # 预热失败不阻断主流程

    def random_delay(self, min_delay: float = MIN_DELAY, max_delay: float = MAX_DELAY):
        """随机延迟，模拟人类浏览间隔"""
        delay = random.uniform(min_delay, max_delay)
        time.sleep(delay)
        return delay

    def human_like_scroll_delay(self):
        """模拟人类滚动页面的短延迟"""
        time.sleep(random.uniform(0.3, 1.5))

    def get(self, url: str, **kwargs) -> requests.Response:
        """
        发送 GET 请求，自动附带：
        - 轮换 Referer
        - 随机延迟
        - 真实请求头
        """
        # 随机添加 Referer（模拟从搜索结果等页面跳转而来）
        referers = [
            "https://www.google.com/",
            "https://www.google.co.jp/",
            "https://www.bing.com/",
            "https://search.yahoo.co.jp/",
            "https://stock.adobe.com/jp",
        ]
        if random.random() < 0.7:
            self.session.headers["Referer"] = random.choice(referers)

        # 设置 Accept（根据 URL 类型调整）
        if url.endswith((".jpg", ".png", ".webp")):
            self.session.headers["Accept"] = "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8"
        elif "/api/" in url:
            self.session.headers["Accept"] = "application/json, text/plain, */*"
        else:
            self.session.headers["Accept"] = DEFAULT_HEADERS["Accept"]

        # 随机延迟
        self.random_delay()

        # 小概率轮换 User-Agent
        if random.random() < 0.1:
            self.rotate_user_agent()

        # 发起请求
        response = self.session.get(url, **kwargs)
        return response

    def close(self):
        """关闭会话"""
        self.session.close()
