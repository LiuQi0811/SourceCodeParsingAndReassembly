
from base.base_crawler import  AbstractCrawler
from tools import utils
import config
from playwright.async_api import (async_playwright)

class BilibiliCrawler(AbstractCrawler):
    def __init__(self):
        self.index_url = "https://www.bilibili.com"
        self.cookie_urls = [self.index_url]
        self.user_agent = utils.get_user_agent()
        self.cdp_manager = None
        self.ip_proxy_pool = None # Proxy IP pool for automatic proxy refresh

    async def start(self):
        playwright_proxy_format,httpx_proxy_format = None,None
        if config.ENABLE_IP_PROXY:
            print(" start  bilibili crawler .....",self.__dict__)

        async with async_playwright() as playwright:
            print(" async Playwright ......")
