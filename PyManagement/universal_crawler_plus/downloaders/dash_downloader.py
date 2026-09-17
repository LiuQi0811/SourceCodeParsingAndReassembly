"""
DASH (MPD) 流媒体下载器 —— universal_crawler_plus 的独立流媒体模块

设计目标与 hls_downloader 保持一致：
- 解析层（MPDParser）只用 Python 标准库（xml.etree.ElementTree），不依赖网络；
- 网络层通过注入的异步回调 fetch_bytes(url, referer)->bytes|None 获取，
  因此可在无第三方库、无网络的环境下做端到端离线测试；
- 纯 Python 二进制拼接 fMP4（init 段 + 媒体段）产出可播放文件，ffmpeg 仅作可选增强
  （音视频分离轨的 mux 合流）。

支持：
- VOD 静态清单（MPD@type="static"）；dynamic 直播只下当前分片、不追流；
- BaseURL 多级（MPD/Period/AdaptationSet/Representation）相对补全；
- SegmentTemplate：$RepresentationID$/$Number$(含 %05d 宽度)/$Time$/$Bandwidth$，
  分片序列优先取 SegmentTimeline（含 S@r 重复），无 timeline 时用 duration + 周期时长估算；
- SegmentList（SegmentURL@media + Initialization@sourceURL）；
- 多 AdaptationSet 选轨：视频取最高带宽、音频取最高带宽；
- fMP4 同轨 [init][media...] 二进制拼接；音视频分离时分别落盘，有 ffmpeg 则 mux 成 mp4。

不支持（显式报错，不产出坏文件）：
- ContentProtection 通用加密（CENC/CBCS）；
- SegmentBase + indexRange 的单文件索引式分片；
- SAMPLE 级加密与多周期（Multi-Period）拼接（只取第一个 Period）。
"""
import asyncio
import math
import re
import shutil
import xml.etree.ElementTree as ET
from dataclasses import dataclass, field
from pathlib import Path
from typing import Awaitable, Callable, Dict, List, Optional, Tuple
from urllib.parse import urljoin

from utils.logger import get_logger

logger = get_logger("universal_crawler.DASH")

# tqdm 软依赖：缺失时降级为无进度条
try:
    from tqdm import tqdm
    HAS_TQDM = True
except Exception:
    tqdm = None
    HAS_TQDM = False


FetchBytes = Callable[[str, str], Awaitable[Optional[bytes]]]
_DASH_NS = "urn:mpeg:dash:schema:mpd:2011"
_XML_NS = "{http://www.w3.org/XML/1998/namespace}lang"


class _NullBar:
    def update(self, n=1):
        pass

    def close(self):
        pass


# ----------------------------------------------------------------------------
# 数据结构
# ----------------------------------------------------------------------------
@dataclass
class DashSeg:
    """一个媒体分片"""
    uri: str
    index: int          # 序号（从 0 开始，用于排序与文件命名）
    number: int = 0     # 模板 $Number$ 的真实值
    time: int = 0       # 模板 $Time$ 的真实值（ticks）


@dataclass
class DashTrack:
    """一条可独立下载的轨道（视频或音频）"""
    rep_id: str
    kind: str = "video"               # video / audio
    bandwidth: int = 0
    mime: str = ""
    codecs: str = ""
    lang: str = ""
    width: int = 0
    height: int = 0
    init_url: str = ""                # 初始化段（可能为空）
    segments: List[DashSeg] = field(default_factory=list)
    encrypted: bool = False


@dataclass
class DashManifest:
    tracks: List[DashTrack] = field(default_factory=list)
    is_dynamic: bool = False
    duration_sec: float = 0.0

    @property
    def encrypted(self) -> bool:
        return any(t.encrypted for t in self.tracks)


@dataclass
class DashResult:
    success: bool
    local_path: Optional[Path] = None       # 最终成片（分离轨且无 ffmpeg 时指向视频轨）
    video_path: Optional[Path] = None
    audio_path: Optional[Path] = None
    segment_count: int = 0
    used_ffmpeg: bool = False
    error: Optional[str] = None


# ----------------------------------------------------------------------------
# 小工具
# ----------------------------------------------------------------------------
def _ln(elem: ET.Element) -> str:
    """去掉命名空间前缀，返回本地标签名"""
    return elem.tag.rsplit("}", 1)[-1] if isinstance(elem.tag, str) else ""


def _kids(elem: Optional[ET.Element], name: str) -> List[ET.Element]:
    return [c for c in elem if _ln(c) == name] if elem is not None else []


