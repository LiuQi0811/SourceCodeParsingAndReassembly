#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
茶杯狐（cupfoxyy.com）影视信息爬虫 —— 教学实例
-------------------------------------------------
目标：采集站点的「影片元数据」+「播放地址（m3u8 / mp4 等直链）」。

站点特征：模板为苹果 CMS（MacCMS v10）系列，两套路由都能访问
    - 伪静态：/vod/{类型id}/page/{页码}.html     详情页 /detail/{id}.html
    - 动态  ：/index.php/vod/type/id/{类型id}/page/{页码}.html
    已验证可用的列表地址：/vod/1.html、/index.php/vod/type/id/1.html
    播放页：/play/{id}-{sid}-{nid}.html  或  /index.php/vod/play/id/{id}/sid/{sid}/nid/{nid}.html
            （sid=线路序号，nid=集数序号；页面内嵌 var player_aaaa={"flag":"m3u8","url":"..."}）

用法：
    python3 茶杯狐爬虫示例.py --self-test                       # 离线自检解析逻辑（含播放地址）
    python3 茶杯狐爬虫示例.py --category 1 --pages 2 --no-detail # 只抓列表
    python3 茶杯狐爬虫示例.py --category 2 --pages 1 --out 剧集.jsonl
    python3 茶杯狐爬虫示例.py --category 2 --pages 1 --resolve-play 3   # 每部片解析前 3 集播放页
    python3 茶杯狐爬虫示例.py --url-file urls.txt --resolve-play 999 --play-out 播放地址.jsonl

边界（重要，代码里也是这么设计的）：
    · 只「提取地址」，不下载 ts/mp4 分片、不合并成片、不解密、不破解签名与防盗链；
    · 遇到 AES-128 加密流只记录「已加密」标记，不取 key、不解密；
    · 数据版权归原权利人所有，本示例仅供 HTTP/HLS 协议学习，勿分发、勿商用。
合规提醒：
    1. 仅用于学习 HTTP 与 HTML 解析技术，控制频率，禁止并发轰炸；
    2. 若站点 robots.txt 或页面声明禁止抓取，请立即停止。
