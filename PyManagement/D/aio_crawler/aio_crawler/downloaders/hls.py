# -*- coding: utf-8 -*-
"""HLS(m3u8) 下载与合并。

- 支持 master 播放列表（自动选择最高码率档位）
- 支持媒体播放列表分片并发下载、顺序合并
- 支持 fMP4(EXT-X-MAP) 分片
- 标准 AES-128 加密流按 HLS 公开规范交给 ffmpeg 处理（非 DRM 破解）
- 合并后可选 ffmpeg 转封装 mp4
"""
from __future__ import annotations

import asyncio
import logging
import re
import tempfile
from pathlib import Path

from ..models import DownloadResult, ResourceRef
from ..urlutils import urljoin
from .base import BaseDownloader
from .merger import ffmpeg_available, ffprobe_duration, remux

logger = logging.getLogger(__name__)

_EXTINF_RE = re.compile(r"#EXTINF:\s*([\d.]+)")
_KEY_RE = re.compile(r'#EXT-X-KEY:METHOD=([^,]+)(?:,URI="([^"]+)")?')
_MAP_RE = re.compile(r'#EXT-X-MAP:URI="([^"]+)"')
_STREAMINF_RE = re.compile(r"#EXT-X-STREAM-INF:[^\n]*BANDWIDTH=(\d+)")


