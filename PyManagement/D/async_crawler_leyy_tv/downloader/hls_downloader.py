# downloader/hls_downloader.py
from __future__ import annotations

import asyncio
import logging
import re
import shutil
import tempfile
from pathlib import Path
from urllib.parse import urljoin

import aiofiles
import aiohttp
from Crypto.Cipher import AES
from Crypto.Util.Padding import unpad

from .base import DownloadStrategy

logger = logging.getLogger("HLS")


class HLSDownloader(DownloadStrategy):
    """
    HLS(m3u8) 下载器：
    1. 解析 m3u8 索引
    2. 处理 #EXT-X-KEY 加密（AES-128-CBC）
    3. 并发下载所有 TS 切片（带重试 + 容错）
    4. ffmpeg 无损合并为 MP4
    """

    def __init__(
        self,
        segment_concurrency: int = 8,
        max_retries: int = 3,
        retry_delay: float = 1.0,
        segment_timeout: int = 120,
    ):
        self.segment_concurrency = segment_concurrency
        self.max_retries = max_retries
        self.retry_delay = retry_delay
        self.segment_timeout = segment_timeout

    def can_handle(self, url: str, content_type: str = "") -> bool:
        return (
            url.endswith(".m3u8")
            or "m3u8" in url
            or "application/vnd.apple.mpegurl" in content_type
            or "application/x-mpegurl" in content_type
        )

    async def download(
        self,
        url: str,
        save_path: Path,
        session: aiohttp.ClientSession | None = None,
        **kwargs,
    ) -> bool:
        own_session = session is None
        if own_session:
            session = aiohttp.ClientSession()

        temp_dir: Path | None = None
        try:
            headers = kwargs.get("headers") or {}
            base_url = url.rsplit("/", 1)[0] + "/"

            m3u8_text = await self._fetch_text(session, url, headers)
            if "#EXTM3U" not in m3u8_text:
                return False

            # 处理 master playlist
            variant_url = self._pick_variant(m3u8_text, base_url)
            if variant_url:
                m3u8_text = await self._fetch_text(session, variant_url, headers)
                base_url = variant_url.rsplit("/", 1)[0] + "/"

            key_info = self._parse_key(m3u8_text)
            ts_urls = self._extract_ts(m3u8_text, base_url)
            if not ts_urls:
                return False

            key_bytes = None
            iv_bytes = None
            if key_info.get("method") == "AES-128":
                key_url = urljoin(base_url, key_info["uri"])
                key_bytes = await self._fetch_bytes(session, key_url, headers)
                iv_bytes = self._parse_iv(key_info.get("iv"))

            temp_dir = Path(tempfile.mkdtemp(prefix="hls_"))
            sem = asyncio.Semaphore(self.segment_concurrency)

            async def fetch_seg(idx: int, seg_url: str) -> Path | None:
                async with sem:
                    for attempt in range(self.max_retries):
                        try:
                            data = await self._fetch_bytes(
                                session, seg_url, headers,
                            )
                            if key_bytes:
                                data = self._decrypt(
                                    data, key_bytes, iv_bytes, idx,
                                )
                            p = temp_dir / f"seg_{idx:06d}.ts"
                            async with aiofiles.open(p, "wb") as f:
                                await f.write(data)
                            return p
                        except Exception as e:
                            if attempt < self.max_retries - 1:
                                wait = self.retry_delay * (attempt + 1)
                                await asyncio.sleep(wait)
                            else:
                                logger.warning(
                                    f"切片 {idx} 下载失败 ({self.max_retries}次): "
                                    f"{seg_url[:80]} {e!r}"
                                )
                    return None

            # 容错下载：个别切片失败不中断整体
            results = await asyncio.gather(
                *(fetch_seg(i, u) for i, u in enumerate(ts_urls)),
                return_exceptions=False,
            )

            seg_paths = [p for p in results if p is not None]
            failed = len(ts_urls) - len(seg_paths)

            if failed > 0:
                fail_rate = failed / len(ts_urls)
                logger.info(
                    f"{url[-60:]} 切片完成 {len(seg_paths)}/{len(ts_urls)} "
                    f"(失败 {failed}, 失败率 {fail_rate:.1%})"
                )
                # 失败率超过 20% 才判定整个下载失败
                if fail_rate > 0.2:
                    logger.error(f"切片失败率过高，放弃下载: {url}")
                    return False

            if not seg_paths:
                return False

            await self._merge(seg_paths, save_path)
            return True

        except Exception as e:
            logger.error(f"HLS 下载失败 {url}: {e!r}")
            return False
        finally:
            if temp_dir and temp_dir.exists():
                shutil.rmtree(temp_dir, ignore_errors=True)
            if own_session:
                await session.close()

    # ---------- 内部工具 ----------

    def _pick_variant(self, text: str, base_url: str) -> str | None:
        """如果是 master playlist，选择清晰度最高的变体"""
        if "#EXT-X-STREAM-INF" not in text:
            return None
        best_bw = -1
        best_url = None
        lines = [l.strip() for l in text.splitlines()]
        for i, line in enumerate(lines):
            if line.startswith("#EXT-X-STREAM-INF"):
                m = re.search(r"BANDWIDTH=(\d+)", line)
                bw = int(m.group(1)) if m else 0
                for j in range(i + 1, len(lines)):
                    nxt = lines[j]
                    if nxt and not nxt.startswith("#"):
                        if bw > best_bw:
                            best_bw = bw
                            best_url = urljoin(base_url, nxt)
                        break
        return best_url

    def _parse_key(self, text: str) -> dict:
        info = {"method": None, "uri": None, "iv": None}
        m = re.search(r"#EXT-X-KEY:([^\n]+)", text)
        if not m:
            return info
        attrs = m.group(1)
        method = re.search(r"METHOD=([^,\s]+)", attrs)
        if method:
            info["method"] = method.group(1).strip()
        uri = re.search(r'URI="([^"]+)"', attrs)
        if uri:
            info["uri"] = uri.group(1)
        iv = re.search(r"IV=([^,\s]+)", attrs)
        if iv:
            info["iv"] = iv.group(1)
        return info

    def _extract_ts(self, text: str, base_url: str) -> list[str]:
        urls: list[str] = []
        for line in text.splitlines():
            line = line.strip()
            if not line or line.startswith("#"):
                continue
            urls.append(urljoin(base_url, line))
        return urls

    def _parse_iv(self, iv_str: str | None) -> bytes:
        if iv_str:
            hex_str = iv_str[2:] if iv_str.lower().startswith("0x") else iv_str
            return bytes.fromhex(hex_str.zfill(32))
        return b"\x00" * 16

    def _decrypt(self, data: bytes, key: bytes,
                 iv: bytes, seq_num: int) -> bytes:
        # m3u8 未显式声明 IV 时，使用媒体序列号（大端 16 字节）
        if iv == b"\x00" * 16:
            actual_iv = seq_num.to_bytes(16, byteorder="big")
        else:
            actual_iv = iv

        try:
            cipher = AES.new(key, AES.MODE_CBC, actual_iv)
            decrypted = cipher.decrypt(data)
            try:
                return unpad(decrypted, AES.block_size)
            except ValueError:
                return decrypted
        except Exception as e:
            logger.error(f"AES 解密失败 seq={seq_num}: {e!r}")
            return data

    async def _fetch_text(self, session, url: str, headers: dict) -> str:
        async with session.get(url, headers=headers,
                               timeout=aiohttp.ClientTimeout(total=30)) as r:
            r.raise_for_status()
            return await r.text()

    async def _fetch_bytes(self, session, url: str, headers: dict) -> bytes:
        async with session.get(url, headers=headers,
                               timeout=aiohttp.ClientTimeout(
                                   total=self.segment_timeout,
                               )) as r:
            r.raise_for_status()
            return await r.read()

    async def _merge(self, segments: list[Path], output: Path) -> None:
        output.parent.mkdir(parents=True, exist_ok=True)
        concat_file = output.parent / f".concat_{output.stem}.txt"
        async with aiofiles.open(concat_file, "w", encoding="utf-8") as f:
            for seg in segments:
                await f.write(f"file '{seg.as_posix()}'\n")

        try:
            proc = await asyncio.create_subprocess_exec(
                "ffmpeg", "-y",
                "-f", "concat", "-safe", "0",
                "-i", str(concat_file),
                "-c", "copy",
                "-bsf:a", "aac_adtstoasc",
                str(output),
                stdout=asyncio.subprocess.DEVNULL,
                stderr=asyncio.subprocess.PIPE,
            )
            _, stderr = await proc.communicate()
            if proc.returncode != 0:
                raise RuntimeError(
                    f"ffmpeg 合并失败: {stderr.decode(errors='ignore')[-500:]}"
                )
        finally:
            concat_file.unlink(missing_ok=True)
