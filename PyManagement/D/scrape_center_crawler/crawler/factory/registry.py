# -*- coding: utf-8 -*-
"""
工厂模式 —— 通用注册表工厂
QueueFactory / ParserFactory / DownloaderFactory / CryptoFactory 都基于 Registry 实现，
支持运行时 register 自定义实现，工厂按名称创建实例（策略选择由工厂统一负责）。
"""
from __future__ import annotations

from typing import Any, Callable, Dict, Optional, Type


class Registry:
    """注册表工厂基类：name -> 可调用构造器"""

    def __init__(self, kind: str = "item") -> None:
        self._kind = kind
        self._registry: Dict[str, Callable[..., Any]] = {}

    def register(self, name: str, builder: Callable[..., Any]) -> None:
        name = name.lower()
        if name in self._registry:
            raise ValueError(f"{self._kind} 工厂已注册同名实现: {name}")
        self._registry[name] = builder

    def unregister(self, name: str) -> None:
        self._registry.pop(name.lower(), None)

    def create(self, name: str, *args: Any, **kwargs: Any) -> Any:
        name = name.lower()
        if name not in self._registry:
            raise KeyError(
                f"未知的{self._kind}实现: {name!r}，可用: {sorted(self._registry)}"
            )
        return self._registry[name](*args, **kwargs)

    def names(self) -> list:
        return sorted(self._registry)


class ClassRegistry(Registry):
    """以类为构造器的注册表：register_cls 自动用类本身作为构造器"""

    def register_cls(self, name: str, cls: Type) -> None:
        self.register(name, cls)

    def register_inst(self, name: str, factory: Callable[..., Any]) -> None:
        self.register(name, factory)
