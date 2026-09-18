# -*- coding: utf-8 -*-
"""
观察者模式 —— 事件总线
爬虫运行过程中的一切关键节点（发现 URL、抓取成功/失败、资源下载、视频合并、任务完成等）
都会发布为 CrawlEvent，由注册的 EventObserver 观察者接收处理。
"""
from __future__ import annotations

import logging
import re
import time
from abc import ABC, abstractmethod
from collections import defaultdict
from dataclasses import dataclass, field
from typing import Any, Callable, Dict, List, Optional, Union

from .constants import EventType

logger = logging.getLogger("crawler.events")


@dataclass
class CrawlEvent:
    """一条爬虫事件"""

    type: str
    task_id: str = ""
    url: str = ""
    message: str = ""
    data: Any = None
    ts: float = field(default_factory=time.time)


class EventObserver(ABC):
    """观察者抽象基类"""

    name: str = "base"

    @abstractmethod
    def on_event(self, event: CrawlEvent) -> None:
        """处理事件"""

    def __repr__(self) -> str:  # pragma: no cover
        return f"<Observer:{self.name}>"


class EventBus:
    """事件总线（被观察者 Subject）：支持按事件类型订阅，可注册 EventObserver 或回调函数"""

    def __init__(self) -> None:
        self._observers: Dict[str, List[Union[EventObserver, Callable[[CrawlEvent], None]]]] = defaultdict(list)

    def subscribe(
        self,
        event_type: str,
        observer: Union[EventObserver, Callable[[CrawlEvent], None]],
    ) -> None:
        self._observers[event_type].append(observer)

    def subscribe_all(self, observer: Union[EventObserver, Callable[[CrawlEvent], None]]) -> None:
        """订阅全部事件类型（含未来自定义类型，用 * 通配）"""
        self._observers["*"].append(observer)

    def unsubscribe(self, observer: Union[EventObserver, Callable[[CrawlEvent], None]]) -> None:
        for bucket in self._observers.values():
            if observer in bucket:
                bucket.remove(observer)

    def publish(self, event: CrawlEvent) -> None:
        """同步发布事件"""
        targets = list(self._observers.get(event.type, [])) + list(self._observers.get("*", []))
        for obs in targets:
            try:
                obs.on_event(event) if isinstance(obs, EventObserver) else obs(event)
            except Exception:  # 观察者异常不能影响主流程
                logger.exception("observer %r failed on event %s", obs, event.type)

    # ---- 便捷发布 ----
    def emit(self, etype: str, task_id: str = "", url: str = "", message: str = "", data: Any = None) -> None:
        self.publish(CrawlEvent(type=etype, task_id=task_id, url=url, message=message, data=data))


class LoggingObserver(EventObserver):
    """日志观察者：把事件输出到日志 / 控制台"""

    name = "logging"

    def __init__(self, verbose: bool = False) -> None:
        self.verbose = verbose

    def on_event(self, event: CrawlEvent) -> None:
        level = logging.INFO
        if event.type in (EventType.FETCH_ERROR, EventType.RESOURCE_DOWNLOAD_ERROR,
                          EventType.VIDEO_MERGE_ERROR, EventType.ERROR,
                          EventType.PAGE_FAILED, EventType.RESOURCE_FAILED):
            level = logging.WARNING
        if not self.verbose and event.type in (
            EventType.URL_DISCOVERED, EventType.FETCH_START,
            EventType.RESOURCE_FOUND, EventType.RESOURCE_DOWNLOAD_START,
            EventType.VIDEO_MERGE_START,
        ):
            return
        tag = f"[{event.task_id}]" if event.task_id else ""
        msg = event.message or event.url or event.type
        logger.log(level, "%-24s %s %s", event.type, tag, msg)