def _kid(elem: Optional[ET.Element], name: str) -> Optional[ET.Element]:
    if elem is None:
        return None
    for c in elem:
        if _ln(c) == name:
            return c
    return None


def _merge_attrs(*elems: Optional[ET.Element]) -> Dict[str, str]:
    """沿继承链合并属性：靠后的元素覆盖靠前的"""
    merged: Dict[str, str] = {}
    for e in elems:
        if e is not None:
            for k, v in e.attrib.items():
                merged[k.rsplit("}", 1)[-1]] = v  # 属性 key 也去命名空间
    return merged


def parse_iso8601_duration(value: str) -> float:
    """解析 PT1H2M3.5S / P1DT2S 等时长为秒；失败返回 0"""
    if not value:
        return 0.0
    total = 0.0
    pre, _, tpart = value.strip().partition("T")
    d = re.search(r"(\d+(?:\.\d+)?)D", pre)
    if d:
        total += float(d.group(1)) * 86400
    target = tpart or pre
    for pat, mul in ((r"(\d+(?:\.\d+)?)H", 3600),
                     (r"(\d+(?:\.\d+)?)M", 60),
                     (r"(\d+(?:\.\d+)?)S", 1)):
        m = re.search(pat, target)
        if m:
            total += float(m.group(1)) * mul
    return total


def expand_template(tpl: str, rep_id: str, number: Optional[int] = None,
                    time: Optional[int] = None, bandwidth: int = 0) -> str:
    """展开 SegmentTemplate 的占位符"""
    out = tpl.replace("$RepresentationID$", str(rep_id)).replace("$Bandwidth$", str(bandwidth))

    def _num(m):
        s = "" if number is None else str(number)
        width = m.group(1)
        return s.zfill(int(width)) if width else s

    # $Number$ 或 $Number%05d$
    out = re.sub(r"\$Number(?:%0(\d+)d)?\$", _num, out)
    if time is not None:
        out = out.replace("$Time$", str(time))
    return out


