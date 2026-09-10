"""
详情页爬虫 - 抓取单个素材的完整元数据
"""
import logging
from typing import Dict, Any, Optional, List

from crawler_base import AdobeStockCrawlerBase
from utils.parser import parse_detail_page, get_asset_id_from_url
from storage import BaseStorage
from tqdm import tqdm

logger = logging.getLogger("adobe_crawler")


class DetailCrawler(AdobeStockCrawlerBase):
    """素材详情页爬取器"""

    def crawl(self, url: str, storage: Optional[BaseStorage] = None) -> Optional[Dict[str, Any]]:
        """
        抓取单个素材详情页

        Args:
            url: 素材详情页 URL
            storage: 数据存储器

        Returns:
            素材完整元数据
        """
        asset_id = get_asset_id_from_url(url) or "unknown"
        logger.info(f"[Detail] 抓取素材: {url} (ID: {asset_id})")

        try:
            html = self.fetch(url)
            if not html:
                logger.error(f"[Detail] 获取失败: {url}")
                return None

            item = parse_detail_page(html, asset_id)
            item["details_url"] = url

            if storage:
                storage.save_item(item)

            logger.info(
                f"[Detail OK] ID={item.get('id')}, 标题='{item.get('title', '')[:50]}...'"
            )
            return item

        except Exception as e:
            logger.error(f"[Detail Error] {url}: {e}")
            return None

    def crawl_batch(
        self,
        urls: List[str],
        storage: Optional[BaseStorage] = None,
        delay: float = None,
    ) -> List[Dict[str, Any]]:
        """
        批量抓取多个素材详情页

        Args:
            urls: 详情页 URL 列表
            storage: 数据存储器
            delay: 自定义延迟时间（覆盖默认限速）
        """
        results = []
        for url in tqdm(urls, desc="抓取详情页"):
            item = self.crawl(url, storage)
            if item:
                results.append(item)
        logger.info(f"[Detail Batch] 完成 {len(results)}/{len(urls)} 个素材")
        return results
