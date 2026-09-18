"""验证 engine.stop() 温和停止：处理完当前任务后退出，未完成任务保留。"""

import asyncio
import os
import sys
import threading
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from core.engine import CrawlerEngine
from core.factories import QueueFactory, TaskFactory

HTML = "<html><body><table><tr><td>x</td><td>1</td></tr></table></body></html>"


class _Handler(BaseHTTPRequestHandler):
    def do_GET(self):
        time.sleep(0.15)
        self.send_response(200)
        self.send_header("Content-Type", "text/html; charset=utf-8")
        self.end_headers()
        self.wfile.write(HTML.encode("utf-8"))

    def log_message(self, *a):
        pass


async def main():
    srv = ThreadingHTTPServer(("127.0.0.1", 0), _Handler)
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    port = srv.server_address[1]
    n = 20
    tasks = [TaskFactory.create({
        "url": f"http://127.0.0.1:{port}/item/{i}", "parser": "bs4",
        "save_resources": False, "save_html": False, "title": f"t{i}",
    }) for i in range(n)]
    engine = CrawlerEngine(queue=QueueFactory.create("memory"),
                           parser_name="bs4", workers=2,
                           output_root=str(Path(__file__).parent.parent / "output" / "stop_test"),
                           save_data=False, max_retries=1)
    # 启动后 0.4s（约完成 2 个任务时）请求温和停止
    asyncio.get_running_loop().call_later(0.4, engine.stop)
    stats = await engine.run(tasks)
    done = len([r for r in stats.task_results if r["status"] == "ok"])
    pending = n - done
    assert 1 <= done < n, f"停止时机异常: done={done}"
    assert pending > 0, "应存在未完成任务"
    print(f"  ✔ 温和停止: 处理 {done}/{n} 后退出，剩余 {pending} 保留，无异常")
    srv.shutdown()


if __name__ == "__main__":
    asyncio.run(main())
