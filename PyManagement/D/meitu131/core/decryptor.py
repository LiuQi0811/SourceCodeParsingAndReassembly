# core/decryptor.py
from abc import ABC, abstractmethod
from typing import Optional

class BaseDecryptor(ABC):
    """解密策略抽象基类。"""
    name: str = "base"

    @abstractmethod
    async def decrypt(self, data: str, **kwargs) -> str:
        ...

class NoOpDecryptor(BaseDecryptor):
    """默认空操作，适用于无加密的站点。"""
    name = "none"

    async def decrypt(self, data: str, **kwargs) -> str:
        return data

class Base64Decryptor(BaseDecryptor):
    """Base64 解码。"""
    name = "base64"

    async def decrypt(self, data: str, **kwargs) -> str:
        import base64
        try:
            return base64.b64decode(data).decode("utf-8", errors="replace")
        except Exception:
            return data

class AESDecryptor(BaseDecryptor):
    """AES-CBC 解密，密钥和 IV 可通过参数传入。"""
    name = "aes"

    def __init__(self, key: bytes, iv: bytes):
        self.key = key
        self.iv = iv

    async def decrypt(self, data: str, **kwargs) -> str:
        from Crypto.Cipher import AES
        from Crypto.Util.Padding import unpad
        import base64
        try:
            cipher = AES.new(self.key, AES.MODE_CBC, self.iv)
            raw = base64.b64decode(data)
            return unpad(cipher.decrypt(raw), AES.block_size).decode("utf-8")
        except Exception:
            return data

class DecryptorChain:
    """
    解密策略链：按顺序尝试各解密器，
    某个解密器产出可解析内容后即停止。
    """
    def __init__(self, decryptors: list[BaseDecryptor] | None = None):
        self.decryptors = decryptors or [NoOpDecryptor()]

    async def process(self, data: str, **kwargs) -> str:
        result = data
        for d in self.decryptors:
            result = await d.decrypt(result, **kwargs)
        return result

# 工厂
class DecryptorFactory:
    _registry: dict[str, type[BaseDecryptor]] = {
        "none": NoOpDecryptor,
        "base64": Base64Decryptor,
        "aes": AESDecryptor,
    }

    @classmethod
    def create_chain(cls, specs: list[dict]) -> DecryptorChain:
        """
        specs 示例:
        [{"type": "base64"}, {"type": "aes", "key": b"...", "iv": b"..."}]
        """
        decryptors = []
        for spec in specs:
            typ = spec.pop("type")
            if typ in cls._registry:
                decryptors.append(cls._registry[typ](**spec))
        return DecryptorChain(decryptors)