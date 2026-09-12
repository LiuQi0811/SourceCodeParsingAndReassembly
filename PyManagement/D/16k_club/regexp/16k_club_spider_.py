import asyncio
import random
import re
import os
from urllib.parse import urljoin
from typing import List, Optional, Dict
import aiohttp

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
    MIN_SLEEP = 0.5
    MAX_SLEEP = 1.5
    TIMEOUT = aiohttp.ClientTimeout(total=20)
    MAX_RETRY = 3
    SAVE_ROOT = "./data"
    VISITED_FILE = "./visited.txt"

    USER_AGENTS = [
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36",
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:120.0) Gecko/20100101 Firefox/120.0",
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Safari/605.1.15",
    ]

# ====================== 【仓库模式：断点续爬持久化】 ======================
class CrawlRepository:
    def __init__(self):
        self.cfg = CrawlerConfig()
        self.visited: set[str] = set()
        self._load()

    def _load(self):
        if os.path.exists(self.cfg.VISITED_FILE):
            with open(self.cfg.VISITED_FILE, "r", encoding="utf-8") as f:
                for line in f:
                    line = line.strip()
                    if line:
                        self.visited.add(line)

    def is_visited(self, url: str) -> bool:
        return url in self.visited

    def mark_visited(self, url: str):
        if url in self.visited:
            return
        self.visited.add(url)
        with open(self.cfg.VISITED_FILE, "a", encoding="utf-8") as f:
            f.write(url + "\n")

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
                            print(f"状态码 {resp.status} {url} retry {retry+1}")
                            continue
                        html = await resp.text(encoding=None)
                        if len(html) > 1000:
                            return html
                        print(f"响应内容过短 {url} retry {retry+1}")
            except Exception as e:
                print(f"请求异常 {url}: {e}, retry {retry+1}")
            await asyncio.sleep(2 * (retry + 1))
        return None

    async def download_media(self, file_url: str, save_path: str, referer: str) -> bool:
        for retry in range(self.cfg.MAX_RETRY):
            try:
                await asyncio.sleep(random.uniform(self.cfg.MIN_SLEEP, self.cfg.MAX_SLEEP))
                async with self.sem:
                    async with self.session.get(file_url, headers=self.get_headers(referer), timeout=self.cfg.TIMEOUT) as resp:
                        if resp.status != 200:
                            print(f"下载失败 status={resp.status}, {file_url} retry {retry+1}")
                            continue
                        with open(save_path, "wb") as f:
                            async for chunk in resp.content.iter_chunked(1024*1024):
                                f.write(chunk)
                        print(f"✅ 已保存: {save_path}")
                        return True
            except Exception as e:
                print(f"媒体下载异常 {file_url}: {e}, retry {retry+1}")
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

# ====================== 专题数据模型 ======================
class PostTask:
    def __init__(self, post_url: str):
        self.url = post_url
        self.title: str = ""
        self.image_list: List[str] = []
        self.video_list: List[str] = []

