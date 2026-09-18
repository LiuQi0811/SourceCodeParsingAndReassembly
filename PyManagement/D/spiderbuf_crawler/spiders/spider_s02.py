# -*- coding: utf-8 -*-
"""
关卡: S02 - http请求分析及头构造使用
难度: 入门
反爬技术: 服务端校验 User-Agent 请求头，缺失或为 python-requests 默认 UA 时返回 403。
运行方式: python spider_s02.py
目标数据: 局域网设备信息表（与 s01 相同结构：序号/IP/MAC/设备名称/设备类型/系统/端口/状态）
"""
import json
import time

import requests
from lxml import etree

URL = "https://spiderbuf.cn/challenge/scraper-http-header"
UA_HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
                  "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
}


def main():
    # 1) 演示：不构造请求头（requests 默认 UA）会被 403 拦截
    try:
        resp_no_ua = requests.get(URL, timeout=20)
        print(f"[s02] 不带 UA -> status={resp_no_ua.status_code}, len={len(resp_no_ua.text)} (被拦截)")
    except Exception as e:
        print(f"[s02] 不带 UA 请求异常: {e}")
    time.sleep(1)

    # 2) 构造浏览器 User-Agent 后正常访问
    resp = requests.get(URL, headers=UA_HEADERS, timeout=20)
    print(f"[s02] 带 UA -> status={resp.status_code}, len={len(resp.text)}")
    resp.raise_for_status()
    time.sleep(1)

    root = etree.HTML(resp.text)
    headers = ["".join(th.xpath('.//text()')).strip()
               for th in root.xpath('//table//thead//th')]
    rows = []
    for tr in root.xpath('//table//tbody/tr'):
        cells = ["".join(td.xpath('.//text()')).strip() for td in tr.xpath('./td')]
        if len(cells) == len(headers):
            rows.append(dict(zip(headers, cells)))

    print(f"[s02] 表头: {headers}")
    print(f"[s02] 解析到 {len(rows)} 条记录")
    print(json.dumps(rows[:3], ensure_ascii=False, indent=2))
    print("...")
    print(json.dumps(rows[-2:], ensure_ascii=False, indent=2))
    return rows


if __name__ == "__main__":
    main()
