"""状态持久化模块 - 断点续传"""
import json
import os
from typing import Set
from pathlib import Path


class StateManager:
    """管理已访问、已失败 URL 集合，JSON 持久化"""

    def __init__(self, state_path: str):
        self.state_path = Path(state_path)
        self.visited: Set[str] = set()
        self.failed: Set[str] = set()
        self.queued: Set[str] = set()

    def load(self):
        if self.state_path.exists():
            try:
                with open(self.state_path, "r", encoding="utf-8") as f:
                    data = json.load(f)
                self.visited = set(data.get("visited", []))
                self.failed = set(data.get("failed", []))
                self.queued = set(data.get("queued", []))
                return True
            except Exception:
                pass
        return False

    def save(self):
        try:
            self.state_path.parent.mkdir(parents=True, exist_ok=True)
            tmp = str(self.state_path) + ".tmp"
            with open(tmp, "w", encoding="utf-8") as f:
                json.dump({
                    "visited": list(self.visited),
                    "failed": list(self.failed),
                    "queued": list(self.queued),
                }, f, ensure_ascii=False)
            os.replace(tmp, self.state_path)
        except Exception:
            pass

    def clear(self):
        self.visited.clear()
        self.failed.clear()
        self.queued.clear()
        if self.state_path.exists():
            self.state_path.unlink()
