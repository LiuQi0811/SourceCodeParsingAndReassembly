"""视频资源下载与合并（功能 5 / 9）。

协议支持：
- HLS(m3u8)：master 自动选最高码率；分片并发下载；AES-128 加密分片自动解密；
  ffmpeg concat 合并为 mp4
- DASH(.mpd)：解析 SegmentTemplate/SegmentList/BaseURL；视频/音频分片下载；
  分别合并后 mux 为 mp4
- HTTP-FLV：直接下载 flv 文件
- RTMP / RTSP：调用本机 ffmpeg 拉流转封装 mp4（需要 ffmpeg）
- WebRTC：无法直接下载（无信令与数据通道协商），明确报错并给出替代方案

合并统一走本机 ffmpeg（-c copy 不转码，保真）。
"""

from __future__ import annotations

import asyncio
import logging
import os
import re
import shutil
import subprocess
from abc import ABC, abstractmethod
from typing import Any, Dict, List, Optional, Tuple
from urllib.parse import urljoin, urlparse

import aiohttp

logger = logging.getLogger(__name__)

try:
    from Crypto.Cipher import AES
    _HAS_AES = True
except ImportError:  # pragma: no cover
    AES = None
    _HAS_AES = False

# DASH 无 SegmentTimeline 时按 $Number$ 探测分片的上限（防死循环）
_MAX_PROBE_SEGMENTS = 500


class VideoMerger:
    """ffmpeg 合并工具。"""

    def __init__(self, ffmpeg: str = "ffmpeg") -> None:
        self.ffmpeg = ffmpeg

    async def concat_parts(self, part_paths: List[str], out_path: str) -> str:
        """按顺序 concat 合并独立完整分片（-c copy 无损，HLS ts 用）。"""
        list_file = out_path + ".list.txt"
        with open(list_file, "w", encoding="utf-8") as f:
            for p in part_paths:
                f.write(f"file '{p.replace(chr(39), chr(39)+chr(92)+chr(39)+chr(39))}'\n")
        cmd = [self.ffmpeg, "-y", "-f", "concat", "-safe", "0",
               "-i", list_file, "-c", "copy", out_path]
        await self._run(cmd)
        os.remove(list_file)
        return out_path

    async def concat_bytes(self, part_paths: List[str], out_path: str) -> str:
        """按字节顺序拼接分片（DASH 的 init+media 分片是同一 mp4 的字节切片）。

        不能用 concat demuxer：init 分片只有 moov 无媒体流，流级拼接会丢流。
        """
        os.makedirs(os.path.dirname(out_path) or ".", exist_ok=True)
        with open(out_path, "wb") as out:
            for p in part_paths:
                with open(p, "rb") as f:
                    shutil.copyfileobj(f, out)
        return out_path

    async def mux(self, video_path: str, audio_path: str, out_path: str) -> str:
        """视频轨 + 音频轨 mux（-c copy 无损）。"""
        cmd = [self.ffmpeg, "-y", "-i", video_path, "-i", audio_path,
               "-c", "copy", out_path]
        await self._run(cmd)
        return out_path

    async def pull_stream(self, url: str, out_path: str,
                          extra: Optional[List[str]] = None) -> str:
        """ffmpeg 拉流（RTMP/RTSP 等）转封装。"""
        cmd = [self.ffmpeg, "-y", "-i", url]
        if extra:
            cmd += extra
        cmd += ["-c", "copy", out_path]
        await self._run(cmd)
        return out_path

    async def _run(self, cmd: List[str]) -> None:
        proc = await asyncio.create_subprocess_exec(
            *cmd, stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.PIPE)
        _, stderr = await proc.communicate()
        if proc.returncode != 0:
            tail = stderr.decode("utf-8", errors="replace")[-1500:]
            raise RuntimeError(f"ffmpeg 执行失败: {' '.join(cmd[:6])}...\n{tail}")


class VideoDownloader(ABC):
    """视频下载策略抽象。"""

    protocol: str = "base"

    def __init__(self, session: aiohttp.ClientSession, out_root: str,
                 concurrency: int = 8, ffmpeg: str = "ffmpeg",
                 headers: Optional[Dict[str, str]] = None) -> None:
        self.session = session
        self.out_root = out_root
        self.concurrency = concurrency
        self.headers = headers or {}
        self.merger = VideoMerger(ffmpeg)
        self._sem = asyncio.Semaphore(concurrency)

    @abstractmethod
    async def download(self, url: str, title: str, referer: str = "") -> str:
        """下载并合并，返回最终文件路径。"""

    async def _fetch(self, url: str, *, range_header: Optional[str] = None) -> bytes:
        headers = dict(self.headers)
        if range_header:
            headers["Range"] = range_header
        async with self._sem:
            async with self.session.get(url, headers=headers, timeout=30) as resp:
                resp.raise_for_status()
                return await resp.read()

    async def _save(self, data: bytes, path: str) -> str:
        os.makedirs(os.path.dirname(path), exist_ok=True)
        with open(path, "wb") as f:
            f.write(data)
        return path


