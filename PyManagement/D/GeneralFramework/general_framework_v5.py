"""
单页面媒体嗅探采集器
支持：HLS(m3u8 ts/fmp4) / DASH‑MPD(m4s分片) / 完整MP4短视频
限制：不是全站爬虫，仅处理单个播放页面；DRM、blob视频无法抓取
"""
import asyncio
import os
import shutil
import tempfile
import re
from dataclasses import dataclass
from enum import Enum
from typing import Optional, List, Dict, Any

import m3u8
from lxml import etree
from playwright.async_api import async_playwright, Page, Response
import ffmpeg

# ===================== 数据结构体 =====================
@dataclass
class SegmentItem:
    url: str
    init_url: Optional[str] = None
    duration: float = 0.0
    byte_range: Optional[str] = None
    is_encrypted: bool = False

@dataclass
class MediaStream:
    stream_type: str  # video / audio / subtitle
    bandwidth: int
    segments: List[SegmentItem]
    resolution: Optional[str] = None

@dataclass
class MediaManifest:
    manifest_type: str  # hls / dash / smooth
    streams: List[MediaStream]
    has_drm: bool = False
    drm_scheme: Optional[str] = None
    raw_content: Optional[str] = None


class MediaManifestType(Enum):
    HLS_M3U8 = "hls_m3u8"
    DASH_MPD = "dash_mpd"
    SMOOTH_ISM = "smooth_ism"
    SEGMENT_TS = "seg_ts"
    SEGMENT_M4S = "seg_m4s"
    FULL_MP4 = "full_mp4"
    UNKNOWN = "unknown"


# ===================== 媒体类型检测器 =====================
def detect_media_type(url: str, content_type: str = "") -> MediaManifestType:
    url_low = url.lower()
    ct_low = content_type.lower() if content_type else ""

    if url_low.endswith(".m3u8") or "application/x-mpegurl" in ct_low or "vnd.apple.mpegurl" in ct_low:
        return MediaManifestType.HLS_M3U8
    if url_low.endswith(".mpd") or "application/dash+xml" in ct_low:
        return MediaManifestType.DASH_MPD
    if ".ism" in url_low or ".ismc" in url_low or "application/vnd.ms-smoothstreaming" in ct_low:
        return MediaManifestType.SMOOTH_ISM
    if url_low.endswith(".ts"):
        return MediaManifestType.SEGMENT_TS
    if url_low.endswith(".m4s") or ".fmp4" in url_low:
        return MediaManifestType.SEGMENT_M4S
    if "video/mp4" in ct_low or url_low.endswith(".mp4"):
        return MediaManifestType.FULL_MP4
    return MediaManifestType.UNKNOWN


# ===================== HLS M3U8解析 =====================
def parse_m3u8(raw_text: str, base_url: str) -> MediaManifest:
    m = m3u8.loads(raw_text, base_uri=base_url)
    streams: List[MediaStream] = []
    has_drm = bool(m.keys)

    if m.segments:
        seg_list: List[SegmentItem] = []
        init_url: Optional[str] = None
        if m.init_section:
            init_url = m.init_section.absolute_uri

        for seg in m.segments:
            seg_item = SegmentItem(
                url=seg.absolute_uri,
                init_url=init_url,
                duration=seg.duration or 0.0,
                byte_range=seg.byte_range,
                is_encrypted=bool(seg.key)
            )
            seg_list.append(seg_item)
        streams.append(MediaStream(
            stream_type="video",
            bandwidth=0,
            segments=seg_list
        ))

    for pl in m.playlists:
        seg_list: List[SegmentItem] = []
        init_url = None
        if pl.init_section:
            init_url = pl.init_section.absolute_uri
        for seg in pl.segments:
            seg_item = SegmentItem(
                url=seg.absolute_uri,
                init_url=init_url,
                duration=seg.duration or 0.0,
                byte_range=seg.byte_range,
                is_encrypted=bool(seg.key)
            )
            seg_list.append(seg_item)
        streams.append(MediaStream(
            stream_type="video",
            bandwidth=pl.stream_info.bandwidth or 0,
            segments=seg_list,
            resolution=pl.stream_info.resolution
        ))

    return MediaManifest(
        manifest_type="hls",
        streams=streams,
        has_drm=has_drm,
        raw_content=raw_text
    )


