"""
HLS(m3u8) 流媒体下载器（独立模块，不侵入普通下载链路）

能力：
- 解析 Master 清单（#EXT-X-STREAM-INF 多码率）并按策略选择变体，递归到媒体清单
- 解析 Media 清单：分片相对路径补全、#EXT-X-MEDIA-SEQUENCE、#EXT-X-KEY
- AES-128 解密：支持显式 IV，缺省按“分片媒体序列号”推导 128-bit IV；仅末片去 PKCS7 填充
- 有界并发下载分片、单片重试、分片临时缓存、按序合并为 .ts（MPEG-TS 可直接二进制拼接）
- 本机存在 ffmpeg 时可选无损 remux 为 .mp4（-c copy，不重编码）；无 ffmpeg 保留 .ts

设计：
- 解析层 M3U8Parser 为纯标准库实现，不依赖网络与第三方库，便于离线单测
- 网络层通过注入的 fetch_bytes 异步回调获取字节（复用主下载器的会话/代理/UA/重试），
  因此本模块不直接依赖 aiohttp，也方便用假数据做端到端测试

不支持（会显式报错而非产出坏文件）：
- SAMPLE-AES / SAMPLE-AES-CTR（按样本加密，需解封装）
- EXT-X-BYTERANGE 字节范围分片
- 直播持续追流：无 #EXT-X-ENDLIST 时只下载当前清单内分片，不循环等待新分片
"""
import asyncio
import shutil
import struct
import re
from dataclasses import dataclass, field
from pathlib import Path
from typing import Optional, List, Dict, Callable, Awaitable
from urllib.parse import urljoin

from utils.logger import get_logger

logger = get_logger("HLS")

try:
    from Crypto.Cipher import AES
    HAS_AES = True
except Exception:  # pycryptodome 未安装
    AES = None
    HAS_AES = False

try:
    from tqdm import tqdm
    HAS_TQDM = True
except Exception:  # tqdm 未安装时降级为无进度条
    tqdm = None
    HAS_TQDM = False


class _NullBar:
    """无 tqdm 或关闭进度时的空实现"""
    def update(self, n=1):
        pass

    def close(self):
        pass


# fetch_bytes 回调签名: (url: str, referer: str) -> Optional[bytes]
FetchBytes = Callable[[str, str], Awaitable[Optional[bytes]]]


# ----------------------------------------------------------------------------
# 数据结构
# ----------------------------------------------------------------------------
@dataclass
class Variant:
    """Master 清单中的一个码率变体，或一条 EXT-X-MEDIA 外挂轨"""
    uri: str
    bandwidth: int = 0
    resolution: str = ""
    name: str = ""
    kind: str = "video"        # video / audio / subtitle
    lang: str = ""
    is_default: bool = False


@dataclass
class HlsKey:
    """分片加密密钥"""
    method: str = "NONE"          # NONE / AES-128 / SAMPLE-AES ...
    uri: str = ""
    iv: Optional[bytes] = None    # 显式 IV（16 字节）
    key_bytes: Optional[bytes] = None  # 下载得到的密钥（AES-128 为 16 字节）


@dataclass
class Segment:
    """媒体分片"""
    uri: str
    index: int                 # 在本清单中的序号（从 0 开始）
    media_sequence: int        # 媒体序列号（用于缺省 IV 推导）
    duration: float = 0.0
    key: Optional[HlsKey] = None


@dataclass
class MediaPlaylist:
    segments: List[Segment] = field(default_factory=list)
    endlist: bool = False
    target_duration: float = 0.0
    media_sequence: int = 0


@dataclass
class MasterPlaylist:
    variants: List[Variant] = field(default_factory=list)
    # 外挂字幕轨（EXT-X-MEDIA TYPE=SUBTITLES）
    subtitle_tracks: List[Variant] = field(default_factory=list)
    # 外挂音频轨（EXT-X-MEDIA TYPE=AUDIO），仅记录
    audio_tracks: List[Variant] = field(default_factory=list)

    @property
    def is_master(self) -> bool:
        return bool(self.variants)


