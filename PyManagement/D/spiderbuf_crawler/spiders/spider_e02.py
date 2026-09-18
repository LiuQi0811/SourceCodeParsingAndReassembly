# -*- coding: utf-8 -*-
"""
关卡: E02 - 带验证码的登录爬取
难度: 进阶
反爬技术: 表单登录 + 图形数字验证码；需下载验证码 PNG，用 ddddocr 识别后连同
         captchaId 一起 POST 登录。凭据 admin/123456 预填在表单中。
运行方式（注意：ddddocr 依赖的编译扩展需 Python 3.12，3.14 暂无 wheel）:
    & 'E:\\Program Files\\Python312\\python.exe' spider_e02.py
    （脚本已自动把 ./pylibs312 加入 sys.path）
目标数据: 登录成功后的后台设备表
"""
import json
import os
import sys
import time

import requests
from lxml import etree

# 把本地安装的 ddddocr 依赖加入路径（仅 Python 3.12 可用）
_PYLIBS = os.path.join(os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")), "pylibs312")
if os.path.isdir(_PYLIBS):
    sys.path.insert(0, _PYLIBS)

LOGIN_PAGE = "https://spiderbuf.cn/challenge/web-scraping-with-captcha"
LOGIN_URL = "https://spiderbuf.cn/challenge/web-scraping-with-captcha/login"
LIST_URL = "https://spiderbuf.cn/challenge/web-scraping-with-captcha/list"
CAPTCHA_URL = "https://spiderbuf.cn/challenge/captcha/{cid}.png"
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


def solve_captcha(img_bytes):
    """用 ddddocr 识别数字验证码。"""
    import ddddocr
    ocr = ddddocr.DdddOcr(show_ad=False)
    return ocr.classification(img_bytes)


def main():
    sess = requests.Session()
    sess.headers.update(HEADERS)

    # 1) GET 登录页，提取预填凭据 + captchaId
    resp = sess.get(LOGIN_PAGE, timeout=20)
    print(f"[e02] GET {LOGIN_PAGE} -> status={resp.status_code}")
    resp.raise_for_status()
    root = etree.HTML(resp.text)
    username = (root.xpath('//input[@name="username"]/@value') or [""])[0]
    password = (root.xpath('//input[@name="password"]/@value') or [""])[0]
    captcha_id = (root.xpath('//input[@name="captchaId"]/@value') or [""])[0]
    print(f"[e02] username={username!r}, password={password!r}")
    time.sleep(1)

    # 2) 登录（OCR 可能识别错，失败则刷新验证码重试）
    rows, headers = [], []
    for attempt in range(1, 6):
        # 每次重试都重新 GET 登录页拿新 captchaId + 验证码图片
        rp = sess.get(LOGIN_PAGE, timeout=20)
        rp.raise_for_status()
        rroot = etree.HTML(rp.text)
        captcha_id = (rroot.xpath('//input[@name="captchaId"]/@value') or [""])[0]
        time.sleep(1)

        rc = sess.get(CAPTCHA_URL.format(cid=captcha_id), timeout=20)
        rc.raise_for_status()
        captcha_text = solve_captcha(rc.content)
        print(f"[e02] 第 {attempt} 次尝试: captchaId={captcha_id!r}, OCR={captcha_text!r}")
        time.sleep(1)

        sess.post(LOGIN_URL, data={
            "username": username,
            "password": password,
            "captchaSolution": captcha_text,
            "captchaId": captcha_id,
        }, timeout=20)
        time.sleep(1)

        # 4) GET /list 验证是否登录成功
        rl = sess.get(LIST_URL, timeout=20)
        time.sleep(1)
        hdr, rows = parse_table(rl.text)
        if rows:
            headers = hdr
            print(f"[e02] 登录成功！GET /list -> status={rl.status_code}, len={len(rl.text)}")
            break
        else:
            print(f"[e02] 第 {attempt} 次登录失败（验证码错误），重试...")
            # 失败后清空 cookie，下一轮重新开始
            sess.cookies.clear()
            time.sleep(1)
    else:
        print("[e02] 多次尝试后仍无法登录")
    print(f"[e02] 表头: {headers}")
    print(f"[e02] 登录后解析到 {len(rows)} 条记录")
    print(json.dumps(rows[:3], ensure_ascii=False, indent=2))
    print("...")
    print(json.dumps(rows[-2:], ensure_ascii=False, indent=2))
    return rows


if __name__ == "__main__":
    main()
