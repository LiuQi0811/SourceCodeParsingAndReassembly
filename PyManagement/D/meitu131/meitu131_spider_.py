# main.py
import asyncio, re
from core.engine import CrawlerEngine

# URL 过滤器：只抓取目标站内的内容页面
def meitu_url_filter(url: str) -> bool:
    if "meitu131.com" not in url:
        return False
    # 排除静态资源和后台路径
    exclude = re.compile(
        r"\.(css|js|woff|ttf|ico)($|\?)|"
        r"/d/|/e/class/|/e/config/|/e/data/|/e/enews/|/e/update/"
    )
    return not exclude.search(url)

CONFIG_MEMORY = {
    "queue_type": "memory",
    "parsers": ["xpath", "regex"],       # 组合使用 xpath + regex
    "concurrency": 16,
    "max_depth": 2,
    "download_dir": "downloads",
    "base_url": "https://www.meitu131.com/",
    "url_filter": meitu_url_filter,
}

CONFIG_SQLITE = {
    **CONFIG_MEMORY,
    "queue_type": "sqlite",
    "queue_kwargs": {"db_path": "meitu131_queue.db"},
}

async def crawl(config: dict):
    engine = CrawlerEngine(config)
    await engine.setup()
    await engine.seed([
        "https://www.meitu131.com/",
        "https://www.meitu131.com/meinv/",
    ])
    await engine.run()
    await engine.close()
    print("抓取完成:", engine.progress.snapshot())

if __name__ == "__main__":
    import sys
    mode = sys.argv[1] if len(sys.argv) > 1 else "memory"
    cfg = CONFIG_SQLITE if mode == "sqlite" else CONFIG_MEMORY
    asyncio.run(crawl(cfg))
















