# main.py
import asyncio
import uuid
import random
from urllib.robotparser import RobotFileParser
from urllib.parse import urljoin
import pybloom_live
import aiohttp
from concurrent.futures import ThreadPoolExecutor
from core.task_model import CrawlTask, TaskStatus, ParserType
from core.queue_strategy import BaseQueueStrategy, MemoryQueueStrategy, SQLiteQueueStrategy, TaskDBModel
from core.parser_factory import ParserFactory
from core.downloader import Downloader
from core.proxy_pool import ProxyPool
from core.event_observer import ProgressBarObserver
from core.hooks import BaseHook
from core.result_store import BaseResultStore, SQLiteResultStore, JsonLinesResultStore
from utils.url_utils import normalize_url, get_domain
from utils.token_bucket import DomainRateLimiter
from settings import *


class RobotsChecker:
    def __init__(self):
        self.cache = dict()
        self._executor = ThreadPoolExecutor(max_workers=2)

    async def can_fetch(self, session: aiohttp.ClientSession, url: str, ua: str) -> bool:
        from urllib.parse import urlparse
        parsed = urlparse(url)
        robots_url = f"{parsed.scheme}://{parsed.netloc}/robots.txt"
        if parsed.netloc in self.cache:
            rp = self.cache[parsed.netloc]
        else:
            try:
                async with session.get(robots_url, timeout=aiohttp.ClientTimeout(total=5)) as r:
                    txt = await r.text()
            except Exception:
                # 获取robots.txt失败，默认允许抓取
                return True
            rp = RobotFileParser()
            # 传入行列表
            rp.parse(txt.splitlines())
            self.cache[parsed.netloc] = rp
        # 标准库方法名：can_fetch，不是is_allowed
        return rp.can_fetch(ua, url)


