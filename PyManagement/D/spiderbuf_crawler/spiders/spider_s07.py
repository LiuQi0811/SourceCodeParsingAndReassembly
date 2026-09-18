# -*- coding: utf-8 -*-
"""
关卡: S07 - ajax动态加载数据的爬取
难度: 入门
反爬技术: 无强反爬。练习点：表格数据不在初始 HTML，而是页面加载后通过
         fetch("/challenge/iplist") 异步请求 JSON 接口再渲染；直接请求该接口即可。
运行方式: python spider_s07.py
目标数据: 设备 JSON 列表（ip/mac/name/type/manufacturer/ports/status）
"""
import json
import time

import requests

PAGE_URL = "https://spiderbuf.cn/challenge/scraping-ajax-api"
API_URL = "https://spiderbuf.cn/challenge/iplist"
HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
                  "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    "Referer": PAGE_URL,
    "X-Requested-With": "XMLHttpRequest",
}


def main():
    sess = requests.Session()
    sess.headers.update(HEADERS)

    # 1) 先 GET 外层页面（建立会话/Referer）
    resp = sess.get(PAGE_URL, timeout=20)
    print(f"[s07] 外层页 {PAGE_URL} -> status={resp.status_code}")
    resp.raise_for_status()
    time.sleep(1)

    # 2) 调用 AJAX 接口拿 JSON
    resp2 = sess.get(API_URL, timeout=20)
    print(f"[s07] AJAX 接口 {API_URL} -> status={resp2.status_code}, "
          f"content-type={resp2.headers.get('Content-Type')}")
    resp2.raise_for_status()
    # 关键：服务端未声明 charset，requests 默认按 ISO-8859-1 解码会乱码，
    # 这里强制按 UTF-8 解码后再 json.loads
    resp2.encoding = "utf-8"
    data = resp2.json()
    time.sleep(1)

    print(f"[s07] 接口返回 {len(data)} 条 JSON 记录")
    print(f"[s07] 字段: {list(data[0].keys()) if data else []}")
    print(json.dumps(data[:3], ensure_ascii=False, indent=2))
    print("...")
    print(json.dumps(data[-2:], ensure_ascii=False, indent=2))
    return data


if __name__ == "__main__":
    main()
