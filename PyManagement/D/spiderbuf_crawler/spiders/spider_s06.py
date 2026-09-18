# -*- coding: utf-8 -*-
"""
关卡: S06 - 带iframe的页面源码分析及数据爬取
难度: 入门
反爬技术: 无。练习点：数据不在外层 HTML，而在 <iframe src="/challenge/inner"> 内联页面中，
         需先从外层页提取 iframe 的 src，再单独请求该 URL 解析表格。
运行方式: python spider_s06.py
目标数据: 设备表（位于 iframe 内页 /challenge/inner）
"""
import json
import time
from urllib.parse import urljoin

import requests
from lxml import etree

OUTER_URL = "https://spiderbuf.cn/challenge/scraping-iframe"
BASE = "https://spiderbuf.cn"
HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
                  "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
}


def parse_table(html_text):
    root = etree.HTML(html_text)
    headers = ["".join(th.xpath('.//text()')).strip()
               for th in root.xpath('//table//thead//th')]
    rows = []
    for tr in root.xpath('//table//tbody/tr'):
        cells = [tr.xpath('string(td[%d])' % i).strip()
                 for i in range(1, len(headers) + 1)]
        if len(cells) == len(headers):
            rows.append(dict(zip(headers, cells)))
    return headers, rows


def main():
    sess = requests.Session()
    sess.headers.update(HEADERS)

    # 1) 外层页：找到 iframe
    resp = sess.get(OUTER_URL, timeout=20)
    print(f"[s06] 外层页 {OUTER_URL} -> status={resp.status_code}")
    resp.raise_for_status()
    time.sleep(1)

    outer = etree.HTML(resp.text)
    iframe_srcs = outer.xpath('//iframe/@src')
    print(f"[s06] 发现 iframe: {iframe_srcs}")
    if not iframe_srcs:
        print("[s06] 未找到 iframe，退出")
        return []

    # 2) 请求 iframe 内页
    inner_url = urljoin(BASE, iframe_srcs[0])
    resp2 = sess.get(inner_url, timeout=20)
    print(f"[s06] iframe 内页 {inner_url} -> status={resp2.status_code}, len={len(resp2.text)}")
    resp2.raise_for_status()
    time.sleep(1)

    headers, rows = parse_table(resp2.text)
    print(f"[s06] 表头: {headers}")
    print(f"[s06] iframe 内页解析到 {len(rows)} 条记录")
    print(json.dumps(rows[:3], ensure_ascii=False, indent=2))
    print("...")
    print(json.dumps(rows[-2:], ensure_ascii=False, indent=2))
    return rows


if __name__ == "__main__":
    main()
