"""
逆向解密模块 - 策略抽象基类 (Strategy Pattern)
提供统一的逆向解密接口，支持在解析前/后透明解密各种前端反爬加密载荷
"""
from abc import ABC, abstractmethod
from typing import Any, Dict, Optional


class BaseDecryptorStrategy(ABC):
    """逆向解密策略抽象基类"""

    @property
    @abstractmethod
    def name(self) -> str:
        """解密器唯一算法名称"""
        pass

    @abstractmethod
    def decrypt(
        self,
        encrypted_data: Any,
        key: Optional[str] = None,
        iv: Optional[str] = None,
        params: Optional[Dict[str, Any]] = None
    ) -> Any:
        """
        执行逆向解密操作
        :param encrypted_data: 密文（可以是字符串、bytes、或 dict 数据）
        :param key: 密钥 (Key)
        :param iv: 初始向量 (IV)
        :param params: 算法辅助参数（如 mode、padding、自定义码表等）
        :return: 解密后的明文（str、bytes 或 dict）
        """
        pass

    def can_handle(self, encrypted_data: Any) -> bool:
        """可根据特征判断是否可处理该加密数据"""
        return True
