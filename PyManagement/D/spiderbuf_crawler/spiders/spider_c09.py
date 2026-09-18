# -*- coding: utf-8 -*-
"""
================================================================================
关卡 c09 - 浏览器指纹检测及爬虫 IP 封禁
难度: 4.0 / 5.0
反爬技术: Canvas 浏览器指纹 + webdriver 检测 + HMAC-SHA256 请求签名 + XOR 数据混淆
加密算法: SHA256(canvas+UA) 指纹、HMAC-SHA256 签名、XOR 异或 CPC
运行方式: python spider_c09.py
原理（依据 c09.min.js 逆向）:
  1) GET 页面 -> Set-Cookie _token_c09=<token>
  2) fp = 任意固定 64 位 hex（Canvas 指纹，服务端仅校验 X-Client-Id 与签名内一致）
  3) tt = 当前秒级时间戳
  4) s  = base64( HMAC-SHA256(key=token, msg=fp + str(tt) + token) )
  5) POST 同 URL，header X-Client-Id: fp，body JSON {"tt":tt,"s":s}
  6) 响应为 JSON 列表，每项 cpc_usd 与 monthly_search_volume 异或后 /100 得真实 CPC
     cpc = (cpc_usd ^ monthly_search_volume) / 100
================================================================================
"""
import time
import json
import hmac
import hashlib
import base64

import requests

URL = "https://spiderbuf.cn/challenge/scraper-practice-c09"
# 固定指纹（任意 64 位 hex 即可，服务端只校验一致性；此处取一次真实运行值）
FINGERPRINT = "7e7dd13d47bbe8921a656a533e1f75b207ac328d18cb938e9d74142cc87e4f86"
UA = ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
      "AppleWebKit/537.36 (KHTML, like Gecko) "
      "Chrome/126.0.0.0 Safari/537.36")


def main():
    print("=" * 70)
    print("SpiderBuf c09 - 浏览器指纹检测及爬虫 IP 封禁")
    print("=" * 70)
    s = requests.Session()
    # 1. GET 页面拿 token
    r1 = s.get(URL, headers={"User-Agent": UA, "Referer": URL}, timeout=15)
    token = s.cookies.get("_token_c09", "")
    print(f"[c09] GET {r1.status_code}  _token_c09={token[:16]}...")
    if not token:
        raise RuntimeError("未获取 _token_c09 cookie")

    time.sleep(1)
    # 2. 构造签名
    tt = int(time.time())
    msg = (FINGERPRINT + str(tt) + token).encode()
    digest = hmac.new(token.encode(), msg, hashlib.sha256).digest()
    sig = base64.b64encode(digest).decode()
    payload = {"tt": tt, "s": sig}

    # 3. POST
    r2 = s.post(URL, json=payload, headers={
        "User-Agent": UA,
        "Referer": URL,
        "X-Client-Id": FINGERPRINT,
        "Content-Type": "text/plain;charset=UTF-8",
    }, timeout=15)
    print(f"[c09] POST {r2.status_code}  body={payload}")
    items = r2.json()

    # 4. 解码 CPC
    rows = []
    cpc_sum = 0.0
    for it in items:
        cpc = round((it["cpc_usd"] ^ it["monthly_search_volume"]) / 100, 2)
        cpc_sum += cpc
        rows.append({
            "keyword": it["keyword"],
            "cpc": cpc,
            "monthly_search": it["monthly_search_volume"],
            "competition": it["competition"],
            "industry": it["industry"],
            "source": it["source"],
        })

    avg = round(cpc_sum / len(rows), 2) if rows else 0.0
    print("-" * 70)
    print(f"[c09] 提取数据行数: {len(rows)}")
    print(json.dumps(rows, ensure_ascii=False, indent=2))
    print("-" * 70)
    print(f"[c09] 目标结果 CPC 平均值 = {avg}")
    print("=" * 70)
    print(f"[c09] DONE rows={len(rows)} avg_cpc={avg}")


if __name__ == "__main__":
    main()
