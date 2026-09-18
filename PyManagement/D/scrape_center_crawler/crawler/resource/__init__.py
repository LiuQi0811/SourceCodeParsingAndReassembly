# -*- coding: utf-8 -*-
"""资源层：类型自动识别（分类目录）、标题目录存储"""
from .classifier import ResourceClassifier, classify
from .storage import ResourceStorage

__all__ = ["ResourceClassifier", "classify", "ResourceStorage"]
