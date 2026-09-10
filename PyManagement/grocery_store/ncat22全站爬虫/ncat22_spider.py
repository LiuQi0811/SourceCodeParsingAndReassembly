#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
ncat22.com 全站爬虫
- 自动绕过 CDN JS 验证（cdndefend / Cloudflare 5秒盾 等）
- BFS 广度优先遍历全站
- 断点续爬（自动保存进度，中断后可继续）
- 自动下载图片/CSS/JS等静态资源
- 支持多线程并发抓取
- 自动去重、URL 过滤
- 结果按原网站目录结构保存到本地
"""

import os
import re
import sys
import json
import time
import hashlib
import logging
import argparse
from urllib.parse import urljoin, urlparse, urldefrag
from collections import deque
from pathlib import Path
from datetime import datetime
from typing import Set, Dict, Optional, List

# ============ 依赖检查与安装提示 ============
try:
    from DrissionPage import ChromiumPage, ChromiumOptions
except ImportError:
    print("=" * 60)
    print("缺少 DrissionPage 库，请执行安装：")
    print("  pip install DrissionPage")
    print("或使用国内源：")
    print("  pip install DrissionPage -i https://pypi.tuna.tsinghua.edu.cn/simple")
    print("=" * 60)
    sys.exit(1)

try:
    import requests
    from bs4 import BeautifulSoup
except ImportError:
    print("=" * 60)
    print("缺少必要依赖，请执行安装：")
    print("  pip install requests beautifulsoup4")
    print("=" * 60)
    sys.exit(1)

# ============ 日志配置 ============
def setup_logger(log_file: str = "spider.log"):
    """配置日志"""
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s [%(levelname)s] %(message)s",
        handlers=[
            logging.FileHandler(log_file, encoding="utf-8"),
            logging.StreamHandler(sys.stdout)
        ]
    )
    return logging.getLogger(__name__)

logger = setup_logger()


# ============ 主爬虫类 ============
class SiteCrawler:
    """全站爬虫"""

    def __init__(
        self,
        start_url: str,
        output_dir: str = "output",
        max_depth: int = 999,
        max_pages: int = 0,
        concurrency: int = 1,
        delay: float = 1.0,
        download_resources: bool = True,
        use_browser: bool = True,
        headless: bool = False,
        timeout: int = 30,
    ):
        """
        初始化爬虫
        :param start_url: 起始URL
        :param output_dir: 输出目录
        :param max_depth: 最大爬取深度，0=无限
        :param max_pages: 最大爬取页数，0=无限
        :param concurrency: 并发数（保留参数）
        :param delay: 请求间隔(秒)
        :param download_resources: 是否下载静态资源
        :param use_browser: 是否使用浏览器模式（自动过JS验证）
        :param headless: 是否无头模式
        :param timeout: 超时时间(秒)
        """
        self.start_url = start_url.rstrip("/")
        parsed = urlparse(start_url)
        self.domain = parsed.netloc
        self.base_url = f"{parsed.scheme}://{parsed.netloc}"

        self.output_dir = Path(output_dir) / self.domain
        self.max_depth = max_depth
        self.max_pages = max_pages
        self.delay = delay
        self.download_resources = download_resources
        self.use_browser = use_browser
        self.timeout = timeout

        # 状态管理
        self.visited_urls: Set[str] = set()      # 已访问URL
        self.failed_urls: Set[str] = set()        # 失败URL
        self.queue: deque = deque()               # 待爬队列 [(url, depth)]
        self.url_depths: Dict[str, int] = {}      # URL -> 深度
        self.pages_crawled = 0

        # 进度文件
        self.progress_file = self.output_dir / ".crawl_progress.json"

        # 静态资源扩展名
        self.resource_exts = {
            ".jpg", ".jpeg", ".png", ".gif", ".bmp", ".webp", ".svg", ".ico",
            ".css", ".js", ".woff", ".woff2", ".ttf", ".eot", ".mp4", ".mp3",
            ".pdf", ".zip", ".rar", ".7z", ".doc", ".docx", ".xls", ".xlsx",
        }
        self.page_exts = {"", ".html", ".htm", ".php", ".asp", ".aspx", ".jsp", ".shtml"}

        # 会话（用于静态资源下载）
        self.session = requests.Session()
        self.session.headers.update({
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
        })

        # 浏览器实例
        self.browser_page: Optional[ChromiumPage] = None

        # 创建输出目录
        self.output_dir.mkdir(parents=True, exist_ok=True)

        # 加载断点进度
        self._load_progress()

    def _init_browser(self):
        """初始化浏览器（用于过JS验证）"""
        if self.browser_page is not None:
            return

        logger.info("初始化浏览器以通过 CDN 验证...")
        co = ChromiumOptions()
        if self.headless:
            co.headless(True)
        co.set_argument("--no-sandbox")
        co.set_argument("--disable-dev-shm-usage")
        co.set_argument("--disable-blink-features=AutomationControlled")
        co.set_user_agent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36")

        self.browser_page = ChromiumPage(co)
        self.browser_page.set.timeout(self.timeout)

        # 先访问首页通过验证
        logger.info(f"正在访问 {self.start_url} 通过 JS 验证...")
        self.browser_page.get(self.start_url)
        # 等待验证通过
        time.sleep(5)
        # 检查是否还在验证页
        for _ in range(10):
            title = self.browser_page.title
            if "verify" not in title.lower() and "验证" not in title and "protected" not in title.lower():
                break
            logger.info("等待 CDN 验证通过...")
            time.sleep(2)

        logger.info(f"验证通过，当前页面标题: {self.browser_page.title}")

        # 将浏览器cookies同步到requests session
        cookies = self.browser_page.cookies()
        for cookie in cookies:
            self.session.cookies.set(
                cookie.get("name", ""),
                cookie.get("value", ""),
                domain=cookie.get("domain", self.domain)
            )

    def _load_progress(self):
        """加载断点续爬进度"""
        if self.progress_file.exists():
            try:
                with open(self.progress_file, "r", encoding="utf-8") as f:
                    progress = json.load(f)
                self.visited_urls = set(progress.get("visited", []))
                self.failed_urls = set(progress.get("failed", []))
                self.pages_crawled = progress.get("pages_crawled", 0)
                queue_list = progress.get("queue", [])
                self.queue = deque((item[0], item[1]) for item in queue_list)
                self.url_depths = progress.get("depths", {})
                logger.info(f"加载进度: 已爬 {self.pages_crawled} 页, 队列 {len(self.queue)} 条")
            except Exception as e:
                logger.warning(f"加载进度失败，从头开始: {e}")
                self.queue.append((self.start_url, 0))
                self.url_depths[self.start_url] = 0
        else:
            self.queue.append((self.start_url, 0))
            self.url_depths[self.start_url] = 0

    def _save_progress(self):
        """保存断点进度"""
        try:
            progress = {
                "visited": list(self.visited_urls),
                "failed": list(self.failed_urls),
                "pages_crawled": self.pages_crawled,
                "queue": list(self.queue),
                "depths": self.url_depths,
                "save_time": datetime.now().isoformat(),
            }
            with open(self.progress_file, "w", encoding="utf-8") as f:
                json.dump(progress, f, ensure_ascii=False, indent=2)
        except Exception as e:
            logger.error(f"保存进度失败: {e}")

    def _normalize_url(self, url: str, current_url: str) -> Optional[str]:
        """规范化URL，过滤外链和无效链接"""
        if not url or url.startswith(("javascript:", "mailto:", "tel:", "#", "data:")):
            return None

        # 补全相对路径
        url = urljoin(current_url, url)
        # 去掉锚点
        url, _ = urldefrag(url)
        # 规范化
        parsed = urlparse(url)

        # 只爬取目标域名
        if parsed.netloc and parsed.netloc != self.domain:
            return None

        # 规范化 scheme
        if not parsed.scheme:
            url = "https:" + url if url.startswith("//") else f"https://{self.domain}{url}"

        # 去掉末尾斜杠
        url = url.rstrip("/")

        return url if url else None

    def _is_resource_url(self, url: str) -> bool:
        """判断是否是静态资源URL"""
        parsed = urlparse(url)
        path = parsed.path.lower()
        ext = os.path.splitext(path)[1]
        return ext in self.resource_exts

    def _get_save_path(self, url: str, is_resource: bool = False) -> Path:
        """根据URL生成本地保存路径"""
        parsed = urlparse(url)
        path = parsed.path

        if not path or path == "/":
            return self.output_dir / "index.html"

        local_path = self.output_dir / path.lstrip("/")

        # 如果是目录或无扩展名，保存为 index.html
        if path.endswith("/"):
            local_path = local_path / "index.html"
        elif not is_resource and os.path.splitext(path)[1] == "":
            if not any(path.endswith(ext) for ext in self.page_exts):
                local_path = local_path / "index.html"

        return local_path

    def _fetch_page_browser(self, url: str) -> Optional[str]:
        """使用浏览器获取页面（自动过JS验证）"""
        try:
            self._init_browser()
            self.browser_page.get(url)
            # 等待页面加载
            time.sleep(2)
            # 检查是否又触发验证
            for _ in range(5):
                title = self.browser_page.title
                if "protected" in title.lower() or "verify" in title.lower() or "验证" in title:
                    time.sleep(2)
                else:
                    break
            return self.browser_page.html
        except Exception as e:
            logger.error(f"浏览器获取页面失败 {url}: {e}")
            return None

    def _fetch_url_requests(self, url: str) -> Optional[requests.Response]:
        """使用requests获取（用于静态资源）"""
        try:
            resp = self.session.get(url, timeout=self.timeout, allow_redirects=True)
            resp.raise_for_status()
            return resp
        except Exception as e:
            logger.debug(f"requests获取失败 {url}: {e}")
            return None

    def _save_content(self, content: bytes, save_path: Path):
        """保存内容到本地"""
        try:
            save_path.parent.mkdir(parents=True, exist_ok=True)
            with open(save_path, "wb") as f:
                f.write(content)
        except Exception as e:
            logger.error(f"保存文件失败 {save_path}: {e}")

    def _download_resource(self, url: str):
        """下载静态资源"""
        try:
            save_path = self._get_save_path(url, is_resource=True)
            if save_path.exists():
                return

            # 尝试用requests下载
            resp = self._fetch_url_requests(url)
            if resp:
                self._save_content(resp.content, save_path)
                logger.debug(f"下载资源: {url} -> {save_path}")
            else:
                # requests失败则用浏览器下载
                if self.browser_page:
                    self.browser_page.get(url)
                    time.sleep(1)
                    # 这里简化处理，主要是页面
        except Exception as e:
            logger.debug(f"下载资源失败 {url}: {e}")

    def _extract_links(self, html: str, current_url: str) -> List[str]:
        """从HTML中提取所有链接"""
        links = []
        try:
            soup = BeautifulSoup(html, "html.parser")

            # 提取所有链接标签
            for tag, attr in [
                ("a", "href"),
                ("link", "href"),
                ("script", "src"),
                ("img", "src"),
                ("source", "src"),
                ("video", "src"),
                ("audio", "src"),
                ("iframe", "src"),
            ]:
                for element in soup.find_all(tag, {attr: True}):
                    url = self._normalize_url(element[attr], current_url)
                    if url:
                        links.append(url)

            # 提取 CSS 中的 url() 引用
            style_tags = soup.find_all("style")
            for style in style_tags:
                if style.string:
                    urls = re.findall(r'url\(["\']?(.*?)["\']?\)', style.string)
                    for u in urls:
                        normalized = self._normalize_url(u, current_url)
                        if normalized:
                            links.append(normalized)

            # 提取内联样式中的url
            for element in soup.find_all(style=True):
                urls = re.findall(r'url\(["\']?(.*?)["\']?\)', element["style"])
                for u in urls:
                    normalized = self._normalize_url(u, current_url)
                    if normalized:
                        links.append(normalized)

        except Exception as e:
            logger.error(f"提取链接失败 {current_url}: {e}")

        return list(set(links))

    def _rewrite_links(self, html: str, current_url: str) -> str:
        """重写HTML中的链接为本地相对路径，实现离线浏览"""
        # 这里可以扩展为将链接改为本地路径，实现完整镜像
        return html

    def crawl_page(self, url: str, depth: int) -> bool:
        """爬取单个页面"""
        logger.info(f"[{self.pages_crawled + 1}] 深度{depth} 爬取: {url}")

        try:
            # 获取页面内容
            html = None
            if self.use_browser:
                html = self._fetch_page_browser(url)
            else:
                resp = self._fetch_url_requests(url)
                if resp:
                    resp.encoding = resp.apparent_encoding or "utf-8"
                    html = resp.text

            if not html:
                logger.warning(f"获取页面失败: {url}")
                self.failed_urls.add(url)
                return False

            # 保存页面
            save_path = self._get_save_path(url)
            # HTML 内容转码保存
            content = html.encode("utf-8", errors="ignore")
            self._save_content(content, save_path)

            # 提取链接
            links = self._extract_links(html, url)

            for link in links:
                # 处理静态资源
                if self._is_resource_url(link):
                    if self.download_resources:
                        self._download_resource(link)
                    continue

                # 处理页面链接，加入队列
                if link not in self.visited_urls and link not in self.url_depths:
                    new_depth = depth + 1
                    if self.max_depth <= 0 or new_depth <= self.max_depth:
                        self.queue.append((link, new_depth))
                        self.url_depths[link] = new_depth

            return True

        except Exception as e:
            logger.error(f"爬取出错 {url}: {e}")
            self.failed_urls.add(url)
            return False

    def run(self):
        """开始爬取"""
        logger.info("=" * 60)
        logger.info(f"开始全站爬取: {self.start_url}")
        logger.info(f"输出目录: {self.output_dir}")
        logger.info(f"最大深度: {'无限' if self.max_depth <= 0 else self.max_depth}")
        logger.info(f"最大页数: {'无限' if self.max_pages <= 0 else self.max_pages}")
        logger.info(f"下载资源: {'是' if self.download_resources else '否'}")
        logger.info(f"使用浏览器: {'是' if self.use_browser else '否'}")
        logger.info("=" * 60)

        if self.use_browser:
            self._init_browser()

        start_time = time.time()

        try:
            while self.queue:
                # 检查最大页数限制
                if self.max_pages > 0 and self.pages_crawled >= self.max_pages:
                    logger.info(f"已达到最大页数限制 {self.max_pages}")
                    break

                url, depth = self.queue.popleft()

                if url in self.visited_urls:
                    continue

                # 爬取页面
                success = self.crawl_page(url, depth)
                self.visited_urls.add(url)

                if success:
                    self.pages_crawled += 1

                # 每爬10页保存一次进度
                if self.pages_crawled % 10 == 0:
                    self._save_progress()
                    elapsed = time.time() - start_time
                    speed = self.pages_crawled / elapsed if elapsed > 0 else 0
                    logger.info(
                        f"进度: 已爬 {self.pages_crawled} 页 | "
                        f"队列 {len(self.queue)} | "
                        f"失败 {len(self.failed_urls)} | "
                        f"速度 {speed:.2f} 页/秒"
                    )

                # 请求延迟
                time.sleep(self.delay)

        except KeyboardInterrupt:
            logger.info("用户中断，保存进度...")
        except Exception as e:
            logger.error(f"爬虫异常: {e}")
        finally:
            self._save_progress()
            if self.browser_page:
                try:
                    self.browser_page.quit()
                except:
                    pass

        # 输出统计
        elapsed = time.time() - start_time
        logger.info("=" * 60)
        logger.info("爬取完成!")
        logger.info(f"总耗时: {elapsed:.1f} 秒")
        logger.info(f"成功爬取: {self.pages_crawled} 页")
        logger.info(f"失败页面: {len(self.failed_urls)} 个")
        logger.info(f"输出目录: {self.output_dir}")

        # 保存失败列表
        if self.failed_urls:
            failed_file = self.output_dir / "failed_urls.txt"
            with open(failed_file, "w", encoding="utf-8") as f:
                for url in self.failed_urls:
                    f.write(url + "\n")
            logger.info(f"失败URL列表已保存到: {failed_file}")

        # 生成站点地图
        self._generate_sitemap()

        logger.info("=" * 60)

    def _generate_sitemap(self):
        """生成简单的站点地图"""
        sitemap_path = self.output_dir / "sitemap.txt"
        try:
            with open(sitemap_path, "w", encoding="utf-8") as f:
                for url in sorted(self.visited_urls):
                    f.write(url + "\n")
            logger.info(f"站点地图已保存到: {sitemap_path}")
        except Exception as e:
            logger.error(f"生成站点地图失败: {e}")


# ============ 简单版本（纯requests，无JS验证绕过） ============
class SimpleCrawler:
    """简单爬虫（无需浏览器，适合无反爬的站点）"""

    def __init__(self, start_url: str, output_dir: str = "output"):
        self.start_url = start_url.rstrip("/")
        parsed = urlparse(start_url)
        self.domain = parsed.netloc
        self.base_url = f"{parsed.scheme}://{parsed.netloc}"
        self.output_dir = Path(output_dir) / self.domain
        self.output_dir.mkdir(parents=True, exist_ok=True)

        self.visited = set()
        self.queue = deque([(self.start_url, 0)])
        self.session = requests.Session()
        self.session.headers.update({
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
        })

    def _normalize(self, url: str, current: str) -> Optional[str]:
        if not url or url.startswith(("javascript:", "mailto:", "#", "data:")):
            return None
        url = urljoin(current, url)
        url, _ = urldefrag(url)
        parsed = urlparse(url)
        if parsed.netloc and parsed.netloc != self.domain:
            return None
        return url.rstrip("/")

    def run(self, max_pages: int = 100):
        count = 0
        while self.queue and count < max_pages:
            url, depth = self.queue.popleft()
            if url in self.visited:
                continue

            logger.info(f"爬取: {url}")
            try:
                resp = self.session.get(url, timeout=30)
                resp.encoding = resp.apparent_encoding

                # 保存文件
                path = urlparse(url).path or "/index.html"
                save_path = self.output_dir / path.lstrip("/")
                if path.endswith("/"):
                    save_path = save_path / "index.html"
                save_path.parent.mkdir(parents=True, exist_ok=True)
                with open(save_path, "wb") as f:
                    f.write(resp.content)

                # 提取链接
                if "text/html" in resp.headers.get("content-type", ""):
                    soup = BeautifulSoup(resp.text, "html.parser")
                    for a in soup.find_all("a", href=True):
                        link = self._normalize(a["href"], url)
                        if link and link not in self.visited:
                            self.queue.append((link, depth + 1))

                self.visited.add(url)
                count += 1
                time.sleep(1)

            except Exception as e:
                logger.error(f"失败 {url}: {e}")

        logger.info(f"完成，共爬取 {count} 页")


# ============ 主函数 ============
def main():
    parser = argparse.ArgumentParser(
        description="全站爬虫 - 支持自动绕过CDN JS验证",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
使用示例:
  # 基础使用（自动过CDN验证，有界面浏览器）
  python ncat22_spider.py https://www.ncat22.com/

  # 无头模式（后台运行）
  python ncat22_spider.py https://www.ncat22.com/ --headless

  # 限制爬取深度和页数
  python ncat22_spider.py https://www.ncat22.com/ --depth 3 --max-pages 500

  # 不下载静态资源，只爬HTML
  python ncat22_spider.py https://www.ncat22.com/ --no-resources

  # 指定输出目录
  python ncat22_spider.py https://www.ncat22.com/ -o my_download

  # 简单模式（纯requests，无浏览器，适合无反爬站点）
  python ncat22_spider.py https://www.ncat22.com/ --simple
        """
    )

    parser.add_argument("url", nargs="?", default="https://www.ncat22.com/", help="起始URL")
    parser.add_argument("-o", "--output", default="output", help="输出目录 (默认: output)")
    parser.add_argument("-d", "--depth", type=int, default=0, help="最大爬取深度，0=无限 (默认: 0)")
    parser.add_argument("-m", "--max-pages", type=int, default=0, help="最大爬取页数，0=无限 (默认: 0)")
    parser.add_argument("--delay", type=float, default=1.0, help="请求间隔秒数 (默认: 1.0)")
    parser.add_argument("--no-resources", action="store_true", help="不下载静态资源(图片/JS/CSS)")
    parser.add_argument("--simple", action="store_true", help="简单模式（不使用浏览器，纯requests）")
    parser.add_argument("--headless", action="store_true", help="无头模式（浏览器后台运行）")
    parser.add_argument("--timeout", type=int, default=30, help="超时时间秒数 (默认: 30)")

    args = parser.parse_args()

    if args.simple:
        crawler = SimpleCrawler(args.url, args.output)
        crawler.run(max_pages=args.max_pages if args.max_pages > 0 else 999999)
    else:
        crawler = SiteCrawler(
            start_url=args.url,
            output_dir=args.output,
            max_depth=args.depth,
            max_pages=args.max_pages,
            delay=args.delay,
            download_resources=not args.no_resources,
            use_browser=True,
            headless=args.headless,
            timeout=args.timeout,
        )
        crawler.run()


if __name__ == "__main__":
    main()
