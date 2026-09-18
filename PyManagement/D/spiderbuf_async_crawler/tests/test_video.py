"""自测：视频下载合并（HLS 本地端到端） + 资源分类。

生成真实 m3u8 + ts 分片（ffmpeg），本地 HTTP 服务提供，
HLSDownloader 下载并合并为 mp4，再用 ffprobe 验证可播放。
"""

from __future__ import annotations

import asyncio
import json
import os
import subprocess
import sys
import tempfile
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlparse

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import aiohttp

from core.resources import build_resource_path, classify_resource, sanitize_dirname, unique_path
from core.models import ResourceKind
from core.video import (
    DASHDownloader, HLSDownloader, VideoDownloaderFactory, detect_video_protocol)

FFMPEG = "ffmpeg"
FFPROBE = "ffprobe"


def _have(cmd: str) -> bool:
    try:
        subprocess.run([cmd, "-version"], capture_output=True, check=True)
        return True
    except Exception:  # noqa: BLE001
        return False


class _Handler(BaseHTTPRequestHandler):
    def do_GET(self) -> None:
        path = urlparse(self.path).path.lstrip("/")
        full = os.path.join(self.server.docroot, path)
        if not os.path.isfile(full):
            self.send_response(404)
            self.end_headers()
            return
        with open(full, "rb") as f:
            data = f.read()
        ctype = "application/vnd.apple.mpegurl" if full.endswith(".m3u8") else "video/mp2t"
        self.send_response(200)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def log_message(self, *args):  # noqa: D102
        pass


async def test_hls_download_and_merge() -> None:
    if not (_have(FFMPEG) and _have(FFPROBE)):
        print("  ⚠ 跳过 HLS 合并自测（缺 ffmpeg/ffprobe）")
        return
    with tempfile.TemporaryDirectory() as tmp:
        # 1) 用 ffmpeg 生成真实 m3u8 分片
        src = os.path.join(tmp, "src.mp4")
        subprocess.run([FFMPEG, "-y", "-f", "lavfi", "-i", "testsrc=duration=2:size=320x240:rate=10",
                        "-c:v", "libx264", "-pix_fmt", "yuv420p", src],
                       capture_output=True, check=True)
        hls_dir = os.path.join(tmp, "hls")
        os.makedirs(hls_dir)
        subprocess.run([FFMPEG, "-y", "-i", src, "-c", "copy", "-f", "hls",
                        "-hls_time", "1", "-hls_list_size", "0",
                        os.path.join(hls_dir, "playlist.m3u8")],
                       capture_output=True, check=True)

        # 2) 本地 HTTP 服务
        docroot = tmp
        srv = ThreadingHTTPServer(("127.0.0.1", 0), _Handler)
        srv.docroot = docroot
        port = srv.server_address[1]
        thread = __import__("threading").Thread(target=srv.serve_forever, daemon=True)
        thread.start()
        try:
            m3u8_url = f"http://127.0.0.1:{port}/hls/playlist.m3u8"
            async with aiohttp.ClientSession() as session:
                out_dir = os.path.join(tmp, "out")
                dl = HLSDownloader(session, out_dir, concurrency=4)
                final = await dl.download(m3u8_url, "测试视频", referer="http://127.0.0.1/")
            assert os.path.isfile(final) and os.path.getsize(final) > 0
            # 3) ffprobe 验证可播放
            probe = subprocess.run([FFPROBE, "-v", "error", "-show_entries",
                                    "format=duration,format_name", "-of", "json", final],
                                   capture_output=True, check=True)
            info = json.loads(probe.stdout)
            duration = float(info["format"]["duration"])
            assert duration > 1.0, f"合并视频时长异常: {duration}"
            print(f"  ✔ HLS 下载合并: {os.path.basename(final)} 时长 {duration:.2f}s，ffprobe 可播放")
        finally:
            srv.shutdown()


def test_resource_classify() -> None:
    assert classify_resource("http://x.com/a.png") == ResourceKind.IMAGE
    assert classify_resource("http://x.com/v.mp4") == ResourceKind.VIDEO
    assert classify_resource("http://x.com/d.pdf", "application/pdf") == ResourceKind.DOC
    assert classify_resource("http://x.com/data.json", "application/json") == ResourceKind.DATA
    assert classify_resource("http://x.com/f", content=b"\x89PNG\x0d\x0a") == ResourceKind.IMAGE
    # 自定义资源类型
    custom = {"epub": ResourceKind.DOC}
    assert classify_resource("http://x.com/book.epub", custom_map=custom) == ResourceKind.DOC
    assert sanitize_dirname('a/b:c*?"<>|') == "a_b_c______"
    print("  ✔ 资源分类 + 自定义类型 + 目录安全化")


