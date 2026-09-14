# core/event_observer.py
from abc import ABC
from tqdm import tqdm
from typing import Dict
import traceback

class CrawlObserver(ABC):
    async def on_task_start(self, task_id: str, url: str):
        pass

    async def on_task_success(self, task_id: str, url: str):
        pass

    async def on_task_fail(self, task_id: str, url: str, err: Exception):
        pass

    async def on_download_finish(self, filepath: str):
        pass


class ProgressBarObserver(CrawlObserver):
    def __init__(self, total: int = None):
        self.pbar = tqdm(total=total, desc="抓取进度")
        self.counter: Dict[str, int] = {"success":0, "fail":0}
        self._closed = False

    async def on_task_success(self, task_id: str, url: str):
        self.counter["success"] +=1
        self.pbar.update(1)
        self.pbar.set_postfix(success=self.counter["success"], fail=self.counter["fail"])

    async def on_task_fail(self, task_id: str, url: str, err: Exception):
        self.counter["fail"] +=1
        self.pbar.update(1)
        self.pbar.set_postfix(success=self.counter["success"], fail=self.counter["fail"])
        print(f"\n[FAIL] task={task_id}, url={url}, error: {err}")
        traceback.print_exception(type(err), err, err.__traceback__)

    def close(self):
        if self._closed:
            return
        self._closed = True
        self.pbar.close()
