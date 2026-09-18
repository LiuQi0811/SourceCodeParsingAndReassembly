# -*- coding: utf-8 -*-
"""工厂模块：队列工厂 / 解析器工厂 / 下载器工厂 / 解密插件工厂"""
from __future__ import annotations

from typing import Any, Dict, List, Optional

from ..queue import MemoryQueue, SQLiteQueue
from ..parser import BS4Parser, CompositeParser, ParserStrategy, RegexParser, XPathParser
from .registry import Registry

# ---------------- 队列工厂 ----------------
queue_factory = Registry("队列")
queue_factory.register("memory", MemoryQueue)
queue_factory.register("sqlite", SQLiteQueue)

# ---------------- 解析器工厂 ----------------
parser_factory = Registry("解析器")
parser_factory.register("bs4", BS4Parser)
parser_factory.register("beautifulsoup", BS4Parser)
parser_factory.register("xpath", XPathParser)
parser_factory.register("lxml", XPathParser)
parser_factory.register("regex", RegexParser)
parser_factory.register("re", RegexParser)


def build_parser(spec: str | List[str] | Dict[str, Any]) -> ParserStrategy:
    """根据配置构建解析器：'bs4' | ['bs4','xpath'] | {'type':'xpath','rule':{...}}

    支持全局/单任务切换与组合使用。
    """
    if isinstance(spec, dict):
        ptype = spec.get("type", "bs4")
        return parser_factory.create(ptype)
    if isinstance(spec, (list, tuple)):
        strategies = [build_parser(s) for s in spec]
        return CompositeParser(strategies)
    name = str(spec or "auto").lower()
    if name in ("auto", ""):
        return BS4Parser()  # auto 默认 bs4（最通用）
    return parser_factory.create(name)


class ParserFactory:
    """解析器工厂的门面：屏蔽 Registry 细节，供引擎调用"""

    @staticmethod
    def create(spec: str | List[str] | Dict[str, Any]) -> ParserStrategy:
        return build_parser(spec)


# ---------------- 解密插件工厂（逆向解密） ----------------
from ..crypto.plugins import AESPlugin, Base64Plugin, MD5TokenPlugin, NoopPlugin, TimeStampPlugin  # noqa: E402

crypto_factory = Registry("解密插件")
crypto_factory.register("none", NoopPlugin)
crypto_factory.register("md5_token", MD5TokenPlugin)
crypto_factory.register("md5token", MD5TokenPlugin)
crypto_factory.register("timestamp", TimeStampPlugin)
crypto_factory.register("ts", TimeStampPlugin)
crypto_factory.register("base64", Base64Plugin)
crypto_factory.register("aes", AESPlugin)


def build_crypto(spec: Optional[str | Dict[str, Any]]) -> Any:
    """根据配置创建解密插件；None / 'none' 返回 NoopPlugin"""
    if spec is None:
        return NoopPlugin()
    if isinstance(spec, str):
        return crypto_factory.create(spec)
    if isinstance(spec, dict):
        name = spec.pop("name", "none")
        return crypto_factory.create(name, **spec)
    raise TypeError(f"无法识别的解密插件配置: {spec!r}")


class CryptoFactory:
    @staticmethod
    def create(spec: Optional[str | Dict[str, Any]]) -> Any:
        return build_crypto(spec)