# ===================== DASH‑MPD手写解析(lxml，兼容B站) =====================
def parse_mpd(raw_xml: str) -> MediaManifest:
    streams: List[MediaStream] = []
    has_drm = False
    ns = {"mpd": "urn:mpeg:dash:schema:mpd:2011"}
    try:
        root = etree.fromstring(raw_xml.encode("utf-8"))
        for period in root.xpath(".//mpd:Period", namespaces=ns):
            for adp in period.xpath("./mpd:AdaptationSet", namespaces=ns):
                prots = adp.xpath("./mpd:ContentProtection", namespaces=ns)
                if len(prots) > 0:
                    has_drm = True

                content_type = adp.get("contentType")
                if not content_type:
                    mime = adp.get("mimeType", "")
                    content_type = mime.split("/")[0] if "/" in mime else "video"

                for rep in adp.xpath("./mpd:Representation", namespaces=ns):
                    bw = int(rep.get("bandwidth", "0"))
                    w = rep.get("width")
                    h = rep.get("height")
                    res = f"{w}x{h}" if w and h else None

                    seg_items: List[SegmentItem] = []
                    init_url: Optional[str] = None
                    seg_tmpl = rep.find("./mpd:SegmentTemplate", namespaces=ns)
                    if seg_tmpl is not None:
                        init_elem = seg_tmpl.find("./mpd:Initialization", namespaces=ns)
                        if init_elem is not None:
                            init_url = init_elem.get("sourceURL")
                        media_template = seg_tmpl.get("media", "")
                        timeline = seg_tmpl.find("./mpd:SegmentTimeline", namespaces=ns)
                        if timeline is not None:
                            seg_nodes = timeline.findall("./mpd:S", namespaces=ns)
                            num = 1
                            for s in seg_nodes:
                                dur = float(s.get("d", 0))
                                seg_url = re.sub(r"\$Number\$", str(num), media_template)
                                seg_items.append(SegmentItem(
                                    url=seg_url,
                                    init_url=init_url,
                                    duration=dur
                                ))
                                num += 1
                    streams.append(MediaStream(
                        stream_type=content_type,
                        bandwidth=bw,
                        segments=seg_items,
                        resolution=res
                    ))
    except Exception as e:
        print(f"[MPD解析警告] {e}")

    return MediaManifest(
        manifest_type="dash",
        streams=streams,
        has_drm=has_drm,
        raw_content=raw_xml
    )


# ===================== 媒体采集器核心类 =====================
class MediaSegmentCollector:
    def __init__(self):
        self.manifests: List[MediaManifest] = []
        self.raw_manifest_store: List[Dict[str, Any]] = []
        self.full_mp4_urls: List[str] = []

    async def on_response(self, response: Response):
        url = response.url
        ct = response.headers.get("content-type", "")
        mtype = detect_media_type(url, ct)

        if mtype == MediaManifestType.HLS_M3U8:
            text = await response.text()
            manifest = parse_m3u8(text, base_url=url)
            self.manifests.append(manifest)
            self.raw_manifest_store.append({"url": url, "type": "hls", "raw": text})

        elif mtype == MediaManifestType.DASH_MPD:
            text = await response.text()
            manifest = parse_mpd(text)
            self.manifests.append(manifest)
            self.raw_manifest_store.append({"url": url, "type": "dash", "raw": text})

        # B站 playurl内嵌MPD钩子
        if "playurl" in url and response.request.method == "GET":
            try:
                j = await response.json()
                dash_info = j.get("data", {}).get("dash", {})
                mpd_xml = dash_info.get("manifest")
                if mpd_xml:
                    manifest = parse_mpd(mpd_xml)
                    self.manifests.append(manifest)
                    self.raw_manifest_store.append({"url": url, "type": "dash_bilibili_hook", "raw": mpd_xml})
            except Exception:
                pass

        if mtype == MediaManifestType.FULL_MP4:
            if url not in self.full_mp4_urls:
                self.full_mp4_urls.append(url)

    async def download_segment(self, page: Page, seg: SegmentItem, save_path: str):
        res = await page.request.fetch(seg.url)
        data = await res.body()
        with open(save_path, "wb") as f:
            f.write(data)

    async def download_full_mp4(self, page: Page, mp4_url: str, output_path: str):
        resp = await page.request.fetch(mp4_url)
        binary_data = await resp.body()
        with open(output_path, "wb") as f:
            f.write(binary_data)
        print(f"✅完整短视频已保存: {output_path}")

    def build_local_m3u8(self, seg_list: List[SegmentItem], local_dir: str, filename: str) -> str:
        m3u8_path = os.path.join(local_dir, filename)
        lines = ["#EXTM3U", "#EXT-X-VERSION:6"]
        for seg in seg_list:
            lines.append(f"#EXT-X-DURATION:{seg.duration:.3f}")
            local_name = os.path.basename(seg.url.split("?")[0])
            local_file = os.path.join(local_dir, local_name)
            lines.append(local_file)
        lines.append("#EXT-X-ENDLIST")
        with open(m3u8_path, "w", encoding="utf-8") as f:
            f.write("\n".join(lines))
        return m3u8_path

    async def assemble_manifest_to_mp4(self, manifest: MediaManifest, page: Page, output_mp4: str):
        if manifest.has_drm:
            raise RuntimeError("检测DRM加密流，跳过合并")

        temp_dir = tempfile.mkdtemp(prefix="media_fetch_")
        try:
            video_stream: Optional[MediaStream] = None
            audio_stream: Optional[MediaStream] = None
            for s in manifest.streams:
                if s.stream_type == "video" and len(s.segments) > 0:
                    video_stream = s
                if s.stream_type == "audio" and len(s.segments) > 0:
                    audio_stream = s

            if not video_stream and not audio_stream:
                raise RuntimeError("没有可用音视频分片")

            video_m3u8 = ""
            if video_stream:
                for idx, seg in enumerate(video_stream.segments):
                    fn = f"v_{idx}.m4s"
                    await self.download_segment(page, seg, os.path.join(temp_dir, fn))
                video_m3u8 = self.build_local_m3u8(video_stream.segments, temp_dir, "video.m3u8")

            audio_m3u8 = ""
            if audio_stream:
                for idx, seg in enumerate(audio_stream.segments):
                    fn = f"a_{idx}.m4s"
                    await self.download_segment(page, seg, os.path.join(temp_dir, fn))
                audio_m3u8 = self.build_local_m3u8(audio_stream.segments, temp_dir, "audio.m3u8")

            video_only = os.path.join(temp_dir, "v_only.mp4")
            audio_only = os.path.join(temp_dir, "a_only.mp4")

            if video_m3u8:
                (
                    ffmpeg
                    .input(video_m3u8)
                    .output(video_only, c="copy")
                    .overwrite_output()
                    .run()
                )
            if audio_m3u8:
                (
                    ffmpeg
                    .input(audio_m3u8)
                    .output(audio_only, c="copy")
                    .overwrite_output()
                    .run()
                )

            if os.path.exists(video_only) and os.path.exists(audio_only):
                (
                    ffmpeg
                    .concat(
                        ffmpeg.input(video_only),
                        ffmpeg.input(audio_only),
                        v=1, a=1
                    )
                    .output(output_mp4, c="copy")
                    .overwrite_output()
                    .run()
                )
            elif os.path.exists(video_only):
                shutil.copy(video_only, output_mp4)
            elif os.path.exists(audio_only):
                shutil.copy(audio_only, output_mp4)
            print(f"✅分片流合并输出: {output_mp4}")
        finally:
            shutil.rmtree(temp_dir, ignore_errors=True)


