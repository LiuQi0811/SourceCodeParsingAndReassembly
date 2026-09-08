#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
HLS（m3u8）切片下载与合并器 —— 通用工具
==========================================
输入任意一条 m3u8 地址，完成：主列表选流 → 逐片并发下载 → 解密 → 合并 → 封装成 mp4。

典型用法：
    python3 HLS切片下载合并.py --url https://example.com/index.m3u8 --out 视频.mp4
    python3 HLS切片下载合并.py --url https://example.com/index.m3u8 --variant 720p --workers 16
    python3 HLS切片下载合并.py --from-jsonl 茶杯狐播放地址.jsonl --out-dir ./downloads
    python3 HLS切片下载合并.py --url <直播流> --live --max-seconds 300        # 录制直播
    python3 HLS切片下载合并.py --self-test                                    # 本地生成 HLS 流，全流程自检

实现的协议能力（RFC 8216 / HLS 客户端标准行为）：
    · 主播放列表（master）：按分辨率/码率挑选或自动选最高清
    · 媒体播放列表：EXTINF / EXT-X-MEDIA-SEQUENCE / EXT-X-ENDLIST / EXT-X-DISCONTINUITY
    · EXT-X-BYTERANGE 单文件分片（Range 请求）
    · EXT-X-MAP 初始化段（fMP4 / .m4s 流，直接拼成 mp4）
    · EXT-X-KEY METHOD=AES-128 解密（CBC + PKCS7，IV 取 IV 属性或分片序号）
    · 独立音轨（EXT-X-MEDIA TYPE=AUDIO）：下载后用 ffmpeg 混流
    · 直播流持续拉取（--live），断点续传（已下分片自动跳过）

不实现、也不应实现的部分：
    · SAMPLE-AES、Widevine / FairPlay / PlayReady 等 DRM —— 检测到直接报错退出；
    · 任何绕过REFERER防盗链校验、签名鉴权、付费鉴权的对抗逻辑（本工具只按你传入的
      --referer / --header 原样携带，不伪造、不破解）。

