# -*- coding: utf-8 -*-
"""
================================================================================
关卡 c08 - Selenium高级对抗及浏览器 Hook 反调试
难度: 4.0 / 5.0
反爬技术: API 参数签名（HMAC-SHA256）+ AES-CBC 响应加密 + 浏览器 Hook 反调试
加密算法: HMAC-SHA256（请求签名）、AES-128-CBC（响应解密，PKCS7 填充）
运行方式: python spider_c08.py
原理（依据官方参考代码）:
  1) timestamp = 当前秒级时间戳
  2) salt_raw  = f"{time.perf_counter()*1000:.6f}" 模拟浏览器高精度行为
     salt      = base64(salt_raw)                  （等价 btoa）
  3) message   = salt + str(timestamp)
     digest    = HMAC-SHA256(key=base_url, msg=message).digest()
     sig       = base64(digest)
  4) GET  base_url/api?t=<ts>&s=<salt>&sig=<sig>
  5) 响应 JSON {"d": <base64>}，前 16 字节为 IV，其余为密文
     key = sig[:16]
     AES-128-CBC 解密 -> 去 PKCS7 填充 -> JSON 列表
  6) 每项含 price，计算价格平均值（关卡目标）
================================================================================
"""
import time
import base64
import hmac
import hashlib
import json

import requests
from Crypto.Cipher import AES

BASE_URL = 'https://spiderbuf.cn/challenge/scraper-practice-c08'
HEADERS = {
    'User-Agent': ('Mozilla/5.0 (Windows NT 10.0; Win64; x64) '
                   'AppleWebKit/537.36 (KHTML, like Gecko) '
                   'Chrome/91.0.4472.164 Safari/537.36'),
    'Referer': BASE_URL,
}


def build_signature() -> dict:
    """生成时间戳、salt 与 HMAC-SHA256 签名参数。"""
    timestamp = int(time.time())
    timestamp_str = str(timestamp)
    # 保留 6 位小数，模拟浏览器高精度 perf 行为
    salt_raw = '{:.6f}'.format(time.perf_counter() * 1000)
    salt = base64.b64encode(salt_raw.encode()).decode()
    message = (salt + timestamp_str).encode()
    digest = hmac.new(BASE_URL.encode(), message, hashlib.sha256).digest()
    signature_b64 = base64.b64encode(digest).decode()
    return {'t': timestamp_str, 's': salt, 'sig': signature_b64}


def decrypt_response(result: dict, sig: str) -> list:
    """用 sig 前 16 字节作 AES key，前 16 字节 base64(d) 为 IV 解密。"""
    key = sig[:16].encode('utf-8')
    cipher_data = base64.b64decode(result['d'])
    iv = cipher_data[:16]
    ciphertext = cipher_data[16:]
    cipher = AES.new(key, AES.MODE_CBC, iv)
    decrypted = cipher.decrypt(ciphertext)
    pad_len = decrypted[-1]
    decrypted = decrypted[:-pad_len]
    return json.loads(decrypted.decode('utf-8'))


def main():
    print("=" * 70)
    print("SpiderBuf c08 - Selenium高级对抗及浏览器 Hook 反调试")
    print("=" * 70)
    params = build_signature()
    print(f"[c08] t={params['t']}  s={params['s'][:24]}...")

    resp = requests.get(BASE_URL + '/api', params=params, headers=HEADERS, timeout=15)
    print(f"[c08] 请求 URL: {resp.url}")
    print(f"[c08] 状态码: {resp.status_code}")
    result = resp.json()
    items = decrypt_response(result, params['sig'])

    prices = []
    rows = []
    for item in items:
        prices.append(item['price'])
        rows.append({k: item.get(k) for k in item})

    avg = round(sum(prices) / len(prices), 2) if prices else 0.0
    print("-" * 70)
    print(f"[c08] 提取数据行数: {len(rows)}")
    print(json.dumps(rows, ensure_ascii=False, indent=2))
    print("-" * 70)
    print(f"[c08] 目标结果 price 平均值 = {avg}")
    print("=" * 70)
    print(f"[c08] DONE rows={len(rows)} avg_price={avg}")


if __name__ == '__main__':
    main()
