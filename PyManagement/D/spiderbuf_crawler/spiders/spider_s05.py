# -*- coding: utf-8 -*-
"""
关卡: S05 - 网页图片的爬取及本地保存
难度: 入门
反爬技术: 无。练习点：xpath 提取 img/@src，拼接绝对 URL，以二进制方式下载并保存到本地目录。
运行方式: python spider_s05.py
目标数据: 6 张练习图片（/static/images/beginner/*.jpg），保存到 output/s05_images/
"""
import os
import time
from urllib.parse import urljoin

import requests
from lxml import etree

PAGE_URL = "https://spiderbuf.cn/challenge/scraping-images-from-web"
BASE = "https://spiderbuf.cn"
SAVE_DIR = os.path.join(os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")), "output", "s05_images")
HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
                  "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
}


def main():
    os.makedirs(SAVE_DIR, exist_ok=True)

    sess = requests.Session()
    sess.headers.update(HEADERS)

    resp = sess.get(PAGE_URL, timeout=20)
    print(f"[s05] GET {PAGE_URL} -> status={resp.status_code}, len={len(resp.text)}")
    resp.raise_for_status()
    time.sleep(1)

    root = etree.HTML(resp.text)
    srcs = root.xpath('//img/@src')
    print(f"[s05] 发现 {len(srcs)} 张图片")

    saved = []
    for src in srcs:
        abs_url = urljoin(BASE, src)
        fname = os.path.basename(src) or f"img_{len(saved)+1}.jpg"
        save_path = os.path.join(SAVE_DIR, fname)

        r = sess.get(abs_url, timeout=30)
        r.raise_for_status()
        with open(save_path, "wb") as f:
            f.write(r.content)
        size = os.path.getsize(save_path)
        print(f"[s05] 下载 {abs_url} -> {save_path} ({size} bytes)")
        saved.append({"url": abs_url, "file": save_path, "size_bytes": size})
        time.sleep(1)

    print(f"[s05] 共保存 {len(saved)} 张图片到 {SAVE_DIR}")
    for s in saved:
        print("  -", os.path.basename(s["file"]), s["size_bytes"], "bytes")
    return saved


if __name__ == "__main__":
    main()
