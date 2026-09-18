# -*- coding: utf-8 -*-
"""
关卡: N03 - 限制访问频率不低于1秒
难度: 入门 (2.0)
反爬技术: 服务端对同一 IP 的请求频率做限制，两次请求间隔 < 1 秒会被拦截/封禁。
          必须在每次请求之间 time.sleep(1) 以上。
运行方式: python spider_n03.py
目标数据: 常见弱密码 Top200（排名/密码/破解耗时/使用数），共 20 页，每页 10 条。
"""
import time
import requests
from lxml import etree

BASE_URL = "https://spiderbuf.cn/challenge/scraper-bypass-request-limit/{}"
HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
                  "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    "Referer": "https://spiderbuf.cn/challenges",
}
MAX_PAGE = 20
SLEEP_SEC = 1.2  # 严格 >1 秒


def main():
    all_rows = []
    for page in range(1, MAX_PAGE + 1):
        url = BASE_URL.format(page)
        # 第一页前不需要 sleep；之后每页前 sleep
        if page > 1:
            time.sleep(SLEEP_SEC)
        resp = requests.get(url, headers=HEADERS, timeout=20)
        print(f"[n03] page={page} status={resp.status_code} len={len(resp.text)}", flush=True)
        if resp.status_code != 200:
            print(f"  !! 第 {page} 页异常: {resp.status_code}")
            continue

        root = etree.HTML(resp.text)
        trs = root.xpath('//table//tr')
        page_rows = []
        for tr in trs:
            tds = tr.xpath('./td')
            if not tds:
                continue  # 表头 th 跳过
            cells = [td.xpath('string(.)').strip() for td in tds]
            if len(cells) >= 4:
                page_rows.append({
                    "rank": cells[0],
                    "password": cells[1],
                    "crack_time": cells[2],
                    "use_count": cells[3],
                })
        all_rows.extend(page_rows)
        print(f"  -> 本页 {len(page_rows)} 条，累计 {len(all_rows)} 条")

    print(f"\n[n03] 共抓取 {len(all_rows)} 条弱密码")
    for r in all_rows[:5]:
        print(" ", r)
    print("  ...")
    for r in all_rows[-3:]:
        print(" ", r)
    return all_rows


if __name__ == "__main__":
    main()
