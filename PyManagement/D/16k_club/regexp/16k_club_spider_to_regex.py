import requests
import random
import time
import re
from urllib.parse import urljoin
BASE_URL = "https://16k.club/"


MAX_WORKERS = 3            # 并发线程（不要太大以免被封）
MIN_SLEEP = 0.5
MAX_SLEEP = 1.5
TIMEOUT = 20
MAX_RETRY = 3

USER_AGENTS = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:120.0) Gecko/20100101 Firefox/120.0",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Safari/605.1.15",
]

session = requests.Session()
session.headers.update({
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
    "Connection": "keep-alive",
})

def get_headers(referer=None):
    h = {"User-Agent": random.choice(USER_AGENTS)}
    if referer:
        h["Referer"] = referer
    return h


def fetch(url, referer=BASE_URL):
    for i in range(MAX_RETRY):
        try:
            time.sleep(random.uniform(MIN_SLEEP, MAX_SLEEP))
            r = session.get(url, headers=get_headers(referer), timeout=TIMEOUT)
            r.encoding = r.apparent_encoding or "utf-8"
            if r.status_code == 200 and len(r.text) > 1000:
                return r.text
            print(f"状态{r.status_code}或响应过短 {url} (retry {i + 1})")
        except Exception as e:
            print(f"请求异常 {url}: {e} (retry {i + 1})")
        time.sleep(2 * (i + 1))
    return None

def detect_max_page():
    first_url = f"{BASE_URL}/"
    html = fetch(first_url)
    if not html:
        return 1
    pages = re.findall(r'index\.php\?p=(\d+)&size=50', html)
    if pages:
        return max(int(p) for p in pages)
    # 没有分页则只有1页
    return 1

LIST_LINK_RE = re.compile(r'href="(/post/\d+)/"')
def parse_list_page(page):
    if page == 1:
        url = f"{BASE_URL}"
    else:
        url = f"{BASE_URL}/index.php?p={page}&size=50"
    html = fetch(url)
    if not html:
        return []
    links = set()
    for m in LIST_LINK_RE.findall(html):
        full = urljoin(BASE_URL, m)
        links.add(full)
    return list(links)

def parse_detail(url):
    html = fetch(url)
    h1 = re.search(r'<h1.*?>(.*?)</h1>' ,html)
    img_pattern = re.compile(r'data-src="(.*?)"')
    image_urls = img_pattern.findall(html)
    video_pattern = re.compile(r'<source\s+src\s*=\s*"(.*?)"')
    video_urls = video_pattern.findall(html)
    if h1:
        title = h1.group(1).strip()
        if video_urls:
            with open(title + ".mp4", "wb") as f:
                for url in video_urls:
                    f.write(requests.get(url,headers= get_headers(), timeout=TIMEOUT).content)
        if image_urls:
            with open(title + ".jpg", "wb") as f:
                for url in image_urls:
                    f.write(requests.get(url,headers= get_headers(), timeout=TIMEOUT).content)


def main():
   max_page = detect_max_page()
   for p in range(1, max_page + 1):
       links = parse_list_page(p)
       for link in links:
           parse_detail(link)

if __name__ == "__main__":
    main()