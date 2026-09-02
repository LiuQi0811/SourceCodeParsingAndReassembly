import asyncio
import os
import re
import aiohttp
import hashlib
import json
from concurrent.futures import ThreadPoolExecutor
from typing import List, Set, Deque, Tuple, Dict, Optional
from urllib.parse import urljoin, urlparse
from bs4 import BeautifulSoup
from collections import deque
from playwright.async_api import async_playwright, Page, BrowserContext


# ============================================================
# 一、解析器层：工厂模式
# ============================================================
class BasePageParser:
    def parse(self, html: str, base_url: str) -> Tuple[Set[str], Set[str]]:
        raise NotImplementedError


class AdoutuPageParser(BasePageParser):
    def parse(self, html: str, base_url: str) -> Tuple[Set[str], Set[str]]:
        soup = BeautifulSoup(html, "html.parser")

        img_urls: Set[str] = set()
        for img in soup.find_all("img"):
            src = img.get("src") or img.get("data-src")
            if src:
                img_urls.add(urljoin(base_url, src))

        for tag in soup.find_all(attrs={"style": True}):
            style = tag["style"]
            if "background-image" in style:
                for part in style.split(";"):
                    if "background-image" in part:
                        val = part.split("url(")[-1].split(")")[0].strip('\'" ')
                        if val:
                            img_urls.add(urljoin(base_url, val))

        page_urls: Set[str] = set()
        for a in soup.find_all("a", href=True):
            href = a["href"].strip()
            abs_href = urljoin(base_url, href)
            p = urlparse(abs_href)
            if p.netloc == "www.adoutu.com" and p.scheme in ("http", "https"):
                page_urls.add(abs_href)

        return img_urls, page_urls


class ParserFactory:
    @staticmethod
    def get_parser(site: str) -> BasePageParser:
        if site == "adoutu":
            return AdoutuPageParser()
        raise ValueError(f"未支持站点 {site}")


# ============================================================
# 二、URL 过滤工具
# ============================================================
class UrlFilter:
    IMG_SUFFIX = {".jpg", ".jpeg", ".png", ".gif", ".webp", ".bmp"}

    SKIP_PATTERNS = [
        r"/article/list",
        r"/article/\d+",
        r"/search",
        r"/tag",
        r"/category",
        r"/page/\d+",
        r"/about",
        r"/contact",
        r"/login",
        r"/register",
    ]

    @classmethod
    def is_image_url(cls, url: str) -> bool:
        path = urlparse(url).path.lower()
        return any(path.endswith(s) for s in cls.IMG_SUFFIX)

    @classmethod
    def is_skip_page(cls, url: str) -> bool:
        path = urlparse(url).path
        for pattern in cls.SKIP_PATTERNS:
            if re.search(pattern, path):
                return True
        return False

    @classmethod
    def is_picture_detail(cls, url: str) -> bool:
        return "/picture/" in urlparse(url).path


# ============================================================
# 三、Page对象池：复用Page，减少浏览器创建销毁开销
# ============================================================
class PagePool:
    def __init__(self, ctx: BrowserContext, pool_size: int):
        self._ctx = ctx
        self._pool_size = pool_size
        self._pool: asyncio.Queue[Page] = asyncio.Queue(maxsize=pool_size)

    async def init(self):
        """预创建一批page放入池子"""
        headers = {
            "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36",
            "Referer": "https://www.adoutu.com/"
        }
        for _ in range(self._pool_size):
            page = await self._ctx.new_page()
            await page.set_extra_http_headers(headers)
            await self._pool.put(page)

    async def acquire(self) -> Page:
        return await self._pool.get()

    async def release(self, page: Page):
        # 页面复用，不关闭；仅重置页面状态
        try:
            await page.goto("about:blank", timeout=8000)
        except Exception:
            pass
        await self._pool.put(page)

    async def close_all(self):
        while not self._pool.empty():
            p = await self._pool.get()
            try:
                await p.close()
            except Exception:
                pass


