"""
使用示例 1：最简单的全站抓取
"""
from universal_async_spider import Config, UniversalSpider

if __name__ == "__main__":
    cfg = Config(
        start_urls=["https://books.toscrape.com/"],
        # allowed_domains 不指定时自动从 start_urls 提取
        output_dir="./demo_output",
        concurrency=20,
        delay=0.3,
        max_depth=5,
        max_retries=5,
        resume=True,
    )
    spider = UniversalSpider(cfg)
    spider.run()
