# -*- coding: utf-8 -*-
"""动态页面：用 Playwright 操控真实浏览器抓取 JS 渲染的内容。

安装（只需一次）：
    pip install playwright
    playwright install chromium

python 07_playwright_demo.py
"""
from playwright.sync_api import sync_playwright

URL = "https://quotes.toscrape.com/js/"  # 这个页面由 JavaScript 渲染，requests 抓不到

def main():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)   # 无头模式：不弹窗口
        page = browser.new_page()
        page.goto(URL, wait_until="networkidle")

        quotes = page.locator("div.quote")
        print(f"共找到 {quotes.count()} 条名言\n")

        for i in range(min(5, quotes.count())):
            q = quotes.nth(i)
            text = q.locator("span.text").inner_text()
            author = q.locator("small.author").inner_text()
            print(f"{author}：{text}")

        browser.close()

if __name__ == "__main__":
    main()
