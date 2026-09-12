import asyncio
import random
import re
import os
from urllib.parse import urljoin
from typing import List, Optional, Dict
import aiohttp
import logging
from tqdm import tqdm
from bs4 import BeautifulSoup
from lxml import etree

# ====================== 日志配置 ======================
def setup_logger():
    log_format = "%(asctime)s - %(levelname)s - %(message)s"
    logging.basicConfig(
        level=logging.INFO,
        format=log_format,
        handlers=[
            logging.FileHandler("crawler.log", encoding="utf-8"),
            logging.StreamHandler()
        ]
    )
    return logging.getLogger("crawler")

logger = setup_logger()

# ====================== 单例元类 ======================
class SingletonMeta(type):
    _instances: Dict = {}
    def __call__(cls, *args, **kwargs):
        if cls not in cls._instances:
            cls._instances[cls] = super().__call__(*args, **kwargs)
        return cls._instances[cls]

# ====================== 【单例模式：全局爬虫配置】 ======================
class CrawlerConfig(metaclass=SingletonMeta):
    BASE_URL = "https://16k.club/"
    WORKER_NUM = 3              # 消费者协程数量
    SEMAPHORE_LIMIT = 3         # 全局请求并发信号量
    QUEUE_MAX_SIZE = 10         # 队列容量（仅边抓边入队模式生效，背压用）
    MIN_SLEEP = 0.5
    MAX_SLEEP = 1.5
    TIMEOUT = aiohttp.ClientTimeout(total=20)
    MAX_RETRY = 3
    SAVE_ROOT = "./data"
    VISITED_FILE = "./visited.txt"
    FAILED_FILE = "./failed.txt"

    # ★ 任务载入模式开关
    # "all"  = 一次性载入：先抓完所有列表页收集全部链接，再统一入队（进度条有准确 total）
    # "stream" = 边抓边入队：解析一页入队一页，生产消费流水线并行（内存低、更快产出）
    LOAD_MODE = "all"

    # ★ 页面解析引擎开关
    # "bs4" = BeautifulSoup DOM解析
    # "xpath" = lxml xpath解析
    # "regex" = 纯正则解析（无需bs4/lxml）
    PARSE_ENGINE = "regex"

    USER_AGENTS = [
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36",
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:120.0) Gecko/20100101 Firefox/120.0",
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Safari/605.1.15",
    ]

# ====================== 【仓库模式：断点续爬 + 失败链接存储】 ======================
class CrawlRepository:
    def __init__(self):
        self.cfg = CrawlerConfig()
        self.visited: set[str] = set()
        self.failed: set[str] = set()
        self._load()

    def _load(self):
        if os.path.exists(self.cfg.VISITED_FILE):
            with open(self.cfg.VISITED_FILE, "r", encoding="utf-8") as f:
                for line in f:
                    line = line.strip()
                    if line:
                        self.visited.add(line)
        if os.path.exists(self.cfg.FAILED_FILE):
            with open(self.cfg.FAILED_FILE, "r", encoding="utf-8") as f:
                for line in f:
                    line = line.strip()
                    if line:
                        self.failed.add(line)

    def is_visited(self, url: str) -> bool:
        return url in self.visited

    def mark_visited(self, url: str):
        if url in self.visited:
            return
        self.visited.add(url)
        with open(self.cfg.VISITED_FILE, "a", encoding="utf-8") as f:
            f.write(url + "\n")
        logger.info(f"标记完成: {url}")

    def mark_failed(self, url: str):
        if url in self.failed:
            return
        self.failed.add(url)
        with open(self.cfg.FAILED_FILE, "a", encoding="utf-8") as f:
            f.write(url + "\n")
        logger.error(f"标记失败: {url}")

