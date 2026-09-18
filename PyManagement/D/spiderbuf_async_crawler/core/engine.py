"""异步爬虫引擎：策略装配 + 并发 worker + 观察者事件流。

管线（单任务）：
  get(task) → [外部执行器 | fetch → parse] → 发布 URL 发现事件(入队)
            → 下载资源(分类目录/视频合并) → 保存数据 → complete/fail

设计模式落点：
- 策略模式：QueueStrategy / ParserStrategy / ExternalRunner
- 工厂模式：QueueFactory / ParserFactory / VideoDownloaderFactory / TaskFactory
- 观察者模式：EventBus（URL_DISCOVERED / TASK_* / RESOURCE_SAVED / VIDEO_MERGED / PROGRESS）
"""

from __future__ import annotations

import asyncio
import json
import logging
import os
import sys
import time
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import Any, Callable, Dict, List, Optional

from core import events as ev
from core.encoding import decode_bytes
from core.events import EventBus
from core.factories import ParserFactory, QueueFactory
from core.fetcher import Fetcher
from core.models import (
    CrawlStats, ParseResult, ResourceItem, ResourceKind, RetryableError,
    Task, TaskStatus,
)
from core.parsers.base import ParserStrategy
from core.queue.base import QueueStrategy
from core.resources import (
    build_resource_path, classify_resource, sanitize_filename, unique_path,
)
from core.video import VideoDownloaderFactory, detect_video_protocol

logger = logging.getLogger(__name__)

# 默认资源域名黑名单：广告/统计类第三方资源（输出噪音），命中则跳过下载
DEFAULT_BLOCK_RESOURCE_DOMAINS = {
    "pagead2.googlesyndication.com", "google-analytics.com",
    "googletagmanager.com", "doubleclick.net", "hm.baidu.com",
    "cnzz.com", "adsense.google.com", "googleadservices.com",
}


# ---------------------------------------------------------------- 外部执行器

@dataclass
class ExternalResult:
    ok: bool
    output: str = ""
    error: str = ""
    data: Dict[str, Any] = field(default_factory=dict)


class ExternalRunner(ABC):
    """外部执行器策略：处理需要浏览器/OCR/JS 的关卡。"""

    name: str = "base"

    @abstractmethod
    async def run(self, task: Task, fetcher: Fetcher) -> ExternalResult:
        ...


class ScriptExternalRunner(ExternalRunner):
    """调用外部 Python 脚本（子进程），收集 stdout 作为结果。

    用于复用现有 spiders/ 下的实测脚本（如 c04/c14 需 playwright+Edge、
    e02 需 OCR、h04 需 node）。

    - timeout: 超时秒数（可配置，不再硬编码 180）
    - log_dir: 非空时 stdout/stderr 完整落盘 <log_dir>/<标题>.log，
      返回给事件流的 output 只保留前 2000 字符
    """

    name = "script"

    def __init__(self, python: str = sys.executable,
                 timeout: float = 180.0,
                 log_dir: Optional[str] = None) -> None:
        self.python = python
        self.timeout = timeout
        self.log_dir = log_dir

    async def run(self, task: Task, fetcher: Fetcher) -> ExternalResult:
        if not task.external_script:
            return ExternalResult(False, error="未配置 external_script")
        # 支持按任务覆盖解释器（如 e02 需 Python 3.12）
        python = task.extra.get("python") or self.python
        cmd = [python, task.external_script]
        proc = await asyncio.create_subprocess_exec(
            *cmd, stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE, cwd=os.path.dirname(task.external_script))
        try:
            stdout, stderr = await asyncio.wait_for(
                proc.communicate(), timeout=self.timeout)
        except asyncio.TimeoutError:
            proc.kill()
            await proc.communicate()
            return ExternalResult(
                False, error=f"外部脚本超时(>{self.timeout:.0f}s): {task.external_script}")
        out = stdout.decode("utf-8", errors="replace")
        err = stderr.decode("utf-8", errors="replace")
        if self.log_dir:
            try:
                os.makedirs(self.log_dir, exist_ok=True)
                log_path = os.path.join(
                    self.log_dir, sanitize_filename(task.title or "external") + ".log")
                with open(log_path, "w", encoding="utf-8") as f:
                    f.write(f"# cmd: {' '.join(cmd)}\n# rc: {proc.returncode}\n\n")
                    if out:
                        f.write("--- stdout ---\n" + out + "\n")
                    if err:
                        f.write("--- stderr ---\n" + err + "\n")
            except OSError:  # noqa: BLE001
                logger.warning("外部脚本日志落盘失败: %s", task.title)
        return ExternalResult(ok=proc.returncode == 0,
                              output=out[:2000], error=err[:2000])


