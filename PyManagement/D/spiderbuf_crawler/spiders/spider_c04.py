# -*- coding: utf-8 -*-
"""
================================================================================
关卡 c04 - 用户行为检测反爬虫
难度: 3.5 / 5.0
反爬技术: 用户行为检测（checkCaptcha 要求: navigator.webdriver 为假 且
          #captcha_container 上记录到 >=10 个不同的 mousemove 坐标点）
加密算法: 无数据加密，纯行为对抗
运行方式: python spider_c04.py   （playwright + 系统 Edge, channel="msedge"）
原理（逆向自 /static/js/lhY3nm7.min.js）:
  页面给 #captcha_container 绑定 mousemove 监听，记录坐标到 pathMap；点击 #captcha
  触发 checkCaptcha()：若 navigator.webdriver 为真 或 pathMap 点数 <10 则拒绝出数据。
  因此: ①用 add_init_script 把 navigator.webdriver 伪装成 undefined；
        ②鼠标在 #captcha_container 上移动出 10+ 个不同坐标；③再点击复选框。
================================================================================
"""
import re
import time
import random

from playwright.sync_api import sync_playwright

URL = "https://spiderbuf.cn/challenge/scraper-practice-c04"
UA = ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
      "AppleWebKit/537.36 (KHTML, like Gecko) "
      "Chrome/126.0.0.0 Safari/537.36")

# 隐藏 navigator.webdriver 自动化标记
STEALTH_JS = "Object.defineProperty(navigator, 'webdriver', {get: () => undefined});"


def parse_stats(page) -> list:
    cards = page.locator('//div[@class="stats"]')
    n = cards.count()
    results = []
    for i in range(n):
        spans = cards.nth(i).locator("span")
        s0 = spans.nth(0).text_content() or ""
        s3 = spans.nth(3).text_content() if spans.count() > 3 else ""
        d0 = int(re.findall(r"\d+", s0)[0]) if re.findall(r"\d+", s0) else 0
        d3 = int("".join(re.findall(r"\d+", s3))) if re.findall(r"\d+", s3) else 0
        results.append({"span0": s0.strip(), "span3": s3.strip(), "sum": d0 + d3})
    return results


def main():
    print("=" * 70)
    print("SpiderBuf c04 - 用户行为检测反爬虫")
    print("=" * 70)
    with sync_playwright() as p:
        browser = p.chromium.launch(channel="msedge", headless=True)
        ctx = browser.new_context(user_agent=UA, viewport={"width": 1280, "height": 800})
        ctx.add_init_script(STEALTH_JS)
        page = ctx.new_page()
        page.goto(URL, wait_until="domcontentloaded", timeout=40000)
        page.wait_for_timeout(3000)

        # 在 #captcha_container 上方移动鼠标，产生 10+ 个不同 mousemove 坐标
        box = page.locator("#captcha_container").bounding_box()
        if box:
            for _ in range(18):
                x = box["x"] + random.uniform(5, box["width"] - 5)
                y = box["y"] + random.uniform(5, box["height"] - 5)
                page.mouse.move(x, y, steps=3)
                time.sleep(0.05)

        # 点击验证码复选框
        page.locator("#captcha").click()
        print("[c04] 已在 captcha_container 上模拟鼠标移动并点击 #captcha")
        page.wait_for_timeout(3000)

        results = parse_stats(page)
        browser.close()

    print("-" * 70)
    print(f"[c04] 统计卡片数量: {len(results)}")
    for r in results:
        print("  ", r)
    if results:
        avg = round(sum(r["sum"] for r in results) / len(results), 2)
        print(f"[c04] 卡片数字之和的平均值: {avg}")
    print("=" * 70)
    print(f"[c04] DONE rows={len(results)}")


if __name__ == "__main__":
    main()
