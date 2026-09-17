"""观察者实现：控制台 + 统计"""
from .events import CrawlEvent, EventType


class ConsoleObserver:
    def __init__(self, event_bus):
        event_bus.subscribe(EventType.PAGE_FETCHED, self.on_fetched)
        event_bus.subscribe(EventType.PAGE_PARSED, self.on_parsed)
        event_bus.subscribe(EventType.RESOURCE_FOUND, self.on_resource)
        event_bus.subscribe(EventType.DOWNLOAD_COMPLETED, self.on_downloaded)
        event_bus.subscribe(EventType.ERROR_OCCURRED, self.on_error)

    async def on_fetched(self, event: CrawlEvent):
        url = event.data.get("url", "")
        status = event.data.get("status", 0)
        print(f"[抓取] {status} {url[:80]}")

    async def on_parsed(self, event: CrawlEvent):
        url = event.data.get("url", "")
        title = event.data.get("title", "")
        links = event.data.get("links", 0)
        resources = event.data.get("resources", 0)
        print(f"[解析] {title[:40]} | links={links} res={resources} | {url[:60]}")

    async def on_resource(self, event: CrawlEvent):
        rtype = event.data.get("resource_type", "unknown")
        url = event.data.get("url", "")
        print(f"[资源] 类型={rtype} {url[:80]}")

    async def on_downloaded(self, event: CrawlEvent):
        path = event.data.get("path", "")
        print(f"[下载完成] {path}")

    async def on_error(self, event: CrawlEvent):
        url = event.data.get("url", "")
        error = event.data.get("error", "")
        print(f"[错误] {url[:60]} -> {error[:120]}")


class StatsObserver:
    def __init__(self, event_bus):
        self.stats = {
            "fetched": 0, "parsed": 0, "resources": 0,
            "downloaded": 0, "skipped": 0, "errors": 0,
        }
        event_bus.subscribe(EventType.PAGE_FETCHED, self._inc_fetched)
        event_bus.subscribe(EventType.PAGE_PARSED, self._inc_parsed)
        event_bus.subscribe(EventType.RESOURCE_FOUND, self._inc_res)
        event_bus.subscribe(EventType.DOWNLOAD_COMPLETED, self._inc_dl)
        event_bus.subscribe(EventType.RESOURCE_SKIPPED, self._inc_skip)
        event_bus.subscribe(EventType.ERROR_OCCURRED, self._inc_err)

    async def _inc_fetched(self, e): self.stats["fetched"] += 1
    async def _inc_parsed(self, e):  self.stats["parsed"] += 1
    async def _inc_res(self, e):     self.stats["resources"] += 1
    async def _inc_dl(self, e):      self.stats["downloaded"] += 1
    async def _inc_err(self, e):     self.stats["errors"] += 1
    async def _inc_skip(self, e):    self.stats["skipped"] += 1