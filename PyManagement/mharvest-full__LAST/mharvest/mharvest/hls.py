"""HLS（m3u8）解析与下载。

这是整个框架技术含量最高的部分。视频站几乎不给你一个 mp4 直链，
而是给一个 m3u8 文本清单，里面是一堆 ts 分片。要真正"抓到视频"，
必须走完这条链路：

    入口 m3u8
      ├─ 是 master（多码率）→ 挑一个 variant（默认最高码率）
      └─ 是 media（分片表）→ 下载 N 个 ts 分片
             ├─ 有 EXT-X-KEY → 下载密钥、AES-128-CBC 解密
             ├─ 有 EXT-X-MAP → 先写 fMP4 初始化段
             └─ 合并 → ffmpeg 转封装成 mp4（没有 ffmpeg 就裸拼接 ts）

下面几个细节是最容易踩坑的地方，都做了处理：
- 属性里的逗号：CODECS="avc1.4d401f,mp4a.40.2" 不能按逗号无脑切
- IV 缺省：规范要求用 media sequence 的 128 位大端序
- PKCS7 填充：解密后不去掉，合并出来的视频末尾会多一截垃圾
- 并发保序：分片可以并发下，但合并必须严格按顺序
"""

from __future__ import annotations

import shutil
import subprocess
from dataclasses import dataclass, field
from pathlib import Path
from typing import Callable, Optional
from urllib.parse import urljoin

from .models import Resource

M3U8_HEADER = "#EXTM3U"


# ---------------------------------------------------------------- 数据结构

@dataclass
class KeyInfo:
    """#EXT-X-KEY 描述的加密信息。"""

    method: str = "NONE"      # NONE / AES-128 / SAMPLE-AES
    uri: str = ""
    iv: bytes = b""
    key: bytes = b""          # 下载到的密钥原始字节

    @property
    def encrypted(self) -> bool:
        return self.method.upper() == "AES-128"


@dataclass
class Segment:
    """一个分片。"""

    uri: str
    index: int = 0
    duration: float = 0.0
    key: Optional[KeyInfo] = None
    byte_range: Optional[tuple[int, int]] = None  # (offset, length)


@dataclass
class Variant:
    """master 清单里的一路码流。"""

    uri: str
    bandwidth: int = 0
    resolution: str = ""
    codecs: str = ""
    frame_rate: str = ""
    audio: str = ""


@dataclass
class Playlist:
    url: str = ""
    is_master: bool = False
    variants: list = field(default_factory=list)
    segments: list = field(default_factory=list)
    target_duration: float = 0.0
    media_sequence: int = 0
    version: int = 0
    endlist: bool = False
    init_section: Optional[str] = None      # EXT-X-MAP，fMP4 的初始化段
    discontinuities: int = 0


@dataclass
class HlsResult:
    url: str = ""
    path: str = ""
    segments: int = 0
    duration: float = 0.0
    resolution: str = ""
    bandwidth: int = 0
    encrypted: bool = False
    method: str = ""          # ffmpeg / concat
    error: str = ""

    @property
    def ok(self) -> bool:
        return bool(self.path) and not self.error


# ---------------------------------------------------------------- 解析

def _split_attr_list(text: str) -> list[str]:
    """按逗号切属性，但保护引号内部的逗号。

    BANDWIDTH=1280000,CODECS="avc1.4d401f,mp4a.40.2" -> 两段，不是三段
    """
    parts, buf, in_quote = [], [], False
    for ch in text:
        if ch == '"':
            in_quote = not in_quote
        elif ch == "," and not in_quote:
            parts.append("".join(buf))
            buf = []
        else:
            buf.append(ch)
    parts.append("".join(buf))
    return [p.strip() for p in parts if p.strip()]


def parse_attrs(text: str) -> dict:
    """解析 tag 冒号后面的属性列表。"""
    attrs = {}
    for part in _split_attr_list(text):
        if "=" not in part:
            attrs[part] = ""
            continue
        key, value = part.split("=", 1)
        attrs[key.strip().upper()] = value.strip().strip('"')
    return attrs


def _parse_hex_iv(value: str) -> bytes:
    """IV=0x9c7db8778570d05c3f8f4a1b2c3d4e5f -> 16 字节。"""
    value = value.strip()
    if value.lower().startswith("0x"):
        value = value[2:]
    try:
        raw = bytes.fromhex(value)
    except ValueError:
        return b""
    return raw.rjust(16, b"\x00")[:16]


