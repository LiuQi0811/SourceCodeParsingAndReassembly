# -*- coding: utf-8 -*-
"""
================================================================================
关卡 c06 - 用户行为检测及模拟浏览器对抗
难度: 3.5 / 5.0
反爬技术: 服务端行为校验 Cookie（_asd2sdf99，GET 页面时由 Set-Cookie 下发，带 300s 时效）
          + API 参数签名（random + timestamp + md5）
加密算法: MD5（signture = md5(f"{random}spiderbuf{timestamp}")，注意字段名拼写为 signture）
运行方式: python spider_c06.py
原理:
  1) GET 关卡页 -> 响应头 Set-Cookie 下发 _asd2sdf99（行为校验通行证），页面里
     //div[@class="detail"]/p[1]/span[2] 是固定评分数据。
  2) 携带该 Cookie POST 同一路径，JSON body = {random:3006, signture:md5(...), timestamp}
  3) 响应为电影列表，字段 rating。
  关键点: 用 requests.Session 保持 GET 下发的 Cookie，不必硬编码。
================================================================================
"""
import hashlib
import json
import time

import requests
from lxml import etree

URL = "https://spiderbuf.cn/challenge/scraper-practice-c06"
HEADERS = {
    "User-Agent": ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                   "AppleWebKit/537.36 (KHTML, like Gecko) "
                   "Chrome/126.0.0.0 Safari/537.36"),
    "Accept-Language": "zh-CN,zh;q=0.9",
}
RANDOM_VALUE = 3006


def main():
    print("=" * 70)
    print("SpiderBuf c06 - 用户行为检测及模拟浏览器对抗")
    print("=" * 70)
    s = requests.Session()
    # 1) 取页面，服务端下发行为校验 Cookie
    page = s.get(URL, headers=HEADERS, timeout=20)
    page.raise_for_status()
    cookie = s.cookies.get("_asd2sdf99", "")
    print(f"[c06] GET 页面成功，行为校验 Cookie = {cookie}")
    root = etree.HTML(page.text)
    fixed_spans = root.xpath('//div[@class="detail"]/p[1]/span[2]')
    fixed_ratings = [float(sp.text) for sp in fixed_spans]
    total = sum(fixed_ratings)
    time.sleep(1)  # 每请求间隔 >=1s

    # 2) 签名 POST
    timestamp = int(time.time())
    sign = hashlib.md5(f"{RANDOM_VALUE}spiderbuf{timestamp}".encode()).hexdigest()
    payload = {"random": RANDOM_VALUE, "signture": sign, "timestamp": timestamp}
    resp = s.post(URL, headers={**HEADERS, "Referer": URL}, json=payload, timeout=20)
    resp.raise_for_status()
    movies = resp.json()
    time.sleep(1)

    print("-" * 70)
    print(f"[c06] 页面固定评分 {len(fixed_ratings)} 个，合计: {total:.2f}")
    print(f"[c06] API 电影数据行数: {len(movies)}")
    for m in movies:
        total += float(m["rating"])
    print(f"[c06] 含 API rating 的总分: {total:.2f}")
    print(json.dumps(movies[:2], ensure_ascii=False, indent=2), "...(仅展示前 2 部)")
    print("=" * 70)
    print(f"[c06] DONE rows={len(movies)}")


if __name__ == "__main__":
    main()
