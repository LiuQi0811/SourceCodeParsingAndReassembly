#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
通用网页JS加密内容深度解密工具 (decryptor.py)

覆盖场景：
  1. Cloudflare Email Protection (data-cfemail)
  2. Base64 / Base64Url 编码字符串（含HTML属性中的编码链接）
  3. CryptoJS AES/ECB/CBC/PKCS7 解密（自动尝试常见弱密钥、密钥派生）
  4. XOR 加密（常见简单混淆）
  5. 自定义字符替换 / ROT13 / Caesar
  6. 从混淆JS中自动提取 window.__xxx 状态并输出

用法：
  python decryptor.py <url_or_local_html>
  python decryptor.py --html <string>          # 直接解密一段HTML
  python decryptor.py --string <ciphertext>    # 暴力尝试常见密钥解密字符串
"""

import argparse
import base64
import hashlib
import json
import re
import sys
from urllib.parse import unquote

try:
    from Crypto.Cipher import AES, DES
    from Crypto.Util.Padding import unpad
except ImportError:
    AES = DES = None
    print("[提示] 未安装 pycryptodome，AES/DES 解密功能不可用，请 pip install pycryptodome")


# ---------- Cloudflare 邮箱 ----------
def cf_email_decrypt(enc: str) -> str:
    """解密 Cloudflare email protection (data-cfemail)"""
    try:
        r = int(enc[:2], 16)
        return "".join(chr(int(enc[i:i+2], 16) ^ r) for i in range(2, len(enc), 2))
    except Exception:
        return enc


# ---------- Base64 ----------
def try_base64(s: str) -> str | None:
    s = s.strip()
    # base64url -> base64
    s1 = s.replace("-", "+").replace("_", "/")
    pad = (4 - len(s1) % 4) % 4
    s1 += "=" * pad
    for charset in ("utf-8", "gbk", "latin-1"):
        try:
            raw = base64.b64decode(s1, validate=False)
            text = raw.decode(charset, errors="ignore")
            # 简单启发：可读字符占比高
            readable = sum(1 for c in text if 32 <= ord(c) < 127 or ord(c) > 127)
            if readable / max(1, len(text)) > 0.85 and len(text) >= 2:
                return text
        except Exception:
            continue
    return None


# ---------- AES 解密（CryptoJS 兼容） ----------
COMMON_KEYS = [
    "1234567890123456", "abcdefghijklmnop", "0000000000000000",
    "8888888888888888", "1qaz2wsx3edc4rfv", "depvailon",
    "depvailon.com", "www.depvailon.com", "20200207",
    "crypto-js", "CryptoJS", "secret", "password", "keyboard cat",
]

def _derive_key(secret: bytes, key_len: int = 32) -> bytes:
    """CryptoJS 默认的 EvpKDF（OpenSSL EVP_BytesToKey）派生密钥"""
    data = b""
    d = b""
    while len(data) < key_len + 16:
        d = hashlib.md5(d + secret).digest()
        data += d
    return data[:key_len], data[key_len:key_len+16]


def try_aes_decrypt(ciphertext_b64: str, password: str) -> str | None:
    if AES is None:
        return None
    try:
        ct = base64.b64decode(ciphertext_b64)
    except Exception:
        return None
    if len(ct) < 17:
        return None
    # CryptoJS OpenSSL 格式：开头 8字节 "Salted__" + 8字节salt + 密文
    if ct[:8] == b"Salted__":
        salt = ct[8:16]
        ct = ct[16:]
        key, iv = _derive_key(password.encode() + salt, 32)
        for mode_name, cipher in [("CBC", AES.new(key, AES.MODE_CBC, iv)),
                                   ("ECB", AES.new(key, AES.MODE_ECB))]:
            try:
                pt = unpad(cipher.decrypt(ct), AES.block_size)
                text = pt.decode("utf-8", errors="ignore")
                if _looks_readable(text):
                    return text
            except Exception:
                continue
    # 原始 AES-ECB/CBC（无盐，密钥MD5）
    for key_src in [password, hashlib.md5(password.encode()).hexdigest()]:
        key = key_src.encode().ljust(32, b"\0")[:32]
        for mode_name, cipher in [("ECB", AES.new(key, AES.MODE_ECB))]:
            try:
                pt = unpad(cipher.decrypt(ct), AES.block_size)
                text = pt.decode("utf-8", errors="ignore")
                if _looks_readable(text):
                    return text
            except Exception:
                continue
    return None


def _looks_readable(s: str) -> bool:
    if not s or len(s) < 2:
        return False
    readable = sum(1 for c in s if c.isprintable() or c in "\n\r\t")
    return readable / len(s) > 0.9


# ---------- XOR ----------
def xor_decrypt(data: bytes, key: bytes) -> bytes:
    return bytes(b ^ key[i % len(key)] for i, b in enumerate(data))


def try_xor(ciphertext_b64: str) -> list[tuple[str, str]]:
    """尝试单字节/短密钥XOR解密"""
    results = []
    try:
        ct = base64.b64decode(ciphertext_b64)
    except Exception:
        ct = ciphertext_b64.encode("latin-1", errors="ignore")
    # 单字节密钥
    for k in range(1, 256):
        pt = bytes(b ^ k for b in ct)
        try:
            t = pt.decode("utf-8", errors="ignore")
            if _looks_readable(t) and any(c.isalpha() for c in t):
                results.append((f"XOR single-byte key=0x{k:02x}", t))
        except Exception:
            continue
    return results[:10]


# ---------- ROT13 / Caesar ----------
def rot13(s: str) -> str:
    out = []
    for c in s:
        if "a" <= c <= "z":
            out.append(chr((ord(c) - ord("a") + 13) % 26 + ord("a")))
        elif "A" <= c <= "Z":
            out.append(chr((ord(c) - ord("A") + 13) % 26 + ord("A")))
        else:
            out.append(c)
    return "".join(out)


# ---------- 从HTML中提取加密片段并尝试解密 ----------
def decrypt_html(html: str) -> tuple[str, list[dict]]:
    findings = []

    # 1. CF 邮箱
    def cfmail_repl(m):
        enc = m.group(1)
        dec = cf_email_decrypt(enc)
        findings.append({"type": "cf_email", "cipher": enc, "plain": dec})
        return f"mailto:{dec}"
    html = re.sub(r"/cdn-cgi/l/email-protection#([a-fA-F0-9]+)", cfmail_repl, html)

    def cfspan_repl(m):
        enc = m.group(1)
        dec = cf_email_decrypt(enc)
        findings.append({"type": "cf_email_span", "cipher": enc, "plain": dec})
        return dec
    html = re.sub(r'data-cfemail="([a-fA-F0-9]+)"', cfspan_repl, html)

    # 2. 提取 SSR 状态
    for pat_name, pat in [
        ("__NEXT_DATA__", r"<script[^>]*id=\"__NEXT_DATA__\"[^>]*>(.*?)</script>"),
        ("__NUXT__",      r"<script[^>]*id=\"__NUXT__\"[^>]*>(.*?)</script>"),
        ("INITIAL_STATE", r"window\.__INITIAL_STATE__\s*=\s*(\{.*?\})\s*;"),
        ("PRELOADED_STATE", r"window\.__PRELOADED_STATE__\s*=\s*(\{.*?\})\s*;"),
    ]:
        m = re.search(pat, html, re.DOTALL)
        if m:
            try:
                obj = json.loads(m.group(1))
                findings.append({"type": "state_extract", "name": pat_name,
                                 "keys": list(obj.keys())[:10]})
            except Exception:
                pass

    # 3. 寻找疑似Base64加密长串（>16字符），尝试base64/AES解密
    b64_candidates = re.findall(r'["\']([A-Za-z0-9+/=_\-]{24,}={0,2})["\']', html)
    seen = set()
    for cand in b64_candidates:
        if cand in seen:
            continue
        seen.add(cand)
        # base64
        bt = try_base64(cand)
        if bt and len(bt) > 4 and _looks_readable(bt):
            findings.append({"type": "base64", "cipher": cand[:60]+"...", "plain": bt[:200]})
            continue
        # AES 常见密钥
        for key in COMMON_KEYS:
            pt = try_aes_decrypt(cand, key)
            if pt:
                findings.append({"type": f"AES(key={key})", "cipher": cand[:60]+"...",
                                 "plain": pt[:200]})
                break

    return html, findings


def brute_decrypt_string(s: str):
    print(f"[*] 待解密字符串: {s[:100]}")
    # base64
    bt = try_base64(s)
    if bt:
        print(f"[+] Base64 解密成功: {bt[:300]}")
        return
    # AES 常见密钥
    for key in COMMON_KEYS:
        pt = try_aes_decrypt(s, key)
        if pt:
            print(f"[+] AES 解密成功 (key={key}): {pt[:300]}")
            return
    # XOR
    xors = try_xor(s)
    for kdesc, pt in xors[:3]:
        if _looks_readable(pt):
            print(f"[+] {kdesc} 解密成功: {pt[:300]}")
            return
    # ROT13
    r = rot13(s)
    if r != s and _looks_readable(r):
        print(f"[+] ROT13 解密成功: {r[:300]}")
        return
    print("[-] 未能自动解密，建议提供密钥或检查加密算法")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("target", nargs="?", help="URL或本地HTML文件路径")
    ap.add_argument("--html", help="直接传入HTML字符串")
    ap.add_argument("--string", "-s", help="解密单个密文")
    args = ap.parse_args()

    if args.string:
        brute_decrypt_string(args.string)
        return

    html = args.html or ""
    if args.target:
        if args.target.startswith("http"):
            import requests
            r = requests.get(args.target, headers={"User-Agent":
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/125.0.0.0"},
                             timeout=20)
            r.encoding = r.apparent_encoding or r.encoding
            html = r.text
        else:
            with open(args.target, encoding="utf-8", errors="ignore") as f:
                html = f.read()
    if not html:
        ap.print_help()
        return

    new_html, findings = decrypt_html(html)
    print(f"[*] 解密完成，共发现 {len(findings)} 处加密内容：\n")
    for f in findings:
        print(json.dumps(f, ensure_ascii=False, indent=2))
    out = "decrypted_output.html"
    with open(out, "w", encoding="utf-8") as fp:
        fp.write(new_html)
    print(f"\n[+] 解密后的HTML已保存到 {out}")


if __name__ == "__main__":
    main()