def parse_m3u8(text: str, base_url: str) -> Playlist:
    """把 m3u8 文本解析成 Playlist。

    同时兼容 master 和 media 两种清单：看有没有 EXT-X-STREAM-INF。
    """
    pl = Playlist()
    current_key: Optional[KeyInfo] = None
    pending_duration = 0.0
    pending_range: Optional[tuple[int, int]] = None
    index = 0

    for raw_line in text.splitlines():
        line = raw_line.strip()
        if not line:
            continue

        if line.startswith("#EXT-X-STREAM-INF"):
            pl.is_master = True
            attrs = parse_attrs(line.split(":", 1)[1] if ":" in line else "")
            pl.variants.append(Variant(
                uri="",
                bandwidth=int(attrs.get("BANDWIDTH") or 0),
                resolution=attrs.get("RESOLUTION", ""),
                codecs=attrs.get("CODECS", ""),
                frame_rate=attrs.get("FRAME-RATE", ""),
                audio=attrs.get("AUDIO", ""),
            ))
            continue

        if line.startswith("#EXT-X-KEY"):
            attrs = parse_attrs(line.split(":", 1)[1] if ":" in line else "")
            method = (attrs.get("METHOD") or "NONE").upper()
            if method == "NONE":
                current_key = None
            else:
                current_key = KeyInfo(
                    method=method,
                    uri=urljoin(base_url, attrs.get("URI", "")) if attrs.get("URI") else "",
                    iv=_parse_hex_iv(attrs.get("IV", "")) if attrs.get("IV") else b"",
                )
            continue

        if line.startswith("#EXT-X-MAP"):
            attrs = parse_attrs(line.split(":", 1)[1] if ":" in line else "")
            if attrs.get("URI"):
                pl.init_section = urljoin(base_url, attrs["URI"])
                # EXT-X-MAP 也可能带 BYTERANGE
                if attrs.get("BYTERANGE"):
                    length, _, offset = attrs["BYTERANGE"].partition("@")
                    try:
                        pending_range = (int(offset), int(length))
                    except ValueError:
                        pending_range = None
            continue

        if line.startswith("#EXT-X-BYTERANGE"):
            value = line.split(":", 1)[1] if ":" in line else ""
            length, _, offset = value.partition("@")
            try:
                pending_range = (int(offset), int(length))
            except ValueError:
                pending_range = None
            continue

        if line.startswith("#EXTINF"):
            value = line.split(":", 1)[1] if ":" in line else "0"
            try:
                pending_duration = float(value.split(",")[0])
            except ValueError:
                pending_duration = 0.0
            continue

        if line.startswith("#EXT-X-TARGETDURATION"):
            try:
                pl.target_duration = float(line.split(":", 1)[1])
            except (ValueError, IndexError):
                pass
            continue

        if line.startswith("#EXT-X-MEDIA-SEQUENCE"):
            try:
                pl.media_sequence = int(line.split(":", 1)[1])
            except (ValueError, IndexError):
                pass
            continue

        if line.startswith("#EXT-X-VERSION"):
            try:
                pl.version = int(line.split(":", 1)[1])
            except (ValueError, IndexError):
                pass
            continue

        if line.startswith("#EXT-X-DISCONTINUITY"):
            pl.discontinuities += 1
            continue

        if line.startswith("#EXT-X-ENDLIST"):
            pl.endlist = True
            continue

        if line.startswith("#"):
            continue

        # 走到这里就是 URI 行了
        uri = urljoin(base_url, line)
        if pl.is_master and pl.variants:
            pl.variants[-1].uri = uri
        else:
            seg = Segment(uri=uri, index=index, duration=pending_duration,
                          key=current_key, byte_range=pending_range)
            pl.segments.append(seg)
            index += 1
            pending_duration = 0.0
            pending_range = None

    return pl


def pick_variant(pl: Playlist, prefer: str = "best") -> Variant:
    """从 master 清单里挑一路码流。

    :param prefer: best（最高码率）/ worst / 形如 "720p" 的最大分辨率
    """
    if not pl.variants:
        raise ValueError("master 清单里没有任何码流")

    def height(v: Variant) -> int:
        # RESOLUTION=1920x1080 -> 1080
        try:
            return int(v.resolution.lower().split("x")[-1])
        except (ValueError, IndexError, AttributeError):
            return 0

    candidates = [v for v in pl.variants if v.uri]
    if not candidates:
        raise ValueError("master 清单里的码流都缺少 URI")

    if prefer == "best":
        return max(candidates, key=lambda v: (height(v), v.bandwidth))
    if prefer == "worst":
        return min(candidates, key=lambda v: (height(v) or 10 ** 9, v.bandwidth))
    if prefer.lower().endswith("p"):
        try:
            limit = int(prefer[:-1])
        except ValueError:
            limit = 10 ** 9
        under = [v for v in candidates if 0 < height(v) <= limit]
        if under:
            return max(under, key=lambda v: (height(v), v.bandwidth))
        # 没有低于限制的，就取最接近的
        return min(candidates, key=lambda v: abs(height(v) - limit) or 10 ** 9)
    return max(candidates, key=lambda v: (height(v), v.bandwidth))


