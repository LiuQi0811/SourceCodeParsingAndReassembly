# -*- coding: utf-8 -*-
"""
自测套件：保证代码完美运行、无遗漏

组成：
  1. 单元测试 —— 编码识别 / 文件名清洗 / 资源分类 / 三种解析器 / 组合解析 /
                  队列 / 工厂 / 观察者事件 / 解密插件 / 存储
  2. 本地集成测试 —— 起一个 aiohttp 本地服务器（GBK 中文页、UTF-8 页、图片、
                     HLS、DASH 真实媒体流），用引擎真实爬取并验证产物
  3. 断点续爬测试 —— SQLite 队列：首轮爬 2 页，resume 后续爬剩余 3 页
  4. 视频合并测试 —— HLS 分片合并 + DASH 分片合并，ffprobe 校验可播放

运行：python main.py --self-test   或   python tests/self_test.py
"""
from __future__ import annotations

import asyncio
import json
import logging
import os
import shutil
import struct
import sys
import tempfile
import zlib
from pathlib import Path

logging.basicConfig(level=logging.WARNING, format="%(levelname)s %(name)s: %(message)s")

# 让 tests 目录作为包运行时可导入上级包
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from crawler.crypto.plugins import MD5TokenPlugin, NoopPlugin, _HAS_AES  # noqa: E402
from crawler.constants import EventType  # noqa: E402
from crawler.engine import CrawlEngine  # noqa: E402
from crawler.events import EventBus, StatsObserver  # noqa: E402
from crawler.factory import ParserFactory, build_crypto, queue_factory  # noqa: E402
from crawler.net.encoding import decode_bytes, detect_charset  # noqa: E402
from crawler.parser.base import ExtractedData, ResourceRef  # noqa: E402
from crawler.parser.composite import CompositeParser  # noqa: E402
from crawler.queue.base import QueueItem  # noqa: E402
from crawler.resource.classifier import ResourceClassifier, looks_like_resource  # noqa: E402
from crawler.resource.storage import ResourceStorage  # noqa: E402
from crawler.tasks import Settings, TaskSpec  # noqa: E402
from crawler.utils import (  # noqa: E402
    ext_from_url, human_size, normalize_url, sanitize_filename, url_filename, write_json_report,
)
from crawler.video.base import VideoDownloader  # noqa: E402
from crawler.video.ffmpeg_utils import ffprobe_duration  # noqa: E402

RESULTS: list = []


def check(name: str, cond: bool, detail: str = "") -> None:
    RESULTS.append((name, bool(cond), detail))
    mark = "PASS" if cond else "FAIL"
    print(f"  [{mark}] {name}" + (f"  -> {detail}" if detail else ""))


def section(title: str) -> None:
    print(f"\n=== {title} ===")


# ---------------------------------------------------------------------------
# 1. 单元测试
# ---------------------------------------------------------------------------
def test_utils() -> None:
    section("单元测试：工具函数")
    check("sanitize_filename 保留中文", sanitize_filename("《流浪地球》.mp4") == "《流浪地球》.mp4")
    check("sanitize_filename 去除非法字符", ":" not in sanitize_filename('a:b*c?d"e<f>g|h') and "\\" not in sanitize_filename('a:b*c?d"e<f>g|h'))
    check("sanitize_filename 去尾部点空格", sanitize_filename("标题...   ") == "标题")
    check("sanitize_filename 空值回退", sanitize_filename("") == "untitled")
    check("url_filename", url_filename("https://a.com/img/photo.jpg?x=1") == "photo.jpg")
    check("ext_from_url", ext_from_url("https://a.com/x/VIDEO.M3U8?t=2") == "m3u8")
    check("normalize_url 合并相对地址", normalize_url("/page/2", "https://a.com/") == "https://a.com/page/2")
    check("normalize_url 去 fragment", normalize_url("https://a.com/x#sec") == "https://a.com/x")
    check("normalize_url 非 http 返回 None", normalize_url("javascript:void(0)") is None)
    check("human_size", human_size(1536) == "1.50 KB")


def test_encoding() -> None:
    section("单元测试：字符集自动识别")
    gbk_bytes = "<html><head><meta charset=gbk></head><body>中文内容</body></html>".encode("gbk")
    text, charset, src = decode_bytes(gbk_bytes)
    check("GBK meta 识别", charset == "gb18030" and "中文内容" in text, f"{charset}/{src}")

    utf8_bom = b"\xef\xbb\xbf" + "中文UTF8".encode("utf-8")
    charset, src = detect_charset(utf8_bom)
    check("UTF-8 BOM 识别", charset == "utf-8-sig" and src == "bom")

    hdr = {"Content-Type": "text/html; charset=gb2312"}
    text, charset, _ = decode_bytes("标题".encode("gb2312"), hdr)
    check("HTTP 头 charset 识别", "标题" in text)

    plain = "默认utf8".encode("utf-8")
    text, charset, _ = decode_bytes(plain)
    check("无标记默认 utf-8", "默认utf8" in text)

    # 强制定制编码
    text, charset, _ = decode_bytes("中文測試".encode("big5"), forced="big5")
    check("forced 编码", "中文測試" in text)

    # 中文编码兼容降级（utf-8 解码失败 → gb18030）
    gbk_plain = "纯中文无标记".encode("gbk")
    text, charset, _ = decode_bytes(gbk_plain)
    check("中文兼容降级", "纯中文无标记" in text, charset)


