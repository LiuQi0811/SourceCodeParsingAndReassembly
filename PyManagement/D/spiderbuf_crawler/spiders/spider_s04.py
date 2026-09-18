# -*- coding: utf-8 -*-
"""
关卡: S04 - 分页参数分析及翻页爬取
难度: 入门
反爬技术: 无。练习点：URL 查询参数 ?pageno=N 翻页，需从分页导航自动提取最大页码后逐页抓取。
运行方式: python spider_s04.py
目标数据: 局域网设备表，共 5 页 × 10 行 = 50 条
"""
import json
import time
from urllib.parse import urljoin

import requests
from lxml import etree

BASE_URL = "https://spiderbuf.cn/challenge/web-pagination-scraper"
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
    # 最大页码：从分页导航里取所有数字链接
    page_nos = []
    for a in root.xpath('//ul[contains(@class,"pagination")]//a'):
        txt = ''.join(a.xpath('.//text()')).strip()
        if txt.isdigit():
            page_nos.append(int(txt))
    max_page = max(page_nos) if page_nos else 1
    return headers, rows, max_page


def main():
    sess = requests.Session()
    sess.headers.update(HEADERS)

    # 第 1 页：顺带探测最大页码
    resp = sess.get(BASE_URL, timeout=20)
    print(f"[s04] GET {BASE_URL} -> status={resp.status_code}")
    resp.raise_for_status()
    headers, page1_rows, max_page = parse_table(resp.text)
    print(f"[s04] 表头: {headers}")
    print(f"[s04] 共 {max_page} 页，第 1 页 {len(page1_rows)} 行")
    time.sleep(1)

    all_rows = list(page1_rows)
    for p in range(2, max_page + 1):
        resp = sess.get(BASE_URL, params={"pageno": p}, timeout=20)
        _, rows, _ = parse_table(resp.text)
        print(f"[s04] 第 {p} 页 -> {len(rows)} 行")
        all_rows.extend(rows)
        time.sleep(1)

    print(f"[s04] 累计抓取 {len(all_rows)} 条记录")
    print(json.dumps(all_rows[:3], ensure_ascii=False, indent=2))
    print("...")
    print(json.dumps(all_rows[-3:], ensure_ascii=False, indent=2))
    return all_rows


if __name__ == "__main__":
    main()
