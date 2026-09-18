# -*- coding: utf-8 -*-
"""
关卡: E01 - 用户名密码登录爬取后台数据
难度: 进阶
反爬技术: 表单登录，需维护 session cookie；凭据 admin/123456 预填在登录表单中。
运行方式: python spider_e01.py
目标数据: 登录成功后返回的后台设备表
"""
import json
import time

import requests
from lxml import etree

LOGIN_PAGE = "https://spiderbuf.cn/challenge/scraper-login-username-password"
LOGIN_URL = "https://spiderbuf.cn/challenge/scraper-login-username-password/login"
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
    return headers, rows


def main():
    sess = requests.Session()
    sess.headers.update(HEADERS)

    # 1) GET 登录页（拿 cookie + 预填凭据）
    resp = sess.get(LOGIN_PAGE, timeout=20)
    print(f"[e01] GET {LOGIN_PAGE} -> status={resp.status_code}")
    resp.raise_for_status()
    root = etree.HTML(resp.text)
    username = (root.xpath('//input[@name="username"]/@value') or [""])[0]
    password = (root.xpath('//input[@name="password"]/@value') or [""])[0]
    print(f"[e01] 表单凭据: username={username!r}, password={password!r}")
    time.sleep(1)

    # 2) POST 登录（session 自动带 cookie）
    resp2 = sess.post(LOGIN_URL, data={"username": username, "password": password}, timeout=20)
    print(f"[e01] POST login -> status={resp2.status_code}, len={len(resp2.text)}, "
          f"cookies={dict(sess.cookies)}")
    resp2.raise_for_status()
    time.sleep(1)

    headers, rows = parse_table(resp2.text)
    print(f"[e01] 表头: {headers}")
    print(f"[e01] 登录后解析到 {len(rows)} 条记录")
    print(json.dumps(rows[:3], ensure_ascii=False, indent=2))
    print("...")
    print(json.dumps(rows[-2:], ensure_ascii=False, indent=2))
    return rows


if __name__ == "__main__":
    main()
