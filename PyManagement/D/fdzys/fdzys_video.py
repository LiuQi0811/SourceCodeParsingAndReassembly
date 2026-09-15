# ============================================================
# fdzys_video.py — 视频下载模块
# 1) HLS(m3u8) 下载器：master/variant 播放列表、AES-128 分片解密、
#    并发分片下载、顺序拼接输出 .ts
# 2) 播放器配置解析：从页面提取 var player_aaaa = {...}
#
# 依赖: aiohttp, cryptography(仅 AES-128 加密流需要)
# ============================================================
from __future__ import annotations

import asyncio
import json
import os
import re
from collections import deque
from dataclasses import dataclass
from urllib.parse import urljoin

import aiohttp


# ============================================================
# 1. 播放器配置解析（var player_aaaa = {...}）
# ============================================================
_PLAYER_RE = re.compile(r"var\s+player_aaaa\s*=\s*(\{)")


def extract_player_config(html: str) -> dict | None:
    """从页面 HTML 提取播放器配置 JSON，失败返回 None。"""
    m = _PLAYER_RE.search(html)
    if not m:
        return None
    obj = _extract_json_object(html, m.start(1))
    if obj is None:
        return None
    try:
        data = json.loads(obj)
    except json.JSONDecodeError:
        return None
    return data if isinstance(data, dict) else None


def _extract_json_object(text: str, start: int) -> str | None:
    """从 start('{') 起做括号配对，返回完整 JSON 对象原文。"""
    depth = 0
    in_str = False
    esc = False
    for i in range(start, len(text)):
        c = text[i]
        if in_str:
            if esc:
                esc = False
            elif c == "\\":
                esc = True
            elif c == '"':
                in_str = False
        elif c == '"':
            in_str = True
        elif c == "{":
            depth += 1
        elif c == "}":
            depth -= 1
            if depth == 0:
                return text[start:i + 1]
    return None


# ============================================================
# 2. 直链判断
# ============================================================
_DIRECT_MEDIA_RE = re.compile(
    r"\.(m3u8|mp4|flv|mkv|mov|webm|ts|m4s)(\?|#|$)", re.I)


def is_direct_media_url(url: str) -> bool:
    return bool(_DIRECT_MEDIA_RE.search(url))


def is_m3u8_url(url: str) -> bool:
    return bool(re.search(r"\.m3u8(\?|#|$)", url, re.I))


def safe_filename(name: str) -> str:
    """清洗为 Windows 合法文件名。"""
    name = re.sub(r'[\\/:*?"<>|\r\n\t]+', "_", name).strip(" .")
    return name or "untitled"


# ============================================================
# 3. HLS(m3u8) 下载器  —— RFC 8216
# ============================================================
@dataclass
class HLSResult:
    path: str | None = None
    segments: int = 0
    bytes: int = 0
    duration: float = 0.0
    variant: str | None = None
    error: str | None = None


