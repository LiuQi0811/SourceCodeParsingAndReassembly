# -*- coding: utf-8 -*-
"""下载器工厂（工厂模式）：按资源类型 / URL 特征分派到具体下载器。"""
from __future__ import annotations

import aiohttp

from ..config import Config
from ..models import ResourceRef
from ..savers import TitleSaver
from ..urlutils import ext_of, scheme_of
from .base import BaseDownloader
from .dash import DashDownloader
from .flv import FlvDownloader
from .hls import HlsDownloader
from .http_downloader import HttpDownloader
from .live import LiveDownloader

_LIVE_SCHEMES = {"rtmp", "rtmps", "rtsp", "rtsps", "webrtc"}


class DownloaderFactory:
    """按资源 URL 特征创建下载器。"""

    def __init__(self, cfg: Config, saver: TitleSaver,
                 session: aiohttp.ClientSession, dl_sem) -> None:
        self.cfg = cfg
        self.saver = saver
        self.session = session
        self._dl_sem = dl_sem
        self._cache: dict[str, BaseDownloader] = {}

    def create(self, ref: ResourceRef) -> BaseDownloader:
        scheme = scheme_of(ref.url)
        ext = ext_of(ref.url).lower()

        if scheme in _LIVE_SCHEMES:
            dl: BaseDownloader = LiveDownloader(self.cfg, self.saver, self.session)
        elif ext == "m3u8":
            dl = HlsDownloader(self.cfg, self.saver, self.session)
        elif ext == "mpd":
            dl = DashDownloader(self.cfg, self.saver, self.session)
        elif ext == "flv" or ".flv" in ref.url.lower():
            dl = FlvDownloader(self.cfg, self.saver, self.session)
        else:
            dl = HttpDownloader(self.cfg, self.saver, self.session)

        dl.set_semaphore(self._dl_sem)
        return dl
