#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
影视采集下载一体化工具（Spider + HLS Downloader）
==================================================
一条命令完成：站点列表/详情采集 → 提取 m3u8 播放地址 → 并发下载切片 → 解密 → 合并 → 封装 mp4。

    ┌──────────┐   ┌──────────┐   ┌────────────┐   ┌──────────┐   ┌────────┐
    │ 列表页    │→ │ 详情页    │→ │ 播放页取址 │→ │ 切片下载 │→ │ 合并封装│
    │ crawl    │   │ detail   │   │ player_aaaa│   │ 并发/续传│   │ ffmpeg │
    └──────────┘   └──────────┘   └────────────┘   └──────────┘   └────────┘

子命令：
    crawl     只采集，产出「影片信息 + 播放地址」两份结构化数据
    download  只下载，输入 m3u8 地址或上一步产出的播放地址文件
    run       采集 + 下载一步到位（推荐）
    selftest  离线自检：本地起服务 + ffmpeg 造流，端到端跑通全链路

示例：
    python3 影视采集下载一体化.py selftest
    python3 影视采集下载一体化.py crawl --category 2 --pages 1 --resolve-play 3
    python3 影视采集下载一体化.py run --category 2 --pages 1 --out-dir downloads --variant 720p
    python3 影视采集下载一体化.py download --url https://x/index.m3u8 --out 电影.mp4
    python3 影视采集下载一体化.py download --from-jsonl 播放地址.jsonl --out-dir dl --limit 5

站点适配：默认按苹果 CMS（MacCMS v10）模板解析，两套路由都支持
    列表  /type/{分类id}/page/{页码}.html      或  /index.php/vod/type/id/{分类id}/page/{页码}.html
    详情  /detail/{id}.html
    播放  /play/{id}-{sid}-{nid}.html         或  /index.php/vod/play/id/{id}/sid/{sid}/nid/{nid}.html
    播放页内嵌 var player_aaaa={"flag":"m3u8","url":"..."}；全集地址常在 url_next 字段

边界（代码里就是这么实现的）：
    · 只提取地址，不伪造/破解 Referer、签名、付费鉴权（请求头按你传入的值原样携带）；
    · SAMPLE-AES / Widevine / FairPlay 等 DRM 检测到直接报错退出，不做任何对抗；
    · AES-128 是 HLS 标准客户端行为（RFC 8216），按协议解密，不涉及破解。

