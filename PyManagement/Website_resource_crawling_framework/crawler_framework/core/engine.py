"""
异步抓取核心调度引擎 (CrawlerEngine)
基于 Python asyncio + aiohttp
深度整合策略模式（队列、解析器、解密器）、工厂模式与观察者模式
"""
import asyncio
import os
import time
from typing import Any, Dict, List, Optional, Union
import aiohttp
from crawler_framework.core.models import (
    CrawlTask,
    CrawlResponse,
    QueueMode,
    ParserMode,
    ResourceCategory,
    TaskStatus,
)
from crawler_framework.parsers.pagination_detector import PaginationDetector
from crawler_framework.queues.base import BaseQueueStrategy
from crawler_framework.queues.factory import QueueFactory
from crawler_framework.parsers.base import BaseParser
from crawler_framework.parsers.factory import ParserFactory
from crawler_framework.decoders.charset_detector import CharsetDetector
from crawler_framework.storage.resource_classifier import ResourceClassifier
from crawler_framework.storage.saver import ResourceSaver
from crawler_framework.decryptors.factory import DecryptorFactory
from crawler_framework.observers.event_bus import CrawlerEventBus
from crawler_framework.observers.events import CrawlerEvent, EventType
from crawler_framework.observers.builtin_observers import (
    ConsoleTerminalObserver,
    MetricsObserver,
    FileAuditObserver,
)