# ============================================================
# 四、爬虫调度层：Playwright + Page池 + BFS + 套图优先 + 页面重试
# ============================================================
class SitePlaywrightCrawler:
    def __init__(
        self,
        seed_urls: List[str],
        max_concurrent: int = 2,
        max_crawl_pages: int = 200,
        max_total_images: int = 2000,
        page_delay: float = 1.0,
        page_retry: int = 2
    ):
        self.seed_urls = seed_urls
        self.max_concurrent = max_concurrent
        self.max_crawl_pages = max_crawl_pages
        self.max_total_images = max_total_images
        self.page_delay = page_delay
        self.page_retry = page_retry

        self.queue: Deque[str] = deque()
        self.visited: Set[str] = set()
        self.all_image_links: Set[str] = set()
        self.page_to_images: Dict[str, List[str]] = {}

        self.executor = ThreadPoolExecutor(max_workers=2, thread_name_prefix="parse")
        self.playwright = None
        self.browser = None
        self.context: Optional[BrowserContext] = None
        self.page_pool: Optional[PagePool] = None

    async def __aenter__(self):
        self.playwright = await async_playwright().start()
        self.browser = await self.playwright.chromium.launch(
            headless=True,
            args=["--no-sandbox", "--disable-gpu", "--disable-dev-tools"]
        )
        self.context = await self.browser.new_context()
        # 初始化Page池
        self.page_pool = PagePool(self.context, pool_size=self.max_concurrent)
        await self.page_pool.init()

        for seed in self.seed_urls:
            if seed not in self.visited:
                self.queue.append(seed)
                self.visited.add(seed)
        return self

    async def __aexit__(self, exc_type, exc_val, exc_tb):
        if self.page_pool:
            await self.page_pool.close_all()
        if self.context:
            await self.context.close()
        if self.browser:
            await self.browser.close()
        if self.playwright:
            await self.playwright.stop()
        self.executor.shutdown(wait=True)

    async def get_rendered_html(self, url: str) -> Optional[str]:
        """从page池获取page，复用页面，带重试"""
        last_err: Optional[Exception] = None
        for attempt in range(self.page_retry + 1):
            page = await self.page_pool.acquire()
            try:
                resp = await page.goto(url, timeout=20000, wait_until="networkidle")
                if not resp or resp.status != 200:
                    raise Exception(f"status={resp.status if resp else None}")

                # 滚动触发懒加载
                await page.evaluate("""
                    async () => {
                        await new Promise(resolve => {
                            let totalHeight = 0;
                            const distance = 600;
                            const timer = setInterval(() => {
                                const scrollHeight = document.body.scrollHeight;
                                window.scrollBy(0, distance);
                                totalHeight += distance;
                                if(totalHeight >= scrollHeight){
                                    clearInterval(timer);
                                    resolve();
                                }
                            },300);
                        });
                    }
                """)
                await page.wait_for_timeout(1200)
                html = await page.content()
                return html
            except Exception as e:
                last_err = e
                if attempt < self.page_retry:
                    await asyncio.sleep(1.0)
            finally:
                await self.page_pool.release(page)
        print(f"[page fail] {url} retries exhausted: {last_err}")
        return None

    def _sync_parse_task(self, html: str, base_url: str, parser: BasePageParser):
        return parser.parse(html, base_url)

    async def worker(self, parser: BasePageParser):
        while self.queue:
            if len(self.visited) >= self.max_crawl_pages:
                break
            if len(self.all_image_links) >= self.max_total_images:
                print(f"⚠️达到总图片上限 {self.max_total_images}，停止爬取")
                break

            current_url = self.queue.popleft()
            picture_flag = " [套图页]" if UrlFilter.is_picture_detail(current_url) else ""
            print(f"[crawl {len(self.visited)}/{self.max_crawl_pages}] queue={len(self.queue)} {current_url}{picture_flag}")

            html = await self.get_rendered_html(current_url)
            if not html:
                continue

            loop = asyncio.get_running_loop()
            img_set, next_pages = await loop.run_in_executor(
                self.executor,
                self._sync_parse_task,
                html,
                current_url,
                parser
            )

            img_list = list(img_set)
            self.page_to_images[current_url] = img_list
            self.all_image_links.update(img_set)
            print(f"    └─ 本页面提取图片：{len(img_list)} 张 | 累计总图：{len(self.all_image_links)}")

            for pu in next_pages:
                if pu not in self.visited and len(self.visited) < self.max_crawl_pages:
                    if UrlFilter.is_image_url(pu):
                        continue
                    if UrlFilter.is_skip_page(pu):
                        continue
                    self.visited.add(pu)
                    if UrlFilter.is_picture_detail(pu):
                        self.queue.appendleft(pu)
                    else:
                        self.queue.append(pu)

            await asyncio.sleep(self.page_delay)

    async def start_crawl(self, parser: BasePageParser):
        tasks = [asyncio.create_task(self.worker(parser)) for _ in range(self.max_concurrent)]
        await asyncio.gather(*tasks)
        return list(self.all_image_links), list(self.visited), self.page_to_images