合法性：本工具是 HTTP + HLS 协议的通用实现，请只对自己拥有权利或已获授权的内容使用。
"""
from __future__ import annotations

import argparse
import base64
import csv
import json
import logging
import os
import random
import re
import shutil
import subprocess
import sys
import tempfile
import threading
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from dataclasses import dataclass, field, asdict
from typing import Dict, List, Optional, Tuple
from urllib.parse import urljoin, urlparse

import requests
from bs4 import BeautifulSoup

try:
    from lxml import etree  # noqa: F401  仅用于探测解析器可用性
    _PARSER = "lxml"
except ImportError:  # pragma: no cover
    _PARSER = "html.parser"

try:
    from cryptography.hazmat.primitives.ciphers import Cipher, algorithms, modes
    _HAS_CRYPTO = True
except ImportError:  # pragma: no cover
    _HAS_CRYPTO = False

try:
    from tqdm import tqdm
except ImportError:  # pragma: no cover
    tqdm = None

log = logging.getLogger("pipeline")

# =========================================================================== #
# 0. 全局常量
# =========================================================================== #
BASE = "https://www.cupfoxyy.com"          # 目标站点根地址
CATEGORIES = {1: "电影", 2: "电视剧", 3: "综艺", 4: "动漫"}
FFMPEG = shutil.which("ffmpeg")

UA_POOL = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/124.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) "
    "Version/17.4 Safari/605.1.15",
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/123.0.0.0 Safari/537.36",
]

DETAIL_RE = re.compile(r"(detail|/detail/|/vod/play|/index\.php/vod/detail)", re.I)
PAGE_RE = re.compile(r'href=["\']([^"\']*?(?:page|/pg/)\D{0,3}(\d+)[^"\']*?)["\']', re.I)
PLAY_PAGE_RE = re.compile(r"(play|/vod/play|/play/id/|cupfoxplay|/static/player/\?url=)", re.I)
PLAYER_VAR_PATTERNS = [
    r'var\s+player_aaaa\s*=\s*(\{.*?\})\s*;?',
    r'player_aaaa\s*=\s*(\{.*?\})\s*;?',
    r'var\s+player_data\s*=\s*(\{.*?\})\s*;?',
]
STREAM_URL_RE = re.compile(r'https?:[^\s"\'\\<>]+?\.(?:m3u8|mp4|mkv|flv|ts|webm)(?:\?[^\s"\'\\<>]*)?', re.I)
PLATFORM_RE = re.compile(r"(youku\.com|iqiyi\.com|v\.qq\.com|mgtv\.com|bilibili\.com|sohu\.com|pptv\.com|le\.com)", re.I)
NOISE_WORDS = ("首页", "电影", "电视剧", "综艺", "动漫", "搜索", "登录", "注册", "排行", "专题")


# =========================================================================== #
# 1. 数据模型
# =========================================================================== #
@dataclass
class VideoItem:
    """影片元数据 + 播放入口登记"""
    title: str = ""
    url: str = ""
    category: str = ""
    tag: str = ""
    score: str = ""
    remark: str = ""
    cover: str = ""
    alias: str = ""
    director: str = ""
    actors: str = ""
    area: str = ""
    year: str = ""
    language: str = ""
    intro: str = ""
    play_lines: str = ""
    play_count: int = 0
    best_stream: str = ""
    best_stream_type: str = ""
    extra: Dict[str, str] = field(default_factory=dict)


@dataclass
class PlayItem:
    """一条可播放地址记录（逐集落盘）"""
    title: str = ""
    line: str = ""
    sid: int = 0
    nid: int = 0
    episode: str = ""
    play_page: str = ""
    stream_url: str = ""
    stream_type: str = ""
    referer: str = ""
    m3u8_type: str = ""
    m3u8_variants: str = ""
    m3u8_segments: int = 0
    m3u8_duration: float = 0.0
    encrypted: bool = False
    note: str = ""
    local_file: str = ""          # 下载完成后的本地路径（仅 run 模式回填）


@dataclass
class KeyInfo:
    method: str = "NONE"
    uri: str = ""
    iv: Optional[bytes] = None
    keyformat: str = "identity"


@dataclass
class Segment:
    index: int
    uri: str
    duration: float = 0.0
    seq: int = 0
    byterange: Optional[Tuple[int, int]] = None
    key: Optional[KeyInfo] = None
    discontinuity: bool = False
    path: str = ""


@dataclass
class MediaPlaylist:
    segments: List[Segment] = field(default_factory=list)
    endlist: bool = False
    target_duration: float = 0.0
    media_sequence: int = 0
    init_map: Optional[Segment] = None
    is_fmp4: bool = False


@dataclass
class Variant:
    url: str
    bandwidth: int = 0
    resolution: str = ""
    codecs: str = ""
    audio_group: str = ""


# =========================================================================== #
# 2. 通用工具
# =========================================================================== #
def clean(text: str) -> str:
    return re.sub(r"\s+", " ", text or "").strip()


def abs_url(href: str) -> str:
    return urljoin(BASE + "/", href)


def safe_name(s: str, default: str = "output") -> str:
    s = re.sub(r'[\\/:*?"<>|\r\n\t]+', "_", (s or "").strip())
    s = re.sub(r"_+", "_", s)
    s = re.sub(r"\s+", " ", s).strip(" ._")
    return s[:120] or default


def fmt_bytes(n: float) -> str:
    for unit in ("B", "KB", "MB", "GB"):
        if abs(n) < 1024:
            return f"{n:.1f}{unit}"
        n /= 1024
    return f"{n:.1f}TB"


def fmt_time(sec: float) -> str:
    h, rem = divmod(int(sec), 3600)
    m, s = divmod(rem, 60)
    return f"{h:02d}:{m:02d}:{s:02d}" if h else f"{m:02d}:{s:02d}"


def run_cmd(cmd: List[str], timeout: int = 3600) -> Tuple[int, str]:
    try:
        p = subprocess.run(cmd, capture_output=True, timeout=timeout)
        return p.returncode, (p.stdout + p.stderr).decode("utf-8", "ignore")
    except FileNotFoundError:
        return 127, "命令不存在"
    except subprocess.TimeoutExpired:
        return 124, "执行超时"


class RateLimiter:
    """极简全局限速（字节/秒）"""

    def __init__(self, bytes_per_sec: float = 0):
        self.rate = bytes_per_sec
        self.lock = threading.Lock()
        self.last = time.time()

    def wait(self, nbytes: int) -> None:
        if not self.rate or nbytes <= 0:
            return
        with self.lock:
            now = time.time()
            expected = nbytes / self.rate
            elapsed = now - self.last
            if elapsed < expected:
                time.sleep(expected - elapsed)
            self.last = time.time()


# =========================================================================== #
# 3. 采集端：抓取 + 解析
# =========================================================================== #
class Fetcher:
    """把网络不确定性收在一处：超时、重试、403/429 退避、请求间隔、本地缓存。"""

    def __init__(self, delay: float = 1.5, retries: int = 3, timeout: int = 15,
                 proxy: str = "", cache_dir: Optional[str] = None,
                 use_cache: bool = False, headers: Optional[Dict[str, str]] = None):
        self.delay = delay
        self.retries = retries
        self.timeout = timeout
        self.cache_dir = cache_dir
        self.use_cache = use_cache
        self.session = requests.Session()
        self.session.trust_env = True
        if proxy:
            self.session.proxies = {"http": proxy, "https": proxy}
        self.extra_headers = dict(headers or {})
        self._rotate_headers()

    def _rotate_headers(self) -> None:
        self.session.headers.update({
            "User-Agent": random.choice(UA_POOL),
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            "Accept-Language": "zh-CN,zh;q=0.9",
            "Referer": BASE + "/",
            "Connection": "keep-alive",
            **self.extra_headers,
        })

    def _cache_path(self, url: str) -> str:
        import hashlib
        return os.path.join(self.cache_dir or ".cache",
                            hashlib.md5(url.encode("utf-8")).hexdigest() + ".html")

    def get(self, url: str) -> Optional[str]:
        if self.use_cache and self.cache_dir and os.path.exists(self._cache_path(url)):
            with open(self._cache_path(url), "r", encoding="utf-8") as f:
                return f.read()

        for attempt in range(1, self.retries + 1):
            self._rotate_headers()
            try:
                resp = self.session.get(url, timeout=self.timeout)
                if resp.status_code == 200:
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
        """拉纯文本（m3u8 用），不缓存，避免过度打第三方 CDN。"""
        try:
            r = self.session.get(url, timeout=self.timeout,
                                 headers={"Referer": referer or BASE + "/", "Accept": "*/*"})
            if r.status_code == 200:
                r.encoding = r.encoding or "utf-8"
                time.sleep(self.delay)
                return r.text
            log.warning("文本请求 [%s] %s", r.status_code, url)
        except requests.RequestException as exc:
            log.warning("文本请求异常 %s：%s", url, exc)
        return None


def soup_of(html: str) -> BeautifulSoup:
    return BeautifulSoup(html, _PARSER)


def parse_list_page(html: str, category: str = "") -> List[VideoItem]:
    """解析列表页：先按 macCMS 常见 DOM 找条目，再用链接正则兜底。"""
    soup = soup_of(html)
    items: Dict[str, VideoItem] = {}

    for box in soup.select("div.stui-vodlist__box, li.stui-vodlist__item, div.vodlist__box, li.col-md-6"):
        link = box.find("a", href=DETAIL_RE)
        if not link:
            continue
        item = VideoItem(url=abs_url(link.get("href", "")))
        item.title = clean(link.get("title") or clean(link.get_text()))
        h = box.select_one("h4, .title, .stui-vodlist__title")
        if h and clean(h.get_text()):
            item.title = clean(h.get_text())
        for span in box.select("span.pic-text, span.score, .pic-tag, .remarks"):
            txt = clean(span.get_text())
            if not txt:
                continue
            if re.search(r"\d", txt) and re.search(r"集|更新至|HD|BD|TC|TS", txt):
                item.remark = txt
            elif re.match(r"^\d+(\.\d+)?$", txt):
                item.score = txt
            else:
                item.tag = item.tag or txt
        sub = box.select_one("p.text, p.sub, .subtitle")
        if sub:
            item.tag = item.tag or clean(sub.get_text())
        # 封面：懒加载常放 data-original / data-src，且可能挂在 <a> 而非 <img>
        for node in [box.find("img"), link]:
            if not node:
                continue
            src = (node.get("data-original") or node.get("data-src")
                   or node.get("data-echo") or node.get("src") or "")
            if src and not src.startswith("data:"):
                item.cover = abs_url(src)
                break
        item.category = category
        items[item.url] = item

    for href in set(re.findall(r'href=["\']([^"\']+)["\']', html)):
        if not DETAIL_RE.search(href):
            continue
        item = VideoItem(url=abs_url(href), category=category)
        if item.url in items:
            continue
        item.title = os.path.basename(urlparse(item.url).path)
        items[item.url] = item

    result = [i for i in items.values()
              if i.title and i.title not in NOISE_WORDS and not i.title.endswith(".html")]
    log.info("列表页解析到 %s 条", len(result))
    return result


def guess_total_pages(html: str, default: int = 1) -> int:
    nums = [int(n) for _, n in PAGE_RE.findall(html)]
    return max(nums) if nums else default


def _guess_line_name(a) -> str:
    """向上找播放组标题（m3u8 / 腾讯 / 优酷 ...）"""
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
                if h and clean(h.get_text()):
                    return clean(h.get_text()).replace("在线播放", "")
                box = box.parent
            break
    return ""


def _parse_sid_nid(url: str) -> Tuple[int, int]:
    m = re.search(r"/(\d+)[-_](\d+)[-_](\d+)\.html", url)          # /vodplay/31088-1-1.html
    if m:
        return int(m.group(2)), int(m.group(3))
    m = re.search(r"sid[=/](\d+)[^0-9]+nid[=/](\d+)", url)         # /sid/1/nid/1.html
    if m:
        return int(m.group(1)), int(m.group(2))
    return 0, 0


def extract_play_entries(html: str, title: str = "") -> List[Dict]:
    """详情页 → 播放页链接列表"""
    soup = soup_of(html)
    out, seen = [], set()
    for a in soup.find_all("a", href=PLAY_PAGE_RE):
        url = abs_url(a.get("href", ""))
        if url in seen:
            continue
        seen.add(url)
        sid, nid = _parse_sid_nid(url)
        out.append({"line": _guess_line_name(a), "sid": sid, "nid": nid,
                    "episode": clean(a.get_text()) or (f"第{nid}集" if nid else "播放"),
                    "url": url})
    out.sort(key=lambda x: (x["sid"], x["nid"]))
    log.info("%s 详情页发现 %s 个播放入口", title or "该片", len(out))
    return out


def _maybe_b64(u: str) -> str:
    """部分模板把 url 做 base64；解出来像 URL 才采用（仅常见编码还原，非破解）。"""
    if not u or u.startswith("http"):
        return u
    for cand in (u, u.rstrip("=") + "=" * (-len(u) % 4)):
        try:
            s = base64.b64decode(cand, validate=False).decode("utf-8", errors="ignore")
        except Exception:      # noqa: BLE001
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
            url = _maybe_b64(clean(url).replace("\\/", "/"))
            if url:
                result.append((clean(name), url))
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
    return "parse_api"


def parse_play_page(html: str) -> Dict:
    """播放页 → 播放器数据 {flag, url, episodes:[(name,url)], iframe}"""
    out: Dict = {"flag": "", "url": "", "episodes": [], "iframe": ""}
    data = None
    for pat in PLAYER_VAR_PATTERNS:
        m = re.search(pat, html, re.S)
        if not m:
            continue
        raw = m.group(1)
        try:
            data = json.loads(raw)
        except json.JSONDecodeError:
            u = re.search(r'"url"\s*:\s*"([^"]+)"', raw)
            f = re.search(r'"flag"\s*:\s*"([^"]*)"', raw)
            data = {"url": u.group(1) if u else "", "flag": f.group(1) if f else ""}
        break

    if isinstance(data, dict):
        out["flag"] = str(data.get("flag") or data.get("from") or "")
        main = str(data.get("url") or "").replace("\\/", "/")
        nxt = str(data.get("url_next") or "").replace("\\/", "/")
        out["url"] = main or nxt
        # url=当前集（常为单条），url_next=全集；谁更全用谁，否则合并去重
        eps, eps_next = split_play_field(main), split_play_field(nxt)
        if len(eps_next) > len(eps):
            out["episodes"] = eps_next
        else:
            merged = list(eps)
            for pair in eps_next:
                if pair[1] not in {u for _, u in merged}:
                    merged.append(pair)
            out["episodes"] = merged

    iframe = re.search(r'<iframe[^>]+src=["\']([^"\']+)["\']', html, re.I)
    if iframe:
        out["iframe"] = abs_url(iframe.group(1))

    if not out["episodes"]:
        for u in dict.fromkeys(STREAM_URL_RE.findall(html.replace("\\/", "/"))):
            out["episodes"].append(("", u))
    return out


def parse_detail_page(html: str, item: Optional[VideoItem] = None) -> VideoItem:
    """解析详情页：字段用「关键字标签」匹配，抗模板变化。"""
    soup = soup_of(html)
    item = item or VideoItem()

    h1 = soup.select_one("h1, .stui-content__detail .title, .vod-info h2")
    if h1 and clean(h1.get_text()):
        item.title = clean(h1.get_text())

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
        raw = clean(node.get_text(" ", strip=True))
        if not raw or len(raw) > 120:
            continue
        for kw, field_name in KEY_MAP.items():
            m = re.match(rf"^{kw}[：:]\s*(.+)$", raw)
            if m:
                value = clean(m.group(1))
                if value and not getattr(item, field_name, ""):
                    setattr(item, field_name, value)
                break
        else:
            label = node.find(class_=re.compile("text-muted|label|tit"))
            if label:
                kw = clean(label.get_text()).rstrip("：:")
                if kw in KEY_MAP:
                    value = clean(node.get_text(" ", strip=True).replace(kw, "", 1))
                    if value and not getattr(item, KEY_MAP[kw], ""):
                        setattr(item, KEY_MAP[kw], value)

    if not item.year:
        y = re.search(r"(19|20)\d{2}", soup.get_text(" ", strip=True)[:4000])
        if y:
            item.year = y.group(0)

    for sel in (".stui-content__desc", ".desc", ".intro", ".plot", "#Plot", ".vod-info .content"):
        node = soup.select_one(sel)
        if node and clean(node.get_text()):
            item.intro = clean(node.get_text())[:500]
            break
    if not item.intro:
        paras = [clean(p.get_text()) for p in soup.find_all("p")]
        paras = [p for p in paras if len(p) > 30]
        if paras:
            item.intro = max(paras, key=len)[:500]

    entries = extract_play_entries(html, item.title)
    if entries:
        item.play_count = len(entries)
        item.play_lines = " / ".join(dict.fromkeys(
            e["line"] or f"线路{e['sid']}" for e in entries))
        item.extra["play_entries"] = json.dumps(entries[:200], ensure_ascii=False)

    log.info("详情页解析完成：%s（播放入口 %s 个）", item.title or "(无标题)", len(entries))
    return item


def parse_m3u8_text(text: str, base_url: str = "") -> Dict:
    """解析 m3u8：区分 master（多码率）与 media（分片列表）。只读取结构，不下载分片。"""
    def join(u: str) -> str:
        return urljoin(base_url, u) if base_url and not u.startswith("http") else u

    info: Dict = {"type": "unknown", "encrypted": False, "key_uri": "", "segments": 0,
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


def build_list_url(category: int, page: int, static: bool = True) -> str:
    if static:
        return (f"{BASE}/vodtype/{category}/page/{page}.html" if page > 1
                else f"{BASE}/vodtype/{category}.html")
    url = f"{BASE}/index.php/vod/type/id/{category}"
    return f"{url}/page/{page}.html" if page > 1 else f"{url}.html"


# =========================================================================== #
# 4. 下载端：HLS 切片下载与合并
# =========================================================================== #
class HLSDownloader:
    def __init__(self, workers: int = 8, retries: int = 3, timeout: int = 20,
                 referer: str = "", headers: Optional[Dict[str, str]] = None,
                 proxy: str = "", max_speed: float = 0, keep_segments: bool = False):
        self.workers = max(1, workers)
        self.retries = max(1, retries)
        self.timeout = timeout
        self.referer = referer
        self.keep_segments = keep_segments
        self.limiter = RateLimiter(max_speed)
        self.session = requests.Session()
        self.session.headers.update({
            "User-Agent": UA_POOL[0], "Accept": "*/*", "Accept-Language": "zh-CN,zh;q=0.9",
            **(headers or {}),
        })
        if referer:
            self.session.headers["Referer"] = referer
        if proxy:
            self.session.proxies = {"http": proxy, "https": proxy}
        self.key_cache: Dict[str, bytes] = {}
        self._bytes = 0
        self._lock = threading.Lock()

    # ---- 基础请求 ----
    def get_text(self, url: str) -> Optional[str]:
        for i in range(1, self.retries + 1):
            try:
                r = self.session.get(url, timeout=self.timeout)
                if r.status_code == 200:
                    r.encoding = r.encoding or "utf-8"
                    return r.text
                log.warning("列表请求 [%s] %s（第 %s 次）", r.status_code, url, i)
            except requests.RequestException as exc:
                log.warning("列表请求异常 %s：%s（第 %s 次）", url, exc, i)
            time.sleep(1.5 * i)
        return None

    def get_bytes(self, url: str, byterange: Optional[Tuple[int, int]] = None) -> Optional[bytes]:
        headers = {}
        if byterange:
            length, offset = byterange
            headers["Range"] = f"bytes={offset}-{offset + length - 1}"
        for i in range(1, self.retries + 1):
            try:
                r = self.session.get(url, timeout=self.timeout, headers=headers)
                if r.status_code in (200, 206):
                    data = r.content
                    self.limiter.wait(len(data))
                    with self._lock:
                        self._bytes += len(data)
                    return data
                log.warning("分片请求 [%s] %s（第 %s 次）", r.status_code, url, i)
            except requests.RequestException as exc:
                log.warning("分片请求异常 %s：%s（第 %s 次）", url, exc, i)
            time.sleep(1.2 * i)
        return None

    # ---- 播放列表解析 ----
    @staticmethod
    def parse_master(text: str, base: str) -> List[Variant]:
        variants: List[Variant] = []
        cur: Optional[Dict] = None
        for raw in text.splitlines():
            line = raw.strip()
            if line.startswith("#EXT-X-STREAM-INF"):
                cur = {
                    "bandwidth": int((re.search(r"BANDWIDTH=(\d+)", line) or [None, 0])[1] or 0),
                    "resolution": (re.search(r"RESOLUTION=([\dx]+)", line) or [None, ""])[1] or "",
                    "codecs": (re.search(r'CODECS="([^"]+)"', line) or [None, ""])[1] or "",
                    "audio_group": (re.search(r'AUDIO="([^"]+)"', line) or [None, ""])[1] or "",
                }
            elif cur is not None and line and not line.startswith("#"):
                variants.append(Variant(url=urljoin(base, line), **cur))
                cur = None
        return variants

    @staticmethod
    def parse_audio_renditions(text: str, base: str) -> Dict[str, Variant]:
        out: Dict[str, Variant] = {}
        for line in text.splitlines():
            if not line.startswith("#EXT-X-MEDIA") or "TYPE=AUDIO" not in line:
                continue
            uri = re.search(r'URI="([^"]+)"', line)
            grp = re.search(r'GROUP-ID="([^"]+)"', line)
            name = re.search(r'NAME="([^"]+)"', line)
            if uri and grp and grp.group(1) not in out:
                out[grp.group(1)] = Variant(url=urljoin(base, uri.group(1)),
                                            codecs=name.group(1) if name else "audio")
        return out

    @staticmethod
    def parse_media(text: str, base: str) -> MediaPlaylist:
        """解析媒体播放列表：key / map / byterange 会跨行延续。"""
        pl = MediaPlaylist()
        cur_key: Optional[KeyInfo] = None
        cur_range: Optional[Tuple[int, int]] = None
        cur_map_uri: Optional[str] = None
        cur_map_range: Optional[Tuple[int, int]] = None
        cur_duration = 0.0
        cur_disc = False
        seq = 0
        idx = 0

        for raw in text.splitlines():
            line = raw.strip()
            if not line:
                continue
            if line.startswith("#EXT-X-MEDIA-SEQUENCE"):
                seq = int(re.search(r"(\d+)", line).group(1))
                pl.media_sequence = seq
            elif line.startswith("#EXT-X-TARGETDURATION"):
                pl.target_duration = float(re.search(r"(\d+)", line).group(1))
            elif line.startswith("#EXT-X-ENDLIST"):
                pl.endlist = True
            elif line.startswith("#EXT-X-DISCONTINUITY"):
                cur_disc = True
            elif line.startswith("#EXT-X-KEY"):
                attrs = dict(re.findall(r'([A-Z0-9\-]+)=("[^"]*"|[^,]*)', line))
                unq = lambda s: (s or "").strip().strip('"')      # noqa: E731
                method = unq(attrs.get("METHOD", "NONE")).upper()
                keyformat = unq(attrs.get("KEYFORMAT", "identity"))
                if method != "NONE" and keyformat.lower() not in ("identity", ""):
                    raise RuntimeError(
                        f"该流使用 DRM/非标准密钥体系（KEYFORMAT={keyformat}），本工具不支持且不尝试绕过")
                if method == "NONE":
                    cur_key = None
                else:
                    if method != "AES-128":
                        raise RuntimeError(f"不支持的加密方式：{method}")
                    iv_hex = unq(attrs.get("IV", ""))
                    iv = bytes.fromhex(iv_hex.lower().replace("0x", "")) if iv_hex else None
                    cur_key = KeyInfo(method=method, uri=urljoin(base, unq(attrs.get("URI", ""))),
                                      iv=iv, keyformat=keyformat)
            elif line.startswith("#EXT-X-MAP"):
                attrs = dict(re.findall(r'([A-Z0-9\-]+)=("[^"]*"|[^,]*)', line))
                unq = lambda s: (s or "").strip().strip('"')      # noqa: E731
                cur_map_uri = urljoin(base, unq(attrs.get("URI", "")))
                br = unq(attrs.get("BYTERANGE", ""))
                cur_map_range = tuple(int(x) for x in br.split("@")) if br else None
                if len(cur_map_range or ()) == 1:
                    cur_map_range = (cur_map_range[0], 0)
                pl.is_fmp4 = True
            elif line.startswith("#EXT-X-BYTERANGE"):
                nums = re.findall(r"(\d+)", line)
                if len(nums) >= 2:
                    cur_range = (int(nums[0]), int(nums[1]))
                elif nums:
                    prev = pl.segments[-1] if pl.segments else None
                    off = prev.byterange[1] + prev.byterange[0] if prev and prev.byterange else 0
                    cur_range = (int(nums[0]), off)
            elif line.startswith("#EXTINF"):
                cur_duration = float(re.search(r"([\d.]+)", line).group(1))
            elif line.startswith("#"):
                continue
            else:
                pl.segments.append(Segment(index=idx, uri=urljoin(base, line), duration=cur_duration,
                                           seq=seq, byterange=cur_range, key=cur_key,
                                           discontinuity=cur_disc))
                if cur_map_uri and pl.init_map is None:
                    pl.init_map = Segment(index=-1, uri=cur_map_uri, byterange=cur_map_range)
                idx += 1
                seq += 1
                cur_duration, cur_range, cur_disc = 0.0, None, False
        return pl

    @staticmethod
    def pick_variant(variants: List[Variant], prefer: str = "best") -> Variant:
        if not variants:
            raise RuntimeError("播放列表里没有任何可选流")
        if prefer == "best":
            return max(variants, key=lambda v: (int((v.resolution or "0x0").split("x")[-1] or 0), v.bandwidth))
        if prefer == "worst":
            return min(variants, key=lambda v: (int((v.resolution or "0x0").split("x")[-1] or 0), v.bandwidth))
        if re.fullmatch(r"\d+[pPiI]", prefer):
            h = int(prefer[:-1])
            cands = [v for v in variants if int((v.resolution or "0x0").split("x")[-1] or 0) > 0]
            if cands:
                return min(cands, key=lambda v: abs(int(v.resolution.split("x")[-1]) - h))
        for v in variants:
            if v.resolution == prefer:
                return v
        raise RuntimeError(f"未匹配到 {prefer}，可用：{[v.resolution or v.bandwidth for v in variants]}")

    # ---- 密钥与解密 ----
    def fetch_key(self, key: KeyInfo) -> bytes:
        if not key.uri:
            raise RuntimeError("EXT-X-KEY 缺少 URI")
        if key.uri in self.key_cache:
            return self.key_cache[key.uri]
        data = self.get_bytes(key.uri)
        if not data or len(data) not in (16, 24, 32):
            raise RuntimeError(f"密钥下载失败或长度异常：{key.uri}")
        self.key_cache[key.uri] = data
        log.info("已获取密钥 %s（%s 字节）", key.uri, len(data))
        return data

    @staticmethod
    def decrypt(data: bytes, key_bytes: bytes, iv: bytes) -> bytes:
        """HLS AES-128：CBC + PKCS7（RFC 8216 标准客户端行为）。"""
        if not _HAS_CRYPTO:
            raise RuntimeError("缺少 cryptography 库：pip install cryptography")
        dec = Cipher(algorithms.AES(key_bytes), modes.CBC(iv)).decryptor()
        plain = dec.update(data) + dec.finalize()
        pad = plain[-1]
        if 1 <= pad <= 16 and plain[-pad:] == bytes([pad]) * pad:
            plain = plain[:-pad]
        return plain

    # ---- 分片下载 ----
    def download_segments(self, segs: List[Segment], tmpdir: str, desc: str = "下载切片") -> List[Segment]:
        os.makedirs(tmpdir, exist_ok=True)

        def target(seg: Segment) -> str:
            ext = ".m4s" if seg.uri.split("?")[0].endswith((".m4s", ".mp4")) else ".ts"
            return os.path.join(tmpdir, f"{seg.index:06d}{ext}")

        todo = []
        for s in segs:
            s.path = target(s)
            if os.path.exists(s.path) and os.path.getsize(s.path) > 0:
                continue                       # 断点续传
            todo.append(s)

        if len(segs) != len(todo):
            log.info("断点续传：跳过已完成的 %s 个分片", len(segs) - len(todo))
        if not todo:
            return segs

        done, failed = 0, []
        bar = tqdm(total=len(todo), unit="片", desc=desc) if tqdm else None

        def worker(seg: Segment) -> bool:
            data = self.get_bytes(seg.uri, seg.byterange)
            if data is None:
                return False
            with open(seg.path, "wb") as f:
                f.write(data)
            return True

        with ThreadPoolExecutor(max_workers=self.workers) as pool:
            futures = {pool.submit(worker, s): s for s in todo}
            for fut in as_completed(futures):
                seg = futures[fut]
                try:
                    ok = fut.result()
                except Exception as exc:          # noqa: BLE001
                    log.warning("分片 %s 异常：%s", seg.uri, exc)
                    ok = False
                if ok:
                    done += 1
                else:
                    failed.append(seg)
                if bar:
                    bar.update(1)
                    bar.set_postfix_str(fmt_bytes(self._bytes))
                elif done % 20 == 0 or done == len(todo):
                    print(f"  进度 {done}/{len(todo)}  已收 {fmt_bytes(self._bytes)}", flush=True)
        if bar:
            bar.close()

        if failed:
            names = ", ".join(s.uri.rsplit("/", 1)[-1] for s in failed[:5])
            raise RuntimeError(f"{len(failed)} 个分片下载失败（如 {names}）。重跑本命令可续传")
        log.info("下载完成：%s 片 / %s", done, fmt_bytes(self._bytes))
        return segs

    # ---- 合并与封装 ----
    def assemble(self, segs: List[Segment], init_map: Optional[Segment],
                 tmpdir: str, merged_path: str) -> str:
        segs = sorted(segs, key=lambda s: s.index)
        log.info("开始合并 %s 个分片（约 %s）…", len(segs), fmt_time(sum(s.duration for s in segs)))
        with open(merged_path, "wb") as out:
            if init_map and os.path.exists(init_map.path or ""):
                with open(init_map.path, "rb") as f:
                    out.write(f.read())
            for s in segs:
                if not os.path.exists(s.path or ""):
                    raise RuntimeError(f"分片缺失：{s.path}")
                with open(s.path, "rb") as f:
                    data = f.read()
                if s.key and s.key.method == "AES-128":
                    iv = s.key.iv or s.seq.to_bytes(16, "big")
                    data = self.decrypt(data, self.fetch_key(s.key), iv)
                out.write(data)
        log.info("合并完成：%s（%s）", os.path.basename(merged_path),
                 fmt_bytes(os.path.getsize(merged_path)))
        return merged_path

    @staticmethod
    def remux(src: str, dst: str, faststart: bool = True) -> str:
        if not FFMPEG:
            log.warning("未检测到 ffmpeg，保留原始容器：%s", src)
            return src
        cmd = [FFMPEG, "-y", "-hide_banner", "-loglevel", "error",
               "-fflags", "+genpts", "-i", src, "-c", "copy"]
        if faststart:
            cmd += ["-movflags", "+faststart"]
        code, msg = run_cmd(cmd + [dst])
        if code != 0:
            log.warning("封装失败（%s），保留中间文件：%s", code, msg[:200])
            return src
        log.info("封装完成：%s（%s）", os.path.basename(dst), fmt_bytes(os.path.getsize(dst)))
        return dst

    @staticmethod
    def mux_av(video: str, audio: str, dst: str) -> str:
        if not FFMPEG:
            log.warning("未检测到 ffmpeg，无法混流音轨")
            return video
        code, msg = run_cmd([FFMPEG, "-y", "-hide_banner", "-loglevel", "error",
                             "-i", video, "-i", audio, "-c", "copy",
                             "-map", "0:v:0", "-map", "1:a:0", "-movflags", "+faststart", dst])
        if code != 0:
            log.warning("混流失败，仅输出视频：%s", msg[:200])
            return video
        return dst

    # ---- 主流程 ----
    def download(self, m3u8_url: str, out_path: str, variant: str = "best",
                 live: bool = False, max_seconds: float = 0, no_remux: bool = False,
                 tmp_root: Optional[str] = None, work_dir: Optional[str] = None) -> str:
        """work_dir：指定固定的分片缓存目录后，重跑同一命令可断点续传（未指定则用临时目录）。"""
        t0 = time.time()
        out_path = os.path.abspath(out_path)
        os.makedirs(os.path.dirname(out_path) or ".", exist_ok=True)
        stem, _ = os.path.splitext(out_path)

        persistent = bool(work_dir)
        if persistent:
            # 用输出文件名隔离每部片的分片，避免互相覆盖
            tmpdir = os.path.join(os.path.abspath(work_dir),
                                  safe_name(os.path.splitext(os.path.basename(out_path))[0], "part"))
            os.makedirs(tmpdir, exist_ok=True)
            log.info("分片缓存目录：%s（重跑可续传）", tmpdir)
        else:
            tmpdir = tempfile.mkdtemp(prefix="hls_", dir=tmp_root)

        try:
            text = self.get_text(m3u8_url)
            if not text:
                raise RuntimeError(f"无法获取播放列表：{m3u8_url}")

            audio_url = ""
            if "#EXT-X-STREAM-INF" in text:
                variants = self.parse_master(text, m3u8_url)
                log.info("主列表 %s 个清晰度：%s", len(variants),
                         [v.resolution or f"{v.bandwidth // 1000}k" for v in variants])
                chosen = self.pick_variant(variants, variant)
                log.info("选用：%s（%s bps）", chosen.resolution or "默认", chosen.bandwidth)
                rends = self.parse_audio_renditions(text, m3u8_url)
                if chosen.audio_group in rends:
                    audio_url = rends[chosen.audio_group].url
                m3u8_url, text = chosen.url, None

            all_segs: List[Segment] = []
            init_map: Optional[Segment] = None
            seen, endlist, round_no = set(), False, 0
            is_fmp4 = False

            while True:
                round_no += 1
                text = self.get_text(m3u8_url)
                if not text:
                    raise RuntimeError(f"无法获取媒体列表：{m3u8_url}")
                pl = self.parse_media(text, m3u8_url)
                init_map = init_map or pl.init_map
                endlist = pl.endlist
                is_fmp4 = is_fmp4 or pl.is_fmp4

                fresh = []
                for s in pl.segments:
                    token = (s.uri, s.byterange, s.seq)
                    if token in seen:
                        continue
                    seen.add(token)
                    # 必须在 extend 之前按顺序编号，否则所有分片 index 会撞成同一个值
                    s.index = len(all_segs) + len(fresh)
                    fresh.append(s)
                all_segs.extend(fresh)
                log.info("第 %s 轮拉取：新增 %s 片，累计 %s 片，ENDLIST=%s",
                         round_no, len(fresh), len(all_segs), endlist)

                if not live or endlist:
                    break
                if max_seconds and sum(s.duration for s in all_segs) >= max_seconds:
                    log.info("达到录制上限 %ss，停止", max_seconds)
                    break
                time.sleep(max(0.5, (pl.target_duration or 4) * 0.8))

            if not all_segs:
                raise RuntimeError("播放列表里没有解析到任何分片")

            targets = list(all_segs)
            if init_map:
                init_map.index = -1
                init_map.path = os.path.join(tmpdir, "init.mp4")
                if not (os.path.exists(init_map.path) and os.path.getsize(init_map.path) > 0):
                    data = self.get_bytes(init_map.uri, init_map.byterange)
                    if not data:
                        raise RuntimeError("初始化段（EXT-X-MAP）下载失败")
                    with open(init_map.path, "wb") as f:
                        f.write(data)
                else:
                    targets = [init_map] + targets
            self.download_segments(targets, tmpdir)

            merged = os.path.join(tmpdir, "merged" + (".mp4" if is_fmp4 else ".ts"))
            self.assemble(all_segs, init_map, tmpdir, merged)

            final = merged
            if no_remux:
                keep = os.path.join(os.path.dirname(out_path), os.path.basename(merged))
                shutil.copy(merged, keep)
                final = keep
            else:
                final = self.remux(merged, stem + ".mp4")

            if audio_url:
                log.info("检测到独立音轨，下载并混流：%s", audio_url)
                a_dir = tempfile.mkdtemp(prefix="hls_a_", dir=tmp_root)
                try:
                    a_text = self.get_text(audio_url)
                    if a_text:
                        a_pl = self.parse_media(a_text, audio_url)
                        self.download_segments(a_pl.segments, a_dir, "下载音轨")
                        a_merged = os.path.join(a_dir, "audio.ts")
                        self.assemble(a_pl.segments, a_pl.init_map, a_dir, a_merged)
                        v_final = merged if is_fmp4 else self.remux(merged, os.path.join(a_dir, "v.mp4"))
                        a_final = self.remux(a_merged, os.path.join(a_dir, "a.m4a"))
                        mixed = self.mux_av(v_final, a_final, stem + "_av.mp4")
                        if mixed != v_final:
                            final = mixed
                except Exception as exc:          # noqa: BLE001
                    log.warning("音轨处理失败（忽略，保留视频）：%s", exc)
                finally:
                    if not self.keep_segments:
                        shutil.rmtree(a_dir, ignore_errors=True)

            print(f"\n✅ 完成：{final}\n   分片 {len(all_segs)} 个 | 时长 "
                  f"{fmt_time(sum(s.duration for s in all_segs))} | 流量 {fmt_bytes(self._bytes)} "
                  f"| 耗时 {time.time() - t0:.1f}s", flush=True)
            return final

        finally:
            if persistent:
                log.info("分片缓存已保留在 %s（下载完成后可手动清理）", tmpdir)
            elif self.keep_segments:
                log.info("已保留分片目录：%s", tmpdir)
            else:
                shutil.rmtree(tmpdir, ignore_errors=True)


# =========================================================================== #
# 5. 存储层
# =========================================================================== #
class Writer:
    """同时服务 VideoItem / PlayItem；格式由扩展名决定（.csv 或 .jsonl）。"""

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


def iter_jsonl(path: str):
    with open(path, "r", encoding="utf-8-sig") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            try:
                yield json.loads(line)
            except json.JSONDecodeError:
                continue


# =========================================================================== #
# 6. 一体化流水线
# =========================================================================== #
class Pipeline:
    """把采集与下载串起来：列表 → 详情 → 播放页取址 → 下载合并。"""

    def __init__(self, fetcher: Fetcher, resolve_play: int = 0, probe_m3u8: bool = True,
                 downloader_kwargs: Optional[Dict] = None, out_dir: str = "downloads",
                 variant: str = "best", live: bool = False, max_seconds: float = 0,
                 no_remux: bool = False, limit: int = 0, with_detail: bool = True,
                 work_dir: str = ""):
        self.fetcher = fetcher
        self.resolve_play = resolve_play
        self.probe_m3u8 = probe_m3u8
        self.dl_kwargs = downloader_kwargs or {}
        self.out_dir = out_dir
        self.variant = variant
        self.live = live
        self.max_seconds = max_seconds
        self.no_remux = no_remux
        self.limit = limit
        self.with_detail = with_detail
        self.work_dir = work_dir
        self.seen: set = set()
        self.stats = {"videos": 0, "streams": 0, "downloaded": 0, "failed": 0}

    # ---- 播放地址解析 ----
    def resolve(self, item: VideoItem, play_writer: Optional[Writer] = None,
                defer_write: bool = False) -> List[PlayItem]:
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

            for name, s_url in cands[:max(1, self.resolve_play)]:
                pi = PlayItem(
                    title=item.title,
                    line=entry["line"] or (parsed["flag"] or f"线路{entry['sid']}"),
                    sid=entry["sid"], nid=entry["nid"], episode=name or entry["episode"],
                    play_page=entry["url"], stream_url=s_url, referer=referer,
                    stream_type=("iframe" if s_url and s_url == parsed.get("iframe")
                                 else classify_stream(s_url)),
                )
                if self.probe_m3u8 and pi.stream_type in ("m3u8", "file"):
                    info = self._probe_stream(s_url, referer)
                    pi.m3u8_type = info.get("type", "")
                    pi.m3u8_variants = " / ".join(
                        v["resolution"] or str(v["bandwidth"]) for v in info.get("variants", []))
                    pi.m3u8_segments = int(info.get("segments", 0))
                    pi.m3u8_duration = round(float(info.get("duration", 0.0)), 1)
                    pi.encrypted = bool(info.get("encrypted"))
                    pi.note = info.get("note", "") or ("已加密(AES-128)，按协议解密" if pi.encrypted else "")
                    if info.get("type") == "master" and info.get("variants"):
                        top = max(info["variants"], key=lambda v: v["bandwidth"] or 0)
                        pi.m3u8_variants += f" | 最高码率: {top['url']}"
                results.append(pi)
                # defer_write：需要下载时先不落盘，等回填 local_file 后写一次，避免重复记录
                if play_writer and not defer_write:
                    play_writer.write(pi)
                log.info("✔ 取址 %s | %s | %s | %s", pi.title, pi.line, pi.episode, pi.stream_url[:80])
            if len(parsed["episodes"]) > 1:
                break          # 单个播放页已带全集地址，无需再翻其他集

        if results:
            first = next((r for r in results if r.stream_type in ("m3u8", "file")), results[0])
            item.best_stream = first.stream_url
            item.best_stream_type = first.stream_type
        self.stats["streams"] += len(results)
        return results

    def _probe_stream(self, url: str, referer: str) -> Dict:
        if not url.startswith("http"):
            return {"note": "非直链，需站内解析接口二次解析"}
        try:
            if classify_stream(url) == "m3u8":
                text = self.fetcher.get_text(url, referer=referer)
                if not text:
                    return {"note": "m3u8 拉取失败"}
                return parse_m3u8_text(text, base_url=url)
            r = self.fetcher.session.head(url, timeout=self.fetcher.timeout,
                                          headers={"Referer": referer}, allow_redirects=True)
            time.sleep(self.fetcher.delay)
            return {"type": "file", "http_status": r.status_code,
                    "content_type": r.headers.get("Content-Type", ""),
                    "size_mb": round(int(r.headers.get("Content-Length", 0) or 0) / 1048576, 1)}
        except requests.RequestException as exc:
            return {"note": f"探测异常：{exc}"}

    # ---- 下载 ----
    def download_play(self, pi: PlayItem) -> Optional[str]:
        if pi.stream_type not in ("m3u8", "file"):
            log.warning("跳过非直链（%s）：%s", pi.stream_type, pi.stream_url[:60])
            return None
        os.makedirs(self.out_dir, exist_ok=True)
        name = safe_name(f"{pi.title}_{pi.episode}", "video")
        dst = os.path.join(self.out_dir, f"{name}.mp4")
        dl = HLSDownloader(referer=pi.referer or BASE + "/", **self.dl_kwargs)
        final = dl.download(pi.stream_url, dst, variant=self.variant, live=self.live,
                            max_seconds=self.max_seconds, no_remux=self.no_remux,
                            work_dir=self.work_dir or None)
        return final

    # ---- 走完一部片子 ----
    def process(self, item: VideoItem, play_writer: Optional[Writer] = None,
                do_download: bool = False) -> List[PlayItem]:
        plays = self.resolve(item, play_writer, defer_write=do_download)
        if do_download:
            for pi in plays:
                try:
                    pi.local_file = self.download_play(pi) or ""
                    if pi.local_file:
                        self.stats["downloaded"] += 1
                except Exception as exc:            # noqa: BLE001
                    self.stats["failed"] += 1
                    log.error("下载失败 %s %s：%s", pi.title, pi.episode, exc)
                if play_writer:                     # 无论成败都落盘一次，带 local_file
                    play_writer.write(pi)
        return plays

    # ---- 入口：分类翻页 ----
    def crawl_category(self, category: int, pages: int, static: bool = True,
                       writer: Optional[Writer] = None, play_writer: Optional[Writer] = None,
                       do_download: bool = False):
        name = CATEGORIES.get(category, str(category))
        for page in range(1, pages + 1):
            url = build_list_url(category, page, static)
            log.info("抓取列表 %s（%s 第 %s 页）", url, name, page)
            html = self.fetcher.get(url)
            if not html and static:
                html = self.fetcher.get(build_list_url(category, page, static=False))
            if not html:
                continue
            for item in parse_list_page(html, category=name):
                if item.url in self.seen:
                    continue
                self.seen.add(item.url)
                yield from self._handle(item, writer, play_writer, do_download)
                if self.limit and self.stats["videos"] >= self.limit:
                    log.info("达到上限 %s 部，停止", self.limit)
                    return

    # ---- 入口：指定 URL 列表 ----
    def crawl_urls(self, urls: List[str], writer=None, play_writer=None, do_download=False):
        for i, url in enumerate(urls, 1):
            log.info("(%s) %s", i, url)
            html = self.fetcher.get(url)
            if not html:
                continue
            items = parse_list_page(html) if DETAIL_RE.search(url) is None else []
            if items:
                for it in items:
                    if it.url in self.seen:
                        continue
                    self.seen.add(it.url)
                    yield from self._handle(it, writer, play_writer, do_download)
            else:
                item = parse_detail_page(html)
                item.url = item.url or url
                yield from self._handle(item, writer, play_writer, do_download)
            if self.limit and self.stats["videos"] >= self.limit:
                return

    def _handle(self, item: VideoItem, writer, play_writer, do_download):
        if self.with_detail and not item.intro:
            html = self.fetcher.get(item.url)
            if html:
                item = parse_detail_page(html, item)
        self.process(item, play_writer, do_download)
        self.stats["videos"] += 1
        extra = f" | {item.best_stream_type}:{item.best_stream[:50]}" if item.best_stream else ""
        print(f"✔ {item.title} | {item.tag} | {item.year or '-'} | 入口{item.play_count}{extra}")
        if writer:
            writer.write(item)
        yield item


# =========================================================================== #
# 7. 自检：离线样例 + 本地真实 HLS 端到端
# =========================================================================== #
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
          <li><a href="/vodplay/31088-1-1.html">第1集</a></li>
          <li><a href="/vodplay/31088-1-2.html">第2集</a></li>
          <li><a href="/vodplay/31088-1-3.html">第3集</a></li>
        </ul>
      </div>
    </div>
  </div>
</div>
"""

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


