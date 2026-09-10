"""
爬虫基类 - 提供通用的会话管理、重试、日志、限速等能力
"""
import logging
import random
import time
from typing import Optional, Dict, Any

import cloudscraper
from tenacity import (
    retry,
    stop_after_attempt,
    wait_exponential,
    retry_if_exception_type,
    before_sleep_log,
)
import requests
from requests.exceptions import RequestException, Timeout, ConnectionError

from config import (
    MAX_RETRIES, REQUEST_TIMEOUT, MAX_REQUESTS_PER_SESSION,
    BATCH_REST_INTERVAL, USE_SELENIUM, HEADLESS, MIN_DELAY, MAX_DELAY,
)
from utils.anti_detect import AntiDetectSession

# 配置日志
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
logger = logging.getLogger("adobe_crawler")


class AdobeStockCrawlerBase:
    """Adobe Stock 爬虫基类"""

    def __init__(self, use_cloudscraper: bool = True, use_selenium: bool = False):
        """
        Args:
            use_cloudscraper: 是否使用 cloudscraper 绕过 Cloudflare（推荐）
            use_selenium: 是否使用 Selenium 浏览器渲染（最真实但较慢）
        """
        self.session = None
        self.request_count = 0
        self.use_cloudscraper = use_cloudscraper
        self.use_selenium = use_selenium or USE_SELENIUM
        self._init_session()

        # Selenium 相关（按需启用）
        self._driver = None

    def _init_session(self):
        """初始化 HTTP 会话"""
        if self.use_cloudscraper:
            # cloudscraper 内置 Cloudflare 绕过能力
            self.session = cloudscraper.create_scraper(
                browser={
                    "browser": "chrome",
                    "platform": "windows",
                    "desktop": True,
                },
                delay=random.uniform(2, 5),
            )
            logger.info("[Session] 使用 cloudscraper 初始化（具备 Cloudflare 绕过能力）")
        else:
            self.session = AntiDetectSession()
            logger.info("[Session] 使用 requests 会话初始化")

    def _get_selenium_driver(self):
        """懒加载 Selenium WebDriver"""
        if self._driver is not None:
            return self._driver
        try:
            from selenium import webdriver
            from selenium.webdriver.chrome.options import Options
            from selenium.webdriver.chrome.service import Service

            options = Options()
            if HEADLESS:
                options.add_argument("--headless=new")
            options.add_argument("--no-sandbox")
            options.add_argument("--disable-dev-shm-usage")
            options.add_argument("--disable-blink-features=AutomationControlled")
            options.add_argument("--window-size=1920,1080")
            options.add_experimental_option("excludeSwitches", ["enable-automation"])
            options.add_experimental_option("useAutomationExtension", False)

            try:
                from webdriver_manager.chrome import ChromeDriverManager
                service = Service(ChromeDriverManager().install())
                self._driver = webdriver.Chrome(service=service, options=options)
            except Exception:
                self._driver = webdriver.Chrome(options=options)

            # 注入反检测脚本
            self._driver.execute_cdp_cmd("Page.addScriptToEvaluateOnNewDocument", {
                "source": """
                    Object.defineProperty(navigator, 'webdriver', {get: () => undefined});
                    window.navigator.chrome = {runtime: {}};
                    Object.defineProperty(navigator, 'plugins', {get: () => [1, 2, 3, 4, 5]});
                    Object.defineProperty(navigator, 'languages', {get: () => ['ja', 'en-US', 'en']});
                """
            })
            logger.info("[Selenium] Chrome WebDriver 启动成功")
            return self._driver
        except Exception as e:
            logger.warning(f"[Selenium] 启动失败: {e}")
            self.use_selenium = False
            return None

    @retry(
        stop=stop_after_attempt(MAX_RETRIES),
        wait=wait_exponential(multiplier=1, min=2, max=30),
        retry=retry_if_exception_type((RequestException, Timeout, ConnectionError)),
        before_sleep=before_sleep_log(logger, logging.WARNING),
        reraise=True,
    )
    def fetch(self, url: str, **kwargs) -> Optional[str]:
        """
        抓取页面内容（带自动重试、限速、会话管理）

        Returns:
            页面 HTML 文本，失败返回 None
        """
        # 达到批次上限时休息
        self.request_count += 1
        if self.request_count > 0 and self.request_count % MAX_REQUESTS_PER_SESSION == 0:
            logger.info(
                f"[Rate Limit] 已请求 {self.request_count} 次，"
                f"休息 {BATCH_REST_INTERVAL} 秒..."
            )
            time.sleep(BATCH_REST_INTERVAL)

        timeout = kwargs.pop("timeout", REQUEST_TIMEOUT)

        # 使用 Selenium 模式
        if self.use_selenium:
            return self._fetch_with_selenium(url)

        # 使用 HTTP 请求模式
        if isinstance(self.session, AntiDetectSession):
            response = self.session.get(url, timeout=timeout, **kwargs)
        else:
            # cloudscraper
            time.sleep(random.uniform(MIN_DELAY, MAX_DELAY))
            response = self.session.get(url, timeout=timeout, **kwargs)

        # 检查状态码
        if response.status_code == 403:
            logger.warning(f"[403 Forbidden] 被 Cloudflare 拦截: {url}")
            # 尝试切换到 Selenium 模式
            if not self.use_selenium:
                logger.info("[Fallback] 尝试切换到 Selenium 浏览器模式...")
                self.use_selenium = True
                return self._fetch_with_selenium(url)
            response.raise_for_status()

        if response.status_code == 429:
            logger.warning("[429 Too Many Requests] 请求过于频繁，等待 60 秒...")
            time.sleep(60)
            raise RequestException("Rate limited")

        response.raise_for_status()
        response.encoding = response.apparent_encoding or "utf-8"
        logger.debug(f"[OK] {response.status_code} - {url}")
        return response.text

    def _fetch_with_selenium(self, url: str) -> Optional[str]:
        """使用 Selenium 获取页面内容（可绕过 Cloudflare）"""
        driver = self._get_selenium_driver()
        if not driver:
            logger.error("[Selenium] WebDriver 不可用")
            return None

        logger.info(f"[Selenium] 正在加载: {url}")
        driver.get(url)

        # 等待页面加载
        time.sleep(random.uniform(3, 7))

        # 检查是否出现 Cloudflare 验证页面
        page_title = driver.title.lower()
        if "just a moment" in page_title or "attention required" in page_title:
            logger.info("[Selenium] 检测到 Cloudflare 验证，等待自动通过...")
            time.sleep(10)  # 等待 Cloudflare JS 验证完成

        # 滚动页面触发懒加载
        driver.execute_script("window.scrollTo(0, document.body.scrollHeight / 2);")
        time.sleep(random.uniform(1, 2))

        html = driver.page_source
        logger.info(f"[Selenium] 页面加载完成，HTML 长度: {len(html)}")
        return html

    def close(self):
        """关闭所有会话"""
        if self._driver:
            try:
                self._driver.quit()
            except Exception:
                pass
            self._driver = None
        if isinstance(self.session, AntiDetectSession):
            self.session.close()
        logger.info(f"[Close] 爬虫结束，总计请求: {self.request_count} 次")

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        self.close()
        return False
