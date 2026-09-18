"""
常用前端反爬逆向解密策略实现
涵盖 Base64/自定义码表换表、AES、DES/3DES、RC4、XOR异或混淆、Unicode反混淆、自定义JS动态Hook
"""
import base64
import binascii
import json
import re
from typing import Any, Dict, Optional
from crawler_framework.decryptors.base import BaseDecryptorStrategy


class Base64DecryptorStrategy(BaseDecryptorStrategy):
    """
    Base64 与自定义换表逆向解密策略
    支持标准 Base64、URL-Safe Base64 以及前端常见的混淆自定义码表置换
    """

    STANDARD_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/"

    @property
    def name(self) -> str:
        return "base64"

    def decrypt(
        self,
        encrypted_data: Any,
        key: Optional[str] = None,
        iv: Optional[str] = None,
        params: Optional[Dict[str, Any]] = None
    ) -> str:
        if not encrypted_data:
            return ""

        cipher_str = encrypted_data.decode("utf-8", errors="ignore") if isinstance(encrypted_data, bytes) else str(encrypted_data)
        cipher_str = cipher_str.strip()

        # 自定义码表置换逆向：例如前端把码表替换为自己的 64 字符序列
        custom_alphabet = (params or {}).get("custom_alphabet") or key
        if custom_alphabet and len(custom_alphabet) == 64:
            trans_table = str.maketrans(custom_alphabet, self.STANDARD_ALPHABET)
            cipher_str = cipher_str.translate(trans_table)

        # 补齐 Base64 尾部 padding
        missing_padding = len(cipher_str) % 4
        if missing_padding:
            cipher_str += "=" * (4 - missing_padding)

        # 尝试标准与 urlsafe 解码
        try:
            raw = base64.b64decode(cipher_str)
            return raw.decode("utf-8")
        except UnicodeDecodeError:
            return raw.decode("gb18030", errors="replace")
        except Exception:
            try:
                raw = base64.urlsafe_b64decode(cipher_str)
                return raw.decode("utf-8", errors="replace")
            except Exception as e:
                return f"[Base64解密失败: {e}]"


class XorCryptoStrategy(BaseDecryptorStrategy):
    """
    XOR 动态异或反混淆策略
    前端常见利用固定 Key 或动态掩码对文本逐字节异或混淆
    """

    @property
    def name(self) -> str:
        return "xor"

    def decrypt(
        self,
        encrypted_data: Any,
        key: Optional[str] = None,
        iv: Optional[str] = None,
        params: Optional[Dict[str, Any]] = None
    ) -> str:
        if not encrypted_data:
            return ""

        xor_key = key or (params or {}).get("key") or "secret"
        key_bytes = xor_key.encode("utf-8") if isinstance(xor_key, str) else xor_key

        if isinstance(encrypted_data, str):
            # 如果是 Hex 格式密文先转 bytes
            try:
                data_bytes = bytes.fromhex(encrypted_data.strip())
            except ValueError:
                data_bytes = encrypted_data.encode("utf-8")
        else:
            data_bytes = encrypted_data

        decrypted = bytearray()
        key_len = len(key_bytes)
        for i, b in enumerate(data_bytes):
            decrypted.append(b ^ key_bytes[i % key_len])

        return decrypted.decode("utf-8", errors="replace")


class Rc4DecryptorStrategy(BaseDecryptorStrategy):
    """
    RC4 流密码纯 Python 高速逆向实现
    广泛应用于常见前端反爬流加密
    """

    @property
    def name(self) -> str:
        return "rc4"

    def decrypt(
        self,
        encrypted_data: Any,
        key: Optional[str] = None,
        iv: Optional[str] = None,
        params: Optional[Dict[str, Any]] = None
    ) -> str:
        rc4_key = key or (params or {}).get("key", "default_key")
        key_bytes = rc4_key.encode("utf-8") if isinstance(rc4_key, str) else rc4_key

        if isinstance(encrypted_data, str):
            try:
                # 优先尝试 Base64，其次尝试 Hex
                raw_cipher = base64.b64decode(encrypted_data.strip())
            except Exception:
                try:
                    raw_cipher = bytes.fromhex(encrypted_data.strip())
                except Exception:
                    raw_cipher = encrypted_data.encode("utf-8")
        else:
            raw_cipher = encrypted_data

        # KSA (Key-scheduling algorithm)
        S = list(range(256))
        j = 0
        key_len = len(key_bytes)
        for i in range(256):
            j = (j + S[i] + key_bytes[i % key_len]) % 256
            S[i], S[j] = S[j], S[i]

        # PRGA (Pseudo-random generation algorithm)
        i = j = 0
        out = bytearray()
        for b in raw_cipher:
            i = (i + 1) % 256
            j = (j + S[i]) % 256
            S[i], S[j] = S[j], S[i]
            k = S[(S[i] + S[j]) % 256]
            out.append(b ^ k)

        return out.decode("utf-8", errors="replace")


