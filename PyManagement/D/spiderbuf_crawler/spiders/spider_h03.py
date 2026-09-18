# -*- coding: utf-8 -*-
"""
关卡: H03 - 网页滚动加载的原理及爬取(JavaScript加密混淆逆向基础)
难度: 进阶 (3.0)
反爬技术: 前端滚动加载更多数据；下一页 URI 不以链接形式出现，而是藏在一个
          hidden 的随机 id div 里（每次刷新 id 都变），文本是下一页路径段。
          需逐页解析该隐藏指针，递归 GET 下一页，直到指针为空。
运行方式: python spider_h03.py
"""
import re
import time
import requests
from lxml import etree

BASE_URL = "https://spiderbuf.cn/challenge/scraping-scroll-load"
HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
                  "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    "Referer": "https://spiderbuf.cn/challenges",
}
MAX_PAGES = 15  # 安全上限
SLEEP_SEC = 1.1


def parse_info_div(info_div):
    result = {}
    for span in info_div.xpath('./span'):
        label_text = (span.text or "").strip()
        if label_text:
            key = label_text.rstrip(":").strip()
            following = span.xpath('./following::text()[1]')
            result[key] = following[0].strip() if following else ""
            continue
        inner_label = span.xpath('./span[1]/text()')
        if not inner_label:
            continue
        key = inner_label[0].strip().rstrip(":").strip()
        full = span.xpath('string(.)').strip()
        val = full.split(":", 1)[1].strip() if ":" in full else full
        result[key] = val
    return result


def extract_next_uri(root):
    """找 hidden 且 id 为随机串的 div，文本即下一页 URI。"""
    for d in root.xpath('//div[@id and @hidden]'):
        txt = (d.text or "").strip()
        if re.fullmatch(r'[0-9a-f]{8,}', txt):
            return txt
    # 兜底：非 hidden 但 id 很长的 div
    for d in root.xpath('//div[@id and string-length(@id)>=16]'):
        if d.get('id') in ('mobile-menu', 'main'):
            continue
        txt = (d.text or "").strip()
        if re.fullmatch(r'[0-9a-f]{8,}', txt):
            return txt
    return ""


def parse_page(html):
    root = etree.HTML(html)
    movies = []
    cards = root.xpath('//div[contains(@class,"col-xs-12") and .//h2 and .//img]')
    for card in cards:
        title = (card.xpath('./h2/text()') or [""])[0].strip()
        img = (card.xpath('.//img/@src') or [""])[0]
        info_div = card.xpath('./div[contains(@class,"col-xs-9")]')
        info = parse_info_div(info_div[0]) if info_div else {}
        movies.append({
            "title": title,
            "rating": info.get("豆瓣电影评分", ""),
            "director": info.get("导演", "")[:30],
            "imdb": info.get("IMDb", ""),
        })
    next_uri = extract_next_uri(root)
    return movies, next_uri


def main():
    all_movies = []
    url = BASE_URL
    for page in range(1, MAX_PAGES + 1):
        if page > 1:
            time.sleep(SLEEP_SEC)
        resp = requests.get(url, headers=HEADERS, timeout=20)
        print(f"[h03] page={page} url={url} -> {resp.status_code} len={len(resp.text)}")
        movies, next_uri = parse_page(resp.text)
        all_movies.extend(movies)
        print(f"  -> 本页 {len(movies)} 部，累计 {len(all_movies)} 部，next={next_uri!r}")
        if not next_uri:
            print("  没有下一页，结束")
            break
        url = BASE_URL + "/" + next_uri

    print(f"\n[h03] 共抓取 {len(all_movies)} 部电影，{page} 页")
    for m in all_movies[:5]:
        print(" ", m)
    print("  ...")
    for m in all_movies[-3:]:
        print(" ", m)
    return all_movies


if __name__ == "__main__":
    main()
