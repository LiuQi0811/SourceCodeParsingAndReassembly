# -*- coding: utf-8 -*-
"""DASH (mpd) 下载器：兼容有/无命名空间，支持 SegmentURL 与 SegmentTemplate"""
import asyncio
import logging
import re
from pathlib import Path
from typing import Optional
from urllib.parse import urljoin

import aiofiles
from lxml import etree

from .base import BaseDownloader


class DashDownloader(BaseDownloader):

    def _extract_segment_urls(self, root, base_url: str) -> list[str]:
        urls: list[str] = []
        for ns in ({"mpd": "urn:mpeg:dash:schema:mpd:2011"}, {}):
            prefix = "mpd:" if ns else ""
            try:
                # SegmentURL（SegmentList）
                segs = (root.xpath(f"//{prefix}SegmentURL/@media", namespaces=ns)
                        if ns else root.xpath("//SegmentURL/@media"))
                if segs:
                    return list(segs)

                # SegmentTemplate
                tmpls = (root.xpath(f"//{prefix}SegmentTemplate", namespaces=ns)
                         if ns else root.xpath("//SegmentTemplate"))
                for t in tmpls:
                    media = t.get("media", "")
                    if not media:
                        continue
                    try:
                        start = int(t.get("startNumber", "1"))
                    except Exception:
                        start = 1
                    urls.extend(self._expand_template(media, start))
                    break
                if urls:
                    return urls
            except Exception:
                continue
        return urls

    @staticmethod
    def _expand_template(media: str, start: int) -> list[str]:
        """展开 SegmentTemplate：支持 $Number$ 与 $Number%0Nd$ 补零写法"""
        m = re.search(r"\$Number%0(\d+)d\$", media)
        if m:
            media = re.sub(r"\$Number%0\d+d\$",
                           "{0:0" + m.group(1) + "d}", media)
        elif "$Number$" in media:
            media = media.replace("$Number$", "{}")
        if "{" in media:
            return [media.format(i) for i in range(start, start + 20000)]
        return [media]

    async def _download_segments(self, seg_dir: Path, seg_urls: list[str],
                                 base_url: str) -> list[int]:
        """并发窗口拉取分片；整批连续失败视为已到结尾，避免空拉两万请求"""
        saved: list[int] = []
        window = 20
        i = 0
        while i < len(seg_urls):
            batch = seg_urls[i:i + window]
            results = await asyncio.gather(*[
                self._save_segment(seg_dir, i + j, u, base_url)
                for j, u in enumerate(batch)
            ])
            ok = sum(1 for _, succ in results if succ)
            saved.extend(idx for idx, succ in results if succ)
            if ok == 0:
                break
            i += window
        return saved

    async def _save_segment(self, seg_dir: Path, idx: int, u: str,
                            base_url: str) -> tuple[int, bool]:
        abs_url = u if u.startswith("http") else urljoin(base_url, u)
        data = await self._fetch_bytes(abs_url)
        if not data:
            return idx, False
        try:
            async with aiofiles.open(seg_dir / f"seg_{idx:06d}.m4s", "wb") as f:
                await f.write(data)
            return idx, True
        except Exception as e:
            logging.debug(f"DASH 写分片失败: {e}")
            return idx, False

    async def download(self, url: str, output_dir: Path, filename: str) -> Optional[str]:
        output_path = output_dir / f"{filename}.mp4"
        output_path.parent.mkdir(parents=True, exist_ok=True)

        text = await self._fetch_text(url)
        if not text:
            return None
        try:
            root = etree.fromstring(text.encode("utf-8"))
        except Exception as e:
            logging.warning(f"MPD 解析失败: {e}")
            return None

        base_url = url.rsplit("/", 1)[0] + "/"
        seg_urls = self._extract_segment_urls(root, base_url)
        if not seg_urls:
            logging.warning(f"MPD 未找到分片: {url}")
            return None

        seg_dir = output_dir / f"{filename}_dash"
        seg_dir.mkdir(parents=True, exist_ok=True)

        saved = await self._download_segments(seg_dir, seg_urls, base_url)

        if not saved:
            return None

        concat = seg_dir / "concat.txt"
        async with aiofiles.open(concat, "w", encoding="utf-8") as f:
            for i in sorted(saved):
                p = seg_dir / f"seg_{i:06d}.m4s"
                await f.write(f"file '{p.as_posix()}'\n")

        try:
            proc = await asyncio.create_subprocess_exec(
                "ffmpeg", "-y", "-loglevel", "error",
                "-f", "concat", "-safe", "0", "-i", str(concat),
                "-c", "copy", str(output_path),
                stdout=asyncio.subprocess.DEVNULL,
                stderr=asyncio.subprocess.PIPE,
            )
            _, err = await proc.communicate()
            if proc.returncode == 0 and output_path.exists():
                for p in seg_dir.glob("*.m4s"):
                    p.unlink(missing_ok=True)
                concat.unlink(missing_ok=True)
                try:
                    seg_dir.rmdir()
                except OSError:
                    pass
                logging.info(f"DASH 合并完成: {output_path}")
                return str(output_path)
            logging.error(f"ffmpeg DASH 失败: {err.decode('utf-8', 'ignore')[:200]}")
        except FileNotFoundError:
            logging.error("未找到 ffmpeg")
        return None