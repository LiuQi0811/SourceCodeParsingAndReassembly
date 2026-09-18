# -*- coding: utf-8 -*-
"""
HLS (m3u8) 下载与合并
  - 支持 master playlist（自动选择最高码率）与 media playlist
  - 并行下载 TS 分片，二进制拼接为 .ts，再经 ffmpeg 快速转封装为 .mp4（无 ffmpeg 时保留 .ts）
  - 支持 EXT-X-KEY AES-128 加密（pycryptodome 可用时纯 Python 解密；否则交给 ffmpeg 原生处理）
  - 支持 EXT-X-BYTERANGE（交给 ffmpeg）
"""
from __future__ import annotations

import asyncio
import logging
import re
import shutil
from pathlib import Path
from typing import Dict, List, Optional, Tuple
from urllib.parse import urljoin

from ..net.fetcher import AsyncFetcher
from .base import VideoMergeError, VideoMerger
from .ffmpeg_utils import concat_by_ffmpeg, ffprobe_duration, ffprobe_available, remux_to_mp4

logger = logging.getLogger("crawler.video.hls")

try:
    from Crypto.Cipher import AES as _AES

    _HAS_CRYPTO = True
except Exception:
    _HAS_CRYPTO = False

_SEGMENT_RE = re.compile(r"^#EXTINF:\s*([\d.]+)")
_KEY_RE = re.compile(r'#EXT-X-KEY:METHOD=([^,]+)(?:,URI="([^"]+)")?(?:,IV=0x([0-9A-Fa-f]+))?')
_STREAM_RE = re.compile(r"#EXT-X-STREAM-INF:[^\n]*BANDWIDTH=(\d+)[^\n]*\n\s*(\S+)")


def _resolve(url: str, base: str) -> str:
    return urljoin(base, url)


