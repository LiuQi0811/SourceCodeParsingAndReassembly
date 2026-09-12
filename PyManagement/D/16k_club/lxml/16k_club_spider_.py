import asyncio
import random
import re
import os
from urllib.parse import urljoin
from typing import List, Optional, Dict
import aiohttp
import logging
from tqdm import tqdm
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

# ====================== 爬虫全局配置 ======================
class CrawlerConfig(metaclass=SingletonMeta):
    BASE_URL = "https://16k.club/"
    WORKER_NUM = 3              # 消费者并发协程数
    SEMAPHORE_LIMIT = 3         # 全局请求并发限制
    QUEUE_MAX_SIZE = 10         # 任务队列最大容量，背压控制
    MIN_SLEEP = 0.5
    MAX_SLEEP = 1.5
    TIMEOUT = aiohttp.ClientTimeout(total=20)
    MAX_RETRY = 3
    SAVE_ROOT = "./data"
    VISITED_FILE = "./visited.txt"
    FAILED_FILE = "./failed.txt"

    USER_AGENTS = [
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36",
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Safari/605.1.15",
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:120.0) Gecko/20100101 Firefox/120.0",
    ]

# ====================== 断点存储仓库 ======================
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
        logger.info(f"✅ 标记完成: {url}")

    def mark_failed(self, url: str):
        if url in self.failed:
            return
        self.failed.add(url)
        with open(self.cfg.FAILED_FILE, "a", encoding="utf-8") as f:
            f.write(url + "\n")
        logger.error(f"❌ 标记失败: {url}")

# ====================== 请求工具封装 ======================
class AsyncRequestStrategy:
    def __init__(self, session: aiohttp.ClientSession, sem: asyncio.Semaphore):
        self.cfg = CrawlerConfig()
        self.session = session
        self.sem = sem

    def get_headers(self, referer: Optional[str] = None) -> dict:
        headers = {
            "User-Agent": random.choice(self.cfg.USER_AGENTS),
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
            "Connection": "keep-alive",
        }
        if referer:
            headers["Referer"] = referer
        return headers

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
                        html = await resp.text()
                        if len(html) > 800:
                            return html
                        logger.warning(f"页面内容太短 {url} retry {retry+1}")
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
                        logger.info(f"📦 已保存: {save_path}")
                        return True
            except Exception as e:
                logger.exception(f"媒体下载异常 {file_url}, retry {retry+1}")
            await asyncio.sleep(2 * (retry + 1))
        return False

# ====================== 媒体下载处理器 ======================
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

