"""
解析器基类与工厂
设计模式：工厂模式 + 策略模式
支持三种解析模式：BS4、XPath、Regex
"""
import re
from abc import ABC, abstractmethod
from typing import List, Tuple, Optional
from urllib.parse import urljoin

from bs4 import BeautifulSoup
from lxml import etree

from core.config import ParseMode, ResourceType, get_config
from core.models import ParseResult
from utils.url_utils import normalize_url, get_resource_type
from utils.logger import get_logger

logger = get_logger("Parser")


class BaseParser(ABC):
    """解析器抽象基类"""

    def __init__(self):
        self.config = get_config()

    @abstractmethod
    def parse(self, html: bytes, url: str, headers: dict = None) -> ParseResult:
        """解析HTML内容"""
        pass

    # 兜底：匹配内联脚本/属性中出现的音视频直链或 HLS/DASH 清单地址
    _INLINE_MEDIA_RE = re.compile(
        r'''["'](?:https?:)?//[^\s"'<>]+?\.(?:m3u8|mp4|webm|mov|mkv|avi|flv|m4v|wmv|mpg|mpeg|ts|m4s|mpd|mp3|m4a|aac|wav|ogg)(?:[?#][^\s"'<>]*)?["']''',
        re.IGNORECASE,
    )

    def _scan_inline_media(self, text: str, base_url: str) -> List[str]:
        """从原始文本中兜底扫描内联音视频直链（覆盖 JS 动态赋值场景）"""
        found: List[str] = []
        if not text:
            return found
        # 归一化 JSON/JS 转义斜杠：DPlayer 等播放器配置常写成 https:\/\/host\/a.m3u8
        scan_text = text.replace("\\/", "/")
        for match in self._INLINE_MEDIA_RE.finditer(scan_text):
            raw = match.group(0)[1:-1]  # 去掉两端引号
            full = normalize_url(raw, base_url)
            if full and get_resource_type(full) in (ResourceType.VIDEO, ResourceType.AUDIO):
                found.append(full)
        return found

    def _extract_links_and_resources_bs4(self, soup: BeautifulSoup, base_url: str) -> Tuple[List[str], List[str]]:
        """从BS4对象提取链接和资源（通用方法）"""
        links = []
        resources = []

        # 页面链接
        for a in soup.find_all("a", href=True):
            href = normalize_url(a["href"], base_url)
            if href:
                links.append(href)

        # 静态资源
        for tag, attr in [
            ("link", "href"), ("script", "src"), ("img", "src"),
            ("img", "data-src"), ("source", "src"), ("source", "data-src"),
            ("video", "src"), ("video", "data-src"), ("video", "poster"),
            ("audio", "src"), ("audio", "data-src"), ("iframe", "src"), ("embed", "src"),
            ("object", "data"),
        ]:
            for el in soup.find_all(tag, attrs={attr: True}):
                src = normalize_url(el[attr], base_url)
                if src:
                    rtype = get_resource_type(src)
                    if rtype.value == "html":
                        links.append(src)
                    else:
                        resources.append(src)

        # CSS中的图片和字体
        for style in soup.find_all("style"):
            if style.string:
                css_urls = re.findall(r'url\(["\']?([^)"\']+)["\']?\)', style.string)
                for u in css_urls:
                    full_u = normalize_url(u, base_url)
                    if full_u:
                        resources.append(full_u)

        return list(set(links)), list(set(resources))

    def _extract_links_and_resources_xpath(self, tree, base_url: str) -> Tuple[List[str], List[str]]:
        """从XPath tree对象提取链接和资源"""
        links = []
        resources = []

        # 页面链接
        hrefs = tree.xpath("//a/@href")
        for href in hrefs:
            full = normalize_url(href, base_url)
            if full:
                links.append(full)

        # 静态资源
        xpath_queries = [
            "//link/@href", "//script/@src", "//img/@src", "//img/@data-src",
            "//source/@src", "//source/@data-src", "//video/@src", "//video/@data-src",
            "//video/@poster", "//audio/@src", "//audio/@data-src", "//iframe/@src",
        ]
        for xq in xpath_queries:
            for src in tree.xpath(xq):
                full = normalize_url(src, base_url)
                if full:
                    rtype = get_resource_type(full)
                    if rtype.value == "html":
                        links.append(full)
                    else:
                        resources.append(full)

        return list(set(links)), list(set(resources))

    def _extract_links_and_resources_regex(self, html: str, base_url: str) -> Tuple[List[str], List[str]]:
        """用正则提取链接和资源"""
        links = []
        resources = []

        # 先提取<a>标签内的href（页面链接）
        a_pattern = r'''<a\s[^>]*href\s*=\s*["']([^"']+)["']'''
        for match in re.finditer(a_pattern, html, re.IGNORECASE):
            u = match.group(1)
            full = normalize_url(u, base_url)
            if full:
                links.append(full)

        # 提取所有其他href和src（资源）
        res_patterns = [
            r'''<link\s[^>]*href\s*=\s*["']([^"']+)["']''',
            r'''<script\s[^>]*src\s*=\s*["']([^"']+)["']''',
            r'''<img\s[^>]*src\s*=\s*["']([^"']+)["']''',
            r'''<img\s[^>]*data-src\s*=\s*["']([^"']+)["']''',
            r'''<(?:source|video|audio|iframe|embed)\s[^>]*src\s*=\s*["']([^"']+)["']''',
            r'''<(?:source|video|audio|img)\s[^>]*data-src\s*=\s*["']([^"']+)["']''',
            r'''url\(["']?([^)"\']+)["']?\)''',
        ]
        for pattern in res_patterns:
            for match in re.finditer(pattern, html, re.IGNORECASE):
                u = match.group(1)
                full = normalize_url(u, base_url)
                if full:
                    rtype = get_resource_type(full)
                    if rtype.value == "html" and "iframe" in pattern:
                        links.append(full)
                    else:
                        resources.append(full)

        return list(set(links)), list(set(resources))