合法性：本工具是通用 HLS 客户端实现，请只对自己拥有权利或已获授权的流使用。
"""
from __future__ import annotations

import argparse
import os
import re
import shutil
import subprocess
import sys
import tempfile
import threading
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from dataclasses import dataclass, field
from typing import Dict, List, Optional, Tuple
from urllib.parse import urljoin, urlparse

import requests

try:
    from cryptography.hazmat.primitives.ciphers import Cipher, algorithms, modes
    _HAS_CRYPTO = True
except ImportError:  # pragma: no cover
    _HAS_CRYPTO = False

try:
    from tqdm import tqdm
except ImportError:  # pragma: no cover
    tqdm = None

import logging
log = logging.getLogger("hls")

FFMPEG = shutil.which("ffmpeg")
UA = ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36")


# --------------------------------------------------------------------------- #
# 数据结构
# --------------------------------------------------------------------------- #
@dataclass
class KeyInfo:
    method: str = "NONE"
    uri: str = ""
    iv: Optional[bytes] = None
    keyformat: str = "identity"


@dataclass
class Segment:
    index: int
    uri: str
    duration: float = 0.0
    seq: int = 0
    byterange: Optional[Tuple[int, int]] = None   # (length, offset)
    key: Optional[KeyInfo] = None
    discontinuity: bool = False
    path: str = ""                                # 下载后的本地路径


@dataclass
class MediaPlaylist:
    segments: List[Segment] = field(default_factory=list)
    endlist: bool = False
    target_duration: float = 0.0
    media_sequence: int = 0
    init_map: Optional[Segment] = None            # EXT-X-MAP
    is_fmp4: bool = False


@dataclass
class Variant:
    url: str
    bandwidth: int = 0
    resolution: str = ""
    codecs: str = ""
    audio_group: str = ""


# --------------------------------------------------------------------------- #
# 工具函数
# --------------------------------------------------------------------------- #
def safe_name(s: str, default: str = "output") -> str:
    s = re.sub(r'[\\/:*?"<>|\r\n\t]+', "_", (s or "").strip())
    s = re.sub(r"\s+", " ", s).strip(" .")
    return s[:120] or default


def fmt_bytes(n: float) -> str:
    for unit in ("B", "KB", "MB", "GB"):
        if abs(n) < 1024:
            return f"{n:.1f}{unit}"
        n /= 1024
    return f"{n:.1f}TB"


def fmt_time(sec: float) -> str:
    h, rem = divmod(int(sec), 3600)
    m, s = divmod(rem, 60)
    return f"{h:02d}:{m:02d}:{s:02d}" if h else f"{m:02d}:{s:02d}"


def run(cmd: List[str], timeout: int = 3600) -> Tuple[int, str]:
    """执行外部命令，返回 (返回码, stdout+stderr)。"""
    try:
        p = subprocess.run(cmd, capture_output=True, timeout=timeout)
        return p.returncode, (p.stdout + p.stderr).decode("utf-8", "ignore")
    except FileNotFoundError:
        return 127, "命令不存在"
    except subprocess.TimeoutExpired:
        return 124, "执行超时"


class RateLimiter:
    """极简全局限速（字节/秒）。"""

    def __init__(self, bytes_per_sec: float = 0):
        self.rate = bytes_per_sec
        self.lock = threading.Lock()
        self.last = time.time()

    def wait(self, nbytes: int) -> None:
        if not self.rate or nbytes <= 0:
            return
        with self.lock:
            now = time.time()
            expected = nbytes / self.rate
            elapsed = now - self.last
            if elapsed < expected:
                time.sleep(expected - elapsed)
            self.last = time.time()


# --------------------------------------------------------------------------- #
# 下载器
# --------------------------------------------------------------------------- #
class HLSDownloader:
    def __init__(self,
                 workers: int = 8,
                 retries: int = 3,
                 timeout: int = 20,
                 referer: str = "",
                 headers: Optional[Dict[str, str]] = None,
                 proxy: str = "",
                 max_speed: float = 0,
                 keep_segments: bool = False):
        self.workers = max(1, workers)
        self.retries = max(1, retries)
        self.timeout = timeout
        self.referer = referer
        self.extra_headers: Dict[str, str] = dict(headers or {})
        self.keep_segments = keep_segments
        self.limiter = RateLimiter(max_speed)
        self.session = requests.Session()
        self.session.headers.update({
            "User-Agent": UA,
            "Accept": "*/*",
            "Accept-Language": "zh-CN,zh;q=0.9",
        })
        if referer:
            self.session.headers["Referer"] = referer
        if proxy:
            self.session.proxies = {"http": proxy, "https": proxy}
        self.key_cache: Dict[str, bytes] = {}
        self._bytes = 0
        self._lock = threading.Lock()

    # ---- 基础请求 ---------------------------------------------------------
    def get_text(self, url: str) -> Optional[str]:
        for i in range(1, self.retries + 1):
            try:
                r = self.session.get(url, timeout=self.timeout)
                if r.status_code == 200:
                    r.encoding = r.encoding or "utf-8"
                    return r.text
                log.warning("列表请求 [%s] %s（第 %s 次）", r.status_code, url, i)
            except requests.RequestException as exc:
                log.warning("列表请求异常 %s：%s（第 %s 次）", url, exc, i)
            time.sleep(1.5 * i)
        return None

    def get_bytes(self, url: str, byterange: Optional[Tuple[int, int]] = None) -> Optional[bytes]:
        headers = {}
        if byterange:
            length, offset = byterange
            headers["Range"] = f"bytes={offset}-{offset + length - 1}"
        for i in range(1, self.retries + 1):
            try:
                r = self.session.get(url, timeout=self.timeout, headers=headers)
                if r.status_code in (200, 206):
                    data = r.content
                    self.limiter.wait(len(data))
                    with self._lock:
                        self._bytes += len(data)
                    return data
                log.warning("分片请求 [%s] %s（第 %s 次）", r.status_code, url, i)
            except requests.RequestException as exc:
                log.warning("分片请求异常 %s：%s（第 %s 次）", url, exc, i)
            time.sleep(1.2 * i)
        return None

    # ---- 播放列表解析 ------------------------------------------------------
    @staticmethod
    def parse_master(text: str, base: str) -> List[Variant]:
        """解析主播放列表，返回可选清晰度列表。"""
        variants: List[Variant] = []
        cur: Optional[Dict] = None
        for raw in text.splitlines():
            line = raw.strip()
            if line.startswith("#EXT-X-STREAM-INF"):
                cur = {
                    "bandwidth": int((re.search(r"BANDWIDTH=(\d+)", line) or [None, 0])[1] or 0),
                    "resolution": (re.search(r"RESOLUTION=([\dx]+)", line) or [None, ""])[1] or "",
                    "codecs": (re.search(r'CODECS="([^"]+)"', line) or [None, ""])[1] or "",
                    "audio_group": (re.search(r'AUDIO="([^"]+)"', line) or [None, ""])[1] or "",
                }
            elif cur is not None and line and not line.startswith("#"):
                variants.append(Variant(url=urljoin(base, line), **cur))
                cur = None
        return variants

    @staticmethod
    def parse_audio_renditions(text: str, base: str) -> Dict[str, Variant]:
        """主列表里的独立音轨：#EXT-X-MEDIA:TYPE=AUDIO,GROUP-ID="aac",URI="..." """
        out: Dict[str, Variant] = {}
        for line in text.splitlines():
            if not line.startswith("#EXT-X-MEDIA") or "TYPE=AUDIO" not in line:
                continue
            uri = re.search(r'URI="([^"]+)"', line)
            grp = re.search(r'GROUP-ID="([^"]+)"', line)
            name = re.search(r'NAME="([^"]+)"', line)
            if uri and grp and grp.group(1) not in out:
                out[grp.group(1)] = Variant(url=urljoin(base, uri.group(1)),
                                            codecs=name.group(1) if name else "audio")
        return out

    @staticmethod
    def parse_media(text: str, base: str) -> MediaPlaylist:
        """解析媒体播放列表。状态机：key / map / byterange 会跨行延续。"""
        pl = MediaPlaylist()
        cur_key: Optional[KeyInfo] = None
        cur_range: Optional[Tuple[int, int]] = None
        cur_map_uri: Optional[str] = None
        cur_map_range: Optional[Tuple[int, int]] = None
        cur_duration = 0.0
        cur_disc = False
        seq = 0
        idx = 0

        for raw in text.splitlines():
            line = raw.strip()
            if not line:
                continue

            if line.startswith("#EXT-X-MEDIA-SEQUENCE"):
                seq = int(re.search(r"(\d+)", line).group(1))
                pl.media_sequence = seq
            elif line.startswith("#EXT-X-TARGETDURATION"):
                pl.target_duration = float(re.search(r"(\d+)", line).group(1))
            elif line.startswith("#EXT-X-ENDLIST"):
                pl.endlist = True
            elif line.startswith("#EXT-X-DISCONTINUITY"):
                cur_disc = True
            elif line.startswith("#EXT-X-KEY"):
                attrs = dict(re.findall(r'([A-Z0-9\-]+)=("[^"]*"|[^,]*)', line))
                unq = lambda s: (s or "").strip().strip('"')
                method = unq(attrs.get("METHOD", "NONE")).upper()
                keyformat = unq(attrs.get("KEYFORMAT", "identity"))
                if method != "NONE" and keyformat.lower() not in ("identity", ""):
                    raise RuntimeError(
                        f"该流使用 DRM/非标准密钥体系（KEYFORMAT={keyformat}），本工具不支持且不尝试绕过")
                if method == "NONE":
                    cur_key = None
                else:
                    if method not in ("AES-128",):
                        raise RuntimeError(f"不支持的加密方式：{method}")
                    iv_hex = unq(attrs.get("IV", ""))
                    iv = bytes.fromhex(iv_hex.lower().replace("0x", "")) if iv_hex else None
                    cur_key = KeyInfo(method=method, uri=urljoin(base, unq(attrs.get("URI", ""))),
                                      iv=iv, keyformat=keyformat)
            elif line.startswith("#EXT-X-MAP"):
                attrs = dict(re.findall(r'([A-Z0-9\-]+)=("[^"]*"|[^,]*)', line))
                unq = lambda s: (s or "").strip().strip('"')
                cur_map_uri = urljoin(base, unq(attrs.get("URI", "")))
                br = unq(attrs.get("BYTERANGE", ""))
                cur_map_range = tuple(int(x) for x in br.split("@")) if br else None
                if len(cur_map_range or ()) == 1:
                    cur_map_range = (cur_map_range[0], 0)
                pl.is_fmp4 = True
            elif line.startswith("#EXT-X-BYTERANGE"):
                nums = re.findall(r"(\d+)", line)
                if len(nums) >= 2:
                    cur_range = (int(nums[0]), int(nums[1]))
                elif nums:
                    # 无 @offset 时表示紧接上一片末尾（此处用上一片末端推算）
                    prev = pl.segments[-1] if pl.segments else None
                    off = 0
                    if prev and prev.byterange:
                        off = prev.byterange[1] + prev.byterange[0]
                    cur_range = (int(nums[0]), off)
            elif line.startswith("#EXTINF"):
                cur_duration = float(re.search(r"([\d.]+)", line).group(1))
            elif line.startswith("#"):
                continue
            else:
                # 真正的分片 URI
                seg = Segment(index=idx, uri=urljoin(base, line), duration=cur_duration,
                              seq=seq, byterange=cur_range, key=cur_key, discontinuity=cur_disc)
                pl.segments.append(seg)
                if cur_map_uri and pl.init_map is None:
                    map_seg = Segment(index=-1, uri=cur_map_uri, byterange=cur_map_range)
                    pl.init_map = map_seg
                idx += 1
                seq += 1
                cur_duration, cur_range, cur_disc = 0.0, None, False
        return pl

    # ---- 选流 -------------------------------------------------------------
    @staticmethod
    def pick_variant(variants: List[Variant], prefer: str = "best") -> Variant:
        """prefer: best / worst / 具体高度如 720p / 具体分辨率如 1280x720"""
        if not variants:
            raise RuntimeError("播放列表里没有任何可选流")
        if prefer == "best":
            return max(variants, key=lambda v: (int((v.resolution or "0x0").split("x")[-1] or 0), v.bandwidth))
        if prefer == "worst":
            return min(variants, key=lambda v: (int((v.resolution or "0x0").split("x")[-1] or 0), v.bandwidth))
        if re.fullmatch(r"\d+[pPiI]", prefer):
            h = int(prefer[:-1])
            cands = [v for v in variants if int((v.resolution or "0x0").split("x")[-1] or 0) > 0]
            if cands:
                return min(cands, key=lambda v: abs(int(v.resolution.split("x")[-1]) - h))
        for v in variants:
            if v.resolution == prefer:
                return v
        raise RuntimeError(f"未匹配到 {prefer}，可用：{[v.resolution or v.bandwidth for v in variants]}")

    # ---- 密钥 -------------------------------------------------------------
    def fetch_key(self, key: KeyInfo) -> bytes:
        if not key.uri:
            raise RuntimeError("EXT-X-KEY 缺少 URI")
        if key.uri in self.key_cache:
            return self.key_cache[key.uri]
        data = self.get_bytes(key.uri)
        if not data or len(data) not in (16, 24, 32):
            raise RuntimeError(f"密钥下载失败或长度异常：{key.uri}（{len(data) if data else 0} 字节）")
        self.key_cache[key.uri] = data
        log.info("已获取密钥 %s（%s 字节）", key.uri, len(data))
        return data

    @staticmethod
    def decrypt(data: bytes, key_bytes: bytes, iv: bytes) -> bytes:
        """HLS AES-128：CBC + PKCS7 填充（RFC 8216 标准客户端行为）。"""
        if not _HAS_CRYPTO:
            raise RuntimeError("缺少 cryptography 库，无法解密：pip install cryptography")
        decryptor = Cipher(algorithms.AES(key_bytes), modes.CBC(iv)).decryptor()
        plain = decryptor.update(data) + decryptor.finalize()
        pad = plain[-1]
        if 1 <= pad <= 16 and plain[-pad:] == bytes([pad]) * pad:
            plain = plain[:-pad]
        return plain

    # ---- 分片下载 ---------------------------------------------------------
    def download_segments(self, segs: List[Segment], tmpdir: str,
                          progress_desc: str = "下载切片") -> List[Segment]:
        os.makedirs(tmpdir, exist_ok=True)

        def target(seg: Segment) -> str:
            ext = ".m4s" if seg.uri.split("?")[0].endswith((".m4s", ".mp4")) else ".ts"
            return os.path.join(tmpdir, f"{seg.index:06d}{ext}")

        todo = []
        for s in segs:
            s.path = target(s)
            if os.path.exists(s.path) and os.path.getsize(s.path) > 0:
                continue          # 断点续传：已有非空文件直接跳过
            todo.append(s)

        skipped = len(segs) - len(todo)
        if skipped:
            log.info("断点续传：跳过已完成的 %s 个分片", skipped)
        if not todo:
            return segs

        done = 0
        failed: List[Segment] = []
        bar = tqdm(total=len(todo), unit="片", desc=progress_desc) if tqdm else None

        def worker(seg: Segment) -> bool:
            data = self.get_bytes(seg.uri, seg.byterange)
            if data is None:
                return False
            with open(seg.path, "wb") as f:
                f.write(data)
            return True

        with ThreadPoolExecutor(max_workers=self.workers) as pool:
            futures = {pool.submit(worker, s): s for s in todo}
            for fut in as_completed(futures):
                seg = futures[fut]
                try:
                    ok = fut.result()
                except Exception as exc:      # noqa: BLE001
                    log.warning("分片 %s 异常：%s", seg.uri, exc)
                    ok = False
                if ok:
                    done += 1
                else:
                    failed.append(seg)
                if bar:
                    bar.update(1)
                    bar.set_postfix_str(fmt_bytes(self._bytes))
                elif done % 20 == 0 or done == len(todo):
                    print(f"  进度 {done}/{len(todo)}  已收 {fmt_bytes(self._bytes)}", flush=True)
        if bar:
            bar.close()

        if failed:
            names = ", ".join(s.uri.rsplit("/", 1)[-1] for s in failed[:5])
            raise RuntimeError(f"{len(failed)} 个分片下载失败（如 {names}）。"
                               f"可重试本命令（已下分片会自动跳过）")
        log.info("下载完成：%s 片 / %s", done, fmt_bytes(self._bytes))
        return segs

    # ---- 合并 -------------------------------------------------------------
    def assemble(self, segs: List[Segment], init_map: Optional[Segment],
                 tmpdir: str, merged_path: str) -> str:
        """按序解密并写成单一文件；fMP4 前面加 init 段。"""
        segs = sorted(segs, key=lambda s: s.index)
        total = sum(s.duration for s in segs)
        log.info("开始合并 %s 个分片（约 %s）…", len(segs), fmt_time(total))

        with open(merged_path, "wb") as out:
            if init_map and os.path.exists(init_map.path or ""):
                with open(init_map.path, "rb") as f:
                    out.write(f.read())
            for s in segs:
                if not os.path.exists(s.path or ""):
                    raise RuntimeError(f"分片缺失：{s.path}")
                with open(s.path, "rb") as f:
                    data = f.read()
                if s.key and s.key.method == "AES-128":
                    key_bytes = self.fetch_key(s.key)
                    iv = s.key.iv or s.seq.to_bytes(16, "big")
                    data = self.decrypt(data, key_bytes, iv)
                out.write(data)
        log.info("合并完成：%s（%s）", merged_path, fmt_bytes(os.path.getsize(merged_path)))
        return merged_path

    @staticmethod
    def remux(src: str, dst: str, faststart: bool = True) -> str:
        """用 ffmpeg 无损封装（-c copy，不重编码）。"""
        if not FFMPEG:
            log.warning("未检测到 ffmpeg，保留原始容器文件：%s", src)
            return src
        cmd = [FFMPEG, "-y", "-hide_banner", "-loglevel", "error",
               "-fflags", "+genpts", "-i", src, "-c", "copy"]
        if faststart:
            cmd += ["-movflags", "+faststart"]
        cmd += [dst]
        code, msg = run(cmd)
        if code != 0:
            log.warning("封装失败（%s），保留中间文件：%s\n%s", code, src, msg[:400])
            return src
        log.info("封装完成：%s（%s）", dst, fmt_bytes(os.path.getsize(dst)))
        return dst

    @staticmethod
    def mux_av(video: str, audio: str, dst: str) -> str:
        if not FFMPEG:
            log.warning("未检测到 ffmpeg，无法混流音轨，仅输出视频：%s", video)
            return video
        cmd = [FFMPEG, "-y", "-hide_banner", "-loglevel", "error",
               "-i", video, "-i", audio, "-c", "copy", "-map", "0:v:0", "-map", "1:a:0",
               "-movflags", "+faststart", dst]
        code, msg = run(cmd)
        if code != 0:
            log.warning("混流失败，仅输出视频：%s", msg[:300])
            return video
        return dst

    # ---- 主流程 -----------------------------------------------------------
    def download(self, m3u8_url: str, out_path: str, variant: str = "best",
                 live: bool = False, max_seconds: float = 0,
                 no_remux: bool = False, tmp_root: Optional[str] = None) -> str:
        t0 = time.time()
        tmpdir = tempfile.mkdtemp(prefix="hls_", dir=tmp_root)
        out_path = os.path.abspath(out_path)
        os.makedirs(os.path.dirname(out_path) or ".", exist_ok=True)
        stem, _ = os.path.splitext(out_path)

        try:
            text = self.get_text(m3u8_url)
            if not text:
                raise RuntimeError(f"无法获取播放列表：{m3u8_url}")

            audio_url = ""
            if "#EXT-X-STREAM-INF" in text:                    # 主列表
                variants = self.parse_master(text, m3u8_url)
                log.info("主列表共 %s 个清晰度：%s", len(variants),
                         [v.resolution or f"{v.bandwidth//1000}k" for v in variants])
                chosen = self.pick_variant(variants, variant)
                log.info("选用：%s（%s，%s bps）", chosen.resolution or "默认",
                         chosen.codecs or "-", chosen.bandwidth)
                rends = self.parse_audio_renditions(text, m3u8_url)
                if chosen.audio_group in rends:
                    audio_url = rends[chosen.audio_group].url
                m3u8_url, text = chosen.url, None

            # 媒体列表（直播模式下循环拉取）
            all_segs: List[Segment] = []
            init_map: Optional[Segment] = None
            seen = set()
            endlist = False
            round_no = 0

            while True:
                round_no += 1
                text = self.get_text(m3u8_url)
                if not text:
                    raise RuntimeError(f"无法获取媒体列表：{m3u8_url}")
                pl = self.parse_media(text, m3u8_url)
                init_map = init_map or pl.init_map
                endlist = pl.endlist

                fresh = []
                for s in pl.segments:
                    token = (s.uri, s.byterange, s.seq)
                    if token in seen:
                        continue
                    seen.add(token)
                    # 注意：必须在 extend 之前按顺序编号，否则所有分片 index 都会是同一个值
                    s.index = len(all_segs) + len(fresh)
                    fresh.append(s)
                all_segs.extend(fresh)
                log.info("第 %s 轮拉取：新增 %s 片，累计 %s 片，ENDLIST=%s",
                         round_no, len(fresh), len(all_segs), endlist)

                if not live or endlist:
                    break
                if max_seconds and sum(s.duration for s in all_segs) >= max_seconds:
                    log.info("达到录制上限 %ss，停止", max_seconds)
                    break
                time.sleep(max(0.5, (pl.target_duration or 4) * 0.8))

            if not all_segs:
                raise RuntimeError("播放列表里没有解析到任何分片")

            # 下载（含 init 段）
            targets = list(all_segs)
            if init_map:
                init_map.index = -1
                init_map.path = os.path.join(tmpdir, "init.mp4")
                if not (os.path.exists(init_map.path) and os.path.getsize(init_map.path) > 0):
                    data = self.get_bytes(init_map.uri, init_map.byterange)
                    if not data:
                        raise RuntimeError("初始化段（EXT-X-MAP）下载失败")
                    with open(init_map.path, "wb") as f:
                        f.write(data)
                else:
                    targets = [init_map] + targets
            self.download_segments(targets, tmpdir)

            merged = os.path.join(tmpdir, "merged" + (".mp4" if pl.is_fmp4 else ".ts"))
            self.assemble(all_segs, init_map, tmpdir, merged)

            final = merged
            if not no_remux:
                if pl.is_fmp4:
                    final = self.remux(merged, stem + ".mp4")   # fMP4 一般可直接播，仍规范封装一次
                else:
                    final = self.remux(merged, stem + ".mp4")
            else:
                keep = os.path.join(os.path.dirname(out_path), os.path.basename(merged))
                shutil.copy(merged, keep)
                final = keep

            # 独立音轨
            if audio_url:
                log.info("检测到独立音轨，开始下载并混流：%s", audio_url)
                a_dir = tempfile.mkdtemp(prefix="hls_a_", dir=tmp_root)
                try:
                    a_text = self.get_text(audio_url)
                    if a_text:
                        a_pl = self.parse_media(a_text, audio_url)
                        self.download_segments(a_pl.segments, a_dir, "下载音轨")
                        a_merged = os.path.join(a_dir, "audio.ts")
                        self.assemble(a_pl.segments, a_pl.init_map, a_dir, a_merged)
                        v_only = os.path.join(a_dir, "video_only.mp4")
                        v_final = self.remux(merged, v_only) if not pl.is_fmp4 else merged
                        audio_final = self.remux(a_merged, os.path.join(a_dir, "audio.m4a"))
                        mixed = self.mux_av(v_final, audio_final, stem + "_av.mp4")
                        if mixed != v_final:
                            final = mixed
                except Exception as exc:      # noqa: BLE001
                    log.warning("音轨处理失败（忽略，保留视频）：%s", exc)
                finally:
                    if not self.keep_segments:
                        shutil.rmtree(a_dir, ignore_errors=True)

            dur = sum(s.duration for s in all_segs)
            print(f"\n✅ 完成：{final}\n   分片 {len(all_segs)} 个 | 时长 {fmt_time(dur)} | "
                  f"流量 {fmt_bytes(self._bytes)} | 耗时 {time.time() - t0:.1f}s", flush=True)
            return final

        finally:
            if self.keep_segments:
                log.info("已保留分片目录：%s", tmpdir)
            else:
                shutil.rmtree(tmpdir, ignore_errors=True)