# ====================== 主爬虫类 ======================
class AsyncQueueCrawler:
    def __init__(self):
        self.cfg = CrawlerConfig()
        self.repo = CrawlRepository()
        self.media_factory = MediaFactory()
        # 带最大容量的队列，自动背压
        self.queue: asyncio.Queue[str] = asyncio.Queue(maxsize=self.cfg.QUEUE_MAX_SIZE)
        self.sem = asyncio.Semaphore(self.cfg.SEMAPHORE_LIMIT)
        self.completed_count = 0
        self.pbar: Optional[tqdm] = None
        os.makedirs(self.cfg.SAVE_ROOT, exist_ok=True)

    async def producer(self, session: aiohttp.ClientSession):
        """生产者：抓列表页，解析一页，直接入队，不缓存全部url"""
        req = AsyncRequestStrategy(session, self.sem)
        max_page = await self._detect_max_page(req)
        logger.info(f"\n🔍 生产者检测总页数：{max_page}")

        for page_num in range(1, max_page + 1):
            logger.info(f"\n===== 列表页 {page_num} =====")
            links = await self._parse_list_page(req, page_num)
            logger.info(f"本页解析到 {len(links)} 个专题链接")

            for link in links:
                if self.repo.is_visited(link):
                    logger.debug(f"⏭️ 跳过已完成链接：{link}")
                    continue
                # 队列满会阻塞在这里，背压控制
                await self.queue.put(link)
                logger.debug(f"📥 入队：{link}")

        logger.info("\n✅ 所有列表页抓取完毕，不再生成新任务，等待消费者处理剩余队列")

    async def _detect_max_page(self, req: AsyncRequestStrategy) -> int:
        html = await req.fetch_html(self.cfg.BASE_URL)
        if not html:
            return 1
        tree = etree.HTML(html)
        page_hrefs = tree.xpath('//a[contains(@href,"index.php?p=") and contains(@href,"&size=50")]/@href')
        page_nums = []
        for href in page_hrefs:
            m = re.search(r"p=(\d+)", href)
            if m:
                page_nums.append(int(m.group(1)))
        if page_nums:
            return max(page_nums)
        return 1

    async def _parse_list_page(self, req: AsyncRequestStrategy, page: int) -> List[str]:
        if page == 1:
            url = self.cfg.BASE_URL
        else:
            url = f"{self.cfg.BASE_URL}/index.php?p={page}&size=50"
        html = await req.fetch_html(url)
        if not html:
            return []
        tree = etree.HTML(html)
        href_list = tree.xpath('//a/@href')
        links = set()
        for href in href_list:
            if re.search(r"/post/\d+/", href):
                full = urljoin(self.cfg.BASE_URL, href)
                links.add(full)
        return list(links)

    async def consumer(self, worker_id: int, session: aiohttp.ClientSession):
        """消费者：循环从队列拿链接，爬详情、解析xpath、下载媒体"""
        req = AsyncRequestStrategy(session, self.sem)
        img_handler = self.media_factory.get_handler("image")
        vid_handler = self.media_factory.get_handler("video")
        logger.info(f"🟢 Worker-{worker_id} 启动")

        while True:
            post_url = await self.queue.get()
            try:
                await self._process_post(req, img_handler, vid_handler, post_url)
            except Exception as e:
                logger.exception(f"❌ 处理专题异常 {post_url}")
                self.repo.mark_failed(post_url)
            finally:
                self.queue.task_done()
                self.completed_count += 1
                if self.pbar:
                    self.pbar.update(1)

    async def _process_post(self, req: AsyncRequestStrategy, img_handler: ImageHandler, vid_handler: VideoHandler, post_url: str):
        html = await req.fetch_html(post_url, referer=self.cfg.BASE_URL)
        if not html:
            self.repo.mark_failed(post_url)
            return

        tree = etree.HTML(html)
        title_raw_list = tree.xpath('//h1//text()')
        if title_raw_list:
            title_raw = "".join(title_raw_list).strip()
        else:
            title_raw = f"no_title_{random.randint(1000,9999)}"
        title = req.clean_filename(title_raw)
        save_dir = os.path.join(self.cfg.SAVE_ROOT, title)
        os.makedirs(save_dir, exist_ok=True)

        # 保存页面源码
        info_path = os.path.join(save_dir, "info.html")
        with open(info_path, "w", encoding="utf-8") as f:
            f.write(html)
        logger.info(f"📄 保存源码：{info_path}")

        # XPath提取图片、视频地址
        image_urls = tree.xpath('//img[@data-src]/@data-src')
        video_urls = tree.xpath('//source/@src')
        logger.info(f"📦 专题【{title}】图片:{len(image_urls)} 视频:{len(video_urls)} | {post_url}")

        # 并发下载图片
        img_tasks = [
            img_handler.download(req, src, save_dir, idx+1, post_url)
            for idx, src in enumerate(image_urls)
        ]
        await asyncio.gather(*img_tasks)

        # 并发下载视频
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
            # 初始化进度条，无固定total，动态累加
            self.pbar = tqdm(desc="✅ 已完成专题", unit="个")

            producer_task = asyncio.create_task(self.producer(session))
            consumer_tasks = [
                asyncio.create_task(self.consumer(i, session))
                for i in range(self.cfg.WORKER_NUM)
            ]

            # 等待生产者全部列表页抓取完成
            await producer_task
            logger.info("\n📥 生产者全部列表页抓取完毕，等待队列剩余任务消费")

            # 等待队列里面所有专题全部处理完成
            await self.queue.join()
            logger.info("\n🎉 队列全部任务处理完成！")

            # 全部任务跑完，再关闭消费者
            for task in consumer_tasks:
                task.cancel()
            await asyncio.gather(*consumer_tasks, return_exceptions=True)

            if self.pbar:
                self.pbar.close()
        logger.info("\n🏁 爬虫全部结束！")

if __name__ == "__main__":
    # pip install aiohttp tqdm lxml
    crawler = AsyncQueueCrawler()
    asyncio.run(crawler.run())