def _serve_dir(directory: str, port: int = 0, routes: Optional[Dict[str, str]] = None):
    """后台起静态服务；routes 可挂自定义路径返回指定文本。返回 (server, port)。"""
    import http.server
    import socketserver

    class Handler(http.server.SimpleHTTPRequestHandler):
        def __init__(self, *a, **kw):
            super().__init__(*a, directory=directory, **kw)

        def do_GET(self):
            path = self.path.split("?")[0]
            if routes and path in routes:
                body = routes[path].encode("utf-8")
                self.send_response(200)
                self.send_header("Content-Type", "text/html; charset=utf-8")
                self.send_header("Content-Length", str(len(body)))
                self.end_headers()
                self.wfile.write(body)
                return
            super().do_GET()

        def log_message(self, *a):
            pass

    class Server(socketserver.ThreadingTCPServer):
        allow_reuse_address = True
        daemon_threads = True

    srv = Server(("127.0.0.1", port), Handler)
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    return srv, srv.server_address[1]


def _probe_file(path: str) -> Tuple[bool, float, str]:
    code, out = run_cmd(["ffprobe", "-v", "error", "-show_entries",
                         "format=duration:stream=codec_type", "-of", "json", path])
    if code != 0:
        return False, 0.0, out[:200]
    try:
        info = json.loads(out)
        return True, float(info["format"]["duration"]), ",".join(
            s.get("codec_type", "") for s in info.get("streams", []))
    except Exception:      # noqa: BLE001
        return False, 0.0, "解析失败"