class CrawlerEngine:
    """全站资源异步抓取核心引擎"""

    def __init__(
        self,
        queue: Optional[BaseQueueStrategy] = None,
        queue_mode: str = "memory",
        db_path: str = "crawler_tasks.db",
        default_parser: str = "xpath",
        concurrency: int = 10,
        request_timeout: float = 20.0,
        user_agent: str = "Mozilla/5.0 (compatible; AsyncCrawlerEngine/1.0)",
        save_dir: str = "downloads",
        auto_save_resources: bool = True,
        max_depth: int = 3,
        max_pages: int = 50,
        auto_follow_links: bool = True,
        auto_follow_pagination: bool = True,
        same_domain_only: bool = True,
        allowed_domains: Optional[List[str]] = None,
        enable_console_log: bool = True,
    ):
        # 1. 队列策略实例（若未传则通过工厂创建）
        self.queue_mode = queue_mode
        self.queue = queue or QueueFactory.create_queue(mode=queue_mode, db_path=db_path)

        # 2. 解析器工厂与全局默认解析器
        self.default_parser_type = default_parser

        # 3. 存储与分类保存器
        self.auto_save_resources = auto_save_resources
        self.saver = ResourceSaver(base_dir=save_dir)

        # 4. 并发、网络与调度控制
        self.concurrency = concurrency
        self.semaphore = asyncio.Semaphore(concurrency)
        self.request_timeout = aiohttp.ClientTimeout(total=request_timeout)
        self.default_headers = {
            "User-Agent": user_agent,
            "Accept": "*/*",
            "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
        }
        self.max_depth = max_depth
        self.max_pages = max_pages
        self.pages_crawled = 0
        self.auto_follow_links = auto_follow_links
        self.auto_follow_pagination = auto_follow_pagination
        self.same_domain_only = same_domain_only
        self.allowed_domains = allowed_domains or []

        # 5. 观察者模式事件中心
        self.event_bus = CrawlerEventBus()
        self.metrics_observer = MetricsObserver()
        self.event_bus.subscribe(self.metrics_observer)

        if enable_console_log:
            self.console_observer = ConsoleTerminalObserver()
            self.event_bus.subscribe(self.console_observer)

        self.audit_observer = FileAuditObserver()
        self.event_bus.subscribe(self.audit_observer)

        self._session: Optional[aiohttp.ClientSession] = None
        self._is_running = False
        self._start_time: float = 0.0
        self._queue_initialized = False

    def add_observer(self, observer) -> "CrawlerEngine":
        """注册自定义观察者"""
        self.event_bus.subscribe(observer)
        return self

    async def _ensure_queue(self) -> None:
        """确保队列已初始化（建表/索引），保证 add_url 在 run 之前调用也安全"""
        if not self._queue_initialized:
            await self.queue.initialize()
            self._queue_initialized = True

    async def add_url(
        self,
        url: str,
        depth: int = 0,
        parser_type: Optional[str] = None,
        parser_rules: Optional[Dict[str, Any]] = None,
        decrypt_type: Optional[str] = None,
        decrypt_params: Optional[Dict[str, Any]] = None,
        priority: int = 0,
    ) -> bool:
        """向队列投递抓取任务"""
        await self._ensure_queue()
        task = CrawlTask(
            url=url,
            depth=depth,
            max_depth=self.max_depth,
            parser_type=parser_type,
            parser_rules=parser_rules,
            decrypt_type=decrypt_type,
            decrypt_params=decrypt_params or {},
            priority=priority,
        )
        added = await self.queue.push(task)
        if added:
            await self.event_bus.emit(CrawlerEvent(
                event_type=EventType.TASK_ENQUEUED,
                task=task,
                message=f"新任务入队: {url}"
            ))
        return added

    async def add_urls(self, urls: List[str]) -> int:
        """批量投递URL"""
        await self._ensure_queue()
        tasks = [CrawlTask(url=u, max_depth=self.max_depth) for u in urls]
        count = await self.queue.push_batch(tasks)
        for t in tasks:
            await self.event_bus.emit(CrawlerEvent(
                event_type=EventType.TASK_ENQUEUED,
                task=t,
                message=f"批量入队: {t.url}"
            ))
        return count

    async def resume_from_breakpoint(self) -> int:
        """从断点处续爬：重置之前因退出而中断的未完成任务"""
        reset_count = await self.queue.reset_processing()
        return reset_count

    async def run(self) -> Dict[str, Any]:
        """启动抓取全流程核心循环"""
        self._is_running = True
        self._start_time = time.time()

        # 初始化队列（如 SQLite 建表和索引）
        await self.queue.initialize()

        # 触发断点重置
        if self.queue_mode == "sqlite":
            await self.resume_from_breakpoint()

        # 发出启动事件
        await self.event_bus.emit(CrawlerEvent(
            event_type=EventType.ENGINE_STARTED,
            data={
                "queue_mode": self.queue_mode,
                "concurrency": self.concurrency,
                "default_parser": self.default_parser_type,
            }
        ))

        # 创建 aiohttp 会话
        connector = aiohttp.TCPConnector(limit=self.concurrency * 2, ssl=False)
        async with aiohttp.ClientSession(
            connector=connector,
            headers=self.default_headers,
            timeout=self.request_timeout
        ) as session:
            self._session = session

            active_workers = set()

            while self._is_running:
                # 检查是否所有任务都已处理完毕
                if await self.queue.is_empty() and len(active_workers) == 0:
                    break

                task = await self.queue.pop()
                if task is None:
                    if len(active_workers) == 0 and await self.queue.is_empty():
                        break
                    # 短暂休眠等待工作中的 worker 发现新 URL
                    await asyncio.sleep(0.1)
                    continue

                # 启动并发工作协程
                worker = asyncio.create_task(self._process_task(task))
                active_workers.add(worker)
                worker.add_done_callback(active_workers.discard)

                # 控制并发创建速率
                if len(active_workers) >= self.concurrency:
                    # 等待任意一个 worker 完成
                    done, _ = await asyncio.wait(active_workers, return_when=asyncio.FIRST_COMPLETED)

            # 等待所有剩余工作协程完成
            if active_workers:
                await asyncio.gather(*active_workers, return_exceptions=True)

        self._is_running = False
        total_elapsed = time.time() - self._start_time

        # 触发停止事件
        await self.event_bus.emit(CrawlerEvent(
            event_type=EventType.ENGINE_STOPPED,
            data={"total_elapsed": total_elapsed}
        ))

        # 关闭队列资源
        await self.queue.close()

        # 返回汇总指标
        summary = await self.metrics_observer.get_summary()
        return summary

    async def _process_task(self, task: CrawlTask) -> None:
        """处理单条任务的完整生命周期"""
        async with self.semaphore:
            await self.event_bus.emit(CrawlerEvent(
                event_type=EventType.TASK_STARTED,
                task=task
            ))

            start_t = time.time()
            try:
                # 1. 异步发送 HTTP 请求
                async with self._session.request(
                    method=task.method,
                    url=task.url,
                    headers=task.headers,
                    params=task.params,
                    data=task.data,
                    json=task.json_data,
                ) as resp:
                    raw_bytes = await resp.read()
                    elapsed = time.time() - start_t
                    content_type = resp.headers.get("Content-Type", "")

                    # 2. 自动字符集识别与解码（彻底杜绝中文乱码）
                    text, detected_enc = CharsetDetector.decode(raw_bytes, content_type)

                    # 3. 自动识别资源类型
                    category = ResourceClassifier.classify(task.url, content_type, raw_bytes)

                    crawl_res = CrawlResponse(
                        task=task,
                        status_code=resp.status,
                        url=str(resp.url),
                        headers=dict(resp.headers),
                        content_type=content_type,
                        raw_content=raw_bytes,
                        text=text,
                        encoding=detected_enc,
                        category=category,
                        file_size=len(raw_bytes),
                        elapsed=elapsed,
                    )

                    # 4. 逆向解密扩展处理
                    decrypt_type = task.decrypt_type
                    if decrypt_type:
                        decryptor = DecryptorFactory.create_decryptor(decrypt_type)
                        if decryptor:
                            try:
                                # 优先对 text 解密，若无 text 则对 raw_bytes 解密
                                payload_to_decrypt = text if text else raw_bytes
                                decrypted_data = decryptor.decrypt(payload_to_decrypt, task.decrypt_params)
                                crawl_res.decrypted_content = decrypted_data
                                await self.event_bus.emit(CrawlerEvent(
                                    event_type=EventType.DECRYPT_TRIGGERED,
                                    task=task,
                                    response=crawl_res,
                                    data={"decrypt_type": decrypt_type, "result": decrypted_data}
                                ))
                            except Exception as de:
                                print(f"[Decrypt Error] 逆向解密失败: {de}")

                    # 5. 自动分类持久化存储
                    if self.auto_save_resources and category != ResourceCategory.PAGE:
                        saved_path, fsize = await self.saver.save_resource(
                            url=crawl_res.url,
                            category=category,
                            content=raw_bytes,
                            content_type=content_type
                        )
                        crawl_res.saved_path = saved_path
                        await self.event_bus.emit(CrawlerEvent(
                            event_type=EventType.RESOURCE_SAVED,
                            task=task,
                            response=crawl_res,
                            data={"saved_path": saved_path, "category": category.value, "size": fsize}
                        ))

                    # 6. 解析器策略调用（BS4、XPath、Regex或组合解析器）
                    # 优先使用任务指定的解析器，否则使用全局默认配置
                    parser_name = task.parser_type or self.default_parser_type
                    parser = ParserFactory.get_parser(parser_name)

                    # 执行结构化抽取与链接发现
                    parse_result = parser.parse(
                        html_or_text=text,
                        base_url=crawl_res.url,
                        rules=task.parser_rules
                    )
                    crawl_res.parsed_data = parse_result.data
                    crawl_res.extracted_urls = parse_result.extracted_urls

                    # 智能翻页与链接分流识别
                    extracted_pack = PaginationDetector.extract_links_and_pagination(
                        html=text,
                        base_url=crawl_res.url,
                        same_domain=self.same_domain_only,
                        allowed_domains=self.allowed_domains,
                    )
                    pagination_links = extracted_pack.get("pagination_links", [])
                    content_links = extracted_pack.get("content_links", [])
                    page_resources = extracted_pack.get("resource_urls", [])

                    await self.event_bus.emit(CrawlerEvent(
                        event_type=EventType.REQUEST_SUCCESS,
                        task=task,
                        response=crawl_res
                    ))

                    await self.event_bus.emit(CrawlerEvent(
                        event_type=EventType.DATA_EXTRACTED,
                        task=task,
                        response=crawl_res,
                        data={
                            "fields": parse_result.data,
                            "links_found": len(content_links),
                            "pagination_found": len(pagination_links),
                            "resources_found": len(page_resources),
                        }
                    ))

                    # 统计网页计数
                    if category == ResourceCategory.PAGE or text:
                        self.pages_crawled += 1

                    # 7. 全站递归抓取与翻页推进
                    if self.auto_follow_links and task.depth < task.max_depth:
                        # 检查是否已达到用户配置的最大抓取页数
                        if self.pages_crawled >= self.max_pages:
                            await self.event_bus.emit(CrawlerEvent(
                                event_type=EventType.ENGINE_STOPPED,
                                message=f"已达到预设最大抓取页面限制 ({self.max_pages} 页)，调度器平稳收尾！"
                            ))
                            self._is_running = False
                        else:
                            # 7.1 翻页链接入队（最高优先级，保证连续翻页推进）
                            if self.auto_follow_pagination and pagination_links:
                                for pag_item in pagination_links:
                                    pag_url = pag_item["url"]
                                    if self._is_domain_allowed(pag_url):
                                        next_task = CrawlTask(
                                            url=pag_url,
                                            depth=task.depth + 1,
                                            max_depth=task.max_depth,
                                            parser_type=task.parser_type,
                                            priority=task.priority + 10,  # 提升翻页权重
                                        )
                                        added = await self.queue.push(next_task)
                                        if added:
                                            await self.event_bus.emit(CrawlerEvent(
                                                event_type=EventType.TASK_ENQUEUED,
                                                task=next_task,
                                                message=f"★ [发现翻页] 深度={next_task.depth} | {pag_item.get('text', '翻页')} -> {pag_url}"
                                            ))

                            # 7.2 站内栏目与文章详情链接入队
                            for c_url in content_links:
                                if self._is_domain_allowed(c_url):
                                    next_task = CrawlTask(
                                        url=c_url,
                                        depth=task.depth + 1,
                                        max_depth=task.max_depth,
                                        parser_type=task.parser_type,
                                        priority=task.priority - 1,
                                    )
                                    added = await self.queue.push(next_task)
                                    if added:
                                        await self.event_bus.emit(CrawlerEvent(
                                            event_type=EventType.TASK_ENQUEUED,
                                            task=next_task,
                                            message=f"发现新链接入队 (depth={next_task.depth}): {c_url}"
                                        ))

                    # 8. 自动下载当前页面的真实资源（图片/音视频），带 Referer 防盗链
                    if self.auto_save_resources and page_resources:
                        asyncio.create_task(self._download_page_resources(page_resources[:15], crawl_res.url))

                    # 标记当前任务成功完成
                    await self.queue.complete(task)

                    # 标记当前任务成功完成
                    await self.queue.complete(task)

            except Exception as e:
                # 标记失败，若满足重试策略自动重新入队
                await self.queue.fail(task, str(e))
                await self.event_bus.emit(CrawlerEvent(
                    event_type=EventType.REQUEST_FAILED,
                    task=task,
                    message=str(e)
                ))

    async def _download_page_resources(self, resources: List[Dict[str, Any]], page_url: str) -> None:
        """异步下载页面发现的静态多媒体资源并持久化归档（附带 Referer 防盗链）"""
        if not self._session or not resources:
            return
        headers = {
            **self.default_headers,
            "Referer": page_url,
        }
        for item in resources:
            res_url = item.get("url")
            cat_name = item.get("category", "images")
            try:
                cat_enum = ResourceCategory(cat_name)
            except Exception:
                cat_enum = ResourceCategory.IMAGE

            try:
                timeout = aiohttp.ClientTimeout(total=15)
                async with self._session.get(res_url, headers=headers, timeout=timeout) as resp:
                    if resp.status == 200:
                        content = await resp.read()
                        saved_path, fsize = await self.saver.save_resource(
                            url=res_url,
                            category=cat_enum,
                            content=content,
                            content_type=resp.headers.get("Content-Type", "")
                        )
                        await self.event_bus.emit(CrawlerEvent(
                            event_type=EventType.RESOURCE_SAVED,
                            data={
                                "saved_path": saved_path,
                                "category": cat_name,
                                "size": fsize,
                                "url": res_url,
                            },
                            message=f"↳ [SAVED] 自动归档资源: {saved_path} ({fsize} 字节)"
                        ))
            except Exception:
                pass

    def _is_domain_allowed(self, url: str) -> bool:
        if not self.allowed_domains:
            return True
        from urllib.parse import urlparse
        hostname = urlparse(url).hostname
        if not hostname:
            return False
        return any(d in hostname for d in self.allowed_domains)

    def stop(self) -> None:
        """手动请求停止爬虫"""
        self._is_running = False