class HLSDownloader(VideoDownloader):
    """HLS(m3u8) 下载器：master 选流 + AES-128 解密 + 分片合并。

    细节补全：
    - 解析 EXT-X-MEDIA-SEQUENCE，无显式 IV 时按 RFC 8216 用
      (media_sequence + 分片序号) 推导 IV（大端 16 字节）
    - 支持分片级 EXT-X-KEY 切换（每个分片记录当前 key 状态）
    - EXT-X-KEY:IV=0x... 优先使用显式 IV；METHOD=NONE 清除加密
    """

    protocol = "hls"

    async def download(self, url: str, title: str, referer: str = "") -> str:
        if referer and "Referer" not in self.headers:
            self.headers["Referer"] = referer
        media_url = await self._resolve_master(url)
        segments = await self._parse_media(media_url)
        out_root = os.path.join(self.out_root, _safe(title))
        os.makedirs(out_root, exist_ok=True)

        # 预取全部 AES-128 key（数量少，串行即可），分片并发时直接查缓存
        key_cache: Dict[str, bytes] = {}
        key_urls = {
            urljoin(media_url, seg["key"]["uri"])
            for seg in segments
            if seg.get("key") and seg["key"].get("method") == "AES-128"
        }
        for ku in key_urls:
            key_cache[ku] = await self._fetch(ku)

        # 分片并发下载 + 解密 + 落盘（信号量限流，结果保序）
        sem = asyncio.Semaphore(self.concurrency)

        async def _dl(i: int, seg: Dict[str, Any]) -> str:
            async with sem:
                if "byterange" in seg:
                    length, offset = seg["byterange"]
                    raw = await self._fetch(
                        seg["url"], range_header=f"bytes={offset}-{offset + length - 1}")
                else:
                    raw = await self._fetch(seg["url"])
            key_info = seg.get("key")
            if key_info and key_info.get("method") == "AES-128":
                raw = self._decrypt_segment(
                    raw, key_cache[urljoin(media_url, key_info["uri"])],
                    key_info, seg["seq"])
            part_path = os.path.join(out_root, f"seg_{i:05d}.ts")
            with open(part_path, "wb") as f:
                f.write(raw)
            return part_path

        part_paths = list(await asyncio.gather(
            *(_dl(i, seg) for i, seg in enumerate(segments))))
        final = os.path.join(self.out_root, f"{_safe(title)}.mp4")
        await self.merger.concat_parts(part_paths, final)
        for p in part_paths:
            os.remove(p)
        return final

    async def _resolve_master(self, url: str) -> str:
        """解析 m3u8：若为 master playlist，选最高带宽变体，返回 media playlist URL。"""
        text = (await self._fetch(url)).decode("utf-8", errors="replace")
        if "#EXT-X-STREAM-INF" not in text and "#EXT-X-MEDIA:" not in text:
            return url
        best_url, best_bw = "", -1
        lines = text.splitlines()
        for i, line in enumerate(lines):
            if line.startswith("#EXT-X-STREAM-INF"):
                m = re.search(r"BANDWIDTH=(\d+)", line)
                bw = int(m.group(1)) if m else 0
                for j in range(i + 1, min(i + 4, len(lines))):
                    if not lines[j].startswith("#") and lines[j].strip():
                        if bw > best_bw:
                            best_bw, best_url = bw, urljoin(url, lines[j].strip())
                        break
        if not best_url:
            raise ValueError(f"m3u8 master 中未找到可用变体: {url}")
        return best_url

    async def _parse_media(self, url: str) -> List[Dict[str, Any]]:
        """解析 media playlist → 分片列表，每项 {url, key, seq[, byterange]}。

        - 跟踪 EXT-X-MEDIA-SEQUENCE 作为 IV 推导基准
        - 跟踪 EXT-X-KEY 状态（分片级 key 切换）
        - 支持 EXT-X-BYTERANGE（字节范围分片；offset 缺省时续上一分片末尾）
        """
        text = (await self._fetch(url)).decode("utf-8", errors="replace")
        media_sequence = 0
        current_key: Optional[Dict[str, Any]] = None
        pending_range: Optional[tuple] = None
        last_end: Optional[int] = None
        segments: List[Dict[str, Any]] = []
        index = 0
        for raw_line in text.splitlines():
            line = raw_line.strip()
            if not line:
                continue
            if line.startswith("#EXT-X-MEDIA-SEQUENCE:"):
                try:
                    media_sequence = int(line.split(":", 1)[1])
                except ValueError:
                    pass
            elif line.startswith("#EXT-X-KEY:"):
                current_key = self._parse_key(line)
            elif line.startswith("#EXT-X-BYTERANGE:"):
                spec = line.split(":", 1)[1]
                if "@" in spec:
                    length_s, offset_s = spec.split("@", 1)
                    length = int(length_s)
                    offset = int(offset_s)
                else:
                    length = int(spec)
                    offset = (last_end + 1) if last_end is not None else None
                pending_range = (length, offset)
            elif not line.startswith("#"):
                seg: Dict[str, Any] = {
                    "url": urljoin(url, line),
                    "key": current_key,
                    "seq": media_sequence + index,
                }
                if pending_range:
                    length, offset = pending_range
                    if offset is None:
                        raise ValueError(
                            f"EXT-X-BYTERANGE 缺少 offset 且无前一分片可续: {url}")
                    seg["byterange"] = (length, offset)
                    last_end = offset + length - 1
                    pending_range = None
                segments.append(seg)
                index += 1
        if not segments:
            raise ValueError(f"m3u8 未解析到任何分片: {url}")
        return segments

    @staticmethod
    def _parse_key(line: str) -> Optional[Dict[str, Any]]:
        """解析 EXT-X-KEY 属性行；METHOD=NONE 返回 None（清除加密）。"""
        attrs: Dict[str, str] = {}
        for kv in line[len("#EXT-X-KEY:"):].split(","):
            k, _, v = kv.partition("=")
            attrs[k.strip()] = v.strip().strip('"')
        method = attrs.get("METHOD", "NONE")
        if method == "NONE":
            return None
        key_info: Dict[str, Any] = {"method": method, "uri": attrs.get("URI")}
        iv = attrs.get("IV", "")
        if iv:
            key_info["iv"] = iv[2:] if iv.startswith("0x") else iv
        return key_info

    def _decrypt_segment(self, raw: bytes, key: bytes, key_info: Dict[str, Any],
                         seq: int) -> bytes:
        if not _HAS_AES:
            raise RuntimeError("缺少 pycryptodome，无法解密 HLS AES-128 分片")
        iv_hex = key_info.get("iv")
        if iv_hex:
            try:
                iv = bytes.fromhex(iv_hex)
            except ValueError:
                iv = seq.to_bytes(16, byteorder="big")
        else:
            # RFC 8216 5.2：无 IV 时使用分片序号（EXT-X-MEDIA-SEQUENCE + index）
            iv = seq.to_bytes(16, byteorder="big")
        cipher = AES.new(key, AES.MODE_CBC, iv=iv)
        plain = cipher.decrypt(raw)
        pad_len = plain[-1]
        if 1 <= pad_len <= 16:
            plain = plain[:-pad_len]
        return plain