# ---------------------------------------------------------------- 解密

def pkcs7_unpad(data: bytes) -> bytes:
    """去掉 PKCS7 填充；不是标准填充就原样返回。"""
    if not data:
        return data
    pad = data[-1]
    if 1 <= pad <= 16 and data[-pad:] == bytes([pad]) * pad:
        return data[:-pad]
    return data


def decrypt_segment(data: bytes, key: KeyInfo, media_sequence: int) -> bytes:
    """AES-128-CBC 解密单个分片。

    IV 缺省时按规范用 media sequence 的 128 位大端序。
    """
    from cryptography.hazmat.primitives.ciphers import Cipher, algorithms, modes

    if not key.key or len(key.key) != 16:
        raise ValueError(f"密钥无效（长度 {len(key.key)}，应为 16 字节）")

    # 清单里没给 IV，就按规范用 media sequence 的 128 位大端序
    iv = key.iv or media_sequence.to_bytes(16, "big")

    cipher = Cipher(algorithms.AES(key.key), modes.CBC(iv))
    decryptor = cipher.decryptor()
    plain = decryptor.update(data) + decryptor.finalize()
    return pkcs7_unpad(plain)


# ---------------------------------------------------------------- 合并

def merge_segments(parts: list[bytes], out_path: Path, is_fmp4: bool = False,
                   use_ffmpeg: bool = True) -> tuple[bool, str]:
    """把分片合并成单一文件。

    :return: (是否用 ffmpeg 成功转封装, 实际采用的方式)
    """
    out_path.parent.mkdir(parents=True, exist_ok=True)
    raw = b"".join(parts)

    if use_ffmpeg and shutil.which("ffmpeg"):
        # ffmpeg 不接受管道混合输入，先落地一个临时文件再转封装
        tmp = out_path.with_suffix(out_path.suffix + ".raw")
        tmp.write_bytes(raw)
        cmd = ["ffmpeg", "-y", "-loglevel", "error"]
        cmd += ["-f", "mp4" if is_fmp4 else "mpegts", "-i", str(tmp)]
        # -c copy 只换容器不重编码，秒级完成
        cmd += ["-c", "copy", "-movflags", "+faststart", str(out_path)]
        try:
            proc = subprocess.run(cmd, capture_output=True, timeout=600)
            tmp.unlink(missing_ok=True)
            if proc.returncode == 0 and out_path.exists() and out_path.stat().st_size > 0:
                return True, "ffmpeg"
        except (subprocess.SubprocessError, OSError):
            tmp.unlink(missing_ok=True)
        # ffmpeg 失败了就退回裸拼接

    ext = ".mp4" if is_fmp4 else ".ts"
    fallback = out_path.with_suffix(ext)
    fallback.write_bytes(raw)
    out_path = fallback
    return False, "concat"


# ---------------------------------------------------------------- 下载

