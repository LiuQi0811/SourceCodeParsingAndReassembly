# -*- coding: utf-8 -*-
"""完整实战：爬取 books.toscrape.com 全站 50 页书籍数据，保存为 CSV。

pip install requests beautifulsoup4 lxml tqdm
python 03_book_spider.py
"""
import csv
import random
import time

import requests
from bs4 import BeautifulSoup
from tqdm import tqdm

BASE = "https://books.toscrape.com/catalogue/page-{}.html"  # 共 50 页
RATING_MAP = {"One": 1, "Two": 2, "Three": 3, "Four": 4, "Five": 5}

def parse_page(html):
    """把一页 HTML 解析成字典列表。"""
    soup = BeautifulSoup(html, "lxml")
    books = []
    for item in soup.select("article.product_pod"):
        title = item.select_one("h3 a")["title"]
        price = item.select_one("p.price_color").get_text().replace("£", "")
        stock = item.select_one("p.instock.availability").get_text(strip=True)
        rating_word = next(
            (c for c in item.select_one("p.star-rating")["class"] if c in RATING_MAP),
            None,
        )
        books.append({
            "书名": title,
            "价格(英镑)": float(price),
            "评分": RATING_MAP.get(rating_word, 0),
            "库存": stock,
        })
    return books

def main():
    session = requests.Session()
    session.headers["User-Agent"] = "Mozilla/5.0 (compatible; PythonTutorial/1.0)"

    all_books = []
    # tqdm 显示进度条；每页之间随机休息，做一个有礼貌的爬虫
    for page in tqdm(range(1, 51), desc="爬取进度"):
        resp = session.get(BASE.format(page), timeout=15)
        resp.raise_for_status()
        all_books.extend(parse_page(resp.content))
        time.sleep(random.uniform(0.5, 1.5))

    # utf-8-sig 让 Excel 打开中文不乱码
    with open("books.csv", "w", newline="", encoding="utf-8-sig") as f:
        writer = csv.DictWriter(f, fieldnames=["书名", "价格(英镑)", "评分", "库存"])
        writer.writeheader()
        writer.writerows(all_books)

    prices = [b["价格(英镑)"] for b in all_books]
    print(f"\n共抓取 {len(all_books)} 本书，已保存到 books.csv")
    print(f"平均价格 £{sum(prices) / len(prices):.2f}，最高 £{max(prices):.2f}")

if __name__ == "__main__":
    main()
