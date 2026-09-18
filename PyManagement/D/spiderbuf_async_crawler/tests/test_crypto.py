"""自测：逆向解密工具（摘要/HMAC/Base64/XOR/RC4/AES 往返 + 反爬签名样式）。"""

from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from core import crypto


def test_digest_hmac() -> None:
    assert len(crypto.md5_hex("spiderbuf")) == 32
    assert len(crypto.sha256_hex("x")) == 64
    h = crypto.hmac_hex("key", "msg", algo="sha256")
    assert len(h) == 64
    print("  ✔ md5 / sha256 / hmac")


def test_base64() -> None:
    assert crypto.b64_encode("你好") == "5L2g5aW9"
    assert crypto.b64_decode("5L2g5aW9").decode("utf-8") == "你好"
    # JS btoa/atob 等价
    assert crypto.js_btoa("abc") == "YWJj"
    assert crypto.js_atob("YWJj") == "abc"
    print("  ✔ base64 / btoa / atob")


def test_xor_rc4() -> None:
    assert crypto.xor_bytes(b"\x01\x02", b"\x01\x01") == b"\x00\x03"
    assert crypto.xor_int(5, 3) == 6
    rc4_out = crypto.rc4(b"secret", b"key")
    assert crypto.rc4(rc4_out, b"key") == b"secret"
    print("  ✔ xor / rc4 对称往返")


def test_aes() -> None:
    key = b"0123456789abcdef"
    # ECB
    enc = crypto.aes_ecb_encrypt("明文数据", key)
    assert crypto.aes_ecb_decrypt(enc, key).decode() == "明文数据"
    # CBC 显式 IV
    enc = crypto.aes_cbc_encrypt("cbc数据", key, iv=b"1234567890abcdef")
    assert crypto.aes_cbc_decrypt(enc, key, iv=b"1234567890abcdef").decode() == "cbc数据"
    # CBC iv_prefix（CryptoJS 风格：IV 在密文前）
    enc = crypto.aes_cbc_encrypt("ivprefix数据", key, iv_prefix=True)
    assert len(enc) >= 32
    assert crypto.aes_cbc_decrypt(enc, key, iv_prefix=True).decode() == "ivprefix数据"
    print("  ✔ AES-ECB / AES-CBC / iv_prefix(CryptoJS)")


def test_signature_patterns() -> None:
    """复刻真实关卡签名：c03 / c06 / c07 风格。"""
    import random, string, time
    ts = 1718000000
    # c03: xor=i^ts, md5(xor+ts)
    xor = 3 ^ ts
    sign = crypto.md5_hex(f"{xor}{ts}")
    assert len(sign) == 32
    # c06: md5("3006spiderbuf"+ts)
    sign2 = crypto.md5_hex(f"3006spiderbuf{ts}")
    assert len(sign2) == 32
    # c07: 随机 key + md5(ts+token+key)
    key = "".join(random.choice(string.ascii_letters + string.digits) for _ in range(32))
    token = "abc123"
    sign3 = crypto.md5_hex(f"{ts}{token}{key}")
    assert len(sign3) == 32 and len(key) == 32
    print("  ✔ c03/c06/c07 签名样式复现")


if __name__ == "__main__":
    test_digest_hmac()
    test_base64()
    test_xor_rc4()
    test_aes()
    test_signature_patterns()