class StatsObserver(EventObserver):
    """统计观察者：汇总抓取/解析/下载数量与字节数，生成最终报告"""

    name = "stats"

    _REASON_RE = re.compile(r"\b([45]\d\d)\b")

    @staticmethod
    def classify_error(message) -> str:
        """按错误文本归类失败原因（HTTP 状态码优先，其次网络/超时等关键词）"""
        msg = str(message or "")
        m = StatsObserver._REASON_RE.search(msg)
        if m:
            code = int(m.group(1))
            return f"HTTP {code // 100}xx"
        low = msg.lower()
        if "timed out" in low or "timeout" in low:
            return "超时"
        if "refused" in low or "cannot connect" in low or "connect" in low and "error" in low:
            return "连接错误"
        if "reset" in low:
            return "连接重置"
        if "ssl" in low or "certificate" in low:
            return "SSL/TLS"
        if "dns" in low:
            return "DNS"
        if not msg:
            return "未知"
        return "其他"

    def __init__(self) -> None:
        self.pages_fetched = 0
        self.pages_failed = 0            # 最终失败（重试耗尽 / 不可重试）
        self.pages_attempts_failed = 0   # 抓取尝试失败次数（含重试）
        self.links_discovered = 0
        self.resources_found = 0
        self.resources_ok = 0
        self.resources_failed = 0        # 最终失败（重试耗尽 / 不可重试）
        self.resource_attempts_failed = 0  # 下载尝试失败次数（含重试）
        self.videos_merged = 0
        self.videos_failed = 0
        self.bytes_downloaded = 0
        self.start_ts: Optional[float] = None
        self.end_ts: Optional[float] = None
        self.failure_reasons: Dict[str, int] = defaultdict(int)
        self.tasks: Dict[str, dict] = defaultdict(
            lambda: {"fetched": 0, "failed": 0, "resources": 0, "resources_failed": 0, "bytes": 0}
        )

    def on_event(self, event: CrawlEvent) -> None:
        if event.type == EventType.CRAWL_START:
            self.start_ts = time.time()
        elif event.type == EventType.FETCH_OK:
            self.pages_fetched += 1
            self.tasks[event.task_id]["fetched"] += 1
            if event.data and isinstance(event.data, dict) and "bytes" in event.data:
                self.bytes_downloaded += int(event.data["bytes"])
                self.tasks[event.task_id]["bytes"] += int(event.data["bytes"])
        elif event.type == EventType.FETCH_ERROR:
            self.pages_attempts_failed += 1
        elif event.type == EventType.PAGE_FAILED:
            self.pages_failed += 1
            self.tasks[event.task_id]["failed"] += 1
            self.failure_reasons[self.classify_error(event.message)] += 1
        elif event.type == EventType.URL_DISCOVERED:
            self.links_discovered += 1
        elif event.type == EventType.RESOURCE_FOUND:
            self.resources_found += 1
        elif event.type == EventType.RESOURCE_DOWNLOAD_OK:
            self.resources_ok += 1
            self.tasks[event.task_id]["resources"] += 1
            if event.data and isinstance(event.data, dict):
                self.bytes_downloaded += int(event.data.get("bytes", 0))
        elif event.type == EventType.RESOURCE_DOWNLOAD_ERROR:
            self.resource_attempts_failed += 1
        elif event.type == EventType.RESOURCE_FAILED:
            self.resources_failed += 1
            self.tasks[event.task_id]["resources_failed"] += 1
            self.failure_reasons[self.classify_error(event.message)] += 1
        elif event.type == EventType.VIDEO_MERGE_OK:
            self.videos_merged += 1
        elif event.type == EventType.VIDEO_MERGE_ERROR:
            self.videos_failed += 1
            self.failure_reasons[self.classify_error(event.message)] += 1
        elif event.type == EventType.CRAWL_DONE:
            self.end_ts = time.time()

    def summary(self) -> dict:
        elapsed = (self.end_ts or time.time()) - (self.start_ts or time.time())
        return {
            "elapsed_seconds": round(elapsed, 2),
            "pages_fetched": self.pages_fetched,
            "pages_failed": self.pages_failed,
            "pages_attempts_failed": self.pages_attempts_failed,
            "links_discovered": self.links_discovered,
            "resources_found": self.resources_found,
            "resources_downloaded": self.resources_ok,
            "resources_failed": self.resources_failed,
            "resource_attempts_failed": self.resource_attempts_failed,
            "videos_merged": self.videos_merged,
            "videos_failed": self.videos_failed,
            "bytes_downloaded": self.bytes_downloaded,
            "failure_reasons": dict(self.failure_reasons),
            "tasks": {k: dict(v) for k, v in self.tasks.items()},
        }