"""

import argparse
import base64
import csv
import json
import logging
import os
import random
import re
import sys
import time
from dataclasses import dataclass, field, asdict
from typing import Dict, Iterable, List, Optional, Tuple
from urllib.parse import urljoin, urlparse

import requests
from bs4 import BeautifulSoup

try:
    from lxml import etree  # noqa: F401  仅用于提示解析器可用性
    _PARSER = "lxml"
except ImportError:  # pragma: no cover
    _PARSER = "html.parser"

BASE = "https://www.cupfoxyy.com"

# 首页导航对应的分类 id：1=电影 2=电视剧 3=综艺 4=动漫（如改版请以实际导航为准）
CATEGORIES = {1: "电影", 2: "电视剧", 3: "综艺", 4: "动漫"}

UA_POOL = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/124.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) "
    "Version/17.4 Safari/605.1.15",
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/123.0.0.0 Safari/537.36",
]

log = logging.getLogger("cupfox")


# --------------------------------------------------------------------------- #
# 1. 数据模型
# --------------------------------------------------------------------------- #
@dataclass
class VideoItem:
    title: str = ""                 # 片名
    url: str = ""                   # 详情页绝对地址
    category: str = ""              # 所属分类（电影/电视剧/...）
    tag: str = ""                   # 列表页标注，如「国产」「剧情片」「全36集」
    score: str = ""                 # 评分（站点自评，可能为 0.0）
    remark: str = ""                # 更新状态，如 HD / 全36集 / 更新至第8集
    cover: str = ""                 # 封面图
    alias: str = ""                 # 别名
    director: str = ""
    actors: str = ""
    area: str = ""
    year: str = ""
    language: str = ""
    intro: str = ""
    play_lines: str = ""                        # 播放线路名，如 m3u8 / 腾讯 / 优酷
    play_count: int = 0                         # 详情页上发现的播放页（集数）总数
    best_stream: str = ""                       # 首个可播放直链（m3u8/mp4）
    best_stream_type: str = ""                  # m3u8 / file / platform / unknown
    extra: Dict[str, str] = field(default_factory=dict)


@dataclass
class PlayItem:
    """一条「可播放地址」记录，逐集写入 --play-out 文件。"""
    title: str = ""          # 片名
    line: str = ""           # 线路名（flag / sid 对应的播放组）
    sid: int = 0             # 线路序号
    nid: int = 0             # 集数序号
    episode: str = ""        # 集名，如 第1集 / HD
    play_page: str = ""      # 播放页地址（站点内）
    stream_url: str = ""     # 解析出的真实地址（m3u8 / mp4）
    stream_type: str = ""    # m3u8 / file / platform / iframe / unknown
    referer: str = ""        # 该地址需要的 Referer（防盗链）
    m3u8_type: str = ""      # master / media / ""
    m3u8_variants: str = ""  # 多码率：分辨率列表
    m3u8_segments: int = 0   # 分片数量（仅 media）
    m3u8_duration: float = 0.0
    encrypted: bool = False  # 是否 AES-128（仅记录，不解密）
    note: str = ""


# --------------------------------------------------------------------------- #
# 2. 抓取层：会话 + 重试 + 限速 + 本地缓存
# --------------------------------------------------------------------------- #
class Fetcher:
    """把所有「网络不确定性」收在一处：超时、重试、403/429 退避、请求间隔、缓存。"""

    def __init__(self, delay: float = 1.5, retries: int = 3, timeout: int = 15,
                 proxy: Optional[str] = None, cache_dir: Optional[str] = None,
                 use_cache: bool = False):
        self.delay = delay
        self.retries = retries
        self.timeout = timeout
        self.cache_dir = cache_dir
        self.use_cache = use_cache
        self.session = requests.Session()
        self.session.trust_env = True
        if proxy:
            self.session.proxies = {"http": proxy, "https": proxy}
        self._rotate_headers()

    def _rotate_headers(self) -> None:
        self.session.headers.update({
            "User-Agent": random.choice(UA_POOL),
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            "Accept-Language": "zh-CN,zh;q=0.9",
            "Referer": BASE + "/",
            "Connection": "keep-alive",
        })

    def _cache_path(self, url: str) -> str:
        import hashlib
        name = hashlib.md5(url.encode("utf-8")).hexdigest() + ".html"
        return os.path.join(self.cache_dir or ".cache", name)

    def get(self, url: str) -> Optional[str]:
        """返回 HTML 文本；失败返回 None。"""
        if self.use_cache and self.cache_dir:
            path = self._cache_path(url)
            if os.path.exists(path):
                with open(path, "r", encoding="utf-8") as f:
                    return f.read()

        for attempt in range(1, self.retries + 1):
            self._rotate_headers()
            try:
                resp = self.session.get(url, timeout=self.timeout)
                if resp.status_code == 200:
                    # macCMS 多为 UTF-8；个别模板是 GBK，这里做一次兜底判定
                    if not resp.encoding or resp.encoding.lower() == "iso-8859-1":
                        resp.encoding = resp.apparent_encoding or "utf-8"
                    html = resp.text
                    if self.cache_dir:
                        os.makedirs(self.cache_dir, exist_ok=True)
                        with open(self._cache_path(url), "w", encoding="utf-8") as f:
                            f.write(html)
                    time.sleep(self.delay + random.uniform(0, self.delay / 2))
                    return html
                if resp.status_code in (403, 429, 503):
                    wait = 5 * attempt + random.uniform(0, 3)
                    log.warning("[%s] %s，第 %s 次退避 %.1fs", resp.status_code, url, attempt, wait)
                    time.sleep(wait)
                    continue
                log.warning("[%s] %s，跳过", resp.status_code, url)
                return None
            except requests.RequestException as exc:
                log.warning("请求异常 %s（第 %s/%s 次）：%s", url, attempt, self.retries, exc)
                time.sleep(2 * attempt)
        return None

    def get_text(self, url: str, referer: str = "") -> Optional[str]:
        """拉纯文本（m3u8 用），不缓存、不重试太狠，避免打第三方 CDN。"""
        headers = {"Referer": referer or BASE + "/", "Accept": "*/*"}
        try:
            r = self.session.get(url, timeout=self.timeout, headers=headers)
            if r.status_code == 200:
                r.encoding = r.encoding or "utf-8"
                time.sleep(self.delay)
                return r.text
            log.warning("m3u8/文本请求 [%s] %s", r.status_code, url)
        except requests.RequestException as exc:
            log.warning("文本请求异常 %s：%s", url, exc)
        return None


# --------------------------------------------------------------------------- #
# 3. 解析层：选择器 + 正则双保险（模板改版时不易全崩）
# --------------------------------------------------------------------------- #
DETAIL_RE = re.compile(r"(detail|/detail/|/vod/play|/index\.php/vod/detail)", re.I)
PAGE_RE = re.compile(r'href=["\']([^"\']*?(?:page|/pg/)\D{0,3}(\d+)[^"\']*?)["\']', re.I)

NOISE_WORDS = ("首页", "电影", "电视剧", "综艺", "动漫", "搜索", "登录", "注册", "排行", "专题")

# 播放页链接特征（苹果 CMS 常见三种写法，另外兼容 /cupfoxplay/ 这类自定义路由）
PLAY_PAGE_RE = re.compile(r"(play|/vod/play|/play/id/|cupfoxplay|/static/player/\?url=)", re.I)
# 播放页内嵌播放器变量：var player_aaaa={"flag":"m3u8","url":"https:\/\/..."};
PLAYER_VAR_PATTERNS = [
    r'var\s+player_aaaa\s*=\s*(\{.*?\})\s*;?',
    r'player_aaaa\s*=\s*(\{.*?\})\s*;?',
    r'var\s+player_data\s*=\s*(\{.*?\})\s*;?',
]
# 直链兜底扫描
STREAM_URL_RE = re.compile(r'https?:[^\s"\'\\<>]+?\.(?:m3u8|mp4|mkv|flv|ts|webm)(?:\?[^\s"\'\\<>]*)?', re.I)
# 主流平台（无法直取地址，需对应站内解析接口）
PLATFORM_RE = re.compile(r"(youku\.com|iqiyi\.com|v\.qq\.com|mgtv\.com|bilibili\.com|sohu\.com|pptv\.com|le\.com)", re.I)


def _soup(html: str) -> BeautifulSoup:
    return BeautifulSoup(html, _PARSER)


def _clean(text: str) -> str:
    return re.sub(r"\s+", " ", text or "").strip()


def _abs(href: str) -> str:
    return urljoin(BASE + "/", href)


def parse_list_page(html: str, category: str = "") -> List[VideoItem]:
    """解析列表页。策略：先按 macCMS 常见 DOM 找条目块，再用链接正则补齐。"""
    soup = _soup(html)
    items: Dict[str, VideoItem] = {}

    # ---- 策略 A：常见条目容器 -------------------------------------------------
    for box in soup.select("div.stui-vodlist__box, li.stui-vodlist__item, div.vodlist__box, li.col-md-6"):
        link = box.find("a", href=DETAIL_RE)
        if not link:
            continue
        item = VideoItem(url=_abs(link.get("href", "")))
        item.title = _clean(link.get("title") or _clean(link.get_text()))
        # 标题优先取 h4/a.title 文本
        h = box.select_one("h4, .title, .stui-vodlist__title")
        if h and _clean(h.get_text()):
            item.title = _clean(h.get_text())
        # 角标：集数 / 高清 / 评分
        for span in box.select("span.pic-text, span.score, .pic-tag, .remarks"):
            txt = _clean(span.get_text())
            if not txt:
                continue
            if re.search(r"\d", txt) and re.search(r"集|更新至|HD|BD|TC|TS", txt):
                item.remark = txt
            elif re.match(r"^\d+(\.\d+)?$", txt):
                item.score = txt
            else:
                item.tag = item.tag or txt
        # 副标题：类型/地区
        sub = box.select_one("p.text, p.sub, .subtitle")
        if sub:
            item.tag = item.tag or _clean(sub.get_text())
        # 封面：懒加载模板常把地址放在 data-original / data-src 上，且可能挂在 <a> 而非 <img>
        for node in [box.find("img"), link]:
            if not node:
                continue
            src = (node.get("data-original") or node.get("data-src")
                   or node.get("data-echo") or node.get("src") or "")
            if src and not src.startswith("data:"):
                item.cover = _abs(src)
                break
        item.category = category
        items[item.url] = item

    # ---- 策略 B：链接正则兜底 -------------------------------------------------
    for href in set(re.findall(r'href=["\']([^"\']+)["\']', html)):
        if not DETAIL_RE.search(href):
            continue
        item = VideoItem(url=_abs(href), category=category)
        if item.url in items:
            continue
        slug = os.path.basename(urlparse(item.url).path)
        item.title = slug  # 正则兜底时标题不可靠，交给详情页补全
        items[item.url] = item

    # ---- 清洗：丢掉导航噪声与空标题 -------------------------------------------
    result = []
    for item in items.values():
        if not item.title or item.title in NOISE_WORDS:
            continue
        if item.title.endswith(".html"):
            continue
        result.append(item)
    log.info("列表页解析到 %s 条", len(result))
    return result


def parse_detail_page(html: str, item: Optional[VideoItem] = None) -> VideoItem:
    """解析详情页：标题 + 常见字段 + 简介。字段采用「关键字标签」匹配，抗模板变化。"""
    soup = _soup(html)
    item = item or VideoItem()

    h1 = soup.select_one("h1, .stui-content__detail .title, .vod-info h2")
    if h1 and _clean(h1.get_text()):
        item.title = _clean(h1.get_text())

    KEY_MAP = {
        "别名": "alias", "又名": "alias",
        "导演": "director", "编导": "director",
        "主演": "actors", "演员": "actors",
        "类型": "tag", "分类": "tag",
        "地区": "area", "产地": "area", "国家": "area",
        "年份": "year", "上映": "year", "年代": "year",
        "语言": "language",
        "评分": "score", "豆瓣": "score",
        "更新": "remark", "状态": "remark", "备注": "remark",
    }

    for node in soup.select("p, li, div.stui-content__detail > span, td"):
        raw = _clean(node.get_text(" ", strip=True))
        if not raw or len(raw) > 120:
            continue
        for kw, field_name in KEY_MAP.items():
            m = re.match(rf"^{kw}[：:]\s*(.+)$", raw)
            if m:
                value = _clean(m.group(1))
                if value and not getattr(item, field_name, ""):
                    setattr(item, field_name, value)
                break
        else:
            # 形如 <span class="text-muted">导演</span><a>张三</a>
            label = node.find(class_=re.compile("text-muted|label|tit"))
            if label:
                kw = _clean(label.get_text()).rstrip("：:")
                if kw in KEY_MAP:
                    value = _clean(node.get_text(" ", strip=True).replace(kw, "", 1))
                    field_name = KEY_MAP[kw]
                    if value and not getattr(item, field_name, ""):
                        setattr(item, field_name, value)

    if not item.year:
        y = re.search(r"(19|20)\d{2}", soup.get_text(" ", strip=True)[:4000])
        if y:
            item.year = y.group(0)

    for sel in (".stui-content__desc", ".desc", ".intro", ".plot", "#Plot", ".vod-info .content"):
        node = soup.select_one(sel)
        if node and _clean(node.get_text()):
            item.intro = _clean(node.get_text())[:500]
            break

    # 简介兜底：取最长的一个文本段落
    if not item.intro:
        paras = [_clean(p.get_text()) for p in soup.find_all("p")]
        paras = [p for p in paras if len(p) > 30]
        if paras:
            item.intro = max(paras, key=len)[:500]

    # 播放入口（只登记链接，真实地址留给播放页解析）
    entries = extract_play_entries(html, item.title)
    if entries:
        item.play_count = len(entries)
        item.play_lines = " / ".join(dict.fromkeys(
            e["line"] or f"线路{e['sid']}" for e in entries))
        item.extra["play_entries"] = json.dumps(entries[:200], ensure_ascii=False)

    log.info("详情页解析完成：%s（播放入口 %s 个）", item.title or "(无标题)", len(entries))
    return item


def guess_total_pages(html: str, default: int = 1) -> int:
    """从分页链接里推测总页数，推测不出就返回 default。"""
    nums = [int(n) for _, n in PAGE_RE.findall(html)]
    return max(nums) if nums else default


# --------------------------------------------------------------------------- #
# 3.5 播放地址解析：详情页找播放页链接 → 播放页取真实地址 → m3u8 结构解析
# --------------------------------------------------------------------------- #
def _guess_line_name(a) -> str:
    """向上找播放组标题（m3u8 / 腾讯 / 优酷 ...）。"""
    node = a
    for _ in range(5):
        node = node.parent
        if node is None or not getattr(node, "get", None):
            break
        cls = " ".join(node.get("class", []) or [])
        if "playlist" in cls or "play" in cls:
            box = node.parent
            for _ in range(2):
                if box is None or not getattr(box, "select_one", None):
                    break
                h = box.select_one("h3, h2, .title, .stui-pannel__head")
                if h and _clean(h.get_text()):
                    return _clean(h.get_text()).replace("在线播放", "")
                box = box.parent
            break
    return ""


def _parse_sid_nid(url: str) -> Tuple[int, int]:
    """从播放页 URL 里取线路序号 / 集数序号，用于分组与排序。"""
    m = re.search(r"/(\d+)[-_](\d+)[-_](\d+)\.html", url)          # /play/31088-1-1.html
    if m:
        return int(m.group(2)), int(m.group(3))
    m = re.search(r"sid[=/](\d+)[^0-9]+nid[=/](\d+)", url)         # /sid/1/nid/1.html
    if m:
        return int(m.group(1)), int(m.group(2))
    return 0, 0


def extract_play_entries(html: str, title: str = "") -> List[Dict]:
    """详情页 → 播放页链接列表：[{line, sid, nid, episode, url}]"""
    soup = _soup(html)
    out, seen = [], set()
    for a in soup.find_all("a", href=PLAY_PAGE_RE):
        url = _abs(a.get("href", ""))
        if url in seen:
            continue
        seen.add(url)
        sid, nid = _parse_sid_nid(url)
        out.append({
            "line": _guess_line_name(a),
            "sid": sid,
            "nid": nid,
            "episode": _clean(a.get_text()) or (f"第{nid}集" if nid else "播放"),
            "url": url,
        })
    out.sort(key=lambda x: (x["sid"], x["nid"]))
    log.info("%s 详情页发现 %s 个播放入口", title or "该片", len(out))
    return out


def _maybe_b64(u: str) -> str:
    """部分模板把 url 做 base64（有时还会反转/补位）；解出来像 URL 才采用。
    仅做「常见编码还原」，不涉及任何加密破解。"""
    if not u or u.startswith("http"):
        return u
    for cand in (u, u.rstrip("=") + "=" * (-len(u) % 4)):
        try:
            raw = base64.b64decode(cand, validate=False)
            s = raw.decode("utf-8", errors="ignore")
        except Exception:
            continue
        if s.startswith("http"):
            return s
    return u


def split_play_field(text: str) -> List[Tuple[str, str]]:
    """苹果 CMS 播放地址字段拆分：第1集$url1#第2集$url2（多线路用 $$$ 分隔）"""
    result = []
    for group in re.split(r"\$\$\$", text or ""):
        for part in re.split(r"#+", group):
            part = part.strip()
            if not part:
                continue
            if "$" in part:
                name, _, url = part.partition("$")
            else:
                name, url = "", part
            url = _maybe_b64(_clean(url).replace("\\/", "/"))
            if url:
                result.append((_clean(name), url))
    return result