# ----------------------------------------------------------------------------
# MPD 解析器
# ----------------------------------------------------------------------------
class MPDParser:
    def __init__(self, base_url: str):
        self.base_url = base_url

    def parse_text(self, text: str) -> DashManifest:
        # 容忍 BOM
        root = ET.fromstring(text.lstrip("﻿").strip())
        if _ln(root) != "MPD":
            raise ValueError("不是合法的 MPD 清单（根节点非 MPD）")
        mpd_attrs = {k.rsplit('}', 1)[-1]: v for k, v in root.attrib.items()}
        is_dynamic = mpd_attrs.get("type", "static").lower() == "dynamic"
        duration = parse_iso8601_duration(mpd_attrs.get("mediaPresentationDuration", ""))

        mpd_base = self._text_of(_kid(root, "BaseURL"))
        mpd_tpl = _kid(root, "SegmentTemplate")
        tracks: List[DashTrack] = []

        for period in _kids(root, "Period"):
            # 仅处理第一个 Period
            period_base = self._join_base(mpd_base, self._text_of(_kid(period, "BaseURL")))
            period_tpl = _kid(period, "SegmentTemplate") or mpd_tpl
            period_dur = parse_iso8601_duration(period.attrib.get("duration", "")) or duration

            for adapt in _kids(period, "AdaptationSet"):
                adapt_base = self._join_base(period_base, self._text_of(_kid(adapt, "BaseURL")))
                adapt_tpl = _kid(adapt, "SegmentTemplate") or period_tpl
                adapt_list = _kid(adapt, "SegmentList")
                adapt_prot = _kid(adapt, "ContentProtection") is not None
                a_attr = _merge_attrs(period, adapt)  # AdaptationSet 继承 Period 公共属性

                for rep in _kids(adapt, "Representation"):
                    rep_base = self._join_base(adapt_base, self._text_of(_kid(rep, "BaseURL")))
                    rep_tpl = _kid(rep, "SegmentTemplate") or adapt_tpl
                    rep_list = _kid(rep, "SegmentList") or adapt_list
                    encrypted = adapt_prot or _kid(rep, "ContentProtection") is not None
                    attrs = _merge_attrs_from_dict(a_attr, rep)
                    track = self._build_track(
                        attrs, rep, rep_tpl, rep_list, rep_base, period_dur, encrypted)
                    if track is not None:
                        tracks.append(track)
            break  # Multi-Period 不支持，只取第一个周期

        return DashManifest(tracks=tracks, is_dynamic=is_dynamic, duration_sec=duration)

    # ---------- 单条轨道构建 ----------
    def _build_track(self, attrs: Dict[str, str], rep: ET.Element,
                     tpl: Optional[ET.Element], seg_list: Optional[ET.Element],
                     base: str, period_dur: float, encrypted: bool) -> Optional[DashTrack]:
        rep_id = attrs.get("id", "")
        bandwidth = _to_int(attrs.get("bandwidth"))
        mime = attrs.get("mimeType", "") or attrs.get("contentType", "")
        codecs = attrs.get("codecs", "")
        lang = attrs.get("lang", "") or attrs.get(_XML_NS, "")
        width = _to_int(attrs.get("width"))
        height = _to_int(attrs.get("height"))
        content_type = attrs.get("contentType", "").lower()
        kind = self._guess_kind(content_type, mime, width)

        track = DashTrack(rep_id=rep_id, kind=kind, bandwidth=bandwidth, mime=mime,
                          codecs=codecs, lang=lang, width=width, height=height,
                          encrypted=encrypted)

        if seg_list is not None:
            self._fill_from_list(track, seg_list, base)
        elif tpl is not None:
            self._fill_from_template(track, tpl, base, rep_id, bandwidth, period_dur)
        elif _kid(rep, "SegmentBase") is not None:
            raise NotImplementedError("暂不支持 SegmentBase(indexRange) 单文件索引式 DASH")
        else:
            # 无分片信息：可能是整文件 Representation（BaseURL 即媒体本体）
            if base:
                track.segments = []
                track.init_url = ""
            else:
                return None
        return track

    def _fill_from_list(self, track: DashTrack, seg_list: ET.Element, base: str):
        init_el = _kid(seg_list, "Initialization")
        if init_el is not None and init_el.get("sourceURL"):
            track.init_url = urljoin(base, init_el.get("sourceURL"))
        for i, su in enumerate(_kids(seg_list, "SegmentURL")):
            media = su.get("media")
            if media:
                track.segments.append(DashSeg(uri=urljoin(base, media), index=i, number=i + 1))

    def _fill_from_template(self, track: DashTrack, tpl: ET.Element, base: str,
                            rep_id: str, bandwidth: int, period_dur: float):
        t_attr = {k.rsplit('}', 1)[-1]: v for k, v in tpl.attrib.items()}
        timescale = _to_int(t_attr.get("timescale"), default=1) or 1
        start_number = _to_int(t_attr.get("startNumber"), default=1)
        init_tpl = t_attr.get("initialization", "")
        media_tpl = t_attr.get("media", "")
        if init_tpl:
            track.init_url = urljoin(base, expand_template(init_tpl, rep_id, bandwidth=bandwidth))

        timeline = _kid(tpl, "SegmentTimeline")
        pairs: List[Tuple[int, int]] = []  # (number, time_ticks)
        if timeline is not None:
            cur_t: Optional[int] = None
            num = start_number
            for s in _kids(timeline, "S"):
                d = _to_int(s.get("d"))
                r = _to_int(s.get("r"), default=0)
                if s.get("t") is not None:
                    cur_t = _to_int(s.get("t"))
                elif cur_t is None:
                    cur_t = 0
                for _ in range(r + 1):
                    pairs.append((num, cur_t))
                    num += 1
                    cur_t += d
        else:
            d = _to_int(t_attr.get("duration"))
            if d > 0:
                total_ticks = period_dur * timescale
                count = max(1, math.ceil(total_ticks / d)) if period_dur else 1
                cur_t, num = 0, start_number
                for i in range(count):
                    pairs.append((num, cur_t))
                    num += 1
                    cur_t += d

        for i, (number, tick) in enumerate(pairs):
            rel = expand_template(media_tpl, rep_id, number=number, time=tick, bandwidth=bandwidth)
            track.segments.append(DashSeg(uri=urljoin(base, rel), index=i,
                                          number=number, time=tick))

    @staticmethod
    def _guess_kind(content_type: str, mime: str, width: int) -> str:
        blob = f"{content_type} {mime}".lower()
        if "audio" in blob:
            return "audio"
        if "video" in blob or width > 0:
            return "video"
        return "video"  # 无法判断时按主轨处理（常见于 muxed 单轨）

    @staticmethod
    def _text_of(elem: Optional[ET.Element]) -> str:
        return (elem.text or "").strip() if elem is not None else ""

    @staticmethod
    def _join_base(parent: str, child: str) -> str:
        if not child:
            return parent
        if not parent:
            return child
        return urljoin(parent if parent.endswith("/") else parent + "/", child)


