"""资源提取：从 HTML / CSS / JS 文本里把图片、视频、音频挖出来。

覆盖率是这个框架的生命线。真实网页里的资源藏得很散：
- <img src> 是最老实的，但懒加载站全用 data-src / data-original
- 高清图用 srcset，一个标签里塞 3~4 个 URL
- 视频站把 m3u8 地址藏在 <script> 的 JSON 配置里
- 背景图在 CSS 的 url() 里，字体在 @font-face 里
- 首屏图可能是 data: 开头的 base64

所以这里用「结构化解析 + 正则兜底」双管齐下，
结构化保证准确，正则兜住那些根本不写在标签属性里的地址。
"""

from __future__ import annotations

import base64
import binascii
import re
from dataclasses import dataclass, field
from html.parser import HTMLParser
from typing import Optional
from urllib.parse import urljoin, urlparse

from .models import guess_kind, is_bad_url, url_ext

# 懒加载站常用的属性名，img/source/div 上都可能挂
LAZY_ATTRS = (
    "src", "srcset", "data-src", "data-srcset", "data-original",
    "data-original-src", "data-lazy-src", "data-lazy", "data-lazyload",
    "data-echo", "data-url", "data-href", "data-image", "data-bg",
    "data-background-image", "data-actualsrc", "data-ks-lazyload",
    "data-webp", "data-full", "data-download",
)

# 标签 → (要读的属性, 该标签默认的资源类型)
TAG_ATTRS = {
    "img": (("src", "srcset") + LAZY_ATTRS, "image"),
    "source": (("src", "srcset") + LAZY_ATTRS, None),  # 类型看父标签
    "video": (("src", "poster") + LAZY_ATTRS, "video"),
    "audio": (("src",) + LAZY_ATTRS, "audio"),
    "embed": (("src",), "other"),
    "object": (("data",), "other"),
    "track": (("src",), "other"),
    "input": (("src",), "image"),
}

# 这些标签的 href 只在一定条件下算资源
LINK_HREF_TAGS = ("link",)

# <meta> 里常见的图片地址
META_IMAGE_NAMES = {
    "og:image", "og:image:url", "og:image:secure_url", "og:video",
    "og:audio", "twitter:image", "twitter:image:src", "twitter:player:stream",
    "msapplication-tileimage", "thumbnail",
}

# 正则兜底：引号包裹的、带资源扩展名的地址
ASSET_EXT_PATTERN = (
    r"m3u8|mpd|mp4|m4v|webm|mkv|mov|flv|avi|ts|m4s|"
    r"mp3|m4a|aac|wav|ogg|oga|opus|flac|weba|"
    r"jpe?g|png|gif|webp|avif|bmp|svg|ico|heic|"
    r"woff2?|ttf|otf|eot"
)
QUOTED_URL_RE = re.compile(
    r"""(?P<q>["'`])(?P<url>(?:https?:)?//[^"'`\s<>\\]+?\.(?:%s)(?:\?[^"'`\s<>\\]*)?)(?P=q)"""
    % ASSET_EXT_PATTERN,
    re.I,
)
BARE_URL_RE = re.compile(
    r"(?<![\w/.-])(https?://[^\s\"'<>\\)]+?\.(?:%s)(?:\?[^\s\"'<>\\)]*)?)"
    % ASSET_EXT_PATTERN,
    re.I,
)
# 根相对路径："/static/a.jpg" 这种不带域名的写法，JS 和模板里很常见
ROOT_URL_RE = re.compile(
    r"""(?P<q>["'`])(?P<url>/[^"'`\s<>\\]+?\.(?:%s)(?:\?[^"'`\s<>\\]*)?)(?P=q)"""
    % ASSET_EXT_PATTERN,
    re.I,
)
# 注意两个防护：
#   1. (?<![A-Za-z0-9_-]) 防止把 JS 里的 URL.createObjectURL(ms) 误当成 CSS 的 url(ms)
#      ——"ObjectURL(" 的尾部正是 "URL("，不加这个断言会抓出一堆垃圾地址
#   2. 排除 data: 与纯色值，交由调用方过滤
CSS_URL_RE = re.compile(
    r"(?<![A-Za-z0-9_-])url\(\s*(?P<q>['\"]?)(?P<url>[^'\")\s]+)(?P=q)\s*\)",
    re.I,
)
BASE_HREF_RE = re.compile(r"<base[^>]+href\s*=\s*['\"]?([^'\"\s>]+)", re.I)


@dataclass
class Extraction:
    """一次页面提取的产物。"""

    resources: list = field(default_factory=list)   # list[Resource]
    page_links: list = field(default_factory=list)  # 继续爬的页面 URL
    css_urls: list = field(default_factory=list)    # 需要解析的 CSS 文件
    data_uris: list = field(default_factory=list)   # (提示名, data URI)
    iframe_urls: list = field(default_factory=list)  # iframe 嵌入页（可能藏视频）
    base_url: str = ""


