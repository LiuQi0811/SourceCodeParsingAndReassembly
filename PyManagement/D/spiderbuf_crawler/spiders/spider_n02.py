# -*- coding: utf-8 -*-
"""
关卡: N02 - 使用Base64编码的图片爬取与解码还原
难度: 入门 (2.0)
反爬技术: 图片不以 URL 形式给出，而是以 data:image/png;base64,... 内嵌在 HTML 中，
          需从 img[@src] 中取出 base64 串并解码还原为二进制 PNG。
运行方式: python spider_n02.py
输出: 控制台打印图片信息，并在 ./output/n02.png 保存还原后的图片。
"""
import base64
import os
import re
import time
import requests
from lxml import etree

URL = "https://spiderbuf.cn/challenge/scraping-images-base64"
HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
                  "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    "Referer": "https://spiderbuf.cn/challenges",
}
OUT_DIR = os.path.join(os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")), "output")


def main():
    os.makedirs(OUT_DIR, exist_ok=True)
    resp = requests.get(URL, headers=HEADERS, timeout=20)
    print(f"[n02] GET {URL} -> status={resp.status_code}, len={len(resp.text)}")
    resp.raise_for_status()

    root = etree.HTML(resp.text)
    srcs = root.xpath('//img/@src')
    print(f"[n02] 页面共发现 {len(srcs)} 个 img")

    saved = []
    for idx, src in enumerate(srcs):
        m = re.match(r'data:image/(\w+);base64,(.+)', src, re.S)
        if not m:
            print(f"  [{idx}] 非 base64 内嵌图片，跳过: {src[:60]}...")
            continue
        ext, b64 = m.group(1), m.group(2)
        # 去掉 base64 串中可能的换行/空白
        b64_clean = re.sub(r'\s+', '', b64)
        raw = base64.b64decode(b64_clean)
        fname = f"n02_{idx}.{ext}"
        fpath = os.path.join(OUT_DIR, fname)
        with open(fpath, "wb") as f:
            f.write(raw)
        saved.append({"index": idx, "ext": ext, "bytes": len(raw), "path": fpath})
        print(f"  [{idx}] 解码成功: {len(raw)} bytes -> {fpath}")
        time.sleep(1)  # 限速

    print("[n02] 还原完成:")
    for s in saved:
        print(" ", s)
    return saved


if __name__ == "__main__":
    main()
