#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
壁響 (wallecho.com) 全站壁纸爬虫 — 极速版
================================================
功能特性：
  1. BFS 广度优先遍历全站（首页 + 26 个二级分类 + 所有三级标签 + 所有分页）
  2. 优先使用 requests 高速抓取；若被 Cloudflare 拦截自动降级到 cloudscraper
  3. 图片托管在 Cloudflare R2 (r2.wallecho.com)，无加密直链，直接下载原图
  4. 多线程并发下载（默认 8 线程，可调），支持断点续传（文件已存在自动跳过）
  5. 按 设备类型 / 一级分类 / 三级标签 自动归档目录
  6. 实时进度条、自动保存元数据 metadata.json（可用于断点续爬）
  7. 失败自动重试（最多 5 次，指数退避）+ 随机 UA + 随机请求间隔防封
  8. 支持命令行参数灵活控制（仅电脑/仅手机/限页数/不下载等）
  9. 纯 Python 运行，无需浏览器/Node.js

站点结构逆向分析（已完整验证）：
  - 服务端渲染 SSR，HTML 直接包含所有图片 src，无 JS 动态加载/加密参数
  - 图片 URL 规则: https://r2.wallecho.com/YYYY/MM/DD/<数字>.jpg|png|jpe
  - 分类规则: /category/<设备>/<一级>/<三级标签>?page=N
  - 分页规则: 最大页在导航中以 ...page=43 形式出现，自增直到无卡片时停止
  - 每页 20 张卡片，全网站大约 电脑桌布 43+ 页 × 20 ≈ 860 张，手机桌布类似

用法：
    python3 wallecho_crawler.py                      # 默认：下载全站
    python3 wallecho_crawler.py -w 16                # 16 并发
    python3 wallecho_crawler.py --only-desktop       # 仅电脑桌布
    python3 wallecho_crawler.py --only-mobile        # 仅手机桌布
    python3 wallecho_crawler.py --max-pages 2        # 每个分类最多 2 页（测试）
    python3 wallecho_crawler.py --no-download        # 只抓元数据不下图
    python3 wallecho_crawler.py -o D:/wallpapers     # 指定输出目录
