import asyncio
import random
import re
import os
from urllib.parse import urljoin
from typing import List, Dict, Optional, Union
from concurrent.futures import ThreadPoolExecutor
import requests
import time

# ====================== 【单例模式：全局配置】 ======================
class SingletonMeta(type):
    _instances: Dict = {}
    def __call__(cls, *args, **kwargs):
        if cls not in cls._instances:
            cls._instances[cls] = super().__call__(*args, **kwargs)
        return cls._instances[cls]

class CrawlerConfig(metaclass=SingletonMeta):
    BASE_URL = "https://16k.club/"
    MAX_WORKERS = 3
    MIN_SLEEP = 0.5
    MAX_SLEEP = 1.5
    TIMEOUT = 20
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

# ====================== 【仓库模式：持久化已爬链接，断点续爬】 ======================
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

# ====================== 【策略模式：网络请求策略，封装header、fetch、下载】 ======================
class RequestStrategy:
    def __init__(self):
        self.cfg = CrawlerConfig()
        self.session = requests.Session()
        self.session.headers.update({
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
            "Connection": "keep-alive",
        })

    def get_headers(self, referer: Optional[str] = None) -> dict:
        h = {"User-Agent": random.choice(self.cfg.USER_AGENTS)}
        if referer:
            h["Referer"] = referer
        return h

    def clean_filename(self, s: str) -> str:
        bad_chars = r'[\/:*?"<>|]'
        return re.sub(bad_chars, "_", s).strip()[:120]

    def fetch_sync(self, url: str, referer: str = None) -> Optional[str]:
        for i in range(self.cfg.MAX_RETRY):
            try:
                time_sleep = random.uniform(self.cfg.MIN_SLEEP, self.cfg.MAX_SLEEP)
                time.sleep(time_sleep)
                r = self.session.get(url, headers=self.get_headers(referer), timeout=self.cfg.TIMEOUT)
                r.encoding = r.apparent_encoding or "utf-8"
                if r.status_code == 200 and len(r.text) > 1000:
                    return r.text
                print(f"状态{r.status_code}或响应过短 {url} (retry {i + 1})")
            except Exception as e:
                print(f"请求异常 {url}: {e} (retry {i + 1})")
            time.sleep(2 * (i + 1))
        return None

    def download_sync(self, file_url: str, save_path: str, referer: str) -> bool:
        for i in range(self.cfg.MAX_RETRY):
            try:
                time_sleep = random.uniform(self.cfg.MIN_SLEEP, self.cfg.MAX_SLEEP)
                time.sleep(time_sleep)
                resp = self.session.get(file_url, headers=self.get_headers(referer), timeout=self.cfg.TIMEOUT, stream=True)
                if resp.status_code == 200:
                    with open(save_path, "wb") as f:
                        for chunk in resp.iter_content(chunk_size=1024*1024):
                            f.write(chunk)
                    print(f"✅ 已保存: {save_path}")
                    return True
                print(f"下载失败，状态码{resp.status_code} {file_url} retry{i+1}")
            except Exception as e:
                print(f"下载异常 {file_url}: {e} retry{i+1}")
            time.sleep(2*(i+1))
        return False

# ====================== 【工厂模式：媒体下载处理器工厂】 ======================
class BaseMediaHandler:
    ext: str
    def download(self, req_strategy: RequestStrategy, src_url: str, save_dir: str, idx: int, referer: str):
        raise NotImplementedError

class ImageHandler(BaseMediaHandler):
    ext = "jpg"
    def download(self, req_strategy: RequestStrategy, src_url: str, save_dir: str, idx: int, referer: str):
        full_url = urljoin(req_strategy.cfg.BASE_URL, src_url)
        save_path = os.path.join(save_dir, f"img_{idx:02d}.{self.ext}")
        return req_strategy.download_sync(full_url, save_path, referer)

class VideoHandler(BaseMediaHandler):
    ext = "mp4"
    def download(self, req_strategy: RequestStrategy, src_url: str, save_dir: str, idx: int, referer: str):
        full_url = urljoin(req_strategy.cfg.BASE_URL, src_url)
        save_path = os.path.join(save_dir, f"video_{idx:02d}.{self.ext}")
        return req_strategy.download_sync(full_url, save_path, referer)

