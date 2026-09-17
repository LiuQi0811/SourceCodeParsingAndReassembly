# -*- coding: utf-8 -*-
"""全链路自测脚本。

覆盖：
1. 字符集自动识别（GBK 页面中文不乱码）
2. 三种解析器 + 组合解析器 + 单任务切换
3. 内存队列全站抓取 + 分类目录保存 + HLS/DASH 合并
4. SQLite 持久化队列断点续爬（中断 -> 恢复 -> 跑完）
5. 全局解析器切换（bs4 / xpath / re）

运行：python selftest/run_selftest.py
输出：selftest/REPORT.md + selftest/downloads/（抓取产物）
"""
from __future__ import annotations

import asyncio
import json
import logging
import os
import shutil
import sys
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

import aiohttp
from aiohttp import web

from aio_crawler import charset as charset_mod
from aio_crawler.config import Config
from aio_crawler.downloaders.merger import ffprobe_duration
from aio_crawler.engine import CrawlEngine
from aio_crawler.models import Page
from aio_crawler.parsers import ParserFactory

from site_builder import SITE_ROOT, build_site

logging.basicConfig(level=logging.WARNING, format="%(levelname)s %(name)s: %(message)s")
logger = logging.getLogger("selftest")

DOWNLOADS = Path(__file__).resolve().parent / "downloads"
TMP = Path(__file__).resolve().parent / "tmp"
REPORT = Path(__file__).resolve().parent / "REPORT.md"

_CT = {
    ".html": "text/html",
    ".png": "image/png",
    ".pdf": "application/pdf",
    ".mp4": "video/mp4",
    ".m3u8": "application/vnd.apple.mpegurl",
    ".ts": "video/mp2t",
    ".mpd": "application/dash+xml",
    ".m4s": "application/octet-stream",
    ".mp3": "audio/mpeg",
}


def _suffix(p: str) -> str:
    return os.path.splitext(p)[1].lower()


async def make_server() -> tuple[web.AppRunner, str]:
    app = web.Application()

    async def handle(request: web.Request) -> web.Response:
        path = request.path.lstrip("/") or "index.html"
        fp = (SITE_ROOT / path).resolve()
        if not str(fp).startswith(str(SITE_ROOT.resolve())) or not fp.is_file():
            return web.Response(status=404, text="not found")
        body = fp.read_bytes()
        ct = _CT.get(_suffix(path), "application/octet-stream")
        if path == "index.html":
            ct = "text/html; charset=utf-8"
        elif path == "gbk.html":
            ct = "text/html; charset=gbk"
        return web.Response(body=body, headers={"Content-Type": ct})

    app.router.add_route("GET", "/{tail:.*}", handle)
    runner = web.AppRunner(app, access_log=None)
    await runner.setup()
    site = web.TCPSite(runner, "127.0.0.1", 0)
    await site.start()
    port = site._server.sockets[0].getsockname()[1]
    return runner, f"http://127.0.0.1:{port}/"


# ---------------------------------------------------------------- 测试项
class T:
    """结果收集器。"""

    def __init__(self) -> None:
        self.items: list[dict] = []

    def check(self, name: str, cond: bool, detail: str = "") -> bool:
        self.items.append({"name": name, "pass": bool(cond), "detail": detail})
        mark = "PASS" if cond else "FAIL"
        print(f"  [{mark}] {name}" + (f"  -- {detail}" if detail else ""))
        return bool(cond)

    @property
    def all_pass(self) -> bool:
        return all(i["pass"] for i in self.items)


