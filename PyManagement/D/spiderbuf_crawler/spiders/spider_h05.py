# -*- coding: utf-8 -*-
"""
================================================================================
关卡 h05 - js逆向破解时间戳反爬
难度: 3.0 / 5.0
反爬技术: API 参数时间戳 + MD5 签名（btoa Base64 传输），混淆 JS（obfuscator.io 数组
          旋转 + 字符串 Base64 编码），内置 debugger 反调试（console 方法被替换为空函数）
加密算法: MD5（md5(秒级时间戳)），再将 "timestamp,md5" 做 Base64
运行方式: python spider_h05.py
原理（逆向自 /static/js/3NjU0MzIx.min.js）:
  JS 核心片段等价于:
      var timeStamp = Math.floor(Date.now()/1000);
      var _md5      = md5(String(timeStamp));
      var s         = btoa(timeStamp + ',' + _md5);
      fetch('/challenge/javascript-reverse-timestamp/api/' + s)
  故 Python 复现:
      ts = int(time.time())
      sign = md5(str(ts)).hexdigest()
      payload = base64(f"{ts},{sign}")
      GET /challenge/javascript-reverse-timestamp/api/<payload>
================================================================================
"""
import base64
import hashlib
import json
import time

import requests

URL = "https://spiderbuf.cn/challenge/javascript-reverse-timestamp/api/"
HEADERS = {
    "User-Agent": ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                   "AppleWebKit/537.36 (KHTML, like Gecko) "
                   "Chrome/126.0.0.0 Safari/537.36"),
    "Accept-Language": "zh-CN,zh;q=0.9",
}


def build_payload() -> str:
    """按 JS 逻辑生成 Base64 请求体: btoa(ts + ',' + md5(ts))."""
    ts = int(time.time())
    sign = hashlib.md5(str(ts).encode()).hexdigest()
    return base64.b64encode(f"{ts},{sign}".encode()).decode()


def fetch_data() -> list:
    payload = build_payload()
    resp = requests.get(URL + payload, headers=HEADERS, timeout=20)
    resp.raise_for_status()
    return resp.json()


def main():
    print("=" * 70)
    print("SpiderBuf h05 - js逆向破解时间戳反爬")
    print("=" * 70)
    rows = fetch_data()
    time.sleep(1)  # 每请求间隔 >=1s
    print("-" * 70)
    print(f"[h05] API 返回数据行数: {len(rows)}")
    print(json.dumps(rows, ensure_ascii=False, indent=2))
    print("=" * 70)
    print(f"[h05] DONE rows={len(rows)}")


if __name__ == "__main__":
    main()