def classify_stream(u: str) -> str:
    if re.search(r"\.m3u8(\?|#|$)", u, re.I):
        return "m3u8"
    if re.search(r"\.(mp4|mkv|flv|webm)(\?|#|$)", u, re.I):
        return "file"
    if PLATFORM_RE.search(u):
        return "platform"
    if u.startswith("http"):
        return "unknown"
    return "parse_api"   # 如 "m3u8"、"qq" 这类需要站内解析接口二次解析的标识


def parse_play_page(html: str) -> Dict:
    """播放页 → 播放器数据。返回 {flag, url, episodes:[(name,url)], iframe, raw}"""
    out: Dict = {"flag": "", "url": "", "episodes": [], "iframe": "", "raw": None}

    data = None
    for pat in PLAYER_VAR_PATTERNS:
        m = re.search(pat, html, re.S)
        if not m:
            continue
        raw = m.group(1)
        try:
            data = json.loads(raw)
        except json.JSONDecodeError:
            # 正则残缺时退化为字段抽取
            u = re.search(r'"url"\s*:\s*"([^"]+)"', raw)
            f = re.search(r'"flag"\s*:\s*"([^"]*)"', raw)
            data = {"url": u.group(1) if u else "", "flag": f.group(1) if f else ""}
        out["raw"] = data
        break

    if isinstance(data, dict):
        out["flag"] = str(data.get("flag") or data.get("from") or "")
        url_field = str(data.get("url") or "").replace("\\/", "/")
        next_field = str(data.get("url_next") or "").replace("\\/", "/")
        out["url"] = url_field or next_field
        # url=当前集（常为单条），url_next=全集/下一集；谁更全用谁，否则合并去重
        eps = split_play_field(url_field)
        eps_next = split_play_field(next_field)
        if len(eps_next) > len(eps):
            out["episodes"] = eps_next
        else:
            merged = list(eps)
            for pair in eps_next:
                if pair[1] not in {u for _, u in merged}:
                    merged.append(pair)
            out["episodes"] = merged

    # 播放器 iframe（第三方解析页）无论如何都记下来，便于人工核对
    iframe = re.search(r'<iframe[^>]+src=["\']([^"\']+)["\']', html, re.I)
    if iframe:
        out["iframe"] = _abs(iframe.group(1))

    if not out["episodes"]:
        # 兜底：整页扫直链
        for u in dict.fromkeys(STREAM_URL_RE.findall(html.replace("\\/", "/"))):
            out["episodes"].append(("", u))
    return out