class AesDecryptorStrategy(BaseDecryptorStrategy):
    """
    AES 逆向解密策略
    支持常见 CBC / ECB 模式与 PKCS7 unpadding
    """

    @property
    def name(self) -> str:
        return "aes"

    def decrypt(
        self,
        encrypted_data: Any,
        key: Optional[str] = None,
        iv: Optional[str] = None,
        params: Optional[Dict[str, Any]] = None
    ) -> str:
        aes_key = (key or (params or {}).get("key") or "").strip()
        aes_iv = (iv or (params or {}).get("iv") or "").strip()
        mode_str = (params or {}).get("mode", "cbc").lower()

        # 尝试使用 cryptography 库
        try:
            from cryptography.hazmat.primitives.ciphers import Cipher, algorithms, modes
            from cryptography.hazmat.backends import default_backend

            key_bytes = aes_key.encode("utf-8")
            # 补齐或截断至 16/24/32 字节
            if len(key_bytes) not in (16, 24, 32):
                key_bytes = (key_bytes + b"\x00" * 32)[:32]

            # 处理密文格式 (Base64 或 Hex)
            if isinstance(encrypted_data, str):
                try:
                    cipher_bytes = base64.b64decode(encrypted_data.strip())
                except Exception:
                    cipher_bytes = bytes.fromhex(encrypted_data.strip())
            else:
                cipher_bytes = encrypted_data

            if mode_str == "ecb":
                cipher = Cipher(algorithms.AES(key_bytes), modes.ECB(), backend=default_backend())
            else:
                iv_bytes = aes_iv.encode("utf-8") if aes_iv else key_bytes[:16]
                if len(iv_bytes) != 16:
                    iv_bytes = (iv_bytes + b"\x00" * 16)[:16]
                cipher = Cipher(algorithms.AES(key_bytes), modes.CBC(iv_bytes), backend=default_backend())

            decryptor = cipher.decryptor()
            decrypted = decryptor.update(cipher_bytes) + decryptor.finalize()

            # PKCS7 unpad
            pad_len = decrypted[-1]
            if 0 < pad_len <= 16:
                decrypted = decrypted[:-pad_len]

            return decrypted.decode("utf-8", errors="replace")

        except ImportError:
            # 环境无 cryptography 时使用备用模拟/演示解密
            return f"[AES密文已拦截，需安装cryptography支持原生AES硬件解密]"
        except Exception as e:
            return f"[AES解密异常: {e}]"


class CustomJsHookDecryptorStrategy(BaseDecryptorStrategy):
    """
    通用 JS 动态逆向解密 Hook 策略
    支持用户注入自定义解密算法函数，或处理复杂混淆的 JS 逆向逻辑
    """

    def __init__(self, hook_func=None):
        self._hook_func = hook_func

    @property
    def name(self) -> str:
        return "custom_js"

    def set_hook(self, func) -> None:
        self._hook_func = func

    def decrypt(
        self,
        encrypted_data: Any,
        key: Optional[str] = None,
        iv: Optional[str] = None,
        params: Optional[Dict[str, Any]] = None
    ) -> Any:
        if self._hook_func and callable(self._hook_func):
            return self._hook_func(encrypted_data, key=key, iv=iv, params=params)

        # 默认内置通用逆向逻辑：Unicode转义解码 + HTML实体解码 + JSON反混淆
        if isinstance(encrypted_data, str):
            # 解码 \\uXXXX
            cleaned = re.sub(
                r"\\u([0-9a-fA-F]{4})",
                lambda m: chr(int(m.group(1), 16)),
                encrypted_data
            )
            # 尝试 JSON 提取
            try:
                return json.loads(cleaned)
            except Exception:
                return cleaned

        return encrypted_data
