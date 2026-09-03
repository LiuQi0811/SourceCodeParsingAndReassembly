import requests
import os
import time
from bs4 import BeautifulSoup
from collections import deque
from urllib.parse import urljoin, urlparse
from concurrent.futures import ThreadPoolExecutor, as_completed

headers = {
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
}

# ======================【可配置区域】======================
start_url = "https://www.169tp.com/"
max_depth = 3
allow_web_domain = "www.169tp.com"
allow_img_domains = {"pic.169pp.net"}
skip_keywords = ["thumb", "thumbnail", "logo", "icon", "small", "min"]
save_dir = "./crawl_general_img"
# =========================================================

visited = set()
queue = deque()
img_set = set()
page_url_list = []

queue.append((start_url, 0))

print("🔍 BFS收集全站页面链接开始...\n")
while queue:
    current_url, depth = queue.popleft()
    if current_url in visited:
        continue
    if depth > max_depth:
        continue
    visited.add(current_url)
    page_url_list.append((current_url, depth))
    print(f"[BFS] depth={depth} 抓取页面: {current_url}")

    try:
        resp = requests.get(current_url, headers=headers, timeout=6)
        soup = BeautifulSoup(resp.content, "html.parser")

        # 提取站内链接入队列
        for a in soup.find_all("a"):
            href = a.get("href")
            if not href:
                continue
            abs_href = urljoin(current_url, href)
            p_a = urlparse(abs_href)
            if p_a.netloc == allow_web_domain and abs_href not in visited:
                queue.append((abs_href, depth + 1))

        time.sleep(0.05)
    except Exception as e:
        print(f"❌[BFS失败] {current_url} → {e}")

print(f"\n✅BFS完成，待解析页面总数：{len(page_url_list)}")


def parse_page_task(item):
    url, depth = item
    tmp_img = set()
    try:
        resp = requests.get(url, headers=headers, timeout=6)
        soup = BeautifulSoup(resp.content, "html.parser")

        for img in soup.find_all("img"):
            src = img.get("src") or img.get("data-src") or img.get("data-original")
            if not src:
                continue
            full_img_url = urljoin(url, src)
            p_img = urlparse(full_img_url)

            if p_img.netloc not in allow_img_domains:
                continue

            lower_url = full_img_url.lower()
            if any(k in lower_url for k in skip_keywords):
                continue

            tmp_img.add(full_img_url)
            print(f"🖼️[depth={depth}] 抓到图片: {full_img_url}")

        print(f"📄页面 {url} 本页筛选得到图片数量: {len(tmp_img)}")

    except Exception as e:
        print(f"⚠️解析页面失败 {url} → {e}")
    return tmp_img


print("\n🚀多线程解析页面提取图片链接...\n")
with ThreadPoolExecutor(max_workers=8) as executor:
    futures = [executor.submit(parse_page_task, page) for page in page_url_list]
    for f in as_completed(futures):
        res = f.result()
        img_set.update(res)

print(f"\n🖼️全部筛选后待下载图片总数：{len(img_set)}")
if len(img_set) == 0:
    print("⚠️没有抓取到任何图片，请检查域名白名单、skip_keywords！")
    exit(0)

os.makedirs(save_dir, exist_ok=True)


def download_task(args):
    idx, img_url = args
    try:
        r = requests.get(img_url, headers=headers, timeout=8)
        suffix = img_url.split(".")[-1]
        file_path = os.path.join(save_dir, f"{idx}.{suffix}")
        with open(file_path, "wb") as f:
            f.write(r.content)
        return f"✅下载成功 idx={idx} {img_url}"
    except Exception as e:
        return f"❌下载失败 idx={idx} {img_url} → {e}"


print("\n📥开始多线程下载图片...\n")
task_args = [(i, u) for i, u in enumerate(img_set)]
with ThreadPoolExecutor(max_workers=10) as executor:
    futures = [executor.submit(download_task, arg) for arg in task_args]
    for f in as_completed(futures):
        print(f.result())

print("\n🎉====全部任务完成====")