def parse_m3u8_text(text: str, base_url: str = "") -> Dict:
    """解析 m3u8：区分 master（多码率）与 media（分片列表）。
    只读取结构，不下载分片、不取 AES key。"""
    join = lambda u: urljoin(base_url, u) if base_url and not u.startswith("http") else u
    info = {"type": "unknown", "encrypted": False, "key_uri": "", "segments": 0,
            "duration": 0.0, "endlist": False, "variants": []}

    lines = [l.strip() for l in text.splitlines()]
    if any(l.startswith("#EXT-X-STREAM-INF") for l in lines):
        info["type"] = "master"
        cur: Optional[Dict] = None
        for l in lines:
            if l.startswith("#EXT-X-STREAM-INF"):
                res = re.search(r"RESOLUTION=(\d+x\d+)", l)
                bw = re.search(r"BANDWIDTH=(\d+)", l)
                cur = {"resolution": res.group(1) if res else "",
                       "bandwidth": int(bw.group(1)) if bw else 0, "url": ""}
            elif cur is not None and l and not l.startswith("#"):
                cur["url"] = join(l)
                info["variants"].append(cur)
                cur = None
        return info

    info["type"] = "media"
    for l in lines:
        if l.startswith("#EXT-X-KEY"):
            info["encrypted"] = True
            m = re.search(r'URI="([^"]+)"', l)
            info["key_uri"] = join(m.group(1)) if m else ""
        elif l.startswith("#EXTINF"):
            m = re.search(r"#EXTINF:\s*([\d.]+)", l)
            if m:
                info["duration"] += float(m.group(1))
        elif l.startswith("#EXT-X-ENDLIST"):
            info["endlist"] = True
        elif l and not l.startswith("#"):
            info["segments"] += 1
    return info