def _video_frames(path: str) -> List[str]:
    """解码视频流返回逐帧 md5 序列：顺序错乱、重复拼接都会被发现。"""
    code, out = run_cmd(["ffmpeg", "-v", "error", "-i", path, "-map", "0:v:0", "-f", "framemd5", "-"])
    if code != 0:
        return []
    return [ln.split(",")[-1].strip() for ln in out.splitlines() if ln and not ln.startswith("#")]


def selftest() -> int:
    global BASE
    ok = True
    orig_base = BASE

    def check(cond: bool, label: str) -> bool:
        nonlocal ok
        ok &= bool(cond)
        print(f"   {'✅' if cond else '❌'} {label}")
        return bool(cond)

    # ---------------- A. 离线样例解析 ----------------
    print("\n【A】采集端解析（内置 HTML 样例）")
    items = parse_list_page(SAMPLE_LIST, category="电视剧")
    print(f"   解析到 {len(items)} 条：{[i.title for i in items]}")
    check(len(items) == 2, "列表解析出 2 条")
    check(items[0].title == "孤舟" and items[0].remark == "全36集", "片名与集数角标")
    check(items[0].url == orig_base + "/detail/31088.html", "详情页绝对地址")
    check(items[0].cover.endswith(".jpg"), "封面取到 data-original")
    check(guess_total_pages(SAMPLE_LIST) == 3, "分页总页数推测")
    check(build_list_url(2, 3) == f"{orig_base}/vodtype/2/page/3.html", "列表 URL 构造")

    d = parse_detail_page(SAMPLE_DETAIL, items[0])
    print(f"   详情：{d.title} | {d.director} | {d.year} | {d.area} | {d.actors[:12]}…")
    check(d.director == "韩晓军" and d.year == "2024" and d.area == "中国大陆", "详情字段提取")
    check(d.intro.startswith("1941年"), "简介提取")

    entries = extract_play_entries(SAMPLE_DETAIL, d.title)
    print(f"   播放入口 {len(entries)} 个：{[e['episode'] for e in entries]}")
    check(len(entries) == 3, "播放页入口 3 个")
    check(entries[0]["url"] == orig_base + "/vodplay/31088-1-1.html", "播放页 URL")
    check(entries[0]["sid"] == 1 and entries[2]["nid"] == 3, "sid/nid 解析")

    play = parse_play_page(SAMPLE_PLAY)
    print(f"   播放页：flag={play['flag']}，解析出 {len(play['episodes'])} 条地址")
    for n, u in play["episodes"]:
        print(f"     - {n or '(默认)'} | {u}")
    check(play["flag"] == "m3u8", "播放器 flag")
    check(len(play["episodes"]) == 3, "全集地址来自 url_next")
    check(play["episodes"][0] == ("第1集", "https://v.gsuus.com/play/QBY0yWKa/1.m3u8"), "集名与地址配对")
    check(classify_stream(play["episodes"][0][1]) == "m3u8", "地址分类为 m3u8")

    master = parse_m3u8_text(SAMPLE_M3U8_MASTER, "https://v.gsuus.com/play/QBY0yWKa/index.m3u8")
    check(master["type"] == "master" and len(master["variants"]) == 2, "m3u8 主列表 2 档码率")
    media = parse_m3u8_text(SAMPLE_M3U8_MEDIA)
    check(media["type"] == "media" and media["segments"] == 3
          and media["duration"] == 30.0 and media["encrypted"], "m3u8 分片列表/时长/加密标记")
    check(classify_stream("https://a/b.mp4") == "file"
          and classify_stream("https://v.youku.com/v_show/id_X") == "platform"
          and classify_stream("m3u8") == "parse_api", "地址分类（file/platform/parse_api）")

    # ---------------- B. 下载端：真实 HLS ----------------
    print("\n【B】下载端（ffmpeg 造流，逐帧内容校验）")
    if not FFMPEG:
        print("   ❌ 未检测到 ffmpeg，跳过下载端与端到端校验")
        return 1 if not ok else 0

    work = tempfile.mkdtemp(prefix="pipeline_test_")
    try:
        ref = os.path.join(work, "ref.mp4")
        code, msg = run_cmd([FFMPEG, "-y", "-hide_banner", "-loglevel", "error",
                             "-f", "lavfi", "-i", "testsrc=duration=8:size=320x240:rate=15",
                             "-f", "lavfi", "-i", "sine=frequency=440:duration=8",
                             "-c:v", "libx264", "-pix_fmt", "yuv420p", "-preset", "ultrafast",
                             "-g", "30", "-keyint_min", "30", "-sc_threshold", "0",
                             "-force_key_frames", "expr:gte(t,n_forced*2)",
                             "-c:a", "aac", "-shortest", ref])
        if code != 0:
            print("   ❌ 基准片源生成失败：", msg[:300])
            return 1
        ref_frames = _video_frames(ref)
        print(f"   基准片源：{len(ref_frames)} 帧")

        seg_common = ["-c", "copy", "-f", "hls", "-hls_time", "2", "-hls_list_size", "0"]
        plain = os.path.join(work, "plain.m3u8")
        run_cmd([FFMPEG, "-y", "-hide_banner", "-loglevel", "error", "-i", ref,
                 *seg_common, "-hls_segment_filename", os.path.join(work, "p_%03d.ts"), plain])

        keyfile = os.path.join(work, "enc.key")
        with open(keyfile, "wb") as f:
            f.write(bytes(range(16)))
        keyinfo = os.path.join(work, "keyinfo")
        with open(keyinfo, "w", encoding="utf-8") as f:
            f.write(f"enc.key\n{keyfile}\n0123456789abcdef0123456789abcdef\n")
        enc_m3u8 = os.path.join(work, "enc.m3u8")
        run_cmd([FFMPEG, "-y", "-hide_banner", "-loglevel", "error", "-i", ref,
                 *seg_common, "-hls_key_info_file", keyinfo, "-hls_enc", "1",
                 "-hls_segment_filename", os.path.join(work, "e_%03d.ts"), enc_m3u8])

        fmp4 = os.path.join(work, "fmp4.m3u8")
        run_cmd([FFMPEG, "-y", "-hide_banner", "-loglevel", "error", "-i", ref,
                 *seg_common, "-hls_segment_type", "fmp4",
                 "-hls_fmp4_init_filename", "init.mp4",
                 "-hls_segment_filename", os.path.join(work, "f_%03d.m4s"), fmp4])

        master_pl = os.path.join(work, "master.m3u8")
        run_cmd([FFMPEG, "-y", "-hide_banner", "-loglevel", "error", "-i", ref,
                 *seg_common, "-master_pl_name", "master.m3u8", "-var_stream_map", "v:0,a:0",
                 "-hls_segment_filename", os.path.join(work, "m_%03d.ts"),
                 os.path.join(work, "stream_%v.m3u8")])

        live_txt = "".join(l + "\n" for l in open(plain, encoding="utf-8")
                           if not l.startswith("#EXT-X-ENDLIST"))
        with open(os.path.join(work, "live.m3u8"), "w", encoding="utf-8") as f:
            f.write(live_txt)

        srv, port = _serve_dir(work)
        base = f"http://127.0.0.1:{port}"
        time.sleep(0.5)

        for label, url in (("明文 TS", f"{base}/plain.m3u8"),
                           ("AES-128", f"{base}/enc.m3u8"),
                           ("fMP4", f"{base}/fmp4.m3u8"),
                           ("主列表选流", f"{base}/master.m3u8")):
            dl = HLSDownloader(workers=6, retries=2, timeout=10, referer=base + "/")
            try:
                final = dl.download(url, os.path.join(work, f"out_{label}.mp4"))
            except Exception as exc:      # noqa: BLE001
                print(f"   ❌ {label} 下载失败：{exc}")
                ok = False
                continue
            frames = _video_frames(final)
            valid, dur, streams = _probe_file(final)
            print(f"   {label}：{os.path.basename(final)} | {fmt_bytes(os.path.getsize(final))} "
                  f"| {dur:.1f}s | 帧 {len(frames)}/{len(ref_frames)}")
            check(frames == ref_frames, f"{label} 逐帧内容与基准一致")

        # 反证：加密原始分片无法直接解码，说明产物确实经过解密
        enc_seg = next((os.path.join(work, f) for f in sorted(os.listdir(work))
                        if f.startswith("e_") and f.endswith(".ts")), "")
        if enc_seg:
            check(not _video_frames(enc_seg), "AES 加密分片无法直接解码（反证解密生效）")

        # 断点续传：指定 work_dir 后，第二次应 0 流量；删掉一片后应只补那一片
        wd = os.path.join(work, "缓存")
        url_plain = f"{base}/plain.m3u8"
        out_resume = os.path.join(work, "resume.mp4")
        d1 = HLSDownloader(workers=4, retries=2, timeout=10, referer=base + "/")
        d1.download(url_plain, out_resume, work_dir=wd)
        first_bytes = d1._bytes
        d2 = HLSDownloader(workers=4, retries=2, timeout=10, referer=base + "/")
        d2.download(url_plain, out_resume, work_dir=wd)
        print(f"   首次 {fmt_bytes(first_bytes)} → 重跑 {fmt_bytes(d2._bytes)}")
        check(first_bytes > 0 and d2._bytes == 0, "重跑全量命中缓存（0 新增流量）")
        cache_dir = os.path.join(wd, "resume")
        cached = sorted(f for f in os.listdir(cache_dir) if f.endswith(".ts"))
        os.remove(os.path.join(cache_dir, cached[1]))
        d3 = HLSDownloader(workers=4, retries=2, timeout=10, referer=base + "/")
        d3.download(url_plain, out_resume, work_dir=wd)
        print(f"   删掉 1 片后重跑：补下 {fmt_bytes(d3._bytes)}（约为单片大小）")
        check(0 < d3._bytes < first_bytes, "缺失分片被单独补齐（部分续传）")
        check(_video_frames(out_resume) == ref_frames, "续传后产物内容仍完整一致")

        # ---------------- C. 端到端：采集 → 取址 → 下载 ----------------
        print("\n【C】端到端（本地站点：详情页 → 播放页 → m3u8 → mp4）")
        detail_html = SAMPLE_DETAIL
        play_html = ("<script>var player_aaaa={\"flag\":\"m3u8\",\"url\":"
                     f"\"{base.replace('http', 'http')}/enc.m3u8\"}};</script>")
        srv2, port2 = _serve_dir(work, routes={"/detail/31088.html": detail_html,
                                               "/play/31088-1-1.html": play_html})
        base2 = f"http://127.0.0.1:{port2}"
        BASE = base2                      # 临时把站点根指向本地服务
        try:
            f = Fetcher(delay=0.05, retries=2, timeout=10, cache_dir=None)
            pw = Writer(os.path.join(work, "端到端_播放地址.jsonl"), PlayItem)
            vw = Writer(os.path.join(work, "端到端_影片.jsonl"), VideoItem)
            pipe = Pipeline(f, resolve_play=1, probe_m3u8=False,
                            downloader_kwargs={"workers": 6, "retries": 2, "timeout": 10},
                            out_dir=os.path.join(work, "端到端_产物"))
            got = list(pipe.crawl_urls([f"{base2}/detail/31088.html"],
                                       writer=vw, play_writer=pw, do_download=True))
            pw.close()
            vw.close()
            print(f"   采集影片 {len(got)} 部，解析地址 {pipe.stats['streams']} 条，"
                  f"下载成功 {pipe.stats['downloaded']} 个")
            check(len(got) == 1 and got[0].title == "孤舟", "端到端采集到目标影片")
            check(pipe.stats["streams"] >= 1, "端到端解析出播放地址")
            check(pipe.stats["downloaded"] >= 1, "端到端下载成功")
            files = sorted(os.listdir(os.path.join(work, "端到端_产物")))
            print(f"   产物目录：{files}")
            if files:
                prod = os.path.join(work, "端到端_产物", files[0])
                frames = _video_frames(prod)
                print(f"   产物帧数：{len(frames)}/{len(ref_frames)}")
                check(frames == ref_frames, "端到端产物内容与基准片源逐帧一致")
            else:
                check(False, "端到端产物目录非空")
            # jsonl 可被 download 子命令读回
            recs = list(iter_jsonl(os.path.join(work, "端到端_播放地址.jsonl")))
            check(any(r.get("stream_url", "").endswith(".m3u8") for r in recs),
                  "播放地址 jsonl 可被下游读取")
        finally:
            BASE = orig_base
            srv2.shutdown()

        # ---------------- D. 边界与辅助 ----------------
        print("\n【D】边界与辅助能力")
        try:
            HLSDownloader.parse_media(
                '#EXT-X-KEY:METHOD=SAMPLE-AES,URI="skd://x",'
                'KEYFORMAT="com.apple.streamingkeydelivery"', "https://x/")
            check(False, "DRM 流被拦截")
        except RuntimeError as exc:
            check("DRM" in str(exc), f"DRM 流被拦截（{str(exc)[:40]}…）")
        check(RateLimiter(1024).rate == 1024, "限速器")
        check(safe_name('a/b:c*d?"e<f>|g') == "a_b_c_d_e_f_g", "文件名清洗")
        srv.shutdown()
    finally:
        shutil.rmtree(work, ignore_errors=True)

    print("\n" + ("✅ 自检全部通过" if ok else "❌ 自检存在失败项"))
    return 0 if ok else 1


