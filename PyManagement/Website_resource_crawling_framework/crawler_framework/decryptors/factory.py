"""
逆向解密工厂（Factory Pattern）
管理逆向解密策略实例，支持动态注册新算法
"""
from typing import Dict, Optional, Type
from crawler_framework.decryptors.base import BaseDecryptorStrategy
from crawler_framework.decryptors.builtin_handlers import (
    Base64Decryptor,
    XorDecryptor,
    RC4Decryptor,
    AESDecryptor,
    CustomScriptDecryptor,
)


class DecryptorFactory:
    """逆向解密器工厂"""

    _registry: Dict[str, BaseDecryptorStrategy] = {
        "base64": Base64Decryptor(),
        "b64": Base64Decryptor(),
        "xor": XorDecryptor(),
        "rc4": RC4Decryptor(),
        "aes": AESDecryptor(),
        "custom": CustomScriptDecryptor(),
    }

    @classmethod
    def register(cls, name: str, decryptor: BaseDecryptorStrategy) -> None:
        """注册新的逆向解密策略"""
        cls._registry[name.lower()] = decryptor

    @classmethod
    def create_decryptor(cls, decrypt_type: Optional[str]) -> Optional[BaseDecryptorStrategy]:
        """
        根据解密类型获取策略对象
        :param decrypt_type: 如 'aes'、'base64'、'xor'、'rc4'、'custom'
        """
        if not decrypt_type:
            return None
        return cls._registry.get(str(decrypt_type).lower())
