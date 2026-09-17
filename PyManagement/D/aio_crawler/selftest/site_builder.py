# -*- coding: utf-8 -*-
"""本地测试站点生成器。

生成一个包含以下内容的站点（仅用于本地自测，不访问任何第三方站点）：
- UTF-8 首页（标题：测试站点-首页）
- GBK 编码页面（标题：中文GBK页面-测试）→ 验证字符集识别
- 嵌套深层页面（深度页面一 / 深度页面二）
- 视频播放页（标题：视频播放页-示例）→ 引用 m3u8 / mpd / mp4
- 图片 / PDF 文档资源
- ffmpeg 生成：sample.mp4、HLS(m3u8+ts)、DASH(mpd+m4s)
"""
from __future__ import annotations

import os
import shutil
import subprocess
from pathlib import Path

SITE_ROOT = Path(__file__).resolve().parent / "site"

FFMPEG = os.environ.get("FFMPEG", "ffmpeg")


# ---------------------------------------------------------------- 资源生成
def _run(cmd: list[str], cwd: str | None = None) -> None:
    flags = 0
    if os.name == "nt":
        flags = subprocess.CREATE_NO_WINDOW  # type: ignore[attr-defined]
    proc = subprocess.run(cmd, capture_output=True, cwd=cwd, creationflags=flags)
    if proc.returncode != 0:
        raise RuntimeError(f"命令失败: {cmd}\n{proc.stderr.decode('utf-8', 'replace')[-800:]}")


def _make_pdf(path: Path, text: str) -> None:
    """生成一个最小合法 PDF。"""
    objs = []
    objs.append(b"<< /Type /Catalog /Pages 2 0 R >>")
    objs.append(b"<< /Type /Pages /Kids [3 0 R] /Count 1 >>")
    objs.append(b"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 300 150] /Contents 4 0 R >>")
    stream = f"BT /F1 16 Tf 40 90 Td ({text}) Tj ET".encode("latin-1", errors="replace")
    objs.append(b"<< /Length " + str(len(stream)).encode() + b" >>\nstream\n" + stream + b"\nendstream")

    out = bytearray(b"%PDF-1.4\n")
    offsets = [0]
    for i, body in enumerate(objs, start=1):
        offsets.append(len(out))
        out += f"{i} 0 obj\n".encode()
        out += body + b"\nendobj\n"
    xref_pos = len(out)
    out += f"xref\n0 {len(objs) + 1}\n".encode()
    out += b"0000000000 65535 f \n"
    for off in offsets[1:]:
        out += f"{off:010d} 00000 n \n".encode()
    out += f"trailer\n<< /Size {len(objs) + 1} /Root 1 0 R >>\nstartxref\n{xref_pos}\n%%EOF\n".encode()
    path.write_bytes(bytes(out))


def build_site() -> Path:
    """生成站点文件（每次干净重建，保证确定性），返回站点根目录。"""
    if SITE_ROOT.exists():
        shutil.rmtree(SITE_ROOT)
    SITE_ROOT.mkdir(parents=True)
    (SITE_ROOT / "deep").mkdir()
    assets = SITE_ROOT / "assets"
    vdir = assets / "video"
    assets.mkdir()
    vdir.mkdir()

    # --- 视频：mp4（强制每 2s 一个关键帧，保证 HLS/DASH 可切分）
    mp4 = vdir / "sample.mp4"
    _run([FFMPEG, "-hide_banner", "-loglevel", "error", "-y",
          "-f", "lavfi", "-i", "testsrc=size=320x240:rate=25",
          "-f", "lavfi", "-i", "sine=frequency=440:sample_rate=44100",
          "-t", "4", "-c:v", "libx264", "-pix_fmt", "yuv420p",
          "-g", "50", "-keyint_min", "50",
          "-c:a", "aac", "-shortest", str(mp4)])

    # --- HLS：cwd=vdir，分片与 m3u8 同目录
    _run([FFMPEG, "-hide_banner", "-loglevel", "error", "-y",
          "-i", "sample.mp4", "-c", "copy",
          "-hls_time", "2", "-hls_list_size", "0",
          "-hls_segment_filename", "sample_hls_%d.ts",
          "sample_hls.m3u8"], cwd=str(vdir))

    # --- DASH：cwd=vdir，分片与 mpd 同目录
    _run([FFMPEG, "-hide_banner", "-loglevel", "error", "-y",
          "-i", "sample.mp4", "-c", "copy", "-f", "dash",
          "-seg_duration", "2", "sample.mpd"], cwd=str(vdir))

    # --- 图片与文档
    logo = assets / "logo.png"
    _run([FFMPEG, "-hide_banner", "-loglevel", "error", "-y",
          "-f", "lavfi", "-i", "color=c=orange:s=96x96",
          "-frames:v", "1", str(logo)])

    doc = assets / "sample.pdf"
    _make_pdf(doc, "Hello Crawler")

    # --- 页面
    def w(name: str, content: str, encoding: str = "utf-8") -> None:
        (SITE_ROOT / name).write_bytes(content.encode(encoding))

    w("index.html", """<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>测试站点-首页</title></head>
<body>
<h1>测试站点首页</h1>
<p><img src="assets/logo.png" alt="logo"></p>
<p><a href="gbk.html">进入GBK页面</a></p>
<p><a href="deep/page1.html">进入深度页面一</a></p>
<p><a href="video.html">进入视频页</a></p>
<p><a href="assets/sample.pdf">下载文档</a></p>
</body></html>""")

    w("gbk.html", """<!DOCTYPE html>
<html><head>
<meta http-equiv="Content-Type" content="text/html; charset=gbk">
<title>中文GBK页面-测试</title></head>
<body>
<h1>这是一个GBK编码的中文页面，用来验证字符集识别不乱码</h1>
<p><img src="assets/logo.png"></p>
<p><a href="deep/page2.html">前往深度页面二</a></p>
<p><a href="assets/sample.pdf">文档</a></p>
</body></html>""", encoding="gbk")

    w("video.html", """<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>视频播放页-示例</title></head>
<body>
<h1>视频资源页</h1>
<video src="assets/video/sample_hls.m3u8" controls></video>
<p><a href="assets/video/sample.mpd">DASH 清单</a></p>
<p><a href="assets/video/sample.mp4">MP4 直链</a></p>
</body></html>""")

    w("deep/page1.html", """<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>深度页面一</title></head>
<body>
<h1>深度页面一</h1>
<a href="page2.html">深度页面二</a>
<a href="../assets/video/sample.mp4">MP4</a>
</body></html>""")

    w("deep/page2.html", """<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>深度页面二</title></head>
<body>
<h1>深度页面二</h1>
<img src="../assets/logo.png">
<a href="../gbk.html">回GBK页</a>
</body></html>""")

    return SITE_ROOT