def probe_stream(fetcher: "Fetcher", url: str, referer: str = "") -> Dict:
    """对 m3u8 做一次读取并解析结构；mp4 等只做 HEAD 探测大小/类型。"""
    result: Dict = {}
    if not url.startswith("http"):
        return {"note": "非直链，需站内解析接口二次解析"}
    try:
        if classify_stream(url) == "m3u8":
            text = fetcher.get_text(url, referer=referer)
            if not text:
                return {"note": "m3u8 拉取失败"}
            result = parse_m3u8_text(text, base_url=url)
        else:
            r = fetcher.session.head(url, timeout=fetcher.timeout,
                                     headers={"Referer": referer or BASE + "/"}, allow_redirects=True)
            result = {"type": "file", "http_status": r.status_code,
                      "content_type": r.headers.get("Content-Type", ""),
                      "size_mb": round(int(r.headers.get("Content-Length", 0) or 0) / 1048576, 1)}
            time.sleep(fetcher.delay)
    except requests.RequestException as exc:
        result = {"note": f"探测异常：{exc}"}
    return result


# --------------------------------------------------------------------------- #
# 4. 调度层
# --------------------------------------------------------------------------- #
def build_list_url(category: int, page: int, static: bool = True) -> str:
    """拼列表页 URL。static=True 用伪静态路由，否则用 index.php 动态路由。"""
    if static:
        return f"{BASE}/vod/{category}/page/{page}.html" if page > 1 else f"{BASE}/vod/{category}.html"
    url = f"{BASE}/index.php/vod/type/id/{category}"
    return f"{url}/page/{page}.html" if page > 1 else f"{url}.html"


class CupfoxCrawler:
    def __init__(self, fetcher: Fetcher, with_detail: bool = True, limit: int = 0,
                 resolve_play: int = 0, probe_m3u8: bool = True, play_writer: "Writer" = None):
        self.fetcher = fetcher
        self.with_detail = with_detail
        self.limit = limit
        self.resolve_play = resolve_play    # 每部影片最多解析多少个播放页（0=不解析）
        self.probe_m3u8 = probe_m3u8
        self.play_writer = play_writer
        self.seen: set = set()

    # ---- 播放地址采集（核心新增） -------------------------------------------
    def crawl_play(self, item: VideoItem) -> List[PlayItem]:
        """详情页条目 → 逐集解析出 m3u8 / mp4 直链。"""
        raw = item.extra.get("play_entries", "")
        try:
            entries = json.loads(raw) if raw else []
        except json.JSONDecodeError:
            entries = []
        if not entries or self.resolve_play <= 0:
            return []

        results: List[PlayItem] = []
        for entry in entries[:self.resolve_play]:
            html = self.fetcher.get(entry["url"])
            if not html:
                continue
            parsed = parse_play_page(html)
            referer = BASE + "/"

            if parsed["episodes"]:
                cands = parsed["episodes"]
            elif parsed["iframe"]:
                cands = [("", parsed["iframe"])]
            else:
                cands = [("", parsed["url"])]

            # 播放页里若已含全集（常见于 m3u8 字段），逐条落盘；否则就是当前这一集
            for name, s_url in cands[:max(1, self.resolve_play)]:
                pi = PlayItem(
                    title=item.title,
                    line=entry["line"] or (parsed["flag"] or f"线路{entry['sid']}"),
                    sid=entry["sid"], nid=entry["nid"],
                    episode=name or entry["episode"],
                    play_page=entry["url"],
                    stream_url=s_url,
                    stream_type="iframe" if (s_url == parsed.get("iframe") and s_url) else classify_stream(s_url),
                    referer=referer,
                )
                if self.probe_m3u8 and pi.stream_type in ("m3u8", "file"):
                    info = probe_stream(self.fetcher, s_url, referer=referer)
                    pi.m3u8_type = info.get("type", "")
                    pi.m3u8_variants = " / ".join(
                        v["resolution"] or str(v["bandwidth"]) for v in info.get("variants", []))
                    pi.m3u8_segments = int(info.get("segments", 0))
                    pi.m3u8_duration = round(float(info.get("duration", 0.0)), 1)
                    pi.encrypted = bool(info.get("encrypted"))
                    pi.note = info.get("note", "") or ("已加密(AES-128)，仅记录不解密" if pi.encrypted else "")
                    if info.get("type") == "master" and info.get("variants"):
                        # master 只记录最高码率那一路，避免递归抓取
                        top = max(info["variants"], key=lambda v: v["bandwidth"] or 0)
                        pi.m3u8_variants = (pi.m3u8_variants + f" | 最高码率链路: {top['url']}").strip(" |")
                results.append(pi)
                if self.play_writer:
                    self.play_writer.write(pi)
                log.info("✔ %s | %s | %s | %s", pi.title, pi.line, pi.episode, pi.stream_url[:80])
            if parsed["episodes"] and len(parsed["episodes"]) > 1:
                break  # 单个播放页已带全集地址，没必要再翻其他集

        if results:
            first = next((r for r in results if r.stream_type in ("m3u8", "file")), results[0])
            item.best_stream = first.stream_url
            item.best_stream_type = first.stream_type
        return results

    def crawl_category(self, category: int, pages: int, static: bool = True) -> Iterable[VideoItem]:
        name = CATEGORIES.get(category, str(category))
        for page in range(1, pages + 1):
            url = build_list_url(category, page, static)
            log.info("抓取列表 %s（%s 第 %s 页）", url, name, page)
            html = self.fetcher.get(url)
            if not html:
                # 伪静态失败时自动切动态路由再试一次
                if static:
                    url = build_list_url(category, page, static=False)
                    html = self.fetcher.get(url)
                if not html:
                    continue
            for item in parse_list_page(html, category=name):
                if item.url in self.seen:
                    continue
                self.seen.add(item.url)
                if self.with_detail:
                    dhtml = self.fetcher.get(item.url)
                    if dhtml:
                        item = parse_detail_page(dhtml, item)
                yield item
                if self.limit and len(self.seen) >= self.limit:
                    log.info("达到上限 %s 条，停止", self.limit)
                    return


