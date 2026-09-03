import asyncio
import aiohttp
import os
from bs4 import BeautifulSoup
from urllib.parse import urljoin, urlparse

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
}

# ======================【通配符配置区】======================
START_URL = "https://www.169tp.com/"
MAX_DEPTH = 3               # None=无深度限制；数字=最大深度

# 网页域名白名单：[]代表不限制；支持通配符 *.domain.com
# WEB_ALLOW = ["*.169tp.com"]
WEB_ALLOW = []            # 取消网页域名限制

# 图片域名白名单：[]代表不限制；支持通配符 *.domain.com
# IMG_ALLOW = ["*.169pp.net"]
IMG_ALLOW = []            # 取消图片域名限制

SKIP_KEYWORDS = ["thumb", "thumbnail", "logo", "icon", "small", "min"]
SAVE_DIR = "./aio_wildcard_crawl"
TXT_OUT = "img_links.txt"   # 边爬边保存图片链接
CONCURRENCY = 4
DL_CONCURRENCY = 8
MAX_PAGE_LIMIT = None        # 安全保护，调试设None关闭；生产可设200
# ==========================================================

os.makedirs(SAVE_DIR, exist_ok=True)

visited = set()
in_queue = set()    # 队列内去重，防止重复压入url
img_set = set()
lock = asyncio.Lock()
file_lock = asyncio.Lock()


def match_wildcard(hostname: str, patterns: list[str]) -> bool:
    """
    简单通配符匹配
    patterns为空列表 → 返回True(放行，不做限制)
    支持: "*.xxx.com"、"www.xxx.com"
    """
    if not patterns:
        return True
    for pat in patterns:
        if pat.startswith("*."):
            suffix = pat[2:]
            if hostname.endswith(suffix):
                return True
        else:
            if hostname == pat:
                return True
    return False


async def write_img_txt(img_url: str):
    """实时写入图片链接到txt"""
    async with file_lock:
        with open(TXT_OUT, "a", encoding="utf‑8") as f:
            f.write(img_url + "\n")


async def fetch(session: aiohttp.ClientSession, url: str):
    try:
        async with session.get(
            url,
            headers=HEADERS,
            timeout=aiohttp.ClientTimeout(total=10),
            auto_decompress=True
        ) as resp:
            if resp.status != 200:
                print(f"🟡status={resp.status} {url}")
                return None
            return await resp.read()
    except Exception as e:
        print(f"🔴fetch失败 {url} | {str(e)[:80]}")
        return None


async def worker(q: asyncio.Queue, session: aiohttp.ClientSession):
    # 扩充懒加载属性，兼容更多网站
    IMG_ATTRS = ["src", "data‑src", "data‑original", "data‑original‑src", "data‑lazy", "data‑lazy‑src"]
    while True:
        try:
            current_url, depth = await q.get()
        except asyncio.CancelledError:
            break
        try:
            async with lock:
                if current_url in visited:
                    continue
                if MAX_DEPTH is not None and depth > MAX_DEPTH:
                    continue
                if MAX_PAGE_LIMIT is not None and len(visited) >= MAX_PAGE_LIMIT:
                    continue
                visited.add(current_url)
                in_queue.discard(current_url)

            print(f"\n🌐[depth={depth}] PAGE: {current_url} | 已爬页面数:{len(visited)}")
            html_bytes = await fetch(session, current_url)
            if not html_bytes:
                continue

            soup = BeautifulSoup(html_bytes, "html.parser")
            img_tags = soup.find_all("img")
            print(f"📷本页img标签数量：{len(img_tags)}")

            # =========图片解析（通配符域名判断）=========
            for img in img_tags:
                src = None
                for attr in IMG_ATTRS:
                    if img.has_attr(attr):
                        src = img[attr]
                        break
                if not src:
                    continue
                full_img = urljoin(current_url, src)
                p_img = urlparse(full_img)
                if not p_img.scheme or p_img.scheme not in ("http", "https"):
                    continue

                img_host = p_img.netloc
                if not match_wildcard(img_host, IMG_ALLOW):
                    continue

                lower_img = full_img.lower()
                hit_skip = any(k in lower_img for k in SKIP_KEYWORDS)
                if hit_skip:
                    # print(f"🔵过滤(关键词): {full_img}") #打开看哪些被过滤
                    continue

                async with lock:
                    if full_img not in img_set:
                        img_set.add(full_img)
                        await write_img_txt(full_img)
                        print(f"🖼️[depth={depth}] IMG: {full_img}")
            # ===========================================

            # =========a标签链接提取（网页通配符域名判断）=========
            for a in soup.find_all("a"):
                href = a.get("href")
                if not href:
                    continue
                abs_href = urljoin(current_url, href)
                p_a = urlparse(abs_href)
                if p_a.scheme not in ("http", "https"):
                    continue

                page_host = p_a.netloc
                if not match_wildcard(page_host, WEB_ALLOW):
                    continue

                async with lock:
                    if abs_href not in visited and abs_href not in in_queue:
                        in_queue.add(abs_href)
                        await q.put((abs_href, depth + 1))
            # =================================================

        finally:
            q.task_done()


async def download_one(sem: asyncio.Semaphore, session: aiohttp.ClientSession, idx: int, img_url: str):
    async with sem:
        try:
            data = await fetch(session, img_url)
            if not data:
                return f"❌idx{idx} 失败 {img_url}"
            # 修复url后缀异常
            sp = img_url.split(".")
            suffix = sp[-1].split("?")[0] if len(sp) > 1 else "jpg"
            fp = os.path.join(SAVE_DIR, f"{idx}.{suffix}")
            with open(fp, "wb") as f:
                f.write(data)
            return f"✅idx{idx} 成功 {img_url}"
        except Exception as e:
            return f"❌idx{idx} {img_url} | {e}"


async def main():
    # 清空旧的txt
    if os.path.exists(TXT_OUT):
        os.remove(TXT_OUT)

    q = asyncio.Queue()
    init_item = (START_URL, 0)
    await q.put(init_item)
    in_queue.add(START_URL)

    connector = aiohttp.TCPConnector(limit=CONCURRENCY, ttl_dns_cache=300)
    async with aiohttp.ClientSession(connector=connector, auto_decompress=True) as session:
        print("🚀通配符规则异步BFS启动，边爬边输出图片链接\n")
        workers = [asyncio.create_task(worker(q, session)) for _ in range(CONCURRENCY)]
        await q.join()

        # 全部任务完成，停止worker
        for w in workers:
            w.cancel()
        await asyncio.gather(*workers, return_exceptions=True)

        print(f"\n📊BFS完成，一共收集图片: {len(img_set)}")
        if len(img_set) == 0:
            print("⚠️未捕获任何图片，退出")
            return

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