# ====================== 【策略模式：异步请求封装 aiohttp】 ======================
class AsyncRequestStrategy:
    def __init__(self, session: aiohttp.ClientSession, sem: asyncio.Semaphore):
        self.cfg = CrawlerConfig()
        self.session = session
        self.sem = sem

    def get_headers(self, referer: Optional[str] = None) -> dict:
        h = {
            "User-Agent": random.choice(self.cfg.USER_AGENTS),
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
            "Connection": "keep-alive",
        }
        if referer:
            h["Referer"] = referer
        return h

    @staticmethod
    def clean_filename(s: str) -> str:
        bad_chars = r'[\/:*?"<>|]'
        return re.sub(bad_chars, "_", s).strip()[:120]

    async def fetch_html(self, url: str, referer: str = None) -> Optional[str]:
        for retry in range(self.cfg.MAX_RETRY):
            try:
                await asyncio.sleep(random.uniform(self.cfg.MIN_SLEEP, self.cfg.MAX_SLEEP))
                async with self.sem:
                    async with self.session.get(url, headers=self.get_headers(referer), timeout=self.cfg.TIMEOUT) as resp:
                        if resp.status != 200:
                            logger.warning(f"状态码 {resp.status} {url} retry {retry+1}")
                            continue
                        html = await resp.text(encoding=None)
                        if len(html) > 1000:
                            return html
                        logger.warning(f"响应内容过短 {url} retry {retry+1}")
            except Exception as e:
                logger.exception(f"请求异常 {url}, retry {retry+1}")
            await asyncio.sleep(2 * (retry + 1))
        return None

    async def download_media(self, file_url: str, save_path: str, referer: str) -> bool:
        for retry in range(self.cfg.MAX_RETRY):
            try:
                await asyncio.sleep(random.uniform(self.cfg.MIN_SLEEP, self.cfg.MAX_SLEEP))
                async with self.sem:
                    async with self.session.get(file_url, headers=self.get_headers(referer), timeout=self.cfg.TIMEOUT) as resp:
                        if resp.status != 200:
                            logger.warning(f"下载失败 status={resp.status}, {file_url} retry {retry+1}")
                            continue
                        with open(save_path, "wb") as f:
                            async for chunk in resp.content.iter_chunked(1024*1024):
                                f.write(chunk)
                        logger.info(f"✅ 已保存: {save_path}")
                        return True
            except Exception as e:
                logger.exception(f"媒体下载异常 {file_url}, retry {retry+1}")
            await asyncio.sleep(2 * (retry + 1))
        return False

# ====================== 【工厂模式：媒体处理器】 ======================
class BaseMediaHandler:
    ext: str
    async def download(self, req: AsyncRequestStrategy, src_url: str, save_dir: str, idx: int, referer: str):
        raise NotImplementedError

class ImageHandler(BaseMediaHandler):
    ext = "jpg"
    async def download(self, req: AsyncRequestStrategy, src_url: str, save_dir: str, idx: int, referer: str):
        full_url = urljoin(req.cfg.BASE_URL, src_url)
        save_path = os.path.join(save_dir, f"img_{idx:02d}.{self.ext}")
        return await req.download_media(full_url, save_path, referer)

class VideoHandler(BaseMediaHandler):
    ext = "mp4"
    async def download(self, req: AsyncRequestStrategy, src_url: str, save_dir: str, idx: int, referer: str):
        full_url = urljoin(req.cfg.BASE_URL, src_url)
        save_path = os.path.join(save_dir, f"video_{idx:02d}.{self.ext}")
        return await req.download_media(full_url, save_path, referer)

class MediaFactory:
    @staticmethod
    def get_handler(media_type: str) -> BaseMediaHandler:
        mapping = {
            "image": ImageHandler(),
            "video": VideoHandler()
        }
        return mapping[media_type]

# ====================== 解析器抽象层 ======================
class BasePageParser:
    @staticmethod
    def get_max_page(html: str) -> int:
        raise NotImplementedError

    @staticmethod
    def extract_post_links(html: str, base_url: str) -> List[str]:
        raise NotImplementedError

    @staticmethod
    def extract_post_detail(html: str) -> tuple[str, List[str], List[str]]:
        """返回：标题,图片列表,视频列表"""
        raise NotImplementedError

