# -*- coding: utf-8 -*-
"""
爬虫引擎：asyncio 异步调度核心
  - 队列策略选择（内存/SQLite 断点续爬）
  - 页面流水线：fetch(加密插件) -> 解码 -> 解析(策略) -> 链接/资源入库 -> 保存
  - 资源流水线：协议识别 -> 下载器/合并器
  - 观察者：全部关键节点发布事件
"""
from __future__ import annotations

import asyncio
import json
import logging
import time
from typing import Any, Dict, List, Optional

import aiohttp

from .constants import EventType, ResourceType, VideoProtocol
from .crypto.plugins import CryptoPlugin
from .download.http_downloader import HttpDownloader
from .download.video_downloader import VideoResourceDownloader
from .events import EventBus, LoggingObserver, StatsObserver
from .factory import ParserFactory, build_crypto, queue_factory
from .net.fetcher import AsyncFetcher
from .parser.base import ParserStrategy
from .queue.base import QueueItem, QueueStrategy
from .resource.classifier import ResourceClassifier, looks_like_resource
from .resource.storage import ResourceStorage
from .tasks import Settings, TaskSpec
from .utils import domain_of, human_size, is_http_url, normalize_url
from .video.base import VideoDownloader

logger = logging.getLogger("crawler.engine")


class CrawlEngine:
    """异步爬虫引擎"""

    def __init__(self, settings: Optional[Settings] = None, event_bus: Optional[EventBus] = None) -> None:
        self.settings = settings or Settings()
        self.event_bus = event_bus or EventBus()
        self.queue: Optional[QueueStrategy] = None
        self.fetcher: Optional[AsyncFetcher] = None
        self.storage: Optional[ResourceStorage] = None

        self.tasks: Dict[str, TaskSpec] = {}
        self._parsers: Dict[str, ParserStrategy] = {}
        self._cryptos: Dict[str, CryptoPlugin] = {}
        self._classifiers: Dict[str, ResourceClassifier] = {}
        self._titles: Dict[str, str] = {}

        self._page_counts: Dict[str, int] = {}
        self._enqueued_pages: Dict[str, int] = {}
        self._active = 0
        self._stop = False
        self._domain_last: Dict[str, float] = {}
        self._lock = asyncio.Lock()
        self._ffmpeg_sem = asyncio.Semaphore(1)
        self._seeds: List[QueueItem] = []
        self._done_urls: set = set()       # 会话级已成功资源 URL（跨任务重复引用时跳过下载）
        self._inflight_urls: set = set()   # 会话级正在下载的 URL（并发下防重复）
        self._stats = StatsObserver()
        self.event_bus.subscribe_all(self._stats)
        # 注意：不自动订阅 LoggingObserver —— 由调用方（main.py / 测试）显式订阅，避免重复日志

    def _collect_observers(self) -> list:
        out = []
        for bucket in getattr(self.event_bus, "_observers", {}).values():
            out.extend(bucket)
        return out

    # ---------------------------------------------------------------- 启动
    async def start(self, tasks: List[TaskSpec]) -> StatsObserver:
        self._prepare(tasks)
        await self.queue.initialize(self._seeds, resume=self.settings.resume)
        self.event_bus.emit(EventType.CRAWL_START, message=f"启动爬虫，任务数={len(tasks)}")
        progress_task = None
        if self.settings.progress:
            progress_task = asyncio.create_task(self._progress_loop())
        try:
            workers = [asyncio.create_task(self._worker(i)) for i in range(self.settings.concurrency)]
            await asyncio.gather(*workers)
        finally:
            if progress_task:
                progress_task.cancel()
        self.event_bus.emit(
            EventType.CRAWL_DONE,
            message=f"爬取完成: {self._stats.summary()}",
            data=self._stats.summary(),
        )
        await self._shutdown()
        return self._stats

    async def _progress_loop(self) -> None:
        """实时进度：每 10s 打印一行当前统计（--progress）"""
        import time as _time

        t0 = _time.monotonic()
        while True:
            await asyncio.sleep(10)
            s = self._stats.summary()
            print(
                f"[进度] {_time.monotonic() - t0:.0f}s | "
                f"页面 {s['pages_fetched']} 成功 / {s['pages_failed']} 失败 | "
                f"资源 {s['resources_downloaded']} 成功 / {s['resources_failed']} 失败 | "
                f"下载 {s['bytes_downloaded']} 字节 | 失败原因 {dict(s['failure_reasons'])}"
            )

    def _prepare(self, tasks: List[TaskSpec]) -> None:
        s = self.settings
        self.tasks = {t.task_id: t for t in tasks}
        for t in tasks:
            self._page_counts[t.task_id] = 0
            self._enqueued_pages[t.task_id] = 0
            self._titles[t.task_id] = ""
            self._parsers[t.task_id] = ParserFactory.create(t.parser)
            self._cryptos[t.task_id] = build_crypto(t.crypto_plugin)
            self._classifiers[t.task_id] = ResourceClassifier(t.custom_resource_types)

        # 全局 URL 去重（跨任务）
        self.storage = ResourceStorage(s.output_dir)
        self.fetcher = AsyncFetcher(
            timeout=s.timeout, max_retries=s.max_retries, verify_ssl=s.verify_ssl, qps=s.qps,
        )
        self.queue = queue_factory.create(
            s.queue_type,
            db_path=s.sqlite_path,
            max_retries=s.max_retries,
        ) if s.queue_type == "sqlite" else queue_factory.create(s.queue_type)

        seeds: List[QueueItem] = []
        for t in tasks:
            for u in t.seed_urls:
                nu = normalize_url(u)
                if nu:
                    seeds.append(QueueItem(url=nu, task_id=t.task_id, depth=0))
        self._seeds = seeds

    async def _shutdown(self) -> None:
        if self.queue:
            await self.queue.close()
        if self.fetcher:
            await self.fetcher.close()

    # ---------------------------------------------------------------- 工作线程
    async def _worker(self, wid: int) -> None:
        while not self._stop:
            item = await self.queue.get()
            if item is None:
                if self._active == 0:
                    return
                await asyncio.sleep(0.05)
                continue
            self._active += 1
            try:
                await self._process(item)
            except Exception as exc:
                final = await self._safe_mark_failed(item, str(exc))
                if final:
                    if item.is_resource:
                        self.event_bus.emit(
                            EventType.RESOURCE_FAILED, task_id=item.task_id, url=item.url,
                            message=f"处理异常: {exc}（最终失败）",
                        )
                    else:
                        self.event_bus.emit(
                            EventType.PAGE_FAILED, task_id=item.task_id, url=item.url,
                            message=f"处理异常: {exc}（最终失败）",
                        )
                self.event_bus.emit(
                    EventType.ERROR, task_id=item.task_id, url=item.url,
                    message=f"处理异常: {exc}",
                )
            finally:
                self._active -= 1

    async def _safe_mark_failed(self, item: QueueItem, error: str, retriable: bool = True) -> bool:
        """标记失败；返回 True=进入最终失败态（重试耗尽/不可重试）"""
        try:
            return await self.queue.mark_failed(item, error, retriable=retriable)
        except Exception:
            logger.exception("标记失败失败 %s", item.url)
            return True

    # ---------------------------------------------------------------- 处理分发
    async def _process(self, item: QueueItem) -> None:
        task = self.tasks.get(item.task_id)
        if task is None:
            await self.queue.mark_done(item)
            return
        if item.is_resource:
            if task.download_resources and self.settings.download_resources:
                await self._process_resource(item, task)   # 内部负责 mark_done / mark_failed
            else:
                await self.queue.mark_done(item)
        else:
            await self._process_page(item, task)

    # ---------------------------------------------------------------- 页面
    async def _acquire_page_slot(self, task_id: str, max_pages: int) -> bool:
        """原子占用一个页面抓取配额；达到 max_pages 返回 False"""
        if not max_pages:
            return True
        async with self._lock:
            if self._page_counts.get(task_id, 0) >= max_pages:
                return False
            self._page_counts[task_id] = self._page_counts.get(task_id, 0) + 1
            return True

    async def _process_page(self, item: QueueItem, task: TaskSpec) -> None:
        # max_pages 硬上限：达到后跳过该页（SQLite 中保持 processing，resume 后可续爬）
        if not await self._acquire_page_slot(task.task_id, task.max_pages):
            self.event_bus.emit(
                EventType.ERROR, task_id=task.task_id, url=item.url,
                message=f"已达到 max_pages={task.max_pages}，本页留待下次 resume",
            )
            return
        domain = domain_of(item.url)
        await self._respect_delay(domain, task.delay)
        crypto = self._cryptos.get(task.task_id)
        url = crypto.transform_url(item.url, task) if crypto else item.url
        headers = {**(task.headers or {})}
        if crypto:
            headers.update(crypto.build_headers(task))

        self.event_bus.emit(EventType.FETCH_START, task_id=task.task_id, url=item.url)
        try:
            result = await self.fetcher.fetch(
                url, headers=headers, referer=item.referer or task.referer,
                verify_ssl=task.verify_ssl, auth=task.auth, cookies=task.cookies,
                encoding=None, binary=False,
                timeout=task.timeout or None,
            )
        except Exception as exc:
            self.event_bus.emit(
                EventType.FETCH_ERROR, task_id=task.task_id, url=item.url, message=str(exc)[:200],
            )
            final = await self._safe_mark_failed(item, str(exc))
            if final:
                self.event_bus.emit(
                    EventType.PAGE_FAILED, task_id=task.task_id, url=item.url,
                    message=f"{str(exc)[:200]}（重试耗尽）",
                )
            return

        raw = result.raw
        if crypto:
            try:
                raw = crypto.decrypt(raw, task)
                if result.text is None:
                    pass
            except Exception:
                pass

        self.event_bus.emit(
            EventType.FETCH_OK, task_id=task.task_id, url=item.url,
            message=f"status={result.status} charset={result.charset}({result.encoding_source}) "
                    f"bytes={len(raw)}",
            data={"bytes": len(raw), "status": result.status},
        )

        # JSON / HTML / 二进制 分流
        if result.is_json:
            await self._handle_json(item, task, result, raw)
        elif result.is_html or (raw and raw[:1] in (b"<", b"\t", b"\n", b"\r")):
            text = result.as_text()
            if not text:
                from .net.encoding import decode_bytes

                text, _, _ = decode_bytes(raw, result.headers, forced=None)
            await self._handle_html(item, task, result, text)
        else:
            await self._handle_binary_page(item, task, result, raw)

        await self.queue.mark_done(item)

    async def _handle_html(self, item: QueueItem, task: TaskSpec, result, text: str) -> None:
        parser = self._parsers[task.task_id]
        data = parser.parse(text, result.final_url or item.url, task.extract)

        # 标题 -> 目录命名
        if task.title_from_page and data.title and not self._titles.get(task.task_id):
            self._titles[task.task_id] = data.title
            task.name = data.title

        self.event_bus.emit(
            EventType.PARSE_DONE, task_id=task.task_id, url=item.url,
            message=f"links={len(data.links)} resources={len(data.resources)} title={data.title!r}",
        )

        await self._enqueue_links(item, task, data.links, parser)
        await self._enqueue_resources(item, task, data.resources)

        if task.save_page:
            self.storage.save_page(task.task_id, item.url, text, self._titles[task.task_id])
        if task.save_structured and data.fields:
            self.storage.save_structured(
                task.task_id, item.url,
                {"url": item.url, "title": data.title, "fetched_at": time.strftime("%Y-%m-%d %H:%M:%S"),
                 **data.fields},
                self._titles[task.task_id],
            )

    async def _handle_json(self, item: QueueItem, task: TaskSpec, result, raw: bytes) -> None:
        from .net.encoding import decode_bytes

        text, charset, _ = decode_bytes(raw, result.headers, forced=None)
        parser = self._parsers[task.task_id]
        data = parser.parse(text, result.final_url or item.url, task.extract)

        if task.title_from_page and data.title and not self._titles.get(task.task_id):
            self._titles[task.task_id] = data.title
            task.name = data.title

        await self._enqueue_links(item, task, data.links, parser)
        await self._enqueue_resources(item, task, data.resources)

        if task.save_structured:
            try:
                obj = json.loads(text)
            except Exception:
                obj = {"raw": text[:100000]}
            self.storage.save_structured(
                task.task_id, item.url,
                {"url": item.url, "fetched_at": time.strftime("%Y-%m-%d %H:%M:%S"), **obj}
                if isinstance(obj, dict) else {"url": item.url, "data": obj},
                self._titles[task.task_id],
            )

    async def _handle_binary_page(self, item: QueueItem, task: TaskSpec, result, raw: bytes) -> None:
        """种子 URL 直接指向二进制资源（图片/字体/文档等）"""
        classifier = self._classifiers[task.task_id]
        rtype = classifier.classify(url=item.url, content_type=result.content_type, raw=raw)
        path = self.storage.save_bytes(
            task.task_id, rtype, raw, url=item.url, title=self._titles[task.task_id],
            content_type=result.content_type,
        )
        self.event_bus.emit(
            EventType.RESOURCE_DOWNLOAD_OK, task_id=task.task_id, url=item.url,
            message=f"二进制页面资源已保存: {path.name} type={rtype}", data={"bytes": len(raw)},
        )

    # ---------------------------------------------------------------- 链接/资源入队
    async def _enqueue_links(self, item: QueueItem, task: TaskSpec, links: List[str], parser) -> None:
        whitelist = task.domain_whitelist()
        max_pages = task.max_pages
        for raw_link in links:
            nu = normalize_url(raw_link)
            if not nu or len(nu) > 2048:
                continue
            if looks_like_resource(nu):
                continue  # 资源走资源流水线，不当作页面跟踪
            if item.depth + 1 > task.depth:
                continue
            if whitelist and domain_of(nu) not in whitelist:
                continue
            # 入队配额（原子检查+占用，防止并发超限）
            async with self._lock:
                if max_pages and self._enqueued_pages.get(task.task_id, 0) >= max_pages:
                    return
                self._enqueued_pages[task.task_id] = self._enqueued_pages.get(task.task_id, 0) + 1
            ok = await self.queue.put(
                QueueItem(url=nu, task_id=task.task_id, depth=item.depth + 1, referer=item.url)
            )
            if not ok:
                # 重复未入队：归还配额
                self._enqueued_pages[task.task_id] = max(0, self._enqueued_pages.get(task.task_id, 0) - 1)
                continue
            self.event_bus.emit(
                EventType.URL_DISCOVERED, task_id=task.task_id, url=nu, message=f"depth={item.depth + 1}"
            )

    async def _enqueue_resources(self, item: QueueItem, task: TaskSpec, resources) -> None:
        if not (task.download_resources and self.settings.download_resources):
            return
        allowed = task.resource_domains
        for ref in resources:
            nu = normalize_url(ref.url)
            if not nu:
                continue
            if allowed and domain_of(nu) not in [d.lower().lstrip("*.") for d in allowed]:
                continue
            ok = await self.queue.put(
                QueueItem(
                    url=nu, task_id=task.task_id, depth=item.depth + 1,
                    is_resource=True, resource_type=ref.kind, referer=item.url,
                    priority=10,
                )
            )
            if ok:
                self.event_bus.emit(
                    EventType.RESOURCE_FOUND, task_id=task.task_id, url=nu, message=f"kind={ref.kind}"
                )

    # ---------------------------------------------------------------- 资源下载
    async def _process_resource(self, item: QueueItem, task: TaskSpec) -> None:
        # 会话级去重（跨任务同 URL）：已成功或正在下载 → 跳过，不再发网络请求
        async with self._lock:
            if item.url in self._done_urls or item.url in self._inflight_urls:
                skip = True
            else:
                self._inflight_urls.add(item.url)
                skip = False
        if skip:
            await self.queue.mark_done(item)
            self.event_bus.emit(
                EventType.RESOURCE_DOWNLOAD_OK, task_id=task.task_id, url=item.url,
                message="同会话已下载/下载中，跳过重复请求",
            )
            return
        protocol = VideoDownloader.detect_protocol(item.url)
        if protocol is not None:
            downloader = VideoResourceDownloader(
                self.fetcher, self.storage, task_ctx=self.tasks, event_bus=self.event_bus,
                ffmpeg_sem=self._ffmpeg_sem,
            )
        else:
            downloader = HttpDownloader(
                self.fetcher, self.storage, task_ctx=self.tasks,
            )
        self.event_bus.emit(
            EventType.RESOURCE_DOWNLOAD_START, task_id=task.task_id, url=item.url,
            message=f"downloader={downloader.name}",
        )
        result = await downloader.download(item)
        if result.ok:
            self._done_urls.add(item.url)
            self._inflight_urls.discard(item.url)
            await self.queue.mark_done(item)
            self.event_bus.emit(
                EventType.RESOURCE_DOWNLOAD_OK, task_id=task.task_id, url=item.url,
                message=f"已保存: {result.path} ({human_size(result.bytes)})",
                data={"bytes": result.bytes, "path": str(result.path), "type": result.resource_type},
            )
        else:
            self._inflight_urls.discard(item.url)  # 失败移出，允许会话内再次尝试
            self.event_bus.emit(
                EventType.RESOURCE_DOWNLOAD_ERROR, task_id=task.task_id, url=item.url,
                message=result.note,
            )
            final = await self._safe_mark_failed(item, result.note, retriable=result.retriable)
            if final:
                self.event_bus.emit(
                    EventType.RESOURCE_FAILED, task_id=task.task_id, url=item.url,
                    message=f"{result.note}（最终失败）",
                )

    # ---------------------------------------------------------------- 限速
    async def _respect_delay(self, domain: str, delay: float) -> None:
        if delay <= 0:
            return
        now = time.monotonic()
        wait = 0.0
        async with self._lock:
            last = self._domain_last.get(domain, 0.0)
            wait = delay - (now - last)
            self._domain_last[domain] = now + max(0.0, wait)
        if wait > 0:
            await asyncio.sleep(wait)
