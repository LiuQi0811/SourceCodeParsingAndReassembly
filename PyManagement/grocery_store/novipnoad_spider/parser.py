#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
页面解析模块 - 解析列表页、详情页、分类页、搜索页
兼容 MacCms/AppleCMS 等常见影视站模板
"""
import re
import json
import logging
from urllib.parse import urljoin, urlparse
from bs4 import BeautifulSoup

from config import BASE_URL

logger = logging.getLogger(__name__)


class PageParser:
    """页面解析器"""

    def __init__(self, base_url=BASE_URL):
        self.base_url = base_url

    def _soup(self, html):
        return BeautifulSoup(html, "lxml")

    # ======================== 首页解析 ========================
    def parse_home(self, html):
        """解析首页，提取分类入口、推荐、热门、更新列表"""
        soup = self._soup(html)
        data = {
            "categories": self._extract_categories(soup),
            "recommends": [],
            "hot_movies": [],
            "latest_updates": [],
            "slides": [],
        }

        # 轮播图
        for slide in soup.select(".slide li, .swiper-slide, .focus li, #slides li"):
            a = slide.find("a")
            img = slide.find("img")
            if a and img:
                data["slides"].append({
                    "title": img.get("alt", a.get("title", "")),
                    "url": urljoin(self.base_url, a.get("href", "")),
                    "cover": self._abs_url(img.get("data-src") or img.get("src", "")),
                })

        # 通用提取：各类列表区块
        for item in soup.select(".list-item, .video-item, .movie-item, .stui-vodlist li, .module-items .module-item, .public-list-box"):
            info = self._extract_item(item)
            if info:
                data["latest_updates"].append(info)

        # 热门/推荐
        for item in soup.select(".hot-list li, .rank-list li, .recommend li, .side-rank li, .top-list li"):
            info = self._extract_item(item)
            if info:
                data["hot_movies"].append(info)

        # 去重
        for key in ["recommends", "hot_movies", "latest_updates"]:
            seen = set()
            unique = []
            for item in data[key]:
                if item.get("url") and item["url"] not in seen:
                    seen.add(item["url"])
                    unique.append(item)
            data[key] = unique

        logger.info(f"首页解析完成: 分类{len(data['categories'])}个, 轮播{len(data['slides'])}个, 最新{len(data['latest_updates'])}个, 热门{len(data['hot_movies'])}个")
        return data

    def _extract_categories(self, soup):
        """提取分类导航链接"""
        cats = {}
        nav_selectors = [
            ".nav a", ".navbar a", ".header-nav a", ".menu a",
            ".stui-header__menu a", ".module-tab a", "nav a",
            ".category a", "#nav a"
        ]
        for sel in nav_selectors:
            for a in soup.select(sel):
                href = a.get("href", "")
                text = a.get_text(strip=True)
                if not text or text in ["首页", "Home", "主页"]:
                    continue
                # 过滤掉非分类链接
                if any(kw in href for kw in ["/type/", "/list/", "/category/", "/show/", "/channel/", "/v/"]):
                    cats[text] = urljoin(self.base_url, href)
                elif href.startswith("/") and not href.startswith(("/search", "/login", "/reg", "/user", "/about")):
                    cats[text] = urljoin(self.base_url, href)
        return cats

    def _extract_item(self, item_elem):
        """从列表项元素中提取信息"""
        a = item_elem.find("a", href=True)
        if not a:
            return None
        url = urljoin(self.base_url, a.get("href", ""))
        if not self._is_detail_url(url):
            return None

        img = a.find("img") or item_elem.find("img")
        title = ""
        cover = ""
        if img:
            title = img.get("alt", "")
            cover = img.get("data-src") or img.get("data-original") or img.get("src", "")
            cover = self._abs_url(cover)
        if not title:
            title = a.get("title", "") or a.get_text(strip=True)

        # 副标题、年份、评分、状态
        subtitle = ""
        sub_tag = item_elem.select_one(".sub, .note, .text-muted, .module-item-note, .other, .pic-text")
        if sub_tag:
            subtitle = sub_tag.get_text(strip=True)

        score = ""
        score_tag = item_elem.select_one(".score, .rating, .point, .module-item-rating")
        if score_tag:
            score = score_tag.get_text(strip=True)

        status = ""
        status_tag = item_elem.select_one(".status, .tag, .module-item-tag, .hd")
        if status_tag:
            status = status_tag.get_text(strip=True)

        return {
            "title": title,
            "url": url,
            "cover": cover,
            "subtitle": subtitle,
            "score": score,
            "status": status,
        }

    def _is_detail_url(self, url):
        """判断是否为详情页链接"""
        path = urlparse(url).path
        return bool(re.search(r'/(v|detail|video|play|movie|tv|show)/\d+\.html|/\d+\.html$|/v/\d+|/video/\d+', path))

    def _abs_url(self, url):
        """转为绝对 URL"""
        if not url:
            return ""
        if url.startswith("//"):
            return "https:" + url
        return urljoin(self.base_url, url)

    # ======================== 列表页/分类页解析 ========================
    def parse_list(self, html):
        """解析分类/列表页，提取视频条目和分页信息"""
        soup = self._soup(html)
        items = []

        # 多种列表布局兼容
        selectors = [
            ".stui-vodlist li", ".module-items .module-item",
            ".list-item", ".video-item", ".movie-item",
            ".public-list-box", ".video-list li", ".content-list li",
            "ul.myui-vodlist li", "ul.vodlist li",
            ".col-md-6.col-sm-4.col-xs-3",
            "ul li:has(a[href*='.html'])"
        ]
        seen_urls = set()
        for sel in selectors:
            for item in soup.select(sel):
                info = self._extract_item(item)
                if info and info["url"] not in seen_urls:
                    seen_urls.add(info["url"])
                    items.append(info)

        # 分页
        pagination = self._extract_pagination(soup)

        logger.info(f"列表页解析完成: {len(items)} 条内容, 总页数: {pagination.get('total_pages', '?')}")
        return {"items": items, "pagination": pagination}

    def _extract_pagination(self, soup):
        """提取分页信息"""
        pages = {
            "current_page": 1,
            "total_pages": 1,
            "next_url": "",
            "page_urls": [],
        }

        page_selectors = [
            ".pagination a", ".page a", ".stui-page a",
            ".page-item a", ".page-list a", "#page a", "ul.pagination a"
        ]
        for sel in page_selectors:
            for a in soup.select(sel):
                href = a.get("href", "")
                text = a.get_text(strip=True)
                if href and not href.startswith("#") and not href.startswith("javascript"):
                    pages["page_urls"].append(urljoin(self.base_url, href))
                    if text.isdigit():
                        pages["total_pages"] = max(pages["total_pages"], int(text))
                if "下一页" in text or "next" in text.lower():
                    pages["next_url"] = urljoin(self.base_url, href)
                if "active" in (a.get("class") or []) or "cur" in (a.get("class") or []):
                    if text.isdigit():
                        pages["current_page"] = int(text)

        # 备选：从 JS 中提取总页数
        if pages["total_pages"] == 1:
            page_match = re.search(r'(?:total|pageCount|totalPage|page_total|pages)\s*[:=]\s*["\']?(\d+)', soup.text)
            if page_match:
                pages["total_pages"] = int(page_match.group(1))

        return pages

    # ======================== 详情页解析 ========================
    def parse_detail(self, html, url=""):
        """解析视频详情页"""
        soup = self._soup(html)
        info = {
            "title": "",
            "cover": "",
            "description": "",
            "director": "",
            "actors": "",
            "category": "",
            "region": "",
            "language": "",
            "release_date": "",
            "update_status": "",
            "score": "",
            "play_urls": [],  # [{source_name, episodes: [{name, url}]}]
            "related_videos": [],
            "detail_url": url,
        }

        # 标题
        title_tags = soup.select("h1, .title, .vod-title, .stui-content__detail h1, .video-title, .movie-title h1, h2.title")
        for t in title_tags:
            title_text = t.get_text(strip=True)
            if title_text:
                info["title"] = title_text
                break
        if not info["title"]:
            title_tag = soup.find("title")
            if title_tag:
                info["title"] = title_tag.get_text(strip=True).split("-")[0].split("_")[0].strip()

        # 封面
        cover_sels = [".vod-img img", ".stui-content__thumb img", ".detail-pic img",
                      ".poster img", ".movie-img img", ".module-item-pic img", "img.lazyload"]
        for sel in cover_sels:
            img = soup.select_one(sel)
            if img:
                info["cover"] = self._abs_url(img.get("data-src") or img.get("data-original") or img.get("src", ""))
                if info["cover"] and not info["cover"].endswith(".gif"):
                    break

        # 简介
        desc_sels = [".vod-content .desc", ".stui-content__desc", ".detail-desc",
                     ".movie-intro", ".desc .sketch", ".content .intro", "p.desc", ".plot-content"]
        for sel in desc_sels:
            desc_tag = soup.select_one(sel)
            if desc_tag:
                info["description"] = desc_tag.get_text(strip=True)
                if len(info["description"]) > 10:
                    break

        # 详细信息（导演、演员、类型等）
        info_block = soup.select_one(".vod-info, .stui-content__detail, .detail-info, .video-info, .movie-info")
        if info_block:
            text = info_block.get_text("\n", strip=True)
            for label, key in [
                ("导演", "director"), ("主演", "actors"), ("演员", "actors"),
                ("类型", "category"), ("地区", "region"), ("语言", "language"),
                ("上映", "release_date"), ("更新", "update_status"), ("状态", "update_status"),
                ("评分", "score"), ("年代", "release_date"),
            ]:
                m = re.search(rf'{label}[：:\s]*([^\n]+)', text)
                if m:
                    info[key] = m.group(1).strip()

        # 播放列表（关键：多播放源）
        play_sources = self._extract_play_sources(soup, html)
        info["play_urls"] = play_sources

        # 相关推荐
        for item in soup.select(".related-list li, .recommend-list li, .stui-vodlist__bd li, .also-like li"):
            rel = self._extract_item(item)
            if rel:
                info["related_videos"].append(rel)

        logger.info(f"详情解析: {info['title']}, 播放源数: {len(play_sources)}")
        return info

    def _extract_play_sources(self, soup, html):
        """提取播放源和各集链接"""
        sources = []

        # ==== 方式1：标准 MacCms/AppleCMS 播放列表 ====
        # 播放源标题
        source_tabs = soup.select(".anthology-tab .swiper-slide, .stui-vodlist__head h3, .source-tab, .player_source a, .play-source a, .source-list li a, #source a")
        # 各源的剧集列表
        episode_lists = soup.select(".anthology-list ul, .stui-content__playlist, .play-list ul, .episode-list ul, .module-play-list, .playlist ul")

        if episode_lists:
            for idx, ep_list in enumerate(episode_lists):
                source_name = f"线路{idx + 1}"
                if idx < len(source_tabs):
                    source_name = source_tabs[idx].get_text(strip=True)
                episodes = []
                for ep in ep_list.find_all("a", href=True):
                    ep_name = ep.get_text(strip=True)
                    ep_url = urljoin(self.base_url, ep.get("href", ""))
                    episodes.append({"name": ep_name, "url": ep_url})
                if episodes:
                    sources.append({"source_name": source_name, "episodes": episodes})

        # ==== 方式2：从 JS 中解析播放配置 ====
        if not sources:
            # 匹配 MacCms player_aaaa
            player_match = re.search(r'var\s+player_aaaa\s*=\s*(\{[^;]+\})', html, re.S)
            if player_match:
                try:
                    player_text = player_match.group(1)
                    # JS 对象转 JSON
                    player_text = re.sub(r'(\w+)\s*:', r'"\1":', player_text)
                    player_text = player_text.replace("'", '"')
                    player_text = re.sub(r',\s*}', '}', player_text)
                    player_cfg = json.loads(player_text)
                    ep_url = player_cfg.get("url", "")
                    ep_name = player_cfg.get("title", player_cfg.get("name", "播放"))
                    sources.append({
                        "source_name": "主线路",
                        "episodes": [{"name": ep_name, "url": ep_url, "raw_config": player_cfg}]
                    })
                except Exception as e:
                    logger.debug(f"解析 player_aaaa 失败: {e}")

        # ==== 方式3：查找 iframe 播放器 ====
        iframes = soup.find_all("iframe", src=True)
        for iframe in iframes:
            src = urljoin(self.base_url, iframe.get("src", ""))
            if any(k in src for k in ["player", "play", "v.php", "/p/", "m3u8"]):
                sources.append({
                    "source_name": "iframe播放器",
                    "episodes": [{"name": "播放", "url": src, "is_iframe": True}]
                })

        return sources

    # ======================== 播放页解析 ========================
    def parse_play_page(self, html, url=""):
        """解析播放页面，提取视频真实地址"""
        soup = self._soup(html)
        result = {
            "player_js": "",
            "player_config": {},
            "video_url": "",
            "m3u8_url": "",
            "iframe_url": "",
            "js_files": [],
        }

        # 收集所有 script 源码（用于解密）
        scripts = []
        for script in soup.find_all("script"):
            src = script.get("src", "")
            if src:
                result["js_files"].append(urljoin(self.base_url, src))
            else:
                if script.string:
                    scripts.append(script.string)
        result["player_js"] = "\n".join(scripts)

        # iframe
        iframe = soup.find("iframe", src=True)
        if iframe:
            result["iframe_url"] = urljoin(self.base_url, iframe.get("src", ""))

        # 从 JS 中提取视频 URL 模式
        url_patterns = [
            re.compile(r'(?:url|src|video)\s*[:=]\s*["\']([^"\']+\.(?:m3u8|mp4)(?:[^"\']*)?)["\']'),
            re.compile(r'"(?:url|src|video_url|play_url)"\s*:\s*"([^"]+)"'),
            re.compile(r'(https?://[^"\'\s]+\.(?:m3u8|mp4)[^"\'\s]*)'),
        ]
        for script_text in scripts:
            for pat in url_patterns:
                m = pat.search(script_text)
                if m:
                    found = m.group(1).replace("\\/", "/")
                    if "m3u8" in found:
                        result["m3u8_url"] = found
                    else:
                        result["video_url"] = found
                    break

        # 解析 player_aaaa 配置
        from decryptor import decryptor
        result["player_config"] = decryptor.parse_player_config(html, result["player_js"])

        return result

    # ======================== 搜索页解析 ========================
    def parse_search(self, html):
        """解析搜索结果页"""
        return self.parse_list(html)

    # ======================== 分类链接生成 ========================
    def build_category_urls(self, max_pages_per_category=10):
        """生成各分类的分页 URL 模板（具体页数需要实际访问后确定）"""
        # MacCms 标准分页结构
        templates = []
        type_ids = {
            "电视剧": [1, 2], "电影": [3, 4], "动漫": [5], "综艺": [6],
            "日剧": [7], "韩剧": [8], "美剧": [9], "泰剧": [10],
            "港剧": [11], "台剧": [12],
        }
        for name, tids in type_ids.items():
            for tid in tids:
                for page in range(1, max_pages_per_category + 1):
                    templates.append({
                        "category": name,
                        "tid": tid,
                        "page": page,
                        "url": urljoin(self.base_url, f"/type/{tid}-{page}.html"),
                    })
        return templates


parser = PageParser()
