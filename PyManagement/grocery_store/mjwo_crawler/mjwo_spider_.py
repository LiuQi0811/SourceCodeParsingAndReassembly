#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
美剧窝 (https://www.mjwo.net/) 全站爬虫
基于 MacCMS v10 苹果CMS模板结构
功能：抓取全站影视列表、详情页、播放页信息，支持数据导出为JSON/CSV，支持断点续爬
"""

import os
import re
import json
import csv
import time
import logging
import hashlib
import random
from urllib.parse import urljoin, urlparse
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime

import requests
from bs4 import BeautifulSoup

# ============ 配置区 ============
BASE_URL = "https://www.mjwo.net"
HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
    "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
    "Referer": BASE_URL,
    "Connection": "keep-alive",
}
TIMEOUT = 15
DELAY_RANGE = (0.8, 2.0)  # 请求间隔随机延迟(秒)
MAX_WORKERS = 2            # 并发线程数（不要太高，避免给服务器压力）
MAX_RETRIES = 3            # 重试次数
PAGE_TIMEOUT = 20          # 单页请求超时

# 输出目录
OUTPUT_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "output")
os.makedirs(OUTPUT_DIR, exist_ok=True)

# 数据文件
DB_FILE = os.path.join(OUTPUT_DIR, "crawled_db.json")       # 已爬ID记录（断点续爬）
DETAIL_JSON = os.path.join(OUTPUT_DIR, "movies_detail.json")  # 详情数据
DETAIL_CSV = os.path.join(OUTPUT_DIR, "movies_detail.csv")   # CSV表格

# 全站分类（从导航菜单提取）
CATEGORIES = {
    "dianying": "电影",
    "meiju": "美剧",
    "gangju": "港剧",
    "dongzuopian": "动作片",
    "xijupian": "喜剧片",
    "aiqingpian": "爱情片",
    "kehuanpian": "科幻片",
    "kongbupian": "恐怖片",
    "juqingpian": "剧情片",
    "zhanzhengpian": "战争片",
    "donghuapian": "动画片",
}

# ============ 日志配置 ============
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[
        logging.FileHandler(os.path.join(OUTPUT_DIR, "crawler.log"), encoding="utf-8"),
        logging.StreamHandler(),
    ],
)
logger = logging.getLogger(__name__)


class MjwoCrawler:
    """美剧窝全站爬虫"""

    def __init__(self):
        self.session = requests.Session()
        self.session.headers.update(HEADERS)
        self.crawled_ids = self._load_db()
        self.all_movies = []
        self.lock = None  # 线程锁，运行时创建

    # ---------- 工具方法 ----------
    def _load_db(self):
        """加载已爬记录（断点续爬）"""
        if os.path.exists(DB_FILE):
            with open(DB_FILE, "r", encoding="utf-8") as f:
                return set(json.load(f))
        return set()

    def _save_db(self):
        """保存已爬记录"""
        with open(DB_FILE, "w", encoding="utf-8") as f:
            json.dump(list(self.crawled_ids), f, ensure_ascii=False)

    def _random_delay(self):
        time.sleep(random.uniform(*DELAY_RANGE))

    def _request(self, url, retries=MAX_RETRIES):
        """带重试的HTTP请求"""
        for i in range(retries):
            try:
                resp = self.session.get(url, timeout=TIMEOUT)
                resp.encoding = resp.apparent_encoding or "utf-8"
                if resp.status_code == 200:
                    return resp
                logger.warning(f"状态码 {resp.status_code}: {url} (重试 {i+1}/{retries})")
            except requests.exceptions.RequestException as e:
                logger.warning(f"请求失败 {url}: {type(e).__name__} (重试 {i+1}/{retries})")
                time.sleep(2 ** i)
            except Exception as e:
                logger.warning(f"请求失败 {url}: {e} (重试 {i+1}/{retries})")
                time.sleep(2 ** i)
        return None

    @staticmethod
    def _extract_id(url):
        """从URL中提取视频ID: /vod/12345/ -> 12345"""
        m = re.search(r"/vod/(\d+)/?", url)
        return m.group(1) if m else None

    @staticmethod
    def _clean_text(text):
        """清理空白字符"""
        if not text:
            return ""
        return re.sub(r"\s+", " ", text).strip()

    # ---------- 列表页抓取 ----------
    def get_max_page(self, category):
        """获取分类的最大页数"""
        url = f"{BASE_URL}/type/{category}/"
        resp = self._request(url)
        if not resp:
            return 1
        soup = BeautifulSoup(resp.text, "lxml")
        # 查找分页尾页链接
        page_links = soup.select(f'a[href*="/{category}-"]')
        max_page = 1
        for a in page_links:
            href = a.get("href", "")
            m = re.search(rf"/{category}-(\d+)/", href)
            if m:
                p = int(m.group(1))
                if p > max_page:
                    max_page = p
        # 也查找"尾页"
        end_link = soup.find("a", string=re.compile(r"尾页|末页"))
        if end_link:
            href = end_link.get("href", "")
            m = re.search(rf"/{category}-(\d+)/", href)
            if m:
                max_page = int(m.group(1))
        logger.info(f"分类 [{CATEGORIES.get(category, category)}] 共 {max_page} 页")
        return max_page

    def parse_list_page(self, category, page):
        """解析列表页，返回该页所有视频的ID和链接"""
        if page == 1:
            url = f"{BASE_URL}/type/{category}/"
        else:
            url = f"{BASE_URL}/type/{category}-{page}/"
        resp = self._request(url)
        if not resp:
            return []
        soup = BeautifulSoup(resp.text, "lxml")
        items = []
        # MacCMS 常见列表选择器
        for a in soup.select("a[href*='/vod/']"):
            href = a.get("href", "")
            vid = self._extract_id(href)
            title = self._clean_text(a.get("title") or a.text)
            if vid and title and vid not in [x["id"] for x in items]:
                items.append({
                    "id": vid,
                    "title": title,
                    "url": urljoin(BASE_URL, href),
                    "category": category,
                    "category_name": CATEGORIES.get(category, category),
                })
        return items

    # ---------- 详情页抓取 ----------
    def parse_detail_page(self, vid, category_info=None):
        """解析详情页"""
        url = f"{BASE_URL}/vod/{vid}/"
        resp = self._request(url)
        if not resp:
            return None
        soup = BeautifulSoup(resp.text, "lxml")

        data = {
            "id": vid,
            "url": url,
            "crawl_time": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        }

        # 标题
        title_tag = soup.find("h1") or soup.find("h2")
        if title_tag:
            data["title"] = self._clean_text(title_tag.text).replace("(20", " (20").strip()
            # 尝试分离年份
            ym = re.search(r"\((\d{4})\)", data["title"])
            if ym:
                data["year"] = ym.group(1)

        # meta 信息
        kw = soup.find("meta", attrs={"name": "keywords"})
        if kw:
            data["meta_keywords"] = kw.get("content", "")
        desc = soup.find("meta", attrs={"name": "description"})
        if desc:
            data["meta_description"] = desc.get("content", "")

        # 从data/dt/dd或面包屑下面的信息块提取详情
        info_block = soup.select_one(".myui-content__detail, .vod-detail, .content_detail, #desc")
        info_text = ""
        if info_block:
            info_text = self._clean_text(info_block.get_text(" ", strip=True))

        # 豆瓣评分（兼容HTML标签分隔）
        score_match = re.search(r"豆瓣评分[：:]?</span>[\s<tag/=\"a-z0-9A-Z\s]*>?\s*([\d.]+)", resp.text)
        if not score_match:
            score_match = re.search(r"豆瓣评分[：:]\s*([\d.]+)", resp.text)
        if score_match:
            data["douban_score"] = score_match.group(1)

        # 导演、演员（从链接块提取）
        # MacCMS模板常见结构：<span class="text-muted">导演：</span><a ...>导演名</a>
        def _extract_links_after_label(label):
            pat = rf'{label}[：:]?</span>(.*?)</p>|{label}[：:]?</span>(.*?)(?=<span|</dd>|</div>)'
            m = re.search(pat, resp.text, re.S)
            if not m:
                return ""
            block = (m.group(1) or m.group(2) or "")
            names = re.findall(r'<a[^>]*>([^<]+)</a>', block)
            return " / ".join([self._clean_text(n) for n in names if self._clean_text(n)])

        # 更通用：直接定位标签后找相邻a标签
        def _extract_field(field_name):
            # 匹配字段名（可能在span内）后的所有<a>标签内容（标签间可能有&nbsp;空白）
            pat = rf'{field_name}[：:]</span>\s*((?:(?:<a[^>]*>[^<]+</a>)\s*(?:&nbsp;)?\s*)+)'
            m = re.search(pat, resp.text)
            if m:
                block = m.group(1)
                names = re.findall(r'<a[^>]*>([^<]+)</a>', block)
                if names:
                    return " / ".join([self._clean_text(n) for n in names if self._clean_text(n)])
            # 备选：宽松纯文本
            pat2 = rf'{field_name}[：:]\s*([^<\n]+?)(?:<span|</p>|</div>|$)'
            m2 = re.search(pat2, resp.text)
            return self._clean_text(m2.group(1)) if m2 else ""

        # 从 .data 块提取类型/年份/地区（MacCMS特殊结构）
        # 匹配 visible-xs 的数据行，包含年份/地区/类型链接（排除又名/别名行）
        data_blocks = re.findall(r'<p[^>]*class="data visible-xs"[^>]*>(.*?)</p>', resp.text, re.S)
        for block in data_blocks:
            # 块中应包含<a标签表示有类型链接，且有/分隔
            if '<a' in block and '/' in block:
                # 格式: 2023/美国/<a...>剧情</a>&nbsp;<a...>喜剧</a>
                parts = re.split(r'/', block, maxsplit=2)
                if len(parts) >= 1:
                    year_m = re.match(r'\s*(\d{4})\s*$', parts[0])
                    if year_m and not data.get("year"):
                        data["year"] = year_m.group(1)
                if len(parts) >= 2:
                    area = self._clean_text(re.sub(r'<[^>]+>', '', parts[1]))
                    if area and not data.get("area") and len(area) < 20:
                        data["area"] = area
                if len(parts) >= 3:
                    types_in_block = re.findall(r'<a[^>]*>([^<]+)</a>', parts[2])
                    if types_in_block and not data.get("type"):
                        data["type"] = " / ".join(types_in_block)
                break

        data["director"] = _extract_field("导演")
        data["actor"] = _extract_field("主演")
        if not data.get("type"):
            data["type"] = _extract_field("类型")
        if not data.get("area"):
            data["area"] = _extract_field("地区")
        data["language"] = _extract_field("语言")

        # 更新状态（集数信息如"更新至6集"、"10集全"、"HD高清"）
        status_pats = [
            r"(更新至\s*\d+\s*集)",
            r"(\d+\s*集全)",
            r"(\d+\s*全集)",
            r"(HD高清|BD高清|DVD|TS抢先)",
            r"(已完结)",
        ]
        for pat in status_pats:
            m = re.search(pat, resp.text)
            if m:
                data["update_status"] = m.group(1)
                break

        # 剧情简介
        desc_block = soup.select_one(".myui-content__desc, .vod-content, .content_desc, .desc, #desc")
        if not desc_block:
            # 找"剧情简介"标题后的内容
            js_title = soup.find(string=re.compile(r"剧情简介|内容简介|简介"))
            if js_title:
                parent = js_title.find_parent()
                if parent:
                    desc_block = parent.find_next("p") or parent.find_next("div")
        if desc_block:
            data["description"] = self._clean_text(desc_block.get_text(" ", strip=True))
        if not data.get("description") and data.get("meta_description"):
            data["description"] = data["meta_description"]

        # 封面图
        cover = soup.select_one(".myui-content__thumb img, .vod-img img, .pic img")
        if cover:
            data["cover"] = urljoin(BASE_URL, cover.get("data-original") or cover.get("src", ""))

        # 播放列表（集数链接）
        episodes = []
        play_links = soup.select("a[href*='/play/']")
        for a in play_links:
            ep_name = self._clean_text(a.text)
            ep_href = urljoin(BASE_URL, a.get("href", ""))
            if ep_name and "/play/" in ep_href:
                # 从URL解析：/play/23042-1-1/  -> vod-sid-ep
                m = re.search(r"/play/(\d+)-(\d+)-(\d+)/", ep_href)
                ep_info = {
                    "name": ep_name,
                    "url": ep_href,
                }
                if m:
                    ep_info["vid"] = m.group(1)
                    ep_info["sid"] = m.group(2)
                    ep_info["episode"] = m.group(3)
                episodes.append(ep_info)
        # 去重
        seen = set()
        unique_eps = []
        for ep in episodes:
            key = ep["url"]
            if key not in seen:
                seen.add(key)
                unique_eps.append(ep)
        data["episodes"] = unique_eps
        data["total_episodes"] = len(unique_eps)

        # 分类信息
        if category_info:
            data["category"] = category_info.get("category")
            data["category_name"] = category_info.get("category_name")

        return data

    # ============ 视频直链解密（核心破解） ============
    # 网站encrypt=0时，player_aaaa.url 是一个视频ID（如 CODE2MDlfMGp1aGU=）
    # 该ID传递给第三方聚合API edge.apiimg.com/super.php 后返回真实 m3u8 直链
    # 支持线路1-6，线路1通常有token+expires时效，其他线路是永久直链

    JUHE_API = "https://edge.apiimg.com/super.php?id={video_id}"

    def resolve_m3u8_from_video_id(self, video_id):
        """
        通过聚合API解析视频ID，返回真实m3u8播放直链列表
        :param video_id: player_aaaa.url 中的加密ID (如 CODE2MDlfMGp1aGU=)
        :return: [{"name": "线路 1", "url": "https://xxx.m3u8"}, ...]
        """
        if not video_id:
            return []
        api_url = self.JUHE_API.format(video_id=video_id)
        headers = dict(HEADERS)
        headers["Referer"] = BASE_URL + "/"
        for i in range(MAX_RETRIES):
            try:
                resp = requests.get(api_url, headers=headers, timeout=TIMEOUT)
                if resp.status_code != 200:
                    continue
                text = resp.text
                # 提取 lineList 数组（合法JSON片段）
                m = re.search(r'lineList:\s*(\[.*?\])\s*,\s*\n\s*poster', text, re.DOTALL)
                if not m:
                    # 备选：更宽松匹配
                    m = re.search(r'lineList:\s*(\[.*?\])', text, re.DOTALL)
                if m:
                    arr = json.loads(m.group(1))
                    return [{"name": l["name"], "url": l["url"]} for l in arr]
            except Exception as e:
                logger.debug(f"解析m3u8失败 {video_id}: {e}")
                time.sleep(1)
        return []

    def parse_play_page(self, play_url, resolve_m3u8=True):
        """解析播放页，提取视频直链（m3u8/mp4等）
        :param resolve_m3u8: 是否进一步解析聚合API获取真实m3u8直链
        """
        resp = self._request(play_url)
        if not resp:
            return {}
        result = {"play_url": play_url}

        # MacCMS 播放器JSON数据（主要来源）
        # 用括号匹配精确提取 player_aaaa
        start = resp.text.find('var player_aaaa=')
        player_data = None
        if start >= 0:
            start += len('var player_aaaa=')
            depth = 0
            i = start
            in_str = False
            escape = False
            while i < len(resp.text):
                c = resp.text[i]
                if escape:
                    escape = False
                elif c == '\\':
                    escape = True
                elif c == '"':
                    in_str = not in_str
                elif not in_str:
                    if c == '{':
                        depth += 1
                    elif c == '}':
                        depth -= 1
                        if depth == 0:
                            break
                i += 1
            if depth == 0:
                try:
                    player_data = json.loads(resp.text[start:i+1])
                    result["player_data"] = player_data
                    result["next_url"] = urljoin(BASE_URL, player_data.get("link_next", ""))
                    result["pre_url"] = urljoin(BASE_URL, player_data.get("link_pre", ""))
                    result["encrypted_url"] = player_data.get("url", "")
                    result["play_from"] = player_data.get("from", "")
                    result["encrypt"] = player_data.get("encrypt", 0)
                except Exception as e:
                    result["player_data_raw"] = resp.text[start:start+1000]

        # 查找直接视频链接
        for ext in ["m3u8", "mp4", "flv"]:
            m = re.search(rf'(https?://[^"\'\\\s]+\.{ext}[^"\'\\\s]*)', resp.text)
            if m:
                result["video_url"] = m.group(1).replace("\\/", "/")
                break

        # 查找iframe嵌入
        iframe = re.search(r'<iframe[^>]+src=[\'"]([^\'"]+)[\'"]', resp.text)
        if iframe:
            result["iframe_src"] = iframe.group(1)

        # === 核心：解密获取真实 m3u8 直链 ===
        if resolve_m3u8 and player_data:
            video_id = player_data.get("url", "")
            if video_id:
                # 如果是 juhe 聚合源，调用第三方API解析
                play_from = player_data.get("from", "")
                if play_from == "juhe" or video_id.startswith("CODE") or video_id.endswith("="):
                    m3u8_lines = self.resolve_m3u8_from_video_id(video_id)
                    if m3u8_lines:
                        result["m3u8_lines"] = m3u8_lines
                        # 默认为线路2（无时效限制，稳定）
                        if len(m3u8_lines) >= 2:
                            result["direct_m3u8"] = m3u8_lines[1]["url"]
                        else:
                            result["direct_m3u8"] = m3u8_lines[0]["url"]
                        logger.debug(f"  解析到 {len(m3u8_lines)} 条 m3u8 直链")

        return result

    def resolve_episode_m3u8(self, ep_info):
        """
        解析单集的m3u8直链，返回更新后的ep_info
        """
        play_url = ep_info.get("url", "")
        if not play_url:
            return ep_info
        try:
            play_data = self.parse_play_page(play_url, resolve_m3u8=True)
            if "m3u8_lines" in play_data:
                ep_info["m3u8_lines"] = play_data["m3u8_lines"]
                ep_info["direct_m3u8"] = play_data.get("direct_m3u8", "")
                ep_info["video_id"] = play_data.get("encrypted_url", "")
        except Exception as e:
            logger.warning(f"解析集数m3u8失败 {play_url}: {e}")
        return ep_info

    # ---------- 主流程 ----------
    def crawl_category(self, category, max_items=None):
        """抓取单个分类下所有列表页"""
        logger.info(f"========== 开始抓取分类: {CATEGORIES.get(category, category)} ==========")
        max_page = self.get_max_page(category)
        all_items = []
        seen_ids = set()
        for page in range(1, max_page + 1):
            items = self.parse_list_page(category, page)
            new_items = [it for it in items if it["id"] not in seen_ids]
            for it in new_items:
                seen_ids.add(it["id"])
            all_items.extend(new_items)
            logger.info(f"  [{CATEGORIES.get(category, category)}] 第 {page}/{max_page} 页，新增 {len(new_items)} 条，累计 {len(all_items)}")
            self._random_delay()
            # 如果设置了上限且已达到就提前停止
            if max_items and len(all_items) >= max_items:
                logger.info(f"  已达到上限 {max_items}，停止翻页")
                break
        return all_items

    def crawl_detail_worker(self, item):
        """线程工作函数：抓取单个详情页"""
        vid = item["id"]
        if vid in self.crawled_ids:
            return None
        self._random_delay()
        try:
            detail = self.parse_detail_page(vid, item)
            if detail:
                # 可选：解析第1集 m3u8 直链
                if with_m3u8 and detail.get("episodes"):
                    first_ep = detail["episodes"][0]
                    first_ep = self.resolve_episode_m3u8(first_ep)
                    detail["first_ep_m3u8"] = first_ep.get("direct_m3u8", "")
                    detail["first_ep_m3u8_lines"] = first_ep.get("m3u8_lines", [])
                self.crawled_ids.add(vid)
                return detail
        except Exception as e:
            logger.error(f"解析详情页失败 {vid}: {e}")
        return None

    def run(self, categories=None, max_items=None, with_m3u8=False):
        """
        运行全站爬虫
        :param categories: 指定分类列表，默认全部
        :param max_items: 限制最大抓取条数（测试用）
        :param with_m3u8: 是否同时解析每部剧第1集的m3u8直链
        """
        if categories is None:
            categories = list(CATEGORIES.keys())

        logger.info("=" * 60)
        logger.info(f"开始全站抓取，目标分类: {[CATEGORIES.get(c, c) for c in categories]}")
        logger.info(f"已爬取记录数: {len(self.crawled_ids)}")
        logger.info("=" * 60)

        # 阶段1：收集所有列表项
        all_items = []
        per_cat_max = None
        if max_items:
            # 按分类数平均分配额度
            per_cat_max = max(1, max_items // len(categories) + 5)
        for cat in categories:
            items = self.crawl_category(cat, max_items=per_cat_max)
            all_items.extend(items)
            if max_items and len(all_items) >= max_items:
                break

        # 按ID去重
        unique = {}
        for it in all_items:
            unique[it["id"]] = it
        all_items = list(unique.values())
        logger.info(f"\n列表收集完成，共 {len(all_items)} 个不重复视频")

        if max_items:
            all_items = all_items[:max_items]
            logger.info(f"测试模式，限制抓取 {max_items} 条")

        # 阶段2：多线程抓取详情
        results = []
        with ThreadPoolExecutor(max_workers=MAX_WORKERS) as executor:
            futures = {executor.submit(self.crawl_detail_worker, item): item for item in all_items}
            total = len(futures)
            done = 0
            for future in as_completed(futures):
                done += 1
                detail = future.result()
                if detail:
                    results.append(detail)
                    if done % 20 == 0 or done == total:
                        logger.info(f"详情页进度: {done}/{total}，成功: {len(results)}")
                        self._save_db()  # 定期保存进度
                        self._save_intermediate(results)
        self._save_db()
        self.all_movies = results

        # 阶段3：保存结果
        self.save_results(results)
        logger.info(f"\n抓取完成！共获取 {len(results)} 条详细数据")
        logger.info(f"数据保存在: {OUTPUT_DIR}")
        return results

    def _save_intermediate(self, results):
        """增量保存中间结果"""
        with open(DETAIL_JSON, "w", encoding="utf-8") as f:
            json.dump(results, f, ensure_ascii=False, indent=2)

    def save_results(self, results):
        """保存最终结果 JSON + CSV"""
        # JSON
        with open(DETAIL_JSON, "w", encoding="utf-8") as f:
            json.dump(results, f, ensure_ascii=False, indent=2)
        logger.info(f"JSON 已保存: {DETAIL_JSON}")

        # CSV
        if results:
            keys = ["id", "title", "year", "category_name", "douban_score", "director",
                    "actor", "type", "area", "total_episodes", "update_status",
                    "cover", "url", "description"]
            keys = [k for k in keys]
            # 补全所有key
            all_keys = set()
            for r in results:
                all_keys.update(r.keys())
            fieldnames = ["id", "title", "year", "category_name", "douban_score",
                          "director", "actor", "type", "area", "language",
                          "total_episodes", "update_status", "cover", "url",
                          "description", "meta_keywords", "crawl_time"]
            fieldnames = [k for k in fieldnames if k in all_keys]
            extra = [k for k in sorted(all_keys) if k not in fieldnames and k != "episodes"]
            fieldnames.extend(extra)

            with open(DETAIL_CSV, "w", encoding="utf-8-sig", newline="") as f:
                writer = csv.DictWriter(f, fieldnames=fieldnames, extrasaction="ignore")
                writer.writeheader()
                for r in results:
                    row = dict(r)
                    if isinstance(row.get("episodes"), list):
                        row["episodes"] = "; ".join([ep["name"] + ":" + ep["url"] for ep in row["episodes"]])
                    writer.writerow(row)
            logger.info(f"CSV 已保存: {DETAIL_CSV}")

    def crawl_single(self, url_or_id):
        """抓取单个视频（用于测试/补抓）"""
        vid = self._extract_id(url_or_id) or url_or_id
        logger.info(f"单抓视频ID: {vid}")
        detail = self.parse_detail_page(vid)
        if detail:
            print(json.dumps(detail, ensure_ascii=False, indent=2))
            return detail
        return None

    def get_play_url(self, play_url):
        """提取播放页视频源地址（深度解析）"""
        logger.info(f"解析播放页: {play_url}")
        info = self.parse_play_page(play_url)
        print(json.dumps(info, ensure_ascii=False, indent=2))
        return info


# ============ CLI 入口 ============
def main():
    import argparse
    parser = argparse.ArgumentParser(description="美剧窝 mjwo.net 全站爬虫（含 m3u8 直链解密）")
    parser.add_argument("--mode", default="all",
                        choices=["all", "list", "single", "play", "resolve", "resolve-all"],
                        help="运行模式: all=全站详情, list=仅列表, single=单条详情, "
                             "play=解析单播放页, resolve=解析单集m3u8直链, "
                             "resolve-all=解析整部剧所有集的m3u8")
    parser.add_argument("--categories", nargs="*", default=None,
                        help="指定分类，如 meiju dianying；默认全部")
    parser.add_argument("--max", type=int, default=None, help="限制最大抓取条数（测试用）")
    parser.add_argument("--url", type=str, default=None, help="单抓模式的URL/ID/播放页URL")
    parser.add_argument("--workers", type=int, default=2, help="并发线程数")
    parser.add_argument("--with-m3u8", action="store_true",
                        help="all模式下是否同时解析每部剧第1集的m3u8直链（会慢很多）")
    args = parser.parse_args()

    global MAX_WORKERS
    MAX_WORKERS = args.workers
    crawler = MjwoCrawler()

    if args.mode == "single" and args.url:
        crawler.crawl_single(args.url)

    elif args.mode == "resolve" and args.url:
        # 解析单个播放页的 m3u8 直链
        play_url = args.url if "http" in args.url else f"{BASE_URL}/play/{args.url}/"
        print(f"正在解析: {play_url}")
        info = crawler.parse_play_page(play_url, resolve_m3u8=True)
        if info.get("m3u8_lines"):
            print(f"\n✓ 成功破解，获取到 {len(info['m3u8_lines'])} 条 m3u8 直链：")
            for line in info["m3u8_lines"]:
                print(f"  [{line['name']}] {line['url']}")
        else:
            print("未能解析到m3u8直链")
            print(json.dumps(info, ensure_ascii=False, indent=2))

    elif args.mode == "resolve-all" and args.url:
        # 解析整部剧所有集的 m3u8
        vid = crawler._extract_id(args.url) or args.url
        print(f"正在获取剧集列表: ID={vid}")
        detail = crawler.parse_detail_page(vid)
        if not detail:
            print("获取详情失败")
            return
        eps = detail.get("episodes", [])
        print(f"共 {len(eps)} 集，开始解析 m3u8 直链...\n")
        results = []
        for i, ep in enumerate(eps):
            print(f"[{i+1}/{len(eps)}] {ep['name']} ... ", end="", flush=True)
            ep_info = crawler.resolve_episode_m3u8(ep)
            if ep_info.get("direct_m3u8"):
                print("✓")
                results.append({
                    "episode": ep["name"],
                    "play_url": ep["url"],
                    "direct_m3u8": ep_info["direct_m3u8"],
                    "m3u8_lines": ep_info.get("m3u8_lines", []),
                })
            else:
                print("✗")
            time.sleep(random.uniform(0.5, 1.5))

        out_file = os.path.join(OUTPUT_DIR, f"m3u8_{vid}.json")
        with open(out_file, "w", encoding="utf-8") as f:
            json.dump({
                "title": detail.get("title", ""),
                "total": len(results),
                "episodes": results,
            }, f, ensure_ascii=False, indent=2)
        print(f"\n完成！成功解析 {len(results)}/{len(eps)} 集")
        print(f"结果已保存: {out_file}")

        # 同时导出纯m3u8列表（方便用播放器/下载工具）
        txt_file = os.path.join(OUTPUT_DIR, f"m3u8_{vid}_list.txt")
        with open(txt_file, "w", encoding="utf-8") as f:
            for r in results:
                f.write(f"{r['episode']}\t{r['direct_m3u8']}\n")
        print(f"纯列表已保存: {txt_file}")

    elif args.mode == "play" and args.url:
        crawler.get_play_url(args.url)

    elif args.mode == "list":
        cats = args.categories or list(CATEGORIES.keys())
        all_items = []
        for cat in cats:
            items = crawler.crawl_category(cat)
            all_items.extend(items)
        out = os.path.join(OUTPUT_DIR, "movies_list.json")
        with open(out, "w", encoding="utf-8") as f:
            json.dump(all_items, f, ensure_ascii=False, indent=2)
        print(f"列表抓取完成，共 {len(all_items)} 条，已保存到 {out}")

    else:
        crawler.run(categories=args.categories, max_items=args.max,
                    with_m3u8=args.with_m3u8)


if __name__ == "__main__":
    main()
