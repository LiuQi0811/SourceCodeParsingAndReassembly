# -*- coding: utf-8 -*-
"""
DASH (mpd) 下载与合并
  - 解析 mpd XML：SegmentTemplate($Number$/$RepresentationID$)/SegmentList/BaseURL
  - 并行下载 init + media 分片（fMP4），经 ffmpeg concat demuxer 合并为 mp4
  - 校验：ffprobe 探测时长
"""
from __future__ import annotations

import asyncio
import logging
import pathlib
import re
import shutil
from typing import Dict, List, Optional, Tuple
from urllib.parse import urljoin

from lxml import etree

from .base import VideoMergeError, VideoMerger
from .ffmpeg_utils import ffprobe_duration, run_ffmpeg

logger = logging.getLogger("crawler.video.dash")

_NS = {"mpd": "urn:mpeg:dash:schema:mpd:2011"}


def _qn(tag: str) -> str:
    return f"{{{_NS['mpd']}}}{tag}"


def _sub_template(template: str, rep_id: str, bandwidth: str, number: Optional[int] = None) -> str:
    """替换 SegmentTemplate 中的 $RepresentationID$ / $Bandwidth$ / $Number%05d$ 等占位符"""
    s = template.replace("$RepresentationID$", rep_id).replace("$Bandwidth$", bandwidth)
    if number is not None:
        def _fmt(match: "re.Match") -> str:
            fmt = match.group(1) or "d"
            return format(number, fmt)

        s = re.sub(r"\$Number%([0-9]*d)\$", _fmt, s)
        s = s.replace("$Number$", str(number))
    return s


def _local(node) -> str:
    return etree.QName(node).localname if isinstance(node.tag, str) else ""


def _resolve(url: str, base: str) -> str:
    return urljoin(base, url)