# --------------------------------------------------------------------------- #
# 从爬虫产物批量下载
# --------------------------------------------------------------------------- #
def iter_jsonl(path: str):
    import json
    with open(path, "r", encoding="utf-8-sig") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            try:
                yield json.loads(line)
            except json.JSONDecodeError:
                continue


def batch_from_jsonl(dl: HLSDownloader, jsonl: str, out_dir: str,
                     only: str = "", limit: int = 0, **kw) -> List[str]:
    """读取上一步爬虫产出的「播放地址.jsonl」，逐条下载。"""
    os.makedirs(out_dir, exist_ok=True)
    results, n = [], 0
    for rec in iter_jsonl(jsonl):
        url = rec.get("stream_url") or ""
        if not url.startswith("http") or ".m3u8" not in url:
            continue
        if only and only not in (rec.get("title", "") + rec.get("episode", "")):
            continue
        name = safe_name(f"{rec.get('title','')}_{rec.get('episode','')}", "video")
        dst = os.path.join(out_dir, f"{name}.mp4")
        print(f"\n▶ [{n+1}] {name}  {url[:100]}")
        try:
            sub = HLSDownloader(workers=dl.workers, retries=dl.retries, timeout=dl.timeout,
                                referer=rec.get("referer") or dl.referer,
                                headers=dl.extra_headers, max_speed=dl.limiter.rate)
            results.append(sub.download(url, dst, **kw))
        except Exception as exc:      # noqa: BLE001
            log.error("下载失败 %s：%s", name, exc)
        n += 1
        if limit and n >= limit:
            break
    print(f"\n批量完成：成功 {len(results)} / 共 {n}")
    return results


