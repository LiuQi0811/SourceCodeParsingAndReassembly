# core/bilibili_dash.py
"""B 站视频 DASH 下载

完整流程:
1. 从 video URL 或 bvid 提取 bvid
2. 调 wbi/view 拿 cid(第一 P)
3. 调 playurl API(fnval=16) 拿 DASH manifest(JSON)
4. 选最高清晰度 video + 最高音质 audio
5. 下载两路流(baseUrl 必须带 Referer: bilibili.com)
6. ffmpeg 合成 mp4

注意:仅用于下载用户自己有权访问的内容(公开免费视频/已购买视频/自己上传内容),
遵守 B 站服务条款。
"""
import os
import re
import asyncio
from typing import Optional, Tuple, List
import aiohttp

from core.bilibili_wbi import wbi_sign, fetch_wbi_keys
from settings import (
    TIMEOUT_CONNECT, TIMEOUT_READ, SAVE_ROOT, FFMPEG_PATH,
    BILIBILI_SESSDATA,
)
from utils.file_utils import make_resource_dir, safe_filename


# 视频清晰度 ID(由高到低)
# 6=216P, 16=360P, 32=480P, 64=720P, 74=720P60, 80=1080P
# 112=1080P+, 116=1080P60, 120=4K, 125=HDR, 126=杜比视界, 127=HDR120
QUALITY_VIDEO_PRIORITY = [127, 126, 125, 120, 116, 112, 80, 74, 64, 32, 16, 6]
# 音质 ID(由高到低)
# 30216=64K, 30232=132K, 30280=192K, 30250=Dolby, 30251=Hi-Res
QUALITY_AUDIO_PRIORITY = [30251, 30250, 30280, 30232, 30216]


# bvid 形如 BV1xx411c7mD (BV + 10 位 base58)
_BVID_PATTERN = re.compile(r'(BV[0-9A-Za-z]{10})')


def extract_bvid(text: str) -> Optional[str]:
    """从 URL 或纯 bvid 字符串提取 bvid"""
    m = _BVID_PATTERN.search(text)
    return m.group(1) if m else None


