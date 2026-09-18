# -*- coding: utf-8 -*-
"""
================================================================================
关卡 c07 - 服务端 Token 及 API 参数签名
难度: 4.0 / 5.0
反爬技术: 服务端一次性 Token + 客户端随机 key 参与 MD5 参数签名 + Cookie 校验 +
          navigator.webdriver 检测
加密算法: MD5（md5(f"{timestamp}{token}{key}")，作为 _asd2sdf99 Cookie）
运行方式: python spider_c07.py
原理（逆向自 /static/js/c07.min.js，与官方旧示例不同——key 已改为客户端随机生成）:
  1) GET 关卡页，从 <input id="token"> 取出服务端下发的一次性 token
  2) 客户端随机生成 32 位 [A-Za-z0-9] 作为 key（每次请求都不同）
  3) timestamp = int(time.time())
     md5 签名 = md5(f"{timestamp}{token}{key}")   （注意拼接顺序）
     Cookie: _asd2sdf99 = md5 签名
  4) POST 同一路径，JSON body = {key, token, timestamp}
  5) 响应为关键词列表，字段 cpc_usd / monthly_search_volume。
================================================================================
"""
import hashlib
import json
import random
import string
import time

import requests
from lxml import etree

URL = "https://spiderbuf.cn/challenge/scraper-practice-c07"
HEADERS = {
    "User-Agent": ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                   "AppleWebKit/537.36 (KHTML, like Gecko) "
                   "Chrome/126.0.0.0 Safari/537.36"),
    "Accept-Language": "zh-CN,zh;q=0.9",
}
CHARSET = string.ascii_letters + string.digits


def fetch_data() -> list:
    # 1) 取服务端下发 token
    page = requests.get(URL, headers=HEADERS, timeout=20)
    page.raise_for_status()
    root = etree.HTML(page.text)
    token = root.xpath('//input[@id="token"]/@value')[0]

    # 2) 客户端随机 key + 时间戳 + MD5 签名
    key = "".join(random.choice(CHARSET) for _ in range(32))
    timestamp = int(time.time())
    sign = hashlib.md5(f"{timestamp}{token}{key}".encode()).hexdigest()

    headers = dict(HEADERS)
    headers["Referer"] = URL
    headers["cookie"] = f"_asd2sdf99={sign}"
    payload = {"key": key, "token": token, "timestamp": timestamp}

    resp = requests.post(URL, headers=headers, json=payload, timeout=20)
    resp.raise_for_status()
    return resp.json()


def main():
    print("=" * 70)
    print("SpiderBuf c07 - 服务端 Token 及 API 参数签名")
    print("=" * 70)
    rows = fetch_data()
    time.sleep(1)  # 每请求间隔 >=1s
    # 官方统计口径: (cpc_usd ^ monthly_search_volume) / 100 的均值
    vals = [(int(r["cpc_usd"]) ^ int(r["monthly_search_volume"])) / 100 for r in rows]
    print("-" * 70)
    print(f"[c07] 数据行数: {len(rows)}")
    print(json.dumps(rows, ensure_ascii=False, indent=2))
    print(f"[c07] (cpc_usd ^ monthly_search_volume)/100 均值: {sum(vals)/len(vals):.2f}")
    print("=" * 70)
    print(f"[c07] DONE rows={len(rows)}")


if __name__ == "__main__":
    main()
