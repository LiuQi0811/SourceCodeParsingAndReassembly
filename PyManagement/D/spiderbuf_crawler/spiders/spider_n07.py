# -*- coding: utf-8 -*-
"""
关卡: N07 - 随机CSS样式类名，无Element ID
难度: 入门 (2.0)
反爬技术: 每次请求页面里的 class 名随机变化（如 TMNQrz / MvmmHC），且元素无 id，
          不能依赖固定 class 定位。需通过 DOM 结构（xpath 路径）和文本特征定位：
          题目 div 文本以 "数字.&nbsp" 开头，紧跟的下一个 div 是分类标签。
运行方式: python spider_n07.py
"""
import re
import time
import requests
from lxml import etree

URL = "https://spiderbuf.cn/challenge/random-css-classname"
HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
                  "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    "Referer": "https://spiderbuf.cn/challenges",
}


def main():
    resp = requests.get(URL, headers=HEADERS, timeout=20)
    print(f"[n07] GET {URL} -> {resp.status_code}, len={len(resp.text)}")
    resp.raise_for_status()
    root = etree.HTML(resp.text)

    # 用结构 xpath 定位：main > div > div（叶子节点，题目/分类交替）
    divs = root.xpath('//main/div/div')
    print(f"[n07] 结构定位到 {len(divs)} 个 div")

    rows = []
    pending_question = None
    for div in divs:
        text = (div.text or "").strip()
        if not text:
            continue
        # 题目：以 "数字." 开头
        if re.match(r'^\d+\.', text):
            if pending_question is not None:
                # 上一题没有分类，先存
                rows.append({"question": pending_question, "category": ""})
            pending_question = re.sub(r'^\d+\.?\s*&nbsp;?\s*', '', text).replace('\xa0', ' ').strip()
        else:
            # 分类标签
            if pending_question is not None:
                rows.append({"question": pending_question, "category": text})
                pending_question = None
            else:
                rows.append({"question": "", "category": text})
    if pending_question is not None:
        rows.append({"question": pending_question, "category": ""})

    print(f"\n[n07] 共解析 {len(rows)} 道习题")
    for r in rows[:5]:
        print(f"  [{r['category']:6s}] {r['question'][:50]}")
    print("  ...")
    for r in rows[-3:]:
        print(f"  [{r['category']:6s}] {r['question'][:50]}")
    return rows


if __name__ == "__main__":
    main()
