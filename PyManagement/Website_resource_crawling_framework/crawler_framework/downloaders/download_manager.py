"""
流媒体下载任务管理器
跟踪 M3U8 下载任务状态、分片下载进度与合并状态
"""
import asyncio
import os
import time
import uuid
from typing import Any, Dict, List, Optional
import aiohttp
from crawler_framework.downloaders.m3u8_downloader import M3U8Downloader


class DownloadTask:
    """单个下载任务的状态容器"""

    def __init__(self, url: str, referer: str = "", output_dir: str = "downloads/videos"):
        self.task_id = uuid.uuid4().hex[:12]
        self.url = url
        self.referer = referer
        self.output_dir = output_dir
        self.status = "pending"  # pending, parsing, downloading, merging, completed, failed, cancelled
        self.total_segments = 0
        self.downloaded_segments = 0
        self.merged_file: Optional[str] = None
        self.file_size = 0
        self.error: Optional[str] = None
        self.created_at = time.time()
        self.updated_at = time.time()
        self._cancel = False

    def to_dict(self) -> Dict[str, Any]:
        progress = (
            round(self.downloaded_segments / self.total_segments * 100, 1) if self.total_segments else 0
        )
        return {
            "task_id": self.task_id,
            "url": self.url,
            "status": self.status,
            "total_segments": self.total_segments,
            "downloaded_segments": self.downloaded_segments,
            "progress": progress,
            "merged_file": self.merged_file,
            "file_size": self.file_size,
            "error": self.error,
            "created_at": self.created_at,
            "updated_at": self.updated_at,
        }


class DownloadManager:
    """下载任务注册中心与调度器"""

    def __init__(self, concurrency: int = 8, max_segments: int = 1000):
        self.tasks: Dict[str, DownloadTask] = {}
        self.downloader = M3U8Downloader(concurrency=concurrency, max_segments=max_segments)

    def create_task(self, url: str, referer: str = "") -> DownloadTask:
        task = DownloadTask(url=url, referer=referer)
        self.tasks[task.task_id] = task
        return task

    def get_task(self, task_id: str) -> Optional[DownloadTask]:
        return self.tasks.get(task_id)

    def list_tasks(self) -> List[DownloadTask]:
        return list(self.tasks.values())

    def cancel_task(self, task_id: str) -> bool:
        task = self.tasks.get(task_id)
        if task and task.status in ("pending", "parsing", "downloading"):
            task._cancel = True
            task.status = "cancelled"
            task.updated_at = time.time()
            return True
        return False

    async def run_task(self, task: DownloadTask) -> None:
        """执行下载任务（在后台协程中运行）"""
        headers = {
            "User-Agent": "Mozilla/5.0 (compatible; AsyncCrawlerEngine/1.0)",
            "Accept": "*/*",
        }
        if task.referer:
            headers["Referer"] = task.referer

        try:
            task.status = "parsing"
            task.updated_at = time.time()

            connector = aiohttp.TCPConnector(limit=self.downloader.concurrency * 2, ssl=False)
            async with aiohttp.ClientSession(connector=connector, headers=headers) as session:
                segments = await self.downloader.resolve_segments(task.url, session, headers)
                task.total_segments = len(segments)
                task.updated_at = time.time()

                if task._cancel:
                    return

                task.status = "downloading"
                seg_dir = os.path.join(task.output_dir, task.task_id)

                def on_progress(done: int, total: int) -> None:
                    task.downloaded_segments = done
                    task.updated_at = time.time()

                files = await self.downloader.download_segments(
                    segments, session, headers, seg_dir, on_progress=on_progress
                )

                if task._cancel:
                    return

                task.status = "merging"
                task.updated_at = time.time()
                output_path = os.path.join(task.output_dir, f"{task.task_id}.ts")
                merged = M3U8Downloader.merge_segments(files, output_path)
                task.merged_file = merged
                task.file_size = os.path.getsize(merged) if os.path.exists(merged) else 0
                task.status = "completed"
                task.updated_at = time.time()
        except Exception as e:
            task.status = "failed"
            task.error = str(e)
            task.updated_at = time.time()