class HLSClient:
    """主列表选路(最高分辨率) → 子列表解析分片 → 并发下载 → 顺序拼接。"""

    def __init__(self, session: aiohttp.ClientSession, *,
                 concurrency: int = 8, retries: int = 3,
                 timeout: float = 60.0) -> None:
        self.session = session
        self.sem = asyncio.Semaphore(concurrency)
        self.retries = retries
        self.timeout = timeout
        self._key_cache: dict[str, bytes] = {}

    # ---------- 主入口 ----------
    async def download(self, playlist_url: str, dest: str, *,
                       referer: str | None = None,
                       max_segments: int | None = None) -> HLSResult:
        """下载 HLS 流到 dest(合并 .ts)。max_segments 用于限制分片数(预览)。"""
        try:
            text = await self._get_text(playlist_url, referer)
            variant: str | None = None

            # 主(master)列表 → 选最优变体
            if "#EXT-X-STREAM-INF" in text:
                variants = _parse_master(text)
                if not variants:
                    return HLSResult(error="master playlist 为空")
                best = max(variants, key=lambda v: (v["height"], v["bandwidth"]))
                variant = f"{best['height']}p" if best["height"] else f"{best['bandwidth']}k"
                media_url = urljoin(playlist_url, best["uri"])
                text = await self._get_text(media_url, referer)
            else:
                media_url = playlist_url

            segments = _parse_media(text, media_url)
            if not segments:
                return HLSResult(error="media playlist 为空")
            if max_segments:
                segments = segments[:max_segments]

            os.makedirs(os.path.dirname(dest) or ".", exist_ok=True)
            tmp = dest + ".part"
            try:
                with open(tmp, "wb") as f:
                    total, duration = await self._write_segments(f, segments, referer)
                os.replace(tmp, dest)
            except Exception:
                if os.path.exists(tmp):
                    os.remove(tmp)
                raise
            return HLSResult(path=dest, segments=len(segments),
                             bytes=total, duration=duration, variant=variant)
        except Exception as exc:
            # str(TimeoutError()) 为空串, 不能当作成功
            return HLSResult(error=str(exc) or type(exc).__name__)

    # ---------- 顺序写入(有界并发) ----------
    async def _write_segments(self, f, segments: list[dict],
                              referer: str | None) -> tuple[int, float]:
        """至多 concurrency 个分片在途，按播放列表顺序写盘。"""
        total = 0
        duration = 0.0
        pending: deque[asyncio.Task] = deque()
        n = len(segments)
        i = 0
        # 预填充
        while i < n and len(pending) < self.sem._value:
            pending.append(asyncio.create_task(
                self._fetch_segment(segments[i], i, referer)))
            i += 1
        # 边写边补充
        w = 0
        while pending:
            data = await pending.popleft()
            f.write(data)
            total += len(data)
            duration += segments[w]["duration"]
            w += 1
            if i < n:
                pending.append(asyncio.create_task(
                    self._fetch_segment(segments[i], i, referer)))
                i += 1
        return total, duration

    # ---------- 网络 ----------
    @staticmethod
    def _headers(referer: str | None) -> dict:
        h = {"User-Agent": ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                            "AppleWebKit/537.36 (KHTML, like Gecko) "
                            "Chrome/124.0 Safari/537.36")}
        if referer:
            h["Referer"] = referer
        return h

    async def _get_text(self, url: str, referer: str | None) -> str:
        async with self.session.get(url, headers=self._headers(referer),
                                    timeout=aiohttp.ClientTimeout(total=self.timeout)) as r:
            if r.status != 200:
                raise RuntimeError(f"{url} -> HTTP {r.status}")
            return await r.text(errors="replace")

    async def _get_bytes(self, url: str, referer: str | None) -> bytes:
        async with self.session.get(url, headers=self._headers(referer),
                                    timeout=aiohttp.ClientTimeout(total=self.timeout)) as r:
            if r.status != 200:
                raise RuntimeError(f"HTTP {r.status}")
            return await r.read()

    async def _fetch_segment(self, seg: dict, seq: int,
                             referer: str | None) -> bytes:
        async with self.sem:
            last: Exception | None = None
            for attempt in range(self.retries):
                try:
                    data = await self._get_bytes(seg["uri"], referer)
                    if seg["key"] and seg["key"]["method"] == "AES-128":
                        data = await self._decrypt(data, seg["key"], seq, referer)
                    return data
                except Exception as exc:
                    last = exc
                    await asyncio.sleep(0.5 * (attempt + 1))
            raise RuntimeError(f"分片下载失败: {last}")

    async def _decrypt(self, data: bytes, key: dict, seq: int,
                       referer: str | None) -> bytes:
        try:
            from cryptography.hazmat.primitives.ciphers import (  # noqa: PLC0415
                Cipher, algorithms, modes)
        except ImportError as exc:
            raise RuntimeError("AES-128 加密流需要安装 cryptography") from exc
        key_url = key.get("uri")
        if not key_url:
            raise RuntimeError("AES-128 缺少 KEY URI")
        if key_url not in self._key_cache:
            self._key_cache[key_url] = await self._get_bytes(key_url, referer)
        iv = key.get("iv") or seq.to_bytes(16, "big")
        cipher = Cipher(algorithms.AES(self._key_cache[key_url]), modes.CBC(iv))
        dec = cipher.decryptor()
        return dec.update(data) + dec.finalize()


# ============================================================
# 4. 播放列表解析
# ============================================================
def _parse_master(text: str) -> list[dict]:
    """解析 master playlist，返回变体列表(bandwidth/width/height/uri)。"""
    variants: list[dict] = []
    cur: dict | None = None
    for line in text.splitlines():
        line = line.strip()
        if line.startswith("#EXT-X-STREAM-INF"):
            cur = {"bandwidth": 0, "width": 0, "height": 0}
            m = re.search(r"BANDWIDTH=(\d+)", line, re.I)
            if m:
                cur["bandwidth"] = int(m.group(1))
            m = re.search(r"RESOLUTION=(\d+)x(\d+)", line, re.I)
            if m:
                cur["width"], cur["height"] = int(m.group(1)), int(m.group(2))
        elif cur is not None and line and not line.startswith("#"):
            cur["uri"] = line
            variants.append(cur)
            cur = None
    return variants


def _parse_key(line: str) -> dict:
    """解析 #EXT-X-KEY 行。"""
    key = {"method": "NONE", "uri": None, "iv": None}
    m = re.search(r"METHOD=([^,\s]+)", line, re.I)
    if m:
        key["method"] = m.group(1).upper()
    m = re.search(r'URI="([^"]+)"', line, re.I)
    if m:
        key["uri"] = m.group(1)
    m = re.search(r"IV=0x([0-9a-fA-F]+)", line, re.I)
    if m:
        key["iv"] = bytes.fromhex(m.group(1))
    return key


def _parse_media(text: str, playlist_url: str) -> list[dict]:
    """解析 media playlist，返回分片列表(uri/duration/key/init)。"""
    segments: list[dict] = []
    key: dict | None = None
    cur_dur = 0.0
    for line in text.splitlines():
        line = line.strip()
        if not line:
            continue
        if line.startswith("#EXT-X-KEY"):
            key = _parse_key(line)
            if key.get("uri"):
                key["uri"] = urljoin(playlist_url, key["uri"])
        elif line.startswith("#EXTINF"):
            m = re.search(r"#EXTINF:\s*([\d.]+)", line)
            cur_dur = float(m.group(1)) if m else 0.0
        elif line.startswith("#EXT-X-MAP"):
            m = re.search(r'URI="([^"]+)"', line)
            if m:
                segments.append({"uri": urljoin(playlist_url, m.group(1)),
                                 "duration": 0.0, "key": None, "init": True})
        elif line.startswith("#"):
            continue  # EXT-X-DISCONTINUITY 等标记直接忽略
        else:
            segments.append({"uri": urljoin(playlist_url, line),
                             "duration": cur_dur, "key": key, "init": False})
            cur_dur = 0.0
    return segments
