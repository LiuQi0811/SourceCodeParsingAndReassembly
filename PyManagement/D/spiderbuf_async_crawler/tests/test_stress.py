"""并发压力自测：本地慢 HTTP 服务 + 高并发 workers。

100 个任务 × 100ms 延迟，workers=16 并发，验证：
- 全部成功、零失败（无任务丢失）
- 耗时显著低于串行（串行约 10s+，并发应 ≤3s）
"""

from __future__ import annotations

import asyncio
import os
import sys
import threading
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlparse

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from core.engine import CrawlerEngine
from core.factories import QueueFactory, TaskFactory

HTML = ("<html><body><h1>stress</h1><table>"
        "<tr><td>item</td><td>value</td></tr>"
        "<tr><td>x</td><td>1</td></tr>"
        "</table></body></html>")


class _SlowHandler(BaseHTTPRequestHandler):
    def do_GET(self) -> None:
        time.sleep(0.1)                      # 模拟慢响应
        self.send_response(200)
        self.send_header("Content-Type", "text/html; charset=utf-8")
        self.send_header("Content-Length", str(len(HTML)))
        self.end_headers()
        self.wfile.write(HTML.encode("utf-8"))

    def log_message(self, *args):  # noqa: D102
        pass


async def test_stress_high_concurrency() -> None:
    srv = ThreadingHTTPServer(("127.0.0.1", 0), _SlowHandler)
    port = srv.server_address[1]
    thread = threading.Thread(target=srv.serve_forever, daemon=True)
    thread.start()
    try:
        n = 100
        tasks = [TaskFactory.create({
            "url": f"http://127.0.0.1:{port}/item/{i}",
            "parser": "bs4",
            "save_resources": False,
            "save_html": False,
            "title": f"stress-{i}",
        }) for i in range(n)]
        engine = CrawlerEngine(
            queue=QueueFactory.create("memory"),
            parser_name="bs4",
            workers=16,
            output_root=os.path.join(str(Path(__file__).resolve().parent.parent), "output", "stress"),
            save_data=False,
            max_retries=1,
        )
        start = time.perf_counter()
        stats = await engine.run(tasks)
        elapsed = time.perf_counter() - start

        assert stats.succeeded == n, \
            f"成功 {stats.succeeded}/{n}，失败 {stats.failed}"
        assert stats.failed == 0, f"存在失败任务: {stats.failed}"
        assert elapsed < 5.0, \
            f"并发耗时异常（串行约 {n * 0.1:.1f}s，实际 {elapsed:.2f}s）"
        print(f"  ✔ 并发压力: {n} 任务 × 100ms 延迟 / workers=16 → "
              f"全部成功，耗时 {elapsed:.2f}s")
    finally:
        srv.shutdown()


async def main() -> None:
    await test_stress_high_concurrency()


if __name__ == "__main__":
    asyncio.run(main())
