"""事件定义"""
from dataclasses import dataclass, field
from typing import Any
from enum import Enum, auto


class EventType(Enum):
    URL_DISCOVERED = auto()
    PAGE_FETCHED = auto()
    PAGE_PARSED = auto()
    RESOURCE_FOUND = auto()
    DOWNLOAD_STARTED = auto()
    DOWNLOAD_PROGRESS = auto()
    DOWNLOAD_COMPLETED = auto()
    RESOURCE_SKIPPED = auto()
    ERROR_OCCURRED = auto()
    CRAWL_FINISHED = auto()


@dataclass
class CrawlEvent:
    event_type: EventType
    data: dict[str, Any] = field(default_factory=dict)
    timestamp: float = 0.0