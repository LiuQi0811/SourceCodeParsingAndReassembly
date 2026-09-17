from urllib.parse import urljoin
from bs4 import BeautifulSoup
from .base import BaseParser

# 常见媒体扩展名（用于 href/src/meta 直链识别）
MEDIA_EXTS = (".mp4", ".m3u8", ".webm", ".mkv", ".mov",
              ".flv", ".mpd", ".ts", ".avi")


class Bs4Parser(BaseParser):
    def parse_links(self, text: str, base_url: str) -> list[dict]:
        soup = BeautifulSoup(text, "lxml")
        links = []
        for a in soup.find_all("a", href=True):
            href = a["href"].strip()
            if href.startswith(("javascript:", "#", "mailto:", "tel:")):
                continue
            links.append({"url": urljoin(base_url, href), "type": "page"})
        return links

    def parse_resources(self, text: str, base_url: str) -> list[dict]:
        soup = BeautifulSoup(text, "lxml")
        resources = []
        seen = set()

        def add(url: str, rtype: str):
            u = urljoin(base_url, url.strip())
            if u and u not in seen:
                seen.add(u)
                resources.append({"url": u, "type": rtype})

        # <img> 及其懒加载属性
        for img in soup.find_all("img", src=True):
            add(img["src"], "img")
        for img in soup.find_all("img", attrs={"data-src": True}):
            add(img["data-src"], "img")
        for img in soup.find_all("img", attrs={"data-original": True}):
            add(img["data-original"], "img")

        # <video> / <source>
        for video in soup.find_all("video"):
            if video.get("src"):
                add(video["src"], "video")
            for source in video.find_all("source", src=True):
                add(source["src"], "video")

        # og:video 等 meta 声明
        for meta in soup.find_all("meta"):
            prop = (meta.get("property") or "").lower()
            itemprop = (meta.get("itemprop") or "").lower()
            content = (meta.get("content") or "").strip()
            if content and ("og:video" in prop or itemprop == "video"):
                add(content, "video")

        # data-video / data-video-src / data-url 等懒加载属性
        for tag in soup.find_all(attrs={"data-video": True}):
            add(tag["data-video"], "video")
        for tag in soup.find_all(attrs={"data-video-src": True}):
            add(tag["data-video-src"], "video")
        for tag in soup.find_all(attrs={"data-video-url": True}):
            add(tag["data-video-url"], "video")

        # 指向媒体文件的 <a href> 直链
        for a in soup.find_all("a", href=True):
            if a["href"].strip().lower().endswith(MEDIA_EXTS):
                add(a["href"], "video")

        return resources

    def parse_title(self, text: str) -> str:
        soup = BeautifulSoup(text, "lxml")
        if soup.title and soup.title.string:
            return soup.title.string.strip()
        return ""
