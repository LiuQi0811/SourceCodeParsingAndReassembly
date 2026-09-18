# -*- coding: utf-8 -*-
"""
================================================================================
关卡 c11 - Web Workers 多线程反调试
难度: 4.0 / 5.0
反爬技术: Web Worker 多线程计算签名 + 双重 HMAC 校验（主线程 cookie + Worker 请求参数）
           + 时间戳防重放（t/tt 双时间戳）
加密算法: HMAC-SHA256（两次，key 分别为 t 与 tt，msg 均为 currency+chip+memory+t）
运行方式: python spider_c11.py
原理（逆向 c11.min.js 主线程 + c11_worker.min.js Worker）:
  主线程:
    t   = 当前秒级时间戳
    sig1 = base64(HMAC-SHA256(key=str(t), msg=currency+chip+memory+t))
    把 sig1 写入 cookie：document.cookie = "<t>=<urlencode(sig1)>"
    创建 Worker(c11_worker.min.js?chip&currency&memory&t&nonce)
  Worker:
    tt  = 当前秒级时间戳（晚于 t）
    sig2 = base64(HMAC-SHA256(key=str(tt), msg=currency+chip+memory+t))
    GET /api?chip=&currency=&memory=&t=&tt=&s=sig2
  服务端同时校验 cookie(t=sig1) 与参数(s=sig2)，二者一致才放行。
  目标: M4 芯片 × 所有内存规格(16GB/24GB) × 所有币种(USD/EUR) 价格总和。
================================================================================
"""
import time
import json
import hmac
import hashlib
import base64
import urllib.parse

import requests

PAGE = "https://spiderbuf.cn/challenge/scraper-practice-js-reverse-c11"
API = PAGE + "/api"
HEADERS = {
    "User-Agent": ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                   "AppleWebKit/537.36 (KHTML, like Gecko) "
                   "Chrome/126.0.0.0 Safari/537.36"),
    "Referer": PAGE,
}

CHIPS = ["M4"]
CURRENCIES = ["USD", "EUR"]
MEMORIES = ["16GB", "24GB"]


def call_api(s: requests.Session, chip: str, currency: str, memory: str) -> list:
    """按双重 HMAC 流程请求一次 API，返回商品列表。"""
    t = str(int(time.time()))
    time.sleep(1)  # 保证 tt 与 t 至少差 1 秒，模拟 Worker 异步
    tt = str(int(time.time()))

    msg = (currency + chip + memory + t).encode()
    # 主线程签名 -> cookie（key = t）
    sig1 = base64.b64encode(hmac.new(t.encode(), msg, hashlib.sha256).digest()).decode()
    # Worker 签名 -> s 参数（key = tt）
    sig2 = base64.b64encode(hmac.new(tt.encode(), msg, hashlib.sha256).digest()).decode()

    s.cookies.set(t, urllib.parse.quote(sig1), domain="spiderbuf.cn", path="/")
    params = {"chip": chip, "currency": currency, "memory": memory,
              "t": t, "tt": tt, "s": sig2}
    r = s.get(API, params=params, headers=HEADERS, timeout=15)
    r.raise_for_status()
    time.sleep(1)  # 每请求间隔 >=1s
    return r.json()


def main():
    print("=" * 70)
    print("SpiderBuf c11 - Web Workers 多线程反调试")
    print("=" * 70)
    s = requests.Session()
    s.get(PAGE, headers={**HEADERS, "Referer": "https://spiderbuf.cn/"}, timeout=15)
    time.sleep(1)

    all_rows = []
    for chip in CHIPS:
        for currency in CURRENCIES:
            for memory in MEMORIES:
                print(f"[c11] 查询 chip={chip} currency={currency} memory={memory} ...")
                items = call_api(s, chip, currency, memory)
                for it in items:
                    all_rows.append({
                        "model": it["model"],
                        "screen": it["screen_size"],
                        "chip": it["chip"],
                        "memory": it["memory"],
                        "storage": it["storage"],
                        "price": it["price"],
                        "currency": it["currency"],
                    })

    total = sum(r["price"] for r in all_rows)
    print("-" * 70)
    print(f"[c11] 提取数据行数: {len(all_rows)}")
    print(json.dumps(all_rows, ensure_ascii=False, indent=2))
    print("-" * 70)
    print(f"[c11] 目标结果 M4 全内存×全币种价格总和 = {total}")
    print("=" * 70)
    print(f"[c11] DONE rows={len(all_rows)} total_price={total}")


if __name__ == "__main__":
    main()
