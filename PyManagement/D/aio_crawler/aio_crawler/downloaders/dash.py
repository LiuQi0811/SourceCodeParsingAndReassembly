# -*- coding: utf-8 -*-
"""DASH(.mpd) 下载与合并。

支持：
- SegmentList（Initialization + SegmentURL）
- SegmentTemplate（$Number$ / $Time$ / $RepresentationID$，配合时长或 SegmentTimeline）
- 自动选择最高码率视频轨 / 音频轨，下载后 ffmpeg 混流 mp4
"""
from __future__ import annotations

import asyncio
import logging
import math
import re
import tempfile
from pathlib import Path
from urllib.parse import urlsplit, urlunsplit

from lxml import etree

from ..models import DownloadResult, ResourceRef
from ..urlutils import urljoin
from .base import BaseDownloader
from .merger import ffmpeg_available, mux_av, remux

logger = logging.getLogger(__name__)

_MPD_NS = "{urn:mpeg:dash:schema:mpd:2011}"
_DUR_RE = re.compile(r"P(?:(\d+)D)?T(?:(\d+)H)?(?:(\d+)M)?(?:([\d.]+)S)?")


def _parse_iso8601(dur: str) -> float:
    m = _DUR_RE.match(dur or "")
    if not m:
        return 0.0
    d, h, mi, s = m.groups()
    return (int(d or 0) * 86400 + int(h or 0) * 3600 +
            int(mi or 0) * 60 + float(s or 0))


def _strip_ns(tag: str) -> str:
    return tag.rsplit("}", 1)[-1]


