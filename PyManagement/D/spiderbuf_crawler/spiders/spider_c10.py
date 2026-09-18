# -*- coding: utf-8 -*-
"""
================================================================================
关卡 c10 - 简单模拟 Cloudflare Challenge
难度: 4.0 / 5.0
反爬技术: JS Challenge（模拟 __jsl_clearance 机制，首次访问返回 403 并下发
          __jsluid_h=<a>-<b> Cookie，需自行计算 __jsl_clearance 后重放）
加密算法: MD5（hashlib.md5(str(timestamp)+b)）
运行方式: python spider_c10.py
原理:
  1) 首次 GET 详情页 -> 403，响应头 Set-Cookie 下发 __jsluid_h = "<秒级时间戳>-<b>"
  2) 取当前秒级时间戳 ts，构造 __jsl_clearance = "<ts>-<md5(str(ts)+b)>"
  3) 携带 __jsluid_h + __jsl_clearance 双 Cookie 重放 GET -> 200，解析 <table>
================================================================================
"""
import hashlib
import json
import re
import time

import requests
from lxml import html

BASE = "https://spiderbuf.cn"
URL = "https://spiderbuf.cn/challenge/scraper-practice-js-reverse-c10"
HEADERS = {
    "User-Agent": ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                   "AppleWebKit/537.36 (KHTML, like Gecko) "
                   "Chrome/126.0.0.0 Safari/537.36"),
    "Accept-Language": "zh-CN,zh;q=0.9",
}

FIELDS = ["keyword", "cpc", "monthly_search", "competition", "industry", "source"]


def solve_challenge() -> requests.Session:
    """构造 __jsl_clearance Cookie 并通过 Cloudflare 模拟校验。"""
    s = requests.Session()
    # 第 1 次请求：触发 JS Challenge，拿到 __jsluid_h
    r1 = s.get(URL, headers=HEADERS, timeout=15)
    print(f"[c10] 第1次请求状态码: {r1.status_code}")
    jsluid = s.cookies.get("__jsluid_h", "")
    if not jsluid:
        m = re.search(r"__jsluid_h=([^;]+)", r1.headers.get("Set-Cookie", ""))
        jsluid = m.group(1) if m else ""
    print(f"[c10] __jsluid_h = {jsluid}")

    if not jsluid or "-" not in jsluid:
        raise RuntimeError("未能获取 __jsluid_h，Challenge 下发异常")

    _, b = jsluid.split("-", 1)
    ts = int(time.time())
    clearance_md5 = hashlib.md5(f"{ts}{b}".encode()).hexdigest()
    clearance = f"{ts}-{clearance_md5}"
    s.cookies.set("__jsl_clearance", clearance, domain="spiderbuf.cn", path="/")
    print(f"[c10] 构造 __jsl_clearance = {clearance}")

    time.sleep(1)  # 每请求间隔 >=1s
    return s


def extract_data(s: requests.Session) -> list:
    """携带双 Cookie 重放请求，解析关键词数据表格。"""
    r2 = s.get(URL, headers=HEADERS, timeout=15)
    print(f"[c10] 第2次请求状态码: {r2.status_code}, 页面长度: {len(r2.text)}")
    if r2.status_code != 200:
        raise RuntimeError(f"通过 Challenge 失败: HTTP {r2.status_code}")

    doc = html.fromstring(r2.text)
    rows = doc.xpath('//table//tbody//tr')
    result = []
    for tr in rows:
        cells = [c.text_content().strip() for c in tr.xpath('./td')]
        if len(cells) == len(FIELDS):
            result.append(dict(zip(FIELDS, cells)))
    return result


def main():
    print("=" * 70)
    print("SpiderBuf c10 - 简单模拟 Cloudflare Challenge")
    print("=" * 70)
    s = solve_challenge()
    data = extract_data(s)
    print("-" * 70)
    print(f"[c10] 提取数据行数: {len(data)}")
    print(json.dumps(data, ensure_ascii=False, indent=2))
    print("=" * 70)
    print(f"[c10] DONE rows={len(data)}")


if __name__ == "__main__":
    main()
