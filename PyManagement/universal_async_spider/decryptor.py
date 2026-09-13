"""
解密 / 逆向模块 —— 策略模式 + 工厂模式
支持：
  - AES-CBC/PKCS7 (常见接口加密)
  - Base64 自动识别
  - 自定义 JS 渲染/执行钩子（预留）
  - 自定义解密函数注册
若响应体不是加密内容，原样返回。
"""
import re
import base64
import json
from abc import ABC, abstractmethod
from typing import Optional


# ============= 策略抽象 =============
class Decryptor(ABC):
    """解密策略抽象基类"""
    name: str = "base"

    @abstractmethod
    def match(self, content: bytes, headers: dict, url: str) -> bool:
        """判断是否适用于该内容"""
        raise NotImplementedError

    @abstractmethod
    def decrypt(self, content: bytes, key: Optional[str] = None, iv: Optional[str] = None) -> bytes:
        """执行解密"""
        raise NotImplementedError


# ============= 具体策略 =============
class Base64Decryptor(Decryptor):
    """自动识别并解码 Base64 包装的 HTML/JSON"""
    name = "base64"
    _b64_re = re.compile(rb'^[A-Za-z0-9+/=\s]{100,}$')

    def match(self, content: bytes, headers: dict, url: str) -> bool:
        ct = headers.get("Content-Type", "").lower()
        if "application/octet-stream" in ct or "text/plain" in ct:
            if self._b64_re.match(content.strip()):
                return True
        return False

    def decrypt(self, content: bytes, key=None, iv=None) -> bytes:
        try:
            decoded = base64.b64decode(content.strip(), validate=True)
            # 简单校验：是否为可读文本
            decoded.decode("utf-8")
            return decoded
        except Exception:
            return content


class AESDecryptor(Decryptor):
    """AES-CBC/PKCS7 解密 —— 最常见的接口加密方式"""
    name = "aes"

    def match(self, content: bytes, headers: dict, url: str) -> bool:
        # 若调用方显式指定 key，则触发
        return False  # 默认不自动触发，由外部指定 key 时手动启用

    def decrypt(self, content: bytes, key: Optional[str] = None, iv: Optional[str] = None) -> bytes:
        if not key:
            return content
        try:
            from Crypto.Cipher import AES
            from Crypto.Util.Padding import unpad

            key_b = _to_bytes(key, 32)
            iv_b = _to_bytes(iv or key[:16], 16)
            data = base64.b64decode(content.strip())
            cipher = AES.new(key_b, AES.MODE_CBC, iv_b)
            plain = unpad(cipher.decrypt(data), AES.block_size)
            return plain
        except Exception as e:
            return content


class JsonWrappedDecryptor(Decryptor):
    """处理形如 {"code":0,"data":"<加密内容>"} 的包裹响应"""
    name = "json_wrapped"
    _json_re = re.compile(rb'^\s*\{.*"data"\s*:\s*"([^"]+)".*\}\s*$', re.DOTALL)

    def match(self, content: bytes, headers: dict, url: str) -> bool:
        ct = headers.get("Content-Type", "").lower()
        return "json" in ct and self._json_re.match(content.strip()) is not None

    def decrypt(self, content: bytes, key=None, iv=None) -> bytes:
        try:
            obj = json.loads(content)
            inner = obj.get("data") or obj.get("result") or obj.get("content")
            if isinstance(inner, str):
                # 尝试 base64
                try:
                    return base64.b64decode(inner, validate=True)
                except Exception:
                    return inner.encode("utf-8")
        except Exception:
            pass
        return content


class NoopDecryptor(Decryptor):
    """无解密（默认）"""
    name = "noop"

    def match(self, content: bytes, headers: dict, url: str) -> bool:
        return True

    def decrypt(self, content: bytes, key=None, iv=None) -> bytes:
        return content


# ============= 工厂 =============
class DecryptorFactory:
    """解密策略工厂，支持注册自定义策略"""
    _registry: dict = {}

    @classmethod
    def register(cls, name: str, decryptor: Decryptor):
        cls._registry[name] = decryptor

    @classmethod
    def get(cls, name: str) -> Decryptor:
        return cls._registry.get(name, NoopDecryptor())

    @classmethod
    def auto_detect(cls, content: bytes, headers: dict, url: str) -> Decryptor:
        for name, d in cls._registry.items():
            if name == "noop":
                continue
            try:
                if d.match(content, headers, url):
                    return d
            except Exception:
                continue
        return NoopDecryptor()


# 注册内置策略
DecryptorFactory.register("noop", NoopDecryptor())
DecryptorFactory.register("base64", Base64Decryptor())
DecryptorFactory.register("aes", AESDecryptor())
DecryptorFactory.register("json", JsonWrappedDecryptor())


# ============= 工具 =============
def _to_bytes(s: str, length: int) -> bytes:
    b = s.encode("utf-8")
    if len(b) >= length:
        return b[:length]
    return b + b"\0" * (length - len(b))
