# -*- coding: utf-8 -*-
"""通用 HTTP 资源下载器：图片/音频/文档/压缩包等"""
from __future__ import annotations

import logging
from pathlib import Path
from typing import Optional
from urllib.parse import urlsplit

import aiohttp

from ..resource.classifier import ResourceClassifier
from ..resource.storage import ResourceStorage
from .base import DownloadResult, ResourceDownloader

logger = logging.getLogger("crawler.download")


class HttpDownloader(ResourceDownloader):
    """通用 HTTP 下载：抓取完整字节 -> 分类器判定类型 -> 按标题目录分组保存"""

    name = "http"

    def __init__(
        self,
        fetcher,
        storage: ResourceStorage,
        classifier: Optional[ResourceClassifier] = None,
        task_ctx=None,
        alt_referer_on_403: bool = True,
    ) -> None:
        self.fetcher = fetcher
        self.storage = storage
        self.classifier = classifier or ResourceClassifier()
        self.task_ctx = task_ctx  # 任务上下文（用于 verify_ssl / auth / headers）
        self.alt_referer_on_403 = alt_referer_on_403  # 403 反盗链对抗：换资源源站 Referer 重试一次

    async def _fetch_once(self, url: str, referer: str, verify_ssl: bool, auth) -> Optional[object]:
        """单次抓取；返回 FetchResult；403 时可选换 Referer 重试一次"""
        try:
            return await self.fetcher.fetch(
                url, binary=True, referer=referer, verify_ssl=verify_ssl, auth=auth, timeout=120,
            )
        except aiohttp.ClientResponseError as exc:
            if (
                self.alt_referer_on_403 and exc.status == 403 and referer
                and urlsplit(url).scheme in ("http", "https")
            ):
                alt = f"{urlsplit(url).scheme}://{urlsplit(url).netloc}/"
                logger.debug("403 反盗链：换 Referer=%s 重试 %s", alt, url)
                try:
                    return await self.fetcher.fetch(
                        url, binary=True, referer=alt, verify_ssl=verify_ssl, auth=auth, timeout=120,
                    )
                except Exception:
                    pass  # 重试仍失败，返回原始 403 错误
            raise

    async def download(self, job) -> DownloadResult:
        url, task_id, referer = job.url, job.task_id, job.referer
        task = self.task_ctx.get(task_id) if self.task_ctx else None
        verify_ssl = task.verify_ssl if task else True
        auth = task.auth if task else None

        try:
            result = await self._fetch_once(url, referer, verify_ssl, auth)
        except Exception as exc:
            logger.debug("资源下载失败 %s: %s", url, exc)
            # 4xx 为确定性失败，不重试直接终态；网络/5xx 可重试
            retriable = True
            if isinstance(exc, aiohttp.ClientResponseError) and 400 <= exc.status < 500:
                retriable = False
            return DownloadResult(ok=False, bytes=0, note=str(exc)[:300], retriable=retriable)

        raw = result.raw
        if not raw:
            return DownloadResult(ok=False, note="空响应体")

        # 自动识别资源类型（magic bytes 优先，其次 Content-Type / 扩展名）
        rtype = self.classifier.classify(url=url, content_type=result.content_type, raw=raw)
        title = task.title if task else ""
        try:
            path = self.storage.save_bytes(
                task_id, rtype, raw, url=url, title=title,
                content_type=result.content_type,
            )
        except Exception as exc:
            logger.exception("资源保存失败 %s", url)
            return DownloadResult(ok=False, note=f"保存失败: {exc}")

        return DownloadResult(
            ok=True, path=path, bytes=len(raw),
            note=f"type={rtype} size={len(raw)}", resource_type=rtype,
        )
