"""
异步全站资源通用抓取框架 (Async Crawler Framework)
支持 Python 3.12+ / 3.14+
全面采用：策略模式 (Strategy)、工厂模式 (Factory)、观察者模式 (Observer)
"""
from crawler_framework.core.models import (
    CrawlTask,
    CrawlResponse,
    QueueMode,
    ParserMode,
    ResourceCategory,
    TaskStatus,
)
from crawler_framework.core.engine import CrawlerEngine
from crawler_framework.queues.factory import QueueFactory
from crawler_framework.queues.base import BaseQueueStrategy
from crawler_framework.parsers.factory import ParserFactory
from crawler_framework.parsers.base import BaseParser
from crawler_framework.decoders.charset_detector import CharsetDetector
from crawler_framework.storage.resource_classifier import ResourceClassifier
from crawler_framework.storage.saver import ResourceSaver
from crawler_framework.decryptors.factory import DecryptorFactory
from crawler_framework.decryptors.base import BaseDecryptorStrategy
from crawler_framework.observers.event_bus import CrawlerEventBus
from crawler_framework.observers.events import CrawlerEvent, EventType
from crawler_framework.observers.builtin_observers import (
    ConsoleTerminalObserver,
    MetricsObserver,
    FileAuditObserver,
    TerminalColors,
)

__version__ = "1.0.0"

__all__ = [
    "CrawlerEngine",
    "CrawlTask",
    "CrawlResponse",
    "QueueMode",
    "ParserMode",
    "ResourceCategory",
    "TaskStatus",
    "QueueFactory",
    "BaseQueueStrategy",
    "ParserFactory",
    "BaseParser",
    "CharsetDetector",
    "ResourceClassifier",
    "ResourceSaver",
    "DecryptorFactory",
    "BaseDecryptorStrategy",
    "CrawlerEventBus",
    "CrawlerEvent",
    "EventType",
    "ConsoleTerminalObserver",
    "MetricsObserver",
    "FileAuditObserver",
    "TerminalColors",
]
