"""
HTML 解析工具模块 - 从 Adobe Stock 页面提取结构化数据
Adobe Stock 页面大量使用 Next.js / 内嵌 JSON 数据 (window.__INITIAL_STATE__ 等)，
因此优先提取内嵌 JSON，正则兜底从 DOM 提取。
"""
import json
import re
from typing import Dict, List, Optional, Any
from urllib.parse import urlparse, parse_qs

from bs4 import BeautifulSoup


def extract_next_data(html: str) -> Optional[Dict]:
    """
    提取页面中的 __NEXT_DATA__ 内嵌 JSON（Next.js 框架数据）
    这是最可靠的数据来源，包含完整的服务端渲染数据
    """
    pattern = r'<script\s+id="__NEXT_DATA__"\s+type="application/json">(.*?)</script>'
    match = re.search(pattern, html, re.DOTALL)
    if match:
        try:
            return json.loads(match.group(1))
        except json.JSONDecodeError:
            pass
    return None


def extract_initial_state(html: str) -> Optional[Dict]:
    """
    提取 window.__INITIAL_STATE__ 或类似的全局状态变量
    """
    patterns = [
        r'window\.__INITIAL_STATE__\s*=\s*({.*?});?\s*</script>',
        r'window\.__STOCK_STATE__\s*=\s*({.*?});?\s*</script>',
        r'"searchResults"\s*:\s*({.*?})\s*,\s*"',
    ]
    for pattern in patterns:
        match = re.search(pattern, html, re.DOTALL)
        if match:
            try:
                return json.loads(match.group(1))
            except json.JSONDecodeError:
                continue
    return None


def extract_ld_json(html: str) -> List[Dict]:
    """
    提取 JSON-LD 结构化数据 (schema.org)
    包含素材的标准化元数据
    """
    soup = BeautifulSoup(html, "lxml")
    ld_scripts = soup.find_all("script", type="application/ld+json")
    results = []
    for script in ld_scripts:
        try:
            data = json.loads(script.string)
            if isinstance(data, list):
                results.extend(data)
            else:
                results.append(data)
        except (json.JSONDecodeError, TypeError):
            continue
    return results


def parse_search_results(html: str) -> List[Dict[str, Any]]:
    """
    解析搜索结果页，返回素材列表
    优先从 __NEXT_DATA__ 提取，降级从 DOM 解析
    """
    items = []

    # 1. 优先从 Next.js 数据提取
    next_data = extract_next_data(html)
    if next_data:
        items = _parse_from_next_data(next_data)
        if items:
            return items

    # 2. 尝试从内嵌状态提取
    init_state = extract_initial_state(html)
    if init_state:
        items = _parse_from_state(init_state)
        if items:
            return items

    # 3. DOM 兜底解析（适配不同版本的页面结构）
    items = _parse_from_dom(html)
    return items


def _parse_from_next_data(next_data: Dict) -> List[Dict]:
    """从 __NEXT_DATA__ 中提取搜索结果"""
    items = []
    try:
        props = next_data.get("props", {}).get("pageProps", {})
        # 尝试多种可能的数据路径
        search_data = (
            props.get("searchResults")
            or props.get("results")
            or props.get("stock", {}).get("searchResults")
            or {}
        )
        items_raw = (
            search_data.get("items")
            or search_data.get("results")
            or search_data.get("assets")
            or []
        )
        for item in items_raw:
            parsed = _normalize_asset_item(item)
            if parsed:
                items.append(parsed)
    except Exception:
        pass
    return items


def _parse_from_state(state: Dict) -> List[Dict]:
    """从全局状态对象提取结果"""
    items = []
    try:
        items_raw = state.get("items", state.get("results", state.get("assets", [])))
        for item in items_raw:
            parsed = _normalize_asset_item(item)
            if parsed:
                items.append(parsed)
    except Exception:
        pass
    return items


def _parse_from_dom(html: str) -> List[Dict]:
    """从 DOM 结构兜底解析搜索结果"""
    items = []
    soup = BeautifulSoup(html, "lxml")

    # 尝试多种卡片选择器（Adobe 可能会改版类名）
    card_selectors = [
        'div[data-id][data-asset-type]',  # 带 asset_id 的卡片
        'div[class*="GridItem"]',          # 网格项
        'div[class*="SearchResultItem"]',  # 搜索结果项
        'article',                         # 文章卡片
        'div[class*="asset-card"]',        # asset-card 类名
        'a[href*="/jp/photo/"]',           # 图片详情链接
        'a[href*="/jp/vector/"]',
        'a[href*="/jp/video/"]',
        'a[href*="/jp/audio/"]',
        'a[href*="/jp/illustration/"]',
    ]

    seen_ids = set()
    for selector in card_selectors:
        cards = soup.select(selector)
        for card in cards:
            try:
                item = _parse_dom_card(card)
                if item and item.get("id") and item["id"] not in seen_ids:
                    seen_ids.add(item["id"])
                    items.append(item)
            except Exception:
                continue
        if items:
            break  # 某一选择器已成功提取就不再尝试下一个

    return items


