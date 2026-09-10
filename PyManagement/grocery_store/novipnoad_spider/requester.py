#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
HTTP 请求模块 - 集成 Cloudflare 绕过、自动重试、伪装
支持多种CF绕过方式：cloudscraper -> undetected-chromedriver -> playwright
"""
import time
import random
import logging
import cloudscraper
import requests
from fake_useragent import UserAgent
from tenacity import retry, stop_after_attempt, wait_exponential, retry_if_exception_type
from config import HEADERS, TIMEOUT, MAX_RETRIES, REQUEST_DELAY, PROXY, USE_PROXY, FALLBACK_TO_BROWSER

logger = logging.getLogger(__name__)

ua = UserAgent()


def get_random_headers():
    """生成随机请求头"""
    headers = HEADERS.copy()
    headers["User-Agent"] = ua.random
    return headers


class Requester:
    """统一请求器，自动处理 Cloudflare 防护"""

    def __init__(self):
        self.session = None
        self.scraper = None
        self.browser = None
        self._init_cloudscraper()

    def _init_cloudscraper(self):
        """初始化 cloudscraper（绕过 Cloudflare 5秒盾）"""
        try:
            self.scraper = cloudscraper.create_scraper(
                browser={
                    'browser': 'chrome',
                    'platform': 'windows',
                    'desktop': True
                },
                delay=10
            )
            self.scraper.headers.update(get_random_headers())
            if USE_PROXY and PROXY:
                self.scraper.proxies = {"http": PROXY, "https": PROXY}
            logger.info("cloudscraper 初始化成功")
        except Exception as e:
            logger.warning(f"cloudscraper 初始化失败: {e}")
            self.scraper = None

    def _init_browser(self):
        """初始化 undetected-chromedriver（强力CF绕过）"""
        if self.browser is not None:
            return
        try:
            import undetected_chromedriver as uc
            options = uc.ChromeOptions()
            options.add_argument("--headless=new")
            options.add_argument("--no-sandbox")
            options.add_argument("--disable-dev-shm-usage")
            options.add_argument("--disable-gpu")
            options.add_argument(f"--user-agent={ua.random}")
            options.add_argument("--lang=zh-CN,zh;q=0.9")
            if USE_PROXY and PROXY:
                options.add_argument(f"--proxy-server={PROXY}")
            self.browser = uc.Chrome(options=options, version_main=120)
            self.browser.set_page_load_timeout(TIMEOUT)
            logger.info("undetected-chromedriver 初始化成功")
        except Exception as e:
            logger.warning(f"undetected-chromedriver 初始化失败: {e}")
            self.browser = None
            self._init_playwright()

    def _init_playwright(self):
        """初始化 playwright（备选浏览器方案）"""
        try:
            from playwright.sync_api import sync_playwright
            self._playwright = sync_playwright().start()
            self.browser = self._playwright.chromium.launch(
                headless=True,
                proxy={"server": PROXY} if (USE_PROXY and PROXY) else None
            )
            self.context = self.browser.new_context(user_agent=ua.random)
            self.page = self.context.new_page()
            logger.info("playwright 初始化成功")
        except Exception as e:
            logger.warning(f"playwright 初始化失败: {e}")
            self.browser = None

    @retry(
        stop=stop_after_attempt(MAX_RETRIES),
        wait=wait_exponential(multiplier=1, min=2, max=30),
        retry=retry_if_exception_type((requests.exceptions.RequestException,)),
        reraise=True
    )
    def get(self, url, use_browser=None, **kwargs):
        """
        发送 GET 请求，自动重试
        :param url: 目标 URL
        :param use_browser: 是否强制使用浏览器（None=自动判断）
        """
        time.sleep(random.uniform(*REQUEST_DELAY))

        # 如果明确要求使用浏览器
        if use_browser is True:
            return self._browser_get(url)

        # 1. 优先使用 cloudscraper
        if self.scraper:
            try:
                resp = self.scraper.get(url, timeout=kwargs.get("timeout", TIMEOUT), **kwargs)
                if resp.status_code == 200 and "cloudflare" not in resp.text.lower()[:500]:
                    resp.encoding = resp.apparent_encoding or "utf-8"
                    return resp
                elif resp.status_code == 403 or "cf-wrapper" in resp.text[:2000]:
                    logger.info(f"cloudscraper 被拦截({resp.status_code})，尝试浏览器模式: {url}")
            except Exception as e:
                logger.warning(f"cloudscraper 请求失败: {e}")

        # 2. 回退到浏览器模式
        if FALLBACK_TO_BROWSER or use_browser is True:
            return self._browser_get(url)

        raise Exception(f"所有请求方式均失败: {url}")

    def _browser_get(self, url):
        """使用浏览器获取页面（绕过最严格的CF检测）"""
        self._init_browser()
        if self.browser is None:
            raise Exception("浏览器初始化失败，无法绕过 Cloudflare")

        try:
            if hasattr(self, 'page'):  # playwright
                self.page.goto(url, wait_until="networkidle", timeout=TIMEOUT * 1000)
                # 等待 CF 验证通过（最多 30 秒）
                for _ in range(30):
                    content = self.page.content()
                    if "Checking your browser" not in content and "cf-wrapper" not in content[:2000]:
                        break
                    time.sleep(1)
                html = self.page.content()
            else:  # undetected-chromedriver
                self.browser.get(url)
                # 等待 CF 验证
                for _ in range(30):
                    if "Checking your browser" not in self.browser.page_source and "cf-wrapper" not in self.browser.page_source[:2000]:
                        break
                    time.sleep(1)
                html = self.browser.page_source

            # 构造类似 requests 的响应对象
            class FakeResponse:
                def __init__(self, text, status_code=200, url_=url):
                    self.text = text
                    self.status_code = status_code
                    self.url = url_
                    self.encoding = "utf-8"
            return FakeResponse(html)
        except Exception as e:
            logger.error(f"浏览器请求失败: {e}")
            raise

    def post(self, url, data=None, json=None, **kwargs):
        """发送 POST 请求"""
        time.sleep(random.uniform(*REQUEST_DELAY))
        if self.scraper:
            resp = self.scraper.post(url, data=data, json=json, timeout=kwargs.get("timeout", TIMEOUT), **kwargs)
            resp.encoding = resp.apparent_encoding or "utf-8"
            return resp
        raise Exception("scraper 未初始化")

    def get_cookies(self):
        """获取当前 cookies（用于其他请求）"""
        if self.scraper:
            return self.scraper.cookies.get_dict()
        return {}

    def close(self):
        """关闭资源"""
        if self.browser:
            try:
                self.browser.quit()
            except:
                pass
        if hasattr(self, '_playwright'):
            try:
                self._playwright.stop()
            except:
                pass


# 全局单例
requester = Requester()
