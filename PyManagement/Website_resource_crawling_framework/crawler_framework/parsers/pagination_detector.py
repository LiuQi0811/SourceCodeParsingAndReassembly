"""
通用智能翻页识别与链接发现器 (Pagination & Link Discovery)
支持任意网站的通用分页模式（正则、文本意图、rel="next"、数字序列）
"""
import re
from typing import Any, Dict, List, Optional, Set, Tuple
from urllib.parse import unquote, urljoin, urlparse, urldefrag
from bs4 import BeautifulSoup


class PaginationDetector:
    """智能通用翻页识别策略"""

    # 常见分页文本模式（包含中英文、符号）
    PAGINATION_TEXT_PATTERNS = [
        re.compile(r"下一页|下页|下一頁|后一页|后页", re.I),
        re.compile(r"next(?:\s+page)?", re.I),
        re.compile(r"^[>»›]+$"),
        re.compile(r"末页|尾页|最后[一]?页|last", re.I),
        re.compile(r"^\d+$"),  # 纯数字分页按钮（1, 2, 3...）
    ]

    # 常见分页 URL 正则模式
    PAGINATION_URL_PATTERNS = [
        re.compile(r"page[=_/](\d+)", re.I),
        re.compile(r"list[_-]\d*[_-](\d+)", re.I),
        re.compile(r"index[_-](\d+)", re.I),
        re.compile(r"[?&](?:page|p|pn|cur_page|page_no|offset|start)=(\d+)", re.I),
        re.compile(r"_(\d+)\.html?$", re.I),
        re.compile(r"/p/(\d+)", re.I),
    ]

    @classmethod
    def clean_url(cls, url: str, base_url: str) -> Optional[str]:
        """清洗并转为绝对 URL，去掉 hash 锚点"""
        if not url:
            return None
        url = url.strip()
        if url.startswith(("javascript:", "mailto:", "tel:", "#")):
            return None
        abs_url = urljoin(base_url, url)
        # 去掉锚点
        defrag_url, _ = urldefrag(abs_url)
        if not defrag_url.startswith(("http://", "https://")):
            return None
        return defrag_url

    @classmethod
    def is_pagination_url(cls, url: str, text: str = "") -> bool:
        """判断是否属于翻页或分页链接"""
        # 1. 文本匹配
        clean_txt = (text or "").strip()
        for pat in cls.PAGINATION_TEXT_PATTERNS:
            if pat.search(clean_txt):
                return True

        # 2. URL 正则模式匹配
        for pat in cls.PAGINATION_URL_PATTERNS:
            if pat.search(url):
                return True

        return False

    @classmethod
    def extract_links_and_pagination(
        cls,
        html: str,
        base_url: str,
        same_domain: bool = True,
        allowed_domains: Optional[List[str]] = None,
    ) -> Dict[str, Any]:
        """
        全面解析页面，将链接分流为：
        - pagination_links: 翻页链接（高优先级）
        - section_links: 栏目导航链接（中优先级）
        - detail_links: 文章/内容详情页链接（普通优先级）
        - resource_urls: 静态多媒体资源（图片、视频、音频）
        """
        if not html:
            return {
                "pagination_links": [],
                "content_links": [],
                "resource_urls": [],
            }

        soup = BeautifulSoup(html, "html.parser")
        base_host = urlparse(base_url).hostname or ""
        base_root_domain = cls._get_root_domain(base_host)

        def is_domain_allowed(u: str) -> bool:
            if not same_domain and not allowed_domains:
                return True
            h = urlparse(u).hostname or ""
            if not h:
                return False
            if allowed_domains:
                return any(ad in h for ad in allowed_domains)
            if same_domain and base_root_domain:
                return base_root_domain in h
            return True

        pagination_links: List[Dict[str, Any]] = []
        content_links: List[str] = []
        resource_urls: List[Dict[str, Any]] = []

        seen_links: Set[str] = set()
        seen_res: Set[str] = set()

        # 1. 检查 <link rel="next"> 标准分页
        for link_tag in soup.find_all("link", rel=lambda x: x and "next" in x.lower()):
            href = link_tag.get("href")
            clean_href = cls.clean_url(href, base_url)
            if clean_href and is_domain_allowed(clean_href):
                pagination_links.append({"url": clean_href, "type": "rel_next", "text": "rel=next"})
                seen_links.add(clean_href)

        # 2. 遍历所有 a 标签
        for a in soup.find_all("a", href=True):
            clean_href = cls.clean_url(a["href"], base_url)
            if not clean_href or clean_href == base_url or clean_href in seen_links:
                continue
            if not is_domain_allowed(clean_href):
                continue

            seen_links.add(clean_href)
            link_text = a.get_text(strip=True)

            if cls.is_pagination_url(clean_href, link_text):
                pagination_links.append({
                    "url": clean_href,
                    "type": "pagination",
                    "text": link_text[:30] or "翻页"
                })
            else:
                content_links.append(clean_href)

        # 3. 提取所有真实资源（兼容传统 img 与现代 amp-img 及懒加载属性）
        for img in soup.find_all(["img", "amp-img"]):
            src = (
                img.get("data-original")
                or img.get("data-src")
                or img.get("data-lazy-src")
                or img.get("src")
                or ""
            )
            clean_src = cls.clean_url(src, base_url)
            if clean_src and clean_src not in seen_res:
                seen_res.add(clean_src)
                resource_urls.append({
                    "url": clean_src,
                    "category": "images",
                    "alt": (img.get("alt") or "")[:60]
                })

        for vid in soup.find_all(["video", "source"]):
            src = vid.get("src") or vid.get("data-src") or ""
            clean_src = cls.clean_url(src, base_url)
            if clean_src and clean_src not in seen_res:
                seen_res.add(clean_src)
                resource_urls.append({
                    "url": clean_src,
                    "category": "videos",
                    "alt": "video"
                })

        for au in soup.find_all(["audio", "source"]):
            if au.name == "audio" or "audio" in (au.get("type") or ""):
                src = au.get("src") or ""
                clean_src = cls.clean_url(src, base_url)
                if clean_src and clean_src not in seen_res:
                    seen_res.add(clean_src)
                    resource_urls.append({
                        "url": clean_src,
                        "category": "audios",
                        "alt": "audio"
                    })

        # 4. JS 内媒体地址提取（MacCMS 等模板：m3u8/mp4 藏在 player_aaaa.link 等 JS 对象里，非 HTML 标签）
        #    覆盖 "link":"...m3u8"、"url":"...mp4" 以及裸 m3u8 直链，处理 JS 转义 \/
        # 常见播放器对象字段名（覆盖 MacCMS player_aaaa / mac_player_info / 各类自定义模板）
        _media_keys = r'(?:link|url|src|file|play|source|video|play_url|stream|main|source_url)'
        js_media_patterns = [
            # "url":"...xxx.m3u8" / 'file': '...xxx.mp4' 等 JSON 对象字段（通配外层变量名）
            re.compile(r'["\']' + _media_keys + r'["\']\s*:\s*["\']([^"\']+\.m3u8[^"\']*)["\']', re.I),
            re.compile(r'["\']' + _media_keys + r'["\']\s*:\s*["\']([^"\']+\.mp4[^"\']*)["\']', re.I),
            # 裸 https://...xxx.m3u8 直链（处理 JS 转义 \/）
            re.compile(r'(https?:\\?/\\?/[^"\'\s]+\.m3u8[^"\'\s]*)', re.I),
            # 裸 var playUrl = "https://...m3u8" / var url = "xxx.mp4" 等 JS 变量直接赋值
            re.compile(r'(?:var|let|const)\s+\w*[Uu]rl\w*\s*=\s*["\']([^"\']+\.(?:m3u8|mp4)[^"\']*)["\']', re.I),
        ]
        for pat in js_media_patterns:
            for m in pat.finditer(html):
                raw = m.group(1).replace("\\/", "/")
                clean = cls.clean_url(raw, base_url)
                if clean and clean not in seen_res:
                    seen_res.add(clean)
                    resource_urls.insert(0, {
                        "url": clean,
                        "category": "videos",
                        "alt": "js-media"
                    })

        # 5. MacCMS 加密播放对象解密：同时匹配 encrypt 字段与 url/link 字段
        #    encrypt=1 -> unescape(url)  (URL 解码)
        #    encrypt=2 -> unescape(atob(url))  (base64 解码后再 URL 解码)
        _enc_obj = re.compile(
            r'\{[^{}]*?"encrypt"\s*:\s*["\']?(\d)["\']?[^{}]*?"(?:link|url|src|file)"\s*:\s*["\']([^"\']{4,})["\']',
            re.I,
        )
        for m in _enc_obj.finditer(html):
            enc_flag = m.group(1)
            raw = m.group(2).replace("\\/", "/")
            try:
                if enc_flag == "1":
                    raw = unquote(raw)
                elif enc_flag == "2":
                    raw = unquote(__import__("base64").b64decode(raw).decode("utf-8", "replace"))
            except Exception:
                pass
            if not re.search(r"\.(?:m3u8|mp4)", raw, re.I):
                continue
            clean = cls.clean_url(raw, base_url)
            if clean and clean not in seen_res:
                seen_res.add(clean)
                resource_urls.insert(0, {
                    "url": clean,
                    "category": "videos",
                    "alt": f"js-media-enc{enc_flag}"
                })

        return {
            "pagination_links": pagination_links,
            "content_links": content_links,
            "resource_urls": resource_urls,
        }

    @staticmethod
    def _get_root_domain(hostname: str) -> str:
        """获取根域名 (例如 www.169tp.com -> 169tp.com)"""
        parts = hostname.split(".")
        if len(parts) >= 2:
            return ".".join(parts[-2:])
        return hostname
