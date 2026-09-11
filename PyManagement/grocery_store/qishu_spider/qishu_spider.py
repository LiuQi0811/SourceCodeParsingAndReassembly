#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
奇书电子书下载网 (https://www.7shutxt.com/) 全站爬虫
=================================================

站点特性（经逆向分析确认）：
  * 基于帝国CMS（EmpireCMS）搭建
  * URL 规则：
      - 分类列表： /list-{cid}.html               （首页）
                  /list-{cid}-{page}.html         （分页，page 从 1 开始）
      - 文章详情：/article-{cid}-{id}.html
      - 下载列表：/download-{cid}-{id}.html       （需正确 Referer）
      - CMS 直链：/e/DownSys/doaction.php?enews=DownSoft&classid={cid}&id={id}
                  &pathid={pid}&pass={md5}&p=::::::
                  该链接直接返回文件流，Content-Disposition 带文件名，无任何 JS 解密/跳转
      - 网盘链接：部分书籍直接展示夸克网盘（pan.quark.cn）链接
  * 反爬：
      1. download 页与 doaction.php 均校验 Referer
      2. 请求频率过高会触发 <script>window.location.href="/";</script> 跳回首页
      3. 未发现 Cookie 强制要求、未发现 JS 加密、未发现验证码
  * 文件编码：站内下载的 TXT 为 GBK/GB18030，脚本已做自动转码
  * pass 参数：帝国CMS 标准的 md5(classid+id+pathid+帝国_downpath_rnd)，
              不需要本地计算，直接从下载页 HTML 中正则提取即可（最稳妥）

使用方式：
  python3 qishu_spider.py                 # 默认全部抓取
  python3 qishu_spider.py --cid 2         # 只抓穿越小说 (cid=2)
  python3 qishu_spider.py --max-pages 5   # 每个分类最多抓 5 页（调试用）
  python3 qishu_spider.py --no-download   # 只抓元数据，不下载文件
  python3 qishu_spider.py --txt-only      # 只下载 TXT 版本，不下 RAR
  python3 qishu_spider.py --workers 3     # 并发线程数（建议 ≤3，避免被封）

输出：
  downloads/          -- 按分类保存的小说文件（TXT 统一转 UTF-8）
  data/meta.jsonl     -- 每本书一行 JSON 元数据（标题/作者/大小/链接等）
  data/visited.json   -- 已完成的文章ID集合（用于断点续爬/增量）
  logs/spider.log     -- 运行日志
"""

import argparse
import os
import re
import sys
import json
import time
import random
import logging
import threading
from urllib.parse import urljoin, urlparse, parse_qs, unquote
from concurrent.futures import ThreadPoolExecutor, as_completed
from dataclasses import dataclass, field, asdict
from typing import Optional, List, Dict

import requests
from bs4 import BeautifulSoup

# ----------------------------- 基础配置 -----------------------------

BASE_URL = "https://www.7shutxt.com"
DEFAULT_HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
                  "(KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,"
              "image/avif,image/webp,*/*;q=0.8",
    "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
    "Accept-Encoding": "gzip, deflate, br",
    "Connection": "keep-alive",
}

# 14 个主分类 (来自 sitemap.html)
CATEGORIES = {
    2:  "穿越小说",
    3:  "重生小说",
    4:  "历史架空古装",
    5:  "青春校园现言",
    6:  "豪门总裁小说",
    7:  "修真仙侠幻想",
    8:  "衍生同人小说",
    9:  "网游小说",
    10: "耽于纯美小说",
    11: "玄幻小说",
    12: "都市异能娱乐爽文",
    13: "历史架空铁血军旅",
    14: "恐怖惊悚悬疑推理",
    15: "古今中外文学名著",
}

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
OUT_DIR = os.path.join(SCRIPT_DIR, "downloads")
DATA_DIR = os.path.join(SCRIPT_DIR, "data")
LOG_DIR = os.path.join(SCRIPT_DIR, "logs")
for d in (OUT_DIR, DATA_DIR, LOG_DIR):
    os.makedirs(d, exist_ok=True)

META_FILE = os.path.join(DATA_DIR, "meta.jsonl")
VISITED_FILE = os.path.join(DATA_DIR, "visited.json")
LOG_FILE = os.path.join(LOG_DIR, "spider.log")

# 限速参数（秒），随机区间，模拟真人浏览
SLEEP_MIN, SLEEP_MAX = 1.5, 3.5
# 被封（跳回首页）时的冷却时间
BAN_SLEEP = 30

# ----------------------------- 日志 -----------------------------

logger = logging.getLogger("qishu")
logger.setLevel(logging.INFO)
fmt = logging.Formatter("%(asctime)s [%(levelname)s] %(message)s", "%H:%M:%S")
sh = logging.StreamHandler(sys.stdout)
sh.setFormatter(fmt)
fh = logging.FileHandler(LOG_FILE, encoding="utf-8")
fh.setFormatter(fmt)
logger.addHandler(sh)
logger.addHandler(fh)


# ----------------------------- 数据结构 -----------------------------

@dataclass
class Book:
    cid: int
    id: int
    category: str = ""
    title: str = ""
    author: str = ""
    size: str = ""
    update_time: str = ""
    cover: str = ""
    detail_url: str = ""
    download_page_url: str = ""
    # 下载链接（可能多个）
    downloads: List[Dict] = field(default_factory=list)
    # 已成功下载到本地的文件列表
    saved_files: List[str] = field(default_factory=list)


# ----------------------------- HTTP 会话 -----------------------------

class QishuSession:
    """带限速、重试、反检测的 HTTP 会话，线程安全（每个线程一个实例）。"""

    def __init__(self):
        self.s = requests.Session()
        self.s.headers.update(DEFAULT_HEADERS)
        # 先访问首页，拿到基础 Cookie
        self._ban_count = 0
        try:
            self.s.get(BASE_URL, timeout=15)
        except Exception as e:
            logger.warning(f"首页初始化请求失败: {e}")

    def _sleep(self):
        time.sleep(random.uniform(SLEEP_MIN, SLEEP_MAX))

    def get(self, url, referer=None, stream=False, expect_binary=False, retries=3):
        headers = {}
        if referer:
            headers["Referer"] = referer
        for attempt in range(retries):
            try:
                resp = self.s.get(url, headers=headers, timeout=30, stream=stream, allow_redirects=True)
                # 检测被封：页面很小且包含跳转首页脚本
                if not stream and not expect_binary:
                    text = resp.text
                    if resp.status_code == 200 and len(text) < 200 and "window.location.href" in text and "/" in text:
                        self._ban_count += 1
                        wait = BAN_SLEEP * self._ban_count
                        logger.warning(f"被反爬拦截（跳回首页），冷却 {wait}s 后重试：{url}")
                        time.sleep(wait)
                        # 重新访问首页
                        try:
                            self.s.get(BASE_URL, timeout=15)
                        except Exception:
                            pass
                        continue
                self._ban_count = max(0, self._ban_count - 1)
                if not stream:
                    # 站内页是 UTF-8 还是 GBK？HTML meta 声明 utf-8，但 TXT 文件是 GBK
                    # requests 会自动按 Content-Type / chardet 解码；这里强制 apparent_encoding
                    if not expect_binary:
                        resp.encoding = resp.apparent_encoding or "utf-8"
                return resp
            except requests.RequestException as e:
                logger.warning(f"请求失败({attempt+1}/{retries}) {url}: {e}")
                time.sleep(2 + attempt * 3)
        return None


# 线程本地存储：每个线程一个 session
_tls = threading.local()

def get_session() -> QishuSession:
    s = getattr(_tls, "session", None)
    if s is None:
        s = QishuSession()
        _tls.session = s
    return s


# ----------------------------- 解析函数 -----------------------------

# 文章链接：/article-{cid}-{id}.html
RE_ARTICLE = re.compile(r'/article-(\d+)-(\d+)\.html')
# 下载页里的 CMS 直链
RE_DOWNSOFT = re.compile(r'''href=["']([^"']*e/DownSys/(?:doaction\.php|GetDown/?)[^"']+)["']([^>]*)>([^<]*)</a>''', re.I)
# 网盘链接
RE_PAN = re.compile(r'''href=["'](https?://(?:pan\.quark\.cn|pan\.baidu\.com|yun\.baidu\.com|pan\.xunlei\.com|www\.aliyundrive\.com|alipan\.com|www\.lanzou\w?\.com|lanzou\w?\.com|ww\w?\.lanzou\w?\.com|cloud\.189\.cn|www\.123pan\.com|www\.123684\.com|www\.ctfile\.com|www\.weiyun\.com)[^"']*)["']([^>]*)>([^<]*)</a>''', re.I)
# 详情页中的作者 / 大小 / 更新时间
RE_AUTHOR = re.compile(r'小说作者[：:]\s*</span>\s*([^<]+?)<', re.S)
RE_SIZE_D = re.compile(r'文件大小[：:]\s*</span>\s*([^<]+?)<', re.S)
RE_TIME = re.compile(r'最后更新[：:][\s\S]*?title="([^"]+)"', re.S)
RE_COVER = re.compile(r'<img[^>]*src=["\'](/uploads/images/[^"\']+)["\'][^>]*width=["\']122', re.I)
# 列表页最大页码
RE_MAXPAGE = re.compile(r'list-(\d+)-(\d+)\.html')
# Content-Disposition 中文件名
RE_CD_FILENAME = re.compile(r'filename\*?=(?:UTF-8\'\')?"?([^";]+)"?', re.I)


def fetch_max_page(cid: int) -> int:
    """获取某分类最大页码（page 参数从 0 开始，返回总页数）。"""
    s = get_session()
    url = f"{BASE_URL}/list.php?classid={cid}&orderby=0"
    resp = s.get(url, referer=BASE_URL + "/")
    if not resp:
        return 1
    # 优先取尾页 page 参数：<a href="/list.php?page=19&classid=2&orderby=0">尾页</a>
    m = re.search(r'list\.php\?page=(\d+)&amp;classid=' + str(cid) + r'[^"]*">尾页', resp.text)
    if m:
        return int(m.group(1)) + 1  # page 从0开始，总页数 = 最后页号 + 1
    # 兜底：找最大 page= 数字
    pages = {int(x) for x in re.findall(r'list\.php\?page=(\d+)&amp;classid=' + str(cid), resp.text)}
    if pages:
        return max(pages) + 1
    # 再兜底：静态URL
    pages = {int(x) for x in re.findall(r'list-' + str(cid) + r'-(\d+)\.html', resp.text)}
    return max(pages) if pages else 1


def parse_list_page(cid: int, page: int) -> List[tuple]:
    """解析列表页，返回 [(cid, id, detail_url), ...]。
    page 从 1 开始（第1页），内部转成 list.php 的 page 参数（0-based）。
    """
    s = get_session()
    p = page - 1  # 转成 0-based
    url = f"{BASE_URL}/list.php?classid={cid}&orderby=0&page={p}"
    if page <= 1:
        referer = f"{BASE_URL}/list-{cid}.html"
    else:
        referer = f"{BASE_URL}/list.php?classid={cid}&orderby=0&page={p-1}"
    resp = s.get(url, referer=referer)
    if not resp:
        return []
    items = []
    seen = set()
    for m in RE_ARTICLE.finditer(resp.text):
        c, i = int(m.group(1)), int(m.group(2))
        if c != cid:
            continue
        key = (c, i)
        if key in seen:
            continue
        seen.add(key)
        items.append((c, i, f"{BASE_URL}/article-{c}-{i}.html"))
    return items


def parse_detail(cid: int, aid: int) -> Optional[Book]:
    """解析详情页 + 下载页，拿到完整 Book 信息（含下载链接）。"""
    s = get_session()
    detail_url = f"{BASE_URL}/article-{cid}-{aid}.html"
    resp = s.get(detail_url, referer=f"{BASE_URL}/list.php?classid={cid}&orderby=0")
    if not resp:
        return None
    html = resp.text
    book = Book(cid=cid, id=aid, category=CATEGORIES.get(cid, f"分类{cid}"), detail_url=detail_url)

    mt = re.search(r'<title>([^<]+)</title>', html)
    if mt:
        # 标题形如："XXXtxt下载_作者_分类_奇书电子书"
        t = mt.group(1)
        t = re.split(r' txt下载|txt下载|_奇书', t)[0]
        t = t.split("_")[0].strip()
        book.title = t

    # 详情页作者：按就近匹配，优先匹配 class=zuozhe 的 li
    m = re.search(r'class="zuozhe"[^>]*>\s*<b>[^<]*</b>\s*([^<\n]+?)\s*</li>', html)
    if not m:
        m = re.search(r'(?:小说作者|书籍作者)[：:]\s*<span[^>]*>([^<]+)</span>', html)
    if not m:
        m = re.search(r'(?:小说作者|书籍作者)[：:]\s*([^<\n]+?)\s*<', html)
    if not m:
        # meta description 里 「作者: XXX，」
        m = re.search(r'<meta[^>]*content="[^"]*作者[:：]\s*([^,，"<]+)', html)
    if m:
        book.author = _clean(m.group(1))

    m = RE_COVER.search(html)
    if m:
        book.cover = urljoin(BASE_URL, m.group(1))

    # 进入下载列表页
    down_url = f"{BASE_URL}/download-{cid}-{aid}.html"
    book.download_page_url = down_url
    s._sleep()
    resp2 = s.get(down_url, referer=detail_url)
    if not resp2:
        return book
    h2 = resp2.text

    m = re.search(r'文件大小[：:][\s\S]*?<span[^>]*>([^<]+)</span>', h2)
    if not m:
        m = re.search(r'文件大小[：:]\s*([^<\n]+?)<', h2)
    if m:
        book.size = _clean(m.group(1))
    m = RE_TIME.search(h2)
    if m:
        book.update_time = m.group(1).strip()

    # 1. CMS 直链（doaction.php / GetDown）
    for m in RE_DOWNSOFT.finditer(h2):
        href = m.group(1).replace("&amp;", "&")
        full = urljoin(BASE_URL, href)
        label = re.sub(r'<[^>]+>', '', m.group(3)).strip()
        if not label:
            # 从参数推断
            parsed = parse_qs(urlparse(full).query)
            pathid = parsed.get("pathid", [""])[0]
            label = "TXT电子书" if pathid == "0" else ("RAR压缩包" if pathid == "1" else f"pathid={pathid}")
        book.downloads.append({
            "type": "cms",
            "url": full,
            "label": label,
        })

    # 2. 网盘链接
    for m in RE_PAN.finditer(h2):
        href = m.group(1)
        label = re.sub(r'<[^>]+>', '', m.group(3)).strip() or "网盘下载"
        # 判断网盘类型
        host = urlparse(href).netloc
        if "quark" in host:
            ptype = "quark"
        elif "baidu" in host:
            ptype = "baidu"
        elif "aliyun" in host or "alipan" in host:
            ptype = "aliyun"
        elif "lanzou" in host:
            ptype = "lanzou"
        elif "189" in host:
            ptype = "189"
        elif "123pan" in host:
            ptype = "123pan"
        elif "ctfile" in host:
            ptype = "ctfile"
        elif "xunlei" in host:
            ptype = "xunlei"
        elif "weiyun" in host:
            ptype = "weiyun"
        else:
            ptype = "pan"
        book.downloads.append({
            "type": ptype,
            "url": href,
            "label": label,
        })

    return book


def _clean(s: str) -> str:
    return re.sub(r'\s+', ' ', s).strip()


# ----------------------------- 下载文件 -----------------------------

def sanitize_filename(name: str) -> str:
    """去除文件名中的非法字符。"""
    name = re.sub(r'[\\/:*?"<>|\r\n\t]+', '_', name)
    name = name.strip(' ._')
    return name[:150] or "unnamed"


def download_book_files(book: Book, txt_only: bool = False) -> List[str]:
    """下载书的文件，返回本地保存路径列表。网盘链接只记录URL，不下载（需登录）。"""
    s = get_session()
    saved = []
    cat_dir = os.path.join(OUT_DIR, sanitize_filename(book.category))
    os.makedirs(cat_dir, exist_ok=True)
    base_name = sanitize_filename(f"{book.title}_{book.author}" if book.author else book.title)

    for dl in book.downloads:
        dl_type = dl["type"]
        url = dl["url"]
        label = dl["label"]

        if dl_type != "cms":
            # 网盘链接：只记录，不下载（需要登录/客户端）
            logger.info(f"[网盘] {book.title} @ {dl_type}: {url}")
            continue

        # 用 pathid 精确判断文件类型：0=TXT，1=RAR（最可靠，不靠 label 文案）
        parsed = parse_qs(urlparse(url).query)
        pathid = parsed.get("pathid", [""])[0]
        is_rar = (pathid == "1" or "GetDown" in url)
        is_txt = (pathid == "0" or "doaction.php" in url)

        if txt_only and is_rar:
            logger.info(f"[跳过RAR] {book.title} - {label}")
            continue

        # 请求文件流
        s._sleep()
        resp = s.get(url, referer=book.download_page_url, stream=True, expect_binary=True)
        if not resp:
            logger.warning(f"[下载失败] {book.title} - {label}")
            continue

        # 从 Content-Disposition 获取原始文件名（用于判断扩展名）
        cd = resp.headers.get("Content-Disposition", "")
        ext = ".txt" if is_txt else ".rar"
        orig_fname = None
        m = RE_CD_FILENAME.search(cd)
        if m:
            try:
                orig_fname = unquote(m.group(1))
                # 从原始文件名推断扩展名（更准确）
                lower = orig_fname.lower()
                if lower.endswith(".rar"):
                    ext = ".rar"
                elif lower.endswith(".txt"):
                    ext = ".txt"
                elif lower.endswith(".zip"):
                    ext = ".zip"
            except Exception:
                pass

        # 使用 书名_作者 命名，更友好
        suffix = "" if is_txt else "_rar"
        fname = f"{base_name}{suffix}{ext}"
        fpath = os.path.join(cat_dir, fname)
        if os.path.exists(fpath) and os.path.getsize(fpath) > 100:
            logger.info(f"[已存在] {fpath}")
            saved.append(fpath)
            continue

        logger.info(f"[下载中] {book.title} - {label} -> {fname}")
        try:
            with open(fpath, "wb") as f:
                for chunk in resp.iter_content(chunk_size=64 * 1024):
                    if chunk:
                        f.write(chunk)
            # 如果是 txt 文件，检测并转码为 UTF-8
            if fpath.lower().endswith(".txt"):
                _maybe_reencode_to_utf8(fpath)
            saved.append(fpath)
            logger.info(f"[OK] {fpath} ({os.path.getsize(fpath)} bytes)")
        except Exception as e:
            logger.error(f"[写入失败] {fpath}: {e}")
            if os.path.exists(fpath):
                try:
                    os.remove(fpath)
                except Exception:
                    pass
    return saved


def _maybe_reencode_to_utf8(path: str):
    """站内 TXT 多为 GBK，自动转为 UTF-8 方便阅读。"""
    try:
        with open(path, "rb") as f:
            raw = f.read()
        # 简单判定：尝试 UTF-8 解码，失败则尝试 GBK/GB18030
        try:
            raw.decode("utf-8")
            return  # 已是 UTF-8
        except UnicodeDecodeError:
            pass
        for enc in ("gb18030", "gbk", "gb2312", "big5"):
            try:
                text = raw.decode(enc)
                with open(path, "w", encoding="utf-8") as f:
                    f.write(text)
                logger.info(f"[转码] {os.path.basename(path)} {enc} -> utf-8")
                return
            except UnicodeDecodeError:
                continue
        logger.warning(f"[转码失败] {path}: 未识别编码，保持原样")
    except Exception as e:
        logger.warning(f"[转码异常] {path}: {e}")


# ----------------------------- 已访问记录（断点续爬）-----------------------------

def load_visited() -> set:
    if os.path.exists(VISITED_FILE):
        try:
            with open(VISITED_FILE, "r", encoding="utf-8") as f:
                return set(json.load(f))
        except Exception:
            return set()
    return set()


def save_visited(visited: set):
    tmp = VISITED_FILE + ".tmp"
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(sorted(visited), f, ensure_ascii=False)
    os.replace(tmp, VISITED_FILE)


def append_meta(book: Book):
    with open(META_FILE, "a", encoding="utf-8") as f:
        f.write(json.dumps(asdict(book), ensure_ascii=False) + "\n")


# ----------------------------- 单本书处理 -----------------------------

def process_book(cid: int, aid: int, txt_only: bool, no_download: bool) -> Optional[Book]:
    book = parse_detail(cid, aid)
    if not book:
        return None
    if not book.title:
        book.title = f"未知书籍-{aid}"
    if not no_download:
        book.saved_files = download_book_files(book, txt_only=txt_only)
    append_meta(book)
    return book


# ----------------------------- 主流程 -----------------------------

def main():
    ap = argparse.ArgumentParser(description="奇书电子书下载网全站爬虫")
    ap.add_argument("--cid", type=int, default=None,
                    help="只抓取指定分类ID（默认全部）。分类：%s" % json.dumps(CATEGORIES, ensure_ascii=False))
    ap.add_argument("--max-pages", type=int, default=0,
                    help="每个分类最多抓几页（0=全部）")
    ap.add_argument("--workers", type=int, default=2,
                    help="并发线程数，建议 1~3，过高易被封")
    ap.add_argument("--no-download", action="store_true",
                    help="只采集元数据，不下载文件")
    ap.add_argument("--txt-only", action="store_true",
                    help="只下 TXT 版本，跳过 RAR 压缩包")
    ap.add_argument("--start-page", type=int, default=1,
                    help="每个分类从第几页开始抓（用于断点）")
    ap.add_argument("--fresh", action="store_true",
                    help="忽略 visited.json，强制重新抓取元数据")
    args = ap.parse_args()

    cids = [args.cid] if args.cid else list(CATEGORIES.keys())
    for c in cids:
        if c not in CATEGORIES:
            logger.error(f"无效分类ID: {c}，可选: {CATEGORIES}")
            sys.exit(1)

    visited = set() if args.fresh else load_visited()
    logger.info(f"已记录已完成书籍 {len(visited)} 本")
    logger.info(f"待抓取分类: {[(c, CATEGORIES[c]) for c in cids]}")

    total_books = 0
    total_saved = 0
    meta_lock = threading.Lock()

    for cid in cids:
        cat_name = CATEGORIES[cid]
        logger.info(f"========== 开始抓取分类 [{cid}] {cat_name} ==========")
        max_page = fetch_max_page(cid)
        if args.max_pages and args.max_pages > 0:
            max_page = min(max_page, args.start_page + args.max_pages - 1)
        logger.info(f"分类 {cat_name} 共 {max_page} 页")

        # 先收集所有待爬的 book id
        all_books: List[tuple] = []
        for page in range(args.start_page, max_page + 1):
            items = parse_list_page(cid, page)
            # 过滤已爬
            new_items = [(c, i) for (c, i, _u) in items if (c, i) not in visited]
            logger.info(f"  第 {page}/{max_page} 页：获取到 {len(items)} 本，新增 {len(new_items)} 本")
            all_books.extend(new_items)
            time.sleep(random.uniform(SLEEP_MIN, SLEEP_MAX))

        logger.info(f"分类 {cat_name} 待下载 {len(all_books)} 本，开始并发处理...")

        done_in_cat = 0
        with ThreadPoolExecutor(max_workers=args.workers) as ex:
            futures = {
                ex.submit(process_book, c, i, args.txt_only, args.no_download): (c, i)
                for (c, i) in all_books
            }
            for fu in as_completed(futures):
                c, i = futures[fu]
                try:
                    book = fu.result()
                except Exception as e:
                    logger.exception(f"处理 article-{c}-{i} 异常: {e}")
                    continue
                with meta_lock:
                    visited.add((c, i))
                    total_books += 1
                    done_in_cat += 1
                    if book:
                        total_saved += len(book.saved_files)
                        logger.info(f"  ✓ [{done_in_cat}/{len(all_books)}] "
                                    f"{book.title} - {book.author} "
                                    f"(下载 {len(book.saved_files)}/{len(book.downloads)} 个)")
                    # 每隔 20 本持久化 visited
                    if total_books % 20 == 0:
                        save_visited(visited)

        save_visited(visited)
        logger.info(f"========== 分类 [{cid}] {cat_name} 完成 ==========")

    logger.info(f"全部完成！共处理 {total_books} 本书，下载文件 {total_saved} 个")
    logger.info(f"元数据文件：{META_FILE}")
    logger.info(f"已完成记录：{VISITED_FILE}")
    logger.info(f"下载目录：{OUT_DIR}")


if __name__ == "__main__":
    main()