# --------------------------------------------------------------------------- #
# 自检：本地生成 HLS 流（明文 + AES-128），走完整下载合并流程
# --------------------------------------------------------------------------- #
def _serve_dir(directory: str, port: int = 0):
    """在后台起一个静态文件服务，port=0 时自动选空闲端口；返回 (server, 实际端口)。"""
    import http.server
    import socketserver

    class Quiet(http.server.SimpleHTTPRequestHandler):
        def __init__(self, *a, **kw):
            super().__init__(*a, directory=directory, **kw)

        def log_message(self, *a):
            pass

    class Server(socketserver.ThreadingTCPServer):
        allow_reuse_address = True
        daemon_threads = True

    srv = Server(("127.0.0.1", port), Quiet)
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    return srv, srv.server_address[1]


def _probe(path: str) -> Tuple[bool, float, str]:
    code, out = run(["ffprobe", "-v", "error", "-show_entries",
                     "format=duration:stream=codec_type", "-of", "json", path])
    if code != 0:
        return False, 0.0, out[:200]
    import json
    try:
        info = json.loads(out)
        return True, float(info["format"]["duration"]), ",".join(
            s.get("codec_type", "") for s in info.get("streams", []))
    except Exception:                                # noqa: BLE001
        return False, 0.0, "ffprobe 输出解析失败"


