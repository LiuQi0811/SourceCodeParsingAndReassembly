# core/resource_saver.py
import aiofiles, os, hashlib, mimetypes
from abc import ABC, abstractmethod
from urllib.parse import urlparse
from pathlib import Path
from enum import Enum

class ResourceCategory(Enum):
    IMAGE = "images"
    VIDEO = "videos"
    DOCUMENT = "documents"
    ARCHIVE = "archives"
    AUDIO = "audios"
    OTHER = "others"

EXT_MAP: dict[str, ResourceCategory] = {
    # 图片
    ".jpg": ResourceCategory.IMAGE, ".jpeg": ResourceCategory.IMAGE,
    ".png": ResourceCategory.IMAGE, ".gif": ResourceCategory.IMAGE,
    ".webp": ResourceCategory.IMAGE, ".bmp": ResourceCategory.IMAGE,
    ".svg": ResourceCategory.IMAGE, ".ico": ResourceCategory.IMAGE,
    # 视频
    ".mp4": ResourceCategory.VIDEO, ".avi": ResourceCategory.VIDEO,
    ".mkv": ResourceCategory.VIDEO, ".mov": ResourceCategory.VIDEO,
    ".wmv": ResourceCategory.VIDEO, ".flv": ResourceCategory.VIDEO,
    ".webm": ResourceCategory.VIDEO,
    # 文档
    ".pdf": ResourceCategory.DOCUMENT, ".doc": ResourceCategory.DOCUMENT,
    ".docx": ResourceCategory.DOCUMENT, ".xls": ResourceCategory.DOCUMENT,
    ".xlsx": ResourceCategory.DOCUMENT, ".ppt": ResourceCategory.DOCUMENT,
    ".txt": ResourceCategory.DOCUMENT,
    # 压缩包
    ".zip": ResourceCategory.ARCHIVE, ".rar": ResourceCategory.ARCHIVE,
    ".7z": ResourceCategory.ARCHIVE, ".tar": ResourceCategory.ARCHIVE,
    ".gz": ResourceCategory.ARCHIVE,
    # 音频
    ".mp3": ResourceCategory.AUDIO, ".wav": ResourceCategory.AUDIO,
    ".flac": ResourceCategory.AUDIO, ".aac": ResourceCategory.AUDIO,
}

def classify_resource(url: str, content_type: str = "") -> ResourceCategory:
    """根据 URL 后缀和 Content-Type 双重判断资源类型。"""
    path = urlparse(url).path
    ext = Path(path).suffix.lower()

    # 优先 URL 后缀
    if ext in EXT_MAP:
        return EXT_MAP[ext]

    # 回退 Content-Type
    ct = content_type.split(";")[0].strip().lower()
    if ct.startswith("image/"):
        return ResourceCategory.IMAGE
    if ct.startswith("video/"):
        return ResourceCategory.VIDEO
    if ct.startswith("audio/"):
        return ResourceCategory.AUDIO
    if "pdf" in ct or "word" in ct or "excel" in ct:
        return ResourceCategory.DOCUMENT
    if "zip" in ct or "compressed" in ct:
        return ResourceCategory.ARCHIVE

    return ResourceCategory.OTHER

class BaseSaver(ABC):
    @abstractmethod
    async def save(self, url: str, data: bytes,
                   category: ResourceCategory,
                   filename: str = "") -> str: ...

class CategorizedFileSaver(BaseSaver):
    """按资源类型分目录保存。"""

    def __init__(self, base_dir: str = "downloads"):
        self.base_dir = Path(base_dir)

    async def save(self, url: str, data: bytes,
                   category: ResourceCategory,
                   filename: str = "") -> str:
        if not filename:
            filename = self._generate_filename(url, category)

        dir_path = self.base_dir / category.value
        dir_path.mkdir(parents=True, exist_ok=True)
        file_path = dir_path / filename

        async with aiofiles.open(file_path, "wb") as f:
            await f.write(data)

        return str(file_path)

    @staticmethod
    def _generate_filename(url: str, category: ResourceCategory) -> str:
        """用 URL 的 SHA-256 前 12 位 + 原始后缀生成唯一文件名。"""
        path = urlparse(url).path
        ext = Path(path).suffix or ".bin"
        name_hash = hashlib.sha256(url.encode()).hexdigest()[:12]
        return f"{name_hash}{ext}"

class SaverFactory:
    _registry = {"categorized": CategorizedFileSaver}

    @classmethod
    def create(cls, name: str = "categorized", **kwargs) -> BaseSaver:
        if name not in cls._registry:
            raise ValueError(f"Unknown saver: {name}")
        return cls._registry[name](**kwargs)