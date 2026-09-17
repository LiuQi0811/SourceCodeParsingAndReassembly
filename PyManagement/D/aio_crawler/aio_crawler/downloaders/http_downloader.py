# -*- coding: utf-8 -*-
"""HTTP 直链下载器（图片 / 文档 / 普通视频等）。"""
from __future__ import annotations

import logging
from pathlib import Path

from ..models import DownloadResult, ResourceRef
from .base import BaseDownloader

logger = logging.getLogger(__name__)


class HttpDownloader(BaseDownloader):
    """通用 HTTP(S) 资源下载：流式写盘，带重试。"""

    name = "http"

    async def download(self, ref: ResourceRef, title: str | None) -> DownloadResult:
        try:
            dest: Path = self.saver.resolve(title, ref.group, ref.ext or "bin")
            if dest.exists() and dest.stat().st_size > 0 and not self.cfg.overwrite:
                return self.result(ref, True, dest, dest.stat().st_size, method="http-skip")
            size, _ = await self._stream_to(ref.url, dest, ref.referer)
            return self.result(ref, True, dest, size, method="http")
        except Exception as e:
            logger.warning("http 下载失败 %s: %s", ref.url, e)
            return self.result(ref, False, error=str(e), method="http")
