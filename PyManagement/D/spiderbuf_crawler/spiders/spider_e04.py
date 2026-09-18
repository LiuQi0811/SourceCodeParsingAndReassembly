# -*- coding: utf-8 -*-
"""
关卡: E04 - 被屏蔽IP后使用代理服务器爬取页面
难度: 进阶
反爬技术: 分页导航里混入一个"陷阱"链接（class="item trap"，标成第 6 页），
         点击它会把当前 IP 拉黑返回 403；真实只有 5 页。需：
         1) 解析分页时过滤掉 class 含 trap 的链接；
         2) 一旦被封，通过 requests 的 proxies 参数切换代理出口 IP。
运行方式: python spider_e04.py
目标数据: 中国上市公司估值榜（真实 5 页 × 10 行 = 50 条；陷阱页"6"禁止访问）
"""
import json
import time
from urllib.parse import urljoin

import requests
from lxml import etree

BASE_URL = "https://spiderbuf.cn/challenge/block-ip-proxy"
HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
                  "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
}
# 代理配置：本机未被封时留空字典直连；若触发 403，填入可用代理，例如：
# PROXIES = {"http": "http://127.0.0.1:7890", "https": "http://127.0.0.1:7890"}
PROXIES = {}


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
    # 分页链接：只取 class="item"，跳过 class="item trap" 的陷阱页
    page_links = []
    for a in root.xpath('//ul[contains(@class,"pagination")]//a'):
        cls = (a.get('class') or "")
        href = a.get('href', "")
        label = ''.join(a.xpath('.//text()')).strip()
        if 'trap' in cls:
            print(f"[e04] 跳过陷阱链接: label={label!r} class={cls!r} href={href}")
            continue
        page_links.append(href)
    return headers, rows, page_links


def main():
    sess = requests.Session()
    sess.headers.update(HEADERS)
    if PROXIES:
        sess.proxies.update(PROXIES)
        print(f"[e04] 使用代理: {PROXIES}")

    # 1) 第 1 页
    resp = sess.get(BASE_URL, timeout=20)
    print(f"[e04] GET {BASE_URL} -> status={resp.status_code}, len={len(resp.text)}")
    resp.raise_for_status()
    headers, page1_rows, page_links = parse_table(resp.text)
    print(f"[e04] 表头: {headers}")
    print(f"[e04] 第 1 页 {len(page1_rows)} 行; 真实分页链接: {page_links}")
    time.sleep(1)

    all_rows = list(page1_rows)
    seen = {BASE_URL}
    for href in page_links:
        url = urljoin(BASE_URL, href)
        if url in seen:
            continue
        seen.add(url)
        try:
            r = sess.get(url, timeout=20)
            if r.status_code == 403:
                print(f"[e04] GET {url} -> 403 IP 被封！请配置 PROXIES 后重试")
                break
            _, rows, _ = parse_table(r.text)
            print(f"[e04] GET {url} -> status={r.status_code}, {len(rows)} 行")
            all_rows.extend(rows)
        except requests.RequestException as e:
            print(f"[e04] GET {url} 异常: {e}")
        time.sleep(1)

    # 按排名去重（首页链接可能与第 1 个分页链接重复）
    seen_rank = set()
    uniq = []
    for r in all_rows:
        if r.get("排名") in seen_rank:
            continue
        seen_rank.add(r.get("排名"))
        uniq.append(r)
    print(f"[e04] 共抓取 {len(all_rows)} 行，去重后 {len(uniq)} 条记录")
    print(json.dumps(uniq[:3], ensure_ascii=False, indent=2))
    print("...")
    print(json.dumps(uniq[-3:], ensure_ascii=False, indent=2))
    return uniq


if __name__ == "__main__":
    main()
