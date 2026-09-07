# -*- coding: utf-8 -*-
"""第一个爬虫：向网站发起请求，把网页保存到本地。

运行前先安装依赖：pip install requests
运行方式：python 01_first_spider.py
"""
import requests

URL = "https://quotes.toscrape.com/"  # 一个专门用于练习爬虫的网站

def main():
    resp = requests.get(URL, timeout=10)
    print("状态码:", resp.status_code)          # 200 表示成功
    print("网页编码:", resp.encoding)
    print("网页标题:", resp.text.split("<title>")[1].split("</title>")[0])

    with open("quotes.html", "w", encoding="utf-8") as f:
        f.write(resp.text)
    print("已保存到 quotes.html，用浏览器打开看看！")

if __name__ == "__main__":
    main()