@dataclass
class HlsResult:
    success: bool
    local_path: Optional[Path] = None
    segment_count: int = 0
    total_bytes: int = 0
    is_encrypted: bool = False
    used_ffmpeg: bool = False
    subtitle_paths: List[Path] = field(default_factory=list)
    error: Optional[str] = None


# ----------------------------------------------------------------------------
# 纯函数工具（可离线单测）
# ----------------------------------------------------------------------------
def sequence_iv(media_sequence: int) -> bytes:
    """缺省 IV：分片媒体序列号的 128-bit 大端表示（RFC 8216）"""
    return struct.pack(">QQ", 0, media_sequence)


def pkcs7_unpad(data: bytes) -> bytes:
    """去除 PKCS7 填充；非法填充时原样返回（避免损坏数据）"""
    if not data:
        return data
    pad = data[-1]
    if 1 <= pad <= 16 and data[-pad:] == bytes([pad]) * pad:
        return data[:-pad]
    return data


def pick_variant(variants: List[Variant], prefer: str = "highest") -> Optional[Variant]:
    """从多码率变体中选一个：highest 取最高带宽，lowest 取最低带宽"""
    valid = [v for v in variants if v.uri]
    if not valid:
        return None
    key_fn = max if prefer == "highest" else min
    return key_fn(valid, key=lambda v: v.bandwidth)


def _parse_attrs(attr_line: str) -> Dict[str, str]:
    """解析 EXT-X-* 属性串：KEY=VALUE,KEY="QUOTED" ；键统一大写"""
    attrs: Dict[str, str] = {}
    # 匹配 KEY= 后面跟 "..." 或 非逗号token
    for m in re.finditer(r'([A-Z0-9-]+)\s*=\s*(?:"([^"]*)"|([^,]+))', attr_line):
        name = m.group(1).upper()
        attrs[name] = m.group(2) if m.group(2) is not None else m.group(3).strip()
    return attrs


def _parse_iv(iv_str: str) -> Optional[bytes]:
    """解析 IV=0x.... 为 16 字节"""
    if not iv_str:
        return None
    s = iv_str.strip()
    if s.lower().startswith("0x"):
        s = s[2:]
    try:
        b = bytes.fromhex(s)
        # 不足16字节左侧补0
        return b.rjust(16, b"\x00")[-16:]
    except ValueError:
        return None