def read_url_file(path: str) -> List[str]:
    with open(path, "r", encoding="utf-8") as f:
        return [line.strip() for line in f if line.strip() and not line.startswith("#")]


# --------------------------------------------------------------------------- #
# 5. 存储层
# --------------------------------------------------------------------------- #
class Writer:
    """同时服务 VideoItem 与 PlayItem：CSV/JSONL 由扩展名决定。"""

    def __init__(self, path: str, schema=VideoItem):
        self.path = path
        self.fmt = "csv" if path.lower().endswith(".csv") else "jsonl"
        self.fields = list(schema().__dict__.keys())
        self.fh = open(path, "w", encoding="utf-8-sig", newline="")
        if self.fmt == "csv":
            self.writer = csv.DictWriter(self.fh, fieldnames=self.fields, extrasaction="ignore")
            self.writer.writeheader()
        self.count = 0

    def write(self, item) -> None:
        data = asdict(item)
        for k, v in list(data.items()):
            if isinstance(v, (dict, list)):
                data[k] = json.dumps(v, ensure_ascii=False)
        if self.fmt == "csv":
            self.writer.writerow(data)
        else:
            self.fh.write(json.dumps(data, ensure_ascii=False) + "\n")
        self.count += 1

    def close(self) -> None:
        self.fh.close()
        log.info("已写入 %s 条 -> %s", self.count, self.path)


# --------------------------------------------------------------------------- #
# 6. 离线自检：用内置样例 HTML 验证解析逻辑（无需联网）
# --------------------------------------------------------------------------- #
SAMPLE_LIST = """
<div class="stui-pannel clearfix">
  <ul class="stui-vodlist clearfix">
    <li class="col-md-6 col-sm-4 col-xs-3">
      <div class="stui-vodlist__box">
        <a class="stui-vodlist__thumb lazyload" href="/detail/31088.html" title="孤舟"
           data-original="/upload/vod/20240801-1.jpg">
          <span class="pic-text text-right">全36集</span>
        </a>
        <div class="stui-vodlist__detail">
          <h4 class="title text-overflow"><a href="/detail/31088.html">孤舟</a></h4>
          <p class="text text-overflow text-muted hidden-xs">国产 · 剧情</p>
        </div>
      </div>
    </li>
    <li class="col-md-6 col-sm-4 col-xs-3">
      <div class="stui-vodlist__box">
        <a class="stui-vodlist__thumb lazyload" href="/detail/31089.html" title="边水往事">
          <span class="pic-text text-right">全21集</span>
          <span class="score">8.6</span>
        </a>
        <div class="stui-vodlist__detail">
          <h4 class="title text-overflow"><a href="/detail/31089.html">边水往事</a></h4>
          <p class="text text-overflow text-muted hidden-xs">国产</p>
        </div>
      </div>
    </li>
  </ul>
</div>
<div class="stui-page text-center">
  <a href="/vodtype/2/page/2.html">2</a><a href="/vodtype/2/page/3.html">3</a>
</div>
"""

SAMPLE_DETAIL = """
<div class="stui-content__detail">
  <h1 class="title">孤舟</h1>
  <p class="data"><span class="text-muted">别名：</span>孤舟 The Lonely Boat</p>
  <p class="data"><span class="text-muted">导演：</span>韩晓军</p>
  <p class="data"><span class="text-muted">主演：</span>曾舜晞 / 张颂文 / 陈都灵</p>
  <p class="data"><span class="text-muted">类型：</span>剧情 / 悬疑</p>
  <p class="data"><span class="text-muted">地区：</span>中国大陆</p>
  <p class="data"><span class="text-muted">年份：</span>2024</p>
  <p class="data"><span class="text-muted">语言：</span>国语</p>
  <p class="data"><span class="text-muted">更新：</span>全36集</p>
  <p class="desc">1941年，苏州地下工作者潜伏敌营，展开一场惊心动魄的谍战故事……</p>
  <div class="stui-pannel stui-pannel-bg clearfix">
    <div class="stui-pannel-box">
      <div class="stui-pannel_hd"><h3 class="title">m3u8线路-在线播放</h3></div>
      <div class="stui-pannel_bd">
        <ul class="stui-content__playlist clearfix">
          <li><a href="/play/31088-1-1.html">第1集</a></li>
          <li><a href="/play/31088-1-2.html">第2集</a></li>
          <li><a href="/play/31088-1-3.html">第3集</a></li>
        </ul>
      </div>
    </div>
  </div>
</div>
"""