def _video_frames(path: str) -> List[str]:
    """解码视频流并返回逐帧 md5 序列，用于内容级校验（顺序错乱/重复拼接都会被发现）。"""
    code, out = run(["ffmpeg", "-v", "error", "-i", path, "-map", "0:v:0", "-f", "framemd5", "-"])
    if code != 0:
        return []
    return [ln.split(",")[-1].strip() for ln in out.splitlines() if ln and not ln.startswith("#")]


def self_test() -> int:
    if not FFMPEG:
        print("❌ 未检测到 ffmpeg，无法自检")
        return 1
    work = tempfile.mkdtemp(prefix="hls_test_")
    srv = None
    ok = True
    try:
        print("① 生成基准片源（8s，每 2s 一个关键帧 → 切成 4 片）…")
        ref = os.path.join(work, "ref.mp4")
        code, msg = run([FFMPEG, "-y", "-hide_banner", "-loglevel", "error",
                         "-f", "lavfi", "-i", "testsrc=duration=8:size=320x240:rate=15",
                         "-f", "lavfi", "-i", "sine=frequency=440:duration=8",
                         "-c:v", "libx264", "-pix_fmt", "yuv420p", "-preset", "ultrafast",
                         "-g", "30", "-keyint_min", "30", "-sc_threshold", "0",
                         "-force_key_frames", "expr:gte(t,n_forced*2)",
                         "-c:a", "aac", "-shortest", ref])
        if code != 0:
            print("❌ 基准片源生成失败：", msg[:400]); return 1
        ref_frames = _video_frames(ref)
        print(f"   基准视频帧数：{len(ref_frames)}")

        # 三种 HLS 形态都从同一个基准片源用 -c copy 切出（保证分片内容可逐帧比对）
        seg_common = ["-c", "copy", "-f", "hls", "-hls_time", "2", "-hls_list_size", "0"]

        plain = os.path.join(work, "plain.m3u8")
        code, msg = run([FFMPEG, "-y", "-hide_banner", "-loglevel", "error", "-i", ref,
                         *seg_common, "-hls_segment_filename",
                         os.path.join(work, "p_%03d.ts"), plain])
        if code != 0:
            print("❌ 明文流生成失败：", msg[:400]); return 1

        keyfile = os.path.join(work, "enc.key")
        with open(keyfile, "wb") as f:
            f.write(bytes(range(16)))
        keyinfo = os.path.join(work, "keyinfo")
        with open(keyinfo, "w", encoding="utf-8") as f:
            f.write(f"enc.key\n{keyfile}\n0123456789abcdef0123456789abcdef\n")
        enc_m3u8 = os.path.join(work, "enc.m3u8")
        code, msg = run([FFMPEG, "-y", "-hide_banner", "-loglevel", "error", "-i", ref,
                         *seg_common, "-hls_key_info_file", keyinfo, "-hls_enc", "1",
                         "-hls_segment_filename", os.path.join(work, "e_%03d.ts"), enc_m3u8])
        if code != 0:
            print("❌ 加密流生成失败：", msg[:400]); return 1

        fmp4 = os.path.join(work, "fmp4.m3u8")
        code, msg = run([FFMPEG, "-y", "-hide_banner", "-loglevel", "error", "-i", ref,
                         *seg_common, "-hls_segment_type", "fmp4",
                         "-hls_fmp4_init_filename", "init.mp4",
                         "-hls_segment_filename", os.path.join(work, "f_%03d.m4s"), fmp4])
        if code != 0:
            print("❌ fMP4 流生成失败：", msg[:400]); return 1

        n_src = len([f for f in os.listdir(work) if f.endswith((".ts", ".m4s"))]) // 3
        print(f"   每种流切出 {n_src} 个分片")

        master = os.path.join(work, "master.m3u8")
        code, msg = run([FFMPEG, "-y", "-hide_banner", "-loglevel", "error", "-i", ref,
                         *seg_common, "-master_pl_name", "master.m3u8",
                         "-var_stream_map", "v:0,a:0",
                         "-hls_segment_filename", os.path.join(work, "m_%03d.ts"),
                         os.path.join(work, "stream_%v.m3u8")])
        if code != 0 or not os.path.exists(master):
            print("❌ 主播放列表生成失败：", msg[:400]); return 1

        # 直播形态：去掉 #EXT-X-ENDLIST，模拟持续更新的列表（验证轮询 + 去重不会无限增长）
        live_txt = "".join(l + "\n" for l in open(plain, encoding="utf-8")
                           if not l.startswith("#EXT-X-ENDLIST"))
        with open(os.path.join(work, "live.m3u8"), "w", encoding="utf-8") as f:
            f.write(live_txt)

        srv, port = _serve_dir(work)
        base = f"http://127.0.0.1:{port}"
        time.sleep(0.5)

        # 反证：AES 加密的原始分片本身无法解码，说明产物确实经过解密而非直接拼接
        enc_seg = next((os.path.join(work, f) for f in sorted(os.listdir(work))
                        if f.startswith("e_") and f.endswith(".ts")), "")
        if enc_seg:
            playable = bool(_video_frames(enc_seg))
            print(f"   加密原始分片直接解码：{'可行' if playable else '不可行'}"
                  f"（应为不可行，反证产物经过了解密）")
            ok &= not playable

        for label, url, out in (("明文流", f"{base}/plain.m3u8", os.path.join(work, "out_plain.mp4")),
                                ("AES-128 流", f"{base}/enc.m3u8", os.path.join(work, "out_enc.mp4")),
                                ("fMP4 流", f"{base}/fmp4.m3u8", os.path.join(work, "out_fmp4.mp4"))):
            print(f"\n② 下载合并 {label} …")
            dl = HLSDownloader(workers=6, retries=2, timeout=10, referer=base + "/")
            try:
                final = dl.download(url, out)
            except Exception as exc:                  # noqa: BLE001
                print(f"❌ {label} 下载失败：{exc}")
                ok = False
                continue
            valid, dur, streams = _probe(final)
            frames = _video_frames(final)
            same = bool(frames) and frames == ref_frames
            print(f"   产物：{os.path.basename(final)} | {fmt_bytes(os.path.getsize(final))} | "
                  f"时长 {dur:.1f}s | 流：{streams} | 视频帧 {len(frames)}/{len(ref_frames)}")
            good = valid and same and n_src >= 3
            ok &= good
            print(f"   {'✅' if good else '❌'} {label}：分片数量、逐帧内容与基准片源一致")

        print("\n③ 主播放列表（master）自动选流 …")
        try:
            dl = HLSDownloader(workers=6, retries=2, timeout=10, referer=base + "/")
            final = dl.download(f"{base}/master.m3u8", os.path.join(work, "out_master.mp4"))
            frames = _video_frames(final)
            good = frames == ref_frames
            print(f"   产物：{os.path.basename(final)} | 视频帧 {len(frames)}/{len(ref_frames)}")
            print(f"   {'✅' if good else '❌'} 主列表选流后逐帧内容与基准一致")
        except Exception as exc:                      # noqa: BLE001
            print(f"❌ 主列表下载失败：{exc}")
            good = False
        ok &= good

        print("\n④ 直播流轮询（列表无 ENDLIST，靠 --max-seconds 收敛）…")
        try:
            dl = HLSDownloader(workers=6, retries=2, timeout=10, referer=base + "/")
            final = dl.download(f"{base}/live.m3u8", os.path.join(work, "out_live.mp4"),
                                live=True, max_seconds=3)
            frames = _video_frames(final)
            # 直播只取到上限时长，帧数应少于全集但必须可解析且顺序正确
            good = bool(frames) and ref_frames[:len(frames)] == frames
            print(f"   产物：{os.path.basename(final)} | 视频帧 {len(frames)}（全集 {len(ref_frames)}）")
            print(f"   {'✅' if good else '❌'} 轮询去重正常，未重复拼接同一分片")
        except Exception as exc:                      # noqa: BLE001
            print(f"❌ 直播下载失败：{exc}")
            good = False
        ok &= good

        print("\n⑤ 辅助能力检查…")
        print("   RateLimiter:", "OK" if RateLimiter(1024).rate == 1024 else "FAIL")
        cleaned = safe_name('a/b:c*d?"e<f>|g')      # 连续非法字符会合并为一个下划线
        print("   safe_name  :", cleaned)
        ok &= cleaned == "a_b_c_d_e_f_g"
        print("   DRM 拦截   :", end=" ")
        try:
            HLSDownloader.parse_media(
                '#EXT-X-KEY:METHOD=SAMPLE-AES,URI="skd://x",KEYFORMAT="com.apple.streamingkeydelivery"',
                "https://x/")
            print("FAIL（未拦截）")
            ok = False
        except RuntimeError as exc:
            print(f"OK（{exc}）")

        print("\n自检结果：", "✅ 全部通过" if ok else "❌ 存在失败项")
        return 0 if ok else 1
    finally:
        if srv:
            srv.shutdown()
        shutil.rmtree(work, ignore_errors=True)


