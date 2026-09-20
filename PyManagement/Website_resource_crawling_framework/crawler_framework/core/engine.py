"""
异步抓取核心调度引擎 (CrawlerEngine)
基于 Python asyncio + aiohttp
深度整合策略模式（队列、解析器、解密器）、工厂模式与观察者模式
"""
import asyncio
import os
import random
import time
from typing import Any, Awaitable, Callable, Dict, List, Optional, Union
from urllib.parse import urlparse
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
from crawler_framework.adapters import get_adapter
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
        request_delay: float = 1.0,
        jitter: float = 0.5,
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
        on_m3u8_found: Optional[Callable[[str, str], Awaitable[None]]] = None,
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
        # 域名级限速（防封禁）：同域名最小请求间隔 + 随机抖动，不同域名互不阻塞
        self.request_delay = max(0.0, request_delay)
        self.jitter = max(0.0, jitter)
        self._domain_last_request: Dict[str, float] = {}
        self._domain_lock = asyncio.Lock()
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
        self._download_tasks: Set[asyncio.Task] = set()
        # m3u8 自动下载钩子：发现 .m3u8 时回调 (url, referer)，由上层接管分片下载+合并
        self.on_m3u8_found = on_m3u8_found
        self._start_time: float = 0.0
        self._queue_initialized = False
        self._stop_reason: str = ""

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

                # 已达到最大抓取页数：停止拉取新任务，等待 worker 收尾
                if self.max_pages and self.pages_crawled >= self.max_pages:
                    self._stop_reason = (
                        f"已达到预设最大抓取页面限制 ({self.max_pages} 页)，调度器平稳收尾！"
                    )
                    self._is_running = False
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

            # 等待所有后台资源下载任务完成，避免 session 关闭后报 "Session is closed"
            if self._download_tasks:
                await asyncio.gather(*self._download_tasks, return_exceptions=True)

        self._is_running = False
        total_elapsed = time.time() - self._start_time

        # 触发停止事件（统一在此收尾触发一次，携带停止原因）
        await self.event_bus.emit(CrawlerEvent(
            event_type=EventType.ENGINE_STOPPED,
            message=self._stop_reason,
            data={"total_elapsed": total_elapsed, "stop_reason": self._stop_reason}
        ))

        # 关闭队列资源
        await self.queue.close()

        # 返回汇总指标
        summary = await self.metrics_observer.get_summary()
        return summary

    async def _respect_domain_rate(self, url: str) -> None:
        """域名级限速器：同一域名两次请求之间强制最小间隔并叠加随机抖动。

        采用时间槽预约算法：并发的同域名任务在锁内依次预约未来的请求时间槽
        （锁内仅做计算不睡眠），随后各自在锁外等待，因此不同域名互不阻塞。
        """
        if self.request_delay <= 0 and self.jitter <= 0:
            return
        try:
            domain = urlparse(url).hostname or ""
        except Exception:
            domain = ""
        if not domain:
            return

        async with self._domain_lock:
            now = time.monotonic()
            last_reserved = self._domain_last_request.get(domain)
            if last_reserved is None:
                # 该域名首次请求：立即放行，仅记录时间戳作为后续间隔基准
                self._domain_last_request[domain] = now
                wait = 0.0
            else:
                delay = self.request_delay + random.uniform(0, self.jitter)
                slot = max(last_reserved, now) + delay
                self._domain_last_request[domain] = slot
                wait = slot - now

        if wait > 0:
            await asyncio.sleep(wait)

    async def _process_task(self, task: CrawlTask) -> None:
        """处理单条任务的完整生命周期"""
        # 域名级限速：先预约请求时间槽再进入并发槽位，避免同域名任务占用并发额度时阻塞其他域名
        await self._respect_domain_rate(task.url)
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
                    # 非 2xx/3xx 状态码按失败处理（触发重试），避免 404/500 页面被当作成功解析
                    resp.raise_for_status()
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
                                await self.event_bus.emit(CrawlerEvent(
                                    event_type=EventType.REQUEST_FAILED,
                                    task=task,
                                    response=crawl_res,
                                    message=f"[Decrypt Error] 逆向解密失败: {de}",
                                    data={"decrypt_type": decrypt_type, "error": str(de)}
                                ))

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

                    # 视频站适配器：对 JS 动态渲染的站点（m3u8 不在静态 HTML 里），按 URL 匹配适配器
                    adapter = get_adapter(crawl_res.url)
                    if adapter:
                        try:
                            ad_m3u8 = await adapter.extract_m3u8(crawl_res.url, self._session)
                            if ad_m3u8:
                                page_resources.insert(0, {
                                    "url": ad_m3u8,
                                    "category": "videos",
                                    "alt": f"adapter-{adapter.name}",
                                })
                        except Exception:
                            pass

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
                            self._stop_reason = f"已达到预设最大抓取页面限制 ({self.max_pages} 页)，调度器平稳收尾！"
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
                        dl_task = asyncio.create_task(self._download_page_resources(page_resources[:15], crawl_res.url))
                        self._download_tasks.add(dl_task)
                        dl_task.add_done_callback(self._download_tasks.discard)

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

            # m3u8 直链：若注册了自动下载钩子，则交给钩子做分片下载+合并，跳过普通文本下载
            if self.on_m3u8_found and res_url and res_url.lower().split("?")[0].endswith(".m3u8"):
                try:
                    await self.on_m3u8_found(res_url, page_url)
                except Exception:
                    pass
                continue

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
                    else:
                        await self.event_bus.emit(CrawlerEvent(
                            event_type=EventType.REQUEST_FAILED,
                            data={"url": res_url, "category": cat_name, "status_code": resp.status},
                            message=f"↳ [FAILED] 资源下载失败: HTTP {resp.status} | {res_url}"
                        ))
            except Exception as e:
                await self.event_bus.emit(CrawlerEvent(
                    event_type=EventType.REQUEST_FAILED,
                    data={"url": res_url, "category": cat_name, "error": str(e)},
                    message=f"↳ [FAILED] 资源下载异常: {res_url} ({e})"
                ))

    def _is_domain_allowed(self, url: str) -> bool:
        if not self.allowed_domains:
            return True
        from urllib.parse import urlparse
        hostname = urlparse(url).hostname
        if not hostname:
            return False
        hostname = hostname.lower()
        for d in self.allowed_domains:
            d = str(d).strip().lower()
            if not d:
                continue
            # 允许传入带协议/端口的域名，归一化为 hostname
            if "://" in d:
                d = (urlparse(d).hostname or d).lower()
            # 边界匹配：完全相等或为主域名的子域，避免 evil169tp.com 命中 169tp.com
            if hostname == d or hostname.endswith("." + d):
                return True
        return False

    def stop(self) -> None:
        """手动请求停止爬虫"""
        self._is_running = False