class Bs4PageParser(BasePageParser):
    @staticmethod
    def get_max_page(html: str) -> int:
        soup = BeautifulSoup(html, "html.parser")
        page_links = soup.find_all("a", href=re.compile(r"index\.php\?p=\d+&size=50"))
        page_nums = []
        for a in page_links:
            href = a.get("href", "")
            match = re.search(r"p=(\d+)", href)
            if match:
                page_nums.append(int(match.group(1)))
        if page_nums:
            return max(page_nums)
        return 1

    @staticmethod
    def extract_post_links(html: str, base_url: str) -> List[str]:
        soup = BeautifulSoup(html, "html.parser")
        links = set()
        a_tags = soup.find_all("a", href=re.compile(r"/post/\d+/"))
        for a in a_tags:
            href = a.get("href")
            full = urljoin(base_url, href)
            links.add(full)
        return list(links)

    @staticmethod
    def extract_post_detail(html: str) -> tuple[str, List[str], List[str]]:
        soup = BeautifulSoup(html, "html.parser")
        # 获取标题 h1
        h1_tag = soup.find("h1")
        if h1_tag:
            title_raw = h1_tag.get_text(strip=True)
        else:
            title_raw = f"no_title_{random.randint(1000,9999)}"

        # 提取图片 data-src
        img_tags = soup.find_all("img", attrs={"data-src": True})
        image_urls = [img["data-src"] for img in img_tags]

        # 提取视频source标签src
        source_tags = soup.find_all("source", attrs={"src": True})
        video_urls = [source["src"] for source in source_tags]
        return title_raw, image_urls, video_urls

class XpathPageParser(BasePageParser):
    @staticmethod
    def get_max_page(html: str) -> int:
        tree = etree.HTML(html)
        # 匹配分页链接 index.php?p=数字&size=50
        hrefs = tree.xpath('//a[contains(@href, "index.php?p=") and contains(@href, "&size=50")]/@href')
        page_nums = []
        for href in hrefs:
            match = re.search(r"p=(\d+)", href)
            if match:
                page_nums.append(int(match.group(1)))
        if page_nums:
            return max(page_nums)
        return 1

    @staticmethod
    def extract_post_links(html: str, base_url: str) -> List[str]:
        tree = etree.HTML(html)
        # 匹配 /post/数字/ 的a链接
        hrefs = tree.xpath('//a[re:test(@href, "/post/\\d+/")]/@href', namespaces={"re": "http://exslt.org/regular-expressions"})
        links = set()
        for href in hrefs:
            full = urljoin(base_url, href)
            links.add(full)
        return list(links)

    @staticmethod
    def extract_post_detail(html: str) -> tuple[str, List[str], List[str]]:
        tree = etree.HTML(html)
        # 获取h1标题
        h1_text_list = tree.xpath("//h1/text()")
        if h1_text_list:
            title_raw = h1_text_list[0].strip()
        else:
            title_raw = f"no_title_{random.randint(1000,9999)}"

        # img/@data-src
        image_urls = tree.xpath('//img/@data-src')
        # source/@src
        video_urls = tree.xpath('//source/@src')
        return title_raw, image_urls, video_urls

# ====================== 新增：纯正则解析器 ======================
class RegexPageParser(BasePageParser):
    # 预编译正则，全局复用
    RE_PAGE_HREF = re.compile(r'index\.php\?p=(\d+)&size=50')
    RE_POST_HREF = re.compile(r'href="([^"]+/post/\d+/)"')
    RE_H1_TEXT   = re.compile(r'<h1[^>]*>(.*?)</h1>', re.S)
    RE_IMG_DATA_SRC = re.compile(r'<img[^>]+data-src="([^"]+)"')
    RE_SOURCE_SRC = re.compile(r'<source[^>]+src="([^"]+)"')

    @staticmethod
    def get_max_page(html: str) -> int:
        matches = RegexPageParser.RE_PAGE_HREF.findall(html)
        page_nums = [int(x) for x in matches]
        if page_nums:
            return max(page_nums)
        return 1

    @staticmethod
    def extract_post_links(html: str, base_url: str) -> List[str]:
        matches = RegexPageParser.RE_POST_HREF.findall(html)
        links = set()
        for href in matches:
            full = urljoin(base_url, href)
            links.add(full)
        return list(links)

    @staticmethod
    def extract_post_detail(html: str) -> tuple[str, List[str], List[str]]:
        # 提取h1标题
        h1_match = RegexPageParser.RE_H1_TEXT.search(html)
        if h1_match:
            title_raw = re.sub(r'<.+?>', '', h1_match.group(1)).strip()
        else:
            title_raw = f"no_title_{random.randint(1000,9999)}"

        # img data-src
        image_urls = RegexPageParser.RE_IMG_DATA_SRC.findall(html)
        # source src
        video_urls = RegexPageParser.RE_SOURCE_SRC.findall(html)
        return title_raw, image_urls, video_urls