# --------------------------------------------------------------------------- #
# CLI
# --------------------------------------------------------------------------- #
def main(argv: Optional[List[str]] = None) -> int:
    ap = argparse.ArgumentParser(
        description="HLS(m3u8) 切片下载与合并器",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="示例：\n"
               "  python3 HLS切片下载合并.py --url https://x/index.m3u8 --out 电影.mp4\n"
               "  python3 HLS切片下载合并.py --url https://x/master.m3u8 --variant 720p --workers 16\n"
               "  python3 HLS切片下载合并.py --from-jsonl 茶杯狐播放地址.jsonl --out-dir dl --limit 5\n"
               "  python3 HLS切片下载合并.py --url https://x/live.m3u8 --live --max-seconds 600\n")
    ap.add_argument("--url", help="m3u8 地址（主列表或媒体列表均可）")
    ap.add_argument("--from-jsonl", help="从上一步爬虫产出的播放地址 jsonl 批量下载")
    ap.add_argument("--out", default="output.mp4", help="单条下载的输出文件")
    ap.add_argument("--out-dir", default="downloads", help="批量下载的输出目录")
    ap.add_argument("--variant", default="best", help="清晰度：best / worst / 720p / 1280x720")
    ap.add_argument("--workers", type=int, default=8, help="并发下载线程数")
    ap.add_argument("--retries", type=int, default=3)
    ap.add_argument("--timeout", type=int, default=20)
    ap.add_argument("--referer", default="", help="防盗链需要的 Referer")
    ap.add_argument("--header", action="append", default=[], help="额外请求头，格式 Key:Value（可多次）")
    ap.add_argument("--proxy", default="")
    ap.add_argument("--max-speed", type=float, default=0, help="限速，单位 KB/s")
    ap.add_argument("--live", action="store_true", help="直播流：持续拉取直到 ENDLIST 或达到上限")
    ap.add_argument("--max-seconds", type=float, default=0, help="直播录制时长上限（秒）")
    ap.add_argument("--no-remux", action="store_true", help="不封装 mp4，只输出合并后的原始 ts")
    ap.add_argument("--keep-segments", action="store_true", help="保留下载的分片目录")
    ap.add_argument("--limit", type=int, default=0, help="批量下载条数上限")
    ap.add_argument("--only", default="", help="批量下载时只下载标题包含该关键字的条目")
    ap.add_argument("--self-test", action="store_true", help="本地生成 HLS 流做全流程自检")
    ap.add_argument("-v", "--verbose", action="store_true")
    args = ap.parse_args(argv)

    logging.basicConfig(level=logging.DEBUG if args.verbose else logging.INFO,
                        format="%(asctime)s %(levelname)s %(message)s")

    if args.self_test:
        return self_test()
    if not args.url and not args.from_jsonl:
        ap.error("需要 --url 或 --from-jsonl（或用 --self-test 自检）")

    headers = {}
    for h in args.header:
        if ":" in h:
            k, _, v = h.partition(":")
            headers[k.strip()] = v.strip()

    dl = HLSDownloader(workers=args.workers, retries=args.retries, timeout=args.timeout,
                       referer=args.referer, headers=headers, proxy=args.proxy,
                       max_speed=args.max_speed * 1024 if args.max_speed else 0,
                       keep_segments=args.keep_segments)
    common = dict(variant=args.variant, live=args.live, max_seconds=args.max_seconds,
                  no_remux=args.no_remux)

    try:
        if args.from_jsonl:
            batch_from_jsonl(dl, args.from_jsonl, args.out_dir,
                             only=args.only, limit=args.limit, **common)
        else:
            dl.download(args.url, args.out, **common)
    except KeyboardInterrupt:
        log.warning("已中断（重新执行同一命令可续传）")
        return 130
    except RuntimeError as exc:
        log.error("%s", exc)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