def _make_png(width: int = 6, height: int = 6, rgb=(200, 60, 40)) -> bytes:
    """生成一个极小的合法 PNG"""

    def chunk(tag: bytes, data: bytes) -> bytes:
        c = struct.pack(">I", len(data)) + tag + data
        return c + struct.pack(">I", zlib.crc32(tag + data) & 0xFFFFFFFF)

    ihdr = struct.pack(">IIBBBBB", width, height, 8, 2, 0, 0, 0)
    raw = b""
    row = bytes(rgb) * width
    for _ in range(height):
        raw += b"\x00" + row
    return (
        b"\x89PNG\r\n\x1a\n"
        + chunk(b"IHDR", ihdr)
        + chunk(b"IDAT", zlib.compress(raw))
        + chunk(b"IEND", b"")
    )


def test_classifier() -> None:
    section("单元测试：资源类型自动识别")
    png = _make_png()
    check("PNG magic 识别", ResourceClassifier().classify(raw=png) == "image")
    check("JPEG magic 识别", ResourceClassifier().classify(raw=b"\xff\xd8\xff\xe0\x00\x10JFIF") == "image")
    check("PDF magic 识别", ResourceClassifier().classify(raw=b"%PDF-1.7") == "document")
    check("扩展名识别", ResourceClassifier().classify(url="https://x.com/a.zip") == "archive")
    check("扩展名识别 mp4", ResourceClassifier().classify(url="https://x.com/v.mp4") == "video")
    check("Content-Type 识别", ResourceClassifier().classify(content_type="image/webp") == "image")
    check("未知类型 other", ResourceClassifier().classify(url="https://x.com/xyz.unknownext") == "other")
    check("looks_like_resource", looks_like_resource("https://x.com/img.png") is True)
    check("html 不算资源", looks_like_resource("https://x.com/page.html") is False)

    # 自定义资源类型
    custom = ResourceClassifier([
        {"name": "font", "dir": "fonts", "extensions": ["ttf", "woff2"], "content_types": ["font/"]},
    ])
    check("自定义类型扩展名", custom.classify(url="https://x.com/a.ttf") == "font")
    check("自定义类型目录名", custom.dir_name("font") == "fonts")
    check("自定义类型 magic", custom.classify(raw=b"\x00\x01\x00\x00\x00") == "other")


def test_parsers() -> None:
    section("单元测试：解析器（bs4 / xpath / regex / 组合）")
    html = """<html><head><title>测试标题</title></head><body>
      <h1>大标题</h1>
      <a href="/a">A</a><a href="https://ext.com/b">B</a>
      <img src="/img/1.png"><video src="/v.m3u8"></video>
      <a href="/v2.mp4">v2</a>
    </body></html>"""

    p_bs4 = ParserFactory.create("bs4")
    d = p_bs4.parse(html, "https://site.com/index")
    check("bs4 标题", d.title == "测试标题", d.title)
    check("bs4 链接数", len(d.links) >= 3, str(len(d.links)))
    check("bs4 链接规范化", "https://site.com/a" in d.links and "https://ext.com/b" in d.links)
    kinds = {r.kind for r in d.resources}
    check("bs4 图片资源", "image" in kinds)
    check("bs4 视频资源", "video" in kinds and any("v.m3u8" in r.url for r in d.resources))

    p_xpath = ParserFactory.create("xpath")
    d2 = p_xpath.parse(html, "https://site.com/index")
    check("xpath 标题", d2.title == "测试标题")
    check("xpath 链接", len(d2.links) >= 2)
    check("xpath 资源", any(r.url.endswith(".png") for r in d2.resources))

    p_re = ParserFactory.create("regex")
    d3 = p_re.parse(html, "https://site.com/index")
    check("regex 标题", d3.title == "测试标题")
    check("regex 链接", len(d3.links) >= 2)
    check("regex 资源", any(r.url.endswith(".m3u8") for r in d3.resources))

    combo = ParserFactory.create(["bs4", "xpath"])
    d4 = combo.parse(html, "https://site.com/index")
    check("组合解析去重", len(d4.links) == len(set(d4.links)) and len(d4.links) >= 2)
    check("组合解析标题", d4.title == "测试标题")

    # 自定义规则
    custom = ParserFactory.create({"type": "xpath"})
    d5 = custom.parse(html, "https://site.com/index", {"links": {"xpath": "//a[contains(@href,'ext')]/@href"}})
    check("自定义 xpath 规则", d5.links == ["https://ext.com/b"], str(d5.links))

    # 字段提取
    d6 = p_bs4.parse(html, "https://site.com/index", {"fields": {"h1": {"css": "h1", "attr": "text"}}})
    check("结构化字段提取", d6.fields.get("h1") == "大标题", str(d6.fields))


