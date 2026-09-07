"""调度层：页面遍历 → 资源发现 → 并发下载 → 出报告。

流程分两阶段，这是刻意的：
1. 先单线程 BFS 把页面翻完，把资源地址收集干净（去重在这里完成）
2. 再开线程池并发下载

拆开的好处是去重逻辑简单、不会重复下载同一个 URL，
代价是不能边爬边下——对抓取类任务来说这个trade-off是划算的。
"""

from __future__ import annotations

import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from dataclasses import dataclass, field
from pathlib import Path
from typing import Callable, Optional
from urllib.parse import urlparse

from .extractors import decode_data_uri, extract_css_urls, extract_html, scan_text_urls
from .hls import download_hls
from .models import (AMBIGUOUS_VIDEO_EXT, TS_PACKET_SIZE, Resource,
                     guess_kind, resolve_ambiguous_kind, url_ext)
from .store import FileStore

ALL_KINDS = {"image", "video", "audio", "font", "stream", "other"}

# 超过这个体量就不做内容级去重的哈希计算，省内存和 IO
DEDUP_SIZE_LIMIT = 8 << 20


@dataclass
class CrawlConfig:
    depth: int = 1                      # 页面递归层数，1 = 只抓入口页
    max_pages: int = 30                 # 最多翻多少页
    max_resources: int = 0              # 0 表示不限
    workers: int = 8                    # 下载并发数
    kinds: set = field(default_factory=lambda: set(ALL_KINDS))
    min_size: int = 0                   # 小于此字节的资源丢弃（过滤占位图）
    max_size: int = 0                   # 大于此字节的资源跳过，0 不限
    same_domain: bool = True
    include_subdomains: bool = True
    parse_css: bool = True              # 是否解析 CSS 里的背景图/字体
    scan_scripts: bool = True           # 是否扫 <script> 里的隐藏地址
    follow_iframes: bool = False        # 是否把 iframe 当页面继续爬
    hls_prefer: str = "best"            # m3u8 选流策略
    use_ffmpeg: bool = True
    resume: bool = True
    obey_robots: bool = True


@dataclass
class PageRecord:
    url: str = ""
    status: int = 0
    found: int = 0
    error: str = ""


@dataclass
class Report:
    start_url: str = ""
    pages: list = field(default_factory=list)
    resources: list = field(default_factory=list)
    elapsed: float = 0.0

    def stats(self) -> dict:
        by_kind: dict[str, int] = {}
        total_size = 0
        ok = 0
        for res in self.resources:
            by_kind[res.kind] = by_kind.get(res.kind, 0) + 1
            total_size += res.size
            if res.ok:
                ok += 1
        return {
            "pages": len(self.pages),
            "pages_failed": sum(1 for p in self.pages if p.error or p.status != 200),
            "resources_found": len(self.resources),
            "resources_ok": ok,
            "by_kind": by_kind,
            "total_bytes": total_size,
            "elapsed": round(self.elapsed, 2),
        }

    def summary(self) -> str:
        s = self.stats()
        size_mb = s["total_bytes"] / 1024 / 1024
        kind_text = "  ".join(f"{k}={v}" for k, v in sorted(s["by_kind"].items()))
        failed = s["resources_found"] - s["resources_ok"]
        return (
            f"页面 {s['pages']} 个（失败 {s['pages_failed']}）\n"
            f"资源 {s['resources_found']} 条，成功 {s['resources_ok']} 条"
            f"{f'，失败 {failed} 条' if failed else ''}\n"
            f"分类：{kind_text or '无'}\n"
            f"落盘 {size_mb:.2f} MB，耗时 {s['elapsed']}s"
        )

    def save(self, path: str | Path) -> None:
        import json
        from datetime import datetime

        payload = {
            "start_url": self.start_url,
            "generated_at": datetime.now().isoformat(timespec="seconds"),
            "stats": self.stats(),
            "pages": [vars(p) for p in self.pages],
            "resources": [r.to_dict() for r in self.resources],
        }
        Path(path).parent.mkdir(parents=True, exist_ok=True)
        Path(path).write_text(json.dumps(payload, ensure_ascii=False, indent=2),
                              encoding="utf-8")


