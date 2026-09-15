# core/engine.py
import asyncio, aiohttp, time
from typing import Optional
from .queue import CrawlTask, BaseQueue, QueueFactory
from .events import AsyncEventBus, EventType, ProgressObserver
from .encoding import fetch_text
from .resource_saver import (SaverFactory, BaseSaver,
                              classify_resource, ResourceCategory)
from .decryptor import DecryptorChain, NoOpDecryptor
from parsers.factory import ParserFactory, CompositeParser

class CrawlerEngine:
    def __init__(self, config: dict):
        self.config = config
        self.event_bus = AsyncEventBus()
        self.progress = ProgressObserver()
        self._session: Optional[aiohttp.ClientSession] = None
        self._queue: Optional[BaseQueue] = None
        self._saver: Optional[BaseSaver] = None
        self._decryptor: DecryptorChain = DecryptorChain()
        self._default_parser: Optional[CompositeParser] = None
        self._semaphore: asyncio.Semaphore = None
        self._shutdown = asyncio.Event()
        self._register_observers()

    def _register_observers(self):
        self.event_bus.subscribe(EventType.URL_DISCOVERED,
                                 self.progress.on_url_discovered)
        self.event_bus.subscribe(EventType.PAGE_FETCHED,
                                 self.progress.on_page_fetched)
        self.event_bus.subscribe(EventType.TASK_FAILED,
                                 self.progress.on_task_failed)

    async def setup(self):
        # 队列
        qtype = self.config.get("queue_type", "memory")
        qkw = self.config.get("queue_kwargs", {})
        self._queue = QueueFactory.create(qtype, **qkw)
        if hasattr(self._queue, "init"):
            await self._queue.init()
        if hasattr(self._queue, "reset_stale"):
            await self._queue.reset_stale()

        # 解析器
        parser_names = self.config.get("parsers", ["xpath", "regex"])
        self._default_parser = ParserFactory.create_composite(parser_names)

        # 保存器
        self._saver = SaverFactory.create(
            self.config.get("saver", "categorized"),
            base_dir=self.config.get("download_dir", "downloads"),
        )

        # 并发控制
        self._semaphore = asyncio.Semaphore(
            self.config.get("concurrency", 16)
        )

        # HTTP 会话
        self._session = aiohttp.ClientSession(
            connector=aiohttp.TCPConnector(
                limit=self.config.get("concurrency", 16) * 2,
                ssl=False,
            ),
            timeout=aiohttp.ClientTimeout(total=30),
            fallback_charset_resolver=lambda r, b: "utf-8",
            headers={
                "User-Agent": self.config.get("user_agent",
                    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                    "AppleWebKit/537.36 (KHTML, like Gecko) "
                    "Chrome/125.0.0.0 Safari/537.36"),
                "Referer": self.config.get("base_url", ""),
                "Accept-Language": "zh-CN,zh;q=0.9",
            },
        )

    async def seed(self, urls: list[str]):
        for url in urls:
            task = CrawlTask(url=url, depth=0)
            ok = await self._queue.put(task)
            if ok:
                await self.event_bus.emit(EventType.URL_DISCOVERED, url=url)

    async def run(self, max_workers: int = 0):
        """启动 N 个 worker 协程并发消费队列。"""
        workers = max_workers or self.config.get("concurrency", 16)
        tasks = [asyncio.create_task(self._worker(i)) for i in range(workers)]
        await asyncio.gather(*tasks)

    async def _worker(self, worker_id: int):
        while not self._shutdown.is_set():
            task = await self._queue.get()
            if task is None:
                if await self._queue.is_empty():
                    break
                await asyncio.sleep(0.5)
                continue

            async with self._semaphore:
                try:
                    await self._process(task)
                    await self._queue.complete(task, success=True)
                except Exception as e:
                    await self._queue.complete(task, success=False)
                    await self.event_bus.emit(
                        EventType.TASK_FAILED, url=task.url, error=str(e)
                    )

    async def _process(self, task: CrawlTask):
        if task.task_type == "resource":
            await self._download_resource(task)
        else:
            await self._crawl_page(task)

    async def _crawl_page(self, task: CrawlTask):
        url = task.url
        if self.config.get("url_filter") and not self.config["url_filter"](url):
            return

        text, encoding = await fetch_text(self._session, url)
        await self.event_bus.emit(EventType.PAGE_FETCHED, url=url,
                                  encoding=encoding)

        parser = self._default_parser
        if task.meta.get("parser_override"):
            parser = ParserFactory.create_composite(task.meta["parser_override"])

        result = await parser.parse(text, base_url=url)
        await self.event_bus.emit(EventType.PARSE_SUCCESS, url=url,
                                  links=len(result["links"]))

        max_depth = self.config.get("max_depth", 3)
        if task.depth < max_depth:
            for link in result["links"]:
                if self.config.get("url_filter") and \
                   not self.config["url_filter"](link):
                    continue
                new_task = CrawlTask(url=link, depth=task.depth + 1,
                                     referer=url)
                ok = await self._queue.put(new_task)
                if ok:
                    await self.event_bus.emit(
                        EventType.URL_DISCOVERED, url=link
                    )

        for res in result["resources"]:
            res_url = await self._decryptor.process(res["url"])
            res_task = CrawlTask(url=res_url, depth=task.depth + 1,
                                 task_type="resource", referer=url,
                                 meta={"alt": res.get("alt", "")})
            await self._queue.put(res_task)

    async def _download_resource(self, task: CrawlTask):
        async with self._session.get(task.url,
                                     headers={"Referer": task.referer}) as resp:
            if resp.status != 200:
                raise RuntimeError(f"HTTP {resp.status}")
            data = await resp.read()
            ct = resp.headers.get("Content-Type", "")

        category = classify_resource(task.url, ct)
        path = await self._saver.save(task.url, data, category)
        await self.event_bus.emit(EventType.RESOURCE_SAVED,
                                  url=task.url, path=path)

    async def close(self):
        self._shutdown.set()
        if self._session:
            await self._session.close()
        if self._queue:
            await self._queue.close()
        await self.event_bus.emit(EventType.CRAWL_COMPLETED,
                                  stats=self.progress.snapshot())