def test_crypto() -> None:
    section("单元测试：逆向解密插件")
    p = MD5TokenPlugin(secret="abc123")
    url = p.transform_url("https://x.com/api?page=1", None)
    check("MD5 token 参数", "token=" in url and "timestamp=" in url)
    from urllib.parse import parse_qs, urlparse
    import hashlib

    qs = parse_qs(urlparse(url).query)
    ts = qs["timestamp"][0]
    check("MD5 token 正确性", qs["token"][0] == hashlib.md5(f"{ts}abc123".encode()).hexdigest())

    p2 = MD5TokenPlugin(secret="s", secret_mode="prepend")
    u2 = p2.transform_url("https://x.com/", None)
    ts2 = parse_qs(urlparse(u2).query)["timestamp"][0]
    check("MD5 prepend 模式", parse_qs(urlparse(u2).query)["token"][0] == hashlib.md5(f"s{ts2}".encode()).hexdigest())

    import base64

    bp = build_crypto("base64")
    dec = bp.decrypt(base64.b64encode("解密内容".encode()).decode().encode(), None)
    check("Base64 解密", "解密内容".encode() in dec)

    if _HAS_AES:
        from crawler.crypto.plugins import AESPlugin

        from Crypto.Cipher import AES as C
        key = b"0123456789abcdef"
        cipher = C.new(key, C.MODE_ECB)
        msg = b"hello-aes-test"
        padded = msg + b"\x02" * (16 - len(msg) % 16)
        enc = cipher.encrypt(padded)
        ap = AESPlugin(key=key.decode())
        check("AES-ECB 解密", ap.decrypt(enc, None) == msg)

    check("none 插件原样返回", NoopPlugin().decrypt(b"abc", None) == b"abc")
    check("未知插件报错", _raises(lambda: build_crypto("no_such_plugin")))


def _raises(fn) -> bool:
    try:
        fn()
        return False
    except Exception:
        return True


async def test_queues() -> None:
    section("单元测试：队列策略与工厂")
    mq = queue_factory.create("memory")
    await mq.initialize([QueueItem(url="https://a.com/", task_id="t")])
    dup = await mq.put(QueueItem(url="https://a.com/", task_id="t"))  # 重复应被拒绝
    n = await mq.qsize()
    item = await mq.get()
    await mq.mark_done(item)
    check("内存队列去重", dup is False and n == 1)
    check("内存队列出队", item.url == "https://a.com/")

    import tempfile as tf

    with tf.TemporaryDirectory() as td:
        sq = queue_factory.create("sqlite", db_path=str(Path(td) / "q.db"), max_retries=2)
        try:
            await sq.initialize([QueueItem(url="https://a.com/1", task_id="t")])
            await sq.put(QueueItem(url="https://a.com/2", task_id="t"))
            it = await sq.get()
            await sq.mark_done(it)
            it2 = await sq.get()
            await sq.mark_failed(it2, "boom")     # retries=1 -> pending
            it3 = await sq.get()
            await sq.mark_failed(it3, "boom2")    # retries=2 -> failed(耗尽)
            it4 = await sq.get()                  # 队列已空
            check("SQLite 重试耗尽后无待处理", it4 is None)
            # 确定性失败缓存：retriable=False 直接终态，重跑跳过不再重抓
            sqx = queue_factory.create("sqlite", db_path=str(Path(td) / "q_cache.db"), max_retries=2)
            await sqx.initialize([QueueItem(url="https://a.com/cache1", task_id="t")])
            ci = await sqx.get()
            final = await sqx.mark_failed(ci, "HTTP 403", retriable=False)
            check("确定性失败直接终态", final is True)
            re = await sqx.put(QueueItem(url="https://a.com/cache1", task_id="t"))
            check("失败缓存重跑跳过", re is False)
            st = await sqx.stats()
            check("失败缓存保留 failed 行", st.get("failed") == 1, f"stats={st}")
            await sqx.close()
            sqx2 = queue_factory.create("sqlite", db_path=str(Path(td) / "q_cache.db"), max_retries=2)
            await sqx2.initialize([QueueItem(url="https://a.com/cache1", task_id="t")], resume=False)
            st2 = await sqx2.stats()
            check("非 resume 保留确定性失败缓存", st2.get("failed") == 1, f"stats={st2}")
            re2 = await sqx2.put(QueueItem(url="https://a.com/cache1", task_id="t"))
            check("缓存行重跑仍跳过", re2 is False)
            await sqx2.close()
        finally:
            await sq.close()
        # 重新打开验证持久化
        sq2 = queue_factory.create("sqlite", db_path=str(Path(td) / "q.db"), max_retries=2)
        try:
            await sq2.initialize([], resume=True)
            total = await sq2.total()
            qsize = await sq2.qsize()
            check("SQLite 持久化记录", total == 2, f"total={total}")
            check("SQLite 重试耗尽失败态", qsize == 0, f"pending={qsize}")
        finally:
            await sq2.close()