# =========================================================================== #
# 8. CLI
# =========================================================================== #
def add_common(p: argparse.ArgumentParser) -> None:
    p.add_argument("--base", default=BASE,
                   help=f"站点根地址，默认 {BASE}；该站镜像域名常变，失效时用新域名覆盖")
    p.add_argument("--delay", type=float, default=1.5, help="请求间隔秒（礼貌抓取，建议 ≥1）")
    p.add_argument("--retries", type=int, default=3)
    p.add_argument("--timeout", type=int, default=15)
    p.add_argument("--proxy", default="")
    p.add_argument("--header", action="append", default=[], help="额外请求头 Key:Value（可多次）")
    p.add_argument("--cache-dir", default="", help="HTML 缓存目录")
    p.add_argument("--use-cache", action="store_true")
    p.add_argument("-v", "--verbose", action="store_true")


def add_download_args(p: argparse.ArgumentParser) -> None:
    p.add_argument("--workers", type=int, default=8, help="并发下载线程数")
    p.add_argument("--variant", default="best", help="清晰度 best / worst / 720p / 1280x720")
    p.add_argument("--max-speed", type=float, default=0, help="限速 KB/s")
    p.add_argument("--live", action="store_true", help="直播流持续拉取")
    p.add_argument("--work-dir", default="", help="分片缓存目录；指定后中断重跑可断点续传")
    p.add_argument("--max-seconds", type=float, default=0, help="直播录制上限秒")
    p.add_argument("--no-remux", action="store_true", help="不封装 mp4，保留合并后原始流")
    p.add_argument("--keep-segments", action="store_true", help="保留分片目录")
    p.add_argument("--no-probe-m3u8", action="store_true", help="不预探 m3u8，只记录地址")