# 播放页：内嵌 player_aaaa（带 \/ 转义）+ 全集地址放在同一字段里
SAMPLE_PLAY = """
<script type="text/javascript">
var player_aaaa={"flag":"m3u8","encrypt":"1","trysee":"0",
 "url":"https:\\/\\/v.gsuus.com\\/play\\/QBY0yWKa\\/index.m3u8",
 "url_next":"第1集$https:\\/\\/v.gsuus.com\\/play\\/QBY0yWKa\\/1.m3u8#第2集$https:\\/\\/v.gsuus.com\\/play\\/QBY0yWKa\\/2.m3u8#第3集$https:\\/\\/v.gsuus.com\\/play\\/QBY0yWKa\\/3.m3u8"};
</script>
<div class="stui-player__video clearfix">
  <iframe src="/static/player/?url=https://v.gsuus.com/play/QBY0yWKa/index.m3u8"></iframe>
</div>
"""

SAMPLE_M3U8_MASTER = """#EXTM3U
#EXT-X-STREAM-INF:PROGRAM-ID=1,BANDWIDTH=1280000,RESOLUTION=704x576
https://v.gsuus.com/play/QBY0yWKa/576p.m3u8
#EXT-X-STREAM-INF:PROGRAM-ID=2,BANDWIDTH=7680000,RESOLUTION=1920x1080
https://v.gsuus.com/play/QBY0yWKa/1080p.m3u8
"""

SAMPLE_M3U8_MEDIA = """#EXTM3U
#EXT-X-KEY:METHOD=AES-128,URI="https://v.gsuus.com/play/QBY0yWKa/enc.key"
#EXTINF:10.0,
https://v.gsuus.com/play/QBY0yWKa/0.ts
#EXTINF:10.0,
https://v.gsuus.com/play/QBY0yWKa/1.ts
#EXTINF:10.0,
https://v.gsuus.com/play/QBY0yWKa/2.ts
#EXT-X-ENDLIST
"""


def self_test() -> int:
    ok = True
    items = parse_list_page(SAMPLE_LIST, category="电视剧")
    ok &= len(items) == 2
    print(f"[1] 列表解析条数：{len(items)}（期望 2）")
    for it in items:
        print(f"    - {it.title} | {it.remark} | {it.score or '-'} | {it.tag} | {it.url}")
    ok &= items[0].title == "孤舟" and items[0].remark == "全36集"
    ok &= items[0].url == BASE + "/voddetail/31088.html"
    ok &= items[0].cover.endswith(".jpg")

    pages = guess_total_pages(SAMPLE_LIST)
    print(f"[2] 推测总页数：{pages}（期望 3）")
    ok &= pages == 3

    d = parse_detail_page(SAMPLE_DETAIL, items[0])
    print("[3] 详情解析：")
    for k in ("title", "alias", "director", "actors", "tag", "area", "year", "language", "remark"):
        print(f"    {k:9s}= {getattr(d, k)}")
    print(f"    intro    = {d.intro[:30]}…")
    ok &= (d.director == "韩晓军" and d.year == "2024" and d.area == "中国大陆"
           and d.actors.startswith("曾舜晞") and d.intro.startswith("1941年"))

    print("[4] URL 构造：", build_list_url(2, 1), "|", build_list_url(2, 3))
    ok &= build_list_url(2, 3) == f"{BASE}/vodtype/2/page/3.html"

    # ---- 播放地址解析链路 ----
    entries = extract_play_entries(SAMPLE_DETAIL, d.title)
    print(f"[5] 详情页播放入口：{len(entries)} 个（期望 3）")
    for e in entries:
        print(f"    - 线路[{e['line']}] sid={e['sid']} nid={e['nid']} {e['episode']} -> {e['url']}")
    ok &= len(entries) == 3
    ok &= entries[0]["url"] == BASE + "/play/31088-1-1.html"
    ok &= entries[0]["sid"] == 1 and entries[2]["nid"] == 3

    play = parse_play_page(SAMPLE_PLAY)
    print(f"[6] 播放页解析：flag={play['flag']}  全集条数={len(play['episodes'])}（期望 3）")
    for name, u in play["episodes"]:
        print(f"    - {name or '(默认)'} | {u}")
    ok &= play["flag"] == "m3u8"
    ok &= len(play["episodes"]) == 3
    ok &= play["episodes"][0][0] == "第1集"
    ok &= play["episodes"][0][1] == "https://v.gsuus.com/play/QBY0yWKa/1.m3u8"
    ok &= classify_stream(play["episodes"][0][1]) == "m3u8"
    ok &= play["iframe"].startswith(BASE)

    master = parse_m3u8_text(SAMPLE_M3U8_MASTER, base_url="https://v.gsuus.com/play/QBY0yWKa/index.m3u8")
    print(f"[7] m3u8 主列表：type={master['type']} 码率档位={[v['resolution'] for v in master['variants']]}（期望 master/2 档）")
    ok &= master["type"] == "master" and len(master["variants"]) == 2
    ok &= master["variants"][1]["url"].endswith("1080p.m3u8")

    media = parse_m3u8_text(SAMPLE_M3U8_MEDIA)
    print(f"[8] m3u8 分片列表：type={media['type']} 分片={media['segments']}(期望3) "
          f"时长={media['duration']}s(期望30) 加密={media['encrypted']}(期望True)")
    ok &= media["type"] == "media" and media["segments"] == 3
    ok &= media["duration"] == 30.0 and media["encrypted"] is True

    print("[9] 地址分类：",
          classify_stream("https://a/b/1080p.m3u8"), classify_stream("https://a/b.mp4"),
          classify_stream("https://v.youku.com/v_show/id_X"), classify_stream("m3u8"))
    ok &= (classify_stream("https://a/b/1080p.m3u8") == "m3u8"
           and classify_stream("https://a/b.mp4") == "file"
           and classify_stream("https://v.youku.com/v_show/id_X") == "platform"
           and classify_stream("m3u8") == "parse_api")

    print("\n自检结果：", "✅ 全部通过" if ok else "❌ 存在失败项")
    return 0 if ok else 1


