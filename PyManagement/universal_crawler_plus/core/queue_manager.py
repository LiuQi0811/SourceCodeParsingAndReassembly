"""
URL队列管理器
支持两种队列模式：
1. MEMORY_QUEUE: 一次性加载所有URL到内存队列后统一下载（适合站点地图、已知URL列表的全站）
2. STREAM_QUEUE: 边解析边发现URL边加入队列下载（流式爬取，适合无限深度的站点）
支持断点续爬、去重、优先级排序
设计模式：生产者-消费者模式 + 观察者模式 + 状态模式
"""
import asyncio
import json
from pathlib import Path
from typing import Optional, Set, Dict, AsyncIterator, List
from collections import deque
from datetime import datetime

from core.config import get_config, FetchMode
from core.models import UrlItem, TaskStatus
from utils.logger import get_logger
from utils.url_utils import normalize_url, is_same_domain, should_exclude, clean_url, is_valid_url

logger = get_logger("QueueManager")


class QueueManager:
    """URL队列管理器"""

    def __init__(self):
        self.config = get_config()
        self._queue: Optional[asyncio.Queue] = None
        self._seen_urls: Set[str] = set()          # 已发现URL集合（去重）
        self._completed_urls: Set[str] = set()     # 已完成URL集合
        self._failed_urls: Dict[str, int] = {}     # 失败URL及重试次数
        self._lock = asyncio.Lock()
        self._total_discovered = 0
        self._state_path = self.config.output_dir / self.config.state_file
        self._finished_event = asyncio.Event()
        self._producer_done = False
        self._active_tasks = 0

    async def init(self):
        """初始化队列"""
        if self._queue is None:
            if self.config.fetch_mode == FetchMode.MEMORY_QUEUE:
                # 内存队列模式：较大的队列容量
                self._queue = asyncio.Queue(maxsize=0)
            else:
                # 流式模式：有界队列防止内存溢出
                self._queue = asyncio.Queue(maxsize=self.config.max_concurrent * 3)
            logger.info(f"队列初始化完成，模式: {self.config.fetch_mode.value}")
            # 加载断点状态
            if self.config.enable_resume:
                await self.load_state()

    async def add_url(self, url: str, depth: int = 0, referer: str = "", force: bool = False) -> bool:
        """
        添加单个URL到队列
        :param force: 是否强制添加（即使已存在）
        :return: 是否成功添加
        """
        url = clean_url(normalize_url(url))
        if not url or not is_valid_url(url):
            return False

        # 域名限制
        if self.config.stay_in_domain and self.config.domain:
            if not is_same_domain(url, self.config.domain):
                return False

        # 排除模式
        if self.config.excluded_patterns and should_exclude(url, self.config.excluded_patterns):
            return False

        async with self._lock:
            if url in self._seen_urls and not force:
                return False
            self._seen_urls.add(url)
            self._total_discovered += 1

        item = UrlItem(url=url, depth=depth, referer=referer)
        item.status = TaskStatus.QUEUED

        await self._queue.put(item)
        logger.debug(f"URL入队: {url} (深度={depth}, 队列长度={self._queue.qsize()})")
        return True

    async def add_urls(self, urls: List[str], depth: int = 0, referer: str = "") -> int:
        """批量添加URL，返回成功添加数量"""
        count = 0
        for url in urls:
            if await self.add_url(url, depth=depth, referer=referer):
                count += 1
        return count

    async def get_next(self) -> Optional[UrlItem]:
        """获取下一个任务（消费者使用）"""
        try:
            if self.config.fetch_mode == FetchMode.STREAM_QUEUE:
                # 流式模式：等待直到队列有元素或全部完成
                while True:
                    if not self._queue.empty():
                        item = self._queue.get_nowait()
                        break
                    if self._producer_done and self._queue.empty() and self._active_tasks == 0:
                        return None
                    await asyncio.sleep(0.2)
            else:
                # 内存队列模式：阻塞获取
                item = await self._queue.get()

            self._active_tasks += 1
            item.status = TaskStatus.DOWNLOADING
            return item
        except Exception as e:
            logger.debug(f"获取队列任务异常: {e}")
            return None

    async def mark_completed(self, item: UrlItem):
        """标记任务完成"""
        async with self._lock:
            self._completed_urls.add(item.url)
            self._active_tasks = max(0, self._active_tasks - 1)
        self._queue.task_done()

        # 检查是否所有任务完成
        if self.config.fetch_mode == FetchMode.STREAM_QUEUE:
            if self._producer_done and self._queue.empty() and self._active_tasks == 0:
                self._finished_event.set()

    async def mark_failed(self, item: UrlItem, error: str = ""):
        """标记任务失败"""
        async with self._lock:
            self._failed_urls[item.url] = item.retries
            self._active_tasks = max(0, self._active_tasks - 1)
        self._queue.task_done()

    def mark_producer_done(self):
        """标记生产者已完成（流式模式使用）"""
        self._producer_done = True
        logger.debug("生产者已标记完成")

    async def wait_finished(self):
        """等待所有任务完成"""
        if self.config.fetch_mode == FetchMode.MEMORY_QUEUE:
            await self._queue.join()
        else:
            await self._finished_event.wait()
        logger.info(f"队列全部处理完成，发现URL: {self._total_discovered}, 完成: {len(self._completed_urls)}, 失败: {len(self._failed_urls)}")

    @property
    def qsize(self) -> int:
        return self._queue.qsize() if self._queue else 0

    @property
    def seen_count(self) -> int:
        return len(self._seen_urls)

    @property
    def completed_count(self) -> int:
        return len(self._completed_urls)

    @property
    def failed_count(self) -> int:
        return len(self._failed_urls)

    async def save_state(self):
        """保存断点状态到文件"""
        if not self.config.enable_resume:
            return
        state = {
            "seen_urls": list(self._seen_urls),
            "completed_urls": list(self._completed_urls),
            "failed_urls": self._failed_urls,
            "total_discovered": self._total_discovered,
            "saved_at": datetime.now().isoformat(),
            "config": {
                "base_url": self.config.base_url,
                "fetch_mode": self.config.fetch_mode.value,
                "parse_mode": self.config.parse_mode.value,
                "max_depth": self.config.max_depth,
                "domain": self.config.domain,
            }
        }
        try:
            async with asyncio.Lock():
                with open(self._state_path, "w", encoding="utf-8") as f:
                    json.dump(state, f, indent=2, ensure_ascii=False)
            logger.debug(f"断点状态已保存到: {self._state_path}")
        except Exception as e:
            logger.warning(f"保存断点状态失败: {e}")

    async def load_state(self):
        """从文件加载断点状态"""
        if not self._state_path.exists():
            logger.info("未找到断点文件，从头开始爬取")
            return
        try:
            with open(self._state_path, "r", encoding="utf-8") as f:
                state = json.load(f)

            saved_config = state.get("config", {})
            # 验证配置是否匹配
            if (saved_config.get("base_url") != self.config.base_url or
                saved_config.get("fetch_mode") != self.config.fetch_mode.value):
                logger.warning("断点配置与当前配置不匹配，将忽略断点从头开始")
                return

            self._seen_urls = set(state.get("seen_urls", []))
            self._completed_urls = set(state.get("completed_urls", []))
            self._failed_urls = state.get("failed_urls", {})
            self._total_discovered = state.get("total_discovered", 0)
            logger.info(f"加载断点状态成功：已发现 {self._total_discovered} 个URL，已完成 {len(self._completed_urls)} 个")
        except Exception as e:
            logger.warning(f"加载断点状态失败: {e}，将从头开始")

    async def reset(self):
        """重置队列"""
        while not self._queue.empty():
            try:
                self._queue.get_nowait()
                self._queue.task_done()
            except Exception:
                break
        self._seen_urls.clear()
        self._completed_urls.clear()
        self._failed_urls.clear()
        self._total_discovered = 0
        self._producer_done = False
        self._active_tasks = 0
        self._finished_event.clear()
        # 删除状态文件
        if self._state_path.exists():
            self._state_path.unlink()
        logger.info("队列已重置")