class DASHDownloader(VideoDownloader):
    """DASH(.mpd) 下载器：多 Period + SegmentTemplate/SegmentList/BaseURL + mux。

    细节补全：
    - 支持多 Period：每个 Period 取最高带宽的视频/音频 Representation，
      分片按文档顺序拼接后统一 concat / mux
    - SegmentTemplate 的 $Time$ 按 SegmentTimeline(t/d/r) 展开真实时间戳，
      $Number$ 按 startNumber 递增
    """

    protocol = "dash"

    async def download(self, url: str, title: str, referer: str = "") -> str:
        if referer and "Referer" not in self.headers:
            self.headers["Referer"] = referer
        mpd_text = (await self._fetch(url)).decode("utf-8", errors="replace")
        video_reps, audio_reps, out_root = await self._parse_mpd(url, mpd_text, title)

        video_parts: List[str] = []
        audio_parts: List[str] = []
        for i, rep in enumerate(video_reps):
            video_parts.extend(await self._download_rep(rep, out_root, f"video{i}"))
        for i, rep in enumerate(audio_reps):
            audio_parts.extend(await self._download_rep(rep, out_root, f"audio{i}"))

        final = os.path.join(self.out_root, f"{_safe(title)}.mp4")
        if not video_parts and not audio_parts:
            raise ValueError(f"MPD 中未解析到任何媒体: {url}")
        video_file = audio_file = None
        if video_parts:
            video_file = os.path.join(out_root, "video_merged.mp4")
            await self.merger.concat_bytes(video_parts, video_file)
            for p in video_parts:
                os.remove(p)
        if audio_parts:
            audio_file = os.path.join(out_root, "audio_merged.mp4")
            await self.merger.concat_bytes(audio_parts, audio_file)
            for p in audio_parts:
                os.remove(p)
        if video_file and audio_file:
            await self.merger.mux(video_file, audio_file, final)
        elif video_file:
            os.replace(video_file, final)
        elif audio_file:
            os.replace(audio_file, final)
        return final

    async def _parse_mpd(self, url: str, mpd: str, title: str) -> Tuple[
            List[Dict[str, Any]], List[Dict[str, Any]], str]:
        import xml.etree.ElementTree as ET
        ns = {"mpd": "urn:mpeg:dash:schema:mpd:2011"}
        root = ET.fromstring(mpd)
        out_root = os.path.join(self.out_root, _safe(title))
        os.makedirs(out_root, exist_ok=True)
        video_reps: List[Dict[str, Any]] = []
        audio_reps: List[Dict[str, Any]] = []

        def _best(adapt: ET.Element) -> Optional[ET.Element]:
            reps = adapt.findall("mpd:Representation", ns)
            if not reps:
                return None
            return max(reps, key=lambda r: int(r.get("bandwidth") or 0))

        def _ctype(adapt: ET.Element) -> str:
            ctype = (adapt.get("contentType") or "").lower()
            if not ctype:
                mime = adapt.get("mimeType", "")
                if "video" in mime:
                    ctype = "video"
                elif "audio" in mime:
                    ctype = "audio"
            return ctype

        periods = root.findall(".//mpd:Period", ns)
        if not periods:
            periods = [root]
        for period in periods:
            v_rep = a_rep = None
            for adapt in period.findall("mpd:AdaptationSet", ns):
                rep = _best(adapt)
                if rep is None:
                    continue
                info = {"url": url, "adapt": adapt, "rep": rep, "out_root": out_root}
                ctype = _ctype(adapt)
                if ctype == "video" and v_rep is None:
                    v_rep = info
                elif ctype == "audio" and a_rep is None:
                    a_rep = info
            if v_rep:
                video_reps.append(v_rep)
            if a_rep:
                audio_reps.append(a_rep)
        return video_reps, audio_reps, out_root

    async def _download_rep(self, rep: Dict[str, Any], out_root: str,
                            tag: str) -> List[str]:
        import xml.etree.ElementTree as ET
        ns = {"mpd": "urn:mpeg:dash:schema:mpd:2011"}
        mpd_url = rep["url"]
        adapt, r = rep["adapt"], rep["rep"]

        # 模板/列表/BaseURL 可能位于 Representation 或 AdaptationSet 层（先查内层）
        # 1) SegmentTemplate（覆盖 SegmentTimeline）
        tmpl = r.find("mpd:SegmentTemplate", ns)
        if tmpl is None:
            tmpl = adapt.find("mpd:SegmentTemplate", ns)
        if tmpl is not None:
            return await self._download_template(mpd_url, tmpl, r, out_root, tag)
        # 2) SegmentList
        seg_list = r.find("mpd:SegmentList", ns)
        if seg_list is None:
            seg_list = adapt.find("mpd:SegmentList", ns)
        if seg_list is not None:
            return await self._download_seglist(mpd_url, seg_list, r, out_root, tag)
        # 3) 单文件 BaseURL
        base = r.find("mpd:BaseURL", ns)
        if base is None:
            base = adapt.find("mpd:BaseURL", ns)
        if base is not None and base.text:
            file_url = urljoin(mpd_url, base.text.strip())
            raw = await self._fetch(file_url)
            path = os.path.join(out_root, f"{tag}.mp4")
            await self._save(raw, path)
            return [path]
        return []

    async def _download_template(self, mpd_url: str, tmpl: Any, rep: Any,
                                 out_root: str, tag: str) -> List[str]:
        import xml.etree.ElementTree as ET
        ns = {"mpd": "urn:mpeg:dash:schema:mpd:2011"}
        media_tmpl = tmpl.get("media", "")
        start = int(tmpl.get("startNumber") or 1)
        timing = tmpl.find("mpd:SegmentTimeline", ns)
        init_url = tmpl.get("initialization")
        part_paths: List[str] = []
        if init_url:
            init_file = os.path.join(out_root, f"{tag}_init.mp4")
            raw = await self._fetch(urljoin(
                mpd_url, init_url.replace("$RepresentationID$", rep.get("id", ""))))
            await self._save(raw, init_file)
            part_paths.append(init_file)

        if timing is not None:
            entries = self._timeline_entries(timing, start)   # [(number, time)]
        else:
            # 无 SegmentTimeline：
            # - 模板含 $Time$ 无法推断时间戳 → 明确报错
            # - 含 $Number$（或无变量）→ 从 startNumber 持续探测直到 404
            if re.search(r"\$Time(?:%0\d+d)?\$", media_tmpl):
                raise ValueError(
                    "SegmentTemplate 含 $Time$ 但无 SegmentTimeline，"
                    "无法推断分片时间戳，请提供带 timeline 的 MPD")
            n = start
            entries = []
            while len(entries) < _MAX_PROBE_SEGMENTS:
                entries.append((n, n))
                n += 1
        media_start = len(part_paths)      # 循环前已有 init 分片数
        if timing is not None:
            # 有 timeline：并发下载全部分片（信号量限流，保序）
            sem = asyncio.Semaphore(self.concurrency)

            async def _dl(n: int, t: int) -> str:
                async with sem:
                    seg_url = self._fill_template(media_tmpl, rep, n=n, t=t)
                    raw = await self._fetch(urljoin(mpd_url, seg_url))
                p = os.path.join(out_root, f"{tag}_seg_{n:06d}.m4s")
                await self._save(raw, p)
                return p

            part_paths += list(await asyncio.gather(
                *(_dl(n, t) for n, t in entries)))
        else:
            # 无 timeline：顺序探测直到 404（并发探测无法确定终点）
            for n, t in entries:
                seg_url = self._fill_template(media_tmpl, rep, n=n, t=t)
                try:
                    raw = await self._fetch(urljoin(mpd_url, seg_url))
                except aiohttp.ClientResponseError as exc:
                    if exc.status == 404:
                        break          # 探测到分片末尾，正常结束
                    raise
                p = os.path.join(out_root, f"{tag}_seg_{n:06d}.m4s")
                await self._save(raw, p)
                part_paths.append(p)
        if timing is None and len(part_paths) == media_start:
            raise ValueError(f"SegmentTemplate 探测无分片: {media_tmpl}")
        return part_paths

    @staticmethod
    def _fill_template(tmpl: str, rep: Any, *, n: int, t: int) -> str:
        """替换模板变量：$RepresentationID$ / $Number$ / $Time$（支持 %0Nd 零填充）。"""
        def _repl(text: str, var: str, value: int) -> str:
            def _inner(m: "re.Match[str]") -> str:
                width = m.group(1)
                return str(value).zfill(int(width)) if width else str(value)
            return re.sub(rf"\${var}(?:%0(\d+)d)?\$", _inner, text)

        out = tmpl.replace("$RepresentationID$", rep.get("id", ""))
        out = _repl(out, "Number", n)
        if "$Time$" in out or re.search(r"\$Time%0\d+d\$", out):
            out = _repl(out, "Time", t)
        return out

    @staticmethod
    def _timeline_entries(timing: Any, start: int) -> List[Tuple[int, int]]:
        """从 SegmentTimeline(S: t/d/r) 展开 (分片号, 时间戳) 列表。

        首片时间取 S@t；S 无 t 时由前一片 d 累积推得。
        """
        import xml.etree.ElementTree as ET
        ns = {"mpd": "urn:mpeg:dash:schema:mpd:2011"}
        entries: List[Tuple[int, int]] = []
        n = start
        next_t: Optional[int] = None
        for s in timing.findall("mpd:S", ns):
            d = int(s.get("d"))
            s_t = int(s.get("t", next_t if next_t is not None else 0))
            r_count = int(s.get("r", "0"))
            cur = s_t
            for _ in range(r_count + 1):
                entries.append((n, cur))
                n += 1
                cur += d
            next_t = cur
        return entries

    async def _download_seglist(self, mpd_url: str, seg_list: Any, rep: Any,
                                out_root: str, tag: str) -> List[str]:
        import xml.etree.ElementTree as ET
        ns = {"mpd": "urn:mpeg:dash:schema:mpd:2011"}
        segs = [s for s in seg_list.findall("mpd:SegmentURL", ns) if s.get("media")]
        if not segs:
            raise ValueError("SegmentList 为空")
        sem = asyncio.Semaphore(self.concurrency)

        async def _dl(i: int, seg: Any) -> str:
            async with sem:
                raw = await self._fetch(urljoin(mpd_url, seg.get("media")))
            p = os.path.join(out_root, f"{tag}_seg_{i:06d}.m4s")
            await self._save(raw, p)
            return p

        return list(await asyncio.gather(
            *(_dl(i, seg) for i, seg in enumerate(segs))))