# --------------------------------------------------------------------------- #
# 7. CLI
# --------------------------------------------------------------------------- #
def main(argv: Optional[List[str]] = None) -> int:
    ap = argparse.ArgumentParser(description="茶杯狐（cupfoxyy.com）影视信息爬虫示例")
    ap.add_argument("--category", type=int, help="分类 id：1电影 2电视剧 3综艺 4动漫")
    ap.add_argument("--pages", type=int, default=1, help="翻页数量，默认 1")
    ap.add_argument("--limit", type=int, default=0, help="最多采集条数，0 表示不限")
    ap.add_argument("--no-detail", action="store_true", help="只抓列表，不下详情（更快更礼貌）")
    ap.add_argument("--url-file", help="从文件读取详情页/列表页 URL，一行一个")
    ap.add_argument("--out", default="茶杯狐采集结果.jsonl", help="影片信息输出文件，.csv 或 .jsonl")
    ap.add_argument("--play-out", default="茶杯狐播放地址.jsonl", help="播放地址输出文件（逐集一条）")
    ap.add_argument("--resolve-play", type=int, default=0,
                    help="每部影片最多解析多少个播放页（0=只登记链接不解析；全集地址常在第 1 集返回）")
    ap.add_argument("--no-probe-m3u8", action="store_true", help="不拉取 m3u8 内容，只记录地址")
    ap.add_argument("--delay", type=float, default=1.5, help="每次请求间隔秒数（礼貌抓取）")
    ap.add_argument("--retries", type=int, default=3)
    ap.add_argument("--proxy", help="代理，如 http://127.0.0.1:7890")
    ap.add_argument("--cache-dir", default=".cache", help="HTML 缓存目录，便于反复调试")
    ap.add_argument("--use-cache", action="store_true", help="优先读本地缓存，避免重复请求")
    ap.add_argument("--dynamic", action="store_true", help="使用 index.php 动态路由")
    ap.add_argument("--self-test", action="store_true", help="离线自检解析逻辑")
    ap.add_argument("-v", "--verbose", action="store_true")
    args = ap.parse_args(argv)

    logging.basicConfig(level=logging.DEBUG if args.verbose else logging.INFO,
                        format="%(asctime)s %(levelname)s %(message)s")

    if args.self_test:
        return self_test()
    if not args.category and not args.url_file:
        ap.error("需要 --category 或 --url-file（也可用 --self-test 做离线自检）")

    fetcher = Fetcher(delay=args.delay, retries=args.retries, proxy=args.proxy,
                      cache_dir=args.cache_dir, use_cache=args.use_cache)
    writer = Writer(args.out, VideoItem)
    play_writer = Writer(args.play_out, PlayItem)
    try:
        if args.url_file:
            for i, url in enumerate(read_url_file(args.url_file), 1):
                log.info("(%s) %s", i, url)
                html = fetcher.get(url)
                if not html:
                    continue
                items = parse_list_page(html) if DETAIL_RE.search(url) is None else []
                if items:
                    for it in items:
                        writer.write(it)
                else:
                    item = parse_detail_page(html)
                    crawler_tmp = CupfoxCrawler(fetcher, resolve_play=args.resolve_play,
                                                probe_m3u8=not args.no_probe_m3u8,
                                                play_writer=play_writer)
                    crawler_tmp.crawl_play(item)
                    print(f"✔ {item.title} | 播放入口 {item.play_count} | {item.best_stream[:70]}")
                    writer.write(item)
        else:
            crawler = CupfoxCrawler(fetcher, with_detail=not args.no_detail, limit=args.limit,
                                    resolve_play=args.resolve_play,
                                    probe_m3u8=not args.no_probe_m3u8,
                                    play_writer=play_writer)
            for item in crawler.crawl_category(args.category, args.pages, static=not args.dynamic):
                crawler.crawl_play(item)
                extra = f" | {item.best_stream_type}:{item.best_stream[:60]}" if item.best_stream else ""
                print(f"✔ {item.title} | {item.tag} | {item.year or '-'} | 入口{item.play_count}{extra}")
                writer.write(item)
    except KeyboardInterrupt:
        log.warning("用户中断，已保存部分结果")
    finally:
        writer.close()
        play_writer.close()
    return 0


if __name__ == "__main__":
    sys.exit(main())


# --------------------------------------------------------------------------- #
# 附：合规与反爬提示
#   · 本站对部分出口 IP 会直接返回 403（云防护策略），详情页还可能要求登录，
#     可换网络环境或配置 --proxy；403 时脚本会自动退避并切换到动态路由重试。
#   · 请保持 --delay ≥ 1s，单线程抓取，勿对站点与其 CDN 造成压力。
#   · 采集到的片名、简介、封面、播放地址等，版权归原权利人所有，勿分发、勿商用。
#   · 播放地址部分只做「提取与结构解析」，本文件不含任何下载、合并、解密、
#     绕过签名/防盗链/DRM 的实现，也不提供此类指引。
#   · 若站点 robots.txt 或页面声明禁止抓取，请立即停止。
# --------------------------------------------------------------------------- #
