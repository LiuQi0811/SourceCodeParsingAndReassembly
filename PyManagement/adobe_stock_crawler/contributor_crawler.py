"""
贡献者（作者）主页爬虫 - 抓取某个作者的作品集
"""
import logging
import re
from typing import List, Dict, Any, Optional

from crawler_base import AdobeStockCrawlerBase
from utils.parser import parse_search_results, parse_pagination
from storage import BaseStorage
from tqdm import tqdm

logger = logging.getLogger("adobe_crawler")


class ContributorCrawler(AdobeStockCrawlerBase):
    """作者作品集爬取器"""

    def get_contributor_id_from_url(self, url: str) -> Optional[str]:
        """从作者主页 URL 提取 ID"""
        match = re.search(r'/contributor/(\d+)', url)
        if match:
            return match.group(1)
        match = re.search(r'contributor_id=(\d+)', url)
        if match:
            return match.group(1)
        return None

    def crawl(
        self,
        url: str,
        max_pages: int = 3,
        start_page: int = 1,
        storage: Optional[BaseStorage] = None,
    ) -> List[Dict[str, Any]]:
        """
        抓取作者作品集

        Args:
            url: 作者主页 URL，如 https://stock.adobe.com/jp/contributor/12345
            max_pages: 最大页数
            start_page: 起始页
            storage: 数据存储器
        """
        contributor_id = self.get_contributor_id_from_url(url)
        all_items = []
        seen_ids = set()
        current_page = start_page
        pages_crawled = 0

        logger.info(f"[Contributor] ID={contributor_id}, URL={url}, 最大页数: {max_pages}")

        # 先获取作者信息（第一页）
        author_name = ""

        pbar = tqdm(total=max_pages, desc=f"作者: {contributor_id}")

        while pages_crawled < max_pages:
            page_url = f"{url}?page={current_page}" if "?" not in url else f"{url}&page={current_page}"

            try:
                html = self.fetch(page_url)
                if not html:
                    break

                # 从第一页提取作者名字
                if pages_crawled == 0:
                    author_name = self._extract_author_name(html)
                    if author_name:
                        logger.info(f"[Contributor] 作者名: {author_name}")

                items = parse_search_results(html)
                if not items:
                    break

                new_count = 0
                for item in items:
                    item["contributor_id"] = str(contributor_id)
                    if author_name:
                        item["contributor_name"] = author_name
                    if item["id"] not in seen_ids:
                        seen_ids.add(item["id"])
                        all_items.append(item)
                        new_count += 1
                        if storage:
                            storage.save_item(item)

                logger.info(f"[Contributor Page {current_page}] {len(items)} 个结果，新增 {new_count}")
                pbar.update(1)
                pages_crawled += 1

                pagination = parse_pagination(html)
                if not pagination.get("has_next"):
                    break
                current_page += 1

            except Exception as e:
                logger.error(f"[Contributor Error] Page {current_page}: {e}")
                break

        pbar.close()
        logger.info(f"[Contributor Complete] {author_name}({contributor_id}) 共 {len(all_items)} 个素材")
        return all_items

    def _extract_author_name(self, html: str) -> str:
        """从作者主页提取作者名称"""
        from bs4 import BeautifulSoup
        soup = BeautifulSoup(html, "lxml")
        # 尝试多种选择器
        selectors = [
            "h1[class*='contributor']",
            "h1[class*='author']",
            "h1",
            "[data-contributor-name]",
            "span[class*='display-name']",
            "title",
        ]
        for sel in selectors:
            el = soup.select_one(sel)
            if el:
                name = el.get_text(strip=True)
                if name and len(name) < 100:
                    # 从 title 清理站点后缀
                    name = re.sub(r'\s*[-|]\s*Adobe Stock.*$', '', name, flags=re.I)
                    return name
        return ""
