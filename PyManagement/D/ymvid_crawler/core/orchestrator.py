"""爬虫调度器"""
import asyncio
from pathlib import Path
from urllib.parse import urlparse, unquote
import hashlib
import re

from core.events import EventType, CrawlEvent
from core.event_bus import EventBus
from core.observers import ConsoleObserver, StatsObserver

from frontier.memory_queue import MemoryFrontier
from frontier.sqlite_queue import SQLiteFrontier

from fetcher.http_fetcher import HttpFetcher

from parsers.factory import ParserFactory

from downloader.file_downloader import FileDownloader
from downloader.hls_downloader import HlsDownloader
from downloader.dash_downloader import DashDownloader
from downloader.stream_downloader import StreamDownloader
from downloader.resource_classifier import ResourceClassifier

# 视频类资源类型（--video-only 时仅下载这些）
VIDEO_RESOURCE_TYPES = {"video", "hls", "dash", "flv", "rtmp", "rtsp", "webrtc"}


class Crawler:
    """
    爬虫调度器
      - 观察者模式：EventBus 解耦事件通知
      - 策略模式：frontier 可切换 内存 / SQLite
      - 工厂模式：ParserFactory 创建解析器
    """

    def __init__(self, config: dict):
        self.config = config
        self.event_bus = EventBus()

        # 观察者
        ConsoleObserver(self.event_bus)
        self.stats = StatsObserver(self.event_bus)

        # 队列策略
        if config.get("queue_mode") == "sqlite":
            self.frontier = SQLiteFrontier(config.get("db_path", "crawl_queue.db"))
        else:
            self.frontier = MemoryFrontier()

        # 请求器
        self.fetcher = HttpFetcher(
            concurrency=config.get("concurrency", 20),
            timeout=config.get("timeout", 30),
            retries=config.get("retries", 3),
            headers=config.get("extra_headers"),
        )

        # 解析器（工厂模式）
        parser_names = config.get("parsers", ["bs4", "xpath"])
        self.parser = ParserFactory.create_combined(parser_names)

        # 下载器
        self.file_dl = FileDownloader(self.fetcher)
        self.hls_dl = HlsDownloader(self.fetcher)
        self.dash_dl = DashDownloader(self.fetcher)
        self.stream_dl = StreamDownloader()

        self.download_dir = Path(config.get("download_dir", "./downloads"))
        self.extra_headers = config.get("extra_headers", {})
        self.max_depth = config.get("max_depth", 3)
        self.video_only = config.get("video_only", False)
        self.link_include = [re.compile(p) for p in config.get("link_include", [])]
        self.link_exclude = [re.compile(p) for p in config.get("link_exclude", [])]
        self._running = True

    async def run(self, start_urls: list[str]):
        await self.fetcher.start()

        if isinstance(self.frontier, SQLiteFrontier):
            await self.frontier.reset_processing()

        for url in start_urls:
            await self.frontier.put(url, depth=0)

        workers = [
            asyncio.create_task(self._worker(i))
            for i in range(self.config.get("workers", 5))
        ]

        await asyncio.gather(*workers, return_exceptions=True)

        await self.fetcher.close()
        await self.frontier.close()

        await self.event_bus.publish(CrawlEvent(
            event_type=EventType.CRAWL_FINISHED,
            data={"stats": self.stats.stats}
        ))

    async def _worker(self, worker_id: int):
        """工作协程：连续 5 次空转 + 队列为空才退出，避免竞态提前退出"""
        empty_rounds = 0
        EMPTY_THRESHOLD = 5

        while self._running:
            item = await self.frontier.get()
            if item is None:
                empty_rounds += 1
                if empty_rounds >= EMPTY_THRESHOLD:
                    if await self.frontier.size() == 0:
                        break
                    empty_rounds = 0
                await asyncio.sleep(0.5)
                continue

            empty_rounds = 0
            url, depth = item
            await self._process_url(url, depth)

    async def _process_url(self, url: str, depth: int):
        try:
            status, text, content_type = await self.fetcher.fetch_text(url)
            await self.event_bus.publish(CrawlEvent(
                event_type=EventType.PAGE_FETCHED,
                data={"url": url, "status": status}
            ))

            if status != 200:
                await self.frontier.mark_error(url, f"HTTP {status}")
                return

            if "text/html" in content_type or "<html" in text[:500].lower():
                await self._handle_html_page(url, text, depth)
            else:
                await self._handle_resource(url, content_type, referer=url)

            await self.frontier.mark_done(url)

        except Exception as e:
            await self.frontier.mark_error(url, str(e))
            await self.event_bus.publish(CrawlEvent(
                event_type=EventType.ERROR_OCCURRED,
                data={"url": url, "error": str(e)}
            ))

    async def _handle_html_page(self, url: str, text: str, depth: int):
        title = self.parser.parse_title(text) or "untitled"

        # 提取链接（继续爬取）
        links: list[dict] = []
        if depth < self.max_depth:
            links = self.parser.parse_links(text, url)
            for link in links:
                if not self._link_allowed(link["url"]):
                    continue
                await self.frontier.put(link["url"], depth + 1, parent=url)
                await self.frontier.put(link["url"], depth + 1, parent=url)

        # 提取资源（下载）
        resources = self.parser.parse_resources(text, url)
        for res in resources:
            await self.event_bus.publish(CrawlEvent(
                event_type=EventType.RESOURCE_FOUND,
                data={"url": res["url"], "resource_type": res["type"]}
            ))
            await self._download_resource(res["url"], title, referer=url)

        await self.event_bus.publish(CrawlEvent(
            event_type=EventType.PAGE_PARSED,
            data={"url": url, "title": title,
                  "links": len(links), "resources": len(resources)}
        ))

    async def _handle_resource(self, url: str, content_type: str,
                                referer: str = ""):
        title = unquote(urlparse(url).path.split("/")[-1]) or "resource"
        await self._download_resource(url, title, referer=referer)

    async def _download_resource(self, url: str, title: str,
                                  referer: str = ""):
        res_type = ResourceClassifier.classify_by_url(url)
        if self.video_only and res_type not in VIDEO_RESOURCE_TYPES:
            await self.event_bus.publish(CrawlEvent(
                event_type=EventType.RESOURCE_SKIPPED,
                data={"url": url, "resource_type": res_type}
            ))
            return
        save_dir = ResourceClassifier.get_save_dir(
            str(self.download_dir), title, url
        )
        save_dir.mkdir(parents=True, exist_ok=True)

        await self.event_bus.publish(CrawlEvent(
            event_type=EventType.DOWNLOAD_STARTED,
            data={"url": url, "type": res_type}
        ))

        success = False
        try:
            if res_type == "hls":
                filename = self._make_filename(url, ".mp4")
                success = await self.hls_dl.download(
                    url, save_dir / filename, referer=referer,
                    headers=self.extra_headers
                )
            elif res_type == "dash":
                filename = self._make_filename(url, ".mp4")
                success = await self.dash_dl.download(
                    url, save_dir / filename, referer=referer,
                    headers=self.extra_headers
                )
            elif res_type in ("rtmp", "rtsp", "flv", "webrtc"):
                filename = self._make_filename(url, ".mp4")
                success = await self.stream_dl.download(
                    url, save_dir / filename, protocol=res_type
                )
            else:
                ext = ResourceClassifier.get_ext(url) or ".bin"
                filename = self._make_filename(url, ext)
                success = await self.file_dl.download(
                    url, save_dir / filename, referer=referer,
                    headers=self.extra_headers
                )
        except Exception as e:
            await self.event_bus.publish(CrawlEvent(
                event_type=EventType.ERROR_OCCURRED,
                data={"url": url, "error": f"download failed: {e}"}
            ))
            return

        if success:
            await self.event_bus.publish(CrawlEvent(
                event_type=EventType.DOWNLOAD_COMPLETED,
                data={"url": url, "path": str(save_dir), "type": res_type}
            ))

    def _link_allowed(self, url: str) -> bool:
        """链接过滤：--link-include 任一命中且 --link-exclude 均未命中才放行"""
        if self.link_include and not any(p.search(url) for p in self.link_include):
            return False
        if any(p.search(url) for p in self.link_exclude):
            return False
        return True

    @staticmethod
    def _make_filename(url: str, ext: str) -> str:
        path = urlparse(url).path
        name = unquote(path.split("/")[-1].split("?")[0])
        if not name or "." not in name:
            name = hashlib.md5(url.encode()).hexdigest()[:12]
        base = name.rsplit(".", 1)[0] if "." in name else name
        base = ResourceClassifier.sanitize_filename(base)
        return f"{base}{ext}"