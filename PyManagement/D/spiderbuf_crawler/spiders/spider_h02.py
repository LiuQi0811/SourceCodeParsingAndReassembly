# -*- coding: utf-8 -*-
"""
关卡: H02 - 高分电影列表复杂页面的解析（仿豆瓣电影）- xpath高级用法
难度: 进阶 (3.0)
反爬技术: 无明显反爬；考点是复杂 HTML 结构下的高级 xpath：
          海报+文字混排、多级 span 嵌套、文本节点分散在标签之间。
          需在 info div 内按直接 span 子节点遍历，用内层 label span 识别字段。
运行方式: python spider_h02.py
"""
import time
import requests
from lxml import etree

URL = "https://spiderbuf.cn/challenge/scraping-douban-movies-xpath-advanced"
HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
                  "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    "Referer": "https://spiderbuf.cn/challenges",
}
BASE = "https://spiderbuf.cn"


def parse_info_div(info_div):
    """解析 <div class="col-xs-9 col-lg-9"> 内的各字段 span。"""
    result = {}
    for span in info_div.xpath('./span'):
        # 第一个 span 形如: <span>豆瓣电影评分:</span> 8.9
        label_text = (span.text or "").strip()
        if label_text:
            # 形如 "豆瓣电影评分:" 或 "IMDb:"
            key = label_text.rstrip(":").strip()
            # 评分值是 span 后面的兄弟文本节点
            following = span.xpath('./following::text()[1]')
            result[key] = following[0].strip() if following else ""
            continue

        # 形如: <span><span>导演</span>: <span>克里斯托弗·诺兰</span></span>
        inner_label = span.xpath('./span[1]/text()')
        if not inner_label:
            continue
        key = inner_label[0].strip().rstrip(":").strip()
        # 冒号后的文本节点（包括跨 span 的）
        # 用 string(span) 取全部文本，再去掉 label 部分
        full = span.xpath('string(.)').strip()
        # full 形如 "导演: 克里斯托弗·诺兰"
        val = full.split(":", 1)[1].strip() if ":" in full else full
        result[key] = val
    return result


def main():
    resp = requests.get(URL, headers=HEADERS, timeout=20)
    print(f"[h02] GET {URL} -> {resp.status_code}, len={len(resp.text)}")
    resp.raise_for_status()
    root = etree.HTML(resp.text)

    cards = root.xpath('//div[contains(@class,"col-xs-12") and .//h2 and .//img]')
    rows = []
    for card in cards:
        title = (card.xpath('./h2/text()') or [""])[0].strip()
        img = (card.xpath('.//img/@src') or [""])[0]
        img_url = BASE + img if img.startswith("/") else img

        info_div = card.xpath('./div[contains(@class,"col-xs-9")]')
        info = parse_info_div(info_div[0]) if info_div else {}

        rows.append({
            "title": title,
            "rating": info.get("豆瓣电影评分", ""),
            "poster": img_url,
            "director": info.get("导演", "")[:50],
            "writer": info.get("编剧", "")[:50],
            "cast": info.get("主演", "")[:80],
            "genre": info.get("类型", ""),
            "country": info.get("制片国家/地区", ""),
            "language": info.get("语言", ""),
            "release_date": info.get("上映日期", "")[:50],
            "runtime": info.get("片长", ""),
            "alias": info.get("又名", "")[:50],
            "imdb": info.get("IMDb", ""),
        })
        time.sleep(0.0)

    print(f"\n[h02] 共解析 {len(rows)} 部电影")
    for r in rows[:3]:
        print(" ", r)
    print("  ...")
    for r in rows[-2:]:
        print(" ", r)
    return rows


if __name__ == "__main__":
    main()
