# -*- coding: utf-8 -*-
"""
关卡: E03 - 无序号翻页
难度: 进阶
反爬技术: 无强反爬。练习点：翻页 URL 不是 ?pageno=N 这种有序参数，而是
         /challenge/scraping-random-pagination/<随机hex>，必须从页面分页导航里
         提取所有"下一页/页码"链接，再逐页访问。
运行方式: python spider_e03.py
目标数据: 中国上市公司估值榜（5 页 × 10 行 = 50 条）
"""
import json
import time
from urllib.parse import urljoin

import requests
from lxml import etree

BASE_URL = "https://spiderbuf.cn/challenge/scraping-random-pagination"
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
    # 分页导航里的所有随机链接
    page_links = root.xpath('//ul[contains(@class,"pagination")]//a/@href')
    return headers, rows, page_links


def main():
    sess = requests.Session()
    sess.headers.update(HEADERS)

    # 1) 第 1 页（基础 URL，无随机后缀）
    resp = sess.get(BASE_URL, timeout=20)
    print(f"[e03] GET {BASE_URL} -> status={resp.status_code}")
    resp.raise_for_status()
    headers, page1_rows, page_links = parse_table(resp.text)
    print(f"[e03] 表头: {headers}")
    print(f"[e03] 第 1 页 {len(page1_rows)} 行; 分页链接: {page_links}")
    time.sleep(1)

    all_rows = list(page1_rows)
    # 2) 逐页访问随机链接（去掉与第 1 页相同的 base，去重）
    seen_urls = {BASE_URL}
    for href in page_links:
        url = urljoin(BASE_URL, href)
        if url in seen_urls:
            continue
        seen_urls.add(url)
        r = sess.get(url, timeout=20)
        _, rows, _ = parse_table(r.text)
        print(f"[e03] GET {url} -> {len(rows)} 行")
        all_rows.extend(rows)
        time.sleep(1)

    print(f"[e03] 累计抓取 {len(all_rows)} 条记录")
    # 去重：分页导航第 1 个链接就是首页，会重复一页，按排名去重
    seen_rank = set()
    uniq = []
    for r in all_rows:
        if r.get("排名") in seen_rank:
            continue
        seen_rank.add(r.get("排名"))
        uniq.append(r)
    all_rows = uniq
    print(f"[e03] 去重后 {len(all_rows)} 条记录")
    print(json.dumps(all_rows[:3], ensure_ascii=False, indent=2))
    print("...")
    print(json.dumps(all_rows[-3:], ensure_ascii=False, indent=2))
    return all_rows


if __name__ == "__main__":
    main()