def test_video_protocol_detect() -> None:
    assert detect_video_protocol("http://x.com/p.m3u8") == "hls"
    assert detect_video_protocol("http://x.com/p.mpd") == "dash"
    assert detect_video_protocol("http://x.com/p.flv") == "flv"
    assert detect_video_protocol("rtmp://x.com/live") == "rtmp"
    assert detect_video_protocol("rtsp://x.com/live") == "rtsp"
    assert detect_video_protocol("webrtc://x.com/stream") == "webrtc"
    print("  ✔ 视频协议识别")


async def test_hls_aes128_download_and_merge() -> None:
    """端到端：ffmpeg 生成 AES-128 加密 HLS → 下载解密合并 → ffprobe 可播放。"""
    if not (_have(FFMPEG) and _have(FFPROBE)):
        print("  ⚠ 跳过 HLS AES-128 自测（缺 ffmpeg/ffprobe）")
        return
    with tempfile.TemporaryDirectory() as tmp:
        src = os.path.join(tmp, "src.mp4")
        subprocess.run([FFMPEG, "-y", "-f", "lavfi", "-i", "testsrc=duration=2:size=320x240:rate=10",
                        "-c:v", "libx264", "-pix_fmt", "yuv420p", src],
                       capture_output=True, check=True)
        hls_dir = os.path.join(tmp, "hls")
        os.makedirs(hls_dir)
        # 16 字节随机 AES key + key info 文件（ffmpeg 加密 HLS 用）
        key_path = os.path.join(hls_dir, "key.bin")
        with open(key_path, "wb") as f:
            f.write(os.urandom(16))
        keyinfo = os.path.join(hls_dir, "keyinfo")
        with open(keyinfo, "w") as f:
            f.write("key.bin\n")
            f.write(key_path.replace("\\", "/") + "\n")
        subprocess.run([FFMPEG, "-y", "-i", src, "-c", "copy", "-f", "hls",
                        "-hls_time", "1", "-hls_list_size", "0",
                        "-hls_key_info_file", keyinfo,
                        os.path.join(hls_dir, "playlist.m3u8")],
                       capture_output=True, check=True)
        playlist = open(os.path.join(hls_dir, "playlist.m3u8"), encoding="utf-8").read()
        assert "#EXT-X-KEY:METHOD=AES-128" in playlist, "ffmpeg 未生成加密 playlist"

        srv = ThreadingHTTPServer(("127.0.0.1", 0), _Handler)
        srv.docroot = tmp
        port = srv.server_address[1]
        thread = __import__("threading").Thread(target=srv.serve_forever, daemon=True)
        thread.start()
        try:
            m3u8_url = f"http://127.0.0.1:{port}/hls/playlist.m3u8"
            async with aiohttp.ClientSession() as session:
                out_dir = os.path.join(tmp, "out")
                dl = HLSDownloader(session, out_dir, concurrency=4)
                final = await dl.download(m3u8_url, "加密视频")
            assert os.path.isfile(final) and os.path.getsize(final) > 0
            probe = subprocess.run([FFPROBE, "-v", "error", "-show_entries",
                                    "format=duration", "-of", "json", final],
                                   capture_output=True, check=True)
            duration = float(json.loads(probe.stdout)["format"]["duration"])
            assert duration > 1.0, f"AES-128 解密合并时长异常: {duration}"
            print(f"  ✔ HLS AES-128 加密分片下载+解密+合并: 时长 {duration:.2f}s")
        finally:
            srv.shutdown()


