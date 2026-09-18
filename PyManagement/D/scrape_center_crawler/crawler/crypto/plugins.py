# -*- coding: utf-8 -*-
"""
逆向解密插件（CryptoPlugin）

设计说明
--------
每个站点/接口的「加密参数」各不相同。本框架提供：
  1. 统一的插件接口：prepare / transform_url / build_headers / decrypt
  2. 内置常见算法实现：MD5 签名(token)、时间戳、Base64、AES-ECB/CBC
  3. 插件工厂注册：CryptoFactory.create(name, **opts) 按配置创建
  4. 完全可扩展：新增站点专属算法只需继承 CryptoPlugin 并注册

用法（任务配置）:
  "crypto_plugin": {"name": "md5_token", "secret": "xxxx", "ttl": 300}
"""
from __future__ import annotations

import base64
import hashlib
import time
from abc import ABC, abstractmethod
from typing import Any, Dict, Optional, Tuple
from urllib.parse import parse_qs, urlencode, urlparse, urlunparse

try:  # AES 依赖 pycryptodome，可选
    from Crypto.Cipher import AES as _PyAES

    _HAS_AES = True
except Exception:  # pragma: no cover
    _HAS_AES = False


def _now_ts() -> int:
    return int(time.time())


class CryptoPlugin(ABC):
    """逆向解密插件抽象基类"""

    name: str = "base"

    def __init__(self, **opts: Any) -> None:
        self.opts = opts or {}

    def prepare(self, task) -> None:
        """请求前初始化（如需现场计算密钥）"""

    def transform_url(self, url: str, task) -> str:
        """改写 URL（追加/加密参数）"""
        return url

    def build_headers(self, task) -> Dict[str, str]:
        """追加请求头"""
        return {}

    def decrypt(self, raw: bytes, task) -> bytes:
        """响应体解密（返回解密后的字节）"""
        return raw

    def __repr__(self) -> str:  # pragma: no cover
        return f"<Crypto:{self.name}>"


class NoopPlugin(CryptoPlugin):
    """空实现：不进行任何加解密"""

    name = "none"


class MD5TokenPlugin(CryptoPlugin):
    """
    MD5 时间戳签名插件（常见于 spa2/spa6 等带时间限制接口）
    规则：url 追加 ?timestamp=<ts>&token=<md5(ts + secret)>（secret 可含盐）
    可选参数:
      secret: 签名密钥（必填）
      ts_param / token_param: 参数名（默认 timestamp / token）
      secret_mode: "append"(md5(ts+secret)) / "prepend"(md5(secret+ts))
      ttl: 签名有效期（秒），可选校验
    """

    name = "md5_token"

    def __init__(self, **opts: Any) -> None:
        super().__init__(**opts)
        self.secret: str = str(opts.get("secret", ""))
        self.ts_param: str = str(opts.get("ts_param", "timestamp"))
        self.token_param: str = str(opts.get("token_param", "token"))
        self.mode: str = str(opts.get("secret_mode", "append"))
        self.ttl: Optional[int] = opts.get("ttl")

    def _sign(self, ts: int) -> str:
        payload = f"{ts}{self.secret}" if self.mode == "append" else f"{self.secret}{ts}"
        return hashlib.md5(payload.encode("utf-8")).hexdigest()

    def transform_url(self, url: str, task) -> str:
        ts = _now_ts()
        token = self._sign(ts)
        parsed = urlparse(url)
        qs = parse_qs(parsed.query, keep_blank_values=True)
        qs[self.ts_param] = [str(ts)]
        qs[self.token_param] = [token]
        return urlunparse(parsed._replace(query=urlencode(qs, doseq=True)))


class TimeStampPlugin(CryptoPlugin):
    """时间戳参数插件：url 追加 &ts=<当前秒时间戳>"""

    name = "timestamp"

    def __init__(self, **opts: Any) -> None:
        super().__init__(**opts)
        self.param: str = str(opts.get("param", "ts"))

    def transform_url(self, url: str, task) -> str:
        parsed = urlparse(url)
        qs = parse_qs(parsed.query, keep_blank_values=True)
        qs[self.param] = [str(_now_ts())]
        return urlunparse(parsed._replace(query=urlencode(qs, doseq=True)))


class Base64Plugin(CryptoPlugin):
    """Base64 响应解密：如果响应体是 base64 编码文本则解码"""

    name = "base64"

    def decrypt(self, raw: bytes, task) -> bytes:
        try:
            text = raw.decode("utf-8").strip()
            padded = text + "=" * (-len(text) % 4)
            return base64.b64decode(padded, validate=True)
        except Exception:
            return raw


class AESPlugin(CryptoPlugin):
    """
    AES 解密插件（响应体 AES 加密场景），依赖 pycryptodome。
    可选参数:
      key / key_b64: 密钥（字符串或 base64）
      iv / iv_b64: IV（CBC 必填）
      mode: "ecb" | "cbc"（默认 ecb）
      unpad: 是否 PKCS7 去填充（默认 True）
    """

    name = "aes"

    def __init__(self, **opts: Any) -> None:
        super().__init__(**opts)
        self.key = self._load_key("key", "key_b64")
        self.iv = self._load_key("iv", "iv_b64")
        self.mode: str = str(opts.get("mode", "ecb")).lower()
        self.unpad: bool = bool(opts.get("unpad", True))

    def _load_key(self, plain: str, b64: str) -> Optional[bytes]:
        if self.opts.get(b64):
            try:
                return base64.b64decode(self.opts[b64])
            except Exception:
                return None
        if self.opts.get(plain):
            v = str(self.opts[plain])
            # 优先按 16 进制解析（仅当解码长度为合法 AES 密钥长度 16/24/32）
            if re_full_hex(v):
                try:
                    raw_hex = bytes.fromhex(v)
                    if len(raw_hex) in (16, 24, 32):
                        return raw_hex
                except ValueError:
                    pass
            return v.encode("utf-8")
        return None

    def decrypt(self, raw: bytes, task) -> bytes:
        if not _HAS_AES:
            raise RuntimeError("AES 解密需要 pycryptodome：pip install pycryptodome")
        if self.key is None:
            raise ValueError("AESPlugin 缺少 key")
        if self.mode == "cbc":
            cipher = _PyAES.new(self.key, _PyAES.MODE_CBC, iv=self.iv or (b"\x00" * 16))
        else:
            cipher = _PyAES.new(self.key, _PyAES.MODE_ECB)
        out = cipher.decrypt(raw)
        if self.unpad:
            out = _pkcs7_unpad(out)
        return out


def _pkcs7_unpad(data: bytes) -> bytes:
    if not data:
        return data
    pad = data[-1]
    if 1 <= pad <= 16 and data[-pad:] == bytes([pad]) * pad:
        return data[:-pad]
    return data


def re_full_hex(s: str) -> bool:
    return all(c in "0123456789abcdefABCDEF" for c in s) and len(s) % 2 == 0 and len(s) > 0