class HTTPFLVDownloader(VideoDownloader):
    """HTTP-FLV：直接下载 flv 流文件。"""

    protocol = "flv"

    async def download(self, url: str, title: str, referer: str = "") -> str:
        if referer and "Referer" not in self.headers:
            self.headers["Referer"] = referer
        raw = await self._fetch(url)
        path = os.path.join(self.out_root, f"{_safe(title)}.flv")
        return await self._save(raw, path)


class RTMPDownloader(VideoDownloader):
    """RTMP：ffmpeg 拉流转封装 mp4（-c copy 不转码）。"""

    protocol = "rtmp"

    async def download(self, url: str, title: str, referer: str = "") -> str:
        out_path = os.path.join(self.out_root, f"{_safe(title)}.mp4")
        os.makedirs(os.path.dirname(out_path), exist_ok=True)
        return await self.merger.pull_stream(url, out_path)


class RTSPDownloader(VideoDownloader):
    """RTSP：ffmpeg 拉流转封装 mp4。"""

    protocol = "rtsp"

    async def download(self, url: str, title: str, referer: str = "") -> str:
        out_path = os.path.join(self.out_root, f"{_safe(title)}.mp4")
        os.makedirs(os.path.dirname(out_path), exist_ok=True)
        return await self.merger.pull_stream(url, out_path)


