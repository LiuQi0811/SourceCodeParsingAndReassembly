import requests
import os
import time
from bs4 import BeautifulSoup
from collections import deque
from urllib.parse import urljoin, urlparse

headers = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
}

start_url = "https://www.169tp.com/"
visited = set()
queue = deque()
max_depth = 3   # 注意：要抓分页，深度至少3，首页→详情页→分页页
img_set = set()

allow_web_domain = "www.169tp.com"
allow_img_domains = {"pic.169pp.net"}

queue.append((start_url, 0))

while queue:
    current_url, depth = queue.popleft()
    if current_url in visited:
        continue
    if depth > max_depth:
        continue
    visited.add(current_url)

    try:
        resp = requests.get(current_url, headers=headers, timeout=6)
        soup = BeautifulSoup(resp.content, "html.parser")

        # 提取本页大图（分页页面也会执行这里，抓到分页的图片）
        for big_div in soup.find_all("div", class_="big-pic"):
            for img in big_div.find_all("img"):
                src = img.get("src") or img.get("data-src") or img.get("data-original")
                if not src:
                    continue
                full_img_url = urljoin(current_url, src)
                p_img = urlparse(full_img_url)
                if p_img.netloc in allow_img_domains:
                    if full_img_url not in img_set:
                        img_set.add(full_img_url)
                        print(f"[{depth}] 图片：{full_img_url}")

        # 把本站全部a标签入队，分页按钮<a>也会被加入队列
        for a in soup.find_all("a"):
            href = a.get("href")
            if not href:
                continue
            abs_href = urljoin(current_url, href)
            p_a = urlparse(abs_href)
            # 只入队本站网页，分页链接自动进来
            if p_a.netloc == allow_web_domain and abs_href not in visited:
                queue.append((abs_href, depth + 1))

        time.sleep(0.3)
    except Exception as e:
        print(f"页面请求失败 {current_url} → {e}")

print(f"\n收集图片总数：{len(img_set)}")

# 下载图片
save_dir = "./169tp_all_img"
os.makedirs(save_dir, exist_ok=True)
for idx, img_url in enumerate(img_set):
    try:
        r = requests.get(img_url, headers=headers, timeout=8)
        suffix = img_url.split(".")[-1]
        file_path = os.path.join(save_dir, f"{idx}.{suffix}")
        with open(file_path, "wb") as f:
            f.write(r.content)
        print(f"下载成功 {img_url}")
        time.sleep(0.2)
    except Exception as e:
        print(f"下载失败 {img_url} → {e}")
