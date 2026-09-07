# -*- coding: utf-8 -*-
"""逆向实战：还原 08_flask_lab.py 靶场的签名接口（先启动靶场，再运行本脚本）。

pip install requests
python 09_reverse_demo.py

逆向三部曲：
1. 抓包：F12 发现 /api/data 需要 kw、ts、sign 三个参数
2. 定位：全局搜索 sign，找到 _0xs 函数，读懂 djb2 算法和隐藏常量 SPIDER_LAB
3. 还原：用 Python 复现算法，带签名请求 → 成功拿到数据
"""
import re
import time

import requests

BASE = "http://127.0.0.1:5000"

def djb2(s: str) -> str:
    """与前端 _0xs 相同的 djb2 变体（逆向还原出来的）。"""
    h = 5381
    for ch in s:
        h = (((h << 5) + h) + ord(ch)) & 0xFFFFFFFF
    return format(h, "x")

def main():
    # ---- 第 0 步：不带签名直接调接口，被拒 ----
    r = requests.get(f"{BASE}/api/data",
                     params={"kw": "cpu", "ts": int(time.time())}, timeout=5)
    print("不带签名请求 →", r.status_code, r.json())

    # ---- 第 1 步：下载首页，分析前端 JS ----
    html = requests.get(BASE, timeout=5).text
    print("\n页面里的签名函数片段：")
    m = re.search(r"function _0xs[\s\S]{0,260}", html)
    print(m.group(0) if m else "(未找到，确认靶场已启动)")

    # ---- 第 2 步：像“扣代码”一样把拆开的常量拼回来 ----
    const = "".join(re.findall(r'"([A-Z_]{2,})"', html))   # "SPI"+"DER_"+"LAB"
    print("\n拼接出的隐藏常量:", const)

    # ---- 第 3 步：用 Python 复现算法，带签名调用 ----
    kw, ts = "cpu", int(time.time())
    sign = djb2(f"{kw}|{ts}|{const}")
    r = requests.get(f"{BASE}/api/data",
                     params={"kw": kw, "ts": ts, "sign": sign}, timeout=5)
    print("\n带签名请求 →", r.status_code, r.json())

if __name__ == "__main__":
    main()
