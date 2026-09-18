# -*- coding: utf-8 -*-
"""解析器工厂"""
from patterns.factory import Factory


class ParserFactory(Factory):
    # 显式声明独立注册表，避免继承父类共享
    _registry: dict = {}