def _parse_dom_card(card) -> Optional[Dict]:
    """解析单个 DOM 卡片元素"""
    # 获取素材 ID
    asset_id = card.get("data-id") or card.get("data-asset-id")
    if not asset_id:
        # 从链接提取 ID
        link = card.find("a", href=True) if card.name != "a" else card
        if link:
            href = link["href"]
            id_match = re.search(r'/(\d{6,})', href)
            if id_match:
                asset_id = id_match.group(1)
    if not asset_id:
        return None

    # 获取链接
    href = card.get("href")
    if not href:
        link = card.find("a", href=True)
        if link:
            href = link["href"]
    if href and href.startswith("/"):
        href = f"https://stock.adobe.com{href}"

    # 获取标题
    title_el = card.find(["h2", "h3", "span"], alt=True)
    if not title_el:
        title_el = card.get("alt")
    title = ""
    if title_el:
        title = title_el.get("alt") or title_el.get("title") or title_el.get_text(strip=True)

    # 获取缩略图
    img = card.find("img", src=True)
    thumbnail = ""
    if img:
        thumbnail = img.get("src") or img.get("data-src") or img.get("data-lazy-src", "")

    # 获取作者
    author_el = card.find(attrs={"data-contributor": True}) or card.find(class_=re.compile(r"author|contributor", re.I))
    author = ""
    author_id = ""
    if author_el:
        author = author_el.get_text(strip=True)
        author_id = author_el.get("data-contributor-id", "")

    return {
        "id": str(asset_id),
        "title": title,
        "details_url": href or f"https://stock.adobe.com/jp/{asset_id}",
        "thumbnail_url": thumbnail,
        "contributor_name": author,
        "contributor_id": author_id,
    }


def _normalize_asset_item(item: Dict) -> Optional[Dict]:
    """标准化单个素材数据项"""
    if not item:
        return None

    asset_id = str(
        item.get("id")
        or item.get("assetId")
        or item.get("stock_id")
        or item.get("mediaId")
        or ""
    )
    if not asset_id:
        return None

    # 标题
    title = (
        item.get("title")
        or item.get("name")
        or item.get("altText")
        or ""
    )

    # 素材类型
    asset_type = (
        item.get("asset_type")
        or item.get("contentType")
        or item.get("type")
        or item.get("mediaType")
        or "photo"
    )

    # 缩略图 URL（优先小尺寸预览图）
    thumbnail = (
        item.get("thumbnail_url")
        or item.get("thumb")
        or item.get("thumbnail")
        or (item.get("urls") or {}).get("thumb")
        or (item.get("thumbnail") or {}).get("url")
        or ""
    )
    if isinstance(thumbnail, dict):
        thumbnail = thumbnail.get("url") or thumbnail.get("src", "")

    # 详情页链接
    details_url = item.get("details_url") or item.get("url") or ""
    if not details_url:
        slug_map = {
            "photo": "photo",
            "illustration": "illustration",
            "vector": "vector",
            "image": "photo",
            "video": "video",
            "audio": "audio",
            "3d": "3d-assets",
            "template": "templates",
        }
        slug = slug_map.get(str(asset_type).lower(), "photo")
        details_url = f"https://stock.adobe.com/jp/{slug}/{asset_id}"

    # 作者信息
    contributor = item.get("contributor") or item.get("creator") or {}
    if isinstance(contributor, dict):
        contributor_name = contributor.get("name") or contributor.get("displayName", "")
        contributor_id = str(contributor.get("id") or contributor.get("contributorId", ""))
    else:
        contributor_name = str(contributor) if contributor else ""
        contributor_id = ""

    # 关键词
    keywords = item.get("keywords") or item.get("tags") or []
    if isinstance(keywords, str):
        keywords = [k.strip() for k in keywords.split(",") if k.strip()]

    # 尺寸
    width = item.get("width") or item.get("w") or 0
    height = item.get("height") or item.get("h") or 0

    return {
        "id": asset_id,
        "title": title,
        "asset_type": str(asset_type).lower(),
        "thumbnail_url": thumbnail,
        "preview_url": item.get("preview_url") or (item.get("urls") or {}).get("preview", ""),
        "details_url": details_url,
        "contributor_name": contributor_name,
        "contributor_id": contributor_id,
        "keywords": keywords,
        "category": item.get("category") or item.get("categoryName", ""),
        "width": width,
        "height": height,
        "price_info": item.get("price") or item.get("licensing", {}),
        "license_type": item.get("license_type") or item.get("license", ""),
    }