class BS4Parser(BaseParser):
    """BeautifulSoup4解析器"""

    def parse(self, html: bytes, url: str, headers: dict = None) -> ParseResult:
        result = ParseResult(url=url, success=False)
        try:
            # 自动检测编码
            import chardet
            detect_res = chardet.detect(html[:10000])
            encoding = detect_res.get("encoding") or "utf-8"
            html_text = html.decode(encoding, errors="replace")
            is_xml = False
            # 1. 通过响应头判断
            if headers:
                content_type = headers.get("Content-Type", "").lower()
                if "xml" in content_type:
                    is_xml = True
            # 2. 兜底：文本开头检测 <?xml
            if not is_xml and html_text.lstrip().startswith("<?xml"):
                is_xml = True
            if is_xml:
                soup = BeautifulSoup(html_text, features="xml")
            else:
                soup = BeautifulSoup(html_text, "lxml")

            # 标题
            title_tag = soup.find("title")
            result.title = title_tag.get_text(strip=True) if title_tag else ""

            # 提取链接和资源
            result.links, result.resources = self._extract_links_and_resources_bs4(soup, url)
            # 兜底：补抓内联脚本中的音视频直链 / m3u8 清单
            result.resources = sorted(set(result.resources + self._scan_inline_media(html_text, url)))

            # 正文文本
            body = soup.find("body")
            result.text_content = body.get_text(separator="\n", strip=True) if body else ""

            # 元数据
            result.metadata = {
                "encoding": encoding,
                "is_xml": is_xml,  # 增加标记，方便上层判断
                "meta_tags": {
                    m.get("name", m.get("property", "")): m.get("content", "")
                    for m in soup.find_all("meta")
                    if m.get("content")
                }
            }
            result.success = True
        except Exception as e:
            result.error = str(e)
            logger.error(f"BS4解析失败 [{url}]: {e}")
        return result


class XPathParser(BaseParser):
    """XPath解析器"""

    def parse(self, html: bytes, url: str, headers: dict = None) -> ParseResult:
        result = ParseResult(url=url, success=False)
        try:
            # 与 BS4/Regex 一致：先检测编码再解码为文本，避免 GBK/GB2312 页面乱码
            import chardet
            if isinstance(html, bytes):
                enc = chardet.detect(html[:10000]).get("encoding") or "utf-8"
                html = html.decode(enc, errors="replace")
            tree = etree.HTML(html)
            if tree is None:
                result.error = "XPath无法构建DOM树"
                return result

            # 标题
            title_list = tree.xpath("//title/text()")
            result.title = title_list[0].strip() if title_list else ""

            # 提取链接和资源
            result.links, result.resources = self._extract_links_and_resources_xpath(tree, url)
            result.resources = sorted(set(result.resources + self._scan_inline_media(html, url)))

            # 正文文本
            body_text = tree.xpath("//body//text()")
            result.text_content = "\n".join(
                [t.strip() for t in body_text if t.strip()]
            )

            # 元数据
            result.metadata = {
                "meta_tags": {}
            }
            for meta in tree.xpath("//meta"):
                name = meta.get("name", meta.get("property", ""))
                content = meta.get("content", "")
                if name and content:
                    result.metadata["meta_tags"][name] = content

            result.success = True
        except Exception as e:
            result.error = str(e)
            logger.error(f"XPath解析失败 [{url}]: {e}")
        return result


class RegexParser(BaseParser):
    """正则表达式解析器"""

    def parse(self, html: bytes, url: str, headers: dict = None) -> ParseResult:
        result = ParseResult(url=url, success=False)
        try:
            import chardet
            encoding = chardet.detect(html[:10000]).get("encoding", "utf-8")
            html_text = html.decode(encoding, errors="replace")

            # 标题
            title_match = re.search(r"<title[^>]*>([^<]+)</title>", html_text, re.IGNORECASE)
            result.title = title_match.group(1).strip() if title_match else ""

            # 提取链接和资源
            result.links, result.resources = self._extract_links_and_resources_regex(html_text, url)
            result.resources = sorted(set(result.resources + self._scan_inline_media(html_text, url)))

            # 正文文本（简单去除标签）
            text = re.sub(r"<script[^>]*>.*?</script>", "", html_text, flags=re.DOTALL | re.IGNORECASE)
            text = re.sub(r"<style[^>]*>.*?</style>", "", text, flags=re.DOTALL | re.IGNORECASE)
            text = re.sub(r"<[^>]+>", "\n", text)
            text = re.sub(r"\n\s*\n", "\n", text)
            result.text_content = text.strip()

            result.metadata = {"encoding": encoding}
            result.success = True
        except Exception as e:
            result.error = str(e)
            logger.error(f"正则解析失败 [{url}]: {e}")
        return result


class ParserFactory:
    """解析器工厂"""
    _parsers = {
        ParseMode.BS4: BS4Parser,
        ParseMode.XPATH: XPathParser,
        ParseMode.REGEX: RegexParser,
    }

    @classmethod
    def create_parser(cls, mode: ParseMode = None) -> BaseParser:
        if mode is None:
            mode = get_config().parse_mode
        parser_class = cls._parsers.get(mode)
        if not parser_class:
            raise ValueError(f"不支持的解析模式: {mode}")
        logger.debug(f"创建解析器: {parser_class.__name__}")
        return parser_class()

    @classmethod
    def register_parser(cls, mode: ParseMode, parser_class: type):
        """注册自定义解析器"""
        cls._parsers[mode] = parser_class
        logger.info(f"注册自定义解析器: {parser_class.__name__}")
