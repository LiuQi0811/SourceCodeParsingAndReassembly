# -*- coding: utf-8 -*-
"""
关卡: S01 - requests库及lxml库入门
难度: 入门
反爬技术: 无（纯静态页面，直接 GET 即可）
运行方式: python spider_s01.py
目标数据: 局域网设备信息表（序号/IP地址/MAC地址/设备名称/设备类型/操作系统/开放端口/在线状态）
"""
import json
import time

import requests
from lxml import etree

URL = "https://spiderbuf.cn/challenge/requests-lxml-for-scraping-beginner"
HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
                  "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
}


def main():
    resp = requests.get(URL, headers=HEADERS, timeout=20)
    print(f"[s01] GET {URL} -> status={resp.status_code}, len={len(resp.text)}")
    resp.raise_for_status()
    time.sleep(1)

    root = etree.HTML(resp.text)
    # 表头
    headers = ["".join(th.xpath('.//text()')).strip()
               for th in root.xpath('//table//thead//th')]
    # 数据行
    rows = []
    for tr in root.xpath('//table//tbody/tr'):
        cells = ["".join(td.xpath('.//text()')).strip() for td in tr.xpath('./td')]
        if len(cells) != len(headers):
            continue
        rows.append(dict(zip(headers, cells)))

    print(f"[s01] 表头: {headers}")
    print(f"[s01] 解析到 {len(rows)} 条设备记录")
    print(json.dumps(rows, ensure_ascii=False, indent=2))
    return rows


if __name__ == "__main__":
    main()
