"""工厂模式统一门面：队列工厂 / 解析器工厂 / 任务工厂。

- create_queue(name, **kwargs)：memory | sqlite
- create_parser(name, config=None)：bs4 | xpath | re | composite
- create_task(spec)：从字典创建 Task（站点适配层复用）
"""

from __future__ import annotations

from typing import Any, Dict, Optional

from core.models import Task
from core.parsers.base import ParserFactoryRegistry
from core.queue.base import QueueFactoryRegistry
from core.queue.memory import MemoryQueueStrategy
from core.queue.sqlite import SQLiteQueueStrategy
from core.parsers.bs4_parser import BS4Parser
from core.parsers.xpath_parser import XPathParser
from core.parsers.re_parser import ReParser
from core.parsers.composite import CompositeParser

# 注册内置队列
QueueFactoryRegistry.register("memory", MemoryQueueStrategy)
QueueFactoryRegistry.register("sqlite", SQLiteQueueStrategy)

# 注册内置解析器
ParserFactoryRegistry.register("bs4", BS4Parser)
ParserFactoryRegistry.register("xpath", XPathParser)
ParserFactoryRegistry.register("re", ReParser)
ParserFactoryRegistry.register("composite", CompositeParser)


class QueueFactory:
    """队列工厂。"""

    @staticmethod
    def create(name: str = "memory", **kwargs: Any):
        return QueueFactoryRegistry.create(name, **kwargs)


class ParserFactory:
    """解析器工厂。"""

    @staticmethod
    def create(name: str = "bs4", config: Optional[Dict[str, Any]] = None):
        return ParserFactoryRegistry.create(name, config)


class TaskFactory:
    """任务工厂：由配置字典创建 Task（默认值补齐）。"""

    @staticmethod
    def create(spec: Dict[str, Any]) -> Task:
        defaults = {
            "method": "GET", "save_resources": True, "save_html": False,
            "depth": 0, "priority": 0, "require_browser": False,
        }
        merged = {**defaults, **spec}
        return Task(**merged)

    @staticmethod
    def create_many(specs: list) -> list:
        return [TaskFactory.create(s) for s in specs]
