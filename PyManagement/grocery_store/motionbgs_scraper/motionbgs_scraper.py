#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
MotionBGS.com 全站壁纸爬虫
============================
功能：
  - 自动遍历所有列表分页，收集全部壁纸详情页 slug
  - 进入每个详情页，解析 4K / HD 两个 MP4 下载链接
  - 支持断点续爬、断点续传（已下载的文件自动跳过）
  - 多线程并发下载（默认 8 线程，可配置）
  - 自动限速、失败重试、随机 User-Agent，避免被封
  - 实时进度显示，支持 Ctrl+C 安全中断
  - 生成下载目录索引 JSON（包含标题、slug、ID、分辨率、大小等元数据）

网站结构分析（无需逆向/解密）：
  - 列表分页：https://motionbgs.com/{page}/  （共 264 页，每页 24 张，最后一页 17 张）
  - 详情页：  https://motionbgs.com/{slug}/
  - 下载链接：https://motionbgs.com/dl/4k/{id}/  和  /dl/hd/{id}/
  - 下载链接为 HTTP 直链，直接 GET 即返回 MP4 文件（Content-Disposition: attachment），
    无 JS 加密、无 token 签名、无 referer 锁，直接 requests 下载即可。

使用方法：
  pip install requests beautifulsoup4 lxml
  python motionbgs_scraper.py
  # 可选参数：
  #   --quality 4k       仅下载 4K（默认 both=4K+HD）
  #   --quality hd       仅下载 HD
  #   --workers 12       并发线程数（默认 8）
  #   --start-page 1     起始页
  #   --end-page 0       结束页（0=自动检测最后一页）
  #   --output ./downloads  下载目录
  #   --delay 0.3        请求间隔（秒，防止被封）
