# -*- coding: utf-8 -*-
"""策略模式：爬取策略（链接过滤 / 资源过滤 / 停止条件 / 优先级）。"""
from __future__ import annotations

from abc import ABC, abstractmethod

from .config import Config
from .models import ResourceRef
from .urlutils import ext_of, same_netloc

# 常见静态页尾（避免把静态资源当页面链接抓）
_STATIC_TAILS = {".css", ".js", ".woff", ".woff2", ".ttf", ".eot", ".map", ".wasm"}


class CrawlStrategy(ABC):
    """爬取策略基类。"""

    name = "base"

    def __init__(self, cfg: Config) -> None:
        self.cfg = cfg

    # ------------------------------------------------------------ 链接
    def accept_link(self, url: str, depth: int, start_urls: list[str]) -> bool:
        """是否把该链接作为页面任务入队。"""
        if depth > (self.cfg.max_depth if self.cfg.max_depth is not None else 10 ** 9):
            return False
        if not url.startswith(("http://", "https://")):
            return False
        ext = ext_of(url)
        if ext in _STATIC_TAILS:
            return False
        if self.cfg.domain_scope == "same":
            return any(same_netloc(url, s) for s in start_urls)
        return True

    # ------------------------------------------------------------ 资源
    def accept_resource(self, ref: ResourceRef) -> bool:
        if ref.kind not in self.cfg.resource_types:
            return False
        if self.cfg.accept_exts and ref.ext not in self.cfg.accept_exts:
            return False
        return True

    @abstractmethod
    def should_follow_links(self) -> bool:
        """是否继续跟踪页面链接（决定抓取深度行为）。"""

    def should_stop(self, pages_fetched: int) -> bool:
        if self.cfg.max_pages is not None and pages_fetched >= self.cfg.max_pages:
            return True
        return False


class FullSiteStrategy(CrawlStrategy):
    """全站抓取：跟踪同域链接 + 下载所有资源。"""

    name = "fullsite"

    def should_follow_links(self) -> bool:
        return True


class ResourceOnlyStrategy(CrawlStrategy):
    """仅资源模式：不跟踪页面链接，只下载起始页上的资源。"""

    name = "resource_only"

    def accept_link(self, url: str, depth: int, start_urls: list[str]) -> bool:
        return False

    def should_follow_links(self) -> bool:
        return False


class DepthLimitedStrategy(CrawlStrategy):
    """限深策略：与全站一致，但强制只抓 max_depth 层。"""

    name = "depth_limited"

    def accept_link(self, url: str, depth: int, start_urls: list[str]) -> bool:
        limit = self.cfg.max_depth if self.cfg.max_depth is not None else 1
        if depth > limit:
            return False
        return super().accept_link(url, depth, start_urls)

    def should_follow_links(self) -> bool:
        return True


class StrategyFactory:
    """策略工厂。"""

    _REGISTRY = {
        "fullsite": FullSiteStrategy,
        "resource_only": ResourceOnlyStrategy,
        "depth_limited": DepthLimitedStrategy,
    }

    @staticmethod
    def create(name: str, cfg: Config) -> CrawlStrategy:
        cls = StrategyFactory._REGISTRY.get(name or "fullsite", FullSiteStrategy)
        return cls(cfg)

    @staticmethod
    def names() -> list[str]:
        return list(StrategyFactory._REGISTRY)
