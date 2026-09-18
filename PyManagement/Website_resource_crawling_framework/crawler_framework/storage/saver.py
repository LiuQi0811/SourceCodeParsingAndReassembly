"""
分类资源持久化存储器（Storage Saver）
自动创建按资源类型划分的子目录（如 downloads/images, downloads/videos, downloads/documents 等）
处理安全文件名防冲突与异步写入
"""
import asyncio
import hashlib
import os
import re
from typing import Tuple, Optional, Union
from urllib.parse import urlparse
from crawler_framework.core.models import ResourceCategory
from crawler_framework.storage.resource_classifier import ResourceClassifier


class ResourceStorageSaver:
    """分类资源文件持久化管理器"""

    def __init__(self, base_dir: str = "downloads", base_download_dir: Optional[str] = None):
        self.base_download_dir = os.path.abspath(base_download_dir or base_dir)
        self._ensure_directories()

    def _ensure_directories(self) -> None:
        """为所有资源类别创建物理存储目录"""
        for cat in ResourceCategory:
            cat_dir = os.path.join(self.base_download_dir, cat.value)
            os.makedirs(cat_dir, exist_ok=True)

    def generate_safe_filename(self, url: str, suggested_ext: str, content: bytes) -> str:
        parsed = urlparse(url)
        raw_name = os.path.basename(parsed.path.rstrip("/"))
        name_without_ext, ext = os.path.splitext(raw_name)

        if not ext and suggested_ext:
            ext = suggested_ext

        clean_name = re.sub(r'[\\/*?:"<>|]', "_", name_without_ext).strip("._ ")
        if not clean_name or len(clean_name) < 2:
            clean_name = "res"

        if len(clean_name) > 60:
            clean_name = clean_name[:60]

        hash_digest = hashlib.sha256(url.encode("utf-8")).hexdigest()[:8]
        return f"{clean_name}_{hash_digest}{ext}"

    async def save_resource(
        self,
        url: str,
        category: Optional[Union[ResourceCategory, bytes]] = None,
        content: Optional[bytes] = None,
        content_type: str = "",
        content_type_header: str = ""
    ) -> Tuple[Union[str, ResourceCategory], Union[int, str]]:
        """
        灵活兼容两种调用签名：
        1. save_resource(url, category, content, content_type) -> (saved_path, size)
        2. save_resource(url, content, content_type_header) -> (category, saved_path, size)
        """
        ct_header = content_type or content_type_header

        # 兼容签名 2: category 传入的是 content 字节流
        if isinstance(category, bytes):
            actual_content = category
            actual_category = ResourceClassifier.classify(url, ct_header, actual_content)
        else:
            actual_category = category or ResourceClassifier.classify(url, ct_header, content or b"")
            actual_content = content or b""

        _, ext = os.path.splitext(urlparse(url).path)
        filename = self.generate_safe_filename(url, ext, actual_content)
        target_dir = os.path.join(self.base_download_dir, actual_category.value)
        os.makedirs(target_dir, exist_ok=True)
        file_path = os.path.join(target_dir, filename)

        loop = asyncio.get_running_loop()
        await loop.run_in_executor(None, self._write_file, file_path, actual_content)

        return file_path, len(actual_content)

    def _write_file(self, file_path: str, content: bytes) -> None:
        with open(file_path, "wb") as f:
            f.write(content)


# 别名兼容
ResourceSaver = ResourceStorageSaver
