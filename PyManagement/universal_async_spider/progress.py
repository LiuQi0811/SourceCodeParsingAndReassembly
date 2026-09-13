"""进度条模块 - 基于 tqdm 的实时统计"""
from tqdm import tqdm
from collections import deque
import time


class Progress:
    """封装 tqdm 进度条 + 实时速率统计"""

    def __init__(self):
        self.pbar: tqdm = None
        self.total_success = 0
        self.total_failed = 0
        self.total_bytes = 0
        self._recent_times = deque(maxlen=30)
        self._recent_count = 0

    def start(self, initial_total: int = 0):
        self.pbar = tqdm(
            total=max(initial_total, 1),
            unit="page",
            desc="抓取进度",
            dynamic_ncols=True,
            bar_format="{l_bar}{bar}| {n_fmt}/{total_fmt} [{elapsed}<{remaining}, {rate_fmt}] {postfix}",
        )
        self._start_time = time.time()

    def update_total(self, new_total: int):
        if self.pbar and new_total > self.pbar.total:
            self.pbar.total = new_total
            self.pbar.refresh()

    def success(self, url: str, size: int):
        self.total_success += 1
        self.total_bytes += size
        self._recent_count += 1
        now = time.time()
        self._recent_times.append(now)
        self._update_postfix(url)
        if self.pbar:
            self.pbar.update(1)

    def fail(self, url: str):
        self.total_failed += 1
        self._update_postfix(url)

    def _update_postfix(self, url: str = ""):
        if not self.pbar:
            return
        elapsed = time.time() - self._start_time
        speed = self.total_success / elapsed if elapsed > 0 else 0
        mb = self.total_bytes / (1024 * 1024)
        display_url = url[:60] + "..." if len(url) > 60 else url
        self.pbar.set_postfix(
            ok=self.total_success,
            fail=self.total_failed,
            mb=f"{mb:.1f}MB",
            spd=f"{speed:.1f}/s",
            last=display_url,
            refresh=False
        )

    def close(self):
        if self.pbar:
            self.pbar.close()