def test_storage() -> None:
    section("单元测试：标题目录存储")
    with tempfile.TemporaryDirectory() as td:
        st = ResourceStorage(td)
        d = st.task_dir("t1", "《流浪地球》/ 电影")
        check("标题目录", d.name == "《流浪地球》_ 电影")
        p1 = st.save_bytes("t1", "image", _make_png(), url="https://x.com/1.png", title="影")
        check("图片保存", p1.exists() and p1.suffix == ".png")
        p2 = st.save_bytes("t1", "image", _make_png(), url="https://x.com/1.png", title="影")
        check("幂等保存同 URL 复用", p2 == p1 and p2.exists(), f"p1={p1.name} p2={p2.name}")
        check("无 .part 残留", not list(Path(p1).parent.glob("*.part")))
        p3 = st.save_bytes("t1", "image", _make_png(), url="https://x.com/2.png", title="影")
        check("不同 URL 不同路径", p3 != p1 and p3.exists())
        g = st.group_dir("t1", "video", "影")
        check("分组目录", g.name == "videos")


def test_events() -> None:
    section("单元测试：观察者事件总线")
    bus = EventBus()
    got = []
    bus.subscribe("fetch_ok", lambda e: got.append(e.url))
    bus.subscribe_all(lambda e: got.append(e.type))
    bus.emit("fetch_ok", task_id="t", url="https://x.com/")
    check("事件订阅", "https://x.com/" in got and "fetch_ok" in got)
    stats = StatsObserver()
    bus2 = EventBus()
    bus2.subscribe_all(stats)
    bus2.emit("fetch_ok", task_id="t", url="u", data={"bytes": 100})
    bus2.emit("resource_download_ok", task_id="t", url="u2", data={"bytes": 50})
    s = stats.summary()
    check("统计观察者", s["pages_fetched"] == 1 and s["resources_downloaded"] == 1 and s["bytes_downloaded"] == 150)


# ---------------------------------------------------------------------------
# 2. 本地集成测试
# ---------------------------------------------------------------------------
def _gbk_page() -> bytes:
    html = (
        '<!DOCTYPE html><html><head><meta charset="gbk"><title>中文测试页</title></head>'
        "<body><h1>标题一</h1>"
        '<a href="/utf8/page.html">去UTF8</a>'
        '<img src="/img/1.png">'
        "</body></html>"
    )
    return html.encode("gbk")


def _utf8_page() -> bytes:
    html = (
        '<!DOCTYPE html><html><head><meta charset="utf-8"><title>UTF8页面</title></head>'
        "<body><h1>UTF8标题</h1>"
        '<a href="/gbk/page.html">回GBK</a>'
        '<img src="/img/2.png">'
        "</body></html>"
    )
    return html.encode("utf-8")


def _chain_page(n: int, total: int) -> str:
    nxt = f'<a href="/chain/p{n + 1}.html">next</a>' if n < total else ""
    return (
        f'<html><head><title>链式页{n}</title></head><body>'
        f'<h1>页面 {n}</h1>{nxt}</body></html>'
    )


# 断点续爬专用页面：p1 -> p2,p3；p3 -> p4,p5（形成"已发现未抓完"的遗留工作）
_RESUME_PAGES = {
    1: '<a href="/chain/p2.html">p2</a><a href="/chain/p3.html">p3</a>',
    2: "",
    3: '<a href="/chain/p4.html">p4</a><a href="/chain/p5.html">p5</a>',
    4: "",
    5: "",
}


def _resume_page(n: int) -> str:
    return (
        f'<html><head><title>链式页{n}</title></head><body>'
        f'<h1>页面 {n}</h1>{_RESUME_PAGES[n]}</body></html>'
    )


def _media_page() -> str:
    return (
        '<html><head><title>媒体页</title></head><body>'
        '<a href="/video/master.m3u8">HLS视频</a>'
        '<a href="/dash/manifest.mpd">DASH视频</a>'
        '<a href="/video/video.flv">FLV视频</a>'
        "</body></html>"
    )


async def _make_video_fixtures(fixtures: Path) -> dict:
    """用 ffmpeg 生成真实 HLS / DASH / FLV 媒体；返回 (hls_ok, dash_ok, flv_ok)"""
    hls_dir = fixtures / "video"
    dash_dir = fixtures / "dash"
    hls_dir.mkdir(parents=True, exist_ok=True)
    dash_dir.mkdir(parents=True, exist_ok=True)

    from crawler.video.ffmpeg_utils import run_ffmpeg

    # ---- HLS：2 秒 x264 分片 ----
    rc, _, err = await run_ffmpeg([
        "-f", "lavfi", "-i", "testsrc=size=160x90:rate=10", "-t", "2",
        "-c:v", "libx264", "-preset", "ultrafast", "-pix_fmt", "yuv420p", "-g", "10",
        "-f", "hls", "-hls_time", "1", "-hls_list_size", "0",
        "-hls_segment_filename", "seg_%02d.ts",
        "media.m3u8",
    ], timeout=120, cwd=str(hls_dir))
    hls_ok = rc == 0
    if hls_ok:
        (hls_dir / "master.m3u8").write_text(
            "#EXTM3U\n#EXT-X-STREAM-INF:BANDWIDTH=800000,RESOLUTION=160x90\nmedia.m3u8\n",
            encoding="utf-8",
        )

    # ---- DASH：2 秒 fMP4 分片 ----
    rc2, _, err2 = await run_ffmpeg([
        "-f", "lavfi", "-i", "testsrc=size=160x90:rate=10", "-t", "2",
        "-c:v", "libx264", "-preset", "ultrafast", "-pix_fmt", "yuv420p",
        "-f", "dash", "-seg_duration", "1",
        "-init_seg_name", "init-$RepresentationID$.m4s",
        "-media_seg_name", "chunk-$RepresentationID$-$Number%05d$.m4s",
        "manifest.mpd",
    ], timeout=120, cwd=str(dash_dir))
    dash_ok = rc2 == 0

    # ---- FLV：2 秒静态 x264 flv 文件 ----
    rc3, _, err3 = await run_ffmpeg([
        "-f", "lavfi", "-i", "testsrc=size=160x90:rate=10", "-t", "2",
        "-c:v", "libx264", "-preset", "ultrafast", "-pix_fmt", "yuv420p",
        "-f", "flv", "video.flv",
    ], timeout=120, cwd=str(hls_dir))
    flv_ok = rc3 == 0 and (hls_dir / "video.flv").exists()
    return {"hls": hls_ok, "dash": dash_ok, "flv": flv_ok}