class Crawler:
    def __init__(self, queue: BaseQueueStrategy, start_urls: list, hook: BaseHook, result_store: BaseResultStore):
        self.queue = queue
        self.start_urls = start_urls
        self.hook = hook
        self.result_store = result_store
        self.bloom = pybloom_live.BloomFilter(capacity=1000000, error_rate=0.001)
        self.proxy_pool = ProxyPool(PROXY_LIST if USE_PROXY_POOL else [])
        self.observer = ProgressBarObserver(total=None if isinstance(queue, SQLiteQueueStrategy) else len(start_urls))
        self.domain_sem_map = dict()
        self.robots_checker = RobotsChecker()
        self.rate_limiter = DomainRateLimiter(default_rps=DOMAIN_DEFAULT_RPS, default_burst=DOMAIN_DEFAULT_BURST)
        # 活跃任务计数：put 时 +1，任务处理完 -1；为 0 且队列空时 worker 退出
        self._active_tasks = 0

    async def parse_page_data(self, html: str, parser_type: ParserType):
        """按 task.parser_type 分发到对应解析器,提取页面标题

        三种解析器用各自语法写等价表达式:
        - XPATH: "//title/text()" → 字符串列表
        - BS4:   "title"          → Tag 列表,需 get_text 取文本
        - RE:    r"<title[^>]*>(.*?)</title>" → 字符串列表(已捕获文本)
        """
        parser = ParserFactory.get_parser(parser_type)
        if parser_type == ParserType.XPATH:
            title_list = parser.parse(html, "//title/text()")
            title = title_list[0].strip() if title_list else ""
        elif parser_type == ParserType.BS4:
            tags = parser.parse(html, "title")
            title = tags[0].get_text().strip() if tags else ""
        else:  # ParserType.RE
            matches = parser.parse(html, r"<title[^>]*>(.*?)</title>", )
            title = matches[0].strip() if matches else ""
        return {
            "title": title,
            "parsed_data": {
                "page_title": title
            }
        }

    async def extract_links(self, html: str, base_url: str) -> list:
        """提取页面所有可抓取资源链接：a/img/audio/video/source/script/link/object/embed/iframe"""
        parser = ParserFactory.get_parser(ParserType.XPATH)
        # 用一个并集 XPath 一次性抓出所有目标属性
        expr = " | ".join([
            "//a/@href",                                   # 页面跳转 + 直链文件(文档/压缩包等)
            "//img/@src | //img/@data-src | //img/@data-original | //img/@data-lazy-src",  # 图片
            "//audio/@src",                                # 音频
            "//video/@src | //video/@poster",              # 视频 + 封面
            "//source/@src",                               # <picture>/<video><audio><source>
            "//script/@src",                              # JS
            # CSS + favicon + preload 字体(as=font)
            "//link[@rel='stylesheet']/@href | //link[contains(@rel,'icon')]/@href | //link[@rel='preload' and @as='font']/@href",
            "//object/@data | //embed/@src",               # 嵌入对象(老式)
            "//iframe/@src"                               # 内嵌页(也作页面抓)
        ])
        raw_links = parser.parse(html, expr)
        out = []
        for link in raw_links:
            if not link:
                continue
            # 跳过 data:/javascript:/mailto: 等非 http(s) 链接
            if not link.startswith(("http://", "https://", "//", "/")) and "://" not in link:
                continue
            abs_url = normalize_url(urljoin(base_url, link))
            if abs_url.startswith(("http://", "https://")) and abs_url not in self.bloom:
                self.bloom.add(abs_url)
                out.append(abs_url)
        return out

    async def worker(self, session: aiohttp.ClientSession):
        downloader = Downloader(
            session=session,
            proxy_pool=self.proxy_pool,
            hook=self.hook,
            save_root=SAVE_ROOT,
            domain_sem_map=self.domain_sem_map,
            global_sem=asyncio.Semaphore(GLOBAL_SEM),
            rate_limiter=self.rate_limiter
        )
        while True:
            task = await self.queue.get()
            if not task:
                # 队列空且无活跃任务时退出，否则继续轮询
                if self._active_tasks == 0:
                    break
                await asyncio.sleep(0.3)
                continue
            try:
                ua = random.choice(UA_POOL)
                headers = {"User-Agent": ua, "Referer": task.referer or ""}
                allow = await self.robots_checker.can_fetch(session, task.url, ua)
                if not allow:
                    raise Exception("robots禁止抓取")

                html_text, raw_bytes, res_type, saved_file_path = await downloader.fetch(task, headers)
                await self.observer.on_task_success(task.task_id, task.url)
                await self.queue.update_task_status(task.task_id, TaskStatus.SUCCESS)

                # 解析页面结构化数据
                parse_result = await self.parse_page_data(html_text, task.parser_type)
                parse_result["resource_type"] = res_type
                parse_result["saved_file_path"] = saved_file_path
                # 保存结果
                await self.result_store.save_result(task.task_id, task.url, parse_result)

                if res_type == "html":
                    # extract_links 内部已通过 bloom 去重，直接入队
                    new_links = await self.extract_links(html_text, task.url)
                    for new_url in new_links:
                        new_task = CrawlTask(
                            url=new_url,
                            task_id=str(uuid.uuid4()),
                            # 继承父任务解析器,保持解析策略一致
                            parser_type=task.parser_type,
                            referer=task.url
                        )
                        # 只有真正入队才增加活跃计数
                        if await self.queue.put(new_task):
                            self._active_tasks += 1

                await asyncio.sleep(random.uniform(0.2, 1.2))

            except Exception as e:
                task.retry_count += 1
                if task.retry_count < task.max_retry:
                    status = TaskStatus.FAILED_TEMP
                else:
                    status = TaskStatus.FAILED_PERM
                await self.observer.on_task_fail(task.task_id, task.url, e)
                await self.queue.update_task_status(task.task_id, status, task.retry_count)
            finally:
                # 任务处理完成（成功或失败），活跃计数 -1
                self._active_tasks -= 1

    async def run(self):
        # 初始化表
        if isinstance(self.queue, SQLiteQueueStrategy):
            await self.queue.init_table()
        if isinstance(self.result_store, SQLiteResultStore):
            await self.result_store.init_table()

        # 初始化起始任务
        for url in self.start_urls:
            url = normalize_url(url)
            if url not in self.bloom:
                self.bloom.add(url)
                t = CrawlTask(url=url, task_id=str(uuid.uuid4()))
                if await self.queue.put(t):
                    self._active_tasks += 1

        # 起始任务全部已存在（上次已抓完），提示并退出
        if self._active_tasks == 0:
            print("所有起始 URL 已抓取过，无新任务可执行。")
            print("如需重抓，删除 crawler.db 后重跑，或修改 start_urls。")
            self.observer.close()
            return

        connector = aiohttp.TCPConnector(limit=0)
        async with aiohttp.ClientSession(connector=connector) as session:
            workers = [asyncio.create_task(self.worker(session)) for _ in range(GLOBAL_SEM)]
            try:
                await asyncio.gather(*workers)
            except (asyncio.CancelledError, KeyboardInterrupt):
                # 收到中断信号：取消所有 worker，等待其退出当前操作
                print("\n收到中断信号，正在等待 worker 退出...")
                for w in workers:
                    if not w.done():
                        w.cancel()
                # 等待 worker 退出；若自身被二次取消则忽略
                try:
                    await asyncio.gather(*workers, return_exceptions=True)
                except asyncio.CancelledError:
                    pass
        self.observer.close()


