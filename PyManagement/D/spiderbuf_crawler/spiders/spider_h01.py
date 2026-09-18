# -*- coding: utf-8 -*-
"""
关卡: H01 - CSS样式偏移混淆文本内容的解析与爬取
难度: 进阶 (3.0)
反爬技术: 文本被拆成单个 <i> 标签，前两个字符通过 CSS position:relative; left:±Wpx
          做水平偏移，视觉上交换了顺序（实际 DOM 顺序是 2,1,3,4...）。
          需按 DOM 顺序拼接所有 <i> 文本，再把前两个字符交换回来还原。
运行方式: python spider_h01.py
"""
import re
import time
import requests
from lxml import etree

URL = "https://spiderbuf.cn/challenge/scraping-css-confuse-offset"
HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
                  "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    "Referer": "https://spiderbuf.cn/challenges",
}


def fix_swapped(s: str) -> str:
    """前两个字符交换（DOM 顺序 vs 视觉顺序）"""
    if len(s) < 2:
        return s
    return s[1] + s[0] + s[2:]


def main():
    resp = requests.get(URL, headers=HEADERS, timeout=20)
    print(f"[h01] GET {URL} -> {resp.status_code}, len={len(resp.text)}")
    resp.raise_for_status()
    root = etree.HTML(resp.text)

    cards = root.xpath('//div[@class="container"]/div/div[contains(@class,"col-lg-4")]')
    rows = []
    for card in cards:
        h2 = card.xpath('./h2')
        if not h2:
            continue
        # h2 文本由 <i> 拼接，前两位交换
        raw_title = h2[0].xpath('string(.)')
        title = fix_swapped(raw_title)

        ps = card.xpath('./p')
        rank = (ps[0].text or "").replace("排名：", "").strip() if len(ps) > 0 else ""
        # 估值：第二个 p，内含 <i> 序列
        raw_val = ps[1].xpath('string(.)').replace("企业估值(亿元)：", "").strip() if len(ps) > 1 else ""
        valuation = fix_swapped(raw_val)
        ceo = (ps[2].text or "").replace("CEO：", "").strip() if len(ps) > 2 else ""
        industry = (ps[3].text or "").replace("行业：", "").strip() if len(ps) > 3 else ""

        rows.append({
            "company": title, "rank": rank,
            "valuation_yi": valuation, "ceo": ceo, "industry": industry,
        })
        time.sleep(0.0)

    print(f"\n[h01] 共解析 {len(rows)} 家公司")
    for r in rows[:5]:
        print(" ", r)
    print("  ...")
    for r in rows[-3:]:
        print(" ", r)
    return rows


if __name__ == "__main__":
    main()
