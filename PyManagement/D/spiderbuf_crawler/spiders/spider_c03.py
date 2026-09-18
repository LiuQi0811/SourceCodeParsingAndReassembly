# -*- coding: utf-8 -*-
"""
================================================================================
关卡 c03 - 时间戳哈希签名 + 随机数防重放反爬虫
难度: 3.5 / 5.0
反爬技术: API 参数签名（timestamp + xorResult + random + hash），防重放
加密算法: MD5（hash = md5(f"{i ^ timestamp}{timestamp})）
运行方式: python spider_c03.py
原理（官方示例 example 2）:
  每一页 i (1..5) 重新生成秒级时间戳，服务端用同一个时间戳校验签名，从而防止旧包重放。
      timestamp  = int(time.time())
      xorResult  = i ^ timestamp           （页面号与时间戳异或）
      hash       = md5(f"{xorResult}{timestamp}").hexdigest()
      POST /challenge/scraper-practice-c03  body=json{random, timestamp, hash, xorResult}
  响应为该页 iris 数据列表，取 sepal_width。
================================================================================
"""
import hashlib
import json
import random
import time

import requests

URL = "https://spiderbuf.cn/challenge/scraper-practice-c03"
HEADERS = {
    "User-Agent": ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                   "AppleWebKit/537.36 (KHTML, like Gecko) "
                   "Chrome/126.0.0.0 Safari/537.36"),
    "Accept-Language": "zh-CN,zh;q=0.9",
}


def fetch_page(i: int) -> list:
    timestamp = int(time.time())
    xor_result = i ^ timestamp
    sign = hashlib.md5(f"{xor_result}{timestamp}".encode()).hexdigest()
    payload = {
        "random": random.randint(2000, 10000),
        "timestamp": timestamp,
        "hash": sign,
        "xorResult": xor_result,
    }
    resp = requests.post(URL, headers=HEADERS, json=payload, timeout=20)
    resp.raise_for_status()
    return resp.json()


def main():
    print("=" * 70)
    print("SpiderBuf c03 - 时间戳哈希签名 + 随机数防重放反爬虫")
    print("=" * 70)
    all_rows = []
    widths = []
    for i in range(1, 6):
        page_rows = fetch_page(i)
        time.sleep(1)  # 每请求间隔 >=1s
        for item in page_rows:
            all_rows.append({"page": i, **item})
            widths.append(float(item["sepal_width"]))
        print(f"[c03] 第 {i} 页: {len(page_rows)} 行, sepal_width 累计 {len(widths)}")
    print("-" * 70)
    print(f"[c03] 总数据行数: {len(all_rows)}, sepal_width 合计: {sum(widths):.2f}")
    print(json.dumps(all_rows[:3], ensure_ascii=False, indent=2), "...(仅展示前 3 行)")
    print("=" * 70)
    print(f"[c03] DONE rows={len(all_rows)}")


if __name__ == "__main__":
    main()