class DashDownloader(BaseDownloader):
    """DASH 下载器。"""

    name = "dash"

    # ------------------------------------------------------------ 解析
    def _parse_mpd(self, text: str, base_url: str):
        """解析 mpd -> (video_parts, audio_parts, video_ext)。"""
        root = etree.fromstring(text.encode("utf-8", errors="replace"))
        total_dur = 0.0
        pdur = root.get("mediaPresentationDuration") or root.get("minBufferTime")
        total_dur = _parse_iso8601(pdur)

        video: tuple | None = None
        audio: tuple | None = None

        self._dur_hint = total_dur
        for period in root.iter(_MPD_NS + "Period"):
            p_dur = _parse_iso8601(period.get("duration") or "")
            if p_dur:
                total_dur = p_dur
                self._dur_hint = total_dur
            for aset in period.iter(_MPD_NS + "AdaptationSet"):
                is_audio = False
                is_video = False
                ct = (aset.get("contentType") or "").lower()
                mt = (aset.get("mimeType") or "").lower()
                if ct == "audio" or "audio" in mt:
                    is_audio = True
                elif ct == "video" or "video" in mt:
                    is_video = True
                for rep in aset.iter(_MPD_NS + "Representation"):
                    rid = rep.get("id") or ""
                    bw = int(rep.get("bandwidth") or 0)
                    init, segs = self._extract_segments(rep, base_url, rid)
                    if not segs:
                        continue
                    info = (rid, bw, init, segs, total_dur)
                    if is_audio or (rep.find(_MPD_NS + "AudioChannelConfiguration") is not None):
                        if audio is None or bw > audio[1]:
                            audio = info
                    else:
                        if video is None or bw > video[1]:
                            video = info
        return video, audio

    def _extract_segments(self, rep, base_url: str, rid: str) -> tuple[str | None, list[str]]:
        """提取 (initialization_url, [segment_urls])。"""
        init: str | None = None
        segs: list[str] = []

        def _res(url: str) -> str:
            return urljoin(base_url, url) if url else url

        def _sub(tpl: str, number: int | None = None, t: int | None = None) -> str:
            s = tpl
            s = s.replace("$RepresentationID$", rid or "")
            if number is not None:
                # $Number%05d$ 带宽度
                m = re.search(r"\$Number%0?(\d*)d\$", s)
                if m:
                    width = int(m.group(1) or 0)
                    s = re.sub(r"\$Number%0?\d*d\$", f"{number:0{width}d}", s)
                s = s.replace("$Number$", str(number))
            if t is not None:
                s = s.replace("$Time$", str(t))
            return s

        for sl in rep.iter(_MPD_NS + "SegmentList"):
            ini = sl.find(_MPD_NS + "Initialization")
            if ini is not None and ini.get("sourceURL"):
                init = _res(ini.get("sourceURL"))
            for su in sl.findall(_MPD_NS + "SegmentURL"):
                media = su.get("media")
                if media:
                    segs.append(_res(media))
            if segs:
                return init, segs

        # SegmentTemplate
        st = rep.find(_MPD_NS + "SegmentTemplate")
        if st is not None:
            media_tpl = st.get("media")
            if not media_tpl:
                return None, []
            init_tpl = st.get("initialization")
            if init_tpl:
                init = _res(_sub(init_tpl))
            start = int(st.get("startNumber") or 1)
            seg_dur = float(st.get("duration") or 0)

            times: list[int] = []
            timeline = st.find(_MPD_NS + "SegmentTimeline")
            if timeline is not None:
                cur = 0
                for s_el in timeline.iter(_MPD_NS + "S"):
                    t = int(s_el.get("t") or cur)
                    d = int(s_el.get("d") or 0)
                    r = int(s_el.get("r") or 0)
                    for k in range(r + 1):
                        times.append(t + k * d)
                    cur = t + (r + 1) * d
                segs = [_res(_sub(media_tpl, number=start + i, t=times[i]))
                        for i in range(len(times))]
                return init, segs

            if seg_dur > 0 and self._total_dur_hint > 0:
                n = max(1, math.ceil(self._total_dur_hint / seg_dur))
                segs = [_res(_sub(media_tpl, number=start + i)) for i in range(n)]
                return init, segs

            # 无法确定分片数
            return init, []

        return init, segs

    @property
    def _total_dur_hint(self) -> float:
        return getattr(self, "_dur_hint", 0.0)

    # ------------------------------------------------------------ 主流程
    async def download(self, ref: ResourceRef, title: str | None) -> DownloadResult:
        mpd_url = ref.url
        referer = ref.referer
        try:
            text = await self._fetch_text(mpd_url, referer)
            self._dur_hint = 0.0
            video, audio = self._parse_mpd(text, mpd_url)
            if video is None:
                raise RuntimeError("MPD 中未找到可用视频轨")
            return await self._merge(ref, title, video, audio, mpd_url)
        except etree.XMLSyntaxError as e:
            logger.warning("MPD 解析失败 %s: %s", ref.url, e)
            return await self._ffmpeg_fallback(ref, title, mpd_url)
        except Exception as e:
            logger.warning("DASH 下载失败 %s: %s", ref.url, e)
            return self.result(ref, False, error=str(e), method="dash")

    async def _merge(self, ref: ResourceRef, title: str | None, video, audio,
                     mpd_url: str) -> DownloadResult:
        if audio is not None and not ffmpeg_available(self.cfg.ffmpeg_path):
            raise RuntimeError("含音频轨的 DASH 需要 ffmpeg 混流")
        ext = "mp4" if ffmpeg_available(self.cfg.ffmpeg_path) else "mp4"
        dest: Path = self.saver.resolve(title, ref.group, ext)
        if dest.exists() and dest.stat().st_size > 0 and not self.cfg.overwrite:
            return self.result(ref, True, dest, dest.stat().st_size, method="dash-skip")

        sem = self._dl_sem or asyncio.Semaphore(self.cfg.merge_concurrency)
        tmp_dir = Path(tempfile.mkdtemp(prefix="dash_"))
        try:
            async def dl_track(prefix: str, init_url, segs):
                parts: list[Path] = []
                if init_url:
                    p = tmp_dir / f"{prefix}_init"
                    await self._stream_to(init_url, p, ref.referer)
                    parts.append(p)

                async def grab(i: int, u: str) -> Path:
                    p = tmp_dir / f"{prefix}_{i:06d}"
                    async with sem:
                        await self._stream_to(u, p, ref.referer)
                    return p

                res = await asyncio.gather(*(grab(i, u) for i, u in enumerate(segs)), return_exceptions=True)
                for r in res:
                    if isinstance(r, BaseException):
                        raise RuntimeError(f"DASH 分片下载失败: {r}")
                    parts.append(r)
                out = tmp_dir / f"{prefix}_track.bin"
                with open(out, "wb") as f:
                    for p in parts:
                        if p.exists() and p.stat().st_size > 0:
                            f.write(p.read_bytes())
                return out

            vfile = await dl_track("v", video[2], video[3])
            afile = None
            if audio is not None:
                afile = await dl_track("a", audio[2], audio[3])

            if afile is not None and afile.stat().st_size > 0:
                ok, err = await mux_av(vfile, afile, dest, self.cfg.ffmpeg_path)
                if not ok:
                    raise RuntimeError(f"ffmpeg 混流失败: {err[-500:]}")
            else:
                ok, err = await remux(vfile, dest, self.cfg.ffmpeg_path)
                if not ok:
                    raise RuntimeError(f"ffmpeg 转封装失败: {err[-500:]}")
            return self.result(ref, True, dest, dest.stat().st_size, method="dash-merge")
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

    async def _ffmpeg_fallback(self, ref: ResourceRef, title: str | None, mpd_url: str) -> DownloadResult:
        if not ffmpeg_available(self.cfg.ffmpeg_path):
            return self.result(ref, False, error="MPD 解析失败且无 ffmpeg", method="dash")
        from .merger import ffmpeg_run
        dest: Path = self.saver.resolve(title, ref.group, "mp4")
        headers = f"User-Agent: {self.cfg.user_agent}\r\n"
        if ref.referer:
            headers += f"Referer: {ref.referer}\r\n"
        code, err = await ffmpeg_run(
            self.cfg.ffmpeg_path,
            ["-headers", headers, "-i", mpd_url, "-c", "copy", "-movflags", "+faststart", str(dest)],
            timeout=self.cfg.timeout * 10,
        )
        if code != 0 or not dest.exists() or dest.stat().st_size == 0:
            return self.result(ref, False, error=err[-500:], method="dash-ffmpeg")
        return self.result(ref, True, dest, dest.stat().st_size, method="dash-ffmpeg")
