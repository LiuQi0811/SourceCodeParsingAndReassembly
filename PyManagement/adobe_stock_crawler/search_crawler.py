"""
搜索结果爬虫 - 按关键词搜索 Adobe Stock 素材
"""
import logging
from typing import List, Dict, Any, Optional
from urllib.parse import quote_plus, urlencode

from crawler_base import AdobeStockCrawlerBase
from utils.parser import parse_search_results, parse_pagination
from config import BASE_URL, SEARCH_URL, ITEMS_PER_PAGE, ASSET_TYPES, SORT_OPTIONS
from storage import BaseStorage
from tqdm import tqdm

logger = logging.getLogger("adobe_crawler")


class SearchCrawler(AdobeStockCrawlerBase):
    """搜索结果爬取器"""

    def crawl(
        self,
        keyword: str,
        asset_type: str = "photos",
        sort_by: str = "relevance",
        max_pages: int = 5,
        start_page: int = 1,
        storage: Optional[BaseStorage] = None,
        filters: Optional[Dict[str, Any]] = None,
    ) -> List[Dict[str, Any]]:
        """
        按关键词搜索爬取

        Args:
            keyword: 搜索关键词（支持日文/中文/英文）
            asset_type: 素材类型（photos/illustrations/vectors/videos/audio/free等）
            sort_by: 排序方式
            max_pages: 最大爬取页数
            start_page: 起始页码
            storage: 数据存储器
            filters: 额外筛选参数（如 orientation=horizontal, color=red 等）

        Returns:
            抓取到的所有素材列表
        """
        all_items = []
        seen_ids = set()

        # 构建基础搜索 URL
        type_path = ASSET_TYPES.get(asset_type.lower(), asset_type.lower())
        base_search_url = f"{SEARCH_URL}/{quote_plus(keyword)}"
        if type_path and type_path != "all":
            base_search_url = f"{BASE_URL}/{type_path}/search?k={quote_plus(keyword)}"

        logger.info(f"[Search] 关键词: '{keyword}', 类型: {asset_type}, 最大页数: {max_pages}")

        current_page = start_page
        pages_crawled = 0

        pbar = tqdm(total=max_pages, desc=f"搜索: {keyword}")

        while pages_crawled < max_pages:
            # 构建 URL
            params = {
                "k": keyword,
                "page": current_page,
                "order": SORT_OPTIONS.get(sort_by, "relevance"),
            }
            if filters:
                params.update(filters)
            url = f"{base_search_url}&{urlencode(params)}" if "?" in base_search_url else f"{base_search_url}?{urlencode(params)}"

            logger.info(f"[Page {current_page}] 请求: {url}")

            try:
                html = self.fetch(url)
                if not html:
                    logger.warning(f"[Page {current_page}] 获取页面失败，停止")
                    break

                # 解析搜索结果
                items = parse_search_results(html)
                if not items:
                    logger.info(f"[Page {current_page}] 无结果，搜索结束")
                    break

                new_count = 0
                for item in items:
                    item["search_keyword"] = keyword
                    item["search_type"] = asset_type
                    if item["id"] not in seen_ids:
                        seen_ids.add(item["id"])
                        all_items.append(item)
                        new_count += 1
                        if storage:
                            storage.save_item(item)

                logger.info(f"[Page {current_page}] 获取 {len(items)} 个结果，新增 {new_count} 个")
                pbar.update(1)
                pages_crawled += 1

                # 解析分页信息
                pagination = parse_pagination(html)
                if not pagination.get("has_next"):
                    logger.info("[Pagination] 已是最后一页")
                    break

                current_page += 1

            except Exception as e:
                logger.error(f"[Error] 爬取第 {current_page} 页失败: {e}")
                break

        pbar.close()
        logger.info(f"[Search Complete] 共获取 {len(all_items)} 个唯一素材")
        return all_items