async def test_hls_parse_media_key_switching() -> None:
    """单元：EXT-X-MEDIA-SEQUENCE 基准 + 分片级 EXT-X-KEY 切换（含 METHOD=NONE 清除）。"""
    playlist = (
        "#EXTM3U\n"
        "#EXT-X-MEDIA-SEQUENCE:10\n"
        "#EXT-X-KEY:METHOD=AES-128,URI=\"key1.bin\",IV=0x0000000000000000000000000000000A\n"
        "#EXTINF:1.0,\n"
        "seg1.ts\n"
        "#EXT-X-KEY:METHOD=AES-128,URI=\"key2.bin\"\n"
        "#EXTINF:1.0,\n"
        "seg2.ts\n"
        "#EXT-X-KEY:METHOD=NONE\n"
        "#EXTINF:1.0,\n"
        "seg3.ts\n"
        "#EXTINF:1.0,\n"
        "seg4.ts\n"
    )
    with tempfile.TemporaryDirectory() as tmp:
        pl_dir = os.path.join(tmp, "pl")
        os.makedirs(pl_dir)
        with open(os.path.join(pl_dir, "playlist.m3u8"), "w", encoding="utf-8") as f:
            f.write(playlist)
        # 占位 key 文件（解析不下载，但保证服务不 404 也不影响）
        for k in ("key1.bin", "key2.bin"):
            with open(os.path.join(pl_dir, k), "wb") as f:
                f.write(os.urandom(16))
        srv = ThreadingHTTPServer(("127.0.0.1", 0), _Handler)
        srv.docroot = tmp
        port = srv.server_address[1]
        thread = __import__("threading").Thread(target=srv.serve_forever, daemon=True)
        thread.start()
        try:
            async with aiohttp.ClientSession() as session:
                dl = HLSDownloader(session, os.path.join(tmp, "out"))
                segs = await dl._parse_media(f"http://127.0.0.1:{port}/pl/playlist.m3u8")
            assert len(segs) == 4
            s0, s1, s2, s3 = segs
            assert s0["seq"] == 10 and s0["key"]["uri"] == "key1.bin"
            assert s0["key"]["iv"] == "0000000000000000000000000000000A"
            assert s1["seq"] == 11 and s1["key"]["uri"] == "key2.bin"
            assert "iv" not in s1["key"]
            assert s2["seq"] == 12 and s2["key"] is None
            assert s3["seq"] == 13 and s3["key"] is None
            print("  ✔ HLS media_sequence 基准 + 分片级 KEY 切换解析")
        finally:
            srv.shutdown()


async def test_dash_download_and_merge() -> None:
    """端到端：ffmpeg 生成 DASH(mpd+分片) → 下载合并 → ffprobe 可播放。"""
    if not (_have(FFMPEG) and _have(FFPROBE)):
        print("  ⚠ 跳过 DASH 自测（缺 ffmpeg/ffprobe）")
        return
    with tempfile.TemporaryDirectory() as tmp:
        dash_dir = os.path.join(tmp, "dash")
        os.makedirs(dash_dir)
        subprocess.run([FFMPEG, "-y",
                        "-f", "lavfi", "-i", "testsrc=duration=2:size=320x240:rate=10",
                        "-f", "lavfi", "-i", "sine=frequency=440:duration=2",
                        "-c:v", "libx264", "-pix_fmt", "yuv420p",
                        "-g", "10", "-keyint_min", "10", "-sc_threshold", "0",
                        "-c:a", "aac", "-shortest",
                        "-f", "dash", "-use_timeline", "1", "-use_template", "1",
                        os.path.join(dash_dir, "manifest.mpd")],
                       cwd=dash_dir, capture_output=True, check=True)
        assert os.path.isfile(os.path.join(dash_dir, "manifest.mpd"))
        srv = ThreadingHTTPServer(("127.0.0.1", 0), _Handler)
        srv.docroot = tmp
        port = srv.server_address[1]
        thread = __import__("threading").Thread(target=srv.serve_forever, daemon=True)
        thread.start()
        try:
            mpd_url = f"http://127.0.0.1:{port}/dash/manifest.mpd"
            async with aiohttp.ClientSession() as session:
                out_dir = os.path.join(tmp, "out")
                dl = DASHDownloader(session, out_dir, concurrency=4)
                final = await dl.download(mpd_url, "测试DASH")
            assert os.path.isfile(final) and os.path.getsize(final) > 0
            probe = subprocess.run([FFPROBE, "-v", "error", "-show_entries",
                                    "format=duration", "-of", "json", final],
                                   capture_output=True, check=True)
            duration = float(json.loads(probe.stdout)["format"]["duration"])
            assert duration > 1.0, f"DASH 合并时长异常: {duration}"
            print(f"  ✔ DASH 下载+分片合并+音视频 mux: 时长 {duration:.2f}s")
        finally:
            srv.shutdown()


