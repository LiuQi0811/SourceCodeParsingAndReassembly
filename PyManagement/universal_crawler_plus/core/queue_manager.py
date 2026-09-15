"""
URL队列管理器
支持两种队列模式：
1. MEMORY_QUEUE: 一次性加载所有URL到内存队列后统一下载（适合站点地图、已知URL列表的全站）
2. STREAM_QUEUE: 边解析边发现URL边加入队列下载（流式爬取，适合无限深度的站点）
支持断点续爬、去重、优先级排序
设计模式：生产者-消费者模式 + 观察者模式 + 状态模式

结束判定（重要）：
在本框架里 worker 同时是消费者和生产者（解析 HTML 后回流新 URL）。
因此 stream 模式的可靠结束条件是「队列已空 且 在途任务数(_inflight)为 0」——
此刻不存在任何还能产出新 URL 的任务，必然全局结束。取出任务与 _inflight+1
在同一把锁内原子完成，避免“刚取走最后一个任务但在途计数尚未自增”被误判为结束。
"""
import asyncio
import json
from pathlib import Path
from typing import Optional, Set, Dict, AsyncIterator, List
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
        self._seen_urls: Set[str] = set()          # 已入队/已完成URL集合（去重）
        self._completed_urls: Set[str] = set()     # 已完成URL集合
        self._failed_urls: Dict[str, int] = {}     # 失败URL及重试次数
        self._lock = asyncio.Lock()
        self._state_lock = asyncio.Lock()          # 持久化断点文件的专用锁（可重入保护）
        self._total_discovered = 0
        self._inflight = 0                          # 已取出但尚未完成的任务数
        self._started = False                       # 是否已经有任务入队过
        self._no_more_input = False                 # 外部声明不会再有新输入（可选，立即收敛用）
        self._finished_event = asyncio.Event()
        self._wakeup = asyncio.Event()             # 唤醒等待取任务的 worker
        self._poll_interval = 0.1

    @property
    def _state_path(self) -> Path:
        # 动态读取，set_output_dir 改变输出目录后依然指向正确位置
        return self.config.output_dir / self.config.state_file

    async def init(self):
        """初始化队列"""
        if self._queue is None:
            # 两种模式统一使用无界队列。stream 模式下 worker 同时是生产者和消费者，
            # 若用有界队列，当队列被填满、所有 worker 又都阻塞在 put 时，会形成
            # “无人消费”的经典自锁。队列里只存放轻量 UrlItem（响应体流式落盘、不进队列），
            # 真正的并发与内存占用由下载信号量(max_concurrent)控制，故无界不会导致内存失控。
            self._queue = asyncio.Queue(maxsize=0)
            logger.info(f"队列初始化完成，模式: {self.config.fetch_mode.value}")
            # 加载断点状态
            if self.config.enable_resume:
                await self.load_state()

    def _is_all_drained_locked(self) -> bool:
        """持锁判断：是否已彻底排空（队列空、无在途、且确实开始过）"""
        return (
            self._started
            and self._queue.empty()
            and self._inflight == 0
        )

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
            self._started = True
            self._finished_event.clear()  # 有新任务，撤销可能已触发的结束信号

        item = UrlItem(url=url, depth=depth, referer=referer)
        item.status = TaskStatus.QUEUED

        # put 放在锁外（无界队列不会阻塞；即便将来改回有界，也避免持锁等待）
        await self._queue.put(item)
        self._wakeup.set()
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
        """获取下一个任务（消费者使用）；无任务且确定结束时返回 None"""
        try:
            while True:
                item = None
                async with self._lock:
                    if not self._queue.empty():
                        # 取出与在途计数自增在同一锁内原子完成，消除收尾竞态
                        item = self._queue.get_nowait()
                        self._inflight += 1
                    elif self._is_all_drained_locked() or self._no_more_input:
                        # 队列空且无在途（或外部已声明不再有输入且队列空）→ 结束
                        if self._queue.empty() and self._inflight == 0:
                            self._finished_event.set()
                            return None

                if item is not None:
                    item.status = TaskStatus.DOWNLOADING
                    return item

                # 队列为空，等待新任务回流的唤醒信号（带兜底超时防丢醒）
                if self.config.fetch_mode == FetchMode.MEMORY_QUEUE:
                    # 内存模式：阻塞等待，被 put 唤醒
                    item = await self._queue.get()
                    async with self._lock:
                        self._inflight += 1
                    item.status = TaskStatus.DOWNLOADING
                    return item

                try:
                    await asyncio.wait_for(self._wakeup.wait(), timeout=self._poll_interval)
                except asyncio.TimeoutError:
                    pass
                self._wakeup.clear()
        except Exception as e:
            logger.debug(f"获取队列任务异常: {e}")
            return None

    async def _finish_one(self, item: UrlItem, ok: bool, error: str = ""):
        """任务收尾的统一逻辑：更新在途/完成集合，判断是否全局结束"""
        async with self._lock:
            if ok:
                self._completed_urls.add(item.url)
            else:
                self._failed_urls[item.url] = item.retries
            self._inflight = max(0, self._inflight - 1)
            drained = self._is_all_drained_locked()
        # task_done 与 get 配对（内存模式 join 依赖），放锁外
        self._queue.task_done()
        self._wakeup.set()
        # stream 模式：彻底排空则通知 wait_finished
        if drained and self.config.fetch_mode == FetchMode.STREAM_QUEUE:
            self._finished_event.set()

    async def mark_completed(self, item: UrlItem):
        """标记任务完成"""
        await self._finish_one(item, ok=True)

    async def mark_failed(self, item: UrlItem, error: str = ""):
        """标记任务失败"""
        await self._finish_one(item, ok=False, error=error)

    def mark_producer_done(self):
        """声明外部不再生产新 URL（流式模式可选；达到页数上限时使用）"""
        self._no_more_input = True
        self._wakeup.set()
        logger.debug("已标记不再有新输入")

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
    def inflight_count(self) -> int:
        return self._inflight

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
        # 注意：断点只持久化“已完成集合”，待办 frontier 不持久化；
        # 恢复时以 completed 作为去重集，未完成 URL 会被重新发现并入队。
        try:
            async with self._state_lock:
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

            completed = set(state.get("completed_urls", []))
            # 用“已完成集合”初始化去重集：已完成的不再入队，
            # 仅发现过但未完成的 URL 允许重新入队，避免任务丢失。
            self._seen_urls = set(completed)
            self._completed_urls = set(completed)
            self._failed_urls = state.get("failed_urls", {})
            self._total_discovered = state.get("total_discovered", 0)
            logger.info(f"加载断点状态成功：历史发现 {self._total_discovered} 个URL，已完成 {len(self._completed_urls)} 个（未完成将重试）")
        except Exception as e:
            logger.warning(f"加载断点状态失败: {e}，将从头开始")

    async def reset(self):
        """重置队列"""
        if self._queue is not None:
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
        self._inflight = 0
        self._started = False
        self._no_more_input = False
        self._finished_event.clear()
        self._wakeup.clear()
        # 删除状态文件
        if self._state_path.exists():
            self._state_path.unlink()
        logger.info("队列已重置")
