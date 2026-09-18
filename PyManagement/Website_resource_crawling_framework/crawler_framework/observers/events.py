"""
观察者模式事件定义与数据载荷
"""
from dataclasses import dataclass, field
from enum import Enum
from typing import Any, Dict, Optional
import time
from crawler_framework.core.models import CrawlTask, CrawlResponse


class EventType(str, Enum):
    """爬虫生命周期事件类型"""
    ENGINE_STARTED = "engine_started"         # 抓取引擎启动
    ENGINE_STOPPED = "engine_stopped"         # 抓取引擎停止
    TASK_ENQUEUED = "task_enqueued"           # 发现新URL并成功推入队列
    TASK_STARTED = "task_started"             # 任务从队列出队，开始抓取
    REQUEST_SUCCESS = "request_success"       # HTTP 请求成功并解码完毕
    REQUEST_FAILED = "request_failed"         # HTTP 请求失败，准备重试或标记失败
    DATA_EXTRACTED = "data_extracted"         # 解析器提取出结构化数据
    RESOURCE_SAVED = "resource_saved"         # 静态资源保存至分类目录
    DECRYPT_TRIGGERED = "decrypt_triggered"   # 逆向解密执行完毕
    QUEUE_EMPTY = "queue_empty"               # 队列清空，无更多待处理任务


@dataclass
class CrawlerEvent:
    """爬虫事件数据对象"""
    event_type: EventType
    timestamp: float = field(default_factory=time.time)
    task: Optional[CrawlTask] = None
    response: Optional[CrawlResponse] = None
    message: str = ""
    data: Dict[str, Any] = field(default_factory=dict)
