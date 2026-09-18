# -*- coding: utf-8 -*-
"""
关卡: N05 - CSS Sprites（雪碧图）反爬
难度: 入门 (2.0)
反爬技术: 数字不直接以文本显示，而是把 0-9 十个字符拼在一张 PNG 雪碧图上，
          通过 CSS background-position 偏移来"裁剪"显示对应字符。
          每个估值是一串 <span class="sprite xxx">，需解析 CSS 中各 class 的
          background-position-x，按从左到右排序映射到雪碧图上的字符。
          雪碧图内容（人工/视觉确认一次）: "7296481530"
运行方式: python spider_n05.py
"""
import re
import time
import requests
from lxml import etree

URL = "https://spiderbuf.cn/challenge/css-sprites"
HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
                  "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    "Referer": "https://spiderbuf.cn/challenges",
}
# 雪碧图从左到右排列的字符（已通过解码 PNG 视觉确认）
SPRITE_STRING = "7296481530"


def main():
    resp = requests.get(URL, headers=HEADERS, timeout=20)
    print(f"[n05] GET {URL} -> {resp.status_code}, len={len(resp.text)}")
    resp.raise_for_status()
    html = resp.text

    # 1) 解析内联 CSS：.xxx { background-position: Xpx 0px; }
    css_pos = dict(re.findall(
        r'\.([A-Za-z0-9_-]+)\s*\{\s*background-position:\s*(-?\d+)px\s+0px', html))
    # 按 position-x 降序（0 最左，-106 最右），映射到 SPRITE_STRING 的第 i 个字符
    # 原理: background-position: -Xpx 表示雪碧图左移 Xpx，露出 sprite 上 x=X 处的字符
    sorted_classes = sorted(css_pos.keys(), key=lambda c: int(css_pos[c]), reverse=True)
    class_to_digit = {cls: SPRITE_STRING[i] for i, cls in enumerate(sorted_classes)}
    print(f"[n05] 雪碧图映射:")
    for cls in sorted_classes:
        print(f"    .{cls:10s} pos={css_pos[cls]:>4s}px -> {class_to_digit[cls]}")

    # 2) 解析页面：每个公司卡片 div[style="margin-bottom:30px;"]，h2 公司名，p/span 数字串
    root = etree.HTML(html)
    cards = root.xpath('//div[@style="margin-bottom: 30px;"]')
    rows = []
    for card in cards:
        h2 = card.xpath('./h2/text()')
        if not h2:
            continue
        company = h2[0].strip()
        spans = card.xpath('./p/span[@class]')
        digits = []
        for s in spans:
            cls = (s.get("class") or "").strip().replace("sprite", "").strip()
            digits.append(class_to_digit.get(cls, "?"))
        valuation = "".join(digits)
        rows.append({"company": company, "valuation_yi": valuation})
        time.sleep(0.0)
        print(f"  {company:20s} 估值(亿元)={valuation}")

    print(f"\n[n05] 共解析 {len(rows)} 家公司估值")
    return rows


if __name__ == "__main__":
    main()
