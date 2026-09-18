# -*- coding: utf-8 -*-
"""下载器公共基类：提供带重试的 HTTP 抓取"""
import asyncio
import logging
from typing import Optional

import aiohttp

from config import Config
from utils.encoding import decode_content


class BaseDownloader:
    def __init__(self, config: Config, session: aiohttp.ClientSession):
        self.config = config
        self.session = session

    async def _fetch_text(self, url: str) -> Optional[str]:
        for attempt in range(self.config.max_retries):
            try:
                async with self.session.get(url) as resp:
                    if resp.status == 200:
                        raw = await resp.read()
                        return decode_content(raw, dict(resp.headers))
                    if 500 <= resp.status < 600:
                        await asyncio.sleep(self.config.retry_delay * (attempt + 1))
                        continue
                    return None
            except Exception as e:
                if attempt < self.config.max_retries - 1:
                    await asyncio.sleep(self.config.retry_delay * (attempt + 1))
                else:
                    logging.debug(f"fetch text fail: {url} - {e}")
        return None

    async def _fetch_bytes(self, url: str) -> Optional[bytes]:
        for attempt in range(self.config.max_retries):
            try:
                async with self.session.get(url) as resp:
                    if resp.status == 200:
                        return await resp.read()
                    if 500 <= resp.status < 600:
                        await asyncio.sleep(self.config.retry_delay * (attempt + 1))
                        continue
                    return None
            except Exception as e:
                if attempt < self.config.max_retries - 1:
                    await asyncio.sleep(self.config.retry_delay * (attempt + 1))
                else:
                    logging.debug(f"fetch bytes fail: {url} - {e}")
        return None