class WebRTCDownloader(VideoDownloader):
    """WebRTC：无法直接下载。

    说明：WebRTC 走 SDP 信令 + ICE 协商，媒体经 DTLS-SRTP 加密且地址动态，
    服务端不开放录制接口时无法被动抓取。提供明确的替代方案指引。
    """

    protocol = "webrtc"

    async def download(self, url: str, title: str, referer: str = "") -> str:
        raise NotImplementedError(
            "WebRTC 无法直接下载：媒体经 DTLS-SRTP 加密且需信令协商。"
            "替代方案：①服务端开启录制接口；②浏览器端 getUserMedia+MediaRecorder 录制；"
            "③使用 sipml5/janus 网关录制。框架已识别该资源类型并跳过。"
        )


class VideoDownloaderFactory:
    """视频下载器工厂：按协议创建（工厂模式）。"""

    _registry: Dict[str, type] = {
        "hls": HLSDownloader,
        "m3u8": HLSDownloader,
        "dash": DASHDownloader,
        "mpd": DASHDownloader,
        "flv": HTTPFLVDownloader,
        "rtmp": RTMPDownloader,
        "rtsp": RTSPDownloader,
        "webrtc": WebRTCDownloader,
    }

    def __init__(self, session: aiohttp.ClientSession, out_root: str,
                 concurrency: int = 8, ffmpeg: str = "ffmpeg",
                 headers: Optional[Dict[str, str]] = None) -> None:
        self.session = session
        self.out_root = out_root
        self.concurrency = concurrency
        self.ffmpeg = ffmpeg
        self.headers = headers or {}

    def create(self, protocol: str) -> VideoDownloader:
        key = (protocol or "").lower()
        if key not in self._registry:
            raise ValueError(f"不支持的视频协议: {protocol}")
        return self._registry[key](self.session, self.out_root,
                                   concurrency=self.concurrency,
                                   ffmpeg=self.ffmpeg, headers=self.headers)


def detect_video_protocol(url: str) -> Optional[str]:
    """按 URL 后缀识别视频协议。"""
    path = urlparse(url).path.lower()
    if path.endswith(".m3u8"):
        return "hls"
    if path.endswith(".mpd"):
        return "dash"
    if path.endswith(".flv"):
        return "flv"
    if url.startswith("rtmp://"):
        return "rtmp"
    if url.startswith("rtsp://"):
        return "rtsp"
    if url.startswith("webrtc://") or "webrtc" in url:
        return "webrtc"
    return None


def _safe(name: str) -> str:
    import re as _re
    name = _re.sub(r'[\\/:*?"<>|\x00-\x1f]', "_", str(name)).strip(" .")
    return name or "video"
