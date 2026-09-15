"""
异步下载器模块
支持重试、断点续传、防重复下载、信号量并发控制
设计模式：模板方法模式 + 装饰器模式
"""
import asyncio
import os
import hashlib
import random
from pathlib import Path
from typing import Optional, Dict

import aiohttp
import aiofiles
from fake_useragent import UserAgent

from core.config import get_config, ResourceType
from core.models import DownloadResult, UrlItem
from proxies.proxy_pool import ProxyPool
from decryptors.decryptor import get_decrypt_chain
from downloaders.hls_downloader import HLSDownloader
from downloaders.dash_downloader import DASHDownloader
from utils.url_utils import url_to_filename, get_resource_type
from utils.logger import get_logger

logger = get_logger("Downloader")


class AsyncDownloader:
    """异步下载器"""

    def __init__(self):
        self.config = get_config()
        # 始终持有代理池单例与解密责任链；是否启用以“运行时” config 开关为准，
        # 修复“先构造下载器、之后才 load_proxies / 打开 decrypt 导致能力被永久关闭”的时序问题。
        self.proxy_pool = ProxyPool.get_instance()
        self.decrypt_chain = get_decrypt_chain()
        self._semaphore: Optional[asyncio.Semaphore] = None
        self._session: Optional[aiohttp.ClientSession] = None
        self._ua = UserAgent(fallback=self.config.user_agent)
        self._downloaded_hashes: set = set()  # 真实内容 MD5 集合，用于内容级去重
        self._session_lock = asyncio.Lock()
        # HLS 下载器：注入“原始字节抓取”回调，复用本下载器的会话/代理/UA
        self.hls_downloader = HLSDownloader(
            self.config,
            self.fetch_raw,
            output_dir_getter=lambda: self.config.output_dir / ResourceType.VIDEO.value,
        )
        # DASH 下载器：同样注入原始字节抓取回调
        self.dash_downloader = DASHDownloader(
            self.config,
            self.fetch_raw,
            output_dir_getter=lambda: self.config.output_dir / ResourceType.VIDEO.value,
        )

    async def init_session(self):
        """初始化HTTP会话"""
        if self._session is None or self._session.closed:
            connector = aiohttp.TCPConnector(
                limit=self.config.max_connections,
                limit_per_host=self.config.max_concurrent,
                ssl=False,
                ttl_dns_cache=300,
            )
            timeout = aiohttp.ClientTimeout(total=self.config.timeout)
            self._session = aiohttp.ClientSession(
                connector=connector,
                timeout=timeout,
                headers=self.config.headers,
                cookies=self.config.cookies,
            )
            self._semaphore = asyncio.Semaphore(self.config.max_concurrent)
            logger.debug(f"HTTP会话已初始化，最大并发: {self.config.max_concurrent}")

    async def close_session(self):
        """关闭HTTP会话"""
        if self._session and not self._session.closed:
            await self._session.close()
            logger.debug("HTTP会话已关闭")

    async def __aenter__(self):
        await self.init_session()
        return self

    async def __aexit__(self, exc_type, exc_val, exc_tb):
        await self.close_session()

    def _get_local_path(self, url: str, resource_type: ResourceType) -> Path:
        """获取本地保存路径，按资源类型分组到不同目录"""
        filename = url_to_filename(url)
        type_dir = self.config.output_dir / resource_type.value
        type_dir.mkdir(parents=True, exist_ok=True)
        return type_dir / filename

    async def _get_proxy(self) -> Optional[str]:
        """获取代理"""
        if self.config.enable_proxy and self.proxy_pool:
            return await self.proxy_pool.get_proxy()
        return None

    def _get_headers(self, existing_file: Optional[Path] = None) -> Dict[str, str]:
        """生成请求头，支持断点续传Range"""
        headers = dict(self.config.headers)
        headers["User-Agent"] = self._ua.random
        if existing_file and existing_file.exists() and self.config.enable_resume:
            existing_size = existing_file.stat().st_size
            if existing_size > 0:
                headers["Range"] = f"bytes={existing_size}-"
        return headers

    @staticmethod
    def _is_range_supported(response_headers: Dict) -> bool:
        """检查服务器是否支持断点续传"""
        return "Accept-Ranges" in response_headers or "Content-Range" in response_headers

    @staticmethod
    def _is_range_response(status_code: int) -> bool:
        return status_code == 206

    async def _download_chunked(
        self,
        url: str,
        save_path: Path,
        item: UrlItem,
        proxy: Optional[str] = None,
        resume: bool = True,
    ) -> DownloadResult:
        """分块下载核心方法，支持断点续传"""
        result = DownloadResult(url=url, success=False)
        headers = self._get_headers(save_path if resume else None)

        try:
            start_time = asyncio.get_event_loop().time()

            # 随机延迟，防反爬
            if self.config.request_delay > 0:
                await asyncio.sleep(random.uniform(0, self.config.request_delay))

            async with self._session.get(
                url,
                headers=headers,
                proxy=proxy,
                allow_redirects=True,
            ) as resp:
                result.status_code = resp.status
                result.headers = dict(resp.headers)
                result.content_type = resp.headers.get("Content-Type", "")
                result.elapsed = asyncio.get_event_loop().time() - start_time

                # 错误状态
                if resp.status >= 400:
                    result.error = f"HTTP {resp.status}"
                    if self.proxy_pool and proxy:
                        await self.proxy_pool.report_fail(proxy)
                    return result

                # 处理断点续传
                existing_size = 0
                mode = "wb"
                if resume and save_path.exists():
                    existing_size = save_path.stat().st_size
                    if self._is_range_response(resp.status) and self._is_range_supported(dict(resp.headers)):
                        mode = "ab"
                        result.from_resume = True
                        logger.debug(f"断点续传: {url} 从 {existing_size} 字节继续")
                    else:
                        # 服务器不支持Range或从头开始，覆盖
                        existing_size = 0
                        mode = "wb"

                # 检查文件大小限制
                content_length = resp.headers.get("Content-Length")
                if content_length:
                    total_size = int(content_length) + existing_size
                    if self.config.max_file_size > 0 and total_size > self.config.max_file_size:
                        result.error = f"文件大小 {total_size} 超过限制 {self.config.max_file_size}"
                        return result

                # 流式写入文件，同时增量计算真实内容 MD5（大视频也不会整文件读入内存）
                downloaded = existing_size
                content_hasher = hashlib.md5()
                if resume and mode == "ab" and existing_size > 0:
                    # 断点续传：先把已落盘部分纳入哈希，保证整文件哈希一致
                    try:
                        async with aiofiles.open(save_path, "rb") as old:
                            while True:
                                seg = await old.read(65536)
                                if not seg:
                                    break
                                content_hasher.update(seg)
                    except Exception:
                        content_hasher = hashlib.md5()

                async with aiofiles.open(save_path, mode) as f:
                    async for chunk in resp.content.iter_chunked(self.config.download_chunk_size):
                        if chunk:
                            await f.write(chunk)
                            content_hasher.update(chunk)
                            downloaded += len(chunk)

                # 下载后解密处理
                if self.decrypt_chain and self.config.enable_decrypt:
                    async with aiofiles.open(save_path, "rb") as f:
                        content = await f.read()
                    decrypted = self.decrypt_chain.decrypt(content, dict(resp.headers))
                    if decrypted != content:
                        async with aiofiles.open(save_path, "wb") as f:
                            await f.write(decrypted)
                        logger.debug(f"内容已解密: {url}")

                result.local_path = save_path
                result.content_length = downloaded
                result.success = True

                # 记录真实内容 hash，用于内容级去重统计
                content_hash = content_hasher.hexdigest()
                item.content_hash = content_hash
                result.content_hash = content_hash
                result.headers["content-hash"] = content_hash
                if self.config.deduplicate:
                    if content_hash in self._downloaded_hashes:
                        # 不同 URL 但内容完全相同（如占位图/重复资源）
                        result.headers["duplicate-content"] = "1"
                    self._downloaded_hashes.add(content_hash)

                if self.proxy_pool and proxy:
                    await self.proxy_pool.report_success(proxy, result.elapsed)

                logger.debug(f"下载完成: {url} -> {save_path} ({downloaded} bytes)")

        except asyncio.TimeoutError:
            result.error = "请求超时"
            if self.proxy_pool and proxy:
                await self.proxy_pool.report_fail(proxy)
        except aiohttp.ClientError as e:
            result.error = f"客户端错误: {str(e)}"
            if self.proxy_pool and proxy:
                await self.proxy_pool.report_fail(proxy)
        except Exception as e:
            result.error = f"未知错误: {str(e)}"
            logger.error(f"下载异常 [{url}]: {e}", exc_info=True)

        return result

    def _is_duplicate_file(self, save_path: Path, url: str) -> bool:
        """检查是否重复下载"""
        if not self.config.deduplicate or not self.config.check_file_size:
            return False
        if not save_path.exists():
            return False
        # 简单的重复判断：文件已存在且大小大于0
        # 更严谨的可比对ETag或Last-Modified
        if save_path.stat().st_size > 0:
            logger.debug(f"文件已存在，跳过重复下载: {save_path.name}")
            return True
        return False

    async def download(
        self,
        item: UrlItem,
        stream: bool = False,
        progress_callback=None,
    ) -> DownloadResult:
        """
        下载单个URL
        :param item: URL任务项
        :param stream: 是否流式下载（边解析边下载）
        :param progress_callback: 进度回调函数
        """
        await self.init_session()

        # HLS 清单分流：m3u8 不按普通文件保存，改为下载分片并合并成片；
        # 放在主信号量之外，避免一个 HLS 任务长期占用主并发槽位。
        if self.config.hls_enabled and self._is_m3u8_url(item.url):
            return await self._download_hls(item, progress_callback)
        # DASH 清单分流：同样放在主信号量之外
        if getattr(self.config, "dash_enabled", True) and self._is_mpd_url(item.url):
            return await self._download_dash(item, progress_callback)

        async with self._semaphore:
            # 确定资源类型和保存路径
            if item.resource_type is None or item.resource_type == ResourceType.HTML:
                item.resource_type = get_resource_type(item.url)
            save_path = item.local_path or self._get_local_path(item.url, item.resource_type)
            item.local_path = save_path

            # 重复下载检查
            if self._is_duplicate_file(save_path, item.url):
                result = DownloadResult(
                    url=item.url,
                    success=True,
                    local_path=save_path,
                    content_length=save_path.stat().st_size,
                    from_resume=True,
                )
                if progress_callback:
                    await progress_callback(result)
                return result

            # 重试逻辑：每次尝试都重新选取代理（某个代理失败可自动换一个）
            last_result = None
            for attempt in range(self.config.max_retries + 1):
                if attempt > 0:
                    delay = self.config.retry_delay * (self.config.retry_backoff ** (attempt - 1))
                    delay += random.uniform(0, delay * 0.5)
                    logger.debug(f"第{attempt}次重试 [{item.url}]，等待 {delay:.1f}s")
                    await asyncio.sleep(delay)
                    item.retries = attempt

                proxy = await self._get_proxy()
                last_result = await self._download_chunked(
                    url=item.url,
                    save_path=save_path,
                    item=item,
                    proxy=proxy,
                    resume=self.config.enable_resume,
                )

                if last_result.success:
                    break

                # 4xx（除配置为可重试的状态，如 429）不重试；5xx 继续退避重试
                sc = last_result.status_code
                if sc and 400 <= sc < 500 and sc not in self.config.retry_on_status:
                    break

            if not last_result.success:
                logger.warning(f"下载失败 [{item.url}] (重试{self.config.max_retries}次后): {last_result.error}")

            if progress_callback:
                await progress_callback(last_result)

            return last_result

    @staticmethod
    def _is_m3u8_url(url: str) -> bool:
        """判断 URL 是否为 HLS 清单（忽略 query/fragment）"""
        from urllib.parse import urlparse
        return urlparse(url).path.lower().endswith(".m3u8")

    @staticmethod
    def _is_mpd_url(url: str) -> bool:
        """判断 URL 是否为 DASH 清单（忽略 query/fragment）"""
        from urllib.parse import urlparse
        return urlparse(url).path.lower().endswith(".mpd")

    async def fetch_raw(self, url: str, referer: str = "") -> Optional[bytes]:
        """
        供 HLS 抓取清单/密钥/分片使用：复用会话、UA、代理与解密，
        但不占用主下载信号量（HLS 内部有独立的分片并发控制），单次尝试、重试交给调用方。
        """
        await self.init_session()
        headers = self._get_headers()
        if referer:
            headers["Referer"] = referer
        proxy = await self._get_proxy()
        try:
            async with self._session.get(
                url, headers=headers, proxy=proxy,
                timeout=aiohttp.ClientTimeout(total=self.config.timeout),
                allow_redirects=True,
            ) as resp:
                if resp.status != 200:
                    logger.debug(f"fetch_raw HTTP {resp.status} [{url}]")
                    return None
                data = await resp.read()
                if self.decrypt_chain and self.config.enable_decrypt:
                    data = self.decrypt_chain.decrypt(data, dict(resp.headers))
                return data
        except Exception as e:
            logger.debug(f"fetch_raw 异常 [{url}]: {e}")
            return None

    async def _download_hls(self, item: UrlItem, progress_callback=None) -> DownloadResult:
        """m3u8 走 HLS 下载器：下分片并合并成片"""
        stem = Path(url_to_filename(item.url)).stem  # 与普通文件命名保持一致，去掉 .m3u8
        hls_res = await self.hls_downloader.download(item.url, stem)
        result = DownloadResult(
            url=item.url,
            success=hls_res.success,
            local_path=hls_res.local_path,
            content_length=hls_res.total_bytes,
            content_type="video/mp4" if hls_res.used_ffmpeg else "video/mp2t",
            error=hls_res.error,
        )
        item.resource_type = ResourceType.VIDEO
        if hls_res.local_path:
            item.local_path = hls_res.local_path
        if progress_callback:
            await progress_callback(result)
        return result

    async def _download_dash(self, item: UrlItem, progress_callback=None) -> DownloadResult:
        """mpd 走 DASH 下载器：解析清单、下分片并拼接/合流成片"""
        stem = Path(url_to_filename(item.url)).stem  # 去掉 .mpd
        dash_res = await self.dash_downloader.download(item.url, stem)
        result = DownloadResult(
            url=item.url,
            success=dash_res.success,
            local_path=dash_res.local_path,
            content_length=0,
            content_type="video/mp4",
            error=dash_res.error,
        )
        item.resource_type = ResourceType.VIDEO
        if dash_res.local_path:
            item.local_path = dash_res.local_path
        if progress_callback:
            await progress_callback(result)
        return result

    async def download_content_only(self, url: str, referer: str = "") -> Optional[bytes]:
        """仅下载内容到内存，不保存文件（用于解析）"""
        await self.init_session()
        async with self._semaphore:
            headers = self._get_headers()
            if referer:
                headers["Referer"] = referer
            proxy = await self._get_proxy()
            try:
                async with self._session.get(url, headers=headers, proxy=proxy, timeout=aiohttp.ClientTimeout(total=self.config.timeout)) as resp:
                    if resp.status == 200:
                        content = await resp.read()
                        if self.decrypt_chain and self.config.enable_decrypt:
                            content = self.decrypt_chain.decrypt(content, dict(resp.headers))
                        return content
            except Exception as e:
                logger.debug(f"内容下载失败 [{url}]: {e}")
            return None

    async def batch_download(self, items: list, progress_callback=None) -> list:
        """批量下载"""
        tasks = [self.download(item, progress_callback=progress_callback) for item in items]
        return await asyncio.gather(*tasks, return_exceptions=True)
