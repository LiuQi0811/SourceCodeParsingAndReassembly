# core/task_model.py
from dataclasses import dataclass
from enum import Enum
from typing import Optional, Dict, Any


class TaskStatus(Enum):
    PENDING = "pending"        # 待抓取
    RUNNING = "running"        # 抓取中
    SUCCESS = "success"        # 成功
    FAILED_TEMP = "failed_temp"# 临时失败，可重试
    FAILED_PERM = "failed_perm"# 永久失败，不再重试


class ParserType(Enum):
    BS4 = "bs4"
    XPATH = "xpath"
    RE = "re"


@dataclass
class CrawlTask:
    url: str
    task_id: str
    status: TaskStatus = TaskStatus.PENDING
    parser_type: ParserType = ParserType.BS4
    retry_count: int = 0
    max_retry: int = 3
    referer: Optional[str] = None
    extra: Optional[Dict[str, Any]] = None  # 自定义扩展字段
