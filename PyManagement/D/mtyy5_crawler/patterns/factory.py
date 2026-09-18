# -*- coding: utf-8 -*-
"""通用工厂基类"""
from typing import Type, List, Optional


class Factory:
    """通用工厂：子类需在自己的命名空间里维护 _registry 字典"""
    _registry: dict = {}

    @classmethod
    def register(cls, name: str, klass: Optional[Type] = None):
        """注册：可以当装饰器用，也可以直接传类"""
        if klass is None:
            def deco(k):
                cls._registry[name] = k
                return k
            return deco
        cls._registry[name] = klass
        return klass

    @classmethod
    def create(cls, name: str):
        if name not in cls._registry:
            raise ValueError(
                f"Unknown: {name}. Available: {list(cls._registry.keys())}"
            )
        return cls._registry[name]()

    @classmethod
    def create_all(cls, names: List[str]) -> list:
        return [cls.create(n) for n in names]

    @classmethod
    def available(cls) -> List[str]:
        return list(cls._registry.keys())