"""观察者模式：异步事件总线。

事件流：
- UrlDiscovered：解析器发现新 URL（队列订阅后自动入队）
- TaskCompleted / TaskFailed：任务结束
- ResourceSaved：资源文件保存成功
- VideoMerged：视频分片合并成功
- Progress：整体进度快照

用法：EventBus 是全局单例，也可注入独立实例。
订阅者通过 async 回调（on_event 可同步或异步）。
"""

from __future__ import annotations

import asyncio
import logging
from collections import defaultdict
from dataclasses import dataclass, field
from typing import Any, Awaitable, Callable, Dict, List, Optional

logger = logging.getLogger(__name__)


@dataclass
class Event:
    type: str
    data: Dict[str, Any] = field(default_factory=dict)


class EventBus:
    """观察者模式的事件总线（发布-订阅）。"""

    def __init__(self) -> None:
        self._subscribers: Dict[str, List[Callable[[Event], Any]]] = defaultdict(list)
        self._lock = asyncio.Lock()

    def subscribe(self, event_type: str, handler: Callable[[Event], Any]) -> None:
        """订阅某类事件。handler 可为同步函数或 async 函数。"""
        if handler not in self._subscribers[event_type]:
            self._subscribers[event_type].append(handler)

    def unsubscribe(self, event_type: str, handler: Callable[[Event], Any]) -> None:
        if handler in self._subscribers.get(event_type, []):
            self._subscribers[event_type].remove(handler)

    def publish(self, event_type: str, data: Optional[Dict[str, Any]] = None) -> None:
        """同步发布事件（订阅者被调度到事件循环执行）。"""
        event = Event(type=event_type, data=data or {})
        for handler in list(self._subscribers.get(event_type, [])):
            try:
                result = handler(event)
                if asyncio.iscoroutine(result):
                    asyncio.create_task(result)
            except Exception:  # noqa: BLE001
                logger.exception("事件处理器异常: %s", handler)

    async def publish_async(self, event_type: str, data: Optional[Dict[str, Any]] = None) -> None:
        """异步发布事件：等待所有订阅者处理完毕。"""
        event = Event(type=event_type, data=data or {})
        for handler in list(self._subscribers.get(event_type, [])):
            try:
                result = handler(event)
                if asyncio.iscoroutine(result):
                    await result
            except Exception:  # noqa: BLE001
                logger.exception("事件处理器异常: %s", handler)

    async def publish_wait(self, event_type: str, data: Optional[Dict[str, Any]] = None,
                           timeout: float = 5.0) -> None:
        """发布事件并等待订阅者（带超时保护，防止阻塞抓取主循环）。"""
        try:
            await asyncio.wait_for(self.publish_async(event_type, data), timeout=timeout)
        except asyncio.TimeoutError:
            logger.debug("事件 %s 订阅者处理超时", event_type)


# 常用事件名
URL_DISCOVERED = "url.discovered"
TASK_STARTED = "task.started"
TASK_COMPLETED = "task.completed"
TASK_FAILED = "task.failed"
RESOURCE_SAVED = "resource.saved"
VIDEO_MERGED = "video.merged"
PROGRESS = "progress"
