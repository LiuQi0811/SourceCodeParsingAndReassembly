# -*- coding: utf-8 -*-
"""
关卡: N04 - CSS伪元素反爬
难度: 入门 (2.0)
反爬技术: 评分通过 CSS ::before / ::after 伪元素的 content 属性注入真实数字，
          页面上直接可见的 <span class="rbmsak">8.6</span> 是白字(#f8fafc)诱饵。
          真实评分 = span 第一个 class 的 ::before 内容 + "." + 第二个 class 的 ::after 内容。
          需解析 <style> 块，建立 class::before/after -> content 的映射表。
运行方式: python spider_n04.py
"""
import re
import time
import requests
from lxml import etree

URL = "https://spiderbuf.cn/challenge/css-pseudo-elements"
HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
                  "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    "Referer": "https://spiderbuf.cn/challenges",
}


def build_pseudo_map(css_text: dict) -> dict:
    """从 <style> 文本解析 .xxx::before/::after { content: "y"; } 映射。"""
    mapping = {}
    # 匹配 .class::before { content: "7"; } 形式
    pat = re.compile(r'\.([A-Za-z0-9_-]+)::(before|after)\s*\{\s*content\s*:\s*"([^"]*)"\s*;?\s*\}')
    for m in pat.finditer(css_text):
        cls, pseudo, content = m.group(1), m.group(2), m.group(3)
        mapping[f"{cls}::{pseudo}"] = content
    return mapping


def main():
    resp = requests.get(URL, headers=HEADERS, timeout=20)
    print(f"[n04] GET {URL} -> {resp.status_code}, len={len(resp.text)}")
    resp.raise_for_status()
    html = resp.text

    # 1) 解析内联 style 块，建立伪元素映射
    style_text = "\n".join(re.findall(r'<style[^>]*>(.*?)</style>', html, re.S))
    pseudo_map = build_pseudo_map(style_text)
    print(f"[n04] 解析到伪元素映射 {len(pseudo_map)} 条")
    for k, v in list(pseudo_map.items())[:6]:
        print(f"    {k} -> {v}")

    root = etree.HTML(html)
    # 2) 每个电影卡片是一个含 h2 标题的 grid div
    cards = root.xpath('//div[contains(@class,"grid") and .//h2]')
    results = []
    for card in cards:
        h2 = card.xpath('./h2/text()')
        if not h2:
            continue
        title = h2[0].strip()
        # 找评分 span：class 含两个短伪元素类名，且文本是 "."
        rating_span = None
        for span in card.xpath('.//span[@class]'):
            cls = (span.get('class') or '').strip()
            text = (span.text or '').strip()
            parts = cls.split()
            if text == '.' and len(parts) == 2 and re.fullmatch(r'[a-z]{5,8}', parts[0]):
                rating_span = (span, parts)
                break
        if not rating_span:
            continue
        span, parts = rating_span
        int_part = pseudo_map.get(f"{parts[0]}::before", "?")
        dec_part = pseudo_map.get(f"{parts[1]}::after", "?")
        real_rating = f"{int_part}.{dec_part}"
        # 诱饵评分
        decoys = card.xpath('.//span[@class="rbmsak"]/text()')
        decoy = decoys[0].strip() if decoys else ""
        results.append({
            "title": title,
            "real_rating": real_rating,
            "decoy_rating": decoy,
        })
        time.sleep(0.0)  # 单页，无需 sleep；保持节奏
        print(f"  {title:40s} 真实评分={real_rating}  诱饵={decoy}")

    print(f"\n[n04] 共解析 {len(results)} 部电影评分")
    return results


if __name__ == "__main__":
    main()