"""

import argparse
import json
import os
import random
import re
import signal
import sys
import threading
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path
from urllib.parse import urljoin, urlparse

import requests
from bs4 import BeautifulSoup

# ─────────────────────── 常量 ───────────────────────
BASE_URL = "https://motionbgs.com"
TOTAL_PAGES_FALLBACK = 264           # 已知总页数（备用）
PER_PAGE = 24

USER_AGENTS = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_5) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:127.0) Gecko/20100101 Firefox/127.0",
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36 Edg/124.0.0.0",
]

# 需要排除的非壁纸 slug（导航页面等）
NON_WALLPAPER_SLUGS = {
    "about", "privacy-policy", "dmca", "contact", "guides", "mobile",
    "gifs", "4k-wallpapers", "4k", "anime", "games", "superhero", "nature",
    "car", "animal", "fantasy", "space", "horror", "technology", "holiday",
    "tv-movie", "japan", "football", "hello-kitty", "static", "i", "media",
    "dl", "search", "sitemap.xml", "robots.txt", "favicon.ico",
}

# ─────────────────────── 全局状态 ───────────────────────
session_lock = threading.Lock()
progress_lock = threading.Lock()
interrupted = False


def signal_handler(sig, frame):
    global interrupted
    print("\n\n⚠️  收到中断信号，正在安全退出（已下载文件不会丢失）...")
    interrupted = True


signal.signal(signal.SIGINT, signal_handler)


# ─────────────────────── 工具函数 ───────────────────────
def get_session():
    """创建带随机 UA 的 requests Session，支持重试"""
    s = requests.Session()
    s.headers.update({
        "User-Agent": random.choice(USER_AGENTS),
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
        "Referer": BASE_URL + "/",
    })
    adapter = requests.adapters.HTTPAdapter(
        max_retries=3,
        pool_connections=20,
        pool_maxsize=20,
    )
    s.mount("https://", adapter)
    s.mount("http://", adapter)
    return s


def polite_delay(delay):
    """礼貌延时"""
    if delay > 0:
        time.sleep(delay + random.uniform(0, delay * 0.5))


def sanitize_filename(name):
    """清理文件名"""
    name = re.sub(r'[<>:"/\\|?*]', '_', name)
    name = re.sub(r'\s+', '-', name.strip())
    return name[:120]   # 防止文件名过长


# ─────────────────────── 页面解析 ───────────────────────
def fetch_page(session, url, delay=0.3):
    """请求页面并返回 BeautifulSoup"""
    polite_delay(delay)
    # 每次请求随机切换 UA
    session.headers["User-Agent"] = random.choice(USER_AGENTS)
    resp = session.get(url, timeout=30)
    resp.raise_for_status()
    return BeautifulSoup(resp.text, "lxml")


def detect_last_page(session, delay):
    """自动探测最后一页：访问一个很大的页码，看最终返回哪一页"""
    print("🔍 正在探测总页数...")
    polite_delay(delay)
    session.headers["User-Agent"] = random.choice(USER_AGENTS)
    resp = session.get(f"{BASE_URL}/9999/", timeout=30, allow_redirects=True)
    # 重定向后的 URL 中应包含页码
    final_url = resp.url.rstrip("/")
    match = re.search(r'/(\d+)/?$', final_url)
    if match:
        last_page = int(match.group(1))
        print(f"✅ 探测完成：共 {last_page} 页")
        return last_page
    print(f"⚠️  无法自动探测总页数，使用默认值 {TOTAL_PAGES_FALLBACK}")
    return TOTAL_PAGES_FALLBACK


def parse_list_page(soup):
    """从列表页解析出所有壁纸详情页 slug 列表"""
    slugs = []
    for a in soup.select('a[href]'):
        href = a.get("href", "").strip().rstrip("/")
        if not href:
            continue
        # 仅提取形如 /xxx-yyy 的详情页路径（不含分页/导航）
        if not href.startswith("/"):
            continue
        slug = href.lstrip("/")
        # 过滤条件：以字母开头，只含字母数字短横线，长度>3，不是已知非壁纸页，不是纯数字（分页）
        if re.match(r'^[a-z][a-z0-9-]{2,}$', slug) and slug not in NON_WALLPAPER_SLUGS and not slug.isdigit():
            slugs.append(slug)
    return list(dict.fromkeys(slugs))   # 去重保序


def parse_detail_page(soup, slug):
    """从详情页解析壁纸元数据和下载链接"""
    info = {"slug": slug, "id": None, "title": None, "downloads": {}}

    # 标题
    h1 = soup.find("h1")
    if h1:
        info["title"] = h1.get_text(strip=True)

    # 下载链接：<a href="/dl/4k/9967"> ... </a>
    for a in soup.select('a[href^="/dl/"]'):
        href = a.get("href", "").strip()
        m = re.match(r'^/dl/(4k|hd)/(\d+)/?$', href)
        if not m:
            continue
        quality, wid = m.group(1), m.group(2)
        info["id"] = wid
        text = a.get_text(" ", strip=True)
        # 尝试从文本中提取分辨率和大小
        size_m = re.search(r'([\d.]+\s*[MmKk][Bb])', text)
        res_m = re.search(r'(\d{3,4}x\d{3,4})', text)
        info["downloads"][quality] = {
            "url": urljoin(BASE_URL, href) + "/",   # 末尾加/保证直接命中
            "size_text": size_m.group(1) if size_m else None,
            "resolution": res_m.group(1) if res_m else ("3840x2160" if quality == "4k" else "1920x1080"),
        }

    # 预览视频（低清）
    video = soup.select_one("video source[src], video[src]")
    if video:
        info["preview_video"] = video.get("src") or video.get("data-src")

    # 预览封面图（从 og:image 或主图取）
    og_img = soup.find("meta", property="og:image")
    if og_img and og_img.get("content"):
        info["cover_image"] = og_img["content"]

    return info


# ─────────────────────── 下载逻辑 ───────────────────────
def download_file(session, url, save_path, expected_size=None, delay=0.1):
    """
    下载单个文件，支持断点续传。
    返回 True 表示成功下载（或已存在且完整），False 表示失败。
    """
    save_path = Path(save_path)
    save_path.parent.mkdir(parents=True, exist_ok=True)

    # 如果已存在且大小匹配，跳过
    if save_path.exists():
        existing_size = save_path.stat().st_size
        if expected_size and existing_size == expected_size:
            return True
        # 已存在但大小未知或不匹配，检查服务器是否支持 Range
        if existing_size > 0:
            try:
                polite_delay(delay)
                head = session.head(url, timeout=20, allow_redirects=True)
                remote_size = int(head.headers.get("Content-Length", 0))
                if remote_size > 0 and existing_size == remote_size:
                    return True
                if remote_size > 0 and existing_size >= remote_size:
                    return True
            except Exception:
                pass
            # 尝试断点续传
            resume_header = {"Range": f"bytes={existing_size}-"}
        else:
            resume_header = {}
    else:
        existing_size = 0
        resume_header = {}

    # 发起下载
    for attempt in range(3):
        try:
            polite_delay(delay)
            session.headers["User-Agent"] = random.choice(USER_AGENTS)
            headers = {"Referer": BASE_URL + "/"}
            headers.update(resume_header if existing_size > 0 else {})
            with session.get(url, headers=headers, stream=True, timeout=60, allow_redirects=True) as r:
                if r.status_code == 416:
                    # Range 不满足，说明文件已完整
                    return True
                if r.status_code in (403, 404, 429):
                    print(f"  ⚠️  HTTP {r.status_code} for {url}")
                    if r.status_code == 429:
                        time.sleep(5 + attempt * 5)
                        continue
                    return False
                r.raise_for_status()

                # 获取总大小
                total = r.headers.get("Content-Length")
                if total:
                    total = int(total)
                    if existing_size > 0 and r.status_code == 206:
                        total += existing_size
                    elif r.status_code == 200:
                        existing_size = 0   # 服务器不支持 range，从头开始

                # 写入文件（断点续传模式）
                mode = "ab" if (existing_size > 0 and r.status_code == 206) else "wb"
                with open(save_path, mode) as f:
                    downloaded = existing_size if mode == "ab" else 0
                    for chunk in r.iter_content(chunk_size=1024 * 256):
                        if interrupted:
                            return False
                        if chunk:
                            f.write(chunk)
                            downloaded += len(chunk)
                return True
        except (requests.RequestException, IOError) as e:
            if attempt < 2:
                time.sleep(2 ** attempt)
                continue
            print(f"  ❌ 下载失败: {url} - {e}")
            return False
    return False


# ─────────────────────── 主爬虫 ───────────────────────
class MotionBGSScraper:
    def __init__(self, args):
        self.output_dir = Path(args.output).resolve()
        self.wallpapers_dir = self.output_dir / "wallpapers"
        self.index_path = self.output_dir / "index.json"
        self.progress_path = self.output_dir / "progress.json"
        self.quality = args.quality         # "both" / "4k" / "hd"
        self.workers = args.workers
        self.delay = args.delay
        self.start_page = args.start_page
        self.end_page = args.end_page
        self.wallpapers_dir.mkdir(parents=True, exist_ok=True)

        self.index = {}            # slug -> info
        self.collected_slugs = set()
        self.downloaded_count = 0
        self.failed_count = 0
        self.total_to_download = 0
        self.start_time = time.time()

        # 加载已有进度
        self._load_progress()

    def _load_progress(self):
        if self.index_path.exists():
            try:
                with open(self.index_path, "r", encoding="utf-8") as f:
                    self.index = json.load(f)
                print(f"📂 已加载索引：{len(self.index)} 个壁纸")
            except Exception:
                self.index = {}

    def _save_index(self):
        with open(self.index_path, "w", encoding="utf-8") as f:
            json.dump(self.index, f, ensure_ascii=False, indent=2)

    def _save_progress(self):
        with open(self.progress_path, "w", encoding="utf-8") as f:
            json.dump({
                "collected_slugs": list(self.collected_slugs),
                "downloaded_count": self.downloaded_count,
                "failed_count": self.failed_count,
                "elapsed": time.time() - self.start_time,
            }, f, ensure_ascii=False, indent=2)

    def collect_slugs(self):
        """第一阶段：遍历所有列表页收集 slug"""
        print("\n" + "=" * 60)
        print("📋 第一阶段：收集壁纸列表")
        print("=" * 60)

        end_page = self.end_page if self.end_page > 0 else detect_last_page(get_session(), self.delay)
        total_pages = end_page - self.start_page + 1
        print(f"📖 页码范围：第 {self.start_page} 页 ~ 第 {end_page} 页（共 {total_pages} 页）")

        for page_num in range(self.start_page, end_page + 1):
            if interrupted:
                break
            if page_num == 1:
                url = f"{BASE_URL}/"
            else:
                url = f"{BASE_URL}/{page_num}/"

            for attempt in range(3):
                try:
                    session = get_session()
                    soup = fetch_page(session, url, delay=self.delay)
                    slugs = parse_list_page(soup)
                    new_slugs = [s for s in slugs if s not in self.collected_slugs and s not in self.index]
                    self.collected_slugs.update(new_slugs)
                    print(f"  📄 第 {page_num:>4}/{end_page} 页 | 本页 {len(slugs):>2} 个 | 新增 {len(new_slugs):>2} 个 | 累计待处理 {len(self.collected_slugs):>5} 个")
                    break
                except Exception as e:
                    if attempt < 2:
                        time.sleep(2 * (attempt + 1))
                    else:
                        print(f"  ❌ 第 {page_num} 页获取失败: {e}")

            # 每 20 页保存一次进度
            if page_num % 20 == 0:
                self._save_progress()

        print(f"✅ 列表收集完成：共发现 {len(self.collected_slugs)} 个新壁纸待处理")
        self._save_progress()

    def fetch_detail(self, slug):
        """获取单个壁纸详情并下载"""
        if interrupted:
            return slug, None
        try:
            session = get_session()
            # 注意：详情页 URL 末尾不能加斜杠（否则 404）
            url = f"{BASE_URL}/{slug}"
            soup = fetch_page(session, url, delay=self.delay)
            info = parse_detail_page(soup, slug)
            if not info["downloads"]:
                return slug, None
            return slug, info
        except Exception as e:
            return slug, None

    def download_wallpaper(self, slug, info):
        """下载单个壁纸的 MP4 文件"""
        if interrupted:
            return False

        wid = info.get("id", "unknown")
        title = info.get("title", slug)
        # 去掉末尾的"Live Wallpaper"等后缀让文件名更简洁，再清理
        title_clean = re.sub(r'\s*(Live Wallpaper|Animated Wallpaper|Live Background|Animated Background)\s*$', '', title, flags=re.I)
        if not title_clean:
            title_clean = title
        safe_title = sanitize_filename(title_clean)
        wp_dir = self.wallpapers_dir / f"{safe_title}_{wid}"
        wp_dir.mkdir(parents=True, exist_ok=True)

        # 保存元数据 JSON
        meta_path = wp_dir / "info.json"
        with open(meta_path, "w", encoding="utf-8") as f:
            json.dump(info, f, ensure_ascii=False, indent=2)

        # 下载封面图
        if info.get("cover_image"):
            cover_ext = ".jpg"
            cover_path = wp_dir / f"cover{cover_ext}"
            if not cover_path.exists() or cover_path.stat().st_size == 0:
                try:
                    download_file(get_session(), info["cover_image"], cover_path, delay=self.delay * 0.5)
                except Exception:
                    pass

        all_ok = True
        qualities_to_download = []
        if self.quality in ("both", "4k"):
            qualities_to_download.append("4k")
        if self.quality in ("both", "hd"):
            qualities_to_download.append("hd")

        for q in qualities_to_download:
            dl = info["downloads"].get(q)
            if not dl:
                continue
            ext = ".mp4"
            filename = f"{q}_{dl['resolution']}{ext}"
            filepath = wp_dir / filename

            if filepath.exists() and filepath.stat().st_size > 1024:
                # 已下载
                continue

            session = get_session()
            ok = download_file(session, dl["url"], filepath, delay=self.delay)
            if not ok:
                all_ok = False

        return all_ok

    def run(self):
        """主流程：分三阶段执行"""
        self.start_time = time.time()

        # ── 第一阶段：收集 slug ──
        if not self.collected_slugs:
            self.collect_slugs()

        if interrupted:
            self._save_index()
            self._save_progress()
            print("\n🛑 已中断，进度已保存。重新运行可继续。")
            return

        # ── 第二阶段：并发获取详情页 ──
        # 需要获取详情的 slug（不在 index 中或没有 downloads）
        slugs_needing_detail = [s for s in self.collected_slugs
                                if s not in self.index or not self.index[s].get("downloads")]
        # 也包含 index 中已有但之前未完成的
        all_slugs = list(self.collected_slugs)
        for s in self.index:
            if s not in all_slugs:
                all_slugs.append(s)

        self.total_to_download = len(all_slugs)
        print(f"\n{'=' * 60}")
        print(f"🔍 第二阶段：并发获取详情页（{len(slugs_needing_detail)} 个待获取，{len(all_slugs) - len(slugs_needing_detail)} 个已缓存）")
        print(f"{'=' * 60}\n")

        detail_done = 0
        detail_failed = 0
        detail_total = len(slugs_needing_detail)

        if slugs_needing_detail:
            with ThreadPoolExecutor(max_workers=self.workers) as executor:
                futures = {executor.submit(self.fetch_detail, s): s for s in slugs_needing_detail}
                for future in as_completed(futures):
                    if interrupted:
                        break
                    slug = futures[future]
                    try:
                        result_slug, info = future.result()
                        if info and info.get("downloads"):
                            self.index[result_slug] = info
                        else:
                            detail_failed += 1
                    except Exception:
                        detail_failed += 1
                    detail_done += 1
                    pct = detail_done / detail_total * 100
                    print(f"  详情获取: [{detail_done:>5}/{detail_total:<5}] {pct:5.1f}% | 失败 {detail_failed}",
                          end="\r", flush=True)
                    if detail_done % 100 == 0:
                        self._save_index()

            self._save_index()
            print(f"\n✅ 详情获取完成：成功 {detail_done - detail_failed}，失败 {detail_failed}")

        if interrupted:
            self._save_index()
            self._save_progress()
            print("\n🛑 已中断，进度已保存。重新运行可继续。")
            return

        # ── 第三阶段：并发下载 MP4 文件 ──
        # 找出所有需要下载的 (slug, info) 对
        to_download = []
        for slug in all_slugs:
            info = self.index.get(slug)
            if not info or not info.get("downloads"):
                self.failed_count += 1
                continue
            to_download.append((slug, info))

        self.total_to_download = len(to_download) + self.failed_count
        print(f"\n{'=' * 60}")
        print(f"🚀 第三阶段：并发下载 MP4（共 {len(to_download)} 个壁纸，画质 {self.quality.upper()}，{self.workers} 线程）")
        print(f"{'=' * 60}\n")

        dl_done = 0
        with ThreadPoolExecutor(max_workers=self.workers) as executor:
            futures = {executor.submit(self.download_wallpaper, s, i): s for s, i in to_download}
            for future in as_completed(futures):
                if interrupted:
                    break
                slug = futures[future]
                try:
                    ok = future.result()
                    if ok:
                        self.downloaded_count += 1
                    else:
                        self.failed_count += 1
                except Exception:
                    self.failed_count += 1
                dl_done += 1
                self._print_progress(dl_done + self.failed_count)
                if dl_done % 50 == 0:
                    self._save_index()
                    self._save_progress()

        self._save_index()
        self._save_progress()
        elapsed = time.time() - self.start_time
        print(f"\n\n{'=' * 60}")
        print(f"🎉 任务完成！")
        print(f"   ✅ 成功下载：{self.downloaded_count}")
        print(f"   ❌ 失败：{self.failed_count}")
        print(f"   ⏱️  总耗时：{elapsed/60:.1f} 分钟")
        print(f"   📁 下载目录：{self.wallpapers_dir}")
        print(f"   📄 索引文件：{self.index_path}")
        print(f"{'=' * 60}")

    def _print_progress(self, done):
        pct = done / self.total_to_download * 100 if self.total_to_download else 0
        elapsed = time.time() - self.start_time
        speed = done / elapsed if elapsed > 0 else 0
        eta = (self.total_to_download - done) / speed if speed > 0 else 0
        print(f"  [{done:>5}/{self.total_to_download:<5}] {pct:5.1f}% | "
              f"✅ {self.downloaded_count} ❌ {self.failed_count} | "
              f"速度 {speed:.1f}/s | 预计剩余 {eta/60:.1f}min", end="\r", flush=True)


# ─────────────────────── 入口 ───────────────────────
def main():
    parser = argparse.ArgumentParser(
        description="MotionBGS.com 全站动态壁纸下载器",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
示例：
  python motionbgs_scraper.py                          # 默认下载4K+HD，8线程
  python motionbgs_scraper.py --quality 4k             # 仅下载4K
  python motionbgs_scraper.py --workers 12 --delay 0.2 # 12线程，更短间隔
  python motionbgs_scraper.py --start-page 1 --end-page 10  # 只下载前10页测试
        """
    )
    parser.add_argument("--quality", choices=["both", "4k", "hd"], default="both", help="下载画质（默认 both）")
    parser.add_argument("--workers", type=int, default=8, help="并发线程数（默认 8）")
    parser.add_argument("--start-page", type=int, default=1, help="起始页（默认 1）")
    parser.add_argument("--end-page", type=int, default=0, help="结束页（0=自动探测最后一页）")
    parser.add_argument("--output", type=str, default="./motionbgs_downloads", help="下载根目录")
    parser.add_argument("--delay", type=float, default=0.3, help="请求间延时秒数（默认 0.3）")
    args = parser.parse_args()

    print(r"""
  ╔══════════════════════════════════════════════╗
  ║     MotionBGS.com 全站动态壁纸下载器         ║
  ║     无需解密 · 直链下载 · 断点续传            ║
  ╚══════════════════════════════════════════════╝
    """)
    print(f"  下载目录: {Path(args.output).resolve()}")
    print(f"  画质: {args.quality}  线程: {args.workers}  延时: {args.delay}s")
    print()

    scraper = MotionBGSScraper(args)
    scraper.run()


if __name__ == "__main__":
    main()
