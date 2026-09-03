import asyncio
import aiohttp
import os
import warnings
from bs4 import BeautifulSoup, XMLParsedAsHTMLWarning
from collections import deque
from urllib.parse import urljoin, urlparse

warnings.filterwarnings("ignore", category=XMLParsedAsHTMLWarning)

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
}

START_URL = "https://www.169tp.com/"
MAX_DEPTH = 3
ALLOW_WEB_DOMAIN = "www.169tp.com"
ALLOW_IMG_DOMAIN = {"pic.169pp.net"}
SAVE_DIR = "./169tp_aio_fixed"

os.makedirs(SAVE_DIR, exist_ok=True)

visited = set()
page_items = []  # 存储 (url, depth)
img_set = set()


async def fetch(session: aiohttp.ClientSession, url: str):
    """关键：开启 auto_decompress=True，等价requests自动解压gzip/br"""
    try:
        async with session.get(
            url,
            headers=HEADERS,
            timeout=aiohttp.ClientTimeout(total=8),
            auto_decompress=True
        ) as resp:
            if resp.status != 200:
                return None
            return await resp.read()
    except Exception as e:
        print(f"[fetch fail] {url} | {str(e)[:100]}")
        return None


async def bfs_collect(session: aiohttp.ClientSession):
    """BFS收集页面链接，单协程，逻辑1:1复刻你同步版本，避免并发队列bug"""
    q = deque()
    q.append((START_URL, 0))

    while q:
        current_url, depth = q.popleft()
        if current_url in visited:
            continue
        if depth > MAX_DEPTH:
            continue
        visited.add(current_url)
        page_items.append((current_url, depth))

        html_bytes = await fetch(session, current_url)
        if not html_bytes:
            continue

        soup = BeautifulSoup(html_bytes, "html.parser")
        for a in soup.find_all("a"):
            href = a.get("href")
            if not href:
                continue
            abs_href = urljoin(current_url, href)
            p_a = urlparse(abs_href)
            # 和原版完全一致：严格等于 www.169tp.com
            if p_a.netloc == ALLOW_WEB_DOMAIN and abs_href not in visited:
                q.append((abs_href, depth + 1))

        await asyncio.sleep(0.2)


async def parse_page(session: aiohttp.ClientSession, url: str):
    """解析单个页面提取图片链接"""
    tmp = set()
    html_bytes = await fetch(session, url)
    if not html_bytes:
        return tmp
    soup = BeautifulSoup(html_bytes, "html.parser")
    for big_div in soup.find_all("div", class_="big-pic"):
        for img in big_div.find_all("img"):
            src = img.get("src") or img.get("data-src") or img.get("data-original")
            print(src)
            if not src:
                continue
            full_img = urljoin(url, src)
            p_img = urlparse(full_img)
            if p_img.netloc in ALLOW_IMG_DOMAIN:
                tmp.add(full_img)
    return tmp


async def download_one(session: aiohttp.ClientSession, sem: asyncio.Semaphore, img_url: str, idx: int):
    async with sem:
        try:
            data = await fetch(session, img_url)
            if not data:
                return f"fail {img_url}"
        except Exception as e:
            return f"fail {img_url} | {e}"

        suffix = img_url.split(".")[-1]
        fp = os.path.join(SAVE_DIR, f"{idx}.{suffix}")
        with open(fp, "wb") as f:
            f.write(data)
        return f"ok {img_url}"


async def main():
    # auto_decompress=True 全局开启解压；cookie_jar保留会话cookie
    connector = aiohttp.TCPConnector(limit=12)
    async with aiohttp.ClientSession(
        connector=connector,
        auto_decompress=True
    ) as session:
        print("BFS收集页面链接（异步单协程，复刻原版逻辑）...")
        await bfs_collect(session)
        print(f"收集页面数量：{len(page_items)}")

        # 并发解析所有页面拿图片url
        parse_sem = asyncio.Semaphore(8)
        parse_tasks = []
        for url, _ in page_items:
            async def task_fn(u):
                async with parse_sem:
                    res = await parse_page(session, u)
                    img_set.update(res)
            parse_tasks.append(asyncio.create_task(task_fn(url)))
        await asyncio.gather(*parse_tasks)

        print(f"\n收集图片总数：{len(img_set)}")
        if len(img_set) == 0:
            print("警告：0张图片，请检查网站返回内容")
            return

        # 并发下载图片
        print("开始异步下载图片...")
        dl_sem = asyncio.Semaphore(10)
        dl_tasks = []
        img_list = list(img_set)
        for idx, img_url in enumerate(img_list):
            dl_tasks.append(download_one(session, dl_sem, img_url, idx))
        results = await asyncio.gather(*dl_tasks)
        for r in results:
            print(r)

    print("\n====全部任务结束====")


if __name__ == "__main__":
    asyncio.run(main())
