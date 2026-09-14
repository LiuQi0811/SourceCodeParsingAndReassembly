# core/downloader.py
import aiohttp
import os
import hashlib
import asyncio
from typing import Optional, Tuple
from urllib.parse import urlparse
from core.task_model import CrawlTask
from core.hooks import BaseHook
from utils.charset_detector import auto_decode
from utils.file_utils import make_resource_dir, safe_filename
from settings import MAX_RESPONSE_SIZE, TIMEOUT_CONNECT, TIMEOUT_READ
from utils.url_utils import get_domain
from utils.token_bucket import DomainRateLimiter
from core.m3u8_downloader import M3U8Downloader


class ResourceType:
    HTML = "html"
    IMAGE = "image"
    VIDEO = "video"
    AUDIO = "audio"
    M3U8 = "m3u8"
    DOCUMENT = "document"
    ARCHIVE = "archive"
    FONT = "font"
    JS = "js"
    CSS = "css"
    OTHER = "other"


class Downloader:
    def __init__(
            self,
            session: aiohttp.ClientSession,
            proxy_pool,
            hook: BaseHook,
            save_root: str,
            domain_sem_map: dict,
            global_sem: asyncio.Semaphore,
            rate_limiter: DomainRateLimiter
    ):
        self.session = session
        self.proxy_pool = proxy_pool
        self.hook = hook
        self.save_root = save_root
        self.domain_sem_map = domain_sem_map
        self.global_sem = global_sem
        self.rate_limiter = rate_limiter

    @staticmethod
    def guess_resource_type(content_type: str) -> str:
        ct = content_type.lower()
        if "text/html" in ct:
            return ResourceType.HTML
        elif "image/" in ct:
            return ResourceType.IMAGE
        elif "video/" in ct:
            return ResourceType.VIDEO
        elif "audio/" in ct or "audio/mpeg" in ct:
            return ResourceType.AUDIO
        elif "mpegurl" in ct or "x-mpegurl" in ct or "application/vnd.apple.mpegurl" in ct:
            return ResourceType.M3U8
        # 文档:pdf/word/excel/ppt/rtf/odf
        elif (
            "application/pdf" in ct
            or "msword" in ct
            or "ms-excel" in ct
            or "ms-powerpoint" in ct
            or "officedocument" in ct
            or "application/rtf" in ct
            or "application/vnd.oasis.opendocument" in ct
            or "text/plain" in ct  # 纯文本兜底当文档
        ):
            return ResourceType.DOCUMENT
        # 压缩包:zip/tar/gzip/rar/7z/xz/bzip2
        elif (
            "application/zip" in ct
            or "application/x-tar" in ct
            or "application/gzip" in ct
            or "application/x-gzip" in ct
            or "application/x-rar" in ct
            or "application/x-7z" in ct
            or "application/x-xz" in ct
            or "application/x-bzip" in ct
            or "application/x-bzip2" in ct
        ):
            return ResourceType.ARCHIVE
        # 字体:woff/woff2/ttf/otf/eot
        elif (
            "font/" in ct
            or "application/font" in ct
            or "application/x-font" in ct
            or "application/vnd.ms-fontobject" in ct
        ):
            return ResourceType.FONT
        elif "application/javascript" in ct or "text/javascript" in ct:
            return ResourceType.JS
        elif "text/css" in ct:
            return ResourceType.CSS
        return ResourceType.OTHER

    @staticmethod
    def get_file_hash(content: bytes) -> str:
        return hashlib.md5(content).hexdigest()

    async def download_file_with_resume(self, url: str, save_path: str, proxy=None, headers: dict = None,
                                        max_size: int = None):
        """文件断点续传下载（流式写盘，不进内存）

        :param max_size: 若响应字节数超过此上限则中止下载并抛异常；None 表示不限
        """
        headers = dict(headers or {})
        start_pos = 0
        if os.path.exists(save_path):
            start_pos = os.path.getsize(save_path)
        if start_pos > 0:
            headers["Range"] = f"bytes={start_pos}-"

        timeout = aiohttp.ClientTimeout(connect=TIMEOUT_CONNECT, total=TIMEOUT_READ)
        async with self.session.get(url, headers=headers, proxy=proxy, timeout=timeout) as resp:
            if resp.status == 206:
                # 支持断点续传，追加写入
                mode = "ab"
            elif resp.status == 200:
                # 不支持 Range，整文件覆盖重写
                mode = "wb"
                start_pos = 0
            elif resp.status == 416:
                # 416 Range Not Satisfiable：通常意味着文件已完整下载
                # 校验 Content-Range 总长度与本地大小一致则视为完成
                cr = resp.headers.get("Content-Range", "")
                if start_pos > 0 and (f"/{start_pos}" in cr or "bytes=*/" in cr):
                    return save_path
                # 否则按异常处理
                raise Exception(f"资源下载失败 status={resp.status}")
            else:
                raise Exception(f"资源下载失败 status={resp.status}")

            # 大小预检
            content_len = resp.headers.get("Content-Length")
            if max_size and content_len and (int(content_len) + start_pos) > max_size:
                raise Exception("响应体超过最大限制")

            written = start_pos
            with open(save_path, mode) as f:
                async for chunk in resp.content.iter_chunked(65536):
                    f.write(chunk)
                    written += len(chunk)
                    if max_size and written > max_size:
                        raise Exception("响应体超过最大限制")
        return save_path

    async def fetch(self, task: CrawlTask, headers: dict) -> Tuple[str, bytes, str, str]:
        """
        :return: html_text, raw_bytes, resource_type, saved_file_path
        """
        domain = get_domain(task.url)
        domain_sem = self.domain_sem_map.setdefault(domain, asyncio.Semaphore(3))
        proxy = await self.proxy_pool.get_proxy()

        # 请求前置钩子
        headers = await self.hook.before_request(task, headers)
        timeout = aiohttp.ClientTimeout(connect=TIMEOUT_CONNECT, total=TIMEOUT_READ)

        # 令牌桶限流
        await self.rate_limiter.wait(domain)

        async with self.global_sem, domain_sem:
            async with self.session.get(task.url, headers=headers, proxy=proxy, timeout=timeout) as resp:
                if resp.status >= 400:
                    raise Exception(f"HTTP {resp.status}")
                ctype = resp.headers.get("Content-Type", "")
                res_type = self.guess_resource_type(ctype)

                # HTML：读 body 解码解析（受 MAX_RESPONSE_SIZE 限制，避免大页面 OOM）
                if res_type == ResourceType.HTML:
                    content_len = resp.headers.get("Content-Length")
                    if content_len and int(content_len) > MAX_RESPONSE_SIZE:
                        raise Exception("响应体过大，跳过")
                    raw_bytes = await resp.read()
                    if len(raw_bytes) > MAX_RESPONSE_SIZE:
                        raise Exception("响应体超过最大限制")
                    raw_bytes = await self.hook.after_response(task, raw_bytes)
                    header_charset = None
                    if "charset=" in ctype:
                        header_charset = ctype.split("charset=")[-1]
                    html_text = auto_decode(raw_bytes, header_charset)
                    return html_text, raw_bytes, res_type, ""

                # M3U8：委托给 M3U8Downloader 走完整流程（下载 ts + 合并 mp4）
                if res_type == ResourceType.M3U8:
                    m3u8_text = await resp.text()
                    m3u8_dl = M3U8Downloader(
                        session=self.session,
                        proxy=proxy,
                        headers=headers,
                        save_root=self.save_root,
                        base_url=task.url,
                        referer=task.referer or "",
                    )
                    saved_file_path = await m3u8_dl.run(m3u8_text)
                    return "", b"", res_type, saved_file_path

                # 其他二进制资源（image/video/audio/document/...）：流式直写，不读进内存
                dir_path = make_resource_dir(self.save_root, res_type)
                fn = safe_filename(os.path.basename(urlparse(task.url).path), fallback=task.url)
                if "." not in fn:
                    ext_map = {
                        ResourceType.IMAGE: ".jpg",
                        ResourceType.VIDEO: ".mp4",
                        ResourceType.AUDIO: ".mp3",
                        ResourceType.DOCUMENT: ".pdf",
                        ResourceType.ARCHIVE: ".zip",
                        ResourceType.FONT: ".woff2",
                        ResourceType.JS: ".js",
                        ResourceType.CSS: ".css",
                        ResourceType.OTHER: ".bin",
                    }
                    fn += ext_map.get(res_type, ".bin")
                save_path = os.path.join(dir_path, fn)
                await self.download_file_with_resume(
                    task.url, save_path, proxy, headers, max_size=MAX_RESPONSE_SIZE
                )
                return "", b"", res_type, save_path