class MediaFactory:
    @staticmethod
    def get_handler(media_type: str) -> BaseMediaHandler:
        mapping = {
            "image": ImageHandler(),
            "video": VideoHandler()
        }
        return mapping[media_type]

# ====================== 【数据模型：专题Task】 ======================
class PostTask:
    def __init__(self, url: str):
        self.url = url
        self.title: str = ""
        self.image_list: List[str] = []
        self.video_list: List[str] = []

# ====================== 【主异步爬虫类】 ======================
class AsyncCrawler:
    def __init__(self):
        self.cfg = CrawlerConfig()
        self.repo = CrawlRepository()
        self.req_strategy = RequestStrategy()
        self.media_factory = MediaFactory()
        self.executor = ThreadPoolExecutor(max_workers=self.cfg.MAX_WORKERS)
        os.makedirs(self.cfg.SAVE_ROOT, exist_ok=True)

    async def run_sync_in_thread(self, func, *args, **kwargs):
        """把同步函数丢入线程池，包装成异步可等待任务"""
        loop = asyncio.get_running_loop()
        return await loop.run_in_executor(self.executor, func, *args, **kwargs)

    async def detect_max_page(self) -> int:
        html = await self.run_sync_in_thread(self.req_strategy.fetch_sync, self.cfg.BASE_URL)
        if not html:
            return 1
        pages = re.findall(r'index\.php\?p=(\d+)&size=50', html)
        if pages:
            return max(int(p) for p in pages)
        return 1

    async def parse_list_page(self, page: int) -> List[str]:
        if page == 1:
            url = self.cfg.BASE_URL
        else:
            url = f"{self.cfg.BASE_URL}/index.php?p={page}&size=50"
        html = await self.run_sync_in_thread(self.req_strategy.fetch_sync, url)
        if not html:
            return []
        links = set()
        LIST_LINK_RE = re.compile(r'href="(/post/\d+)/"')
        for m in LIST_LINK_RE.findall(html):
            full = urljoin(self.cfg.BASE_URL, m)
            links.add(full)
        return list(links)

    async def parse_post_detail(self, post_url: str):
        if self.repo.is_visited(post_url):
            print(f"⏭️ 已爬跳过：{post_url}")
            return
        html = await self.run_sync_in_thread(self.req_strategy.fetch_sync, post_url, self.cfg.BASE_URL)
        if not html:
            print(f"❌ 详情页获取失败: {post_url}")
            return

        h1_search = re.search(r'<h1.*?>(.*?)</h1>' ,html)
        if not h1_search:
            title_raw = f"no_title_{random.randint(1000,9999)}"
        else:
            title_raw = h1_search.group(1).strip()
        title = self.req_strategy.clean_filename(title_raw)
        save_dir = os.path.join(self.cfg.SAVE_ROOT, title)
        os.makedirs(save_dir, exist_ok=True)

        img_pattern = re.compile(r'data-src="(.*?)"')
        video_pattern = re.compile(r'<source\s+src\s*=\s*"(.*?)"')
        image_urls = img_pattern.findall(html)
        video_urls = video_pattern.findall(html)

        print(f"\n📦 专题【{title}】图片{len(image_urls)}张,视频{len(video_urls)}个, url:{post_url}")
        # 下载图片
        img_handler = self.media_factory.get_handler("image")
        for idx, src in enumerate(image_urls, start=1):
            await self.run_sync_in_thread(img_handler.download, self.req_strategy, src, save_dir, idx, post_url)
        # 下载视频
        vid_handler = self.media_factory.get_handler("video")
        for idx, src in enumerate(video_urls, start=1):
            await self.run_sync_in_thread(vid_handler.download, self.req_strategy, src, save_dir, idx, post_url)

        self.repo.mark_visited(post_url)

    async def main(self):
        max_page = await self.detect_max_page()
        print(f"🔍 检测总页数: {max_page}")
        for p in range(1, max_page + 1):
            print(f"\n===== 列表页 {p} =====")
            post_links = await self.parse_list_page(p)
            print(f"本页发现 {len(post_links)} 个专题")
            # 并发执行多个专题任务，由MAX_WORKERS控制并发上限
            tasks = [self.parse_post_detail(link) for link in post_links]
            await asyncio.gather(*tasks)

        print("\n🎉 全部任务完成")

if __name__ == "__main__":
    crawler = AsyncCrawler()
    asyncio.run(crawler.main())