# ============================================================
# 五、图片下载层 + 增量持久化MD5哈希库（image_hash_db.json）
# ============================================================
class ImageDownloader:
    def __init__(
        self,
        save_dir: str = "adoutu_images",
        max_concurrent: int = 5,
        page_to_images: Dict[str, List[str]] | None = None,
        enable_md5_dedup: bool = True,
        hash_db_filename: str = "image_hash_db.json"
    ):
        self.save_dir = save_dir
        self.semaphore = asyncio.Semaphore(max_concurrent)
        self.page_to_images = page_to_images or {}
        self.enable_md5_dedup = enable_md5_dedup
        self.hash_db_path = os.path.join(save_dir, hash_db_filename)
        # md5 -> 真实文件绝对路径
        self.hash_db: Dict[str, str] = {}

        self.headers = {
            "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36",
            "Referer": "https://www.adoutu.com/"
        }
        os.makedirs(save_dir, exist_ok=True)
        self._load_hash_db()

    def _load_hash_db(self):
        """加载持久化哈希库；文件不存在则为空字典"""
        if os.path.exists(self.hash_db_path):
            try:
                with open(self.hash_db_path, "r", encoding="utf-8") as f:
                    self.hash_db = json.load(f)
            except Exception:
                self.hash_db = {}
        else:
            self.hash_db = {}

    def _save_hash_db(self):
        """保存哈希库到json"""
        with open(self.hash_db_path, "w", encoding="utf-8") as f:
            json.dump(self.hash_db, f, ensure_ascii=False, indent=2)

    @staticmethod
    def calc_file_md5(file_path: str, chunk_size: int = 65536) -> str:
        md5 = hashlib.md5()
        with open(file_path, "rb") as f:
            while chunk := f.read(chunk_size):
                md5.update(chunk)
        return md5.hexdigest()

    def build_full_hash_db_once(self):
        """首次运行：扫描全部本地文件构建哈希库；仅执行一次"""
        if len(self.hash_db) > 0:
            return
        print("\n========== 首次构建图片哈希库，扫描全部本地图片 ==========")
        count = 0
        for root, _, files in os.walk(self.save_dir):
            for fname in files:
                ext = os.path.splitext(fname)[1].lower()
                if ext not in UrlFilter.IMG_SUFFIX:
                    continue
                fpath = os.path.abspath(os.path.join(root, fname))
                try:
                    h = self.calc_file_md5(fpath)
                    if h not in self.hash_db:
                        self.hash_db[h] = fpath
                        count += 1
                except Exception as e:
                    print(f"[skip] {fpath} {e}")
        self._save_hash_db()
        print(f"哈希库构建完成，录入 {count} 条图片md5记录")

    def dedup_single_file(self, file_path: str) -> int:
        """
        对单个新下载文件做去重
        返回：0=新增原始文件；1=已存在，创建硬链接；-1=跳过异常
        """
        try:
            h = self.calc_file_md5(file_path)
        except Exception as e:
            print(f"[md5 err] {file_path} {e}")
            return -1

        if h not in self.hash_db:
            self.hash_db[h] = file_path
            return 0
        else:
            src_real = self.hash_db[h]
            if os.path.samefile(file_path, src_real):
                return 0
            # 删除当前副本，创建硬链接
            try:
                os.remove(file_path)
                os.link(src_real, file_path)
                return 1
            except OSError as e:
                print(f"[hard link warn] 不支持硬链接 {e}，保留重复文件")
                return -1

    def _get_folder_for_image(self, img_url: str) -> str:
        for page_url, imgs in self.page_to_images.items():
            if img_url in imgs:
                path = urlparse(page_url).path.strip("/")
                folder_name = path.replace("/", "_")
                folder_path = os.path.join(self.save_dir, folder_name)
                os.makedirs(folder_path, exist_ok=True)
                return folder_path
        misc_dir = os.path.join(self.save_dir, "misc")
        os.makedirs(misc_dir, exist_ok=True)
        return misc_dir

    async def download_one(self, img_url: str, session: aiohttp.ClientSession) -> Tuple[bool, Optional[str]]:
        """返回(是否成功,本地文件路径)"""
        async with self.semaphore:
            filename = os.path.basename(urlparse(img_url).path)
            if not filename:
                filename = f"img_{hash(img_url) % 100000}.jpg"

            folder = self._get_folder_for_image(img_url)
            save_path = os.path.join(folder, filename)

            if os.path.exists(save_path):
                return True, save_path

            try:
                async with session.get(img_url, headers=self.headers, timeout=15) as resp:
                    if resp.status != 200:
                        print(f"  [下载失败 {resp.status}] {img_url}")
                        return False, None
                    data = await resp.read()
                    with open(save_path, "wb") as f:
                        f.write(data)
                return True, save_path
            except Exception as e:
                print(f"  [下载异常] {img_url} | {e}")
                return False, None

    async def download_all(self, img_urls: List[str]):
        print(f"\n========== 开始下载图片，共 {len(img_urls)} 张 ==========")
        self.build_full_hash_db_once()

        downloaded_new_files: List[str] = []
        async with aiohttp.ClientSession() as session:
            tasks = [self.download_one(url, session) for url in img_urls]
            results = await asyncio.gather(*tasks)

        success_cnt = 0
        for ok, fpath in results:
            if ok:
                success_cnt += 1
                if fpath and os.path.exists(fpath):
                    downloaded_new_files.append(fpath)

        print(f"下载完成：成功 {success_cnt} 张，失败 {len(img_urls)-success_cnt} 张")
        print(f"保存目录：{os.path.abspath(self.save_dir)}")

        if self.enable_md5_dedup and downloaded_new_files:
            print("\n========== 增量MD5去重（仅处理本次新下载） ==========")
            link_count = 0
            for fp in downloaded_new_files:
                ret = self.dedup_single_file(fp)
                if ret == 1:
                    link_count += 1
            self._save_hash_db()
            print(f"增量去重完成：生成硬链接 {link_count} 个，哈希库已持久化到 {self.hash_db_path}")