# ========== 自定义钩子示例（逆向扩展点） ==========
class CustomHook(BaseHook):
    async def before_request(self, task: CrawlTask, headers: dict):
        # 在这里自定义Cookie、签名、token
        # headers["token"] = calc_sign(task.url)
        return headers

    async def after_response(self, task: CrawlTask, resp_bytes: bytes):
        # 响应解密、JS密文、base64解密
        return resp_bytes


async def main_bilibili(url: str):
    """B 站视频下载入口(独立于通用爬虫)

    用法:
        uv run main.py --bilibili https://www.bilibili.com/video/BV1xx411c7mD
        uv run main.py --bilibili BV1xx411c7mD
    高清需要先在 settings.py 配置 BILIBILI_SESSDATA
    """
    import aiohttp
    from core.bilibili_dash import BilibiliDashDownloader
    from settings import BILIBILI_SESSDATA

    if not BILIBILI_SESSDATA:
        print("提示: BILIBILI_SESSDATA 未配置,仅可下载低清晰度(360P/480P)")
        print("      如需高清,在 settings.py 填入你的 SESSDATA cookie\n")

    connector = aiohttp.TCPConnector(limit=4)
    async with aiohttp.ClientSession(connector=connector) as session:
        dl = BilibiliDashDownloader(
            session=session,
            sessdata=BILIBILI_SESSDATA,
            save_root=SAVE_ROOT,
        )
        await dl.download_video(url)


async def main():
    import sys

    # --bilibili URL 子命令:走 B 站 DASH 下载分支
    if "--bilibili" in sys.argv:
        idx = sys.argv.index("--bilibili")
        if idx + 1 >= len(sys.argv):
            print("用法: uv run main.py --bilibili <URL 或 BV号>")
            return
        await main_bilibili(sys.argv[idx + 1])
        return

    reset = "--reset" in sys.argv

    # 切换队列：MemoryQueueStrategy / SQLiteQueueStrategy
    queue = SQLiteQueueStrategy()
    # queue = MemoryQueueStrategy()

    # 二选一存储后端
    result_store = SQLiteResultStore(db_path="crawler.db")
    # result_store = JsonLinesResultStore(save_path="result.jsonl")

    # --reset：清空上次任务，支持重抓
    if reset and isinstance(queue, SQLiteQueueStrategy):
        await queue.init_table()
        from sqlalchemy import delete
        async with queue._lock:
            async with queue.async_session() as session:
                await session.execute(delete(TaskDBModel))
                await session.commit()
        print("已清空队列任务表")

    start_urls = [
        "https://5dy4.vip/"
    ]
    hook = CustomHook()
    crawler = Crawler(queue, start_urls, hook, result_store)
    try:
        await crawler.run()
    except (asyncio.CancelledError, KeyboardInterrupt):
        print("\n正在关闭数据库连接...")
    finally:
        # dispose 引擎，避免 aiosqlite 后台任务悬挂导致
        # "Task was destroyed but it is pending!" 与连接终止报错
        try:
            await asyncio.shield(asyncio.gather(
                queue.close(), result_store.close(), return_exceptions=True
            ))
        except asyncio.CancelledError:
            pass
        crawler.observer.close()


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        pass