class HlsDownloader(BaseDownloader):
    """HLS 下载器。"""

    name = "hls"

    def __init__(self, *a, **kw) -> None:
        super().__init__(*a, **kw)
        self._levels = 0

    # ------------------------------------------------------------ 解析
    def _parse_master(self, text: str, base_url: str) -> str | None:
        """解析 master 播放列表，返回最优媒体播放列表 URL。"""
        lines = text.splitlines()
        best: tuple[int, str] | None = None
        pending_bw: int | None = None
        for ln in lines:
            ln = ln.strip()
            m = _STREAMINF_RE.search(ln)
            if m:
                pending_bw = int(m.group(1))
                continue
            if ln and not ln.startswith("#") and pending_bw is not None:
                if best is None or pending_bw > best[0]:
                    best = (pending_bw, urljoin(base_url, ln))
                pending_bw = None
        return best[1] if best else None

    def _parse_media(self, text: str, base_url: str) -> tuple[list[str], str | None, bool]:
        """解析媒体播放列表 -> (segment_urls, init_url, encrypted)。"""
        segs: list[str] = []
        init_url: str | None = None
        encrypted = False
        pending = False
        for ln in text.splitlines():
            ln = ln.strip()
            if not ln:
                continue
            if ln.startswith("#"):
                if ln.startswith("#EXT-X-STREAM-INF"):
                    return [], None, False  # 误判，实为 master
                km = _KEY_RE.search(ln)
                if km:
                    method = km.group(1).upper()
                    if method != "NONE":
                        encrypted = True
                    continue
                mm = _MAP_RE.search(ln)
                if mm:
                    init_url = urljoin(base_url, mm.group(1))
                    continue
                if _EXTINF_RE.search(ln):
                    pending = True
                    continue
                continue
            # 非注释行：URI
            uri = urljoin(base_url, ln)
            segs.append(uri)
            pending = False
        return segs, init_url, encrypted

    # ------------------------------------------------------------ 主流程
    async def _fetch_playlist(self, url: str, referer: str | None) -> tuple[str, str]:
        text = await self._fetch_text(url, referer)
        return text, url

    async def download(self, ref: ResourceRef, title: str | None) -> DownloadResult:
        playlist_url = ref.url
        referer = ref.referer
        try:
            # 逐级解析 master -> media
            media_url = playlist_url
            for _ in range(4):
                text, _ = await self._fetch_playlist(media_url, referer)
                if "#EXT-X-STREAM-INF" in text:
                    nxt = self._parse_master(text, media_url)
                    if not nxt:
                        raise RuntimeError("master 播放列表无可用档位")
                    logger.debug("HLS 选择档位: %s", nxt)
                    media_url = nxt
                else:
                    break
            segs, init_url, encrypted = self._parse_media(text, media_url)

            if not segs:
                raise RuntimeError("媒体播放列表无分片")

            if encrypted:
                return await self._download_encrypted(ref, title, media_url)

            return await self._download_plain(ref, title, segs, init_url, media_url)
        except Exception as e:
            logger.warning("HLS 下载失败 %s: %s", ref.url, e)
            return self.result(ref, False, error=str(e), method="hls")

    # ------------------------------------------------------------ 明文分片
    async def _download_plain(self, ref: ResourceRef, title: str | None,
                              segs: list[str], init_url: str | None,
                              playlist_url: str) -> DownloadResult:
        ext = "mp4" if (self.cfg.remux and ffmpeg_available(self.cfg.ffmpeg_path)) else "ts"
        dest: Path = self.saver.resolve(title, ref.group, ext)
        if dest.exists() and dest.stat().st_size > 0 and not self.cfg.overwrite:
            return self.result(ref, True, dest, dest.stat().st_size, method="hls-skip")

        sem = self._dl_sem or asyncio.Semaphore(self.cfg.merge_concurrency)
        tmp_dir = Path(tempfile.mkdtemp(prefix="hls_"))
        try:
            parts: list[Path] = []
            if init_url:
                p = tmp_dir / "init.mp4"
                await self._stream_to(init_url, p, ref.referer)
                parts.append(p)

            async def grab(i: int, u: str) -> Path:
                p = tmp_dir / f"seg_{i:06d}.ts"
                async with sem:
                    await self._stream_to(u, p, ref.referer)
                return p

            results = await asyncio.gather(*(grab(i, u) for i, u in enumerate(segs)), return_exceptions=True)
            for r in results:
                if isinstance(r, BaseException):
                    raise RuntimeError(f"分片下载失败: {r}")
                parts.append(r)

            concat = tmp_dir / "concat.bin"
            with open(concat, "wb") as out:
                for p in parts:
                    if p.exists() and p.stat().st_size > 0:
                        out.write(p.read_bytes())

            if ext == "mp4":
                ok, err = await remux(concat, dest, self.cfg.ffmpeg_path)
                if not ok:
                    # 转封装失败：退化为 .ts
                    dest = self.saver.resolve(title, ref.group, "ts")
                    concat.replace(dest)
            else:
                concat.replace(dest)
            return self.result(ref, True, dest, dest.stat().st_size, method="hls-merge")
        finally:
            for p in tmp_dir.iterdir():
                try:
                    p.unlink()
                except OSError:
                    pass
            try:
                tmp_dir.rmdir()
            except OSError:
                pass

    # ------------------------------------------------------------ 标准 AES-128
    async def _download_encrypted(self, ref: ResourceRef, title: str | None,
                                  media_url: str) -> DownloadResult:
        """标准 AES-128 加密 HLS：按 HLS 公开规范交由 ffmpeg 解密合并。"""
        if not ffmpeg_available(self.cfg.ffmpeg_path):
            raise RuntimeError("AES-128 加密 HLS 需要 ffmpeg 支持")
        ext = "mp4"
        dest: Path = self.saver.resolve(title, ref.group, ext)
        headers = f"User-Agent: {self.cfg.user_agent}\r\n"
        if ref.referer:
            headers += f"Referer: {ref.referer}\r\n"
        from .merger import ffmpeg_run
        code, err = await ffmpeg_run(
            self.cfg.ffmpeg_path,
            ["-headers", headers, "-i", media_url, "-c", "copy", "-movflags", "+faststart", str(dest)],
            timeout=self.cfg.timeout * 10,
        )
        if code != 0 or not dest.exists() or dest.stat().st_size == 0:
            raise RuntimeError(f"ffmpeg 合并失败: {err[-500:]}")
        return self.result(ref, True, dest, dest.stat().st_size, method="hls-aes128")