class BilibiliDashDownloader:
    def __init__(
            self,
            session: aiohttp.ClientSession,
            sessdata: str = "",
            save_root: str = SAVE_ROOT,
    ):
        self.session = session
        self.save_root = save_root
        # B 站必需 headers:Referer 决定能否下到流;SESSDATA 决定清晰度权限
        self.headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            "Referer": "https://www.bilibili.com/",
            "Origin": "https://www.bilibili.com",
        }
        if sessdata:
            self.headers["Cookie"] = f"SESSDATA={sessdata}"
        # WBI keys 缓存(同 session 内复用,避免重复请求 nav)
        self._wbi_keys: Optional[Tuple[str, str]] = None

    async def _ensure_wbi_keys(self) -> Tuple[str, str]:
        if self._wbi_keys is None:
            self._wbi_keys = await fetch_wbi_keys(self.session, self.headers)
        return self._wbi_keys

    async def _api_get(self, url: str, params: dict, use_wbi: bool = False) -> dict:
        """统一 API 请求,返回 data 字段"""
        if use_wbi:
            img_key, sub_key = await self._ensure_wbi_keys()
            params = wbi_sign(params, img_key, sub_key)
        timeout = aiohttp.ClientTimeout(connect=TIMEOUT_CONNECT, total=TIMEOUT_READ)
        async with self.session.get(
            url, params=params, headers=self.headers, timeout=timeout
        ) as resp:
            if resp.status != 200:
                raise Exception(f"B 站 API HTTP {resp.status}: {url}")
            data = await resp.json()
        if data.get("code") != 0:
            raise Exception(
                f"B 站 API 错误 code={data.get('code')} msg={data.get('message')}"
            )
        return data['data']

    async def fetch_cid(self, bvid: str) -> Tuple[int, str]:
        """bvid → (cid, 标题)(第一 P)"""
        data = await self._api_get(
            'https://api.bilibili.com/x/web-interface/wbi/view',
            params={'bvid': bvid},
            use_wbi=True,
        )
        cid = data['cid']
        title = data.get('title', bvid)
        return cid, title

    async def fetch_dash_manifest(self, bvid: str, cid: int) -> dict:
        """获取 DASH manifest(JSON)"""
        # fnval=16: 请求 DASH; qn=127: 请求最高码率(服务器按权限降级)
        data = await self._api_get(
            'https://api.bilibili.com/x/player/playurl',
            params={
                'bvid': bvid,
                'cid': cid,
                'fnval': 16,
                'fnver': 4,
                'qn': 127,
            },
            use_wbi=False,  # playurl 端点不需 WBI
        )
        if 'dash' not in data:
            raise Exception(
                f"API 未返回 DASH 数据,可能不支持或权限不足。响应字段: {list(data.keys())}"
            )
        return data['dash']

    def _pick_best_video(self, dash: dict) -> dict:
        """选最高可用清晰度 video 流"""
        videos: List[dict] = dash.get('video', [])
        if not videos:
            raise Exception("DASH manifest 无 video 流")
        for qid in QUALITY_VIDEO_PRIORITY:
            for v in videos:
                if v.get('id') == qid:
                    return v
        # 兜底:取第一个
        return videos[0]

    def _pick_best_audio(self, dash: dict) -> Optional[dict]:
        """选最高可用音质 audio 流(若无音频轨返回 None)"""
        audios: List[dict] = dash.get('audio', [])
        if not audios:
            return None
        for qid in QUALITY_AUDIO_PRIORITY:
            for a in audios:
                if a.get('id') == qid:
                    return a
        return audios[0]

    async def _download_stream(self, url: str, save_path: str) -> str:
        """下载单路流(视频或音频);带断点续传"""
        # 已完整下载则跳过
        if os.path.exists(save_path) and os.path.getsize(save_path) > 0:
            return save_path

        headers = dict(self.headers)
        start_pos = 0
        if os.path.exists(save_path):
            start_pos = os.path.getsize(save_path)
        if start_pos > 0:
            headers["Range"] = f"bytes={start_pos}-"

        # 流下载时间放宽 10 倍(B 站 CDN 可能较慢)
        timeout = aiohttp.ClientTimeout(connect=TIMEOUT_CONNECT, total=TIMEOUT_READ * 10)
        async with self.session.get(url, headers=headers, timeout=timeout) as resp:
            if resp.status not in (200, 206):
                raise Exception(f"流下载失败 HTTP {resp.status}: {url}")
            mode = "ab" if resp.status == 206 else "wb"
            with open(save_path, mode) as f:
                async for chunk in resp.content.iter_chunked(65536):
                    f.write(chunk)
        return save_path

    async def _try_download_urls(self, urls: List[str], save_path: str, label: str) -> str:
        """依次尝试 URL 列表直到成功"""
        last_err = None
        for u in urls:
            try:
                return await self._download_stream(u, save_path)
            except Exception as e:
                last_err = e
                print(f"[B站] {label} 流下载失败 {u}: {e}")
                # 失败后清理半成品文件,下次用完整重新下
                if os.path.exists(save_path) and os.path.getsize(save_path) == 0:
                    try:
                        os.remove(save_path)
                    except OSError:
                        pass
        raise Exception(f"所有 {label} 流地址下载失败: {last_err}")

    async def _merge_with_ffmpeg(
            self, video_path: str, audio_path: str, output_path: str
    ) -> str:
        """ffmpeg 合成 video + audio 为 mp4(流复制,不重编码)"""
        cmd = [
            FFMPEG_PATH, "-y",
            "-i", video_path,
            "-i", audio_path,
            "-c", "copy",
            "-movflags", "+faststart",  # moov 前置,支持边下边播
            output_path,
        ]
        proc = await asyncio.create_subprocess_exec(
            *cmd,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        _, stderr = await proc.communicate()
        if proc.returncode != 0:
            raise Exception(
                f"ffmpeg 合成失败 (returncode={proc.returncode}): "
                f"{stderr.decode('utf-8', errors='ignore')[-500:]}"
            )
        return output_path

    async def download_video(
            self,
            video_url_or_bvid: str,
            output_name: str = "",
    ) -> str:
        """完整下载流程

        :param video_url_or_bvid: 完整 B 站视频 URL 或纯 bvid
        :param output_name: 输出文件名(不含扩展名);空则用标题
        :return: 最终 mp4 路径
        """
        bvid = extract_bvid(video_url_or_bvid)
        if not bvid:
            raise Exception(f"无法从 {video_url_or_bvid} 提取 bvid")

        # 1. bvid → cid + 标题
        cid, title = await self.fetch_cid(bvid)
        print(f"[B站] bvid={bvid} cid={cid} 标题={title}")

        # 2. cid → DASH manifest
        dash = await self.fetch_dash_manifest(bvid, cid)
        video_node = self._pick_best_video(dash)
        audio_node = self._pick_best_audio(dash)
        print(
            f"[B站] 视频码率 id={video_node.get('id')} "
            f"codec={video_node.get('codecs')} "
            f"分辨率={video_node.get('width')}x{video_node.get('height')}"
        )
        if audio_node:
            print(f"[B站] 音频码率 id={audio_node.get('id')} codec={audio_node.get('codecs')}")

        # 3. 输出路径
        out_dir = make_resource_dir(self.save_root, "video")
        fn = safe_filename(output_name or title or bvid, fallback=bvid) + ".mp4"
        output_path = os.path.join(out_dir, fn)
        # 已存在则跳过(支持中断重跑)
        if os.path.exists(output_path) and os.path.getsize(output_path) > 0:
            print(f"[B站] 已存在,跳过: {output_path}")
            return output_path

        # 4. 下载两路流到缓存目录
        cache_dir = os.path.join(self.save_root, ".bili_cache", bvid)
        os.makedirs(cache_dir, exist_ok=True)
        video_tmp = os.path.join(cache_dir, "video.m4s")
        audio_tmp = os.path.join(cache_dir, "audio.m4s")

        try:
            # video 流:baseUrl + backupUrl
            video_urls = [video_node.get('baseUrl')] + video_node.get('backupUrl', [])
            video_urls = [u for u in video_urls if u]
            await self._try_download_urls(video_urls, video_tmp, "video")

            # audio 流:baseUrl + backupUrl(若有)
            if audio_node:
                audio_urls = [audio_node.get('baseUrl')] + audio_node.get('backupUrl', [])
                audio_urls = [u for u in audio_urls if u]
                await self._try_download_urls(audio_urls, audio_tmp, "audio")

            # 5. ffmpeg 合成
            if audio_node:
                await self._merge_with_ffmpeg(video_tmp, audio_tmp, output_path)
            else:
                # 无音频轨,直接重命名 video 流为 mp4
                os.rename(video_tmp, output_path)

            print(f"[B站] 完成: {output_path}")
            return output_path

        finally:
            # 清理中间流文件
            for p in (video_tmp, audio_tmp):
                try:
                    if os.path.exists(p):
                        os.remove(p)
                except OSError:
                    pass
            try:
                os.rmdir(cache_dir)
            except OSError:
                pass