def parse_srcset(value: str) -> list[str]:
    """解析 srcset，取每个候选的第一段（URL 部分）。

    "a.png 1x, b.png 2x" -> ["a.png", "b.png"]
    """
    out = []
    for candidate in value.split(","):
        candidate = candidate.strip()
        if not candidate:
            continue
        url = candidate.split()[0]
        if url:
            out.append(url)
    return out


class HtmlExtractor(HTMLParser):
    """流式扫描 HTML，收集资源链接、页面链接和 CSS 引用。"""

    def __init__(self, base_url: str, *, scan_scripts: bool = True,
                 follow_iframes: bool = False):
        super().__init__(convert_charrefs=True)
        self.base_url = base_url
        self.scan_scripts = scan_scripts
        self.follow_iframes = follow_iframes

        self.result = Extraction(base_url=base_url)
        self._stack: list[str] = []          # 标签栈，判断 <source> 归属
        # (标签名, 正文)：script 与 style 要分开处理，
        # 因为 CSS 的 url() 规则不能套用到 JS 文本上
        self._text_chunks: list[tuple[str, str]] = []
        self._text_tag: Optional[str] = None
        self._in_text_tag = False
        self._seen: set[str] = set()

    # ---------- 工具 ----------

    def _abs(self, url: str) -> str:
        return urljoin(self.base_url, url.strip())

    def _add(self, url: str, kind: Optional[str], source: str,
             referer: Optional[str] = None) -> None:
        """登记一条资源，自动去重。"""
        if not url:
            return
        # data: URI 发不了请求，但内联图是要存的，单独走一路
        if url.startswith("data:"):
            self.result.data_uris.append((kind or "image", url))
            return
        if is_bad_url(url):
            return
        absolute = self._abs(url)
        if absolute in self._seen:
            return
        self._seen.add(absolute)
        self.result.resources.append(
            _make_resource(absolute, kind, source, referer or self.base_url)
        )

    def _parent_of(self, tag: str) -> Optional[str]:
        """找最近一个指定类型的祖先标签。"""
        for ancestor in reversed(self._stack[:-1]):
            if ancestor in ("video", "audio", "picture"):
                return ancestor
        return None

    # ---------- 解析回调 ----------

    def handle_starttag(self, tag, attrs):
        tag = tag.lower()
        self._stack.append(tag)

        attr = {k.lower(): (v or "") for k, v in attrs}

        if tag in ("script", "style"):
            self._in_text_tag = True
            self._text_tag = tag

        # <base href> 会改变后续所有相对路径的基准
        if tag == "base" and attr.get("href"):
            self.base_url = self._abs(attr["href"])
            self.result.base_url = self.base_url

        # <meta> 里的封面图 / 视频地址
        if tag == "meta":
            name = (attr.get("property") or attr.get("name") or "").lower()
            content = attr.get("content", "")
            if name in META_IMAGE_NAMES and content:
                kind = "video" if "video" in name or "stream" in name else (
                    "audio" if "audio" in name else "image")
                self._add(content, kind, "meta:" + name)
            return

        # 媒体与资源标签
        if tag in TAG_ATTRS:
            attrs_to_read, default_kind = TAG_ATTRS[tag]
            for name in dict.fromkeys(attrs_to_read):  # 去重保序
                value = attr.get(name)
                if not value:
                    continue
                is_srcset = "srcset" in name
                urls = parse_srcset(value) if is_srcset else [value]
                for url in urls:
                    kind = guess_kind(url)
                    if kind == "other" and default_kind:
                        kind = default_kind
                    elif tag == "source":
                        parent = self._parent_of(tag)
                        kind = {"video": "video", "audio": "audio",
                                "picture": "image"}.get(parent or "", kind)
                    self._add(url, kind, f"<{tag} {name}>")
            return

        # <a href>：只有带资源扩展名时才当资源，否则是待爬页面
        if tag == "a" and attr.get("href"):
            href = attr["href"]
            absolute = self._abs(href)
            if is_bad_url(href):
                return
            if guess_kind(absolute) in ("image", "video", "audio", "font", "stream"):
                self._add(href, None, "<a href>")
            else:
                self.result.page_links.append(absolute)
            return

        # <link>：样式表单独解析，manifest/m3u8 当资源
        if tag == "link" and attr.get("href"):
            rel = (attr.get("rel") or "").lower()
            href = attr["href"]
            if "stylesheet" in rel:
                self.result.css_urls.append(self._abs(href))
            elif guess_kind(self._abs(href)) in ("image", "video", "audio",
                                                 "font", "stream") or "icon" in rel:
                self._add(href, None, f"<link rel={rel}>")
            return

        # iframe：很多站点的视频其实是 iframe 嵌进来的播放器
        if tag == "iframe" and attr.get("src"):
            bucket = (self.result.page_links if self.follow_iframes
                      else self.result.iframe_urls)
            bucket.append(self._abs(attr["src"]))
            return

        # 内联 style 里的 background-image
        style = attr.get("style")
        if style:
            for url in extract_css_urls(style):
                self._add(url, None, f"<{tag} style>")

    def handle_startendtag(self, tag, attrs):
        self.handle_starttag(tag, attrs)
        self.handle_endtag(tag)

    def handle_endtag(self, tag):
        tag = tag.lower()
        # 把栈回退到该标签的位置，容错不规范嵌套
        for i in range(len(self._stack) - 1, -1, -1):
            if self._stack[i] == tag:
                del self._stack[i:]
                break
        self._in_text_tag = False

    def handle_data(self, data):
        if self._in_text_tag and data:
            self._text_chunks.append((self._text_tag or "script", data))

    # ---------- 收尾 ----------

    def finish(self) -> Extraction:
        """解析收尾：补扫 script / style 正文里藏的地址。

        style 和 script 走不同规则——CSS 的 url() 语法只在 style 里成立，
        套到 JS 上会把 URL.createObjectURL(ms) 这类调用误判成资源地址。
        """
        css_text = "".join(t for tag, t in self._text_chunks if tag == "style")
        script_text = "".join(t for tag, t in self._text_chunks if tag == "script")

        if css_text:
            for url in extract_css_urls(css_text):
                self._add(url, None, "<style>")
            # <style> 里也可能直接写完整 URL
            for url, kind in scan_text_urls(css_text):
                self._add(url, kind, "<style>")

        # JS 配置里的图片/视频直链，m3u8 大多藏在这里
        if script_text and self.scan_scripts:
            for url, kind in scan_text_urls(script_text):
                self._add(url, kind, "<script>")

        return self.result


