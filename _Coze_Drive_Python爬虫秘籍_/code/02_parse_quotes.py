# -*- coding: utf-8 -*-
"""用 BeautifulSoup 解析网页：抓取第一页的名言和作者。

pip install requests beautifulsoup4 lxml
python 02_parse_quotes.py
"""
import requests
from bs4 import BeautifulSoup

URL = "https://quotes.toscrape.com/"

def main():
    resp = requests.get(URL, timeout=10)
    resp.raise_for_status()   # 状态码不是 2xx 就直接抛异常，避免解析错误页面

    soup = BeautifulSoup(resp.content, "lxml")

    # 每个 <div class="quote"> 就是一条名言
    for quote in soup.select("div.quote"):
        text = quote.select_one("span.text").get_text(strip=True)
        author = quote.select_one("small.author").get_text(strip=True)
        tags = [t.get_text() for t in quote.select("a.tag")]
        print(f"{author}：{text}")
        print(f"  标签：{'、'.join(tags)}")

    # 顺带演示：提取“下一页”链接
    next_link = soup.select_one("li.next > a")
    if next_link:
        print("下一页地址:", "https://quotes.toscrape.com" + next_link["href"])

if __name__ == "__main__":
    main()
