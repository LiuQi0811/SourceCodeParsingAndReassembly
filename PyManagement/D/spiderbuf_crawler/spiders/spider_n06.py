# -*- coding: utf-8 -*-
"""
关卡: N06 - 网页表单爬取（RPA初阶）
难度: 入门 (2.0)
反爬技术: 无明显反爬；考点是识别并解析 HTML 表单中各类控件的默认值：
          text/password/email/url/date/time/number/range/color/search 等 input 的 value、
          radio/checkbox 的 checked 状态、select 中 option 的 selected、textarea 文本、
          以及 ul.items 中带 active 类的导航项。
运行方式: python spider_n06.py
"""
import time
import requests
from lxml import etree

URL = "https://spiderbuf.cn/challenge/scraping-form-rpa"
HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
                  "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    "Referer": "https://spiderbuf.cn/challenges",
}


def main():
    resp = requests.get(URL, headers=HEADERS, timeout=20)
    print(f"[n06] GET {URL} -> {resp.status_code}, len={len(resp.text)}")
    resp.raise_for_status()
    root = etree.HTML(resp.text)

    result = {}

    # 1) 普通 input 的 value
    for inp in root.xpath('//input[@name]'):
        name = inp.get("name", "")
        itype = inp.get("type", "text")
        if itype in ("radio", "checkbox"):
            continue  # 单独处理
        result[name] = {"type": itype, "value": inp.get("value", "")}

    # 2) radio checked
    gender = []
    for inp in root.xpath('//input[@type="radio" and @checked]'):
        gender.append(inp.get("value", ""))
    if gender:
        result["gender"] = {"type": "radio", "value": gender[0]}

    # 3) checkbox checked
    interests = [inp.get("value", "") for inp in root.xpath('//input[@type="checkbox" and @checked]')]
    result["interest"] = {"type": "checkbox", "value": interests}

    # 4) select selected option
    for sel in root.xpath('//select[@name]'):
        name = sel.get("name")
        opt = sel.xpath('./option[@selected]')
        if opt:
            result[name] = {"type": "select", "value": opt[0].get("value", opt[0].text or "")}

    # 5) textarea
    for ta in root.xpath('//textarea[@name]'):
        result[ta.get("name")] = {"type": "textarea", "value": (ta.text or "").strip()[:60] + "..."}

    # 6) ul.items 中 active 项
    active = []
    for a in root.xpath('//ul[contains(@class,"items")]/li/a[contains(@class,"active")]'):
        active.append((a.text or "").strip())
    if active:
        result["active_nav"] = {"type": "nav", "value": active}

    print("\n[n06] 表单字段解析结果:")
    for k, v in result.items():
        print(f"  {k:12s} ({v['type']:9s}): {v['value']}")

    print(f"\n[n06] 共 {len(result)} 个字段")
    return result


if __name__ == "__main__":
    main()
