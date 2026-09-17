"""HLS (m3u8) 异步下载与合并"""
import asyncio
import re
import shutil
from pathlib import Path
from urllib.parse import urljoin
import aiofiles


class HlsDownloader:
    def __init__(self, fetcher, concurrency: int = 16):
        self.fetcher = fetcher
        self.sem = asyncio.Semaphore(concurrency)

    async def download(self, m3u8_url: str, save_path: Path,
                       referer: str = "", headers: dict | None = None) -> bool:
        save_path.parent.mkdir(parents=True, exist_ok=True)
        ts_dir = save_path.parent / f"{save_path.stem}_ts"
        ts_dir.mkdir(exist_ok=True)

        base_headers = dict(headers or {})
        if referer:
            base_headers["Referer"] = referer

        try:
            raw = await self.fetcher.fetch_bytes(m3u8_url, base_headers)
            text = raw.decode("utf-8", errors="replace")

            # master playlist → 选码率最高的
            if "#EXT-X-STREAM-INF" in text:
                variants = self._parse_master(text, m3u8_url)
                if not variants:
                    return False
                best = max(variants, key=lambda v: v.get("bandwidth", 0))
                return await self.download(best["url"], save_path, referer, headers)

            segments, media_seq = self._parse_media_playlist(text, m3u8_url)
            if not segments:
                return False

            key_info = self._parse_encryption(text, m3u8_url)

            tasks = []
            for i, seg in enumerate(segments):
                ts_file = ts_dir / f"seg_{i:05d}.ts"
                tasks.append(self._download_segment(seg, ts_file, base_headers,
                                                    key_info, media_seq + i))
            await asyncio.gather(*tasks, return_exceptions=True)

            success = await self._merge_with_ffmpeg(ts_dir, save_path, segments)
            if success:
                shutil.rmtree(ts_dir, ignore_errors=True)
            return success

        except Exception as e:
            print(f"[HLS] 下载失败: {e}")
            return False

    def _parse_master(self, text: str, base_url: str) -> list[dict]:
        variants = []
        lines = text.strip().splitlines()
        for i, line in enumerate(lines):
            if line.startswith("#EXT-X-STREAM-INF"):
                bw_match = re.search(r'BANDWIDTH=(\d+)', line)
                bandwidth = int(bw_match.group(1)) if bw_match else 0
                for j in range(i + 1, len(lines)):
                    s = lines[j].strip()
                    if s and not s.startswith("#"):
                        variants.append({
                            "url": urljoin(base_url, s),
                            "bandwidth": bandwidth,
                        })
                        break
        return variants

    def _parse_media_playlist(self, text: str, base_url: str) -> tuple[list[str], int]:
        """返回 (分片URL列表, 起始媒体序号)"""
        media_seq = 0
        m = re.search(r'#EXT-X-MEDIA-SEQUENCE:\s*(\d+)', text)
        if m:
            media_seq = int(m.group(1))
        segments = []
        for line in text.strip().splitlines():
            line = line.strip()
            if line and not line.startswith("#"):
                segments.append(urljoin(base_url, line))
        return segments, media_seq

    def _parse_encryption(self, text: str, base_url: str) -> dict | None:
        m = re.search(r'#EXT-X-KEY:METHOD=AES-128,URI="([^"]+)"', text)
        if m:
            key_url = urljoin(base_url, m.group(1))
            iv_match = re.search(r'IV=0x([0-9a-fA-F]+)', text)
            return {"key_url": key_url,
                    "iv": iv_match.group(1) if iv_match else None}
        return None

    async def _download_segment(self, url: str, path: Path,
                                 headers: dict, key_info: dict | None,
                                 seq: int = 0) -> bool:
        async with self.sem:
            try:
                data = await self.fetcher.fetch_bytes(url, headers)
                if key_info:
                    data = await self._decrypt_aes128(data, key_info, headers, seq)
                async with aiofiles.open(path, "wb") as f:
                    await f.write(data)
                return True
            except Exception as e:
                print(f"[HLS] 片段下载失败 {url[:60]} -> {e}")
                return False

    async def _decrypt_aes128(self, data: bytes, key_info: dict,
                               headers: dict, seq: int = 0) -> bytes:
        try:
            from Crypto.Cipher import AES
            from Crypto.Util.Padding import unpad
        except ImportError:
            print("[HLS] 缺少 pycryptodome，跳过解密")
            return data

        key_data = await self.fetcher.fetch_bytes(key_info["key_url"], headers)
        if key_info.get("iv"):
            iv = bytes.fromhex(key_info["iv"])
        else:
            # HLS 规范：未显式指定 IV 时，使用分片序号（media sequence）作为 IV
            iv = seq.to_bytes(16, "big")
        cipher = AES.new(key_data[:16], AES.MODE_CBC, iv)
        try:
            return unpad(cipher.decrypt(data), AES.block_size)
        except Exception:
            return data

    async def _merge_with_ffmpeg(self, ts_dir: Path, output: Path,
                                  segments: list) -> bool:
        concat_file = ts_dir / "concat.txt"
        missing = []

        with open(concat_file, "w", encoding="utf-8") as f:
            for i in range(len(segments)):
                ts_file = ts_dir / f"seg_{i:05d}.ts"
                if ts_file.exists() and ts_file.stat().st_size > 0:
                    f.write(f"file '{ts_file.resolve()}'\n")
                else:
                    missing.append(i)

        if missing:
            print(f"[HLS] 警告：缺失 {len(missing)} 个 TS 片段: "
                  f"{missing[:10]}{'...' if len(missing) > 10 else ''}")

        cmd = [
            "ffmpeg", "-y", "-f", "concat", "-safe", "0",
            "-i", str(concat_file),
            "-c", "copy", str(output)
        ]
        try:
            proc = await asyncio.create_subprocess_exec(
                *cmd, stdout=asyncio.subprocess.DEVNULL,
                stderr=asyncio.subprocess.PIPE
            )
            _, stderr = await proc.communicate()
            if proc.returncode != 0:
                print(f"[HLS] FFmpeg 合并失败: "
                      f"{stderr.decode(errors='ignore')[:200]}")
            return proc.returncode == 0
        except FileNotFoundError:
            print("[HLS] 未找到 ffmpeg，请先安装 FFmpeg 并加入 PATH")
            return False