class ParserFactory:
    @staticmethod
    def get_parser() -> BasePageParser:
        cfg = CrawlerConfig()
        if cfg.PARSE_ENGINE == "xpath":
            return XpathPageParser()
        elif cfg.PARSE_ENGINE == "regex":
            return RegexPageParser()
        else:
            return Bs4PageParser()

# ====================== 主爬虫类（双模式载入 + 三引擎解析） ======================
class AsyncQueueCrawler:
    def __init__(self):
        self.cfg = CrawlerConfig()
        self.repo = CrawlRepository()
        self.media_factory = MediaFactory()
        self.parser = ParserFactory.get_parser()
        logger.info(f"✅ 当前解析引擎：{self.cfg.PARSE_ENGINE}，载入模式：{self.cfg.LOAD_MODE}")

        # 边抓边入队模式用有界队列做背压；一次性载入模式用无界队列
        if self.cfg.LOAD_MODE == "stream":
            self.queue: asyncio.Queue = asyncio.Queue(maxsize=self.cfg.QUEUE_MAX_SIZE)
        else:
            self.queue: asyncio.Queue = asyncio.Queue()
        self.sem = asyncio.Semaphore(self.cfg.SEMAPHORE_LIMIT)
        self.completed_count = 0
        self.pbar: Optional[tqdm] = None
        os.makedirs(self.cfg.SAVE_ROOT, exist_ok=True)

    # ========== 一次性载入：收集全部链接 ==========
    async def collect_all_links(self, session: aiohttp.ClientSession) -> List[str]:
        req = AsyncRequestStrategy(session, self.sem)
        max_page = await self._detect_max_page(req)
        logger.info(f"🔍 [一次性载入] 开始抓取列表页，总页数：{max_page}")
        all_links = []

        for page_num in range(1, max_page + 1):
            logger.info(f"\n===== 抓取列表页 {page_num} =====")
            links = await self._parse_list_page(req, page_num)
            logger.info(f"本页解析到 {len(links)} 个专题链接")
            for link in links:
                if not self.repo.is_visited(link):
                    all_links.append(link)
                else:
                    logger.debug(f"⏭️ 跳过已爬：{link}")
        logger.info(f"\n✅ 列表页全部抓完，待爬专题总数：{len(all_links)}")
        return all_links

    # ========== 边抓边入队：生产页直接入队 ==========
    async def producer_stream(self, session: aiohttp.ClientSession):
        req = AsyncRequestStrategy(session, self.sem)
        max_page = await self._detect_max_page(req)
        logger.info(f"🔍 [边抓边入队] 生产者检测总页数：{max_page}")

        for page_num in range(1, max_page + 1):
            logger.info(f"\n===== 列表页 {page_num} =====")
            links = await self._parse_list_page(req, page_num)
            logger.info(f"本页解析到 {len(links)} 个专题链接")
            for link in links:
                if self.repo.is_visited(link):
                    logger.debug(f"⏭️ 跳过已爬：{link}")
                    continue
                # 队列满自动阻塞生产者（背压）
                await self.queue.put(link)
                logger.debug(f"📥 入队: {link}")

        logger.info("\n✅ 生产者所有列表页抓取完毕，不再生成新任务")

    async def _detect_max_page(self, req: AsyncRequestStrategy) -> int:
        html = await req.fetch_html(self.cfg.BASE_URL)
        if not html:
            return 1
        return self.parser.get_max_page(html)

    async def _parse_list_page(self, req: AsyncRequestStrategy, page: int) -> List[str]:
        if page == 1:
            url = self.cfg.BASE_URL
        else:
            url = f"{self.cfg.BASE_URL}/index.php?p={page}&size=50"
        html = await req.fetch_html(url)
        if not html:
            return []
        return self.parser.extract_post_links(html, self.cfg.BASE_URL)

    async def consumer(self, worker_id: int, session: aiohttp.ClientSession):
        """消费者协程：处理专题详情、下载媒体"""
        req = AsyncRequestStrategy(session, self.sem)
        img_handler = self.media_factory.get_handler("image")
        vid_handler = self.media_factory.get_handler("video")
        logger.info(f"🟢 消费者Worker-{worker_id} 启动")
        while True:
            try:
                post_url = await self.queue.get()
                try:
                    await self._process_post(req, img_handler, vid_handler, post_url)
                except Exception as e:
                    logger.exception(f"❌ 处理专题失败 {post_url}")
                    self.repo.mark_failed(post_url)
                finally:
                    self.queue.task_done()
                    self.completed_count += 1
                    if self.pbar:
                        self.pbar.update(1)
            except asyncio.CancelledError:
                logger.info(f"🔴 Worker-{worker_id} 收到取消信号，退出")
                break

    async def _process_post(self, req: AsyncRequestStrategy, img_handler: ImageHandler, vid_handler: VideoHandler, post_url: str):
        html = await req.fetch_html(post_url, referer=self.cfg.BASE_URL)
        if not html:
            logger.error(f"❌ 详情页获取失败 {post_url}")
            self.repo.mark_failed(post_url)
            return

        # 解析详情（自动选择 bs4 / xpath / regex）
        title_raw, image_urls, video_urls = self.parser.extract_post_detail(html)
        title = req.clean_filename(title_raw)
        save_dir = os.path.join(self.cfg.SAVE_ROOT, title)
        os.makedirs(save_dir, exist_ok=True)

        # ========== 保存网页源码 info.html ==========
        info_path = os.path.join(save_dir, "info.html")
        with open(info_path, "w", encoding="utf-8") as f:
            f.write(html)
        logger.info(f"\n📦 专题【{title}】图片{len(image_urls)}张,视频{len(video_urls)}个 | {post_url}")

        # 并发下载当前专题内的图片
        img_tasks = [
            img_handler.download(req, src, save_dir, idx+1, post_url)
            for idx, src in enumerate(image_urls)
        ]
        await asyncio.gather(*img_tasks)

        # 并发下载当前专题内的视频
        vid_tasks = [
            vid_handler.download(req, src, save_dir, idx+1, post_url)
            for idx, src in enumerate(video_urls)
        ]
        await asyncio.gather(*vid_tasks)

        self.repo.mark_visited(post_url)

    async def run(self):
        timeout = aiohttp.ClientTimeout(total=30)
        connector = aiohttp.TCPConnector(limit=0, ttl_dns_cache=300)
        async with aiohttp.ClientSession(timeout=timeout, connector=connector) as session:
            if self.cfg.LOAD_MODE == "all":
                # ===== 一次性载入模式 =====
                all_links = await self.collect_all_links(session)
                if len(all_links) == 0:
                    logger.info("🎉 没有需要爬取的新链接，程序退出")
                    return
                # 进度条有准确 total
                self.pbar = tqdm(total=len(all_links), desc="✅ 专题爬取进度", unit="个")
                for link in all_links:
                    await self.queue.put(link)

                consumer_tasks = [
                    asyncio.create_task(self.consumer(i, session))
                    for i in range(self.cfg.WORKER_NUM)
                ]
                await self.queue.join()
                for c in consumer_tasks:
                    c.cancel()
                await asyncio.gather(*consumer_tasks, return_exceptions=True)
                self.pbar.close()

            else:
                # ===== 边抓边入队模式 =====
                # 无准确 total，只统计已完成数量
                self.pbar = tqdm(desc="✅ 已完成专题", unit="个")
                producer_task = asyncio.create_task(self.producer_stream(session))
                consumer_tasks = [
                    asyncio.create_task(self.consumer(i, session))
                    for i in range(self.cfg.WORKER_NUM)
                ]
                await producer_task
                logger.info("\n📥 生产者列表页抓取完毕，等待队列剩余任务消费")
                await self.queue.join()
                logger.info("\n🎉 队列全部任务处理完成！")
                for c in consumer_tasks:
                    c.cancel()
                await asyncio.gather(*consumer_tasks, return_exceptions=True)
                self.pbar.close()

        logger.info("\n🏁 所有爬虫任务执行完毕！")

if __name__ == "__main__":
    # 依赖说明：
    # bs4: pip install beautifulsoup4
    # xpath: pip install lxml
    # regex模式：只需要 aiohttp + tqdm，不需要 bs4/lxml
    crawler = AsyncQueueCrawler()
    asyncio.run(crawler.run())
