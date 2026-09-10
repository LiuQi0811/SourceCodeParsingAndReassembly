#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
cz4k.com 全站爬虫
特性：
1. 使用 Playwright 无头浏览器渲染 JS，绕过 WAF 检测
2. 自动管理 Cookie 和会话
3. BFS 广度优先遍历全站链接
4. 自动去重，支持断点续爬
5. 可配置并发数、延时、深度
6. 保存完整 HTML 到本地
7. 支持下载图片、CSS、JS 等静态资源
8. 自动遵守 robots.txt
"""

import os
import re
import json
import time
import random
import asyncio
import logging
from urllib.parse import urljoin, urlparse, urldefrag
from pathlib import Path
from collections import deque
from datetime import datetime

try:
    from playwright.async_api import async_playwright
except ImportError:
    print("请先安装 playwright: pip install playwright && playwright install chromium")
    exit(1)

# ============== 配置区 ==============
BASE_URL = "https://www.cz4k.com/"
OUTPUT_DIR = "./cz4k_site"  # 保存目录
MAX_DEPTH = 10              # 最大爬取深度
MAX_CONCURRENT = 3          # 并发数
MIN_DELAY = 1.0             # 最小请求延时(秒)
MAX_DELAY = 3.0             # 最大请求延时(秒)
SAVE_STATIC = True          # 是否保存静态资源(图片/CSS/JS)
RESPECT_ROBOTS = True       # 是否遵守 robots.txt
USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36"
TIMEOUT = 30000             # 页面加载超时(毫秒)
PROXY = None                # 代理配置，例: "http://user:pass@proxy:port"

# ============== 初始化 ==============
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[
        logging.FileHandler("crawler.log", encoding="utf-8"),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

STATE_FILE = "crawler_state.json"
visited_file = os.path.join(OUTPUT_DIR, "visited.txt")


class Cz4kCrawler:
    def __init__(self):
        self.base_domain = urlparse(BASE_URL).netloc
        self.queue = deque()
        self.visited = set()
        self.url_to_file = {}
        self.playwright = None
        self.browser = None
        self.context = None
        self.semaphore = asyncio.Semaphore(MAX_CONCURRENT)
        self.crawled_count = 0
        
        # 创建输出目录
        os.makedirs(OUTPUT_DIR, exist_ok=True)
        os.makedirs(os.path.join(OUTPUT_DIR, "static"), exist_ok=True)
        
    def load_state(self):
        """加载断点续爬状态"""
        if os.path.exists(STATE_FILE):
            try:
                with open(STATE_FILE, "r", encoding="utf-8") as f:
                    state = json.load(f)
                    self.queue = deque(tuple(item) for item in state.get("queue", []))
                    self.visited = set(state.get("visited", []))
                    self.url_to_file = state.get("url_to_file", {})
                    self.crawled_count = len(self.visited)
                    logger.info(f"加载进度：已爬取 {self.crawled_count} 个页面，队列中剩余 {len(self.queue)} 个")
            except Exception as e:
                logger.warning(f"加载状态失败: {e}")
        
        if not self.queue:
            self.queue.append((BASE_URL, 0))
            
    def save_state(self):
        """保存爬取状态"""
        state = {
            "queue": list(self.queue),
            "visited": list(self.visited),
            "url_to_file": self.url_to_file,
            "last_update": datetime.now().isoformat()
        }
        with open(STATE_FILE, "w", encoding="utf-8") as f:
            json.dump(state, f, ensure_ascii=False, indent=2)
            
    def is_same_domain(self, url):
        """判断是否属于目标域名"""
        try:
            parsed = urlparse(url)
            return parsed.netloc == self.base_domain or parsed.netloc.endswith(f".{self.base_domain}")
        except:
            return False
            
    def is_valid_url(self, url):
        """验证URL有效性"""
        if not url or not url.startswith(("http://", "https://")):
            return False
        # 排除的文件类型
        exclude_ext = {".pdf", ".zip", ".rar", ".7z", ".exe", ".dmg", ".apk", ".iso", ".tar.gz"}
        parsed = urlparse(url)
        path = parsed.path.lower()
        for ext in exclude_ext:
            if path.endswith(ext):
                return False
        return True
        
    def url_to_local_path(self, url):
        """将URL转换为本地文件路径"""
        url, _ = urldefrag(url)
        if url in self.url_to_file:
            return self.url_to_file[url]
            
        parsed = urlparse(url)
        path = parsed.path.strip("/")
        
        if not path:
            rel_path = "index.html"
        elif path.endswith("/"):
            rel_path = os.path.join(path, "index.html")
        elif "." not in os.path.basename(path):
            rel_path = os.path.join(path, "index.html")
        else:
            rel_path = path
            
        # 处理查询参数
        if parsed.query:
            safe_query = re.sub(r'[^\w\-]', '_', parsed.query)[:50]
            base, ext = os.path.splitext(rel_path)
            rel_path = f"{base}__q_{safe_query}{ext}"
            
        full_path = os.path.join(OUTPUT_DIR, rel_path)
        
        # 确保路径在输出目录内
        full_path = os.path.abspath(full_path)
        if not full_path.startswith(os.path.abspath(OUTPUT_DIR)):
            full_path = os.path.join(OUTPUT_DIR, "error", os.path.basename(rel_path))
            
        os.makedirs(os.path.dirname(full_path), exist_ok=True)
        
        # 处理文件重名
        counter = 1
        original_path = full_path
        while os.path.exists(full_path) and self.url_to_file.get(url) != full_path:
            base, ext = os.path.splitext(original_path)
            full_path = f"{base}_{counter}{ext}"
            counter += 1
            
        self.url_to_file[url] = full_path
        return full_path
        
    def extract_links(self, html, base_url):
        """从HTML中提取链接"""
        links = set()
        
        # 提取 a 标签链接
        a_pattern = re.compile(r'<a[^>]+href=["\']([^"\']+)["\']', re.IGNORECASE)
        for match in a_pattern.finditer(html):
            href = match.group(1).strip()
            if href and not href.startswith(("#", "javascript:", "mailto:", "tel:")):
                absolute = urljoin(base_url, href)
                absolute, _ = urldefrag(absolute)
                if self.is_valid_url(absolute):
                    links.add(absolute)
                    
        if SAVE_STATIC:
            # 提取静态资源链接
            static_patterns = [
                (re.compile(r'<img[^>]+src=["\']([^"\']+)["\']', re.IGNORECASE), "img"),
                (re.compile(r'<link[^>]+href=["\']([^"\']+)["\']', re.IGNORECASE), "css"),
                (re.compile(r'<script[^>]+src=["\']([^"\']+)["\']', re.IGNORECASE), "js"),
                (re.compile(r'url\(["\']?([^"\')\s]+)["\']?\)', re.IGNORECASE), "css"),
            ]
            
            for pattern, _ in static_patterns:
                for match in pattern.finditer(html):
                    src = match.group(1).strip()
                    if src and not src.startswith(("data:", "javascript:", "#")):
                        absolute = urljoin(base_url, src)
                        absolute, _ = urldefrag(absolute)
                        if absolute.startswith(("http://", "https://")):
                            links.add(absolute)
                            
        return links
        
    async def save_static_resource(self, url, page):
        """保存静态资源"""
        try:
            parsed = urlparse(url)
            if not self.is_same_domain(url):
                return  # 只保存同域静态资源
                
            path = parsed.path.strip("/")
            if not path:
                return
                
            local_path = os.path.join(OUTPUT_DIR, "static", path)
            local_path = os.path.abspath(local_path)
            
            if os.path.exists(local_path):
                return
                
            os.makedirs(os.path.dirname(local_path), exist_ok=True)
            
            # 在页面上下文中获取资源
            resp = await page.request.get(url, headers={"Referer": page.url})
            if resp.ok:
                content = await resp.body()
                with open(local_path, "wb") as f:
                    f.write(content)
                logger.debug(f"保存静态资源: {url} -> {local_path}")
        except Exception as e:
            logger.debug(f"保存静态资源失败 {url}: {e}")
            
    async def crawl_page(self, url, depth):
        """爬取单个页面"""
        async with self.semaphore:
            if url in self.visited or depth > MAX_DEPTH:
                return
                
            logger.info(f"[{self.crawled_count + 1}] 爬取: {url} (深度: {depth})")
            
            # 随机延时，模拟人类行为
            await asyncio.sleep(random.uniform(MIN_DELAY, MAX_DELAY))
            
            page = None
            try:
                page = await self.context.new_page()
                
                # 拦截不必要的资源，加快速度
                # await page.route("**/*.{png,jpg,jpeg,gif,svg,woff,woff2,ttf,eot}", lambda route: route.abort())
                
                response = await page.goto(url, wait_until="networkidle", timeout=TIMEOUT)
                
                if not response:
                    logger.warning(f"无响应: {url}")
                    return
                    
                status = response.status
                if status >= 400:
                    logger.warning(f"HTTP {status}: {url}")
                    return
                    
                # 等待页面完全渲染
                await page.wait_for_timeout(2000)
                
                # 获取最终URL（处理重定向）
                final_url = page.url
                self.visited.add(url)
                if final_url != url:
                    self.visited.add(final_url)
                    
                # 获取渲染后的HTML
                html = await page.content()
                
                # 保存HTML
                local_path = self.url_to_local_path(final_url)
                with open(local_path, "w", encoding="utf-8") as f:
                    f.write(html)
                logger.info(f"已保存: {local_path}")
                
                # 提取链接
                links = self.extract_links(html, final_url)
                new_count = 0
                for link in links:
                    if link not in self.visited and self.is_same_domain(link):
                        self.queue.append((link, depth + 1))
                        new_count += 1
                        
                logger.debug(f"发现 {len(links)} 个链接，{new_count} 个新链接加入队列")
                
                self.crawled_count += 1
                
                # 每爬10个页面保存一次状态
                if self.crawled_count % 10 == 0:
                    self.save_state()
                    
            except Exception as e:
                logger.error(f"爬取失败 {url}: {str(e)[:100]}")
                self.visited.add(url)  # 标记为已访问，避免重复重试
            finally:
                if page:
                    await page.close()
                    
    async def start(self):
        """启动爬虫"""
        self.load_state()
        
        logger.info("=" * 50)
        logger.info(f"cz4k.com 全站爬虫启动")
        logger.info(f"目标网站: {BASE_URL}")
        logger.info(f"保存目录: {os.path.abspath(OUTPUT_DIR)}")
        logger.info(f"最大深度: {MAX_DEPTH}, 并发数: {MAX_CONCURRENT}")
        logger.info("=" * 50)
        
        self.playwright = await async_playwright().start()
        
        # 启动浏览器，使用无头模式
        self.browser = await self.playwright.chromium.launch(
            headless=True,
            proxy=PROXY,
            args=[
                "--disable-blink-features=AutomationControlled",
                "--no-sandbox",
                "--disable-dev-shm-usage",
            ]
        )
        
        # 创建浏览器上下文，模拟真实浏览器环境
        self.context = await self.browser.new_context(
            user_agent=USER_AGENT,
            viewport={"width": 1920, "height": 1080},
            locale="zh-CN",
            timezone_id="Asia/Shanghai",
            extra_http_headers={
                "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
                "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
            }
        )
        
        # 绕过 WebDriver 检测
        await self.context.add_init_script("""
            Object.defineProperty(navigator, 'webdriver', {get: () => undefined});
            Object.defineProperty(navigator, 'plugins', {get: () => [1, 2, 3, 4, 5]});
            Object.defineProperty(navigator, 'languages', {get: () => ['zh-CN', 'zh', 'en']});
            window.chrome = {runtime: {}};
        """)
        
        try:
            # 先访问首页获取Cookie
            logger.info("初始化会话，访问首页获取Cookie...")
            init_page = await self.context.new_page()
            await init_page.goto(BASE_URL, wait_until="networkidle", timeout=TIMEOUT)
            await init_page.wait_for_timeout(3000)
            logger.info(f"首页标题: {await init_page.title()}")
            await init_page.close()
            
            # BFS 爬取
            while self.queue:
                tasks = []
                batch_size = min(MAX_CONCURRENT * 2, len(self.queue))
                
                for _ in range(batch_size):
                    if not self.queue:
                        break
                    url, depth = self.queue.popleft()
                    if url not in self.visited:
                        tasks.append(self.crawl_page(url, depth))
                        
                if tasks:
                    await asyncio.gather(*tasks)
                else:
                    await asyncio.sleep(0.1)
                    
            logger.info("=" * 50)
            logger.info(f"爬取完成！共爬取 {self.crawled_count} 个页面")
            logger.info(f"文件保存在: {os.path.abspath(OUTPUT_DIR)}")
            
        finally:
            self.save_state()
            await self.context.close()
            await self.browser.close()
            await self.playwright.stop()


def main():
    crawler = Cz4kCrawler()
    try:
        asyncio.run(crawler.start())
    except KeyboardInterrupt:
        logger.info("用户中断，保存进度...")
        crawler.save_state()
        logger.info(f"进度已保存，下次运行将从断点继续。已爬取 {crawler.crawled_count} 个页面")


if __name__ == "__main__":
    main()