async def test_charset_parsers(base: str, t: T) -> None:
    """字符集识别 + 各解析器 + 单任务切换。"""
    print("\n[T1] 字符集识别与解析器")
    async with aiohttp.ClientSession() as s:
        async with s.get(base + "gbk.html") as r:
            raw = await r.read()
            ct = r.headers.get("Content-Type", "")

    text, cs = charset_mod.decode(raw, ct)
    t.check("GBK 页面按头部 charset 解码", cs.lower() in ("gbk", "gb18030") and "中文GBK页面" in text,
            f"charset={cs}")

    text2, cs2 = charset_mod.decode(raw)   # 无头部，走 meta 识别
    t.check("GBK 页面按 meta 自动识别", "中文GBK页面" in text2, f"charset={cs2}")

    page = Page(url=base + "gbk.html", text=text, charset=cs, raw=raw)

    factory = ParserFactory("auto")
    for mode in ("bs4", "xpath", "re"):
        pr = factory.get(mode).parse(page, referer=page.url)
        t.check(f"解析器 {mode} 解析 GBK 页",
                pr.title and "中文GBK页面" in pr.title and (pr.links or pr.resources),
                f"title={pr.title!r} links={len(pr.links)} res={len(pr.resources)}")

    pr = factory.get().parse(page, referer=page.url)   # auto = 组合
    t.check("组合解析器(auto) 解析",
            "中文GBK页面" in (pr.title or "") and pr.resources,
            f"used={pr.parser_used} links={len(pr.links)} res={len(pr.resources)}")

    # 单任务切换：全局 bs4，任务指定 xpath
    f2 = ParserFactory("bs4")
    single = f2.get("xpath")
    t.check("单任务解析器切换(全局bs4 -> 任务xpath)", single.name == "xpath",
            f"global={f2.global_mode} task={single.name}")

    pr2 = f2.get("composite:re,xpath").parse(page, referer=page.url)
    t.check("自定义组合(composite:re,xpath)", pr2.parser_used == ["re", "xpath"] and pr2.resources,
            f"used={pr2.parser_used}")

    # 编码回退：gbk 文本强行按 utf-8 声明也不乱码（严格失败自动回退）
    text3, cs3 = charset_mod.decode(raw, "text/html; charset=utf-8")
    t.check("声明 utf-8 但实际 gbk 自动回退", "中文GBK页面" in text3, f"实际={cs3}")


async def test_memory_full(base: str, t: T) -> None:
    """内存队列 + 全站抓取 + 分类保存 + HLS/DASH 合并。"""
    print("\n[T2] 内存队列全站抓取与资源合并")
    if DOWNLOADS.exists():
        shutil.rmtree(DOWNLOADS)
    cfg = Config(
        start_urls=[base],
        queue_type="memory",
        save_root=str(DOWNLOADS),
        parser_mode="auto",
        concurrency=8,
        download_concurrency=4,
        merge_concurrency=4,
        remux=True,
    )
    engine = CrawlEngine(cfg)
    summary = await engine.run()
    t.check("内存队列完成全站抓取", summary["pages_fetched"] >= 5,
            f"pages={summary['pages_fetched']} res_dl={summary['resources_downloaded']} "
            f"res_fail={summary['resources_failed']}")

    # 标题目录
    titles = [d.name for d in DOWNLOADS.iterdir() if d.is_dir()]
    for expect in ("测试站点-首页", "中文GBK页面-测试", "深度页面一", "深度页面二", "视频播放页-示例"):
        t.check(f"标题目录存在: {expect}", expect in titles)

    # 图片/文档分组（文件以标题命名，按扩展名落盘）
    img_dir = DOWNLOADS / "测试站点-首页" / "images"
    imgs = sorted(img_dir.glob("*.png")) if img_dir.exists() else []
    t.check("图片分组保存(images/*.png 非空)", len(imgs) >= 1 and all(p.stat().st_size > 0 for p in imgs),
            f"files={[p.name for p in imgs]}")
    docs = list((DOWNLOADS / "测试站点-首页" / "docs").glob("*.pdf")) if (DOWNLOADS / "测试站点-首页" / "docs").exists() else []
    t.check("文档分组保存(docs/*.pdf)", len(docs) >= 1)

    # HLS / DASH / 直链 MP4 合并
    vdir = DOWNLOADS / "视频播放页-示例" / "videos"
    mps = sorted(vdir.glob("*.mp4")) if vdir.exists() else []
    t.check("视频目录至少 3 个 mp4 (hls/dash/直链)", len(mps) >= 3, f"files={[p.name for p in mps]}")
    dur_ok = 0
    for mp in mps[:4]:
        d = await ffprobe_duration("ffprobe", mp)
        if d and d > 1.0:
            dur_ok += 1
    t.check("视频可播放(ffprobe 时长>1s)", dur_ok >= 3, f"ok={dur_ok}/{len(mps)}")

    # manifest 清单
    mf = DOWNLOADS / "视频播放页-示例" / "manifest.json"
    ok_manifest = False
    if mf.exists():
        try:
            recs = json.loads(mf.read_text(encoding="utf-8"))
            ok_manifest = isinstance(recs, list) and len(recs) >= 3
        except Exception:
            ok_manifest = False
    t.check("manifest.json 资源清单", ok_manifest, f"exists={mf.exists()}")


