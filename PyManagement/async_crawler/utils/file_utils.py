
# utils/file_utils.py
import os
import re
import hashlib

ILLEGAL_CHAR_PATTERN = re.compile(r'[<>:"|?*]')


def safe_filename(name: str, fallback: str = "") -> str:
    """清洗文件名，移除Windows非法字符；为空时用 fallback 生成默认名"""
    name = ILLEGAL_CHAR_PATTERN.sub("_", name).strip()
    if not name:
        # 用 fallback（通常是完整 URL）生成 16 位 hash 作为文件名
        h = hashlib.md5((fallback or "empty").encode("utf-8")).hexdigest()[:16]
        name = h
    return name


def make_resource_dir(root: str, resource_type: str) -> str:
    """自动创建分类目录 html / image / video / js / css"""
    dir_path = os.path.join(root, resource_type.lower())
    os.makedirs(dir_path, exist_ok=True)
    return dir_path
