"""
流媒体下载任务管理器
跟踪 M3U8 下载任务状态、分片下载进度与合并状态
任务历史持久化到 JSON，重启后可恢复查看
"""
import asyncio
import json
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
        self.status = "pending"  # pending, parsing, downloading, merging, completed, failed, cancelled, paused
        self.total_segments = 0
        self.downloaded_segments = 0
        self.merged_file: Optional[str] = None
        self.file_size = 0
        self.error: Optional[str] = None
        self.created_at = time.time()
        self.updated_at = time.time()
        self._cancel = False
        self._pause = False
        self._last_done = 0
        self._last_time = time.time()
        self.speed = 0.0

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
            "speed": round(self.speed, 1),
            "created_at": self.created_at,
            "updated_at": self.updated_at,
        }


class DownloadManager:
    """下载任务注册中心与调度器"""

    def __init__(self, concurrency: int = 8, max_segments: int = 1000,
                 state_file: str = "downloads/m3u8_tasks.json"):
        self.tasks: Dict[str, DownloadTask] = {}
        self.downloader = M3U8Downloader(concurrency=concurrency, max_segments=max_segments)
        self.state_file = state_file
        self._load_state()

    def _load_state(self) -> None:
        """从 JSON 加载历史任务（重启后恢复查看）"""
        if not os.path.exists(self.state_file):
            return
        try:
            with open(self.state_file, "r", encoding="utf-8") as f:
                data = json.load(f)
            for tid, td in (data or {}).items():
                task = DownloadTask(
                    url=td.get("url", ""),
                    referer=td.get("referer", ""),
                )
                task.task_id = tid
                task.status = td.get("status", "pending")
                task.total_segments = td.get("total_segments", 0)
                task.downloaded_segments = td.get("downloaded_segments", 0)
                task.merged_file = td.get("merged_file")
                task.file_size = td.get("file_size", 0)
                task.error = td.get("error")
                task.created_at = td.get("created_at", time.time())
                task.updated_at = td.get("updated_at", time.time())
                # 重启后 downloading/paused 视为中断，可 resume
                if task.status in ("parsing", "downloading"):
                    task.status = "paused"
                self.tasks[tid] = task
        except Exception:
            pass

    def _save_state(self) -> None:
        """持久化任务历史到 JSON"""
        try:
            os.makedirs(os.path.dirname(self.state_file) or ".", exist_ok=True)
            data = {tid: task.to_dict() for tid, task in self.tasks.items()}
            with open(self.state_file, "w", encoding="utf-8") as f:
                json.dump(data, f, ensure_ascii=False, indent=2)
        except Exception:
            pass

    def create_task(self, url: str, referer: str = "", output_dir: str = "downloads/videos") -> DownloadTask:
        task = DownloadTask(url=url, referer=referer, output_dir=output_dir)
        self.tasks[task.task_id] = task
        self._save_state()
        return task

    def get_task(self, task_id: str) -> Optional[DownloadTask]:
        return self.tasks.get(task_id)

    def list_tasks(self) -> List[DownloadTask]:
        return list(self.tasks.values())

    def delete_task(self, task_id: str) -> bool:
        """从任务列表删除（不删已下载文件）"""
        if task_id in self.tasks:
            del self.tasks[task_id]
            self._save_state()
            return True
        return False

    def cancel_task(self, task_id: str) -> bool:
        task = self.tasks.get(task_id)
        if task and task.status in ("pending", "parsing", "downloading"):
            task._cancel = True
            task.status = "cancelled"
            task.updated_at = time.time()
            self._save_state()
            return True
        return False

    def pause_task(self, task_id: str) -> bool:
        """暂停下载：设 _pause flag，当前分片下完即停"""
        task = self.tasks.get(task_id)
        if task and task.status in ("parsing", "downloading"):
            task._pause = True
            task.status = "paused"
            task.updated_at = time.time()
            self._save_state()
            return True
        return False

    def resume_task(self, task_id: str) -> Optional[asyncio.Task]:
        """继续下载：已下分片自动跳过，从断点续传"""
        task = self.tasks.get(task_id)
        if not task or task.status not in ("paused", "failed", "cancelled"):
            return None
        task._pause = False
        task._cancel = False
        task.error = None
        task.status = "pending"
        task.updated_at = time.time()
        self._save_state()
        return asyncio.create_task(self.run_task(task))

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
                    now = time.time()
                    dt = now - task._last_time
                    if dt >= 1.0:
                        task.speed = (done - task._last_done) / dt
                        task._last_done = done
                        task._last_time = now
                    task.downloaded_segments = done
                    task.updated_at = now

                files = await self.downloader.download_segments(
                    segments, session, headers, seg_dir, on_progress=on_progress
                )

                if task._cancel:
                    return

                if task._pause:
                    # 暂停：已下分片保留，下次 resume 自动跳过
                    task.status = "paused"
                    task.updated_at = time.time()
                    return

                task.status = "merging"
                task.updated_at = time.time()
                output_path = os.path.join(task.output_dir, f"{task.task_id}.ts")
                merged = M3U8Downloader.merge_segments(files, output_path)
                task.merged_file = merged
                task.file_size = os.path.getsize(merged) if os.path.exists(merged) else 0

                # 自动转封装 TS → MP4（需系统装 ffmpeg）
                try:
                    from crawler_framework.downloaders.transcoder import remux_to_mp4
                    mp4 = remux_to_mp4(merged)
                    if mp4:
                        task.merged_file = mp4
                except Exception:
                    pass

                # 清理分片目录（合并完成后 seg_*.ts 不再需要）
                try:
                    import shutil
                    if os.path.isdir(seg_dir):
                        shutil.rmtree(seg_dir, ignore_errors=True)
                except Exception:
                    pass

                task.status = "completed"
                task.updated_at = time.time()
                self._save_state()
        except Exception as e:
            task.error = str(e)
            task.updated_at = time.time()
            # 自动重试一次
            if not task._cancel and getattr(task, "_retried", 0) < 1:
                task._retried = getattr(task, "_retried", 0) + 1
                task.status = "pending"
                task.error = None
                self._save_state()
                await asyncio.sleep(2)
                await self.run_task(task)
                return
            task.status = "failed"
            self._save_state()