async def test_sqlite_resume(base: str, t: T) -> None:
    """SQLite 持久化队列 + 断点续爬。"""
    print("\n[T3] SQLite 队列断点续爬")
    db = TMP / "resume.db"
    if TMP.exists():
        shutil.rmtree(TMP)
    TMP.mkdir(parents=True)

    # 第一段：max_pages=2，中断
    cfg1 = Config(start_urls=[base], queue_type="sqlite", sqlite_path=str(db),
                  resume=True, max_pages=2, download_resources=False,
                  save_root=str(TMP / "dl"), concurrency=4)
    s1 = await CrawlEngine(cfg1).run()
    t.check("第一段受限抓取后停止", 1 <= s1["pages_fetched"] <= 3,
            f"pages={s1['pages_fetched']}")

    # 数据库仍有待处理任务
    from aio_crawler.queues import SqliteUrlQueue
    q = SqliteUrlQueue(str(db), resume=True)
    await q.open()
    pending = await q.pending_count()
    total1 = await q.total_count()
    await q.close()
    t.check("中断后队列保留待处理任务(断点数据在)", total1 >= 5 and pending >= 1,
            f"total={total1} pending={pending}")

    # 第二段：resume 续爬跑完（第一段已抓 2 页，第二段应完成剩余 3 页）
    cfg2 = Config(start_urls=[base], queue_type="sqlite", sqlite_path=str(db),
                  resume=True, max_pages=None, download_resources=False,
                  save_root=str(TMP / "dl"), concurrency=8)
    s2 = await CrawlEngine(cfg2).run()
    t.check("续爬后剩余页面完成(2+3=5)", s2["pages_fetched"] == 3 and s2["pages_failed"] == 0,
            f"second_pages={s2['pages_fetched']} fail={s2['pages_failed']}")

    q2 = SqliteUrlQueue(str(db), resume=False)
    await q2.open()
    done = await q2.done_count()
    pending2 = await q2.pending_count()
    await q2.close()
    t.check("队列状态：done=5 pending=0", done == 5 and pending2 == 0,
            f"done={done} pending={pending2}")


async def test_parser_modes(base: str, t: T) -> None:
    """全局解析器切换（bs4 / xpath / re）。"""
    print("\n[T4] 全局解析器切换")
    for mode in ("bs4", "xpath", "re"):
        cfg = Config(start_urls=[base], queue_type="memory", parser_mode=mode,
                     max_pages=1, download_resources=False,
                     save_root=str(TMP / f"pm_{mode}"))
        s = await CrawlEngine(cfg).run()
        found = s["links_queued"] + s["resources_found"]
        t.check(f"解析器 {mode} 首页发现链接/资源", s["pages_fetched"] >= 1 and found > 0,
                f"pages={s['pages_fetched']} links={s['links_queued']} res={s['resources_found']}")


# ---------------------------------------------------------------- 主流程
async def main() -> int:
    t = T()
    start = time.monotonic()
    print("== 构建本地测试站点 ==")
    build_site()
    print(f"站点目录: {SITE_ROOT}")

    runner, base = await make_server()
    try:
        print(f"本地服务器: {base}")
        await test_charset_parsers(base, t)
        await test_memory_full(base, t)
        await test_sqlite_resume(base, t)
        await test_parser_modes(base, t)
    finally:
        await runner.cleanup()

    elapsed = time.monotonic() - start
    passed = sum(1 for i in t.items if i["pass"])
    total = len(t.items)

    lines = [
        "# 自测报告",
        "",
        f"- 时间: {time.strftime('%Y-%m-%d %H:%M:%S')}",
        f"- 结果: **{passed}/{total} 通过** ({'全部通过' if t.all_pass else '存在失败'})",
        f"- 耗时: {elapsed:.1f}s",
        "",
        "| # | 用例 | 结果 | 说明 |",
        "|---|------|------|------|",
    ]
    for i, item in enumerate(t.items, 1):
        lines.append(f"| {i} | {item['name']} | {'PASS' if item['pass'] else 'FAIL'} | {item['detail']} |")
    lines += ["", "## 抓取产物（selftest/downloads）", ""]
    if DOWNLOADS.exists():
        for d in sorted(DOWNLOADS.iterdir()):
            if d.is_dir():
                lines.append(f"- `{d.name}/`")
                for g in sorted(d.iterdir()):
                    if g.is_dir():
                        files = ", ".join(sorted(p.name for p in g.iterdir() if p.is_file()))
                        lines.append(f"  - `{g.name}/`: {files or '(空)'}")
    REPORT.write_text("\n".join(lines), encoding="utf-8")

    print(f"\n===== 自测结果: {passed}/{total} 通过，耗时 {elapsed:.1f}s =====")
    print(f"报告: {REPORT}")
    return 0 if t.all_pass else 1


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