def _make_resource(url: str, kind: Optional[str], source: str, referer: str):
    from .models import Resource
    resolved = kind or guess_kind(url)
    return Resource(url=url, kind=resolved, source=source, referer=referer)


def scan_text_urls(text: str) -> list[tuple[str, Optional[str]]]:
    """从任意文本（JS、内联脚本、JSON）里挖资源地址。

    返回 (url, kind) 列表。这是 m3u8 / 视频直链的主要来源。
    """
    found: list[tuple[str, Optional[str]]] = []
    seen: set[str] = set()
    for regex in (QUOTED_URL_RE, ROOT_URL_RE, BARE_URL_RE):
        for match in regex.finditer(text):
            url = match.group("url") if "url" in match.groupdict() else match.group(1)
            url = url.strip()
            if not url or url in seen:
                continue
            seen.add(url)
            found.append((url, guess_kind(url)))
    return found


def extract_css_urls(css_text: str) -> list[str]:
    """提取 CSS 里所有 url(...) 的地址，跳过 data: 和纯渐变。"""
    urls = []
    for match in CSS_URL_RE.finditer(css_text):
        url = match.group("url").strip()
        if not url or url.startswith("data:") or url.startswith("#"):
            continue
        urls.append(url)
    return urls


def extract_html(html: str, base_url: str, *, scan_scripts: bool = True,
                 follow_iframes: bool = False) -> Extraction:
    """提取入口：先找 <base>，再解析全文。"""
    match = BASE_HREF_RE.search(html)
    effective_base = urljoin(base_url, match.group(1)) if match else base_url

    parser = HtmlExtractor(effective_base, scan_scripts=scan_scripts,
                           follow_iframes=follow_iframes)
    try:
        parser.feed(html)
        parser.close()
    except Exception:
        # HTML 不规范时 HTMLParser 可能抛错，已经收集到的结果仍然有效
        pass
    return parser.finish()


def decode_data_uri(uri: str) -> tuple[bytes, str]:
    """解码 data: URI，返回 (字节, 建议扩展名)。

    失败时返回空字节，调用方跳过即可。
    """
    try:
        header, payload = uri.split(",", 1)
    except ValueError:
        return b"", ""
    meta = header[5:]  # 去掉 "data:"
    ext = "bin"
    mime = meta.split(";")[0]
    mime_to_ext = {
        "image/jpeg": "jpg", "image/png": "png", "image/gif": "gif",
        "image/webp": "webp", "image/svg+xml": "svg", "image/x-icon": "ico",
        "image/avif": "avif", "image/bmp": "bmp",
        "video/mp4": "mp4", "audio/mpeg": "mp3",
    }
    ext = mime_to_ext.get(mime.lower(), ext)
    try:
        if ";base64" in meta.lower():
            return base64.b64decode(payload, validate=False), ext
        from urllib.parse import unquote_to_bytes
        return unquote_to_bytes(payload), ext
    except (binascii.Error, ValueError):
        return b"", ext
