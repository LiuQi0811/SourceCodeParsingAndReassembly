#!/usr/bin/env python3
"""
English e-Reader (https://english-e-reader.net/) 全站爬虫
- 爬取 8 个难度级别的全部书籍信息（标题/作者/类型/级别/长度/简介/封面/标签）
- 批量下载 epub / mobi / fb2 / rtf / txt 五种格式的电子书
- 下载封面图片
- 支持断点续传、失败重试、并发下载、请求延时
- 网站无内容加密、无需登录、无需解密，下载链接公开可访问
"""

import os
import re
import sys
import json
import time
import random
import logging
import hashlib
import threading
from pathlib import Path
from urllib.parse import urljoin, urlparse, unquote
from concurrent.futures import ThreadPoolExecutor, as_completed

import requests
from bs4 import BeautifulSoup

# ============ 配置 ============
BASE_URL = "https://english-e-reader.net"
OUTPUT_DIR = Path(__file__).parent / "books"
COVERS_DIR = OUTPUT_DIR / "covers"
META_FILE = OUTPUT_DIR / "books_index.json"
PROGRESS_FILE = OUTPUT_DIR / "download_progress.json"

LEVELS = [
    "starter", "elementary", "pre-intermediate", "intermediate",
    "intermediate-plus", "upper-intermediate", "advanced", "unabridged",
]
FORMATS = ["epub", "mobi", "fb2", "rtf", "txt"]

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/120.0.0.0 Safari/537.36"
    ),
    "Accept-Language": "en-US,en;q=0.9",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
}

MAX_WORKERS = 8          # 并发线程数（不要太高避免被封）
REQUEST_DELAY = (0.3, 0.8)  # 每个请求之间随机延时（秒）
MAX_RETRIES = 3
TIMEOUT = 60

# ============ 日志 ============
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%H:%M:%S",
)
log = logging.getLogger("ereader")


# ============ 线程本地 Session ============
_thread_local = threading.local()

def get_session():
    s = getattr(_thread_local, "session", None)
    if s is None:
        s = requests.Session()
        # 预热访问首页拿 cookie
        try:
            s.get(BASE_URL, headers=HEADERS, timeout=TIMEOUT)
        except Exception:
            pass
        _thread_local.session = s
    return s


# ============ 工具函数 ============
def polite_sleep():
    time.sleep(random.uniform(*REQUEST_DELAY))


def safe_get(session, url, **kwargs):
    """带重试的 GET 请求，自动跟随重定向"""
    for attempt in range(1, MAX_RETRIES + 1):
        try:
            resp = session.get(url, headers=HEADERS, timeout=TIMEOUT, allow_redirects=True, **kwargs)
            if resp.status_code == 200:
                return resp
            log.warning(f"GET {url} -> HTTP {resp.status_code} (attempt {attempt}/{MAX_RETRIES})")
        except requests.RequestException as e:
            log.warning(f"GET {url} error: {e} (attempt {attempt}/{MAX_RETRIES})")
        if attempt < MAX_RETRIES:
            time.sleep(2 * attempt)
    return None


def slug_to_filename(slug: str) -> str:
    """把 slug 转成合法的文件名前缀"""
    return re.sub(r'[\\/:*?"<>|]+', "_", slug).strip("_")


# ============ 爬取一个 level 页面的全部书籍链接 ============
def fetch_level_books(level: str):
    """从指定难度级别页面提取书籍基础信息列表"""
    session = get_session()
    url = f"{BASE_URL}/level/{level}"
    log.info(f"正在抓取级别列表: {url}")
    resp = safe_get(session, url)
    if not resp:
        log.error(f"无法加载级别页面: {url}")
        return []

    soup = BeautifulSoup(resp.text, "html.parser")
    books = []
    seen = set()

    # 所有书籍卡片/链接都指向 /book/<slug>
    for a in soup.select('a[href^="/book/"]'):
        href = a.get("href", "")
        slug = href.replace("/book/", "").strip("/")
        if not slug or slug in seen:
            continue
        seen.add(slug)

        # 卡片内的 h4 是书名，p.cover 是作者（若有）
        card = a
        title_el = card.select_one("h4")
        title = title_el.get_text(strip=True) if title_el else a.get_text(strip=True)
        author_el = card.find_next("p", class_="cover") if card else None
        author = author_el.get_text(strip=True) if author_el else ""

        books.append({
            "slug": slug,
            "title": title,
            "author": author,
            "level": level,
            "book_url": urljoin(BASE_URL, href),
        })

    log.info(f"  {level}: 发现 {len(books)} 本书")
    polite_sleep()
    return books