class DASHMerger(VideoMerger):
    protocol = "dash"

    def __init__(self, fetcher, task_ctx, storage, event_bus=None, ffmpeg_sem=None,
                 segment_concurrency: int = 8) -> None:
        super().__init__(fetcher, task_ctx, storage, event_bus)
        self.segment_concurrency = segment_concurrency
        self._ffmpeg_sem = ffmpeg_sem

    async def _fetch_mpd(self, url: str, task) -> Tuple[bytes, str]:
        res = await self.fetcher.fetch(
            url, binary=True, referer=task.referer if task else "",
            verify_ssl=task.verify_ssl if task else True,
            auth=task.auth if task else None, timeout=60,
        )
        return res.raw, res.final_url or url

    def _find_video_rep(self, root) -> Optional[etree._Element]:
        """定位视频 Representation：优先 mimeType=video，其次带宽最高"""
        best = None
        best_bw = -1
        for rep in root.iter(_qn("Representation")):
            parent = rep.getparent()
            mime = parent.get("mimeType") or parent.get("contentType") or ""
            if "video" not in mime.lower() and not (parent.get("id") or "").lower().startswith("video"):
                # 没有明确标记时仍可能被选中（默认第一个）
                continue
            bw = int(rep.get("bandwidth") or 0)
            if best is None or bw > best_bw:
                best, best_bw = rep, bw
        if best is None:
            # 回退：第一个带 SegmentTemplate/List 的 Representation
            for rep in root.iter(_qn("Representation")):
                return rep
        return best

    def _build_urls(self, rep, mpd_url: str) -> Tuple[List[str], List[str]]:
        """返回 (init_urls, segment_urls)；支持 SegmentTemplate / SegmentList"""
        init_urls: List[str] = []
        seg_urls: List[str] = []
        base = mpd_url

        rep_id = rep.get("id") or ""
        # 收集 BaseURL（层级链）
        node = rep
        base_urls: List[str] = []
        while node is not None:
            for bu in node.findall(_qn("BaseURL")):
                base_urls.append((bu.text or "").strip())
            node = node.getparent()
        base_path = "".join(base_urls) or ""

        # --- SegmentTemplate ---
        templ = rep.find(_qn("SegmentTemplate"))
        if templ is None and rep.getparent() is not None:
            templ = rep.getparent().find(_qn("SegmentTemplate"))
        if templ is not None:
            init = templ.get("initialization")
            media = templ.get("media")
            start = int(templ.get("startNumber") or 1)
            # 分片数量：优先 SegmentList/segmentTimeline，否则用时长估算
            seg_list = templ.find(_qn("SegmentList"))
            count = None
            timeline = templ.find(_qn("SegmentTimeline"))
            if seg_list is not None:
                sels = seg_list.findall(_qn("SegmentURL"))
                if sels:
                    count = len(sels)
            if count is None and timeline is not None:
                total = 0
                for s in timeline.findall(_qn("S")):
                    total += int(s.get("r") or 1)
                count = total if total > 0 else None
            if init:
                u = _resolve(
                    base_path + _sub_template(init, rep_id, rep.get("bandwidth") or ""), base
                )
                init_urls.append(u)
            if media:
                if count is None:
                    raise VideoMergeError("DASH SegmentTemplate 无法确定分片数量（无 SegmentList/Timeline）")
                for n in range(start, start + count):
                    u = _resolve(
                        base_path + _sub_template(media, rep_id, rep.get("bandwidth") or "", n),
                        base,
                    )
                    seg_urls.append(u)
            return init_urls, seg_urls

        # --- SegmentList ---
        seg_list = rep.find(_qn("SegmentList"))
        if seg_list is None and rep.getparent() is not None:
            seg_list = rep.getparent().find(_qn("SegmentList"))
        if seg_list is not None:
            init = seg_list.find(_qn("Initialization"))
            if init is not None:
                init_urls.append(_resolve(base_path + (init.get("sourceURL") or ""), base))
            for su in seg_list.findall(_qn("SegmentURL")):
                media = su.get("media")
                if media:
                    seg_urls.append(_resolve(base_path + media, base))
            return init_urls, seg_urls

        # --- 纯 BaseURL（单文件） ---
        if base_urls:
            return [], [_resolve(base_path, base)]
        raise VideoMergeError("mpd 中未找到可下载的 SegmentTemplate / SegmentList / BaseURL")

    @staticmethod
    def _strip_baseurl(raw: bytes) -> bytes:
        """删除 mpd 中的 BaseURL 元素并重新序列化（分片已本地化，避免 ffmpeg 去远端拉取）"""
        try:
            root = etree.fromstring(raw)
        except etree.XMLSyntaxError:
            return raw
        for bu in root.iter(_qn("BaseURL")):
            parent = bu.getparent()
            if parent is not None:
                parent.remove(bu)
        return etree.tostring(root, xml_declaration=True, encoding="utf-8")

    def _local_name(self, url: str, fallback: str) -> str:
        """从分片 URL 提取文件名（与 mpd 模板展开结果一致）"""
        from urllib.parse import urlparse

        name = pathlib.PurePosixPath(urlparse(url).path).name
        if not name:
            name = urlparse(url).path.rstrip("/").split("/")[-1]
        return name or fallback

    async def download(self, url: str, dest_dir: pathlib.Path, filename: str, job) -> pathlib.Path:
        task = self.task_ctx.get(job.task_id) if self.task_ctx else None
        dest_dir.mkdir(parents=True, exist_ok=True)
        tmp = dest_dir / f".{filename}.parts"
        tmp.mkdir(parents=True, exist_ok=True)
        ok = False

        try:
            raw, mpd_url = await self._fetch_mpd(url, task)
            try:
                root = etree.fromstring(raw)
            except etree.XMLSyntaxError as exc:
                raise VideoMergeError(f"mpd XML 解析失败: {exc}")
            rep = self._find_video_rep(root)
            if rep is None:
                raise VideoMergeError("mpd 中未找到视频 Representation")
            init_urls, seg_urls = self._build_urls(rep, mpd_url)
            if not seg_urls:
                raise VideoMergeError("mpd 未解析到任何分片")

            # 本地化 mpd：去掉 BaseURL，分片相对路径即可被 ffmpeg 解析
            (tmp / "local.mpd").write_bytes(self._strip_baseurl(raw))

            sem = asyncio.Semaphore(self.segment_concurrency)

            async def grab(u: str, name: str, idx: int) -> None:
                dest = tmp / name
                # 合并失败重试：已下载分片（非空）直接复用，不再请求
                if dest.exists() and dest.stat().st_size > 0:
                    return
                async with sem:
                    await self.fetcher.stream_to_file(
                        u, str(dest), referer=url,
                        verify_ssl=task.verify_ssl if task else True,
                        auth=task.auth if task else None, timeout=120,
                    )

            tasks = []
            for i, u in enumerate(init_urls):
                tasks.append(asyncio.create_task(grab(u, self._local_name(u, f"init_{i}.m4s"), i)))
            for i, u in enumerate(seg_urls):
                tasks.append(asyncio.create_task(
                    grab(u, self._local_name(u, f"seg_{i:06d}.m4s"), len(init_urls) + i)
                ))
            results = await asyncio.gather(*tasks, return_exceptions=True)
            errors = [e for e in results if isinstance(e, Exception)]
            if errors:
                raise VideoMergeError(f"DASH 分片下载失败: {errors[0]}")

            mp4 = dest_dir / f"{filename}.mp4"
            if self._ffmpeg_sem:
                async with self._ffmpeg_sem:
                    rc, _, err = await run_ffmpeg(
                        ["-i", "local.mpd", "-c", "copy", str(mp4)],
                        timeout=600, cwd=str(tmp),
                    )
            else:
                rc, _, err = await run_ffmpeg(
                    ["-i", "local.mpd", "-c", "copy", str(mp4)],
                    timeout=600, cwd=str(tmp),
                )
            if rc != 0 or not mp4.exists() or mp4.stat().st_size == 0:
                raise VideoMergeError(f"DASH 合并失败（ffmpeg dash demuxer）: {err[-500:]}")
            duration = await ffprobe_duration(str(mp4))
            if duration is None or duration <= 0:
                raise VideoMergeError("DASH 合并结果校验失败")
            ok = True
            return mp4
        finally:
            # 仅成功时清理分片；失败保留供上层重试复用
            if ok:
                shutil.rmtree(tmp, ignore_errors=True)