def _merge_attrs_from_dict(base: Dict[str, str], elem: ET.Element) -> Dict[str, str]:
    out = dict(base)
    for k, v in elem.attrib.items():
        out[k.rsplit("}", 1)[-1]] = v
    return out


def _to_int(value, default: int = 0) -> int:
    try:
        return int(str(value).strip())
    except (TypeError, ValueError):
        return default


def select_tracks(tracks: List[DashTrack]) -> Tuple[Optional[DashTrack], Optional[DashTrack]]:
    """挑选最高带宽的视频轨与音频轨；返回 (video, audio)"""
    videos = [t for t in tracks if t.kind == "video"]
    audios = [t for t in tracks if t.kind == "audio"]
    video = max(videos, key=lambda t: (t.bandwidth, t.width * t.height)) if videos else None
    audio = max(audios, key=lambda t: t.bandwidth) if audios else None
    return video, audio


# ----------------------------------------------------------------------------
# DASH 下载器
# ----------------------------------------------------------------------------
class DASHDownloader:
    def __init__(self, config, fetch_bytes: FetchBytes,
                 output_dir_getter: Callable[[], Path] = None,
                 global_segment_semaphore_getter: Callable[[], Optional[asyncio.Semaphore]] = None):
        self.config = config
        self.fetch_bytes = fetch_bytes
        self._output_dir_getter = output_dir_getter
        self._global_sem_getter = global_segment_semaphore_getter
        self._segment_retries = getattr(config, "hls_segment_retries", 3)
        self._segment_concurrency = getattr(config, "hls_segment_concurrency", 8)

    def _video_dir(self) -> Path:
        if self._output_dir_getter is not None:
            return self._output_dir_getter()
        return self.config.output_dir / "video"

    def _bar(self, total: int, desc: str):
        if HAS_TQDM and getattr(self.config, "show_progress", True):
            return tqdm(total=total, desc=desc, unit="片", leave=False, dynamic_ncols=True)
        return _NullBar()

    async def download(self, mpd_url: str, final_stem: str) -> DashResult:
        result = DashResult(success=False)
        tmp_dir: Optional[Path] = None
        try:
            raw = await self.fetch_bytes(mpd_url, "")
            if raw is None:
                raise RuntimeError(f"MPD 清单下载失败: {mpd_url}")
            text = raw.decode("utf-8-sig", errors="replace")
            manifest = MPDParser(mpd_url).parse_text(text)
            if not manifest.tracks:
                raise RuntimeError("MPD 中没有可用轨道")
            if manifest.encrypted:
                raise NotImplementedError("该 MPD 含 ContentProtection 加密（CENC），暂不支持")
            if manifest.is_dynamic:
                logger.warning("MPD type=dynamic（直播），仅下载当前清单分片，不持续追流")

            video, audio = select_tracks(manifest.tracks)
            if video is None and audio is not None:  # 纯音频清单
                video, audio = audio, None
            if video is None:
                raise RuntimeError("MPD 中没有可下载的视频轨")

            video_dir = self._video_dir()
            video_dir.mkdir(parents=True, exist_ok=True)
            tmp_dir = video_dir / f".dash_{final_stem}"
            tmp_dir.mkdir(parents=True, exist_ok=True)

            separate_audio = audio is not None and audio is not video
            # 视频/主轨落盘
            if separate_audio:
                v_out = video_dir / f"{final_stem}.video.mp4"
                a_out = video_dir / f"{final_stem}.audio.m4a"
                v_count = await self._download_track(video, tmp_dir / "video", v_out, "DASH视频")
                a_count = await self._download_track(audio, tmp_dir / "audio", a_out, "DASH音频")
                result.video_path, result.audio_path = v_out, a_out
                result.segment_count = v_count + a_count

                final_mp4 = video_dir / f"{final_stem}.mp4"
                if await self._ffmpeg_mux(v_out, a_out, final_mp4):
                    result.used_ffmpeg = True
                    result.local_path = final_mp4
                    v_out.unlink(missing_ok=True)
                    a_out.unlink(missing_ok=True)
                else:
                    logger.warning("无 ffmpeg 或合流失败，保留分离的 .video.mp4 / .audio.m4a")
                    result.local_path = v_out  # 主文件指向视频轨
            else:
                out = video_dir / f"{final_stem}.mp4"
                result.segment_count = await self._download_track(video, tmp_dir / "main", out, "DASH")
                result.video_path = out
                result.local_path = out

            # max_file_size 约束：成片超过上限则删除产出文件并终止
            if self.config.max_file_size > 0:
                _cands = {result.local_path, result.video_path, result.audio_path}
                _too_big = [f for f in _cands if f and f.exists()
                            and f.stat().st_size > self.config.max_file_size]
                if _too_big:
                    for f in _cands:
                        if f:
                            f.unlink(missing_ok=True)
                    raise RuntimeError(
                        f"成片超过 max_file_size={self.config.max_file_size}，已删除产出文件")

            result.success = True
            logger.info(f"DASH 合并完成: {result.local_path.name if result.local_path else ''}，"
                        f"{result.segment_count} 分片"
                        f"{'（ffmpeg合流）' if result.used_ffmpeg else ''}")
            return result
        except Exception as e:
            result.error = str(e)
            logger.error(f"DASH 下载失败 [{mpd_url}]: {e}")
            return result
        finally:
            if tmp_dir is not None:
                shutil.rmtree(tmp_dir, ignore_errors=True)

    # ---------- 单轨下载与拼接 ----------
    async def _download_track(self, track: DashTrack, tmp_dir: Path, out_path: Path,
                              desc: str) -> int:
        tmp_dir.mkdir(parents=True, exist_ok=True)
        sem = asyncio.Semaphore(max(1, self._segment_concurrency))
        failed: List[str] = []
        total = (1 if track.init_url else 0) + len(track.segments)
        pbar = self._bar(total, desc)

        async def fetch_one(uri: str, name: str):
            path = tmp_dir / name
            if path.exists() and path.stat().st_size > 0:
                pbar.update(1)
                return
            gsem = self._global_sem_getter() if self._global_sem_getter else None
            async with sem:
                last_err = None
                for attempt in range(self._segment_retries + 1):
                    try:
                        if gsem is not None:
                            async with gsem:
                                data = await self.fetch_bytes(uri, "")
                        else:
                            data = await self.fetch_bytes(uri, "")
                        if not data:
                            raise IOError("空分片")
                        part = path.with_suffix(".part")
                        with open(part, "wb") as f:
                            f.write(data)
                        part.replace(path)
                        pbar.update(1)
                        return
                    except Exception as e:
                        last_err = e
                        await asyncio.sleep(min(2.0, 0.3 * (attempt + 1)))
                failed.append(f"{name}:{uri} ({last_err})")

        tasks = []
        if track.init_url:
            tasks.append(fetch_one(track.init_url, "init.mp4"))
        for seg in track.segments:
            tasks.append(fetch_one(seg.uri, f"seg_{seg.index:05d}.m4s"))
        await asyncio.gather(*tasks)
        pbar.close()
        if failed:
            raise IOError(f"{len(failed)} 个 DASH 分片失败，例如: {failed[:3]}")

        await asyncio.to_thread(self._concat_track, track, tmp_dir, out_path)
        return len(track.segments)

    @staticmethod
    def _concat_track(track: DashTrack, tmp_dir: Path, out_path: Path):
        """fMP4：[init 段][媒体段1][媒体段2]... 顺序二进制拼接"""
        total = 0
        with open(out_path, "wb") as out:
            init = tmp_dir / "init.mp4"
            if init.exists():
                total += _stream_copy(init, out)
            for seg in track.segments:
                p = tmp_dir / f"seg_{seg.index:05d}.m4s"
                if not p.exists():
                    raise IOError(f"缺少分片，无法合并: {p.name}")
                total += _stream_copy(p, out)
        return total

    @staticmethod
    async def _ffmpeg_mux(video_path: Path, audio_path: Path, out_path: Path) -> bool:
        """用 ffmpeg 将分离的音视频轨无损合流为 mp4"""
        ffmpeg = shutil.which("ffmpeg")
        if not ffmpeg:
            return False
        try:
            proc = await asyncio.create_subprocess_exec(
                ffmpeg, "-y", "-i", str(video_path), "-i", str(audio_path),
                "-c", "copy", str(out_path),
                stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.PIPE,
            )
            _, stderr = await proc.communicate()
            if proc.returncode == 0 and out_path.exists() and out_path.stat().st_size > 0:
                return True
            logger.debug(f"ffmpeg合流失败: {stderr[-300:].decode('utf-8','ignore') if stderr else ''}")
        except Exception as e:
            logger.debug(f"ffmpeg调用异常: {e}")
        if out_path.exists():
            out_path.unlink(missing_ok=True)
        return False


def _stream_copy(src: Path, out_fh, buf_size: int = 1024 * 1024) -> int:
    n = 0
    with open(src, "rb") as f:
        while True:
            chunk = f.read(buf_size)
            if not chunk:
                break
            out_fh.write(chunk)
            n += len(chunk)
    return n
