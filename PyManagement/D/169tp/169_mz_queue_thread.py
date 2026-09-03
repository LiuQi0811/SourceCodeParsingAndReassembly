import requests
import os
import time
from bs4 import BeautifulSoup
from collections import deque
from urllib.parse import urljoin, urlparse
from concurrent.futures import ThreadPoolExecutor, as_completed

headers = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
}

start_url = "https://www.169tp.com/"
visited = set()
queue = deque()
max_depth = 3
allow_web_domain = "www.169tp.com"
allow_img_domains = {"pic.169pp.net"}

# 1. BFS收集所有待爬页面URL（只收集链接，不请求内容，速度很快）
page_url_list = []
queue.append((start_url, 0))

print("正在收集页面URL...")
while queue:
    current_url, depth = queue.popleft()
    if current_url in visited:
        continue
    if depth > max_depth:
        continue
    visited.add(current_url)
    page_url_list.append(current_url)

    try:
        resp = requests.get(current_url, headers=headers, timeout=6)
        soup = BeautifulSoup(resp.content, "html.parser")
        for a in soup.find_all("a"):
            href = a.get("href")
            if not href:
                continue
            abs_href = urljoin(current_url, href)
            p_a = urlparse(abs_href)
            if p_a.netloc == allow_web_domain and abs_href not in visited:
                queue.append((abs_href, depth + 1))
        time.sleep(0.1)
    except Exception as e:
        print(f"收集链接失败 {current_url} → {e}")

print(f"收集到待爬页面总数：{len(page_url_list)}")

# 2. 多线程解析页面，提取图片url
img_set = set()

def parse_one_page(page_url):
    """单个页面任务：请求页面，提取图片"""
    img_tmp = set()
    try:
        resp = requests.get(page_url, headers=headers, timeout=6)
        soup = BeautifulSoup(resp.content, "html.parser")
        for big_div in soup.find_all("div", class_="big-pic"):
            for img in big_div.find_all("img"):
                src = img.get("src") or img.get("data-src") or img.get("data-original")
                if not src:
                    continue
                full_img_url = urljoin(page_url, src)
                p_img = urlparse(full_img_url)
                if p_img.netloc in allow_img_domains:
                    img_tmp.add(full_img_url)
    except Exception as e:
        print(f"解析页面失败 {page_url} → {e}")
    return img_tmp

print("多线程解析页面提取图片...")
# 页面解析线程数，建议 8‑12
with ThreadPoolExecutor(max_workers=10) as executor:
    futures = [executor.submit(parse_one_page, url) for url in page_url_list]
    for fut in as_completed(futures):
        res = fut.result()
        img_set.update(res)

print(f"一共提取图片：{len(img_set)}")

# 3. 多线程下载图片
save_dir = "./169tp_multi_img"
os.makedirs(save_dir, exist_ok=True)

def download_img(img_url):
    try:
        r = requests.get(img_url, headers=headers, timeout=8)
        suffix = img_url.split(".")[-1].lower()
        filename = f"{hash(img_url)}.{suffix}"
        file_path = os.path.join(save_dir, filename)
        with open(file_path, "wb") as f:
            f.write(r.content)
        return f"ok {img_url}"
    except Exception as e:
        return f"fail {img_url} | {e}"

print("开始多线程下载图片...")
# 下载线程建议 10‑15
with ThreadPoolExecutor(max_workers=12) as executor:
    futures = [executor.submit(download_img, url) for url in img_set]
    for fut in as_completed(futures):
        print(fut.result())

print("全部任务完成")