def parse_headers(pairs: List[str]) -> Dict[str, str]:
    out = {}
    for h in pairs:
        if ":" in h:
            k, _, v = h.partition(":")
            out[k.strip()] = v.strip()
    return out


def build_fetcher(args) -> Fetcher:
    return Fetcher(delay=args.delay, retries=args.retries, timeout=args.timeout,
                   proxy=args.proxy, cache_dir=args.cache_dir or None,
                   use_cache=args.use_cache, headers=parse_headers(args.header))


def build_dl_kwargs(args) -> Dict:
    return dict(workers=args.workers, retries=args.retries, timeout=max(args.timeout, 20),
                proxy=args.proxy, max_speed=args.max_speed * 1024 if args.max_speed else 0,
                keep_segments=args.keep_segments, headers=parse_headers(args.header))


def main(argv: Optional[List[str]] = None) -> int:
    ap = argparse.ArgumentParser(
        prog="影视采集下载一体化",
        description="站点采集 → 播放地址提取 → m3u8 切片下载合并 → mp4",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="示例：\n"
               "  python3 影视采集下载一体化.py selftest\n"
               "  python3 影视采集下载一体化.py crawl --category 2 --pages 1 --resolve-play 3\n"
               "  python3 影视采集下载一体化.py run --category 2 --pages 1 --out-dir downloads\n"
               "  python3 影视采集下载一体化.py run --url-file urls.txt --out-dir downloads --limit 5\n"
               "  python3 影视采集下载一体化.py download --url https://x/index.m3u8 --out 电影.mp4\n")
    sub = ap.add_subparsers(dest="cmd", required=True)

    # ---- crawl ----
    c = sub.add_parser("crawl", help="只采集：产出影片信息 + 播放地址")
    c.add_argument("--category", type=int, help="分类 id：1电影 2电视剧 3综艺 4动漫")
    c.add_argument("--url-file", help="从文件读取列表页/详情页 URL，一行一个")
    c.add_argument("--pages", type=int, default=1)
    c.add_argument("--limit", type=int, default=0, help="最多采集多少部影片")
    c.add_argument("--resolve-play", type=int, default=0,
                   help="每部片最多解析多少个播放页（0=只登记链接）")
    c.add_argument("--no-detail", action="store_true", help="只抓列表不下详情")
    c.add_argument("--out", default="影片信息.jsonl")
    c.add_argument("--play-out", default="播放地址.jsonl")
    c.add_argument("--dynamic", action="store_true", help="使用 index.php 动态路由")
    add_common(c)
    add_download_args(c)

    # ---- run ----
    r = sub.add_parser("run", help="采集 + 下载一步到位")
    r.add_argument("--category", type=int)
    r.add_argument("--url-file")
    r.add_argument("--pages", type=int, default=1)
    r.add_argument("--limit", type=int, default=0)
    r.add_argument("--resolve-play", type=int, default=2)
    r.add_argument("--out-dir", default="downloads")
    r.add_argument("--out", default="影片信息.jsonl")
    r.add_argument("--play-out", default="播放地址.jsonl")
    r.add_argument("--dynamic", action="store_true")
    add_common(r)
    add_download_args(r)

    # ---- download ----
    d = sub.add_parser("download", help="只下载：m3u8 地址或播放地址文件")
    d.add_argument("--url", help="单条 m3u8 地址")
    d.add_argument("--from-jsonl", help="从上一步产出的播放地址 jsonl 批量下载")
    d.add_argument("--out", default="output.mp4")
    d.add_argument("--out-dir", default="downloads")
    d.add_argument("--limit", type=int, default=0)
    d.add_argument("--only", default="", help="只下载标题含该关键字的条目")
    add_common(d)
    add_download_args(d)

    st = sub.add_parser("selftest", help="离线自检：本地造流端到端跑通全链路")
    add_common(st)

    args = ap.parse_args(argv)
    logging.basicConfig(level=logging.DEBUG if args.verbose else logging.INFO,
                        format="%(asctime)s %(levelname)s %(message)s")

    if args.cmd == "selftest":
        return selftest()

    global BASE
    if getattr(args, "base", "") and args.base != BASE:
        BASE = args.base.rstrip("/")
        log.info("站点根地址：%s", BASE)

    if args.cmd == "download":
        if not args.url and not args.from_jsonl:
            ap.error("download 需要 --url 或 --from-jsonl")
        dl_kwargs = build_dl_kwargs(args)
        try:
            if args.from_jsonl:
                os.makedirs(args.out_dir, exist_ok=True)
                n = done = 0
                for rec in iter_jsonl(args.from_jsonl):
                    url = rec.get("stream_url") or ""
                    if not url.startswith("http") or ".m3u8" not in url:
                        continue
                    if args.only and args.only not in (rec.get("title", "") + rec.get("episode", "")):
                        continue
                    n += 1
                    name = safe_name(f"{rec.get('title','')}_{rec.get('episode','')}", "video")
                    print(f"\n▶ [{n}] {name}  {url[:90]}")
                    try:
                        hl = HLSDownloader(referer=rec.get("referer") or BASE + "/", **dl_kwargs)
                        hl.download(url, os.path.join(args.out_dir, f"{name}.mp4"),
                                    variant=args.variant, live=args.live,
                                    max_seconds=args.max_seconds, no_remux=args.no_remux,
                                    work_dir=args.work_dir or None)
                        done += 1
                    except Exception as exc:      # noqa: BLE001
                        log.error("下载失败 %s：%s", name, exc)
                    if args.limit and n >= args.limit:
                        break
                print(f"\n批量完成：成功 {done} / 共 {n}")
            else:
                hl = HLSDownloader(referer=BASE + "/", **dl_kwargs)
                hl.download(args.url, args.out, variant=args.variant, live=args.live,
                            max_seconds=args.max_seconds, no_remux=args.no_remux,
                            work_dir=args.work_dir or None)
        except KeyboardInterrupt:
            log.warning("已中断（重跑同一命令可续传）")
            return 130
        except RuntimeError as exc:
            log.error("%s", exc)
            return 1
        return 0

    # crawl / run
    if not args.category and not args.url_file:
        ap.error("需要 --category 或 --url-file")

    fetcher = build_fetcher(args)
    pipe = Pipeline(fetcher, resolve_play=args.resolve_play,
                    probe_m3u8=not args.no_probe_m3u8,
                    downloader_kwargs=build_dl_kwargs(args),
                    out_dir=getattr(args, "out_dir", "downloads"),
                    variant=args.variant, live=args.live,
                    max_seconds=args.max_seconds, no_remux=args.no_remux,
                    limit=args.limit, with_detail=not getattr(args, "no_detail", False),
                    work_dir=getattr(args, "work_dir", ""))
    do_download = (args.cmd == "run")
    vw = Writer(args.out, VideoItem)
    pw = Writer(args.play_out, PlayItem)
    try:
        if args.url_file:
            with open(args.url_file, "r", encoding="utf-8") as f:
                urls = [l.strip() for l in f if l.strip() and not l.startswith("#")]
            list(pipe.crawl_urls(urls, vw, pw, do_download))
        else:
            list(pipe.crawl_category(args.category, args.pages, static=not args.dynamic,
                                     writer=vw, play_writer=pw, do_download=do_download))
    except KeyboardInterrupt:
        log.warning("用户中断，已保存部分结果")
    finally:
        vw.close()
        pw.close()
        print(f"\n统计：影片 {pipe.stats['videos']} | 地址 {pipe.stats['streams']} | "
              f"下载成功 {pipe.stats['downloaded']} | 失败 {pipe.stats['failed']}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