async def _setup_fixtures(tmp: Path) -> tuple:
    fixtures = tmp / "fixtures"
    (fixtures / "gbk").mkdir(parents=True, exist_ok=True)
    (fixtures / "utf8").mkdir(parents=True, exist_ok=True)
    (fixtures / "img").mkdir(parents=True, exist_ok=True)
    (fixtures / "chain").mkdir(parents=True, exist_ok=True)
    (fixtures / "video").mkdir(parents=True, exist_ok=True)
    (fixtures / "dash").mkdir(parents=True, exist_ok=True)

    (fixtures / "gbk" / "page.html").write_bytes(_gbk_page())
    (fixtures / "utf8" / "page.html").write_bytes(_utf8_page())
    (fixtures / "img" / "1.png").write_bytes(_make_png())
    (fixtures / "img" / "2.png").write_bytes(_make_png(10, 10, (30, 120, 200)))
    for n in range(1, 6):
        (fixtures / "chain" / f"p{n}.html").write_text(_resume_page(n), encoding="utf-8")
    (fixtures / "media_page.html").write_text(_media_page(), encoding="utf-8")
    # 403 反盗链模拟：页面 Referer 含 "deny-page" 时拒绝，其他 Referer 放行
    (fixtures / "deny-page.html").write_text(
        '<html><head><title>403测试</title></head><body><img src="/deny403"></body></html>',
        encoding="utf-8",
    )
    # 会话级 URL 去重：两个页面引用同一图片（跨页面重复）
    (fixtures / "dup1.html").write_text(
        '<html><head><title>去重页1</title></head><body><img src="/img/1.png"></body></html>',
        encoding="utf-8",
    )
    (fixtures / "dup2.html").write_text(
        '<html><head><title>去重页2</title></head><body><img src="/img/1.png"></body></html>',
        encoding="utf-8",
    )

    media = await _make_video_fixtures(fixtures)
    return fixtures, media


async def _serve(fixtures: Path):
    from aiohttp import web

    app = web.Application()
    # 显式路由（控制 Content-Type / 编码）
    routes = {
        "/gbk/page.html": ("text/html", (fixtures / "gbk" / "page.html").read_bytes()),
        "/utf8/page.html": ("text/html", (fixtures / "utf8" / "page.html").read_bytes()),
        "/img/1.png": ("image/png", (fixtures / "img" / "1.png").read_bytes()),
        "/img/2.png": ("image/png", (fixtures / "img" / "2.png").read_bytes()),
        "/media_page.html": ("text/html", (fixtures / "media_page.html").read_bytes().decode("utf-8").encode("utf-8")),
    }
    for n in range(1, 6):
        routes[f"/chain/p{n}.html"] = ("text/html", _resume_page(n).encode("utf-8"))

    counters = {"img1": 0}

    async def handle(request):
        path = request.path
        if path == "/img/1.png":
            counters["img1"] += 1
        if path == "/deny403":
            ref = request.headers.get("Referer", "")
            if "deny-page" in ref:
                return web.Response(status=403, text="forbidden")
            return web.Response(body=_make_png(), content_type="image/png")
        if path in routes:
            ctype, body = routes[path]
            return web.Response(body=body, content_type=ctype)
        # 视频/媒体静态文件
        candidate = fixtures / path.lstrip("/")
        if candidate.exists() and candidate.is_file():
            return web.FileResponse(candidate)
        return web.Response(status=404, text="not found")

    app.router.add_route("*", "/{tail:.*}", handle)
    runner = web.AppRunner(app)
    await runner.setup()
    site = web.TCPSite(runner, "127.0.0.1", 0)
    await site.start()
    port = site._server.sockets[0].getsockname()[1]
    return f"http://127.0.0.1:{port}", runner, counters


