# -*- coding: utf-8 -*-
"""
================================================================================
关卡 c02 - 拖拽式滑块验证码反爬虫
难度: 3.5 / 5.0
反爬技术: 拖拽式滑块验证码（id=slider，官方用 Selenium ActionChains 拖动约 254px）
          + 数据 Base64 编码
加密算法: Base64（页面内嵌 encryptedData = "<base64(json)>"，解码后为 {flights:[...]}）
运行方式: python spider_c02.py
原理:
  官方提供两条路径:
    example 1: 浏览器拖动滑块 -> 页面渲染航班表格
    example 2（本脚本采用，效率高）: GET 关卡页，正则取出 encryptedData="..."，
              base64 解码即得 flights JSON。
  响应字段: flights[].from / to / price，官方统计 price 均值。
================================================================================
"""
import base64
import json
import re
import time

import requests

URL = "https://spiderbuf.cn/challenge/scraper-practice-c02"
HEADERS = {
    "User-Agent": ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                   "AppleWebKit/537.36 (KHTML, like Gecko) "
                   "Chrome/126.0.0.0 Safari/537.36"),
    "Accept-Language": "zh-CN,zh;q=0.9",
}


def main():
    print("=" * 70)
    print("SpiderBuf c02 - 拖拽式滑块验证码反爬虫")
    print("=" * 70)
    resp = requests.get(URL, headers=HEADERS, timeout=20)
    resp.raise_for_status()
    time.sleep(1)  # 每请求间隔 >=1s

    m = re.search(r'encryptedData\s*=\s*"([^"]+)"', resp.text)
    if not m:
        raise RuntimeError("页面未找到 encryptedData，可能需先通过滑块验证码")
    flights = json.loads(base64.b64decode(m.group(1)).decode("utf-8"))["flights"]

    prices = [f["price"] for f in flights]
    print("-" * 70)
    print(f"[c02] 航班数据行数: {len(flights)}")
    print(json.dumps(flights, ensure_ascii=False, indent=2))
    print(f"[c02] price 列表: {prices}")
    print(f"[c02] price 均值: {sum(prices)/len(prices):.2f}")
    print("=" * 70)
    print(f"[c02] DONE rows={len(flights)}")


if __name__ == "__main__":
    main()