def download_hls(client, url: str, dest: Path, name: str,
                 referer: Optional[str] = None,
                 prefer: str = "best",
                 workers: int = 8,
                 use_ffmpeg: bool = True,
                 progress: Optional[Callable[[int, int], None]] = None) -> HlsResult:
    """下载一条 m3u8 流并合并成视频文件。

    :param prefer: best / worst / 720p 等，控制选哪路码率
    :param workers: 分片并发数
    """
    from concurrent.futures import ThreadPoolExecutor

    result = HlsResult(url=url)
    base = url

    # 1. 拉清单
    resp = client.fetch_bytes(url, referer=referer, max_size=8 << 20)
    if not resp.ok or not resp.content:
        result.error = resp.error or f"HTTP {resp.status}"
        return result
    text = resp.content.decode("utf-8", "ignore")
    if M3U8_HEADER not in text[:64] and "#EXT" not in text:
        result.error = "内容不是 m3u8 清单"
        return result

    pl = parse_m3u8(text, base)

    # 2. master → 选流后递归一次
    if pl.is_master:
        try:
            variant = pick_variant(pl, prefer)
        except ValueError as exc:
            result.error = str(exc)
            return result
        result.resolution = variant.resolution
        result.bandwidth = variant.bandwidth
        sub = client.fetch_bytes(variant.uri, referer=referer, max_size=8 << 20)
        if not sub.ok or not sub.content:
            result.error = sub.error or f"码流清单请求失败 HTTP {sub.status}"
            return result
        pl = parse_m3u8(sub.content.decode("utf-8", "ignore"), variant.uri)

    if not pl.segments:
        result.error = "清单里没有分片"
        return result

    # 3. 取密钥（同一把 key 只下一次）
    keys: dict[str, KeyInfo] = {}
    for seg in pl.segments:
        if seg.key and seg.key.encrypted and seg.key.uri:
            keys.setdefault(seg.key.uri, seg.key)
    for uri, key in keys.items():
        key_resp = client.fetch_bytes(uri, referer=referer, max_size=4096)
        if key_resp.ok and key_resp.content:
            key.key = key_resp.content[:16]
        else:
            result.error = f"密钥下载失败：{uri}"
            return result
    result.encrypted = bool(keys)

    # 4. 下载初始化段（fMP4 需要）
    parts: list[bytes] = []
    is_fmp4 = False
    if pl.init_section:
        init_resp = client.fetch_bytes(pl.init_section, referer=referer, max_size=32 << 20)
        if init_resp.ok and init_resp.content:
            parts.append(init_resp.content)
            is_fmp4 = True

    # 5. 并发下载分片，靠 index 保证合并顺序
    total = len(pl.segments)
    raw_segments: list[tuple[int, bytes]] = []

    def fetch_one(seg: Segment) -> tuple[int, bytes]:
        if seg.byte_range:
            offset, length = seg.byte_range
            headers = {"Range": f"bytes={offset}-{offset + length - 1}"}
            r = client.session.get(seg.uri, headers=headers,
                                   timeout=client.timeout)
            return seg.index, (r.content if r.status_code in (200, 206) else b"")
        r = client.fetch_bytes(seg.uri, referer=referer)
        return seg.index, (r.content if r.ok else b"")

    with ThreadPoolExecutor(max_workers=max(1, workers)) as pool:
        for i, (idx, data) in enumerate(pool.map(fetch_one, pl.segments), 1):
            raw_segments.append((idx, data))
            if progress:
                progress(i, total)

    raw_segments.sort(key=lambda item: item[0])

    # 6. 解密 + 拼接
    missing = 0
    for seg_index, data in raw_segments:
        if not data:
            missing += 1
            continue
        seg = pl.segments[seg_index]
        if seg.key and seg.key.encrypted:
            try:
                # 没有显式 IV 时，用 media_sequence + 分片序号
                effective = KeyInfo(method=seg.key.method, uri=seg.key.uri,
                                    key=seg.key.key,
                                    iv=seg.key.iv or (pl.media_sequence + seg.index)
                                    .to_bytes(16, "big"))
                data = decrypt_segment(data, effective, pl.media_sequence)
            except Exception as exc:
                result.error = f"分片 {seg.index} 解密失败：{exc}"
                return result
        parts.append(data)
        result.duration += seg.duration

    if not parts:
        result.error = "所有分片都下载失败"
        return result

    # 7. 合并
    dest.mkdir(parents=True, exist_ok=True)
    out = dest / f"{name}.mp4"
    ok, method = merge_segments(parts, out, is_fmp4=is_fmp4, use_ffmpeg=use_ffmpeg)

    final = out if ok else out.with_suffix(".mp4" if is_fmp4 else ".ts")
    if not final.exists():
        final = out.with_suffix(".ts")

    result.path = str(final)
    result.segments = len(raw_segments) - missing
    result.method = method
    if missing:
        result.error = f"{missing}/{total} 个分片下载失败"
    return result


def hls_variants(client, url: str, referer: Optional[str] = None) -> list[dict]:
    """只列码流不下分片，给 --list-variants 用。"""
    resp = client.fetch_bytes(url, referer=referer, max_size=8 << 20)
    if not resp.ok:
        return []
    pl = parse_m3u8(resp.content.decode("utf-8", "ignore"), url)
    if not pl.is_master:
        return [{"uri": url, "bandwidth": 0, "resolution": "单码率", "codecs": ""}]
    return [{"uri": v.uri, "bandwidth": v.bandwidth, "resolution": v.resolution,
             "codecs": v.codecs} for v in pl.variants]