async def test_integration(tmp: Path, media_flags: dict) -> None:
    section("集成测试：引擎真实抓取（本地服务器）")
    fixtures, _ = await _setup_fixtures(tmp)
    base, runner, counters = await _serve(fixtures)
    try:
        # ---------- A. 内存队列 + GBK 中文页 + 图片 ----------
        out_a = tmp / "out_a"
        engine = CrawlEngine(Settings(output_dir=str(out_a), queue_type="memory", concurrency=4, verbose=False))
        task = TaskSpec(
            task_id="t_gbk", name="t_gbk",
            seed_urls=[f"{base}/gbk/page.html"], depth=1, max_pages=10,
        )
        stats = await engine.start([task])
        title_dir = out_a / "中文测试页"
        check("GBK 页面标题目录", title_dir.is_dir(), str(title_dir))
        check("中文图片按分组保存", (title_dir / "images" / "1.png").exists()
              or list((title_dir / "images").glob("1_*.png")) != [])
        check("UTF8 页面被抓取", (out_a / "UTF8页面" / "images" / "2.png").exists() or stats.pages_fetched >= 2,
              f"pages={stats.pages_fetched}")
        s = stats.summary()
        check("集成无失败页面", s["pages_failed"] == 0, f"failed={s['pages_failed']}")

        # ---------- A2. 403 反盗链对抗（换 Referer 重试） ----------
        out_a2 = tmp / "out_a2"
        e_a2 = CrawlEngine(Settings(output_dir=str(out_a2), queue_type="memory", concurrency=2, verbose=False))
        t_a2 = TaskSpec(task_id="t_403", name="t_403",
                        seed_urls=[f"{base}/deny-page.html"], depth=1, max_pages=5)
        st_a2 = await e_a2.start([t_a2])
        s_a2 = st_a2.summary()
        check("403 换 Referer 后成功", s_a2["resources_downloaded"] == 1 and s_a2["resources_failed"] == 0,
              f"ok={s_a2['resources_downloaded']} fail={s_a2['resources_failed']}")

        # ---------- A3. 会话级 URL 去重（跨任务同 URL 零物理请求） ----------
        counters["img1"] = 0  # A 段 GBK 页用过 /img/1.png，重置计数
        out_a3 = tmp / "out_a3"
        e_a3 = CrawlEngine(Settings(output_dir=str(out_a3), queue_type="memory", concurrency=2, verbose=False))
        t_dup1 = TaskSpec(task_id="t_dup1", name="t_dup1",
                          seed_urls=[f"{base}/dup1.html"], depth=1, max_pages=2)
        t_dup2 = TaskSpec(task_id="t_dup2", name="t_dup2",
                          seed_urls=[f"{base}/dup2.html"], depth=1, max_pages=2)
        st_a3 = await e_a3.start([t_dup1, t_dup2])
        s_a3 = st_a3.summary()
        check("跨任务同 URL 只物理下载一次", counters["img1"] == 1, f"img1_requests={counters['img1']}")
        check("去重后成功处理 2 项", s_a3["resources_downloaded"] == 2 and s_a3["resources_failed"] == 0,
              f"ok={s_a3['resources_downloaded']}")

        # ---------- B. SQLite 队列断点续爬 ----------
        out_b = tmp / "out_b"
        db = tmp / "q.db"
        s1 = Settings(output_dir=str(out_b), queue_type="sqlite", sqlite_path=str(db),
                      concurrency=2, verbose=False, resume=False)
        t_chain = TaskSpec(task_id="t_chain", name="t_chain",
                           seed_urls=[f"{base}/chain/p1.html"], depth=2, max_pages=2)
        e1 = CrawlEngine(s1)
        st1 = await e1.start([t_chain])
        first = st1.summary()["pages_fetched"]
        check("首轮仅爬 2 页", first == 2, f"first={first}")

        s2 = Settings(output_dir=str(out_b), queue_type="sqlite", sqlite_path=str(db),
                      concurrency=2, verbose=False, resume=True)
        t_chain2 = TaskSpec(task_id="t_chain", name="t_chain",
                            seed_urls=[f"{base}/chain/p1.html"], depth=2, max_pages=10)
        e2 = CrawlEngine(s2)
        st2 = await e2.start([t_chain2])
        second = st2.summary()["pages_fetched"]
        check("断点续爬补齐剩余 3 页", second == 3, f"second={second}")

        # ---------- C. 视频 HLS / DASH / FLV 合并 ----------
        if media_flags.get("hls") or media_flags.get("dash") or media_flags.get("flv"):
            out_c = tmp / "out_c"
            e3 = CrawlEngine(Settings(output_dir=str(out_c), queue_type="memory", concurrency=4, verbose=False))
            t_media = TaskSpec(
                task_id="t_media", name="t_media",
                seed_urls=[f"{base}/media_page.html"], depth=1, max_pages=5,
            )
            st3 = await e3.start([t_media])
            s3 = st3.summary()
            vdir = out_c / "媒体页" / "videos"
            if media_flags.get("hls"):
                merged = list(vdir.glob("master.mp4")) if vdir.is_dir() else []
                ok_merge = bool(merged)
                dur = 0.0
                if merged:
                    dur = await ffprobe_duration(str(merged[0])) or 0.0
                check("HLS 分片合并产出 mp4", ok_merge, str(merged[:2]))
                check("HLS 合并视频可播放(ffprobe)", dur > 0, f"duration={dur}s")
            if media_flags.get("dash"):
                merged_d = list(vdir.glob("manifest.mp4")) if vdir.is_dir() else []
                ok_d = bool(merged_d)
                dur_d = 0.0
                if merged_d:
                    dur_d = await ffprobe_duration(str(merged_d[0])) or 0.0
                check("DASH 分片合并产出 mp4", ok_d, str(merged_d[:2]))
                check("DASH 合并视频可播放(ffprobe)", dur_d > 0, f"duration={dur_d}s")
            if media_flags.get("flv"):
                merged_f = list(vdir.glob("video.mp4")) if vdir.is_dir() else []
                ok_f = bool(merged_f)
                dur_f = 0.0
                if merged_f:
                    dur_f = await ffprobe_duration(str(merged_f[0])) or 0.0
                check("FLV 转封装产出 mp4", ok_f, str(merged_f[:2]))
                check("FLV mp4 可播放(ffprobe)", dur_f > 0, f"duration={dur_f}s")
        else:
            check("HLS/DASH 合并", False, "ffmpeg 未能生成媒体夹具（编码器缺失）")

        # ---------- D. 视频合并失败重试（分片复用，模拟首次校验失败） ----------
        if media_flags.get("hls"):
            import crawler.video.hls_merger as _hm

            orig_dur = _hm.ffprobe_duration
            n_calls = {"n": 0}

            async def flaky_duration(path):
                n_calls["n"] += 1
                if n_calls["n"] == 1:
                    return None  # 首次校验失败 → VideoMergeError → 上层重试
                return await orig_dur(str(path))

            _hm.ffprobe_duration = flaky_duration
            try:
                out_d = tmp / "out_d"
                e4 = CrawlEngine(Settings(output_dir=str(out_d), queue_type="memory", concurrency=4, verbose=False))
                t_d = TaskSpec(
                    task_id="t_media_r", name="t_media_r",
                    seed_urls=[f"{base}/media_page.html"], depth=1, max_pages=5,
                )
                st4 = await e4.start([t_d])
                s4 = st4.summary()
                check("合并失败重试后成功", s4["videos_merged"] >= 1 and s4["videos_failed"] == 0,
                      f"merged={s4['videos_merged']} failed={s4['videos_failed']}")
                check("重试触发且产物可播放", n_calls["n"] >= 2
                      and (out_d / "媒体页" / "videos" / "master.mp4").exists(),
                      f"calls={n_calls['n']}")
                check("重试成功后无分片残留", not (out_d / "媒体页" / "videos" / ".master.parts").exists())
            finally:
                _hm.ffprobe_duration = orig_dur
    finally:
        await runner.cleanup()