# ============ 爬取单本书的详细信息 ============
def fetch_book_detail(book: dict):
    """访问书籍详情页，补齐封面、简介、标签、字数、下载量、封面图等信息"""
    session = get_session()
    resp = safe_get(session, book["book_url"])
    if not resp:
        return book

    soup = BeautifulSoup(resp.text, "html.parser")

    # 标题
    h1 = soup.find("h1")
    if h1:
        h1_text = h1.get_text(" ", strip=True)
        # 去掉国旗符号
        h1_text = re.sub(r"^[A-Za-z\s]*flag icon\s*", "", h1_text).strip()
        if h1_text:
            book["title"] = h1_text

    # 作者（第一个 h4 含 glyphicon-user）
    for h4 in soup.find_all("h4"):
        if "glyphicon-user" in str(h4):
            book["author"] = h4.get_text(" ", strip=True).replace("\uf007", "").strip()
            break

    # 简介：h1 所在 row 下面第一个 p.text-justify
    desc = None
    for p in soup.select("p.text-justify"):
        txt = p.get_text(" ", strip=True)
        if len(txt) > 40:
            desc = txt
            break
    if desc:
        book["description"] = desc

    # 封面
    img = soup.select_one('img.book-thumbnail, img[alt*="book cover"]')
    if img and img.get("src"):
        book["cover_url"] = urljoin(BASE_URL, img["src"])

    # 标签
    tags = []
    for tag_a in soup.select('a[href^="/tag/"] span.label'):
        tags.append(tag_a.get_text(strip=True))
    if tags:
        book["tags"] = tags

    # 类型 / genre
    genre_a = soup.select_one('a[href^="/genre/"]')
    if genre_a:
        book["genre"] = genre_a.get_text(strip=True)

    # Text Analysis 字数信息
    for h3 in soup.find_all("h3"):
        txt = h3.get_text(" ", strip=True)
        m = re.search(r"Unique words:\s*(\d+).*?Total words:\s*(\d+)", txt)
        if m:
            book["unique_words"] = int(m.group(1))
            book["total_words"] = int(m.group(2))
            break

    # Hard words
    hard_p = soup.find("p", string=re.compile(r"Hard words:"))
    if hard_p:
        book["hard_words"] = [w.strip() for w in hard_p.get_text().replace("Hard words:", "").split(",") if w.strip()]

    polite_sleep()
    return book


# ============ 下载单格式电子书 ============
def download_format(book: dict, fmt: str, download_record: dict):
    """下载一本书的指定格式，返回 (fmt, ok, path_or_err)"""
    session = get_session()
    slug = book["slug"]
    level_dir = OUTPUT_DIR / book.get("level", "unknown")
    level_dir.mkdir(parents=True, exist_ok=True)

    fname_prefix = slug_to_filename(slug)
    out_path = level_dir / f"{fname_prefix}.{fmt}"

    # 已经存在且非空就跳过
    if out_path.exists() and out_path.stat().st_size > 1024:
        return fmt, True, str(out_path)

    dl_url = f"{BASE_URL}/download?link={slug}&format={fmt}"
    try:
        # 流式下载，自动跟随 302 到真实文件地址
        with session.get(dl_url, headers=HEADERS, timeout=TIMEOUT, stream=True, allow_redirects=True) as r:
            if r.status_code != 200:
                return fmt, False, f"HTTP {r.status_code}"
            ctype = r.headers.get("Content-Type", "")
            # 某些格式服务器可能没返回（例如 txt 有时返回 rtf），我们按最终 URL 的扩展名做最后兜底
            final_url = r.url
            # 写入临时文件再改名，避免中断产生残缺文件
            tmp_path = out_path.with_suffix(out_path.suffix + ".part")
            with open(tmp_path, "wb") as f:
                for chunk in r.iter_content(chunk_size=64 * 1024):
                    if chunk:
                        f.write(chunk)
            size = tmp_path.stat().st_size
            if size < 100:
                tmp_path.unlink(missing_ok=True)
                return fmt, False, f"file too small ({size}B)"
            tmp_path.rename(out_path)
            return fmt, True, str(out_path)
    except Exception as e:
        return fmt, False, str(e)


def download_cover(book: dict):
    """下载封面图片"""
    session = get_session()
    cover_url = book.get("cover_url")
    if not cover_url:
        return False
    COVERS_DIR.mkdir(parents=True, exist_ok=True)
    ext = os.path.splitext(urlparse(cover_url).path)[1] or ".jpg"
    fname = slug_to_filename(book["slug"]) + ext
    out_path = COVERS_DIR / fname
    if out_path.exists() and out_path.stat().st_size > 200:
        book["cover_local"] = str(out_path)
        return True
    resp = safe_get(session, cover_url)
    if resp:
        with open(out_path, "wb") as f:
            f.write(resp.content)
        if out_path.stat().st_size > 200:
            book["cover_local"] = str(out_path)
            return True
        out_path.unlink(missing_ok=True)
    return False


# ============ 主流程 ============
def load_progress():
    if PROGRESS_FILE.exists():
        try:
            return json.loads(PROGRESS_FILE.read_text(encoding="utf-8"))
        except Exception:
            pass
    return {"detail_fetched": [], "downloaded": {}}


