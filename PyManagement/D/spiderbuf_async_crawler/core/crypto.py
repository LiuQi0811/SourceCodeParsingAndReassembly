"""逆向解密工具集：常见反爬加密/签名算法的完美逆向实现。

支持的算法（供站点 solver 调用，也开放为注册表）：
- 摘要：md5 / sha1 / sha256（hex）
- HMAC：hmac_md5 / hmac_sha256（hex）
- Base64：标准 / urlsafe（encode/decode）
- 字节运算：xor_bytes / xor_int / rc4
- 分组加密：AES-128/192/256 CBC / ECB（pycryptodome）
  支持两种 IV 约定：显式 IV；密文前 N 字节为 IV（常见 JS CryptoJS 风格）
- 工具：hex / b64 → bytes，js btoa/atob 等价

所有函数保持纯同步、无副作用，方便在任何 async 任务中直接调用。
"""

from __future__ import annotations

import base64
import hashlib
import hmac as _hmac
import struct
from typing import Optional, Union

try:
    from Crypto.Cipher import AES, ARC4
    from Crypto.Util.Padding import pad, unpad
    _HAS_CRYPTO = True
except ImportError:  # pragma: no cover
    AES = None
    ARC4 = None
    pad = unpad = None
    _HAS_CRYPTO = False

BytesLike = Union[bytes, bytearray, str]


def _to_bytes(data: BytesLike, encoding: str = "utf-8") -> bytes:
    if isinstance(data, str):
        return data.encode(encoding)
    return bytes(data)


def _to_hex(data: bytes) -> str:
    return data.hex()


# ---------- 摘要 ----------

def md5_hex(data: BytesLike, encoding: str = "utf-8") -> str:
    return hashlib.md5(_to_bytes(data, encoding)).hexdigest()


def sha1_hex(data: BytesLike, encoding: str = "utf-8") -> str:
    return hashlib.sha1(_to_bytes(data, encoding)).hexdigest()


def sha256_hex(data: BytesLike, encoding: str = "utf-8") -> str:
    return hashlib.sha256(_to_bytes(data, encoding)).hexdigest()


# ---------- HMAC ----------

def hmac_hex(key: BytesLike, msg: BytesLike, algo: str = "sha256",
             encoding: str = "utf-8") -> str:
    digestmod = {"md5": hashlib.md5, "sha1": hashlib.sha1,
                 "sha256": hashlib.sha256}[algo]
    return _hmac.new(_to_bytes(key, encoding), _to_bytes(msg, encoding),
                     digestmod=digestmod).hexdigest()


# ---------- Base64 ----------

def b64_encode(data: BytesLike, urlsafe: bool = False) -> str:
    raw = _to_bytes(data)
    if urlsafe:
        return base64.urlsafe_b64encode(raw).decode("ascii")
    return base64.b64encode(raw).decode("ascii")


def b64_decode(data: BytesLike) -> bytes:
    raw = _to_bytes(data, encoding="ascii")
    try:
        return base64.b64decode(raw, validate=False)
    except Exception:  # noqa: BLE001
        return base64.urlsafe_b64decode(raw + b"=" * (-len(raw) % 4))


# ---------- 字节运算 ----------

def xor_bytes(a: BytesLike, b: BytesLike) -> bytes:
    """字节流异或（b 可循环）。"""
    x = _to_bytes(a)
    y = _to_bytes(b)
    if not y:
        return x
    return bytes(x[i] ^ y[i % len(y)] for i in range(len(x)))


def xor_int(value: int, key: int) -> int:
    """整数异或。"""
    return value ^ key


def rc4(data: BytesLike, key: BytesLike) -> bytes:
    """RC4 加/解密（对称）。"""
    if not _HAS_CRYPTO:
        raise RuntimeError("缺少 pycryptodome，无法执行 RC4")
    cipher = ARC4.new(_to_bytes(key))
    return cipher.encrypt(_to_bytes(data))


# ---------- AES ----------

def aes_cbc_encrypt(data: BytesLike, key: BytesLike, iv: Optional[BytesLike] = None,
                    iv_prefix: bool = False) -> bytes:
    """AES-CBC 加密。

    - iv 给定：使用显式 IV（可 None 自动随机）
    - iv_prefix=True：输出 = 随机/给定 IV(16B) + 密文（CryptoJS 默认）
    """
    if not _HAS_CRYPTO:
        raise RuntimeError("缺少 pycryptodome，无法执行 AES")
    raw = _to_bytes(data)
    key_bytes = _to_bytes(key)
    if iv is not None:
        iv_bytes = _to_bytes(iv)
    else:
        iv_bytes = None
    if iv_prefix and iv_bytes is None:
        iv_bytes = AES.block_size * b"\x00"
    if iv_bytes is None:
        cipher = AES.new(key_bytes, AES.MODE_CBC)
        return cipher.encrypt(pad(raw, AES.block_size))
    cipher = AES.new(key_bytes, AES.MODE_CBC, iv=iv_bytes)
    enc = cipher.encrypt(pad(raw, AES.block_size))
    if iv_prefix:
        return iv_bytes + enc
    return enc


def aes_cbc_decrypt(data: BytesLike, key: BytesLike, iv: Optional[BytesLike] = None,
                    iv_prefix: bool = False, iv_len: int = 16) -> bytes:
    """AES-CBC 解密（与 aes_cbc_encrypt 镜像）。

    iv_prefix=True 时从密文头部取 iv_len 字节作 IV，剩余为密文。
    """
    if not _HAS_CRYPTO:
        raise RuntimeError("缺少 pycryptodome，无法执行 AES")
    raw = _to_bytes(data)
    key_bytes = _to_bytes(key)
    if iv_prefix:
        if len(raw) < iv_len + AES.block_size:
            raise ValueError("密文过短，无法按 iv_prefix 解出 IV")
        iv_bytes = raw[:iv_len]
        ciphertext = raw[iv_len:]
    else:
        iv_bytes = _to_bytes(iv) if iv is not None else None
        ciphertext = raw
    if iv_bytes is None:
        cipher = AES.new(key_bytes, AES.MODE_CBC)
    else:
        cipher = AES.new(key_bytes, AES.MODE_CBC, iv=iv_bytes)
    return unpad(cipher.decrypt(ciphertext), AES.block_size)


def aes_ecb_encrypt(data: BytesLike, key: BytesLike) -> bytes:
    if not _HAS_CRYPTO:
        raise RuntimeError("缺少 pycryptodome，无法执行 AES")
    cipher = AES.new(_to_bytes(key), AES.MODE_ECB)
    return cipher.encrypt(pad(_to_bytes(data), AES.block_size))


def aes_ecb_decrypt(data: BytesLike, key: BytesLike) -> bytes:
    if not _HAS_CRYPTO:
        raise RuntimeError("缺少 pycryptodome，无法执行 AES")
    cipher = AES.new(_to_bytes(key), AES.MODE_ECB)
    return unpad(cipher.decrypt(_to_bytes(data)), AES.block_size)


# ---------- JS 等价工具 ----------

def js_btoa(data: BytesLike) -> str:
    """等价 JS btoa（UTF-8 → base64）。"""
    return b64_encode(data)


def js_atob(data: BytesLike) -> str:
    """等价 JS atob（base64 → UTF-8 文本）。"""
    return b64_decode(data).decode("utf-8", errors="replace")


def hex_to_bytes(hexstr: str) -> bytes:
    return bytes.fromhex(hexstr)


def int_to_bytes32(value: int) -> bytes:
    """小端 32 位整数 → 4 字节（JS Uint32 序列化常用）。"""
    return struct.pack("<I", value & 0xFFFFFFFF)