# ============================================================
# 六、主入口配置
# ============================================================
async def main():
    parser = ParserFactory.get_parser("adoutu")

    # ========== 配置区 ==========
    seed_urls = [
        "https://www.adoutu.com/"
        # "https://www.adoutu.com/picture/109701"
    ]
    max_concurrent = 2        # page池并发，建议≤2
    max_pages = 200           # 最大访问网页数
    max_total_images = 2000   # 全局图片上限，防止无限爬
    page_delay = 1.0
    page_retry = 2            # 页面失败重试次数

    download_images = True
    download_concurrent = 5
    enable_md5_dedup = True
    # ============================

    async with SitePlaywrightCrawler(
        seed_urls=seed_urls,
        max_concurrent=max_concurrent,
        max_crawl_pages=max_pages,
        max_total_images=max_total_images,
        page_delay=page_delay,
        page_retry=page_retry
    ) as crawler:
        img_links, crawled_pages, page_img_map = await crawler.start_crawl(parser)

    print("\n========== 爬取结果 ==========")
    print(f"实际访问网页数：{len(crawled_pages)}（上限 {max_pages}）")
    print(f"收集图片链接总数：{len(img_links)}")
    picture_pages = [p for p in crawled_pages if UrlFilter.is_picture_detail(p)]
    print(f"其中套图详情页：{len(picture_pages)} 个")

    with open("adoutu_img_links.txt", "w", encoding="utf-8") as f:
        for link in img_links:
            f.write(link + "\n")

    with open("page_image_map.txt", "w", encoding="utf-8") as f:
        for page_url, imgs in page_img_map.items():
            f.write(f"【页面】{page_url}\n")
            for img in imgs:
                f.write(f"    {img}\n")
            f.write("-" * 80 + "\n")

    print("\n✅ 链接文件已输出：")
    print("   adoutu_img_links.txt  → 全部图片链接")
    print("   page_image_map.txt    → 套图页面→图片溯源映射")

    if download_images and img_links:
        downloader = ImageDownloader(
            save_dir="adoutu_images",
            max_concurrent=download_concurrent,
            page_to_images=page_img_map,
            enable_md5_dedup=enable_md5_dedup
        )
        await downloader.download_all(img_links)


if __name__ == "__main__":
    asyncio.run(main())