def test_dash_timeline_time_expansion() -> None:
    """单元：SegmentTimeline S@t/d/r 展开为 (分片号, $Time$ 时间戳)。"""
    import xml.etree.ElementTree as ET
    xml = ('<T xmlns="urn:mpeg:dash:schema:mpd:2011">'
           '<S t="100" d="1000"/>'
           '<S d="1000" r="2"/>'
           '<S d="500" r="0"/>'
           "</T>")
    root = ET.fromstring(xml)
    entries = DASHDownloader._timeline_entries(root, start=5)
    # S1: t=100 d=1000 → 100；S2: 无 t 由前片推 1100, r=2 → 1100/2100/3100；
    # S3: 无 t 由前片推 4100, d=500 → 4100
    assert entries == [(5, 100), (6, 1100), (7, 2100), (8, 3100), (9, 4100)]
    print("  ✔ DASH $Time$ SegmentTimeline(t/d/r) 展开")


async def test_dash_multi_period_parse() -> None:
    """单元：多 Period MPD 各取最高带宽的视频/音频 Representation。"""
    mpd = ('<?xml version="1.0"?>'
           '<MPD xmlns="urn:mpeg:dash:schema:mpd:2011">'
           '<Period id="p1">'
           '<AdaptationSet contentType="video" mimeType="video/mp4">'
           '<Representation id="v1" bandwidth="1000"><BaseURL>v1.mp4</BaseURL></Representation>'
           '<Representation id="v1b" bandwidth="3000"><BaseURL>v1b.mp4</BaseURL></Representation>'
           "</AdaptationSet>"
           '<AdaptationSet contentType="audio" mimeType="audio/mp4">'
           '<Representation id="a1" bandwidth="128"><BaseURL>a1.mp4</BaseURL></Representation>'
           "</AdaptationSet>"
           "</Period>"
           '<Period id="p2">'
           '<AdaptationSet contentType="video" mimeType="video/mp4">'
           '<Representation id="v2" bandwidth="2000"><BaseURL>v2.mp4</BaseURL></Representation>'
           "</AdaptationSet>"
           "</Period>"
           "</MPD>")
    with tempfile.TemporaryDirectory() as tmp:
        async with aiohttp.ClientSession() as session:
            dl = DASHDownloader(session, tmp)
            video_reps, audio_reps, _ = await dl._parse_mpd(
                "http://x/manifest.mpd", mpd, "多期测试")
        assert len(video_reps) == 2, "应解析到 2 个 Period 的视频"
        assert len(audio_reps) == 1
        # 每个 Period 取最高带宽
        assert video_reps[0]["rep"].get("id") == "v1b"
        assert video_reps[1]["rep"].get("id") == "v2"
        assert audio_reps[0]["rep"].get("id") == "a1"
        print("  ✔ DASH 多 Period 解析（各取最高带宽）")


async def test_hls_parse_media_byterange() -> None:
    """单元：EXT-X-BYTERANGE 解析（显式 offset 与续上一分片末尾两种形式）。"""
    playlist = (
        "#EXTM3U\n"
        "#EXT-X-VERSION:4\n"
        "#EXT-X-MEDIA-SEQUENCE:3\n"
        "#EXT-X-BYTERANGE:1000@0\n"
        "#EXTINF:1.0,\n"
        "seg.ts\n"
        "#EXT-X-BYTERANGE:500\n"
        "#EXTINF:1.0,\n"
        "seg.ts\n"
    )
    with tempfile.TemporaryDirectory() as tmp:
        pl_dir = os.path.join(tmp, "pl")
        os.makedirs(pl_dir)
        with open(os.path.join(pl_dir, "playlist.m3u8"), "w", encoding="utf-8") as f:
            f.write(playlist)
        with open(os.path.join(pl_dir, "seg.ts"), "wb") as f:
            f.write(b"x" * 2000)
        srv = ThreadingHTTPServer(("127.0.0.1", 0), _Handler)
        srv.docroot = tmp
        port = srv.server_address[1]
        thread = __import__("threading").Thread(target=srv.serve_forever, daemon=True)
        thread.start()
        try:
            async with aiohttp.ClientSession() as session:
                dl = HLSDownloader(session, os.path.join(tmp, "out"))
                segs = await dl._parse_media(
                    f"http://127.0.0.1:{port}/pl/playlist.m3u8")
            assert len(segs) == 2
            assert segs[0]["byterange"] == (1000, 0)
            assert segs[0]["seq"] == 3
            # 无 offset：续上一分片末尾（0+1000 → offset=1000）
            assert segs[1]["byterange"] == (500, 1000)
            assert segs[1]["seq"] == 4
            print("  ✔ HLS EXT-X-BYTERANGE 字节范围分片解析")
        finally:
            srv.shutdown()