# ----------------------------------------------------------------------------
# m3u8 解析器
# ----------------------------------------------------------------------------
class M3U8Parser:
    @staticmethod
    def parse(text: str, base_url: str):
        """
        解析清单文本。
        :return: MasterPlaylist 或 MediaPlaylist
        """
        raw_lines = text.splitlines() if text else []
        has_ext = any(ln.strip().startswith("#EXT") for ln in raw_lines)
        if not has_ext:
            raise ValueError("不是合法的 m3u8（缺少 #EXTM3U/#EXT 标签）")

        lines = [ln.strip() for ln in raw_lines if ln.strip() != ""]
        variants: List[Variant] = []
        subtitle_tracks: List[Variant] = []
        audio_tracks: List[Variant] = []
        segments: List[Segment] = []

        pending_stream: Optional[Dict[str, str]] = None
        current_key = HlsKey(method="NONE")
        media_sequence = 0
        target_duration = 0.0
        endlist = False
        seg_index = 0
        expect_inf = False
        pending_duration = 0.0

        for ln in lines:
            if not ln.startswith("#"):
                # URI 行：可能是变体URI（前面是 STREAM-INF）或分片URI（前面是 EXTINF）
                uri = urljoin(base_url, ln)
                if pending_stream is not None:
                    variants.append(Variant(
                        uri=uri,
                        bandwidth=int(pending_stream.get("BANDWIDTH", "0") or 0),
                        resolution=pending_stream.get("RESOLUTION", ""),
                        name=pending_stream.get("NAME", ""),
                    ))
                    pending_stream = None
                elif expect_inf:
                    segments.append(Segment(
                        uri=uri,
                        index=seg_index,
                        media_sequence=media_sequence + seg_index,
                        duration=pending_duration,
                        key=current_key if current_key.method != "NONE" else None,
                    ))
                    seg_index += 1
                    expect_inf = False
                    pending_duration = 0.0
                # 孤立 URI（无 EXTINF/STREAM-INF）忽略
                continue

            tag_body = ln[1:]  # 去掉 #
            tag = tag_body.split(":", 1)[0]
            value = tag_body.split(":", 1)[1] if ":" in tag_body else ""

            if tag == "EXT-X-STREAM-INF":
                pending_stream = _parse_attrs(value)
            elif tag == "EXT-X-MEDIA":
                a = _parse_attrs(value)
                uri = a.get("URI")
                if not uri:
                    continue
                track = Variant(
                    uri=urljoin(base_url, uri),
                    name=a.get("NAME", ""),
                    kind=a.get("TYPE", "").lower(),
                    lang=a.get("LANGUAGE", ""),
                    is_default=a.get("DEFAULT", "").upper() == "YES",
                )
                if track.kind == "subtitles":
                    subtitle_tracks.append(track)
                elif track.kind == "audio":
                    audio_tracks.append(track)
            elif tag == "EXT-X-KEY":
                current_key = M3U8Parser._parse_key(value, base_url, current_key)
            elif tag == "EXT-X-MEDIA-SEQUENCE":
                try:
                    media_sequence = int(value.strip())
                except ValueError:
                    media_sequence = 0
            elif tag == "EXT-X-TARGETDURATION":
                try:
                    target_duration = float(value.strip())
                except ValueError:
                    target_duration = 0.0
            elif tag == "EXTINF":
                # EXTINF:<duration>,<title>
                dur_str = value.split(",", 1)[0].strip()
                try:
                    pending_duration = float(dur_str)
                except ValueError:
                    pending_duration = 0.0
                expect_inf = True
            elif tag == "EXT-X-ENDLIST":
                endlist = True
            # 其余标签（VERSION/ALLOWED-CACHE/PLAYLIST-TYPE/MAP/BYTERANGE 等）忽略

        # 已解析出变体 → master
        if variants:
            return MasterPlaylist(variants=variants,
                                  subtitle_tracks=subtitle_tracks,
                                  audio_tracks=audio_tracks)

        # 回填正确的 media_sequence（EXT-X-MEDIA-SEQUENCE 出现在分片之前，
        # 上面用初始值构造，这里统一重算一次，保证与声明一致）
        for seg in segments:
            seg.media_sequence = media_sequence + seg.index
        return MediaPlaylist(
            segments=segments,
            endlist=endlist,
            target_duration=target_duration,
            media_sequence=media_sequence,
        )

    @staticmethod
    def _parse_key(value: str, base_url: str, previous: HlsKey) -> HlsKey:
        attrs = _parse_attrs(value)
        method = attrs.get("METHOD", "NONE").upper()
        if method == "NONE":
            return HlsKey(method="NONE")
        uri = attrs.get("URI", "")
        if uri:
            uri = urljoin(base_url, uri)
        iv = _parse_iv(attrs.get("IV", ""))
        return HlsKey(method=method, uri=uri, iv=iv)


# ----------------------------------------------------------------------------
# AES-128 分片解密
# ----------------------------------------------------------------------------
def decrypt_segment(data: bytes, key: HlsKey, is_last: bool) -> bytes:
    """AES-128 CBC 解密单个分片；仅最后一个分片做 PKCS7 去填充"""
    if key is None or key.method == "NONE":
        return data
    if key.method != "AES-128":
        raise NotImplementedError(f"暂不支持的 HLS 加密方式: {key.method}")
    if not HAS_AES:
        raise RuntimeError("加密 HLS 需要 pycryptodome，请先 pip install pycryptodome")
    if not key.key_bytes:
        raise RuntimeError(f"密钥未下载: {key.uri}")
    iv = key.iv if key.iv is not None else sequence_iv(0)  # 缺省由调用方按序号注入
    cipher = AES.new(key.key_bytes, AES.MODE_CBC, iv)
    dec = cipher.decrypt(data)
    if is_last:
        dec = pkcs7_unpad(dec)
    return dec