def save_progress(progress):
    PROGRESS_FILE.write_text(json.dumps(progress, ensure_ascii=False, indent=2), encoding="utf-8")


def main():
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    # 预热主会话
    log.info("初始化会话 ...")
    main_s = get_session()

    # 1. 并发抓取所有 level 列表页
    if META_FILE.exists():
        log.info(f"检测到已存在索引文件 {META_FILE}，直接加载书籍列表")
        books = json.loads(META_FILE.read_text(encoding="utf-8"))
    else:
        all_books = {}
        with ThreadPoolExecutor(max_workers=4) as ex:
            results = list(ex.map(fetch_level_books, LEVELS))
        for lst in results:
            for b in lst:
                if b["slug"] not in all_books:
                    all_books[b["slug"]] = b
        books = list(all_books.values())
        log.info(f"共发现 {len(books)} 本不同的书籍（去重后）")
        META_FILE.write_text(
            json.dumps(books, ensure_ascii=False, indent=2), encoding="utf-8"
        )

    # 2. 抓取每本书的详情页（补齐元数据）— 并发
    progress = load_progress()
    detail_done = set(progress.get("detail_fetched", []))

    todo_details = [b for b in books if b["slug"] not in detail_done]
    log.info(f"需要抓取详情: {len(todo_details)} / {len(books)}")

    def _detail_worker(b):
        try:
            fetch_book_detail(b)
            return b["slug"], True
        except Exception as e:
            log.error(f"抓取详情失败 {b['slug']}: {e}")
            return b["slug"], False

    if todo_details:
        done_n = 0
        with ThreadPoolExecutor(max_workers=MAX_WORKERS) as ex:
            futures = {ex.submit(_detail_worker, b): b for b in todo_details}
            for fut in as_completed(futures):
                slug, ok = fut.result()
                if ok:
                    detail_done.add(slug)
                done_n += 1
                if done_n % 20 == 0 or done_n == len(todo_details):
                    log.info(f"详情进度: {done_n}/{len(todo_details)}")
                    META_FILE.write_text(
                        json.dumps(books, ensure_ascii=False, indent=2), encoding="utf-8"
                    )
                    progress["detail_fetched"] = list(detail_done)
                    save_progress(progress)

    # 最终保存完整元数据
    META_FILE.write_text(
        json.dumps(books, ensure_ascii=False, indent=2), encoding="utf-8"
    )

    # 3. 并发下载封面
    log.info("开始下载封面 ...")
    def _cover_worker(b):
        try:
            download_cover(b)
        except Exception as e:
            log.warning(f"封面下载失败 {b['slug']}: {e}")
    with ThreadPoolExecutor(max_workers=MAX_WORKERS) as ex:
        list(ex.map(_cover_worker, books))

    # 4. 下载各格式电子书（线程池并发）
    downloaded = progress.get("downloaded", {})
    log.info(f"开始下载电子书（{FORMATS}），并发 {MAX_WORKERS} ...")

    tasks = []
    for b in books:
        slug = b["slug"]
        rec = downloaded.setdefault(slug, {})
        for fmt in FORMATS:
            if not rec.get(fmt):  # 尚未成功
                tasks.append((b, fmt, rec))

    log.info(f"待下载任务数: {len(tasks)}")

    done_count = 0
    fail_count = 0
    with ThreadPoolExecutor(max_workers=MAX_WORKERS) as ex:
        futures = {
            ex.submit(download_format, b, fmt, rec): (b, fmt, rec)
            for b, fmt, rec in tasks
        }
        for fut in as_completed(futures):
            b, fmt, rec = futures[fut]
            try:
                f, ok, info = fut.result()
                if ok:
                    rec[fmt] = info
                    done_count += 1
                    log.info(f"[OK] {b['slug']}.{fmt} -> {info}")
                else:
                    fail_count += 1
                    log.warning(f"[FAIL] {b['slug']}.{fmt}: {info}")
            except Exception as e:
                fail_count += 1
                log.warning(f"[ERR] {b['slug']}.{fmt}: {e}")
            # 每完成一批保存一次进度
            if (done_count + fail_count) % 20 == 0:
                progress["downloaded"] = downloaded
                save_progress(progress)
            polite_sleep()

    progress["downloaded"] = downloaded
    save_progress(progress)

    # 5. 统计
    total_ok = sum(1 for rec in downloaded.values() for f, v in rec.items() if v)
    total_fail = len(tasks) - total_ok
    log.info("=" * 60)
    log.info(f"爬取完成！共 {len(books)} 本书")
    log.info(f"成功下载文件数: {total_ok}，失败: {total_fail}")
    log.info(f"电子书目录: {OUTPUT_DIR.resolve()}")
    log.info(f"书籍索引: {META_FILE.resolve()}")
    log.info("=" * 60)


if __name__ == "__main__":
    main()
