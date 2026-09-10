#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
视频下载模块 - 支持 m3u8、mp4 等格式，断点续传、多线程分片下载
自动处理 m3u8 加密分片的 AES-128 解密
"""
import os
import re
import time
import base64
import logging
import requests
import m3u8
from urllib.parse import urljoin
from concurrent.futures import ThreadPoolExecutor, as_completed
from Crypto.Cipher import AES

from tqdm import tqdm
from config import VIDEO_DIR, M3U8_CONCURRENT, SEGMENT_TIMEOUT

logger = logging.getLogger(__name__)


def safe_filename(name):
    """生成安全的文件名"""
    name = re.sub(r'[<>:"/\\|?*]', '_', name)
    return name[:150]


class VideoDownloader:
    """视频下载器"""

    def __init__(self, save_dir=VIDEO_DIR, max_workers=M3U8_CONCURRENT):
        self.save_dir = save_dir
        self.max_workers = max_workers
        self.session = requests.Session()
        self.session.headers.update({
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            "Referer": "https://www.novipnoad.net/",
        })
        os.makedirs(save_dir, exist_ok=True)

    def download(self, url, title="video", video_type="auto"):
        """
        下载视频，自动识别格式
        :param url: 视频地址（m3u8/mp4）
        :param title: 保存文件名（不含扩展名）
        :return: 保存路径或 None
        """
        title = safe_filename(title)
        if not url:
            logger.error("视频 URL 为空")
            return None

        # 自动识别类型
        if video_type == "auto":
            if ".m3u8" in url:
                video_type = "m3u8"
            elif ".mp4" in url:
                video_type = "mp4"
            else:
                # 先请求查看 Content-Type
                try:
                    head = self.session.head(url, timeout=15, allow_redirects=True)
                    ct = head.headers.get("Content-Type", "")
                    if "mpegurl" in ct or "m3u8" in ct:
                        video_type = "m3u8"
                    else:
                        video_type = "mp4"
                except:
                    video_type = "mp4"

        logger.info(f"开始下载 {video_type}: {title} -> {url}")

        try:
            if video_type == "m3u8":
                return self._download_m3u8(url, title)
            else:
                return self._download_mp4(url, title)
        except Exception as e:
            logger.error(f"下载失败 {title}: {e}")
            return None

    def _download_mp4(self, url, title):
        """下载 MP4 直链（支持断点续传）"""
        save_path = os.path.join(self.save_dir, f"{title}.mp4")
        if os.path.exists(save_path) and os.path.getsize(save_path) > 1024:
            logger.info(f"文件已存在，跳过: {save_path}")
            return save_path

        temp_path = save_path + ".part"
        downloaded = 0
        if os.path.exists(temp_path):
            downloaded = os.path.getsize(temp_path)

        headers = {"Range": f"bytes={downloaded}-"} if downloaded > 0 else {}
        resp = self.session.get(url, headers=headers, stream=True, timeout=SEGMENT_TIMEOUT)
        total = int(resp.headers.get("Content-Length", 0)) + downloaded

        mode = "ab" if downloaded > 0 else "wb"
        with open(temp_path, mode) as f, tqdm(
            desc=title[:20], total=total, initial=downloaded, unit="B", unit_scale=True
        ) as pbar:
            for chunk in resp.iter_content(chunk_size=1024 * 256):
                if chunk:
                    f.write(chunk)
                    pbar.update(len(chunk))

        os.rename(temp_path, save_path)
        logger.info(f"MP4 下载完成: {save_path}")
        return save_path

    def _download_m3u8(self, url, title):
        """下载 m3u8 流媒体并合并为 mp4/ts"""
        video_folder = os.path.join(self.save_dir, title)
        os.makedirs(video_folder, exist_ok=True)
        merged_path = os.path.join(self.save_dir, f"{title}.ts")

        if os.path.exists(merged_path) and os.path.getsize(merged_path) > 1024 * 100:
            logger.info(f"视频已存在，跳过: {merged_path}")
            return merged_path

        # 1. 获取 m3u8 播放列表
        m3u8_content = self.session.get(url, timeout=SEGMENT_TIMEOUT).text

        # 处理嵌套的 master m3u8（选择最高清）
        playlist = m3u8.loads(m3u8_content, uri=url)
        if playlist.is_variant:
            playlist = self._select_best_variant(playlist, url)
            m3u8_content = self.session.get(playlist.uri, timeout=SEGMENT_TIMEOUT).text
            playlist = m3u8.loads(m3u8_content, uri=playlist.uri)

        segments = playlist.segments
        if not segments:
            logger.error(f"未找到分片: {url}")
            return None

        total = len(segments)
        logger.info(f"m3u8 共 {total} 个分片")

        # 2. 获取 AES-128 密钥（如果加密）
        key = None
        iv = None
        if playlist.keys and playlist.keys[0]:
            key_info = playlist.keys[0]
            if key_info.uri:
                key_url = urljoin(playlist.base_uri, key_info.uri)
                key = self.session.get(key_url, timeout=SEGMENT_TIMEOUT).content
                logger.info(f"获取 m3u8 加密密钥: {key.hex() if key else 'None'}")
            if key_info.iv:
                iv = key_info.iv if isinstance(key_info.iv, bytes) else bytes.fromhex(key_info.iv.replace("0x", ""))

        # 3. 多线程下载分片
        seg_files = [os.path.join(video_folder, f"{i:05d}.ts") for i in range(total)]
        pending = [(i, seg) for i, seg in enumerate(segments) if not os.path.exists(seg_files[i]) or os.path.getsize(seg_files[i]) < 100]

        def download_segment(args):
            idx, seg = args
            seg_url = urljoin(playlist.base_uri, seg.uri)
            for retry in range(3):
                try:
                    data = self.session.get(seg_url, timeout=SEGMENT_TIMEOUT).content
                    # AES-128 解密
                    if key:
                        decrypt_iv = iv or idx.to_bytes(16, 'big')
                        cipher = AES.new(key, AES.MODE_CBC, iv=decrypt_iv)
                        data = cipher.decrypt(data)
                        # 移除 PKCS7 padding
                        pad_len = data[-1]
                        if 0 < pad_len <= 16 and all(b == pad_len for b in data[-pad_len:]):
                            data = data[:-pad_len]
                    with open(seg_files[idx], "wb") as f:
                        f.write(data)
                    return idx, True
                except Exception as e:
                    time.sleep(1)
            return idx, False

        failed = []
        with ThreadPoolExecutor(max_workers=self.max_workers) as executor:
            futures = [executor.submit(download_segment, p) for p in pending]
            with tqdm(total=total, desc=title[:20], unit="seg") as pbar:
                done = total - len(pending)
                pbar.update(done)
                for fut in as_completed(futures):
                    idx, ok = fut.result()
                    if not ok:
                        failed.append(idx)
                    pbar.update(1)

        if failed:
            logger.warning(f"{len(failed)} 个分片下载失败: {failed[:10]}")

        # 4. 合并分片
        logger.info("合并分片中...")
        with open(merged_path, "wb") as out:
            for i in range(total):
                seg_path = seg_files[i]
                if os.path.exists(seg_path):
                    with open(seg_path, "rb") as f:
                        out.write(f.read())

        # 5. 清理分片（保留已合并文件）
        try:
            for f in seg_files:
                if os.path.exists(f):
                    os.remove(f)
            os.rmdir(video_folder)
        except:
            pass

        logger.info(f"m3u8 下载完成: {merged_path}")
        return merged_path

    def _select_best_variant(self, playlist, base_url):
        """从 master m3u8 中选择最高清的流"""
        best = None
        max_bandwidth = 0
        for p in playlist.playlists:
            bw = p.stream_info.bandwidth or 0
            # 优先选择 1080p 或最高码率
            resolution = p.stream_info.resolution
            if resolution and resolution[0] >= 1920:
                return p
            if bw > max_bandwidth:
                max_bandwidth = bw
                best = p
        return best or playlist.playlists[0]


downloader = VideoDownloader()