# ----------------------------------------------------------------------------
# HLS 下载器
# ----------------------------------------------------------------------------
class HLSDownloader:
    def __init__(self, config, fetch_bytes: FetchBytes, output_dir_getter: Callable[[], Path] = None,
                 global_segment_semaphore_getter: Callable[[], Optional[asyncio.Semaphore]] = None):
        """
        :param config: CrawlerConfig
        :param fetch_bytes: 异步回调 (url, referer)->bytes|None，复用主下载器会话
        :param output_dir_getter: 返回视频输出目录的可调用对象（便于动态读取 config）
        :param global_segment_semaphore_getter: 返回全局分片信号量（所有流媒体任务共享），None 表示不限
        """
        self.config = config
        self.fetch_bytes = fetch_bytes
        self._output_dir_getter = output_dir_getter
        self._global_sem_getter = global_segment_semaphore_getter
        self._max_master_depth = 5  # master 嵌套层级上限，防止环形引用

    def _video_dir(self) -> Path:
        if self._output_dir_getter is not None:
            return self._output_dir_getter()
        return self.config.output_dir / "video"

    def _segment_bar(self, total: int, desc: str = "HLS分片"):
        """分片级进度条；未装 tqdm 或关闭进度时返回空实现"""
        if HAS_TQDM and getattr(self.config, "show_progress", True):
            return tqdm(total=total, desc=desc, unit="片", leave=False, dynamic_ncols=True)
        return _NullBar()

    # ---------- 清单获取与降级 ----------
    async def _load_media_playlist(self, manifest_url: str, prefer: str):
        """逐级解析 master，最终拿到 (媒体清单URL, 媒体清单, 外挂字幕轨列表)"""
        url = manifest_url
        subtitles: List[Variant] = []
        for depth in range(self._max_master_depth + 1):
            raw = await self.fetch_bytes(url, manifest_url)
            if raw is None:
                raise RuntimeError(f"清单下载失败: {url}")
            text = self._decode(raw)
            playlist = M3U8Parser.parse(text, url)
            if isinstance(playlist, MediaPlaylist):
                return url, playlist, subtitles
            # master：记录外层声明的字幕轨，再选变体继续向下
            if playlist.subtitle_tracks:
                subtitles = playlist.subtitle_tracks
            # master：选变体继续
            variant = pick_variant(playlist.variants, prefer)
            if variant is None:
                raise RuntimeError("Master 清单中没有可用变体")
            logger.info(f"HLS 多码率清单，选择 {variant.bandwidth}bps "
                        f"{variant.resolution or ''} -> {variant.uri}")
            url = variant.uri
        raise RuntimeError("Master 清单嵌套超过上限，疑似环形引用")

    @staticmethod
    def _decode(raw: bytes) -> str:
        # m3u8 基本是 UTF-8；兼容带 BOM 与 latin-1 兜底
        try:
            return raw.decode("utf-8-sig")
        except UnicodeDecodeError:
            return raw.decode("latin-1", errors="replace")

    # ---------- 密钥 ----------
    async def _fetch_keys(self, playlist: MediaPlaylist) -> bool:
        """下载清单内所有去重密钥，写回各 segment.key.key_bytes；返回是否加密"""
        key_cache: Dict[str, HlsKey] = {}
        encrypted = False
        for seg in playlist.segments:
            if not seg.key:
                continue
            encrypted = True
            k = seg.key
            if k.method != "AES-128":
                raise NotImplementedError(f"暂不支持的 HLS 加密方式: {k.method}")
            if k.uri not in key_cache:
                kb = await self.fetch_bytes(k.uri, "")
                if kb is None:
                    raise RuntimeError(f"密钥下载失败: {k.uri}")
                k.key_bytes = kb
                key_cache[k.uri] = k
            else:
                cached = key_cache[k.uri]
                # 复用已下载密钥，但保留本行可能声明的不同 IV
                seg.key = HlsKey(method=cached.method, uri=cached.uri,
                                 iv=k.iv, key_bytes=cached.key_bytes)
        return encrypted

    # ---------- 主流程 ----------
    async def download(self, manifest_url: str, final_stem: str) -> HlsResult:
        result = HlsResult(success=False)
        tmp_dir: Optional[Path] = None
        try:
            media_url, playlist, subtitle_tracks = await self._load_media_playlist(
                manifest_url, self.config.hls_prefer_variant)

            if not playlist.segments:
                return HlsResult(success=False, error="媒体清单中没有分片")
            if not playlist.endlist:
                logger.warning(f"HLS 清单无 #EXT-X-ENDLIST（疑似直播流），"
                               f"仅下载当前 {len(playlist.segments)} 个分片，不持续追流")

            # 分片数量上限保护
            segs = playlist.segments
            if self.config.hls_max_segments > 0:
                segs = segs[: self.config.hls_max_segments]

            result.is_encrypted = await self._fetch_keys(
                MediaPlaylist(segments=segs, endlist=playlist.endlist))

            video_dir = self._video_dir()
            video_dir.mkdir(parents=True, exist_ok=True)
            tmp_dir = video_dir / f".hls_{final_stem}"
            tmp_dir.mkdir(parents=True, exist_ok=True)

            total = len(segs)
            # 仅当清单完整（有ENDLIST）且未被 max_segments 截断时，
            # 最后一个分片才是加密流真正结尾，才允许对其做 PKCS7 去填充
            truncated = self.config.hls_max_segments > 0 and len(playlist.segments) > len(segs)
            trust_last_pad = playlist.endlist and not truncated
            logger.info(f"HLS 开始下载 {manifest_url}，共 {total} 分片"
                        f"{'（AES-128 加密）' if result.is_encrypted else ''}")

            await self._download_all_segments(segs, tmp_dir, media_url, trust_last_pad)

            # 合并为 ts
            ts_path = video_dir / f"{final_stem}.ts"
            merged_bytes = await asyncio.to_thread(self._merge_segments, segs, tmp_dir, ts_path)
            result.total_bytes = merged_bytes
            result.segment_count = total

            # 可选 remux mp4
            out_path = ts_path
            if self.config.hls_merge_format in ("auto", "mp4"):
                mp4_path = video_dir / f"{final_stem}.mp4"
                ok = await self._ffmpeg_remux(ts_path, mp4_path)
                if ok:
                    out_path = mp4_path
                    result.used_ffmpeg = True
                    ts_path.unlink(missing_ok=True)  # remux 成功后删除中间 ts
                elif self.config.hls_merge_format == "mp4":
                    logger.warning("ffmpeg 不可用或转封装失败，保留 .ts 文件")

            result.local_path = out_path

            # max_file_size 约束：成片超过上限则删除并终止（字幕也不再下载）
            if self.config.max_file_size > 0 and out_path.exists():
                _sz = out_path.stat().st_size
                if _sz > self.config.max_file_size:
                    out_path.unlink(missing_ok=True)
                    ts_path.unlink(missing_ok=True)
                    raise RuntimeError(
                        f"成片 {_sz / 1024 / 1024:.1f}MB 超过 max_file_size="
                        f"{self.config.max_file_size}，已删除")

            # 下载外挂字幕轨（WebVTT 分片合并），失败不影响主视频
            if subtitle_tracks:
                try:
                    result.subtitle_paths = await self._download_subtitles(
                        subtitle_tracks, final_stem, video_dir)
                    if result.subtitle_paths:
                        logger.info(f"HLS 外挂字幕 {len(result.subtitle_paths)} 条已保存")
                except Exception as se:
                    logger.warning(f"外挂字幕下载失败（不影响视频）: {se}")

            result.success = True
            logger.info(f"HLS 合并完成: {out_path.name}，{total} 分片，"
                        f"{merged_bytes / 1024 / 1024:.2f} MB")
            return result
        except Exception as e:
            result.error = str(e)
            logger.error(f"HLS 下载失败 [{manifest_url}]: {e}")
            return result
        finally:
            # 清理临时分片目录
            if tmp_dir is not None:
                shutil.rmtree(tmp_dir, ignore_errors=True)

    async def _download_all_segments(self, segs: List[Segment], tmp_dir: Path,
                                     referer: str, trust_last_pad: bool = True):
        sem = asyncio.Semaphore(max(1, self.config.hls_segment_concurrency))
        last_index = len(segs) - 1
        failed: List[str] = []
        pbar = self._segment_bar(len(segs))

        async def worker(seg: Segment):
            seg_path = tmp_dir / f"seg_{seg.index:05d}.ts"
            # 断点复用：已存在且非空的分片直接使用
            if seg_path.exists() and seg_path.stat().st_size > 0:
                pbar.update(1)
                return
            is_last = trust_last_pad and seg.index == last_index
            gsem = self._global_sem_getter() if self._global_sem_getter else None
            async with sem:
                last_err = None
                for attempt in range(self.config.hls_segment_retries + 1):
                    try:
                        if gsem is not None:
                            async with gsem:
                                data = await self.fetch_bytes(seg.uri, referer)
                        else:
                            data = await self.fetch_bytes(seg.uri, referer)
                        if not data:
                            raise IOError("空分片")
                        # 缺省 IV：用分片媒体序列号注入
                        key = seg.key
                        if key is not None and key.iv is None:
                            key = HlsKey(method=key.method, uri=key.uri,
                                         iv=sequence_iv(seg.media_sequence),
                                         key_bytes=key.key_bytes)
                        data = decrypt_segment(data, key, is_last=is_last)
                        # 原子写入：先写 .part 再改名，避免半成品被复用
                        part = seg_path.with_suffix(".part")
                        with open(part, "wb") as f:
                            f.write(data)
                        part.replace(seg_path)
                        pbar.update(1)
                        return
                    except Exception as e:  # 单片失败重试
                        last_err = e
                        await asyncio.sleep(min(2.0, 0.3 * (attempt + 1)))
                failed.append(f"{seg.index}:{seg.uri} ({last_err})")

        await asyncio.gather(*[worker(s) for s in segs])
        pbar.close()
        if failed:
            raise IOError(f"{len(failed)} 个分片下载失败，例如: {failed[:3]}")

    @staticmethod
    def _merge_segments(segs: List[Segment], tmp_dir: Path, out_path: Path) -> int:
        """按序号顺序拼接分片为单个文件（同步，调用方放在线程里）"""
        total = 0
        with open(out_path, "wb") as out:
            for seg in segs:
                p = tmp_dir / f"seg_{seg.index:05d}.ts"
                if not p.exists():
                    raise IOError(f"缺少分片，无法合并: {p.name}")
                with open(p, "rb") as f:
                    while True:
                        chunk = f.read(1024 * 1024)
                        if not chunk:
                            break
                        out.write(chunk)
                        total += len(chunk)
        return total

    @staticmethod
    async def _ffmpeg_remux(ts_path: Path, mp4_path: Path) -> bool:
        """存在 ffmpeg 时无损转封装为 mp4；不可用或失败返回 False"""
        ffmpeg = shutil.which("ffmpeg")
        if not ffmpeg:
            return False
        try:
            proc = await asyncio.create_subprocess_exec(
                ffmpeg, "-y", "-i", str(ts_path),
                "-c", "copy", "-bsf:a", "aac_adtstoasc", str(mp4_path),
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
            )
            _, stderr = await proc.communicate()
            if proc.returncode == 0 and mp4_path.exists() and mp4_path.stat().st_size > 0:
                return True
            logger.debug(f"ffmpeg转封装失败: {stderr[-300:].decode('utf-8', 'ignore') if stderr else ''}")
        except Exception as e:
            logger.debug(f"ffmpeg调用异常: {e}")
        mp4_path.unlink(missing_ok=True) if mp4_path.exists() else None
        return False

    # ------------------------------------------------------------------
    # 外挂字幕（WebVTT over HLS）
    # ------------------------------------------------------------------
    async def _download_subtitles(self, tracks: List[Variant], final_stem: str,
                                  video_dir: Path) -> List[Path]:
        """下载每条外挂字幕轨：其 URI 本身是一个 m3u8，内含若干 WebVTT 分片"""
        saved: List[Path] = []
        used_names: set = set()
        sem = asyncio.Semaphore(max(1, self.config.hls_segment_concurrency))

        async def fetch_seg(seg):
            async with sem:
                raw = await self.fetch_bytes(seg.uri, "")
                return seg.index, (self._decode(raw) if raw else "")

        for idx, tr in enumerate(tracks):
            try:
                raw = await self.fetch_bytes(tr.uri, "")
                if raw is None:
                    continue
                sub_pl = M3U8Parser.parse(self._decode(raw), tr.uri)
                if not isinstance(sub_pl, MediaPlaylist) or not sub_pl.segments:
                    continue
                pairs = await asyncio.gather(*[fetch_seg(s) for s in sub_pl.segments])
                pairs.sort(key=lambda x: x[0])
                merged = self._merge_webvtt([t for _, t in pairs])

                tag = (tr.lang or tr.name or f"sub{idx}").strip() or f"sub{idx}"
                tag = re.sub(r'[<>:"/\\|?*\s]+', "_", tag)
                name, k = f"{final_stem}.{tag}.vtt", 1
                while name in used_names or (video_dir / name).exists():
                    name = f"{final_stem}.{tag}.{k}.vtt"
                    k += 1
                used_names.add(name)
                path = video_dir / name
                path.write_text(merged, encoding="utf-8")
                saved.append(path)
            except Exception as e:
                logger.warning(f"字幕轨下载失败 {tr.uri}: {e}")
        return saved

    @staticmethod
    def _parse_vtt_clock(value: str) -> float:
        """解析 HH:MM:SS.mmm 或 MM:SS.mmm 为秒"""
        parts = value.strip().split(":")
        try:
            if len(parts) == 3:
                return int(parts[0]) * 3600 + int(parts[1]) * 60 + float(parts[2])
            if len(parts) == 2:
                return int(parts[0]) * 60 + float(parts[1])
        except ValueError:
            return 0.0
        return 0.0

    @staticmethod
    def _fmt_vtt_clock(sec: float) -> str:
        if sec < 0:
            sec = 0.0
        h = int(sec // 3600)
        m = int((sec % 3600) // 60)
        return f"{h:02d}:{m:02d}:{sec % 60:06.3f}"

    @classmethod
    def _shift_vtt_timestamps(cls, text: str, offset: float) -> str:
        if offset == 0:
            return text
        clock = re.compile(r"\d{1,2}:\d{2}:\d{2}\.\d{3}|\d{1,2}:\d{2}\.\d{3}")
        return clock.sub(lambda m: cls._fmt_vtt_clock(cls._parse_vtt_clock(m.group(0)) + offset), text)

    @classmethod
    def _merge_webvtt(cls, texts: List[str]) -> str:
        """
        合并多个 WebVTT 分片：
        - 仅保留一个 WEBVTT 头，去掉各分片自带头部
        - 依据 X-TIMESTAMP-MAP(MPEGTS,LOCAL) 把每片 cue 时间对齐到全局时间轴
        """
        bodies = []
        for raw in texts:
            t = raw.replace("﻿", "").lstrip()
            head = ""
            if t.upper().startswith("WEBVTT"):
                head, _, t = t.partition("\n\n")  # 第一个空行之前是头部块
            offset = 0.0
            ts = re.search(r"X-TIMESTAMP-MAP=([^\n]*)", head)
            if ts:
                mpegts = re.search(r"MPEGTS:(\d+)", ts.group(1))
                local = re.search(r"LOCAL:([\d:.]+)", ts.group(1))
                if mpegts:
                    offset = int(mpegts.group(1)) / 90000.0
                if local:
                    offset -= cls._parse_vtt_clock(local.group(1))
            bodies.append(cls._shift_vtt_timestamps(t.strip(), offset))
        body = "\n\n".join(b for b in bodies if b)
        if not body.upper().startswith("WEBVTT"):
            body = "WEBVTT\n\n" + body
        return body + "\n"