async def test_dash_probe_without_timeline() -> None:
    """端到端：无 SegmentTimeline 的 $Number$ 模板 → 持续探测到 404 正常结束。"""
    with tempfile.TemporaryDirectory() as tmp:
        dash_dir = os.path.join(tmp, "dash")
        os.makedirs(dash_dir)
        # 只放 init + 1 个分片（模拟"模板没有 timeline，只有 1 片"）
        with open(os.path.join(dash_dir, "init.mp4"), "wb") as f:
            f.write(b"init-data")
        with open(os.path.join(dash_dir, "seg-1.m4s"), "wb") as f:
            f.write(b"seg-data")
        mpd = ('<?xml version="1.0"?>'
               '<MPD xmlns="urn:mpeg:dash:schema:mpd:2011">'
               '<Period>'
               '<AdaptationSet contentType="video" mimeType="video/mp4">'
               '<Representation id="v" bandwidth="1000">'
               '<SegmentTemplate initialization="init.mp4" media="seg-$Number$.m4s" startNumber="1"/>'
               "</Representation>"
               "</AdaptationSet>"
               "</Period>"
               "</MPD>")
        with open(os.path.join(dash_dir, "manifest.mpd"), "w", encoding="utf-8") as f:
            f.write(mpd)
        srv = ThreadingHTTPServer(("127.0.0.1", 0), _Handler)
        srv.docroot = tmp
        port = srv.server_address[1]
        thread = __import__("threading").Thread(target=srv.serve_forever, daemon=True)
        thread.start()
        try:
            mpd_url = f"http://127.0.0.1:{port}/dash/manifest.mpd"
            async with aiohttp.ClientSession() as session:
                dl = DASHDownloader(session, os.path.join(tmp, "out"))
                parts = await dl.download(mpd_url, "探测测试")
            assert os.path.isfile(parts) and os.path.getsize(parts) > 0
            print("  ✔ DASH 无 timeline 模板：$Number$ 持续探测到 404 正常结束")
        finally:
            srv.shutdown()


async def test_dash_time_without_timeline_raises() -> None:
    """单元：$Time$ 模板 + 无 SegmentTimeline → 明确报错（无法推断时间戳）。"""
    import xml.etree.ElementTree as ET
    mpd = ('<?xml version="1.0"?>'
           '<MPD xmlns="urn:mpeg:dash:schema:mpd:2011">'
           '<Period>'
           '<AdaptationSet contentType="video" mimeType="video/mp4">'
           '<Representation id="v" bandwidth="1000">'
           '<SegmentTemplate media="seg-$Time$.m4s" startNumber="1"/>'
           "</Representation>"
           "</AdaptationSet>"
           "</Period>"
           "</MPD>")
    ns = {"mpd": "urn:mpeg:dash:schema:mpd:2011"}
    root = ET.fromstring(mpd)
    adapt = root.find(".//mpd:AdaptationSet", ns)
    rep = adapt.find("mpd:Representation", ns)
    tmpl = rep.find("mpd:SegmentTemplate", ns)
    with tempfile.TemporaryDirectory() as tmp:
        async with aiohttp.ClientSession() as session:
            dl = DASHDownloader(session, tmp)
            try:
                await dl._download_template(
                    "http://x/m.mpd", tmpl, rep, tmp, "video")
                raise AssertionError("应抛出 ValueError")
            except ValueError as exc:
                assert "SegmentTimeline" in str(exc)
        print("  ✔ DASH $Time$ 无 timeline → 明确报错")


async def main() -> None:
    test_resource_classify()
    test_video_protocol_detect()
    await test_hls_download_and_merge()
    await test_hls_aes128_download_and_merge()
    await test_hls_parse_media_key_switching()
    await test_hls_parse_media_byterange()
    await test_dash_download_and_merge()
    test_dash_timeline_time_expansion()
    await test_dash_multi_period_parse()
    await test_dash_probe_without_timeline()
    await test_dash_time_without_timeline_raises()


if __name__ == "__main__":
    asyncio.run(main())
