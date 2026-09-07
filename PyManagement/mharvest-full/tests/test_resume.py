"""验证断点续传。

标准库的 SimpleHTTPRequestHandler 不支持 Range 请求，
所以这里自己起一个最小化的、支持 206 的服务器来测。
"""

import hashlib
import http.server
import io
import os
import socketserver
import sys
import threading
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from mharvest.http import HttpClient  # noqa: E402

PORT = 8891
PAYLOAD = bytes(range(256)) * 800  # 约 200 KB，内容可预测


class RangeHandler(http.server.SimpleHTTPRequestHandler):
    """只支持 GET 的 Range 版静态服务器。"""

    def do_GET(self):
        path = self.translate_path(self.path)
        if not os.path.isfile(path):
            self.send_error(404)
            return
        data = Path(path).read_bytes()
        total = len(data)

        range_header = self.headers.get("Range")
        status = 200
        start = 0
        if range_header and range_header.startswith("bytes="):
            spec = range_header[6:].split("-")[0]
            try:
                start = int(spec)
            except ValueError:
                start = 0
            if 0 < start <= total:
                status = 206
                data = data[start:]
            else:
                start = 0

        self.send_response(status)
        self.send_header("Content-Type", "application/octet-stream")
        self.send_header("Content-Length", str(len(data)))
        if status == 206:
            self.send_header("Content-Range", f"bytes {start}-{total - 1}/{total}")
        self.end_headers()
        self.wfile.write(data)

    def log_message(self, *args):
        pass


def main() -> int:
    workdir = Path("/tmp/resume_test")
    workdir.mkdir(exist_ok=True)
    (workdir / "big.bin").write_bytes(PAYLOAD)

    handler = lambda *a, **kw: RangeHandler(*a, directory=str(workdir), **kw)  # noqa: E731
    httpd = socketserver.ThreadingTCPServer(("127.0.0.1", PORT), handler)
    httpd.daemon_threads = True
    threading.Thread(target=httpd.serve_forever, daemon=True).start()

    url = f"http://127.0.0.1:{PORT}/big.bin"
    expected = hashlib.sha256(PAYLOAD).hexdigest()
    client = HttpClient()

    # 1. 全量下载
    full = workdir / "full.bin"
    full.unlink(missing_ok=True)
    result = client.download(url, full)
    ok_full = (result.ok and full.read_bytes() == PAYLOAD)
    print(f"[1] 全量下载      {'OK' if ok_full else 'FAIL'}  "
          f"{full.stat().st_size} 字节, HTTP {result.status}")

    # 2. 真实场景：正常下一次（留下续传记录），中途被掐断，只剩前 40%
    partial = workdir / "partial.bin"
    partial.unlink(missing_ok=True)
    client.download(url, partial)
    cut = int(len(PAYLOAD) * 0.4)
    with partial.open("r+b") as fh:
        fh.truncate(cut)
    print(f"[2] 模拟中断      剩 {partial.stat().st_size} 字节")

    # 3. 断点续传：必须走 206，而不是重新全量下载
    result = client.download(url, partial, resume=True)
    ok_resume = (result.ok and partial.read_bytes() == PAYLOAD
                 and result.status == 206)
    print(f"[3] 断点续传      {'OK' if ok_resume else 'FAIL'}  "
          f"{partial.stat().st_size} 字节, HTTP {result.status}（206 表示已续传）")

    digest = hashlib.sha256(partial.read_bytes()).hexdigest()
    ok_hash = digest == expected
    print(f"[4] 内容校验      {'OK' if ok_hash else 'FAIL'}  sha256 一致")

    # 5. 关键安全性：本地残留的不是本文件前缀时，绝不能盲续传
    plain = workdir / "plain.bin"
    plain.write_bytes(b"GARBAGE")  # 长度 7，且没有续传记录
    result = client.download(url, plain, resume=True)
    # 预期：识别为无法续传，整份重下（HTTP 200），内容仍然正确
    ok_plain = (result.ok and plain.read_bytes() == PAYLOAD
                and result.status == 200)
    print(f"[5] 脏数据不续传  {'OK' if ok_plain else 'FAIL'}  "
          f"{plain.stat().st_size} 字节, HTTP {result.status}（200 表示整份重下）")

    httpd.shutdown()
    passed = all([ok_full, ok_resume, ok_hash, ok_plain])
    print("\n断点续传测试：" + ("全部通过" if passed else "存在失败"))
    return 0 if passed else 1


if __name__ == "__main__":
    raise SystemExit(main())
