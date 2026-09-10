#!/usr/bin/env python3
"""
Adobe Stock 爬虫使用示例
运行前请先: pip install -r requirements.txt
"""
from crawler_base import logger
from search_crawler import SearchCrawler
from detail_crawler import DetailCrawler
from category_crawler import CategoryCrawler
from storage import create_storage


def example_search():
    """示例1：按关键词搜索"""
    print("=" * 50)
    print("示例1：关键词搜索 - '富士山'")
    print("=" * 50)

    storage = create_storage("json", "example_fujisan")
    with SearchCrawler() as crawler:
        items = crawler.crawl(
            keyword="富士山",
            asset_type="photos",
            sort_by="popular",
            max_pages=2,  # 仅爬2页做示例
            storage=storage,
        )
        print(f"\n获取到 {len(items)} 个结果")
        if items:
            first = items[0]
            print(f"第一条: {first['id']} - {first['title'][:50]}")
    storage.close()


def example_category():
    """示例2：按分类浏览最新免费素材"""
    print("\n" + "=" * 50)
    print("示例2：分类浏览 - 免费素材")
    print("=" * 50)

    storage = create_storage("csv", "example_free")
    with CategoryCrawler() as crawler:
        items = crawler.crawl(
            category_name="free",
            max_pages=1,
            storage=storage,
        )
        print(f"获取到 {len(items)} 个免费素材")
    storage.close()


def example_detail():
    """示例3：抓取单个素材详情（需要有效的素材ID）"""
    print("\n" + "=" * 50)
    print("示例3：详情页抓取（示例URL）")
    print("=" * 50)
    print("注意：需要提供有效的素材URL才能运行详情页示例")
    # 取消注释并替换为真实URL后运行
    # with DetailCrawler(use_selenium=True) as crawler:
    #     item = crawler.crawl("https://stock.adobe.com/jp/photo/123456789")
    #     if item:
    #         print(f"标题: {item.get('title')}")


if __name__ == "__main__":
    print("Adobe Stock 爬虫示例程序\n")
    print("⚠️  提醒：请确保遵守 Adobe Stock 服务条款和相关法律\n")

    # 运行示例
    try:
        example_search()
        example_category()
        example_detail()
    except Exception as e:
        print(f"示例运行出错: {e}")
        print("提示：Adobe Stock 有 Cloudflare 保护，如遇 403 错误请加 --selenium 参数使用浏览器模式")

    print("\n示例运行结束。输出文件在 output/ 目录下。")
