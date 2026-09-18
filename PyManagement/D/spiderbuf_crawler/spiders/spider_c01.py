# -*- coding: utf-8 -*-
"""
================================================================================
关卡 c01 - 尝尝甜头：Cookie 反爬虫
难度: 3.5 / 5.0
反爬技术: Cookie 反爬虫（__cgf3t，服务端在首次访问关卡页时通过 Set-Cookie 下发，
          HttpOnly，Max-Age=3600）+ Referer 校验
加密算法: 无（Cookie 由服务端签发，客户端只需用 Session 携带）
运行方式: python spider_c01.py
原理:
  1) 先用 requests.Session GET 关卡页 /challenge/scraper-practice-c01
     -> 响应头 Set-Cookie 下发 __cgf3t=<token>-<时间戳>
  2) 携带该 Cookie + 正确 Referer GET /challenge/scraper-practice-c01/mnist
     -> 返回 mnist 像素数据表格（//tbody/tr）
  3) 取每一行 td[1]（pix1 列），计算平均值（官方示例口径）。
================================================================================
"""
import time

import requests
from lxml import etree

BASE = "https://spiderbuf.cn/challenge/scraper-practice-c01"
MNIST_URL = BASE + "/mnist"
HEADERS = {
    "User-Agent": ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                   "AppleWebKit/537.36 (KHTML, like Gecko) "
                   "Chrome/126.0.0.0 Safari/537.36"),
    "Accept-Language": "zh-CN,zh;q=0.9",
}


def main():
    print("=" * 70)
    print("SpiderBuf c01 - 尝尝甜头：Cookie 反爬虫")
    print("=" * 70)
    s = requests.Session()
    # 1) 触发服务端下发 __cgf3t Cookie
    r0 = s.get(BASE, headers=HEADERS, timeout=20)
    r0.raise_for_status()
    cookie = s.cookies.get("__cgf3t", "")
    print(f"[c01] 关卡页下发 Cookie: __cgf3t={cookie}")
    time.sleep(1)  # 每请求间隔 >=1s

    # 2) 带 Cookie + Referer 请求 mnist 数据
    resp = s.get(MNIST_URL, headers={**HEADERS, "Referer": BASE}, timeout=20)
    resp.raise_for_status()
    time.sleep(1)

    root = etree.HTML(resp.text)
    rows = []
    pix1_values = []
    for tr in root.xpath("//tbody/tr"):
        tds = tr.xpath("td")
        if len(tds) >= 2:
            cells = [(td.text or "").strip() for td in tds]
            rows.append(cells)
            try:
                pix1_values.append(int(tds[1].text or 0))
            except ValueError:
                pass

    print("-" * 70)
    print(f"[c01] mnist 数据行数: {len(rows)}")
    print("[c01] 前 3 行:", rows[:3])
    mean_pix1 = round(sum(pix1_values) / len(pix1_values), 2) if pix1_values else 0
    print(f"[c01] pix1 列(td[1]) 平均值: {mean_pix1}")
    print("=" * 70)
    print(f"[c01] DONE rows={len(rows)}")


if __name__ == "__main__":
    main()
