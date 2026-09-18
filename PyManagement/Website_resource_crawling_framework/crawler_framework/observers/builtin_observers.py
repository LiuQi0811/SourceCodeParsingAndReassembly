"""
内置观察者实现：
1. ConsoleTerminalObserver: 遵循 DESIGN.md 极客终端荧光绿与琥珀橙风格的控制台实时彩色日志
2. MetricsObserver: 实时统计吞吐量、下载字节数、成功率与分类资源计数
3. FileAuditObserver: 本地持久化记录完整事件流水日志 (crawler_audit.jsonl)
"""
import asyncio
import json
import os
import time
from typing import Dict, Any
from crawler_framework.observers.base import BaseObserver
from crawler_framework.observers.events import CrawlerEvent, EventType


class TerminalColors:
    """符合 DESIGN.md 极客终端 ANSI 颜色"""
    RESET = "\033[0m"
    BOLD = "\033[1m"
    DIM = "\033[2m"
    # 极客荧光绿
    NEON_GREEN = "\033[38;2;0;255;128m"
    # 琥珀橙
    AMBER_ORANGE = "\033[38;2;255;176;0m"
    # 终端青蓝
    CYAN = "\033[38;2;0;220;255m"
    # 警示红
    RED = "\033[38;2;255;85;85m"
    # 灰底暗色
    GRAY = "\033[38;2;120;140;130m"


class ConsoleTerminalObserver(BaseObserver):
    """极客终端控制台实时观察者"""

    def __init__(self, verbose: bool = True):
        self.verbose = verbose

    async def on_event(self, event: CrawlerEvent) -> None:
        C = TerminalColors
        now_str = time.strftime("%H:%M:%S", time.localtime(event.timestamp))

        if event.event_type == EventType.ENGINE_STARTED:
            print(f"\n{C.NEON_GREEN}{C.BOLD}┌── [ASYNC CRAWLER ENGINE ACTIVE] ──────────────────────────┐{C.RESET}")
            print(f"{C.NEON_GREEN}│ 启动模式: {event.data.get('queue_mode')} 队列 | 并发数: {event.data.get('concurrency')} │{C.RESET}")
            print(f"{C.NEON_GREEN}└───────────────────────────────────────────────────────────┘{C.RESET}\n")

        elif event.event_type == EventType.REQUEST_SUCCESS:
            resp = event.response
            url = resp.url if resp else (event.task.url if event.task else "")
            cat = resp.category.value if resp else "unknown"
            enc = resp.encoding if resp else "utf-8"
            size_kb = (resp.file_size or (len(resp.raw_content) if resp else 0)) / 1024
            time_ms = (resp.elapsed if resp else 0) * 1000

            print(
                f"{C.GRAY}[{now_str}]{C.RESET} "
                f"{C.NEON_GREEN}[HTTP {resp.status_code if resp else 200}]{C.RESET} "
                f"{C.CYAN}[{cat.upper()}]{C.RESET} "
                f"{C.AMBER_ORANGE}[{enc.upper()}]{C.RESET} "
                f"{url[:65]} "
                f"{C.GRAY}({size_kb:.1f} KB, {time_ms:.0f}ms){C.RESET}"
            )

        elif event.event_type == EventType.RESOURCE_SAVED:
            path = event.data.get("saved_path", "")
            cat = event.data.get("category", "")
            size = event.data.get("size", 0) / 1024
            print(
                f"{C.GRAY}[{now_str}]{C.RESET} "
                f"{C.NEON_GREEN}  ↳ [SAVED]{C.RESET} "
                f"分类: {C.CYAN}{cat}{C.RESET} -> {path} ({size:.1f} KB)"
            )

        elif event.event_type == EventType.DECRYPT_TRIGGERED:
            d_type = event.data.get("decrypt_type", "")
            print(
                f"{C.GRAY}[{now_str}]{C.RESET} "
                f"{C.AMBER_ORANGE}  ⚡ [REVERSE DECRYPT]{C.RESET} "
                f"算法: {d_type.upper()} 成功逆向解密明文 payload"
            )

        elif event.event_type == EventType.REQUEST_FAILED:
            url = event.task.url if event.task else ""
            retries = event.task.retry_count if event.task else 0
            max_r = event.task.max_retries if event.task else 0
            err = event.message
            print(
                f"{C.GRAY}[{now_str}]{C.RESET} "
                f"{C.RED}[FAILED/RETRY {retries}/{max_r}]{C.RESET} "
                f"{url} -> {err}"
            )

        elif event.event_type == EventType.DATA_EXTRACTED:
            field_count = len(event.data.get("fields", {}))
            links_count = event.data.get("links_found", 0)
            if self.verbose:
                print(
                    f"{C.GRAY}[{now_str}]{C.RESET} "
                    f"{C.NEON_GREEN}  ★ [PARSED]{C.RESET} "
                    f"提取字段: {field_count} 个, 发现新链接: {links_count} 个"
                )

        elif event.event_type == EventType.ENGINE_STOPPED:
            print(f"\n{C.NEON_GREEN}{C.BOLD}┌── [ASYNC CRAWLER TASK COMPLETED] ─────────────────────────┐{C.RESET}")
            print(f"{C.NEON_GREEN}│ 抓取完成! 总耗时: {event.data.get('total_elapsed', 0):.2f}s │{C.RESET}")
            print(f"{C.NEON_GREEN}└───────────────────────────────────────────────────────────┘{C.RESET}\n")