# ---------------------------------------------------------------- 引擎

class CrawlerEngine:
    """异步抓取引擎。"""

    def __init__(
        self,
        queue: Optional[QueueStrategy] = None,
        fetcher: Optional[Fetcher] = None,
        event_bus: Optional[EventBus] = None,
        parser_name: str = "bs4",
        parser_config: Optional[Dict[str, Any]] = None,
        workers: int = 8,
        output_root: str = "output",
        max_depth: int = 0,               # 0 = 只抓种子（不跟进链接）
        save_data: bool = True,
        custom_resource_types: Optional[Dict[str, str]] = None,  # 自定义资源类型
        external_runner: Optional[ExternalRunner] = None,
        headers: Optional[Dict[str, str]] = None,
        solver_registry: Optional[Dict[str, Callable[[Task, Fetcher], Any]]] = None,
        max_retries: int = 3,
        retry_backoff: float = 2.0,
        resource_domains: Optional[set] = None,
        resource_block_domains: Optional[set] = None,
        external_log_dir: Optional[str] = None,
    ) -> None:
        self.queue: QueueStrategy = queue or QueueFactory.create("memory")
        self.fetcher: Fetcher = fetcher or Fetcher(headers=headers)
        self.bus: EventBus = event_bus or EventBus()
        self.global_parser_name = parser_name
        self.global_parser_config = parser_config or {}
        self.workers = workers
        self.output_root = output_root
        self.max_depth = max_depth
        self.save_data = save_data
        self.custom_resource_types = {
            ext.lower().lstrip("."): kind for ext, kind in
            (custom_resource_types or {}).items()}
        self.external_runner: ExternalRunner = external_runner or ScriptExternalRunner(
            log_dir=external_log_dir or os.path.join(output_root, "external_logs"))
        self.solver_registry: Dict[str, Callable[[Task, Fetcher], Any]] = (
            solver_registry or {})
        self.max_retries = max_retries
        self.retry_backoff = retry_backoff
        # 资源下载过滤：白名单（仅限这些域名）优先；黑名单（广告/统计噪音）其次
        self.resource_domains = set(resource_domains) if resource_domains else None
        self.resource_block_domains = (
            set(resource_block_domains) if resource_block_domains is not None
            else set(DEFAULT_BLOCK_RESOURCE_DOMAINS))
        self._saved_resources: set = set()   # 已下载资源 URL 去重
        self.stats = CrawlStats()
        self._stop_event: Optional[asyncio.Event] = None
        self._video_factory: Optional[VideoDownloaderFactory] = None

        # 观察者：URL 发现 → 自动入队（深度受控）
        self.bus.subscribe(ev.URL_DISCOVERED, self._on_url_discovered)

    # ---------- 事件订阅 ----------

    def on(self, event_type: str, handler: Callable[[ev.Event], Any]) -> None:
        """外部订阅事件（如进度打印、日志）。"""
        self.bus.subscribe(event_type, handler)

    def _on_url_discovered(self, event: ev.Event) -> Any:
        """观察者回调：新 URL 入队（携带父任务上下文）。"""
        data = event.data
        parent: Task = data.get("parent")
        for url in data.get("links", []):
            child = Task(
                url=url,
                title=data.get("title") or (parent.title if parent else ""),
                depth=(parent.depth + 1) if parent else 1,
                headers=(parent.headers if parent else None),
                solver=(parent.solver if parent else None),
                priority=parent.priority if parent else 0,
                extra=dict(parent.extra) if parent else {},
            )
            asyncio.create_task(self._safe_put(child))

    async def _safe_put(self, task: Task) -> None:
        try:
            if await self.queue.put(task):
                self.stats.discovered_urls += 1
        except Exception:  # noqa: BLE001
            logger.exception("入队失败: %s", task.url)

    # ---------- 主流程 ----------

    async def run(self, seed_tasks: Optional[List[Task]] = None) -> CrawlStats:
        await self.fetcher.start()
        await self.queue.start()
        if seed_tasks:
            for t in seed_tasks:
                if await self.queue.put(t):
                    self.stats.discovered_urls += 1
        self._video_factory = VideoDownloaderFactory(
            self.fetcher.session, self.output_root, headers=self.fetcher.default_headers)

        workers = [asyncio.create_task(self._worker(i)) for i in range(self.workers)]
        progress = asyncio.create_task(self._progress_loop())
        self._stop_event = asyncio.Event()
        try:
            try:
                await asyncio.gather(*workers)
            except KeyboardInterrupt:
                # 优雅退出：完成当前任务后停止，未完成任务保留
                # （SQLite 队列 running 状态下次启动自动恢复为待爬）
                logger.warning("收到中断：完成当前任务后停止，未完成任务保留（可断点续爬）")
                self._stop_event.set()
                try:
                    await asyncio.wait_for(
                        asyncio.gather(*workers), timeout=10)
                except (asyncio.TimeoutError, asyncio.CancelledError):
                    for w in workers:
                        w.cancel()
        finally:
            progress.cancel()
            await self.queue.close()
            await self.fetcher.close()
        return self.stats

    def stop(self) -> None:
        """请求温和停止：worker 完成当前任务后退出（配合 KeyboardInterrupt）。"""
        if self._stop_event:
            self._stop_event.set()

    async def _worker(self, idx: int) -> None:
        while not self._stop_event.is_set():
            task = await self.queue.get()
            if task is None:
                break
            await self._process(task)

    async def _process(self, task: Task) -> None:
        start = time.time()
        await self.bus.publish_wait(ev.TASK_STARTED, {"task": task})

        # 外部执行器：失败即终结（环境依赖问题重试无意义），不进入重试循环
        if task.require_browser or task.external_script:
            try:
                result = await self._run_external(task)
            except Exception as exc:  # noqa: BLE001
                logger.warning("[worker] 外部任务异常 %s: %s", task.url, exc)
                self.stats.failed += 1
                await self.queue.fail(task.url, str(exc)[:2000])
                self._record_task(task, "failed", start, str(exc))
                return
            if result.ok:
                await self.queue.complete(task.url)
                self.stats.succeeded += 1
                self._record_task(task, "ok", start)
            else:
                self.stats.failed += 1
                await self.queue.fail(task.url, result.error[:2000])
                self._record_task(task, "failed", start, result.error)
            return

        # 框架抓取：可重试错误（限流/瞬时 5xx/网络/签名器）指数退避重试
        # 任务可通过 extra["max_retries"]/["retry_backoff"]/["pre_delay"] 覆盖全局参数
        pre_delay = float(task.extra.get("pre_delay", 0) or 0)
        if pre_delay > 0:
            # 限流关错峰：进 worker 先错开高峰（与重试配合提升全量成功率）
            await asyncio.sleep(pre_delay)
        max_retries = int(task.extra.get("max_retries", self.max_retries))
        retry_backoff = float(task.extra.get("retry_backoff", self.retry_backoff))
        last_err: Optional[Exception] = None
        for attempt in range(max_retries + 1):
            try:
                await self._crawl(task)
                await self.queue.complete(task.url)
                self.stats.succeeded += 1
                self._record_task(task, "ok", start)
                return
            except (RetryableError, RuntimeError) as exc:
                last_err = exc
                if attempt < max_retries:
                    wait = retry_backoff * (2 ** attempt)
                    logger.warning(
                        "[worker] %s 失败，%.0fs 后重试 %d/%d: %s",
                        task.url, wait, attempt + 1, max_retries, exc)
                    await asyncio.sleep(wait)
                else:
                    break
            except Exception as exc:  # noqa: BLE001 —— 编程错误/不可重试
                last_err = exc
                break

        self.stats.failed += 1
        await self.queue.fail(task.url, str(last_err)[:2000])
        self._record_task(task, "failed", start, str(last_err))
        await self.bus.publish_wait(ev.TASK_FAILED, {"task": task, "error": str(last_err)})

    def _record_task(self, task: Task, status: str, start: float, error: str = "") -> None:
        """运行成绩单：记录单任务状态/耗时/错误。"""
        self.stats.task_results.append({
            "title": task.title, "url": task.url, "status": status,
            "elapsed": round(time.time() - start, 1),
            "error": (error or "")[:200],
        })

    async def _run_external(self, task: Task) -> ExternalResult:
        result = await self.external_runner.run(task, self.fetcher)
        await self.bus.publish_wait(ev.TASK_COMPLETED, {
            "task": task, "external": True, "ok": result.ok, "output": result.output[:2000]})
        return result

    async def _crawl(self, task: Task) -> None:
        """单任务抓取管线。"""
        self.stats.fetched += 1
        parser = self._parser_for(task)

        fetch_kwargs: Dict[str, Any] = {"method": task.method}
        if task.headers:
            fetch_kwargs["headers"] = task.headers
        if task.data is not None:
            fetch_kwargs["data"] = task.data
        if task.json_body is not None:
            fetch_kwargs["json"] = task.json_body
        if task.charset:
            fetch_kwargs["force_encoding"] = task.charset
        if task.solver:
            fetch_kwargs["referer"] = "https://spiderbuf.cn/challenges"

        # 站点签名器（solver）：多步请求/签名后返回 FetchResult；返回 None 走默认抓取
        resp = None
        if task.solver and task.solver in self.solver_registry:
            resp = await self.solver_registry[task.solver](task, self.fetcher)
        if resp is None:
            resp = await self.fetcher.fetch(task.url, **fetch_kwargs)
        # 限流/5xx 已在 fetcher.fetch 内抛 RetryableError（状态码级重试统一在 fetcher）
        if resp.status >= 400:
            raise RuntimeError(f"HTTP {resp.status}")

        # 保存原 HTML（可选）
        if task.save_html:
            self._save_html(task, resp.text, resp.encoding)

        # JSON 响应直接结构化（绕过 HTML 解析）
        ctype = resp.headers.get("content-type", "").lower()
        stripped = resp.text.lstrip()
        if "application/json" in ctype or stripped.startswith(("{", "[")):
            try:
                result = ParseResult()
                result.data = {"json": json.loads(resp.text)}
                result.title = task.title
                result.encoding = resp.encoding
            except json.JSONDecodeError:
                result = parser.parse(resp.text, url=resp.final_url or task.url)
        else:
            result = parser.parse(resp.text, url=resp.final_url or task.url)
        result.encoding = resp.encoding
        title = task.title or result.title
        # 1) 跟进链接（深度受控）
        if self.max_depth > 0 and task.depth < self.max_depth:
            await self.bus.publish_wait(ev.URL_DISCOVERED, {
                "links": result.links, "parent": task, "title": title})

        # 2) 保存结构化数据
        if self.save_data and result.data:
            self._save_data(task, result.data, title)

        # 3) 数据校验（防"假成功"）：任务级 expect 配置，失败抛 ValueError（不重试）
        self._validate_result(task, result)

        # 4) 下载资源（分类目录 / 视频合并）
        if task.save_resources:
            await self._save_resources(task, result.resources, title, resp.final_url)

        await self.bus.publish_wait(ev.TASK_COMPLETED, {
            "task": task, "external": False, "title": title,
            "links": len(result.links), "resources": len(result.resources),
            "fields": list(result.data.keys())})

    def _parser_for(self, task: Task) -> ParserStrategy:
        name = task.parser or self.global_parser_name
        config = task.parser_config or self.global_parser_config
        return ParserFactory.create(name, config)

    # ---------- 数据校验（防假成功） ----------

    def _validate_result(self, task: Task, result: ParseResult) -> None:
        """任务级数据校验。

        - extra["expect"] = ["字段", ...]：data 必须含这些 key 且值非空
        - extra["expect"] = True 或 "data"（默认）：data 必须非空
        - extra["expect"] = False / None：跳过校验（纯资源/无数据任务）
        校验失败抛 ValueError（引擎不重试，立即判失败）。
        """
        expect = task.extra.get("expect", True)
        if expect is False or expect is None:
            return
        data = result.data
        if isinstance(expect, (list, tuple)):
            for f in expect:
                if f not in data or data[f] in (None, "", [], {}):
                    raise ValueError(f"任务数据校验失败: 缺少字段「{f}」")
        elif not data:
            raise ValueError("任务数据校验失败: data 为空")

    # ---------- 资源保存 ----------

    def _resource_allowed(self, task: Task, url: str) -> bool:
        """资源域名过滤：任务级白名单优先，否则引擎级黑名单。"""
        from urllib.parse import urlparse
        host = (urlparse(url).netloc or "").lower()

        def _match(domains: set) -> bool:
            return any(
                host == d or host.endswith("." + d.lstrip("."))
                for d in domains)

        allow = task.extra.get("resource_domains")
        if allow:
            return _match({str(d).lower() for d in allow})
        return not _match(self.resource_block_domains)

    async def _save_resources(self, task: Task, resources: List[ResourceItem],
                              title: str, referer: str) -> None:
        for item in resources:
            if item.url in self._saved_resources:
                continue
            if not self._resource_allowed(task, item.url):
                logger.debug("跳过资源(域名过滤) %s", item.url)
                continue
            try:
                protocol = detect_video_protocol(item.url)
                if protocol:
                    await self._download_video(item, task, title, protocol, referer)
                else:
                    await self._download_binary(item, task, title, referer)
                self._saved_resources.add(item.url)
            except NotImplementedError as exc:
                logger.warning("跳过资源 %s: %s", item.url, exc)
            except Exception as exc:  # noqa: BLE001
                logger.debug("资源下载失败 %s: %s", item.url, exc)

    async def _download_video(self, item: ResourceItem, task: Task,
                              title: str, protocol: str, referer: str) -> None:
        assert self._video_factory is not None
        downloader = self._video_factory.create(protocol)
        final = await downloader.download(item.url, title or task.title,
                                          referer=item.referer or referer)
        self.stats.saved_resources += 1
        self.stats.merged_videos += 1
        await self.bus.publish_wait(ev.VIDEO_MERGED, {
            "task": task, "url": item.url, "protocol": protocol, "path": final})

    async def _download_binary(self, item: ResourceItem, task: Task,
                               title: str, referer: str) -> None:
        raw, headers = await self.fetcher.download(item.url, referer=item.referer or referer)
        kind = classify_resource(
            item.url, headers.get("content-type", ""), raw,
            custom_map=self.custom_resource_types)
        ext = _guess_ext(item.url, headers.get("content-type", ""), kind)
        fname = sanitize_filename(item.name or "resource") + ext
        path = build_resource_path(self.output_root, title or task.title, kind, fname)
        path = unique_path(path)
        os.makedirs(os.path.dirname(path), exist_ok=True)
        with open(path, "wb") as f:
            f.write(raw)
        self.stats.saved_resources += 1
        await self.bus.publish_wait(ev.RESOURCE_SAVED, {
            "task": task, "url": item.url, "kind": kind.value, "path": path})

    # ---------- 数据 / HTML 保存 ----------

    def _save_data(self, task: Task, data: dict, title: str) -> None:
        title_dir = _safe(title or task.title)
        directory = os.path.join(self.output_root, title_dir, "data")
        os.makedirs(directory, exist_ok=True)
        fname = sanitize_filename(task.url.split("/")[-1] or "result") + ".json"
        path = unique_path(os.path.join(directory, fname))
        with open(path, "w", encoding="utf-8") as f:
            json.dump({"url": task.url, "data": data}, f,
                      ensure_ascii=False, indent=2)

    def _save_html(self, task: Task, text: str, encoding: str) -> None:
        title_dir = _safe(task.title)
        directory = os.path.join(self.output_root, title_dir, "pages")
        os.makedirs(directory, exist_ok=True)
        fname = sanitize_filename(task.url.split("/")[-1] or "page") + ".html"
        path = unique_path(os.path.join(directory, fname))
        with open(path, "w", encoding="utf-8") as f:
            f.write(text)

    # ---------- 进度 ----------

    async def _progress_loop(self) -> None:
        last: Optional[tuple] = None
        while True:
            await asyncio.sleep(1.0)
            snap = (
                await self.queue.pending_count(), self.stats.fetched,
                self.stats.succeeded, self.stats.failed,
                self.stats.saved_resources, self.stats.merged_videos)
            if snap == last:
                continue                     # 状态无变化，不发布（避免刷屏）
            last = snap
            await self.bus.publish_wait(ev.PROGRESS, {
                "pending": snap[0], "fetched": snap[1],
                "succeeded": snap[2], "failed": snap[3],
                "resources": snap[4], "videos": snap[5],
            })


def _safe(name: str) -> str:
    import re
    name = re.sub(r'[\\/:*?"<>|\x00-\x1f]', "_", str(name)).strip(" .")
    return name or "task"


def _guess_ext(url: str, content_type: str, kind: ResourceKind) -> str:
    """推断文件扩展名。"""
    import re
    path = url.split("?")[0]
    m = re.search(r"\.([a-zA-Z0-9]{1,5})$", path)
    if m and m.group(1).lower() not in {"html", "htm"}:
        return "." + m.group(1).lower()
    fallback = {
        ResourceKind.IMAGE: ".img", ResourceKind.VIDEO: ".bin",
        ResourceKind.AUDIO: ".bin", ResourceKind.DOC: ".txt",
        ResourceKind.ARCHIVE: ".bin", ResourceKind.CODE: ".txt",
        ResourceKind.DATA: ".dat", ResourceKind.PAGE: ".html",
        ResourceKind.OTHER: ".bin",
    }
    return fallback.get(kind, ".bin")