def normalize_page_url(url: str) -> str:
    """规范化页面 URL：去掉 fragment 和分号参数，避免同一页被反复抓取。"""
    parts = urlparse(url)
    return parts._replace(fragment="", params="", query=parts.query).geturl()


def same_site(a: str, b: str, include_sub: bool = True) -> bool:
    """判断两个 URL 是否属于同一站点。"""
    host_a = urlparse(a).netloc.split(":")[0].lower()
    host_b = urlparse(b).netloc.split(":")[0].lower()
    if not host_a or not host_b:
        return False
    if host_a == host_b:
        return True
    if include_sub:
        return host_a.endswith("." + host_b) or host_b.endswith("." + host_a)
    return False


class Crawler:
    """资源抓取调度器。"""

    def __init__(self, client, store: FileStore, config: CrawlConfig,
                 on_event: Optional[Callable[[str, object], None]] = None):
        self.client = client
        self.store = store
        self.cfg = config
        self.on_event = on_event or (lambda *_: None)

        # stream（m3u8）本质是视频的一种载体形式，内部虽然分了类，
        # 但用户说"只要视频"时，显然也希望连流媒体一起抓。
        # 用新集合而不是原地改，避免污染调用方传入的 kinds。
        if "video" in self.cfg.kinds:
            self.cfg.kinds = self.cfg.kinds | {"stream"}

        self._seen_resources: set[str] = set()
        self._seen_pages: set[str] = set()
        self._seen_css: set[str] = set()
        self._pending: list[Resource] = []   # 待下载
        self._done: list[Resource] = []      # 已就位、无需下载的（内联图）

    # ---------- 阶段一：翻页收集 ----------

    def _emit(self, event: str, payload=None) -> None:
        self.on_event(event, payload)

    def _add_resource(self, res: Resource) -> None:
        if res.url in self._seen_resources:
            return
        if res.kind not in self.cfg.kinds:
            return
        self._seen_resources.add(res.url)
        self._pending.append(res)

    def _crawl_pages(self, start_url: str, report: Report) -> None:
        from collections import deque

        queue: deque[tuple[str, int]] = deque([(normalize_page_url(start_url), 0)])
        self._seen_pages.add(normalize_page_url(start_url))
        self._pending = []
        self._done = []

        while queue and len(report.pages) < self.cfg.max_pages:
            url, depth = queue.popleft()
            record = PageRecord(url=url)

            # 流媒体清单不是 HTML，能取到就算成功，不参与页面解析
            if url_ext(url) in ("m3u8", "mpd"):
                record.status = 200
                report.pages.append(record)
                continue

            if not self.client.allowed(url):
                record.error = "robots.txt 不允许"
                report.pages.append(record)
                continue

            resp = self.client.fetch_bytes(url, referer=None, max_size=12 << 20)
            record.status = resp.status
            if not resp.ok or not resp.content:
                record.error = resp.error or f"HTTP {resp.status}"
                report.pages.append(record)
                self._emit("page", record)
                continue

            ctype = (resp.content_type or "").lower()
            if "html" not in ctype and "xml" not in ctype:
                # 入口不是 HTML（比如直接给了一张图），就把它本身当资源
                record.error = "非 HTML 页面"
                report.pages.append(record)
                if "xml" in ctype or "text" in ctype:
                    self._harvest_text(resp.content.decode("utf-8", "ignore"), url)
                self._emit("page", record)
                continue

            html = resp.content.decode("utf-8", "ignore")
            extraction = extract_html(
                html, resp.final_url or url,
                scan_scripts=self.cfg.scan_scripts,
                follow_iframes=self.cfg.follow_iframes,
            )

            for res in extraction.resources:
                self._add_resource(res)
            record.found = len(extraction.resources)

            # data: URI 里的内联图：不进下载队列，直接落盘算完成
            for kind, uri in extraction.data_uris:
                kind = kind or "image"
                # 内联图也要过一遍类型过滤，否则 --kind video 会混进图片
                if kind not in self.cfg.kinds:
                    continue
                data, ext = decode_data_uri(uri)
                # 和下载的资源保持同一套大小门槛
                if data and len(data) >= self.cfg.min_size:
                    path = self.store.write_data_uri(kind, data, ext)
                    path.write_bytes(data)
                    inline = Resource(url=uri[:64] + "...", kind=kind,
                                      source=url, path=self.store.relative(path),
                                      status=200, size=len(data))
                    inline.extra["inline"] = True
                    self._done.append(inline)
                    self._emit("resource", inline)

            # CSS 文件里的背景图和字体
            if self.cfg.parse_css:
                for css_url in extraction.css_urls:
                    if css_url in self._seen_css:
                        continue
                    self._seen_css.add(css_url)
                    self._harvest_css(css_url, url)

            # iframe 里的播放器页面
            for iframe_url in extraction.iframe_urls:
                if self.cfg.follow_iframes:
                    extraction.page_links.append(iframe_url)

            # 继续翻页。depth=1 表示只抓入口页，所以下一层必须 < depth 才进队
            if depth + 1 < self.cfg.depth:
                for link in extraction.page_links:
                    norm = normalize_page_url(link)
                    if norm in self._seen_pages:
                        continue
                    if self.cfg.same_domain and not same_site(
                            start_url, norm, self.cfg.include_subdomains):
                        continue
                    if url_ext(norm) in ("", "html", "htm", "php", "asp", "aspx",
                                         "jsp", "xml") or not url_ext(norm):
                        self._seen_pages.add(norm)
                        queue.append((norm, depth + 1))

            report.pages.append(record)
            self._emit("page", record)

    def _harvest_css(self, css_url: str, source: str) -> None:
        """解析一个 CSS 文件，把里面的图片/字体登记为资源。"""
        resp = self.client.fetch_bytes(css_url, referer=source, max_size=8 << 20)
        if not resp.ok or not resp.content:
            return
        text = resp.content.decode("utf-8", "ignore")
        for raw in extract_css_urls(text):
            from urllib.parse import urljoin
            absolute = urljoin(css_url, raw)
            kind = guess_kind(absolute)
            if kind not in ("image", "font", "video", "audio"):
                continue
            self._add_resource(Resource(url=absolute, kind=kind, source=css_url,
                                        referer=css_url))

    def _harvest_text(self, text: str, source: str) -> None:
        """从任意文本（如 XML sitemap、直接给的图片页）里捞资源地址。"""
        from urllib.parse import urljoin
        for url, kind in scan_text_urls(text):
            self._add_resource(Resource(url=urljoin(source, url), kind=kind or "other",
                                        source=source, referer=source))

    # ---------- 阶段二：并发下载 ----------

    def _download_one(self, res: Resource) -> Resource:
        if res.kind == "stream":
            return self._download_stream(res)
        return self._download_file(res)

    def _download_stream(self, res: Resource) -> Resource:
        if url_ext(res.url) == "mpd" or "dash+xml" in res.content_type:
            res.error = "DASH(mpd) 暂不支持，可改用 ffmpeg 或 N_m3u8DL"
            return res

        from .store import safe_filename
        stem = safe_filename(Path(urlparse(res.url).path).stem or "stream")
        dest = self.store.dir_for("video")

        def progress(done: int, total: int) -> None:
            self._emit("hls", {"url": res.url, "done": done, "total": total,
                               "name": stem})

        try:
            result = download_hls(
                self.client, res.url, dest, stem,
                referer=res.referer, prefer=self.cfg.hls_prefer,
                workers=min(8, max(2, self.cfg.workers)),
                use_ffmpeg=self.cfg.use_ffmpeg, progress=progress,
            )
        except Exception as exc:
            res.error = f"HLS 下载异常：{type(exc).__name__}: {exc}"
            return res

        res.status = 200 if result.ok else 0
        res.error = result.error
        if result.path:
            path = Path(result.path)
            res.kind = "video"
            res.path = self.store.relative(path)
            res.size = path.stat().st_size if path.exists() else 0
            res.extra.update({
                "segments": result.segments,
                "duration": round(result.duration, 2),
                "resolution": result.resolution,
                "bandwidth": result.bandwidth,
                "encrypted": result.encrypted,
                "merge": result.method,
            })
        return res

    def _download_file(self, res: Resource) -> Resource:
        path = self.store.plan(res.kind, res.url)
        result = self.client.download(res.url, path, referer=res.referer,
                                      resume=self.cfg.resume)
        res.status = result.status
        res.error = result.error
        if result.content_type:
            res.content_type = result.content_type
        if not path.exists() or not result.ok:
            if path.exists() and not result.ok:
                path.unlink(missing_ok=True)
            return res

        size = path.stat().st_size
        # 下载前拿不到大小时，这里做一次上限检查
        if self.cfg.max_size and size > self.cfg.max_size:
            path.unlink(missing_ok=True)
            res.error = f"超过 max_size({self.cfg.max_size})"
            return res
        if size < self.cfg.min_size:
            path.unlink(missing_ok=True)
            res.error = f"小于 min_size({self.cfg.min_size})，已丢弃"
            return res

        # .ts 既可能是视频分片，也可能是 TypeScript 源码。
        # 下载后按内容定夺，不是视频就丢掉，避免抓一堆源码回来。
        if url_ext(res.url) in AMBIGUOUS_VIDEO_EXT:
            with path.open("rb") as fh:
                head = fh.read(TS_PACKET_SIZE + 1)
            resolved = resolve_ambiguous_kind(res.url, head, res.kind)
            if resolved != "video":
                path.unlink(missing_ok=True)
                res.error = "内容是源码文本而非视频流（.ts 被判定为 TypeScript），已丢弃"
                return res

        # Content-Type 说的类型和 URL 扩展名不一致时，纠正归类并挪目录
        refined = guess_kind(res.url, res.content_type)
        if refined != res.kind and refined != "other" and refined in self.cfg.kinds:
            new_path = self.store.plan(refined, res.url, res.content_type)
            new_path.parent.mkdir(parents=True, exist_ok=True)
            path.replace(new_path)
            res.kind = refined
            path = new_path
        elif refined not in self.cfg.kinds:
            path.unlink(missing_ok=True)
            res.error = f"类型 {refined} 不在抓取范围内"
            return res

        # 内容级去重：同一张图只留一份
        if size <= DEDUP_SIZE_LIMIT:
            data = path.read_bytes()
            duplicate = self.store.find_duplicate(data)
            if duplicate is not None and duplicate != path:
                path.unlink(missing_ok=True)
                res.path = self.store.relative(duplicate)
                res.size = size
                res.extra["duplicate"] = True
                return res
            self.store.remember(data, path)

        res.path = self.store.relative(path)
        res.size = size
        return res

    # ---------- 入口 ----------

    def run(self, start_url: str) -> Report:
        started = time.time()
        report = Report(start_url=start_url)

        self._crawl_pages(start_url, report)

        # 入口本身就是流媒体清单（用户直接给了个 m3u8），
        # 翻页阶段读到的是纯文本、识别不出资源，这里补登记一次
        if url_ext(start_url) in ("m3u8", "mpd"):
            self._add_resource(Resource(url=start_url, kind="stream",
                                        source=start_url, referer=start_url))

        pending = self._pending[:]
        if self.cfg.max_resources:
            pending = pending[:self.cfg.max_resources]
        # 内联图已经在翻页阶段落盘，这里只统计真正要下载的
        self._emit("download_start", len(pending) + len(self._done))
        report.resources.extend(self._done)

        with ThreadPoolExecutor(max_workers=max(1, self.cfg.workers)) as pool:
            futures = [pool.submit(self._download_one, res) for res in pending]
            for future in as_completed(futures):
                try:
                    res = future.result()
                except Exception as exc:
                    res = Resource(url="", error=f"未捕获异常：{exc}")
                report.resources.append(res)
                self._emit("resource", res)

        report.elapsed = round(time.time() - started, 2)
        return report
