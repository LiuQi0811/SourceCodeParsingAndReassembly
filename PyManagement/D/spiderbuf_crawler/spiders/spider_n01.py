# -*- coding: utf-8 -*-
"""
关卡: N01 - User-Agent与Referer校验反爬
难度: 入门 (2.0)
反爬技术: 服务端校验 User-Agent 与 Referer 请求头，缺失 Referer 直接返回 403。
运行方式: python spider_n01.py
目标数据: 中国上市公司估值榜 Top50（公司名/排名/估值(亿元)/CEO/行业）
"""
import json
import time
import requests
from lxml import etree

URL = "https://spiderbuf.cn/challenge/user-agent-referrer"
HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
                  "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    "Referer": "https://spiderbuf.cn/challenges",
}


def main():
    # 演示：不带 Referer 会被 403，这里直接使用正确请求头
    resp = requests.get(URL, headers=HEADERS, timeout=20)
    print(f"[n01] GET {URL} -> status={resp.status_code}, len={len(resp.text)}")
    resp.raise_for_status()

    root = etree.HTML(resp.text)
    # 每个卡片是一个 div.col-*，内含 1 个 h2 与 4 个 p
    cards = root.xpath('//div[contains(@class,"col-lg-4") and ./h2]')
    rows = []
    for c in cards:
        name = (c.xpath('./h2/text()') or [""])[0].strip()
        ps = [p.strip() for p in c.xpath('./p/text()')]
        if not name or len(ps) < 4:
            continue
        rows.append({
            "company": name,
            "rank": ps[0].replace("排名：", "").strip(),
            "valuation_yi": ps[1].replace("企业估值(亿元)：", "").strip(),
            "ceo": ps[2].replace("CEO：", "").strip(),
            "industry": ps[3].replace("行业：", "").strip(),
        })

    print(f"[n01] 解析到 {len(rows)} 条记录")
    print(json.dumps(rows[:5], ensure_ascii=False, indent=2))
    print("...")
    print(json.dumps(rows[-3:], ensure_ascii=False, indent=2))
    return rows


if __name__ == "__main__":
    main()