class MetricsObserver(BaseObserver):
    """指标统计观察者（用于看板数据与性能监控）"""

    def __init__(self):
        self.total_requests = 0
        self.successful_requests = 0
        self.failed_requests = 0
        self.total_bytes = 0
        self.category_counts: Dict[str, int] = {}
        self.new_links_discovered = 0
        self.start_time = time.time()
        self.end_time: Optional[float] = None
        self._lock = asyncio.Lock()

    async def on_event(self, event: CrawlerEvent) -> None:
        async with self._lock:
            if event.event_type == EventType.ENGINE_STARTED:
                self.start_time = time.time()

            elif event.event_type == EventType.REQUEST_SUCCESS:
                self.total_requests += 1
                self.successful_requests += 1
                if event.response:
                    self.total_bytes += len(event.response.raw_content)
                    cat_val = event.response.category.value
                    self.category_counts[cat_val] = self.category_counts.get(cat_val, 0) + 1

            elif event.event_type == EventType.REQUEST_FAILED:
                self.total_requests += 1
                self.failed_requests += 1

            elif event.event_type == EventType.DATA_EXTRACTED:
                self.new_links_discovered += event.data.get("links_found", 0)

            elif event.event_type == EventType.ENGINE_STOPPED:
                self.end_time = time.time()

    async def get_summary(self) -> Dict[str, Any]:
        async with self._lock:
            now = self.end_time or time.time()
            duration = max(now - self.start_time, 0.001)
            qps = self.total_requests / duration
            success_rate = (self.successful_requests / self.total_requests * 100) if self.total_requests > 0 else 0.0

            return {
                "total_requests": self.total_requests,
                "successful_requests": self.successful_requests,
                "failed_requests": self.failed_requests,
                "success_rate_percent": round(success_rate, 2),
                "total_downloaded_kb": round(self.total_bytes / 1024, 2),
                "category_counts": dict(self.category_counts),
                "new_links_discovered": self.new_links_discovered,
                "duration_seconds": round(duration, 2),
                "avg_qps": round(qps, 2),
            }


class FileAuditObserver(BaseObserver):
    """持久化审计观察者，按行追加 JSONL 记录"""

    def __init__(self, log_file: str = "crawler_audit.jsonl"):
        self.log_file = log_file

    async def on_event(self, event: CrawlerEvent) -> None:
        record = {
            "timestamp": event.timestamp,
            "event_type": event.event_type.value,
            "url": event.task.url if event.task else None,
            "status_code": event.response.status_code if event.response else None,
            "category": event.response.category.value if event.response else None,
            "saved_path": event.response.saved_path if event.response else None,
            "message": event.message,
            "data": event.data,
        }
        loop = asyncio.get_running_loop()
        await loop.run_in_executor(None, self._append_line, json.dumps(record, ensure_ascii=False))

    def _append_line(self, line: str) -> None:
        with open(self.log_file, "a", encoding="utf-8") as f:
            f.write(line + "\n")