def parse_detail_page(html: str, asset_id: str = "") -> Dict[str, Any]:
    """
    解析素材详情页，提取完整元数据
    """
    result = {"id": asset_id, "keywords": [], "raw_html_length": len(html)}

    # 提取 Next.js 数据
    next_data = extract_next_data(html)
    if next_data:
        try:
            props = next_data.get("props", {}).get("pageProps", {})
            asset = (
                props.get("asset")
                or props.get("stockItem")
                or props.get("details")
                or props.get("media")
                or {}
            )
            normalized = _normalize_asset_item(asset)
            if normalized:
                result.update(normalized)

            # 补充详情页特有的字段
            result["description"] = asset.get("description", "")
            result["created_at"] = asset.get("creationDate") or asset.get("createdAt", "")
            result["similar_ids"] = asset.get("similarIds", [])
            result["series_id"] = asset.get("seriesId", "")
            result["is_editorial"] = asset.get("isEditorial", False)
            result["is_free"] = asset.get("isFree", False)
            result["download_count"] = asset.get("downloadCount") or asset.get("nbDownloads", 0)
        except Exception:
            pass

    # 提取 JSON-LD
    ld_items = extract_ld_json(html)
    for ld in ld_items:
        ld_type = ld.get("@type", "")
        if ld_type in ("ImageObject", "VideoObject", "MediaObject", "CreativeWork"):
            result["title"] = result.get("title") or ld.get("name", "")
            result["description"] = result.get("description") or ld.get("description", "")
            result["thumbnail_url"] = result.get("thumbnail_url") or ld.get("thumbnailUrl", "")
            result["content_url"] = ld.get("contentUrl", "")
            result["keywords"] = result.get("keywords") or ld.get("keywords", "").split(",") if isinstance(ld.get("keywords"), str) else ld.get("keywords", [])
            result["author"] = result.get("contributor_name") or (ld.get("author", {}) or {}).get("name", "")
            result["license_url"] = ld.get("license", "")
            result["upload_date"] = ld.get("uploadDate", "")
            if ld.get("width"):
                result["width"] = ld["width"].get("value") if isinstance(ld["width"], dict) else ld["width"]
            if ld.get("height"):
                result["height"] = ld["height"].get("value") if isinstance(ld["height"], dict) else ld["height"]

    # 从 meta 标签补充信息
    soup = BeautifulSoup(html, "lxml")
    meta_map = {
        "og:title": "title",
        "og:description": "description",
        "og:image": "og_image",
        "keywords": "meta_keywords",
        "description": "meta_description",
    }
    for prop, key in meta_map.items():
        meta = soup.find("meta", attrs={"property": prop}) or soup.find("meta", attrs={"name": prop})
        if meta and meta.get("content"):
            if not result.get(key):
                result[key] = meta["content"]

    return result


def parse_pagination(html: str) -> Dict[str, Any]:
    """
    解析分页信息，返回总页数、当前页、下一页URL等
    """
    pagination = {
        "current_page": 1,
        "total_pages": 1,
        "total_results": 0,
        "next_page_url": "",
        "has_next": False,
    }

    # 从 Next.js 数据提取
    next_data = extract_next_data(html)
    if next_data:
        try:
            props = next_data.get("props", {}).get("pageProps", {})
            search_data = props.get("searchResults") or props.get("results") or {}
            pagination["current_page"] = search_data.get("page", search_data.get("currentPage", 1))
            pagination["total_pages"] = search_data.get("nbPages", search_data.get("totalPages", 1))
            pagination["total_results"] = search_data.get("nbResults", search_data.get("totalResults", 0))
            if pagination["current_page"] < pagination["total_pages"]:
                pagination["has_next"] = True
        except Exception:
            pass

    # DOM 兜底
    soup = BeautifulSoup(html, "lxml")
    next_btn = soup.find("a", attrs={"rel": "next"}) or soup.find(class_=re.compile(r"next", re.I))
    if next_btn and next_btn.get("href"):
        href = next_btn["href"]
        if href.startswith("?") or href.startswith("/"):
            href = f"https://stock.adobe.com{href}" if href.startswith("/") else ""
        pagination["next_page_url"] = href
        pagination["has_next"] = bool(href)

    return pagination


def get_asset_id_from_url(url: str) -> Optional[str]:
    """从素材详情 URL 中提取 ID"""
    match = re.search(r'/(\d{6,})(?:\?|$|/)', url)
    if match:
        return match.group(1)
    # 尝试从查询参数获取
    parsed = urlparse(url)
    qs = parse_qs(parsed.query)
    if "asset_id" in qs:
        return qs["asset_id"][0]
    if "id" in qs:
        return qs["id"][0]
    return None