"""

import argparse
import json
import os
import random
import re
import sys
import threading
import time
from collections import deque
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path
from urllib.parse import unquote, urljoin, urlparse, parse_qs

import requests
from bs4 import BeautifulSoup
from tqdm import tqdm

# =========================================================
# 常量配置
# =========================================================
BASE_URL = "https://wallecho.com"
IMAGE_HOST = "https://r2.wallecho.com"
DEFAULT_OUTPUT = "./wallecho_wallpapers"
MAX_RETRIES = 5
RETRY_BACKOFF = 1.8
REQUEST_TIMEOUT = 25
DEFAULT_WORKERS = 8
DELAY_MIN = 0.15
DELAY_MAX = 0.6

USER_AGENTS = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_5) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:127.0) Gecko/20100101 Firefox/127.0",
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36 Edg/125.0.0.0",
]


def new_session(use_cloudscraper=False):
    """创建 requests 会话，可选 cloudscraper 兜底"""
    if use_cloudscraper:
        try:
            import cloudscraper
            s = cloudscraper.create_scraper(
                browser={"browser": "chrome", "platform": "windows", "desktop": True}
            )
        except ImportError:
            print("[!] cloudscraper 未安装，回退到 requests: pip install cloudscraper")
            s = requests.Session()
    else:
        s = requests.Session()
    s.headers.update({
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
        "Accept-Language": "zh-TW,zh;q=0.9,zh-CN;q=0.8,en;q=0.7",
        "Accept-Encoding": "gzip, deflate, br",
        "Connection": "keep-alive",
        "Upgrade-Insecure-Requests": "1",
        "User-Agent": random.choice(USER_AGENTS),
    })
    return s


def polite_delay():
    time.sleep(random.uniform(DELAY_MIN, DELAY_MAX))


class WallechoCrawler:
    def __init__(self, output_dir=DEFAULT_OUTPUT, workers=DEFAULT_WORKERS,
                 only_desktop=False, only_mobile=False, max_pages=None,
                 download_images=True):
        self.output_dir = Path(output_dir).resolve()
        self.output_dir.mkdir(parents=True, exist_ok=True)
        self.workers = workers
        self.only_desktop = only_desktop
        self.only_mobile = only_mobile
        self.max_pages = max_pages
        self.download_images = download_images

        # 已下载集合（从元数据恢复）
        self.meta_file = self.output_dir / "metadata.json"
        self.downloaded_urls = set()
        self.wallpaper_meta = []
        self._load_meta()

        # 线程局部会话
        self.thread_local = threading.local()
        self.meta_lock = threading.Lock()
        self.fallback_to_cf = False  # 是否切换到 cloudscraper

    # ----------------- 元数据持久化 -----------------
    def _load_meta(self):
        if self.meta_file.exists():
            try:
                with open(self.meta_file, "r", encoding="utf-8") as f:
                    self.wallpaper_meta = json.load(f)
                for item in self.wallpaper_meta:
                    self.downloaded_urls.add(item["image_url"])
                print(f"[+] 恢复进度：{len(self.downloaded_urls)} 条已存在记录")
            except Exception as e:
                print(f"[!] 元数据读取失败（将新建）: {e}")
                self.wallpaper_meta = []

    def _save_meta(self):
        tmp = self.meta_file.with_suffix(".json.tmp")
        with open(tmp, "w", encoding="utf-8") as f:
            json.dump(self.wallpaper_meta, f, ensure_ascii=False, indent=2)
        os.replace(tmp, self.meta_file)

    # ----------------- 会话管理 -----------------
    def _get_session(self):
        if not hasattr(self.thread_local, "session"):
            self.thread_local.session = new_session(self.fallback_to_cf)
            # 预热：先访问首页拿 cookie
            try:
                self.thread_local.session.get(BASE_URL, timeout=REQUEST_TIMEOUT)
            except Exception:
                pass
        return self.thread_local.session

    def _reset_session(self):
        if hasattr(self.thread_local, "session"):
            try:
                self.thread_local.session.close()
            except Exception:
                pass
            del self.thread_local.session

    # ----------------- 请求工具 -----------------
    def _get(self, url, stream=False, referer=None):
        """带重试、自动 UA 轮换、CF 兜底切换的 GET 请求"""
        last_err = None
        for attempt in range(1, MAX_RETRIES + 1):
            try:
                s = self._get_session()
                headers = {"User-Agent": random.choice(USER_AGENTS)}
                if referer:
                    headers["Referer"] = referer
                resp = s.get(url, headers=headers, timeout=REQUEST_TIMEOUT,
                             stream=stream, allow_redirects=True)
                if resp.status_code == 200:
                    return resp
                if resp.status_code in (403, 503, 429) and not self.fallback_to_cf:
                    # 第一次被拦截时切换到 cloudscraper
                    print(f"\n[!] 被 Cloudflare 拦截（HTTP {resp.status_code}），切换到 cloudscraper 模式")
                    self.fallback_to_cf = True
                    self._reset_session()
                    continue
                wait = RETRY_BACKOFF ** attempt + random.uniform(0.5, 1.5)
                if attempt < MAX_RETRIES:
                    time.sleep(wait)
                last_err = RuntimeError(f"HTTP {resp.status_code}")
            except Exception as e:
                last_err = e
                wait = RETRY_BACKOFF ** attempt
                if attempt < MAX_RETRIES:
                    time.sleep(wait)
        raise last_err if last_err else RuntimeError(f"请求失败: {url}")

    # ----------------- 页面解析 -----------------
    def parse_page(self, html, page_url):
        """返回 (wallpapers, sub_categories, next_page_urls, max_page_num)"""
        soup = BeautifulSoup(html, "lxml")
        wallpapers = []
        sub_cats = set()
        next_pages = []
        max_page = 1

        # 壁纸卡片
        for card in soup.select("div.hover-card"):
            a_tag = card.find("a", href=True)
            img_tag = card.find("img")
            if not a_tag or not img_tag:
                continue
            img_url = img_tag.get("src") or img_tag.get("data-src") \
                      or img_tag.get("data-lazy-src") or img_tag.get("data-original")
            if not img_url or IMAGE_HOST not in img_url:
                continue
            title = (img_tag.get("alt") or "").strip()

            # 浏览/下载数
            views = downloads = 0
            stats = card.select_one("div.bg-primary.bg-opacity-80")
            if stats:
                nums = re.findall(r"\d[\d,]*", stats.get_text(" ", strip=True))
                nums = [int(n.replace(",", "")) for n in nums]
                if len(nums) >= 2:
                    views, downloads = nums[0], nums[1]
                elif nums:
                    views = nums[0]

            wall_page = urljoin(BASE_URL, a_tag["href"])
            cat_path = self._path_parts(wall_page)
            wallpapers.append({
                "page_url": wall_page,
                "image_url": img_url,
                "title": title,
                "views": views,
                "downloads": downloads,
                "category_path": cat_path,
            })

        # 分类链接（包括三级标签）
        for a in soup.find_all("a", href=True):
            href = a["href"]
            if href.startswith("/category/"):
                full = urljoin(BASE_URL, href).split("?")[0].rstrip("/") + "/"
                sub_cats.add(full)

        # 分页
        for a in soup.find_all("a", href=True):
            href = a["href"]
            if "page=" in href:
                full = urljoin(page_url, href)
                next_pages.append(full)
                m = re.search(r"[?&]page=(\d+)", full)
                if m:
                    pn = int(m.group(1))
                    if pn > max_page:
                        max_page = pn
        return wallpapers, sub_cats, next_pages, max_page

    @staticmethod
    def _path_parts(url):
        path = urlparse(url).path
        parts = [unquote(p) for p in path.split("/") if p and p != "category"]
        return parts

    # ----------------- 遍历站点 -----------------
    def _seeds(self):
        seeds = []
        if not self.only_mobile:
            seeds.append(BASE_URL + "/category/%E9%9B%BB%E8%85%A6%E6%A1%8C%E5%B8%83/")
        if not self.only_desktop:
            seeds.append(BASE_URL + "/category/%E6%89%8B%E6%A9%9F%E6%A1%8C%E5%B8%83/")
        # 首页也作为入口（含热门推荐）
        seeds.insert(0, BASE_URL + "/")
        return seeds

    @staticmethod
    def _normalize_url(url):
        """URL 归一化：去掉 fragment，统一末尾斜杠，用于 visited 去重"""
        u = url.split("#")[0]
        parsed = urlparse(u)
        path = parsed.path.rstrip("/") + "/" if parsed.path != "/" else "/"
        # 排序查询参数，确保 ?page=2&a=b 和 ?a=b&page=2 视为同一页
        qs = parse_qs(parsed.query, keep_blank_values=True)
        # 只保留 page 参数用于分页识别；其他参数忽略（该站没有其它查询参数）
        page = qs.get("page", [None])[0]
        norm_query = f"?page={page}" if page else ""
        return f"{parsed.scheme}://{parsed.netloc}{path}{norm_query}"

    def crawl_site(self):
        """两阶段遍历：1) 从首页+两个顶级入口收集全部子分类URL；2) 逐个分类翻页抓取壁纸"""
        all_wallpapers = []
        seen_img = set(w["image_url"] for w in self.wallpaper_meta)
        visited_pages = set()

        # ============ 阶段 1：发现所有分类 URL（集合） ============
        # 种子页：首页 + 电脑 + 手机
        seeds = [BASE_URL + "/"]
        if not self.only_mobile:
            seeds.append(BASE_URL + "/category/%E9%9B%BB%E8%85%A6%E6%A1%8C%E5%B8%83/")
        if not self.only_desktop:
            seeds.append(BASE_URL + "/category/%E6%89%8B%E6%A9%9F%E6%A1%8C%E5%B8%83/")

        all_categories = set()
        print("[*] 阶段 1/2：收集全站分类链接 ...")
        for seed_url in seeds:
            try:
                resp = self._get(seed_url)
                polite_delay()
                soup = BeautifulSoup(resp.text, "lxml")
                # 加入种子自身
                base_norm = self._normalize_url(seed_url).split("?")[0]
                if base_norm.startswith(f"{BASE_URL}/category/"):
                    all_categories.add(base_norm)
                for a in soup.find_all("a", href=True):
                    href = a["href"]
                    if not href.startswith("/category/"):
                        continue
                    full = urljoin(BASE_URL, href).split("?")[0].rstrip("/") + "/"
                    # 过滤范围
                    if self.only_desktop and "%E6%89%8B%E6%A9%9F" in full:
                        continue
                    if self.only_mobile and "%E9%9B%BB%E8%85%A6" in full:
                        continue
                    all_categories.add(full)
            except Exception as e:
                print(f"[!] 收集分类时失败 {seed_url}: {e}")

        # 排序：先顶级，再深层，保证抓取顺序自然
        def depth(u):
            return len([p for p in urlparse(u).path.split("/") if p and p != "category"])
        all_categories = sorted(all_categories, key=lambda x: (depth(x), x))
        print(f"[+] 共发现 {len(all_categories)} 个分类/标签入口")

        # ============ 阶段 2：逐个分类翻页抓取 ============
        pbar = tqdm(desc="遍历页面", unit="页", position=0, leave=True)
        total_cats = len(all_categories)
        for idx, cat_url in enumerate(all_categories, 1):
            page_num = 1
            while True:
                if self.max_pages and page_num > self.max_pages:
                    break
                page_url = cat_url if page_num == 1 else f"{cat_url}?page={page_num}"
                norm = self._normalize_url(page_url)
                if norm in visited_pages:
                    page_num += 1
                    continue
                visited_pages.add(norm)
                try:
                    resp = self._get(page_url)
                    polite_delay()
                    wps, _subs, _nps, max_pn = self.parse_page(resp.text, page_url)
                    new_cnt = 0
                    for w in wps:
                        if w["image_url"] not in seen_img:
                            all_wallpapers.append(w)
                            seen_img.add(w["image_url"])
                            new_cnt += 1
                    pbar.update(1)
                    pbar.set_postfix_str(
                        f"分类:{idx}/{total_cats} p{page_num} 新增:{new_cnt} 累计:{len(all_wallpapers)}"
                    )
                    # 空页 = 已到底，停止该分类
                    if not wps and page_num > 1:
                        break
                    # 是否还有下一页：当前页数量 == 20 且 max_pn > page_num 才继续
                    if len(wps) < 20:
                        break
                    # 如果 HTML 中出现更大页码则继续，否则按 len==20 自增一页
                    if max_pn <= page_num and len(wps) < 20:
                        break
                    page_num += 1
                except KeyboardInterrupt:
                    raise
                except Exception as e:
                    tqdm.write(f"[!] 抓取失败 {page_url}: {e}")
                    break
        pbar.close()
        print(f"[+] 遍历完成，共抓取 {len(all_wallpapers)} 张壁纸，{len(visited_pages)} 个页面")
        return all_wallpapers

    # ----------------- 文件与下载 -----------------
    @staticmethod
    def _safe_name(name):
        return re.sub(r'[\\/:*?"<>|\r\n\t]', "_", name).strip()[:80] or "未命名"

    def _local_path(self, item):
        parts = list(item["category_path"])
        # 期望结构: [设备, 一级, 三级标签]，不足补齐
        if len(parts) == 0:
            parts = ["其他", "其他", "未分类"]
        elif len(parts) == 1:
            parts.append("其他")
        elif len(parts) > 3:
            parts = parts[:3]
        parts = [self._safe_name(p) for p in parts]
        url_path = urlparse(item["image_url"]).path
        fname = os.path.basename(url_path)
        if "." not in fname:
            fname += ".jpg"
        save_dir = self.output_dir.joinpath(*parts)
        save_dir.mkdir(parents=True, exist_ok=True)
        return save_dir / fname

    def _download_one(self, item):
        url = item["image_url"]
        if url in self.downloaded_urls:
            return "skip"
        local = self._local_path(item)
        if local.exists() and local.stat().st_size > 2048:
            with self.meta_lock:
                self.downloaded_urls.add(url)
            return "exists"
        try:
            resp = self._get(url, stream=True, referer=BASE_URL + "/")
            tmp = local.with_suffix(local.suffix + ".part")
            with open(tmp, "wb") as f:
                for chunk in resp.iter_content(64 * 1024):
                    if chunk:
                        f.write(chunk)
            os.replace(tmp, local)
            record = {
                **item,
                "local_path": str(local.relative_to(self.output_dir)),
                "file_size": local.stat().st_size,
                "download_time": time.strftime("%Y-%m-%d %H:%M:%S"),
            }
            with self.meta_lock:
                self.wallpaper_meta.append(record)
                self.downloaded_urls.add(url)
                if len(self.wallpaper_meta) % 50 == 0:
                    self._save_meta()
            return "ok"
        except Exception as e:
            if "tmp" in locals() and tmp.exists():
                try:
                    tmp.unlink()
                except Exception:
                    pass
            return f"fail:{e}"

    def download_all(self, wallpapers):
        if not self.download_images:
            print("[*] --no-download 模式，仅保存元数据")
            added = 0
            for w in wallpapers:
                if w["image_url"] not in self.downloaded_urls:
                    self.wallpaper_meta.append({**w, "local_path": None,
                                                "file_size": None,
                                                "download_time": None})
                    self.downloaded_urls.add(w["image_url"])
                    added += 1
            self._save_meta()
            print(f"[+] 已保存 {added} 条元数据")
            return

        todo = [w for w in wallpapers if w["image_url"] not in self.downloaded_urls]
        print(f"[*] 待下载 {len(todo)} 张（已存在 {len(self.downloaded_urls)} 张）")
        if not todo:
            print("[+] 没有需要下载的新壁纸")
            return

        ok = exists = fail = 0
        pbar = tqdm(total=len(todo), desc="下载壁纸", unit="张", position=0, leave=True)
        try:
            with ThreadPoolExecutor(max_workers=self.workers) as ex:
                futures = {ex.submit(self._download_one, w): w for w in todo}
                for fut in as_completed(futures):
                    r = fut.result()
                    if r == "ok":
                        ok += 1
                    elif r in ("exists", "skip"):
                        exists += 1
                    elif r.startswith("fail"):
                        fail += 1
                        tqdm.write(f"[!] 失败: {futures[fut]['image_url']} -> {r}")
                    pbar.update(1)
        except KeyboardInterrupt:
            print("\n[!] 用户中断，已保存进度")
        finally:
            pbar.close()
            self._save_meta()

        print("\n" + "=" * 55)
        print(f"  下载完成  新增:{ok}  已存在:{exists}  失败:{fail}")
        print(f"  壁纸总数  : {len(self.wallpaper_meta)}")
        print(f"  输出目录  : {self.output_dir}")
        print(f"  元数据    : {self.meta_file}")
        print("=" * 55)

    def run(self):
        print("=" * 55)
        print("  壁響 wallecho.com 全站壁纸爬虫")
        print("=" * 55)
        print(f"  输出目录 : {self.output_dir}")
        print(f"  并发线程 : {self.workers}")
        print(f"  下载图片 : {'是' if self.download_images else '否(仅元数据)'}")
        print(f"  页数限制 : {self.max_pages or '不限'}")
        print(f"  范围     : {'仅电脑桌布' if self.only_desktop else ('仅手机桌布' if self.only_mobile else '全站')}")
        print("=" * 55)
        wallpapers = self.crawl_site()
        self.download_all(wallpapers)


def parse_args():
    p = argparse.ArgumentParser(description="壁響 wallecho.com 全站壁纸爬虫")
    p.add_argument("--output", "-o", default=DEFAULT_OUTPUT, help=f"输出目录（默认 {DEFAULT_OUTPUT}）")
    p.add_argument("--workers", "-w", type=int, default=DEFAULT_WORKERS, help=f"并发线程数（默认 {DEFAULT_WORKERS}）")
    p.add_argument("--only-desktop", action="store_true", help="仅抓取电脑桌布")
    p.add_argument("--only-mobile", action="store_true", help="仅抓取手机桌布")
    p.add_argument("--max-pages", type=int, default=None, help="每个分类最大抓取页数（测试用，默认不限）")
    p.add_argument("--no-download", action="store_true", help="仅抓取元数据，不下载图片")
    return p.parse_args()


if __name__ == "__main__":
    args = parse_args()
    crawler = WallechoCrawler(
        output_dir=args.output,
        workers=args.workers,
        only_desktop=args.only_desktop,
        only_mobile=args.only_mobile,
        max_pages=args.max_pages,
        download_images=not args.no_download,
    )
    crawler.run()
