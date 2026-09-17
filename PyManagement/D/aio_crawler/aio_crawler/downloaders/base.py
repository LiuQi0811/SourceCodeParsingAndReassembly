# -*- coding: utf-8 -*-
"""下载器抽象基类与共享工具。"""
from __future__ import annotations

import asyncio
import logging
import os
from abc import ABC, abstractmethod
from pathlib import Path

import aiohttp

from ..config import Config
from ..models import DownloadResult, ResourceRef
from ..savers import TitleSaver

logger = logging.getLogger(__name__)


class BaseDownloader(ABC):
    """资源下载器基类。

    子类实现 download(ref, title) -> DownloadResult。
    共享 aiohttp.ClientSession 与重试 / 流式写盘工具。
    """

    name: str = "base"

    def __init__(self, cfg: Config, saver: TitleSaver, session: aiohttp.ClientSession) -> None:
        self.cfg = cfg
        self.saver = saver
        self.session = session
        self._dl_sem: asyncio.Semaphore | None = None

    # 由引擎注入下载并发信号量
    def set_semaphore(self, sem: asyncio.Semaphore) -> None:
        self._dl_sem = sem

    # ------------------------------------------------------------ 抓取
    async def _request(self, url: str, referer: str | None = None,
                       timeout: float | None = None) -> aiohttp.ClientResponse:
        """带重试的 GET 请求，返回响应对象（调用方负责释放）。"""
        headers = {"User-Agent": self.cfg.user_agent}
        if referer:
            headers["Referer"] = referer
        timeout = timeout or self.cfg.timeout
        last_err: Exception | None = None
        for attempt in range(self.cfg.retries + 1):
            try:
                resp = await self.session.get(
                    url, headers=headers,
                    timeout=aiohttp.ClientTimeout(total=timeout, connect=15),
                    allow_redirects=True,
                )
                if resp.status < 400:
                    return resp
                last_err = RuntimeError(f"HTTP {resp.status}")
                await resp.release()
            except (aiohttp.ClientError, asyncio.TimeoutError) as e:
                last_err = e
            if attempt < self.cfg.retries:
                await asyncio.sleep(0.5 * (attempt + 1))
        raise last_err or RuntimeError("request failed")

    async def _fetch_bytes(self, url: str, referer: str | None = None) -> tuple[bytes, str]:
        resp = await self._request(url, referer)
        try:
            body = await resp.read()
            return body, resp.headers.get("Content-Type", "")
        finally:
            await resp.release()

    async def _fetch_text(self, url: str, referer: str | None = None) -> str:
        body, ct = await self._fetch_bytes(url, referer)
        from ..charset import decode
        text, _ = decode(body, ct)
        return text

    async def _stream_to(self, url: str, dest: Path, referer: str | None = None,
                         resume: int = 0) -> tuple[int, str]:
        """流式写盘，返回 (size, content_type)。已存在且不覆盖则跳过。"""
        if dest.exists() and dest.stat().st_size > 0 and not self.cfg.overwrite:
            return (dest.stat().st_size, "")
        resp = await self._request(url, referer)
        try:
            tmp = dest.with_suffix(dest.suffix + ".part")
            size = resume
            mode = "ab" if resume else "wb"
            with open(tmp, mode) as f:
                async for chunk in resp.content.iter_chunked(64 * 1024):
                    f.write(chunk)
                    size += len(chunk)
            tmp.replace(dest)
            return size, resp.headers.get("Content-Type", "")
        finally:
            await resp.release()

    # ------------------------------------------------------------ 结果
    def result(self, ref: ResourceRef, ok: bool, path: Path | None = None,
               size: int = 0, error: str = "", method: str = "") -> DownloadResult:
        rel = None
        if path is not None:
            try:
                rel = str(path.relative_to(self.saver.root))
            except ValueError:
                rel = str(path)
        return DownloadResult(
            url=ref.url, ok=ok, kind=ref.kind, group=ref.group,
            path=str(path) if path else None, rel_path=rel,
            size=size, error=error, method=method or self.name,
        )

    @abstractmethod
    async def download(self, ref: ResourceRef, title: str | None) -> DownloadResult:
        raise NotImplementedError


def run_ffmpeg_cmd(ffmpeg: str, args: list[str], timeout: float = 600) -> tuple[int, str]:
    """同步辅助（在线程中运行）。"""
    import subprocess
    flags = 0
    if os.name == "nt":
        flags = subprocess.CREATE_NO_WINDOW  # type: ignore[attr-defined]
    proc = subprocess.run(
        [ffmpeg, "-hide_banner", "-y", *args],
        capture_output=True, timeout=timeout, creationflags=flags,
    )
    return proc.returncode, (proc.stderr or b"").decode("utf-8", errors="replace")
