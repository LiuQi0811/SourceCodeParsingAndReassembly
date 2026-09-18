# -*- coding: utf-8 -*-
"""
================================================================================
关卡 c05 - AES 加密及拖拽式滑块验证码反爬虫
难度: 3.5 / 5.0
反爬技术: 拖拽式滑块验证码（id=slider，校验: 终点 >207px 且 !=217px、拖拽耗时>=2s、
          轨迹点 >=2）+ AES 加密数据传输（CryptoJS，密文与密钥均内嵌混淆 JS 数组）
加密算法: AES（CryptoJS.AES.decrypt(密文, 密钥) -> Utf8 JSON）
运行方式: python spider_c05.py   （playwright + 系统 Edge, channel="msedge"）
原理（逆向自 /static/js/c05.min.js）:
  1) 打开页面，加载 crypto-js.min.js；混淆函数 _0x2d8e() 数组中 [6]=AES 密文、[31]=密钥。
  2) 用真实鼠标把 #slider 从起点拖到约 250px（>207 且 !=217），分多步、耗时 >2s，
     页面 mouseup 校验通过后自动 decrypt 并渲染航班表格。
  3) 兜底: 直接在页面上下文执行 CryptoJS.AES.decrypt(_0x2d8e()[6], _0x2d8e()[31]) 取明文。
================================================================================
"""
import json
import time
import random

from playwright.sync_api import sync_playwright

URL = "https://spiderbuf.cn/challenge/scraper-practice-c05"
UA = ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
      "AppleWebKit/537.36 (KHTML, like Gecko) "
      "Chrome/126.0.0.0 Safari/537.36")
STEALTH_JS = "Object.defineProperty(navigator, 'webdriver', {get: () => undefined});"
DRAG_DISTANCE = 250  # 必须 >207 且 !=217


def main():
    print("=" * 70)
    print("SpiderBuf c05 - AES 加密及拖拽式滑块验证码反爬虫")
    print("=" * 70)
    with sync_playwright() as p:
        browser = p.chromium.launch(channel="msedge", headless=True)
        ctx = browser.new_context(user_agent=UA, viewport={"width": 1280, "height": 800})
        ctx.add_init_script(STEALTH_JS)
        page = ctx.new_page()
        page.goto(URL, wait_until="domcontentloaded", timeout=40000)
        page.wait_for_timeout(3000)

        # 拖拽滑块
        slider = page.locator("#slider")
        box = slider.bounding_box()
        start_x = box["x"] + box["width"] / 2
        start_y = box["y"] + box["height"] / 2
        page.mouse.move(start_x, start_y)
        page.mouse.down()
        # 分段移动，模拟人类加速/减速，总耗时 >2s
        steps = 25
        for i in range(1, steps + 1):
            # 缓动：先快后慢，终点落在 DRAG_DISTANCE
            prog = i / steps
            eased = prog * (1.1 - 0.1 * prog)
            x = start_x + DRAG_DISTANCE * eased + random.uniform(-1.5, 1.5)
            y = start_y + random.uniform(-2, 2)
            page.mouse.move(x, y, steps=2)
            time.sleep(random.uniform(0.08, 0.12))
        page.mouse.up()
        print(f"[c05] 已拖拽滑块约 {DRAG_DISTANCE}px")
        page.wait_for_timeout(2500)

        # 兜底：直接在页面上下文执行 AES 解密
        plain = page.evaluate(
            "() => { const b = CryptoJS.AES.decrypt(_0x2d8e()[6], _0x2d8e()[31]);"
            " return b.toString(CryptoJS.enc.Utf8); }"
        )
        data = json.loads(plain)
        flights = data.get("flights", data)
        browser.close()

    prices = [f["price"] for f in flights]
    print("-" * 70)
    print(f"[c05] AES 解密后航班数据行数: {len(flights)}")
    print(json.dumps(flights, ensure_ascii=False, indent=2))
    print(f"[c05] price 列表: {prices}")
    print(f"[c05] price 均值: {sum(prices)/len(prices):.2f}")
    print("=" * 70)
    print(f"[c05] DONE rows={len(flights)}")


if __name__ == "__main__":
    main()
