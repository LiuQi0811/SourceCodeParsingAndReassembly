"""
核心爬虫引擎
门面模式：整合各模块，提供统一入口
协调下载器、解析器、队列、进度条、代理池等协同工作
"""
import asyncio
from typing import Optional, List, Callable
from pathlib import Path

from core.config import CrawlerConfig, get_config, set_config, FetchMode, ParseMode, ResourceType
from core.models import UrlItem, TaskStatus, DownloadResult, ParseResult
from core.queue_manager import QueueManager
from downloaders.downloader import AsyncDownloader
from parsers.base_parser import ParserFactory, BaseParser
from proxies.proxy_pool import ProxyPool, ProxyRotationStrategy
from utils.progress import ProgressManager
from utils.url_utils import get_resource_type, filter_h265_resources
from utils.logger import get_logger

logger = get_logger("Crawler")


class Crawler:
    """通用全站爬虫主类"""

    def __init__(self, config: Optional[CrawlerConfig] = None):
        if config is not None:
            set_config(config)
        self.config = get_config()

        # 初始化各组件
        self.queue = QueueManager()
        self.downloader = AsyncDownloader()
        self.proxy_pool = ProxyPool.get_instance()
        self.progress: Optional[ProgressManager] = None
        self.parser: Optional[BaseParser] = None
        self._running = False
        self._workers: List[asyncio.Task] = []
        self._parse_callback: Optional[Callable] = None
        self._download_callback: Optional[Callable] = None

    # ---------- 配置链式调用方法 ----------
    def set_fetch_mode(self, mode: FetchMode) -> "Crawler":
        self.config.fetch_mode = mode
        return self

    def set_parse_mode(self, mode: ParseMode) -> "Crawler":
        self.config.parse_mode = mode
        self.parser = ParserFactory.create_parser(mode)
        return self

    def set_concurrency(self, max_concurrent: int) -> "Crawler":
        self.config.max_concurrent = max_concurrent
        return self

    def set_output_dir(self, path: str) -> "Crawler":
        self.config.output_dir = Path(path)
        self.config.output_dir.mkdir(parents=True, exist_ok=True)
        return self

    def set_depth_limit(self, max_depth: int) -> "Crawler":
        self.config.max_depth = max_depth
        return self

    def set_page_limit(self, max_pages: int) -> "Crawler":
        self.config.max_pages = max_pages
        return self

    def set_delay(self, delay: float) -> "Crawler":
        self.config.request_delay = delay
        return self

    def set_proxies(self, proxies: List[str], strategy: ProxyRotationStrategy = ProxyRotationStrategy.ROUND_ROBIN) -> "Crawler":
        self.config.enable_proxy = True
        self.proxy_pool.add_proxies(proxies)
        self.proxy_pool.set_strategy(strategy)
        return self

    def load_proxies_from_file(self, file_path: str) -> "Crawler":
        self.config.enable_proxy = True
        self.proxy_pool.load_from_file(file_path)
        return self

    def add_excluded_pattern(self, pattern: str) -> "Crawler":
        self.config.excluded_patterns.append(pattern)
        return self

    def enable_resume(self, enable: bool = True) -> "Crawler":
        self.config.enable_resume = enable
        return self

    def enable_resource_download(self, enable: bool = True) -> "Crawler":
        self.config.download_resources = enable
        return self

    def _filter_h265(self, parse_result) -> List[str]:
        """默认跳过 H265 备用流（如 DPlayer 的 url_h265），只下普通流；
        若页面只有 H265 流则降级保留，避免什么都下不到。"""
        return filter_h265_resources(
            parse_result.resources,
            parse_result.metadata.get("h265_resources") or [],
            skip=getattr(self.config, "skip_h265_streams", True),
        )

    def stay_in_domain(self, enable: bool = True) -> "Crawler":
        self.config.stay_in_domain = enable
        return self

    def set_parse_callback(self, callback: Callable) -> "Crawler":
        """设置解析回调函数，签名: callback(parse_result: ParseResult) -> None"""
        self._parse_callback = callback
        return self

    def set_download_callback(self, callback: Callable) -> "Crawler":
        """设置下载回调函数，签名: callback(download_result: DownloadResult, item: UrlItem) -> None"""
        self._download_callback = callback
        return self

    def add_headers(self, headers: dict) -> "Crawler":
        self.config.headers.update(headers)
        return self

    def set_cookies(self, cookies: dict) -> "Crawler":
        self.config.cookies.update(cookies)
        return self

    # ---------- 核心运行逻辑 ----------
    async def _progress_callback(self, result: DownloadResult):
        """下载进度回调"""
        if self.progress:
            await self.progress.update(result)
        if self._download_callback:
            if asyncio.iscoroutinefunction(self._download_callback):
                await self._download_callback(result)
            else:
                self._download_callback(result)

    async def _process_item(self, item: UrlItem):
        """处理单个URL任务：下载 -> 解析 -> 发现新URL"""
        try:
            # 检查深度限制
            if self.config.max_depth >= 0 and item.depth > self.config.max_depth:
                await self.queue.mark_completed(item)
                return

            # 检查页数限制
            if self.config.max_pages >= 0 and self.queue.completed_count >= self.config.max_pages:
                self.queue.mark_producer_done()
                await self.queue.mark_completed(item)
                return

            # 下载
            result = await self.downloader.download(
                item,
                stream=(self.config.fetch_mode == FetchMode.STREAM_QUEUE),
                progress_callback=self._progress_callback if self.config.show_progress else None,
            )

            if not result.success:
                await self.queue.mark_failed(item, result.error)
                return

            item.status = TaskStatus.DOWNLOADED

            # HTML页面才需要解析
            is_html = item.resource_type == ResourceType.HTML or "text/html" in result.content_type
            if is_html and result.local_path and result.local_path.exists():
                item.status = TaskStatus.PARSING
                # 读取下载的文件内容
                content = result.content
                if content is None:
                    import aiofiles
                    async with aiofiles.open(result.local_path, "rb") as f:
                        content = await f.read()

                parse_result = self.parser.parse(content, item.url, result.headers)

                if parse_result.success:
                    item.status = TaskStatus.PARSED
                    # 调用解析回调
                    if self._parse_callback:
                        if asyncio.iscoroutinefunction(self._parse_callback):
                            await self._parse_callback(parse_result)
                        else:
                            self._parse_callback(parse_result)

                    # 将解析出的新URL加入队列
                    new_depth = item.depth + 1
                    # 页面链接
                    await self.queue.add_urls(parse_result.links, depth=new_depth, referer=item.url)
                    # 静态资源
                    if self.config.download_resources:
                        res_count = await self.queue.add_urls(
                            self._filter_h265(parse_result), depth=new_depth,
                            referer=item.url, is_resource=True)
                        logger.debug(f"发现 {len(parse_result.links)} 个链接, {res_count} 个资源")

                    # 更新进度条总数
                    if self.progress and self.config.fetch_mode == FetchMode.STREAM_QUEUE:
                        self.progress.update_total(self.queue.seen_count)
                else:
                    logger.debug(f"解析失败 [{item.url}]: {parse_result.error}")

            await self.queue.mark_completed(item)

            # 定期保存断点
            if self.config.enable_resume and self.queue.completed_count % 20 == 0:
                await self.queue.save_state()

        except Exception as e:
            logger.error(f"处理任务异常 [{item.url}]: {e}", exc_info=True)
            await self.queue.mark_failed(item, str(e))

    async def _worker(self, worker_id: int):
        """工作协程"""
        logger.debug(f"Worker {worker_id} 启动")
        while self._running:
            item = await self.queue.get_next()
            if item is None:
                break
            await self._process_item(item)
        logger.debug(f"Worker {worker_id} 退出")

    async def start(self, start_url: str):
        """启动爬虫"""
        self._running = True
        logger.info(f"启动爬虫，起始URL: {start_url}")
        logger.info(f"抓取模式: {self.config.fetch_mode.value}, 解析模式: {self.config.parse_mode.value}")
        logger.info(f"并发数: {self.config.max_concurrent}, 输出目录: {self.config.output_dir.absolute()}")

        # 初始化解析器
        self.parser = ParserFactory.create_parser(self.config.parse_mode)

        # 初始化队列和下载器
        await self.queue.init()
        await self.downloader.init_session()

        # 添加起始URL
        await self.queue.add_url(start_url, depth=0)

        # 代理健康检测
        if self.config.enable_proxy:
            await self.proxy_pool.health_check()
            if self.proxy_pool.valid_count() == 0:
                logger.warning("没有可用代理，将不使用代理")
                self.config.enable_proxy = False

        # 内存队列模式：先收集全站URL（简单的广度优先预抓取）
        if self.config.fetch_mode == FetchMode.MEMORY_QUEUE:
            logger.info("内存队列模式：开始预收集页面URL...")
            await self._pre_collect_urls(start_url)
            logger.info(f"预收集完成，共发现 {self.queue.seen_count} 个URL")

        # 初始化进度条
        total = self.queue.seen_count if self.config.fetch_mode == FetchMode.MEMORY_QUEUE else 0
        self.progress = ProgressManager(total=total, desc="全站抓取")
        if self.config.show_progress:
            self.progress.start(total=total if total > 0 else None)

        # 流式模式：worker 自身即生产者（解析后回流新URL），
        # 队列在“队列空且无在途任务”时会让 get_next 返回 None，worker 自然退出，无需显式标记。
        self._workers = []
        for i in range(self.config.max_concurrent):
            task = asyncio.create_task(self._worker(i))
            self._workers.append(task)

        # 等待队列完成
        try:
            await self.queue.wait_finished()
        except KeyboardInterrupt:
            logger.info("收到中断信号，正在停止...")

        # 停止
        await self.stop()

    async def _pre_collect_urls(self, start_url: str):
        """内存队列模式预收集：快速抓取HTML页面提取链接，不下载资源"""
        temp_queue = asyncio.Queue()
        seen = set()
        await temp_queue.put((start_url, 0))
        seen.add(start_url)
        pages_limit = self.config.max_pages if self.config.max_pages > 0 else 10000

        sem = asyncio.Semaphore(self.config.max_concurrent)
        pre_parser = ParserFactory.create_parser(self.config.parse_mode)

        async def collect_worker():
            while not temp_queue.empty() and len(seen) < pages_limit:
                try:
                    url, depth = temp_queue.get_nowait()
                except asyncio.QueueEmpty:
                    break

                if self.config.max_depth >= 0 and depth > self.config.max_depth:
                    continue

                async with sem:
                    content = await self.downloader.download_content_only(url)
                    if content:
                        result = pre_parser.parse(content, url)
                        if result.success:
                            # 添加页面链接到预收集队列
                            for link in result.links:
                                if link not in seen:
                                    seen.add(link)
                                    await temp_queue.put((link, depth + 1))
                            # 添加所有链接到正式下载队列
                            await self.queue.add_url(url, depth=depth)
                            await self.queue.add_urls(result.links, depth=depth + 1, referer=url)
                            if self.config.download_resources:
                                await self.queue.add_urls(self._filter_h265(result), depth=depth + 1,
                                                          referer=url, is_resource=True)

        # 启动多个收集worker
        collectors = [asyncio.create_task(collect_worker()) for _ in range(min(5, self.config.max_concurrent))]
        await asyncio.gather(*collectors, return_exceptions=True)

    async def stop(self):
        """停止爬虫"""
        self._running = False
        # 保存断点
        if self.config.enable_resume:
            await self.queue.save_state()
        # 等待worker结束
        for worker in self._workers:
            worker.cancel()
            try:
                await worker
            except asyncio.CancelledError:
                pass
        # 关闭会话
        await self.downloader.close_session()
        # 关闭进度条
        if self.progress and self.config.show_progress:
            self.progress.close()
        logger.info("爬虫已停止")

    async def __aenter__(self):
        return self

    async def __aexit__(self, exc_type, exc_val, exc_tb):
        await self.stop()