async def test_live_smoke() -> None:
    """真实站点冒烟测试：ssr1（联网，网络抖动不判 FAIL）"""
    section("冒烟测试：真实站点 ssr1（联网）")
    try:
        with tempfile.TemporaryDirectory() as td:
            engine = CrawlEngine(Settings(output_dir=str(Path(td) / "live"), queue_type="memory", concurrency=4))
            task = TaskSpec(
                task_id="ssr1_smoke", name="ssr1", seed_urls=["https://ssr1.scrape.center/"],
                depth=1, max_pages=2,
            )
            st = await engine.start([task])
            s = st.summary()
            check("ssr1 冒烟抓取", s["pages_fetched"] >= 1 and s["pages_fetched"] <= 2,
                  f"pages={s['pages_fetched']} res={s['resources_downloaded']}")
    except Exception as exc:
        check("ssr1 冒烟抓取", False, f"联网异常（可忽略）: {exc}")


async def test_connect_retry() -> None:
    """连接级错误长退避：连接拒绝应走 connect_backoff 档（0.5s/1.0s 两次重试），而非快速退避档"""
    from crawler.net import fetcher as F

    section("单元测试：连接类错误长退避")
    orig_sleep = asyncio.sleep
    sleeps: list = []

    async def fake_sleep(delay: float) -> None:
        sleeps.append(round(delay, 3))

    asyncio.sleep = fake_sleep
    raised = False
    try:
        fetcher = F.AsyncFetcher(max_retries=3, retry_backoff=1.0, connect_backoff=0.5, connect_max_retries=2)
        try:
            await fetcher.fetch("http://127.0.0.1:1/")
        except Exception:
            raised = True
    finally:
        asyncio.sleep = orig_sleep
    # 连接类最多 2 次重试，退避基数 connect_backoff*2^0、*2^1 = 0.5、1.0 秒（含 random.uniform(0,0.5) 抖动；
    # 快速档基数应为 1.0、2.0，可区分）
    check("连接拒绝抛错", raised)
    ok_seq = (
        len(sleeps) == 2
        and 0.5 <= sleeps[0] < 1.0
        and 1.0 <= sleeps[1] < 1.5
    )
    check("连接类长退避 2 次序列", ok_seq, f"sleeps={sleeps}")


async def test_qps() -> None:
    """全局 QPS 令牌桶：12 个令牌、rate=5/s → 前 5 个立即，后 7 个需约 1.4s"""
    import time

    from crawler.net.fetcher import _TokenBucket

    section("单元测试：全局 QPS 限速")
    b = _TokenBucket(rate=5)
    t0 = time.perf_counter()
    for _ in range(12):
        await b.acquire()
    elapsed = time.perf_counter() - t0
    check("QPS 令牌桶限速", 1.2 <= elapsed < 3.0, f"elapsed={elapsed:.2f}s")
    # 不限速（rate=0）不阻塞
    b0 = _TokenBucket(rate=0)
    t1 = time.perf_counter()
    for _ in range(5):
        await b0.acquire()
    check("rate=0 不限速", time.perf_counter() - t1 < 0.2)


