"""
通用网页媒体嗅探下载器
支持站点：绝大多数普通网页视频，HLS(.m3u8) / DASH(.mpd) / MP4直链
不再绑定B站，输入任意视频播放页URL即可
特性：批量任务、失败隔离、自动分片下载+ffmpeg合并
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

# ===================== 数据模型 =====================
@dataclass
class SegmentItem:
    url: str
    init_url: Optional[str] = None
    duration: float = 0.0
    byte_range: Optional[str] = None
    is_encrypted: bool = False

@dataclass
class MediaStream:
    stream_type: str  # video / audio
    bandwidth: int
    segments: List[SegmentItem]
    resolution: Optional[str] = None

@dataclass
class MediaManifest:
    manifest_type: str  # hls / dash
    streams: List[MediaStream]
    has_drm: bool = False
    raw_content: Optional[str] = None


class MediaType(Enum):
    HLS_M3U8 = "hls_m3u8"
    DASH_MPD = "dash_mpd"
    RAW_MP4 = "raw_mp4"
    UNKNOWN = "unknown"


# ===================== 通用类型识别（无站点硬编码） =====================
def detect_media_response(url: str, content_type: str = "") -> MediaType:
    url_low = url.lower()
    ct_low = content_type.lower() if content_type else ""

    if url_low.endswith(".m3u8") or "mpegurl" in ct_low:
        return MediaType.HLS_M3U8
    if url_low.endswith(".mpd") or "application/dash+xml" in ct_low:
        return MediaType.DASH_MPD
    if url_low.endswith(".mp4") or "video/mp4" in ct_low:
        return MediaType.RAW_MP4
    return MediaType.UNKNOWN


# ===================== HLS M3U8解析 =====================
def parse_hls(raw_text: str, base_url: str) -> MediaManifest:
    m = m3u8.loads(raw_text, base_uri=base_url)
    streams: List[MediaStream] = []
    has_drm = bool(m.keys)

    if m.segments:
        seg_list: List[SegmentItem] = []
        init_uri = m.init_section.absolute_uri if m.init_section else None
        for seg in m.segments:
            seg_list.append(SegmentItem(
                url=seg.absolute_uri,
                init_url=init_uri,
                duration=seg.duration or 0.0,
                byte_range=seg.byte_range,
                is_encrypted=bool(seg.key)
            ))
        streams.append(MediaStream(
            stream_type="video",
            bandwidth=0,
            segments=seg_list
        ))

    for pl in m.playlists:
        seg_list: List[SegmentItem] = []
        init_uri = pl.init_section.absolute_uri if pl.init_section else None
        for seg in pl.segments:
            seg_list.append(SegmentItem(
                url=seg.absolute_uri,
                init_url=init_uri,
                duration=seg.duration or 0.0,
                byte_range=seg.byte_range,
                is_encrypted=bool(seg.key)
            ))
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


# ===================== DASH‑MPD通用解析 =====================
def parse_dash_mpd(xml_text: str) -> MediaManifest:
    streams: List[MediaStream] = []
    has_drm = False
    ns = {"mpd": "urn:mpeg:dash:schema:mpd:2011"}
    try:
        root = etree.fromstring(xml_text.encode("utf‑8"))
        for period in root.xpath(".//mpd:Period", namespaces=ns):
            for adapt_set in period.xpath("./mpd:AdaptationSet", namespaces=ns):
                # 检测DRM保护
                prots = adapt_set.xpath("./mpd:ContentProtection", namespaces=ns)
                if len(prots) > 0:
                    has_drm = True

                mime = adapt_set.get("mimeType", "")
                stype = "video" if "video" in mime else "audio"

                for rep in adapt_set.xpath("./mpd:Representation", namespaces=ns):
                    bw = int(rep.get("bandwidth", "0"))
                    w = rep.get("width")
                    h = rep.get("height")
                    res = f"{w}x{h}" if w and h else None

                    seg_items: List[SegmentItem] = []
                    seg_tmpl = rep.find("./mpd:SegmentTemplate", namespaces=ns)
                    if seg_tmpl is not None:
                        init_elem = seg_tmpl.find("./mpd:Initialization", namespaces=ns)
                        init_url = init_elem.get("sourceURL") if init_elem is not None else None
                        media_tpl = seg_tmpl.get("media", "")
                        timeline = seg_tmpl.find("./mpd:SegmentTimeline", namespaces=ns)
                        if timeline is not None:
                            s_nodes = timeline.findall("./mpd:S", namespaces=ns)
                            num = 1
                            for s in s_nodes:
                                dur = float(s.get("d", 0))
                                seg_url = re.sub(r"\$Number\$", str(num), media_tpl)
                                seg_items.append(SegmentItem(url=seg_url, init_url=init_url, duration=dur))
                                num += 1
                    streams.append(MediaStream(
                        stream_type=stype,
                        bandwidth=bw,
                        segments=seg_items,
                        resolution=res
                    ))
    except Exception as e:
        print(f"[MPD解析异常] {e}")

    return MediaManifest(
        manifest_type="dash",
        streams=streams,
        has_drm=has_drm,
        raw_content=xml_text
    )


# ===================== 通用嗅探器核心类 =====================
class GenericMediaSniffer:
    def __init__(self):
        self.hls_manifests: List[MediaManifest] = []
        self.dash_manifests: List[MediaManifest] = []
        self.direct_mp4_links: List[str] = []

    async def on_network_response(self, resp: Response):
        """通用网络回调，不绑定任何网站DOM"""
        url = resp.url
        ctype = resp.headers.get("content‑type", "")
        mtype = detect_media_response(url, ctype)

        if mtype == MediaType.HLS_M3U8:
            text = await resp.text()
            mf = parse_hls(text, base_url=url)
            self.hls_manifests.append(mf)

        elif mtype == MediaType.DASH_MPD:
            text = await resp.text()
            mf = parse_dash_mpd(text)
            self.dash_manifests.append(mf)

        elif mtype == MediaType.RAW_MP4:
            if url not in self.direct_mp4_links:
                self.direct_mp4_links.append(url)

    async def download_mp4_direct(self, page: Page, mp4_url: str, output_path: str):
        resp = await page.request.fetch(mp4_url)
        data = await resp.body()
        with open(output_path, "wb") as f:
            f.write(data)
        print(f"✅直链MP4已保存 -> {output_path}")

    def build_temp_m3u8(self, seg_list: List[SegmentItem], tmp_dir: str, name: str) -> str:
        path = os.path.join(tmp_dir, name)
        lines = ["#EXTM3U", "#EXT‑X‑VERSION:6"]
        for seg in seg_list:
            lines.append(f"#EXT‑X‑DURATION:{seg.duration:.3f}")
            local_name = os.path.basename(seg.url.split("?")[0])
            lines.append(os.path.join(tmp_dir, local_name))
        lines.append("#EXT‑X‑ENDLIST")
        with open(path, "w", encoding="utf‑8") as f:
            f.write("\n".join(lines))
        return path

    async def download_segments_and_merge(self, manifest: MediaManifest, page: Page, output_mp4: str):
        if manifest.has_drm:
            raise RuntimeError("检测DRM加密流，无法下载")

        tmp_dir = tempfile.mkdtemp(prefix="media_sniff_")
        try:
            video_stream: Optional[MediaStream] = None
            audio_stream: Optional[MediaStream] = None
            for s in manifest.streams:
                if s.stream_type == "video" and len(s.segments) > 0:
                    video_stream = s
                if s.stream_type == "audio" and len(s.segments) > 0:
                    audio_stream = s

            if not video_stream and not audio_stream:
                raise RuntimeError("没有可用分片流")

            v_m3u8 = ""
            if video_stream:
                for idx, seg in enumerate(video_stream.segments):
                    fp = os.path.join(tmp_dir, f"v_{idx}.m4s")
                    r = await page.request.fetch(seg.url)
                    with open(fp, "wb") as f:
                        f.write(await r.body())
                v_m3u8 = self.build_temp_m3u8(video_stream.segments, tmp_dir, "video.m3u8")

            a_m3u8 = ""
            if audio_stream:
                for idx, seg in enumerate(audio_stream.segments):
                    fp = os.path.join(tmp_dir, f"a_{idx}.m4s")
                    r = await page.request.fetch(seg.url)
                    with open(fp, "wb") as f:
                        f.write(await r.body())
                a_m3u8 = self.build_temp_m3u8(audio_stream.segments, tmp_dir, "audio.m3u8")

            v_out = os.path.join(tmp_dir, "v_out.mp4")
            a_out = os.path.join(tmp_dir, "a_out.mp4")

            if v_m3u8:
                ffmpeg.input(v_m3u8).output(v_out, c="copy").overwrite_output().run()
            if a_m3u8:
                ffmpeg.input(a_m3u8).output(a_out, c="copy").overwrite_output().run()

            if os.path.exists(v_out) and os.path.exists(a_out):
                ffmpeg.concat(ffmpeg.input(v_out), ffmpeg.input(a_out), v=1, a=1)\
                    .output(output_mp4, c="copy").overwrite_output().run()
            elif os.path.exists(v_out):
                shutil.copy(v_out, output_mp4)
            elif os.path.exists(a_out):
                shutil.copy(a_out, output_mp4)
            print(f"✅分片合并完成 -> {output_mp4}")
        finally:
            shutil.rmtree(tmp_dir, ignore_errors=True)


# ===================== 通用单视频任务函数 =====================
async def sniffer_task(page_url: str, output_file: str, headless: bool = True, wait_sec: int = 20):
    """
    通用嗅探单个播放页面
    :param page_url: 任意视频播放网页
    :param output_file: 输出mp4路径
    :param headless: 是否无头浏览器
    :param wait_sec: 页面加载等待时间，动态播放器建议15‑25秒
    :return: bool 是否成功
    """
    sniffer = GenericMediaSniffer()
    ok = False
    async with async_playwright() as p:
        browser = await p.chromium.launch(
            headless=headless,
            args=["--no‑sandbox", "--mute‑audio"]
        )
        page = await browser.new_page()
        page.on("response", sniffer.on_network_response)

        try:
            await page.goto(page_url, timeout=120000, wait_until="networkidle")
            # 通用触发播放：JS调用video.play，不写任何网站专属选择器
            await page.evaluate("""
                const els = document.querySelectorAll('video');
                for(let v of els){
                    v.muted = true;
                    v.play().catch(e=>{});
                }
            """)
            await asyncio.sleep(wait_sec)

            # 优先级：直链MP4 > HLS > DASH
            if len(sniffer.direct_mp4_links) > 0:
                await sniffer.download_mp4_direct(page, sniffer.direct_mp4_links[0], output_file)
                ok = True
            elif len(sniffer.hls_manifests) > 0:
                mf = sniffer.hls_manifests[0]
                await sniffer.download_segments_and_merge(mf, page, output_file)
                ok = True
            elif len(sniffer.dash_manifests) > 0:
                mf = sniffer.dash_manifests[0]
                await sniffer.download_segments_and_merge(mf, page, output_file)
                ok = True
            else:
                print(f"⚠️ 页面未捕获到媒体资源：{page_url}")
        except Exception as e:
            print(f"❌任务异常 {page_url} : {str(e)}")
        finally:
            await browser.close()
    return ok


# ===================== 批量入口 =====================
async def batch_run():
    # 填入任意网站的视频播放页URL列表
    url_list = [
        "https://xxx/video/xxx",
        "https://yyy/play/yyy"
    ]
    out_dir = "./generic_download"
    os.makedirs(out_dir, exist_ok=True)

    for i, url in enumerate(url_list):
        print(f"\n-------- Task {i+1}/{len(url_list)} : {url} --------")
        out_path = os.path.join(out_dir, f"clip_{i+1}.mp4")
        success = await sniffer_task(url, out_path, headless=True, wait_sec=20)
        if success:
            print(f">> 完成 {url}")
        else:
            print(f">> 失败 {url}")
        await asyncio.sleep(10)


if __name__ == "__main__":
    asyncio.run(batch_run())
