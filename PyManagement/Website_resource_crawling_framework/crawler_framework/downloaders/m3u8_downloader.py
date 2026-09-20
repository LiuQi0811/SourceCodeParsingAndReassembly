"""
M3U8 流媒体切片解析与合并下载器
支持 HLS 播放列表解析（Master / Media Playlist）、并发切片下载、AES-128 解密、二进制合并
"""
import asyncio
import os
import re
from typing import Any, Callable, Dict, List, Optional
from urllib.parse import urljoin
import aiohttp


class M3U8Segment:
    """单个媒体切片描述"""
    __slots__ = ("index", "url", "key_uri", "iv", "duration")

    def __init__(
        self,
        index: int,
        url: str,
        key_uri: Optional[str] = None,
        iv: Optional[bytes] = None,
        duration: float = 0.0,
    ):
        self.index = index
        self.url = url
        self.key_uri = key_uri
        self.iv = iv
        self.duration = duration


def parse_m3u8(content: str, base_url: str) -> Dict[str, Any]:
    """
    解析 M3U8 内容，返回 master 或 media 播放列表信息
    :return: {"type": "master", "variants": [...]} 或 {"type": "media", "segments": [M3U8Segment, ...]}
    """
    lines = [l.strip() for l in content.splitlines() if l.strip()]
    if not lines or not lines[0].startswith("#EXTM3U"):
        raise ValueError("无效的 M3U8 播放列表（缺少 #EXTM3U 头）")

    # 检测 Master Playlist（含多码率变体）
    has_stream_inf = any(l.startswith("#EXT-X-STREAM-INF") for l in lines)
    if has_stream_inf:
        variants: List[Dict[str, Any]] = []
        for i, line in enumerate(lines):
            if line.startswith("#EXT-X-STREAM-INF"):
                bw_match = re.search(r"BANDWIDTH=(\d+)", line)
                bandwidth = int(bw_match.group(1)) if bw_match else 0
                if i + 1 < len(lines) and not lines[i + 1].startswith("#"):
                    variant_url = urljoin(base_url, lines[i + 1])
                    variants.append({"url": variant_url, "bandwidth": bandwidth})
        variants.sort(key=lambda v: v["bandwidth"], reverse=True)
        return {"type": "master", "variants": variants}

    # Media Playlist
    segments: List[M3U8Segment] = []
    current_key_uri: Optional[str] = None
    current_iv: Optional[bytes] = None
    seg_index = 0
    seg_duration = 0.0

    for line in lines:
        if line.startswith("#EXT-X-KEY"):
            method_match = re.search(r"METHOD=([^,]+)", line)
            method = method_match.group(1) if method_match else "NONE"
            if method == "AES-128":
                uri_match = re.search(r'URI="([^"]+)"', line)
                if uri_match:
                    current_key_uri = urljoin(base_url, uri_match.group(1))
                iv_match = re.search(r"IV=0x([0-9a-fA-F]+)", line)
                if iv_match:
                    current_iv = bytes.fromhex(iv_match.group(1))
        elif line.startswith("#EXTINF"):
            dur_match = re.match(r"#EXTINF:([\d.]+)", line)
            seg_duration = float(dur_match.group(1)) if dur_match else 0.0
        elif not line.startswith("#"):
            seg_url = urljoin(base_url, line)
            segments.append(
                M3U8Segment(
                    index=seg_index,
                    url=seg_url,
                    key_uri=current_key_uri,
                    iv=current_iv,
                    duration=seg_duration,
                )
            )
            seg_index += 1

    return {"type": "media", "segments": segments}


def decrypt_aes128(data: bytes, key: bytes, iv: Optional[bytes]) -> bytes:
    """AES-128-CBC 解密（若无 cryptography 库则返回原始数据）"""
    try:
        from cryptography.hazmat.primitives.ciphers import Cipher, algorithms, modes
        from cryptography.hazmat.backends import default_backend

        if iv is None:
            iv = b"\x00" * 16
        cipher = Cipher(algorithms.AES(key), modes.CBC(iv), backend=default_backend())
        decryptor = cipher.decryptor()
        return decryptor.update(data) + decryptor.finalize()
    except ImportError:
        return data