class HLSMerger(VideoMerger):
    protocol = "hls"

    def __init__(self, fetcher, task_ctx, storage, event_bus=None, ffmpeg_sem=None,
                 segment_concurrency: int = 8) -> None:
        super().__init__(fetcher, task_ctx, storage, event_bus)
        self.segment_concurrency = segment_concurrency
        self._ffmpeg_sem = ffmpeg_sem

    async def _fetch_playlist(self, url: str, task) -> Tuple[str, str]:
        """抓取 m3u8 文本，返回 (text, final_url)"""
        result = await self.fetcher.fetch(
            url, binary=False, referer=task.referer if task else "",
            verify_ssl=task.verify_ssl if task else True,
            auth=task.auth if task else None, timeout=60,
        )
        text = result.as_text()
        if "#EXTM3U" not in text:
            raise VideoMergeError(f"不是有效的 m3u8 内容: {url}")
        return text, result.final_url or url

    def _pick_variant(self, text: str, base_url: str) -> Optional[str]:
        """master playlist：选择最高 BANDWIDTH 的变体"""
        variants: List[Tuple[int, str]] = []
        for m in _STREAM_RE.finditer(text):
            variants.append((int(m.group(1)), _resolve(m.group(2).strip(), base_url)))
        if not variants:
            return None
        variants.sort(key=lambda x: x[0], reverse=True)
        return variants[0][1]

    def _parse_segments(self, text: str, base_url: str) -> Tuple[List[str], List[Dict]]:
        """解析媒体分片与密钥。返回 (segment_urls, keys)"""
        segments: List[str] = []
        keys: List[Dict] = []
        pending_key: Optional[Dict] = None
        for line in text.splitlines():
            line = line.strip()
            if not line:
                continue
            if line.startswith("#"):
                if line.startswith("#EXT-X-KEY"):
                    m = _KEY_RE.search(line)
                    if m:
                        method = m.group(1)
                        uri = m.group(2)
                        iv = m.group(3)
                        pending_key = {
                            "method": method.upper(),
                            "uri": _resolve(uri, base_url) if uri else "",
                            "iv": iv,
                        }
                elif line.startswith("#EXT-X-BYTERANGE"):
                    raise VideoMergeError("含 EXT-X-BYTERANGE，需交给 ffmpeg 处理（本模块将自动回退）")
                continue
            # 分片 URI 行
            segments.append(_resolve(line, base_url))
            keys.append(dict(pending_key) if pending_key else {})
        return segments, keys

    async def _download_segment(self, url: str, path: Path, task, sem: asyncio.Semaphore) -> int:
        # 合并失败重试：已下载分片（非空）直接复用，不再请求
        if path.exists() and path.stat().st_size > 0:
            return path.stat().st_size
        async with sem:
            n, _ = await self.fetcher.stream_to_file(
                url, str(path), referer=task.referer if task else "",
                verify_ssl=task.verify_ssl if task else True,
                auth=task.auth if task else None, timeout=120,
            )
            return n

    def _decrypt_segment(self, data: bytes, key: Dict) -> bytes:
        if not key or key.get("method", "NONE") != "AES-128":
            return data
        if not _HAS_CRYPTO:
            raise VideoMergeError("AES-128 加密分片需要 pycryptodome 或 ffmpeg（当前均不可用）")
        key_data = Path(key["uri"]).read_bytes() if key["uri"].startswith(("file:", "file://")) else None
        # 密钥字节：由调用方预取（见 download）
        iv = bytes.fromhex(key["iv"][2:]) if key.get("iv") else None
        cipher = _AES.new(self._key_bytes, _AES.MODE_CBC, iv=iv or (b"\x00" * 16))
        dec = cipher.decrypt(data)
        pad = dec[-1]
        return dec[:-pad] if 1 <= pad <= 16 else dec

    async def download(self, url: str, dest_dir: Path, filename: str, job) -> Path:
        task = self.task_ctx.get(job.task_id) if self.task_ctx else None
        dest_dir.mkdir(parents=True, exist_ok=True)
        tmp = dest_dir / f".{filename}.parts"
        tmp.mkdir(parents=True, exist_ok=True)
        ok = False

        try:
            playlist_text, playlist_url = await self._fetch_playlist(url, task)
            variant = self._pick_variant(playlist_text, playlist_url)
            if variant:
                self._emit("video_merge_info", job.task_id, url, f"master playlist，选择变体 {variant}")
                playlist_text, playlist_url = await self._fetch_playlist(variant, task)

            try:
                segments, keys = self._parse_segments(playlist_text, playlist_url)
            except VideoMergeError:
                # BYTERANGE 等复杂场景：整体交给 ffmpeg 拉流合并
                logger.info("复杂 HLS，改用 ffmpeg 直接合并")
                shutil.rmtree(tmp, ignore_errors=True)
                return await self._ffmpeg_download(url, dest_dir, filename, job, task)

            if not segments:
                raise VideoMergeError("m3u8 中未解析到任何分片")

            # 预取 AES-128 密钥
            self._key_bytes: bytes = b""
            for k in keys:
                if k.get("method") == "AES-128" and k.get("uri"):
                    if not _HAS_CRYPTO:
                        raise VideoMergeError("AES-128 加密分片需要 pycryptodome（pip install pycryptodome）")
                    kres = await self.fetcher.fetch(k["uri"], binary=True, referer=url, timeout=60)
                    self._key_bytes = kres.raw
                    break

            sem = asyncio.Semaphore(self.segment_concurrency)
            tasks = [
                asyncio.create_task(
                    self._download_segment(seg, tmp / f"seg_{i:06d}.ts", task, sem)
                )
                for i, seg in enumerate(segments)
            ]
            sizes = await asyncio.gather(*tasks, return_exceptions=True)
            errors = [e for e in sizes if isinstance(e, Exception)]
            if errors:
                raise VideoMergeError(f"分片下载失败: {errors[0]}")

            part_files = sorted(tmp.glob("seg_*.ts"))
            if not part_files:
                raise VideoMergeError("分片下载为空")

            # 合并：二进制拼接 TS -> .ts（AES-128 分片边读边解密，不改写源分片，保证重试可复用）
            ts_path = dest_dir / f"{filename}.ts"
            with open(ts_path, "wb") as out:
                for i, pf in enumerate(part_files):
                    data = pf.read_bytes()
                    if keys and i < len(keys) and keys[i].get("method") == "AES-128":
                        data = self._decrypt_segment(data, keys[i])
                    out.write(data)

            # 校验（ffprobe 可用时）
            duration = await ffprobe_duration(str(ts_path))
            if duration is None or duration <= 0:
                raise VideoMergeError("合并结果校验失败（ffprobe 无法识别）")

            # 转封装为 mp4（提高播放兼容性）
            if self._ffmpeg_sem:
                async with self._ffmpeg_sem:
                    if await remux_to_mp4(str(ts_path), str(dest_dir / f"{filename}.mp4")):
                        ts_path.unlink(missing_ok=True)
                        ok = True
                        return dest_dir / f"{filename}.mp4"
            else:
                if await remux_to_mp4(str(ts_path), str(dest_dir / f"{filename}.mp4")):
                    ts_path.unlink(missing_ok=True)
                    ok = True
                    return dest_dir / f"{filename}.mp4"
            ok = True
            return ts_path
        finally:
            # 仅成功时清理分片；失败保留供上层重试复用
            if ok:
                shutil.rmtree(tmp, ignore_errors=True)

    async def _ffmpeg_download(self, url: str, dest_dir: Path, filename: str, job, task) -> Path:
        """整体交给 ffmpeg：原生处理加密/byterange 的 HLS"""
        from .ffmpeg_utils import run_ffmpeg

        dest = dest_dir / f"{filename}.mp4"
        args = ["-i", url, "-c", "copy", "-movflags", "+faststart", str(dest)]
        if self._ffmpeg_sem:
            async with self._ffmpeg_sem:
                rc, _, err = await run_ffmpeg(args, timeout=1800)
        else:
            rc, _, err = await run_ffmpeg(args, timeout=1800)
        if rc != 0 or not dest.exists():
            raise VideoMergeError(f"ffmpeg HLS 合并失败: {err[-500:]}")
        return dest
