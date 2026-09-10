#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
cz4k.com 轻量爬虫（无需浏览器，依赖requests）
注意：如果WAF拦截严重，请使用 cz4k_crawler.py (Playwright版本)
"""

import os
import re
import json
import time
import random
import requests
from urllib.parse import urljoin, urlparse, urldefrag
from collections import deque
from bs4 import BeautifulSoup
from datetime import datetime

# ============== 配置 ==============
BASE_URL = "https://www.cz4k.com/"
OUTPUT_DIR = "./cz4k_simple"
MAX_DEPTH = 10
DELAY_MIN = 1
DELAY_MAX = 3
TIMEOUT = 20

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
    "Accept-Encoding": "gzip, deflate, br",
    "Connection": "keep-alive",
}


class SimpleCrawler:
    def __init__(self):
        self.domain = urlparse(BASE_URL).netloc
        self.queue = deque([(BASE_URL, 0)])
        self.visited = set()
        self.session = requests.Session()
        self.session.headers.update(HEADERS)
        self.counter = 0
        os.makedirs(OUTPUT_DIR, exist_ok=True)
        
    def is_valid(self, url):
        if not url.startswith(("http://", "https://")):
            return False
        if any(ext in url.lower() for ext in [".pdf", ".zip", ".rar", ".exe", ".apk"]):
            return False
        return urlparse(url).netloc == self.domain
        
    def save_page(self, url, html):
        path = urlparse(url).path.strip("/") or "index.html"
        if "." not in path.split("/")[-1]:
            path = os.path.join(path, "index.html")
        filepath = os.path.join(OUTPUT_DIR, path)
        os.makedirs(os.path.dirname(filepath), exist_ok=True)
        with open(filepath, "w", encoding="utf-8") as f:
            f.write(html)
        return filepath
        
    def extract_links(self, html, base):
        soup = BeautifulSoup(html, "html.parser")
        links = set()
        for a in soup.find_all("a", href=True):
            href = urljoin(base, a["href"])
            href, _ = urldefrag(href)
            if self.is_valid(href):
                links.add(href)
        return links
        
    def run(self):
        print(f"开始爬取 {BASE_URL}")
        while self.queue:
            url, depth = self.queue.popleft()
            if url in self.visited or depth > MAX_DEPTH:
                continue
                
            self.visited.add(url)
            time.sleep(random.uniform(DELAY_MIN, DELAY_MAX))
            
            try:
                resp = self.session.get(url, timeout=TIMEOUT)
                if resp.status_code != 200:
                    print(f"[{resp.status_code}] {url}")
                    continue
                    
                resp.encoding = resp.apparent_encoding
                html = resp.text
                
                if "雷池" in html or "WAF" in html or "访问已被拦截" in html:
                    print(f"[WAF拦截] {url}，建议使用Playwright版本")
                    continue
                    
                filepath = self.save_page(url, html)
                self.counter += 1
                print(f"[{self.counter}] {url} -> {filepath}")
                
                for link in self.extract_links(html, url):
                    if link not in self.visited:
                        self.queue.append((link, depth + 1))
                        
            except Exception as e:
                print(f"[错误] {url}: {e}")
                
        print(f"\n完成！共爬取 {self.counter} 个页面")


if __name__ == "__main__":
    SimpleCrawler().run()