async def fetch_key(session: aiohttp.ClientSession, key_uri: str, headers: Dict[str, str]) -> Optional[bytes]:
    try:
        async with session.get(key_uri, headers=headers) as resp:
            if resp.status == 200:
                return await resp.read()
    except Exception:
        return None
    return None


class M3U8Downloader:
    """M3U8 切片并发下载与合并"""

    def __init__(self, concurrency: int = 8, max_segments: int = 1000, timeout: float = 30.0):
        self.concurrency = concurrency
        self.max_segments = max_segments
        self.timeout = aiohttp.ClientTimeout(total=timeout)

    async def resolve_segments(
        self,
        url: str,
        session: aiohttp.ClientSession,
        headers: Dict[str, str],
    ) -> List[M3U8Segment]:
        """递归解析 M3U8，直到拿到 media playlist 的切片列表"""
        visited: set = set()
        current_url = url
        for _ in range(5):  # 最多 5 层 master 嵌套
            if current_url in visited:
                break
            visited.add(current_url)
            async with session.get(current_url, headers=headers, timeout=self.timeout) as resp:
                if resp.status != 200:
                    raise ValueError(f"获取播放列表失败: HTTP {resp.status}")
                content = await resp.text()
            result = parse_m3u8(content, current_url)
            if result["type"] == "media":
                return result["segments"][: self.max_segments]
            elif result["type"] == "master" and result["variants"]:
                current_url = result["variants"][0]["url"]
            else:
                break
        raise ValueError("无法解析出有效的媒体切片")

    async def download_segments(
        self,
        segments: List[M3U8Segment],
        session: aiohttp.ClientSession,
        headers: Dict[str, str],
        output_dir: str,
        on_progress: Optional[Callable[[int, int], None]] = None,
    ) -> List[str]:
        """并发下载所有切片，返回本地文件路径列表（按 index 排序）"""
        os.makedirs(output_dir, exist_ok=True)
        semaphore = asyncio.Semaphore(self.concurrency)
        key_cache: Dict[str, bytes] = {}

        async def fetch_key_cached(uri: str) -> bytes:
            if uri not in key_cache:
                key_cache[uri] = await fetch_key(session, uri, headers) or b""
            return key_cache[uri]

        results: Dict[int, str] = {}

        async def download_one(seg: M3U8Segment) -> None:
            async with semaphore:
                filename = os.path.join(output_dir, f"seg_{seg.index:06d}.ts")
                # 断点续传：分片已存在且非空则跳过
                if os.path.exists(filename) and os.path.getsize(filename) > 0:
                    results[seg.index] = filename
                    if on_progress:
                        on_progress(len(results), len(segments))
                    return
                for attempt in range(3):
                    try:
                        async with session.get(seg.url, headers=headers, timeout=self.timeout) as resp:
                            if resp.status != 200:
                                await asyncio.sleep(0.5 * (attempt + 1))
                                continue
                            data = await resp.read()
                        if seg.key_uri:
                            key = await fetch_key_cached(seg.key_uri)
                            if key:
                                data = decrypt_aes128(data, key, seg.iv)
                        with open(filename, "wb") as f:
                            f.write(data)
                        results[seg.index] = filename
                        await asyncio.sleep(0.2)  # 限速：每片后歇 200ms
                        break
                    except Exception:
                        await asyncio.sleep(0.5 * (attempt + 1))
                if on_progress:
                    on_progress(len(results), len(segments))

        await asyncio.gather(*[download_one(s) for s in segments])
        return [results[i] for i in sorted(results.keys())]

    @staticmethod
    def merge_segments(segment_files: List[str], output_path: str) -> str:
        """二进制合并 TS 切片为单个文件（无需 ffmpeg 即可播放）"""
        out_dir = os.path.dirname(output_path)
        if out_dir:
            os.makedirs(out_dir, exist_ok=True)
        with open(output_path, "wb") as out:
            for f in segment_files:
                if os.path.exists(f):
                    with open(f, "rb") as seg:
                        out.write(seg.read())
        return output_path