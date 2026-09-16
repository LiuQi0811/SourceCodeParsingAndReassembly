
# downloader/dash_downloader.py
from __future__ import annotations

import asyncio
import logging
import shutil
import tempfile
import xml.etree.ElementTree as ET
from pathlib import Path
from urllib.parse import urljoin

import aiofiles
import aiohttp

from .base import DownloadStrategy

logger = logging.getLogger("DASH")


class DASHDownloader(DownloadStrategy):
    """DASH(.mpd) 下载器"""

    NS = {"mpd": "urn:mpeg:dash:schema:mpd:2011"}

    def __init__(self, segment_concurrency: int = 16):
        self.segment_concurrency = segment_concurrency

    def can_handle(self, url: str, content_type: str = "") -> bool:
        return url.endswith(".mpd") or "dash+xml" in content_type

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
            async with session.get(url, headers=headers,
                                   timeout=aiohttp.ClientTimeout(total=30)) as r:
                r.raise_for_status()
                mpd_text = await r.text()

            segments = self._parse_mpd(mpd_text, base_url)
            if not segments:
                return False

            temp_dir = Path(tempfile.mkdtemp(prefix="dash_"))
            sem = asyncio.Semaphore(self.segment_concurrency)

            async def fetch(idx: int, seg_url: str) -> Path:
                async with sem:
                    async with session.get(
                        seg_url, headers=headers,
                        timeout=aiohttp.ClientTimeout(total=60),
                    ) as r:
                        r.raise_for_status()
                        data = await r.read()
                    p = temp_dir / f"seg_{idx:06d}.m4s"
                    async with aiofiles.open(p, "wb") as f:
                        await f.write(data)
                    return p

            paths = await asyncio.gather(
                *(fetch(i, u) for i, u in enumerate(segments))
            )
            await self._merge(paths, save_path)
            return True
        except Exception as e:
            logger.error(f"DASH 下载失败 {url}: {e!r}")
            return False
        finally:
            if temp_dir and temp_dir.exists():
                shutil.rmtree(temp_dir, ignore_errors=True)
            if own_session:
                await session.close()

    def _parse_mpd(self, mpd_text: str, base_url: str) -> list[str]:
        try:
            root = ET.fromstring(mpd_text)
        except ET.ParseError:
            return []

        segments: list[str] = []
        for template in root.findall(".//mpd:SegmentTemplate", self.NS):
            media = template.get("media", "")
            timeline = template.find("mpd:SegmentTimeline", self.NS)
            if timeline is not None:
                t = 0
                num = 1
                for s in timeline.findall("mpd:S", self.NS):
                    d = int(s.get("d", "0"))
                    r_count = int(s.get("r", "0"))
                    if s.get("t"):
                        t = int(s.get("t"))
                    for _ in range(r_count + 1):
                        u = (media
                             .replace("$Number$", str(num))
                             .replace("$Time$", str(t)))
                        segments.append(urljoin(base_url, u))
                        t += d
                        num += 1
            else:
                # 简化处理：无 SegmentTimeline 时按 duration 估算
                dur = template.get("duration")
                timescale = template.get("timescale", "1")
                period = root.find(".//mpd:Period", self.NS)
                mpd_dur = period.get("duration") if period is not None else None
                if dur and mpd_dur and mpd_dur.startswith("PT"):
                    # 粗略处理，不展开
                    pass
        return segments

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