# ===================== 入口main =====================
async def main():
    CONFIG = {
        "target_url": "https://www.bilibili.com/video/BV1xx411c7mZ",
        "output_mp4": "./out_video.mp4",
        "headless": True,
        "wait_dom_timeout": 15,
        "total_wait": 15
    }

    collector = MediaSegmentCollector()

    async with async_playwright() as p:
        browser = await p.chromium.launch(
            headless=CONFIG["headless"],
            args=[
                "--no-sandbox",
                "--mute-audio",
                "--autoplay-policy=no-user-gesture-required"
            ]
        )
        page = await browser.new_page()

        # 打印所有网络请求用于调试
        page.on("response", lambda r: print(f"[NET] {r.status} {r.url[:140]}"))
        page.on("response", collector.on_response)

        await page.goto(CONFIG["target_url"], timeout=90000, wait_until="networkidle")

        # 等待video DOM出现
        try:
            await page.wait_for_selector("video", timeout=CONFIG["wait_dom_timeout"] * 1000)
            print("✅找到video dom节点")
        except Exception:
            print("⚠️页面未找到video标签，播放器还未渲染")

        # 优先点击B站播放按钮
        try:
            await page.click(".bpx-player-control-play", timeout=3000)
            print("✅点击B站播放按钮成功")
        except Exception:
            print("⚠️未找到播放按钮，执行JS播放")
            await page.evaluate("""
            {
                const v = document.querySelector('video');
                if(v) {
                    v.muted = true;
                    v.play().catch(e=>console.log("play err",e));
                }
            }
            """)

        await asyncio.sleep(CONFIG["total_wait"])

        print("\n=====采集统计=====")
        print(f"收集到 {len(collector.manifests)} 个媒体清单")
        print(f"捕获完整MP4短视频链接数量: {len(collector.full_mp4_urls)}")

        for idx, raw in enumerate(collector.raw_manifest_store):
            print(f"manifest[{idx}] url: {raw.get('url')}")
        for url in collector.full_mp4_urls:
            print(f"full‑mp4 url: {url}")

        success = False
        if len(collector.full_mp4_urls) > 0:
            first_mp4_url = collector.full_mp4_urls[0]
            await collector.download_full_mp4(page, first_mp4_url, CONFIG["output_mp4"])
            success = True
        else:
            for idx, mf in enumerate(collector.manifests):
                print(f"manifest:{idx} type={mf.manifest_type} drm={mf.has_drm} streams={len(mf.streams)}")
                if not mf.has_drm and len(mf.streams) > 0:
                    await collector.assemble_manifest_to_mp4(mf, page, CONFIG["output_mp4"])
                    success = True
                    break

        if not success:
            print("❌没有捕获到可用媒体资源，无法导出视频")

        await browser.close()


if __name__ == "__main__":
    asyncio.run(main())
