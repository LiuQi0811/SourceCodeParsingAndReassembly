"""
分类页爬虫 - 按分类浏览 Adobe Stock 素材
"""
import logging
from typing import List, Dict, Any, Optional
from urllib.parse import urlencode

from crawler_base import AdobeStockCrawlerBase
from utils.parser import parse_search_results, parse_pagination
from storage import BaseStorage
from tqdm import tqdm

logger = logging.getLogger("adobe_crawler")


class CategoryCrawler(AdobeStockCrawlerBase):
    """分类浏览爬取器"""

    # Adobe Stock 日本站主要分类
    CATEGORIES = {
        "photos": "https://stock.adobe.com/jp/photos",
        "illustrations": "https://stock.adobe.com/jp/illustrations",
        "vectors": "https://stock.adobe.com/jp/vectors",
        "videos": "https://stock.adobe.com/jp/videos",
        "audio": "https://stock.adobe.com/jp/audio",
        "templates": "https://stock.adobe.com/jp/templates",
        "3d": "https://stock.adobe.com/jp/3d-assets",
        "free": "https://stock.adobe.com/jp/free",
        "premium": "https://stock.adobe.com/jp/premium",
        "new": "https://stock.adobe.com/jp/new",
    }

    def crawl(
        self,
        category_url: str = "",
        category_name: str = "photos",
        max_pages: int = 3,
        start_page: int = 1,
        storage: Optional[BaseStorage] = None,
    ) -> List[Dict[str, Any]]:
        """
        按分类浏览爬取

        Args:
            category_url: 分类页 URL（不指定则按 category_name 取内置 URL）
            category_name: 分类名称
            max_pages: 最大页数
            start_page: 起始页
            storage: 数据存储器
        """
        if not category_url:
            category_url = self.CATEGORIES.get(category_name, self.CATEGORIES["photos"])

        all_items = []
        seen_ids = set()
        current_page = start_page
        pages_crawled = 0

        logger.info(f"[Category] {category_name} - {category_url}, 最大页数: {max_pages}")

        pbar = tqdm(total=max_pages, desc=f"分类: {category_name}")

        while pages_crawled < max_pages:
            # 构建分页 URL
            sep = "&" if "?" in category_url else "?"
            url = f"{category_url}{sep}page={current_page}"

            try:
                html = self.fetch(url)
                if not html:
                    break

                items = parse_search_results(html)
                if not items:
                    logger.info(f"[Category Page {current_page}] 无结果")
                    break

                new_count = 0
                for item in items:
                    item["category_name"] = category_name
                    if item["id"] not in seen_ids:
                        seen_ids.add(item["id"])
                        all_items.append(item)
                        new_count += 1
                        if storage:
                            storage.save_item(item)

                logger.info(f"[Category Page {current_page}] {len(items)} 个结果，新增 {new_count}")
                pbar.update(1)
                pages_crawled += 1

                pagination = parse_pagination(html)
                if not pagination.get("has_next"):
                    break
                current_page += 1

            except Exception as e:
                logger.error(f"[Category Error] Page {current_page}: {e}")
                break

        pbar.close()
        logger.info(f"[Category Complete] {category_name} 共 {len(all_items)} 个素材")
        return all_items