# ====================== 主爬虫类：生产者+消费者 ======================
class AsyncQueueCrawler:
    def __init__(self):
        self.cfg = CrawlerConfig()
        self.repo = CrawlRepository()
        self.media_factory = MediaFactory()
        self.queue: asyncio.Queue[str] = asyncio.Queue(maxsize=10) # 队列缓冲上限，防止爆内存
        self.sem = asyncio.Semaphore(self.cfg.SEMAPHORE_LIMIT)
        os.makedirs(self.cfg.SAVE_ROOT, exist_ok=True)

    async def producer(self, session: aiohttp.ClientSession):
        """生产者：遍历列表页，解析专题链接，放入队列"""
        req = AsyncRequestStrategy(session, self.sem)
        max_page = await self._detect_max_page(req)
        print(f"🔍 生产者检测总页数：{max_page}")

        for page_num in range(1, max_page + 1):
            print(f"\n===== 列表页 {page_num} =====")
            links = await self._parse_list_page(req, page_num)
            print(f"本页解析到 {len(links)} 个专题链接")
            for link in links:
                if self.repo.is_visited(link):
                    print(f"⏭️ 跳过已爬：{link}")
                    continue
                # 入队，队列满会自动阻塞生产者
                await self.queue.put(link)
                print(f"📥 入队: {link}")
        # 全部生产完毕，放结束标记
        print("\n✅ 生产者任务全部完成，等待队列消费完毕")

    async def _detect_max_page(self, req: AsyncRequestStrategy) -> int:
        html = await req.fetch_html(self.cfg.BASE_URL)
        if not html:
            return 1
        pages = re.findall(r'index\.php\?p=(\d+)&size=50', html)
        if pages:
            return max(int(p) for p in pages)
        return 1

    async def _parse_list_page(self, req: AsyncRequestStrategy, page: int) -> List[str]:
        if page == 1:
            url = self.cfg.BASE_URL
        else:
            url = f"{self.cfg.BASE_URL}/index.php?p={page}&size=50"
        html = await req.fetch_html(url)
        if not html:
            return []
        links = set()
        LIST_LINK_RE = re.compile(r'href="(/post/\d+)/"')
        for m in LIST_LINK_RE.findall(html):
            full = urljoin(self.cfg.BASE_URL, m)
            links.add(full)
        return list(links)

    async def consumer(self, worker_id: int, session: aiohttp.ClientSession):
        """消费者协程：不断从队列取出post链接，解析+下载"""
        req = AsyncRequestStrategy(session, self.sem)
        img_handler = self.media_factory.get_handler("image")
        vid_handler = self.media_factory.get_handler("video")
        print(f"🟢 消费者Worker-{worker_id} 启动")
        while True:
            try:
                post_url = await self.queue.get()
                try:
                    await self._process_post(req, img_handler, vid_handler, post_url)
                finally:
                    self.queue.task_done()
            except asyncio.CancelledError:
                print(f"🔴 Worker-{worker_id} 收到取消信号，退出")
                break

    async def _process_post(self, req: AsyncRequestStrategy, img_handler: ImageHandler, vid_handler: VideoHandler, post_url: str):
        html = await req.fetch_html(post_url, referer=self.cfg.BASE_URL)
        if not html:
            print(f"❌ 详情页获取失败 {post_url}")
            return

        h1_search = re.search(r'<h1.*?>(.*?)</h1>' ,html)
        if not h1_search:
            title_raw = f"no_title_{random.randint(1000,9999)}"
        else:
            title_raw = h1_search.group(1).strip()
        title = req.clean_filename(title_raw)
        save_dir = os.path.join(self.cfg.SAVE_ROOT, title)
        os.makedirs(save_dir, exist_ok=True)

        img_pattern = re.compile(r'data-src="(.*?)"')
        video_pattern = re.compile(r'<source\s+src\s*=\s*"(.*?)"')
        image_urls = img_pattern.findall(html)
        video_urls = video_pattern.findall(html)

        print(f"\n📦 专题【{title}】图片{len(image_urls)}张,视频{len(video_urls)}个 | {post_url}")

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
            # 启动生产者
            producer_task = asyncio.create_task(self.producer(session))
            # 启动N个消费者worker
            consumer_tasks = [
                asyncio.create_task(self.consumer(i, session))
                for i in range(self.cfg.WORKER_NUM)
            ]
            # 等待生产者生产完毕
            await producer_task
            # 等待队列全部消费完成
            await self.queue.join()
            # 全部任务完成，取消消费者协程
            for c in consumer_tasks:
                c.cancel()
            await asyncio.gather(*consumer_tasks, return_exceptions=True)
        print("\n🎉 所有爬虫任务执行完毕！")

if __name__ == "__main__":
    crawler = AsyncQueueCrawler()
    asyncio.run(crawler.run())