async def test_segment_reuse() -> None:
    """合并失败重试：已下载分片直接复用，不发起网络请求"""
    import asyncio

    from crawler.video.hls_merger import HLSMerger

    section("单元测试：视频分片复用")

    class _NoFetch:
        async def stream_to_file(self, *a, **k):
            raise AssertionError("分片复用路径不应发起下载")

    with tempfile.TemporaryDirectory() as td:
        tmp = Path(td) / ".m.parts"
        tmp.mkdir()
        seg = tmp / "seg_000000.ts"
        seg.write_bytes(b"segdata")
        m = HLSMerger(fetcher=_NoFetch(), task_ctx={}, storage=None)
        n = await m._download_segment("http://x/1.ts", seg, None, asyncio.Semaphore(1))
        check("复用已下载分片", n == 7 and seg.read_bytes() == b"segdata")


def test_failure_reasons() -> None:
    section("单元测试：失败原因分布")
    obs = StatsObserver()
    bus = EventBus()
    bus.subscribe_all(obs)
    bus.emit(EventType.PAGE_FAILED, task_id="t1", url="u", message="HTTP 500, message=Internal Server Error")
    bus.emit(EventType.PAGE_FAILED, task_id="t1", url="u", message="500, message=Server Error")
    bus.emit(EventType.RESOURCE_FAILED, task_id="t1", url="u", message="403, message=Forbidden")
    bus.emit(EventType.RESOURCE_FAILED, task_id="t2", url="u", message="Cannot connect to host: Connection refused")
    bus.emit(EventType.VIDEO_MERGE_ERROR, task_id="t2", url="u", message="合并结果校验失败（ffprobe 无法识别）")
    s = obs.summary()
    check("失败原因分类", s["failure_reasons"] == {"HTTP 5xx": 2, "HTTP 4xx": 1, "连接错误": 1, "其他": 1},
          str(s["failure_reasons"]))
    check("分任务聚合", s["tasks"]["t1"]["failed"] == 2 and s["tasks"]["t1"]["resources_failed"] == 1
          and s["tasks"]["t2"]["resources_failed"] == 1, str(s["tasks"]))


def test_report_json() -> None:
    section("单元测试：统计 JSON 报告")
    with tempfile.TemporaryDirectory() as td:
        summary = {"pages_fetched": 2, "resources_downloaded": 5, "bytes_downloaded": 100,
                   "failure_reasons": {"HTTP 5xx": 1}, "tasks": {"t1": {"fetched": 2}}}
        p = write_json_report(td, summary, extra={"sites": ["t1"]})
        check("report.json 生成", p is not None and Path(p).exists())
        data = json.loads(Path(p).read_text(encoding="utf-8"))
        check("report.json 字段完整", data["pages_fetched"] == 2 and data["sites"] == ["t1"]
              and data["failure_reasons"]["HTTP 5xx"] == 1 and "generated_at" in data,
              str(list(data.keys())))


def test_index() -> None:
    section("单元测试：产物索引 index.html")
    with tempfile.TemporaryDirectory() as td:
        st = ResourceStorage(td)
        d = st.task_dir("t1", "电影A")
        (d / "images").mkdir()
        (d / "images" / "a.png").write_bytes(b"xx")
        (d / "images" / "b.png").write_bytes(b"yyyy")
        (d / "videos").mkdir()
        (d / "videos" / "m.mp4").write_bytes(b"zzzzzz")
        idx = st.build_index()
        txt = idx.read_text(encoding="utf-8")
        check("索引文件生成", idx.exists() and "电影A" in txt)
        check("索引含资源链接", "a.png" in txt and "m.mp4" in txt and "videos" in txt)
        check("索引含统计", "个任务目录" in txt and "个文件" in txt)


async def main() -> int:
    print("=" * 70)
    print("scrape.center 异步爬虫 · 自测套件")
    print("=" * 70)

    test_utils()
    test_encoding()
    test_classifier()
    test_parsers()
    test_crypto()
    await test_queues()
    await test_connect_retry()
    await test_qps()
    await test_segment_reuse()
    test_storage()
    test_index()
    test_report_json()
    test_failure_reasons()
    test_events()

    tmp = Path(tempfile.mkdtemp(prefix="crawler_selftest_"))
    try:
        fixtures, media_flags = await _setup_fixtures(tmp)
        await test_integration(tmp, media_flags)
        await test_live_smoke()
    finally:
        shutil.rmtree(tmp, ignore_errors=True)

    print("\n" + "=" * 70)
    passed = sum(1 for _, ok, _ in RESULTS if ok)
    failed = len(RESULTS) - passed
    print(f"结果: {passed} 通过 / {failed} 失败 / 共 {len(RESULTS)} 项")
    for name, ok, detail in RESULTS:
        if not ok:
            print(f"  FAIL: {name}  {detail}")
    print("=" * 70)
    return 0 if failed == 0 else 1


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
