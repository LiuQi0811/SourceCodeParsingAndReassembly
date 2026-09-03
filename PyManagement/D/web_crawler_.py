import asyncio
import aiohttp
import os
from bs4 import BeautifulSoup
from urllib.parse import urljoin, urlparse

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
}

# ======================配置区======================
START_URL = "https://www.169tp.com/"
MAX_DEPTH = 3
ALLOW_WEB_DOMAIN = "www.169tp.com"
ALLOW_IMG_DOMAINS = {"pic.169pp.net"}
SKIP_KEYWORDS = ["thumb", "thumbnail", "logo", "icon", "small", "min"]
SAVE_DIR = "./aio_realtime_crawl"
CONCURRENCY = 6       # 页面并发数
DL_CONCURRENCY = 8    # 下载并发数
# =================================================

os.makedirs(SAVE_DIR, exist_ok=True)

visited = set()
img_set = set()
lock = asyncio.Lock()  # 协程锁，保护visited、img_set


async def fetch(session: aiohttp.ClientSession, url: str):
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
        print(f"🔴fetch失败 {url} | {str(e)[:80]}")
        return None


async def worker(q: asyncio.Queue, session: aiohttp.ClientSession):
    """消费队列：取出url → 请求 → 解析图片(实时打印) → 提取新链接入队"""
    while not q.empty():
        current_url, depth = await q.get()
        try:
            async with lock:
                if current_url in visited or depth > MAX_DEPTH:
                    q.task_done()
                    continue
                visited.add(current_url)

            print(f"\n🌐[depth={depth}] PAGE: {current_url}")
            html_bytes = await fetch(session, current_url)
            if not html_bytes:
                q.task_done()
                continue

            soup = BeautifulSoup(html_bytes, "html.parser")
            img_tags = soup.find_all("img")
            print(f"📷本页img标签数量：{len(img_tags)}")

            # =========实时解析图片，抓到立刻打印========
            for img in img_tags:
                src = img.get("src") or img.get("data-src") or img.get("data-original")
                if not src:
                    continue
                full_img = urljoin(current_url, src)
                p_img = urlparse(full_img)

                if p_img.netloc not in ALLOW_IMG_DOMAINS:
                    continue
                lower_img = full_img.lower()
                if any(k in lower_img for k in SKIP_KEYWORDS):
                    continue

                async with lock:
                    if full_img not in img_set:
                        img_set.add(full_img)
                        print(f"🖼️[depth={depth}] IMG: {full_img}")
            # ===========================================

            # 提取新链接放入队列
            for a in soup.find_all("a"):
                href = a.get("href")
                if not href:
                    continue
                abs_href = urljoin(current_url, href)
                p_a = urlparse(abs_href)
                if p_a.netloc == ALLOW_WEB_DOMAIN:
                    async with lock:
                        if abs_href not in visited:
                            await q.put((abs_href, depth + 1))

        finally:
            q.task_done()


async def download_one(sem: asyncio.Semaphore, session: aiohttp.ClientSession, idx: int, img_url: str):
    async with sem:
        try:
            data = await fetch(session, img_url)
            if not data:
                return f"❌idx{idx} 失败 {img_url}"
            suffix = img_url.split(".")[-1]
            fp = os.path.join(SAVE_DIR, f"{idx}.{suffix}")
            with open(fp, "wb") as f:
                f.write(data)
            return f"✅idx{idx} 成功 {img_url}"
        except Exception as e:
            return f"❌idx{idx} {img_url} | {e}"


async def main():
    q = asyncio.Queue()
    await q.put((START_URL, 0))

    connector = aiohttp.TCPConnector(limit=CONCURRENCY)
    async with aiohttp.ClientSession(connector=connector, auto_decompress=True) as session:
        print("🚀异步BFS启动，边爬边输出图片链接\n")
        # 启动多个worker协程消费队列
        workers = [asyncio.create_task(worker(q, session)) for _ in range(CONCURRENCY)]
        await q.join()

        # 全部页面处理完毕，关闭worker
        for w in workers:
            w.cancel()

        print(f"\n📊BFS完成，一共收集图片: {len(img_set)}")
        if len(img_set) == 0:
            print("⚠️未捕获任何图片，退出")
            return

        # 异步下载
        print("\n📥开始异步下载图片...")
        sem = asyncio.Semaphore(DL_CONCURRENCY)
        tasks = []
        img_list = list(img_set)
        for idx, url in enumerate(img_list):
            tasks.append(download_one(sem, session, idx, url))
        results = await asyncio.gather(*tasks)
        for r in results:
            print(r)

    print("\n🎉全部任务结束")


if __name__ == "__main__":
    asyncio.run(main())
