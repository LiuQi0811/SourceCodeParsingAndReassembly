# -*- coding: utf-8 -*-
"""
关卡: S08 - http post请求的数据爬取
难度: 入门
反爬技术: 无。练习点：GET 页面只含一个隐藏表单 <form method=post><input name=level value=8>，
         必须 POST level=8 到当前 URL 才返回数据表。
运行方式: python spider_s08.py
目标数据: POST 响应中的设备表
"""
import json
import time

import requests
from lxml import etree

URL = "https://spiderbuf.cn/challenge/scraper-via-http-post"
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

    # 1) GET 外层页面，分析隐藏表单
    resp = sess.get(URL, timeout=20)
    print(f"[s08] GET {URL} -> status={resp.status_code}, len={len(resp.text)}")
    resp.raise_for_status()
    root = etree.HTML(resp.text)
    level = (root.xpath('//form//input[@name="level"]/@value') or [""])[0]
    print(f"[s08] 隐藏表单 level={level}")
    time.sleep(1)

    # 2) POST level=N 拿到数据表
    resp2 = sess.post(URL, data={"level": level}, timeout=20)
    print(f"[s08] POST level={level} -> status={resp2.status_code}, len={len(resp2.text)}")
    resp2.raise_for_status()
    headers, rows = parse_table(resp2.text)
    time.sleep(1)

    print(f"[s08] 表头: {headers}")
    print(f"[s08] POST 响应解析到 {len(rows)} 条记录")
    print(json.dumps(rows[:3], ensure_ascii=False, indent=2))
    print("...")
    print(json.dumps(rows[-2:], ensure_ascii=False, indent=2))
    return rows


if __name__ == "__main__":
    main()
