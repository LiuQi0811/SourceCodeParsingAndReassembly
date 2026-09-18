# -*- coding: utf-8 -*-
"""
================================================================================
关卡 h06 - 初识浏览器指纹：Selenium是如何被反爬的
难度: 3.0 / 5.0
反爬技术: 浏览器指纹检测（页面 JS 检测 navigator.webdriver / Selenium 特征，命中则
          拒绝渲染数据）+ 与 h05 相同的时间戳 MD5 签名 API
加密算法: MD5（md5(秒级时间戳)），再将 "timestamp,md5" 做 Base64
运行方式: python spider_h06.py
原理:
  页面本身会检测自动化浏览器特征；但其数据接口 /challenge/.../api/<b64> 只校验
  时间戳签名，并不校验 navigator.webdriver。因此放弃 Selenium/Playwright 渲染页面，
  直接用 requests 按 h05 同样的算法构造请求体即可拿到数据（这正是"逆向 API 绕浏览器"）。
  算法等价 JS:
      var s = btoa(Math.floor(Date.now()/1000) + ',' + md5(String(Math.floor(Date.now()/1000))));
================================================================================
"""
import base64
import hashlib
import json
import time

import requests

URL = "https://spiderbuf.cn/challenge/selenium-fingerprint-anti-scraper/api/"
HEADERS = {
    "User-Agent": ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                   "AppleWebKit/537.36 (KHTML, like Gecko) "
                   "Chrome/126.0.0.0 Safari/537.36"),
    "Accept-Language": "zh-CN,zh;q=0.9",
}


def fetch_data() -> list:
    ts = int(time.time())
    sign = hashlib.md5(str(ts).encode()).hexdigest()
    payload = base64.b64encode(f"{ts},{sign}".encode()).decode()
    resp = requests.get(URL + payload, headers=HEADERS, timeout=20)
    resp.raise_for_status()
    return resp.json()


def main():
    print("=" * 70)
    print("SpiderBuf h06 - 初识浏览器指纹：Selenium是如何被反爬的")
    print("=" * 70)
    rows = fetch_data()
    time.sleep(1)  # 每请求间隔 >=1s
    print("-" * 70)
    print(f"[h06] 直接调 API（绕过浏览器指纹检测）数据行数: {len(rows)}")
    print(json.dumps(rows, ensure_ascii=False, indent=2))
    print("=" * 70)
    print(f"[h06] DONE rows={len(rows)}")


if __name__ == "__main__":
    main()
