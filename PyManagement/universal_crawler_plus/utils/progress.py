"""
进度条模块
使用tqdm实现实时进度显示，包含多维度统计信息
"""
import asyncio
import time
from typing import Optional
from tqdm import tqdm

from core.models import CrawlStats, TaskStatus
from utils.logger import get_logger

logger = get_logger("Progress")


class ProgressManager:
    """进度管理器"""

    def __init__(self, total: int = 0, desc: str = "爬取进度"):
        self.stats = CrawlStats()
        self.stats.start_time = None
        self._total = total
        self._desc = desc
        self._pbar: Optional[tqdm] = None
        self._lock = asyncio.Lock()
        self._update_interval = 0.3
        self._last_update = 0

    def start(self, total: int = None):
        """启动进度条"""
        if total is not None:
            self._total = total
        self.stats.start_time = __import__('datetime').datetime.now()
        if self._total > 0:
            bar_format = "{l_bar}{bar}| {n_fmt}/{total_fmt} [{elapsed}<{remaining}, {rate_fmt}] {postfix}"
            self._pbar = tqdm(
                total=self._total,
                desc=self._desc,
                unit="页",
                bar_format=bar_format,
                dynamic_ncols=True,
            )
        else:
            # 未知总数模式，不显示进度条百分比，仅显示计数
            bar_format = "{desc}: {n_fmt}页 [{elapsed}, {rate_fmt}] {postfix}"
            self._pbar = tqdm(
                unit="页",
                desc=self._desc,
                bar_format=bar_format,
                dynamic_ncols=True,
            )
        self._update_postfix()

    async def update(self, result=None, status: TaskStatus = None):
        """更新进度"""
        async with self._lock:
            if result is not None:
                if hasattr(result, 'success'):
                    if result.success:
                        if result.from_resume:
                            self.stats.skipped += 1
                        else:
                            self.stats.downloaded += 1
                            if result.content_length:
                                self.stats.total_bytes += result.content_length
                    else:
                        self.stats.failed += 1
            elif status == TaskStatus.DUPLICATE:
                self.stats.duplicate += 1
            elif status == TaskStatus.SKIPPED:
                self.stats.skipped += 1

            # 每个完成事件都推进进度条，保证进度计数 n 与实际完成数一致（不丢计数）
            if self._pbar is not None:
                self._pbar.update(1)

            # 仅对右侧统计文本刷新做节流，避免频繁重绘
            now = time.time()
            if now - self._last_update > self._update_interval:
                self._update_postfix()
                self._last_update = now

    def update_total(self, new_total: int):
        """更新总数量"""
        self._total = new_total
        if self._pbar is not None:
            self._pbar.total = new_total
            self._pbar.refresh()

    def update_queue_count(self, queued: int):
        """更新队列中数量"""
        self.stats.queued = queued
        self._update_postfix()

    def _update_postfix(self):
        """更新右侧统计信息"""
        if self._pbar is None:
            return
        mb = self.stats.total_bytes / (1024 * 1024)
        speed_pages = self.stats.speed
        postfix = {
            "成功": self.stats.downloaded,
            "失败": self.stats.failed,
            "跳过": self.stats.skipped + self.stats.duplicate,
            "数据量": f"{mb:.1f}MB",
            "速率": f"{speed_pages:.1f}页/s",
        }
        self._pbar.set_postfix(postfix)

    def close(self):
        """关闭进度条"""
        self.stats.end_time = __import__('datetime').datetime.now()
        self._update_postfix()  # 收尾时刷新一次，保证最终统计准确
        if self._pbar is not None:
            self._pbar.close()
            self._pbar = None
        self._print_summary()

    def _print_summary(self):
        """打印最终统计摘要"""
        duration = self.stats.duration
        mb = self.stats.total_bytes / (1024 * 1024)
        logger.info("=" * 60)
        logger.info("爬取完成！统计摘要：")
        logger.info(f"  总耗时:     {duration:.1f} 秒")
        logger.info(f"  成功下载:   {self.stats.downloaded} 个文件")
        logger.info(f"  失败:       {self.stats.failed} 个")
        logger.info(f"  跳过/重复:  {self.stats.skipped + self.stats.duplicate} 个")
        logger.info(f"  总数据量:   {mb:.2f} MB")
        if duration > 0:
            logger.info(f"  平均速度:   {self.stats.speed:.2f} 页/秒, {mb / duration:.2f} MB/秒")
        logger.info("=" * 60)
