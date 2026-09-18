# -*- coding: utf-8 -*-
"""HLS (m3u8) 下载器，支持 AES-128 解密、TS 分片合并"""
import asyncio
import logging
import re
from pathlib import Path
from typing import Optional
from urllib.parse import urljoin

import aiofiles
from Crypto.Cipher import AES
from Crypto.Util.Padding import unpad

from .base import BaseDownloader


class HlsDownloader(BaseDownloader):

    @staticmethod
    def _parse_playlist(text: str) -> list[dict]:
        """解析 m3u8 分片列表，附带各分片的 KEY 信息"""
        lines = [l.strip() for l in text.splitlines() if l.strip()]
        segments = []
        pending_key = None
        seq = 0
        for line in lines:
            if line.startswith("#EXT-X-MEDIA-SEQUENCE:"):
                try:
                    seq = int(line.split(":", 1)[1])
                except Exception:
                    seq = 0
            elif line.startswith("#EXT-X-KEY:"):
                attrs = dict(re.findall(
                    r'([A-Z0-9\-]+)=("[^"]*"|[^,]*)',
                    line[len("#EXT-X-KEY:"):]
                ))
                method = attrs.get("METHOD", "").strip('"')
                if method == "AES-128":
                    pending_key = {
                        "uri": attrs.get("URI", "").strip('"'),
                        "iv":  attrs.get("IV", "").strip('"'),
                    }
                else:
                    pending_key = None
            elif not line.startswith("#"):
                segments.append({"uri": line, "seq": seq, "key": pending_key})
                seq += 1
        return segments

    @staticmethod
    def _select_best_variant(text: str, base_url: str) -> Optional[str]:
        """主播放列表：返回最高 BANDWIDTH 变体 URL"""
        best_url, best_bw = None, -1
        lines = text.splitlines()
        for i, ln in enumerate(lines):
            if ln.startswith("#EXT-X-STREAM-INF"):
                m = re.search(r"BANDWIDTH=(\d+)", ln)
                bw = int(m.group(1)) if m else 0
                if i + 1 < len(lines) and not lines[i + 1].startswith("#"):
                    if bw > best_bw:
                        best_bw = bw
                        best_url = urljoin(base_url, lines[i + 1].strip())
        return best_url

    async def download(self, url: str, output_dir: Path, filename: str) -> Optional[str]:
        output_path = output_dir / f"{filename}.mp4"
        output_path.parent.mkdir(parents=True, exist_ok=True)

        text = await self._fetch_text(url)
        if not text:
            logging.warning(f"HLS 主清单获取失败: {url}")
            return None

        # 主播放列表：递归到子清单
        if "#EXT-X-STREAM-INF" in text:
            best = self._select_best_variant(text, url)
            if best:
                return await self.download(best, output_dir, filename)

        base = url.rsplit("/", 1)[0] + "/"
        entries = self._parse_playlist(text)
        if not entries:
            logging.warning(f"m3u8 未找到分片: {url}")
            return None

        ts_dir = output_dir / f"{filename}_ts"
        ts_dir.mkdir(parents=True, exist_ok=True)

        # 预取所有 key
        key_cache: dict[str, bytes] = {}
        for ent in entries:
            k = ent["key"]
            if k and k["uri"] not in key_cache:
                key_url = k["uri"] if k["uri"].startswith("http") \
                    else urljoin(base, k["uri"])
                kb = await self._fetch_bytes(key_url)
                if kb is None or len(kb) not in (16, 24, 32):
                    logging.warning(f"HLS key 下载失败: {key_url}")
                    return None
                key_cache[k["uri"]] = kb

        sem = asyncio.Semaphore(10)
        failed: list[int] = []

        async def fetch_segment(idx: int, ent: dict):
            async with sem:
                seg_url = ent["uri"]
                if not seg_url.startswith("http"):
                    seg_url = urljoin(base, seg_url)
                data = await self._fetch_bytes(seg_url)
                if data is None:
                    failed.append(idx)
                    return

                k = ent["key"]
                if k:
                    key = key_cache[k["uri"]]
                    iv = self._derive_iv(k.get("iv", ""), ent["seq"])
                    try:
                        cipher = AES.new(key, AES.MODE_CBC, iv)
                        data = unpad(cipher.decrypt(data), AES.block_size)
                    except Exception as e:
                        logging.debug(f"AES 解密失败 seg={idx}: {e}")

                try:
                    async with aiofiles.open(ts_dir / f"seg_{idx:06d}.ts", "wb") as f:
                        await f.write(data)
                except Exception as e:
                    logging.debug(f"写分片失败 seg={idx}: {e}")
                    failed.append(idx)

        async with asyncio.TaskGroup() as tg:
            for idx, ent in enumerate(entries):
                tg.create_task(fetch_segment(idx, ent))

        if failed:
            logging.warning(f"HLS 有 {len(failed)} 个分片下载失败: {url}")

        return await self._merge_ts(ts_dir, output_path, len(entries))

    @staticmethod
    def _derive_iv(iv_str: str, seq: int) -> bytes:
        """推导 AES-CBC 的初始向量
        - 若显式提供 IV，按十六进制解析
        - 否则使用分片序号（大端 16 字节）
        """
        if iv_str:
            hex_str = iv_str[2:] if iv_str.lower().startswith("0x") else iv_str
            try:
                return bytes.fromhex(hex_str.zfill(32))
            except Exception:
                pass
        return seq.to_bytes(16, "big")

    async def _merge_ts(self, ts_dir: Path, output_path: Path,
                        total: int) -> Optional[str]:
        concat = ts_dir / "concat.txt"
        async with aiofiles.open(concat, "w", encoding="utf-8") as f:
            for i in range(total):
                p = ts_dir / f"seg_{i:06d}.ts"
                if p.exists() and p.stat().st_size > 0:
                    await f.write(f"file '{p.as_posix()}'\n")

        try:
            proc = await asyncio.create_subprocess_exec(
                "ffmpeg", "-y", "-loglevel", "error",
                "-f", "concat", "-safe", "0", "-i", str(concat),
                "-c", "copy", "-bsf:a", "aac_adtstoasc", str(output_path),
                stdout=asyncio.subprocess.DEVNULL,
                stderr=asyncio.subprocess.PIPE,
            )
            _, err = await proc.communicate()
            if proc.returncode == 0 and output_path.exists():
                for p in ts_dir.glob("*.ts"):
                    p.unlink(missing_ok=True)
                concat.unlink(missing_ok=True)
                try:
                    ts_dir.rmdir()
                except OSError:
                    pass
                logging.info(f"HLS 合并完成: {output_path}")
                return str(output_path)
            logging.error(f"ffmpeg 失败: {err.decode('utf-8', 'ignore')[:200]}")
        except FileNotFoundError:
            logging.error("未找到 ffmpeg，请先安装")
        except Exception as e:
            logging.error(f"HLS 合并异常: {e}")
        return None