#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
bzmh.org（包子漫畫）全站爬虫
- 完美解密：使用 Playwright(Chromium) 作为 JS 运行时调用站点官方 chapter-decoder.js，
          100% 还原官方解密逻辑，无需逆向密钥，站点改版也可自动适配。
- 流程：漫画列表分页 -> 详情页取mid -> 调 /api/manga/get 获取章节列表 ->
        调 /api/v2/chapter/getinfo 获取加密图片 -> 浏览器内 __cimg.r 解密 ->
        多线程并发下载图片到本地。
- 输出结构：<out>/<漫画名>/meta.json + cover.webp + <章节名>/001.webp
"""

import argparse
import json
import os
import re
import sys
import time
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from threading import Lock
from urllib.parse import urljoin

import requests
from bs4 import BeautifulSoup
from playwright.sync_api import sync_playwright

BASE = "https://bzmh.org"
UA = ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36")
HEADERS = {"User-Agent": UA, "Referer": "https://bzmh.org/"}

IMG_HOST_C = "https://c-nd3-1.6wm.top"  # 主线路
IMG_HOST_T = "https://t-nd3-1.6wm.top"  # 备用线路

API_MANGA = "https://v2.apikk.top/api/manga/get?mid={mid}"
API_CHAPTER = "https://v2.apikk.top/api/v2/chapter/getinfo?m={m}&c={c}"

INVALID_CHARS = re.compile(r'[\\/:*?"<>|\r\n\t]')


def safe_name(s: str) -> str:
    s = INVALID_CHARS.sub("_", s).strip().strip(".")
    return s[:120] if len(s) > 120 else s


class Decryptor:
    """常驻 Chromium 作为 JS 解密引擎。"""

    def __init__(self):
        self._pw = None
        self._browser = None
        self._context = None
        self._page = None

    def start(self):
        self._pw = sync_playwright().start()
        self._browser = self._pw.chromium.launch(headless=True)
        self._context = self._browser.new_context(
            user_agent=UA, viewport={"width": 1280, "height": 800}, locale="zh-CN",
        )
        self._page = self._context.new_page()
        # 访问任意章节以加载 chapter-decoder.js
        self._page.goto(
            "https://bzmh.org/manga/quanzhiduzheshijiao-sleepcsingsyong-a01/471-785669-1",
            wait_until="domcontentloaded", timeout=60000,
        )
        self._page.wait_for_function(
            "window.__cimg && typeof window.__cimg.r === 'function'", timeout=60000,
        )
        print("[decryptor] ready", flush=True)

    def decrypt_chapter(self, mid: str, cid: str) -> dict:
        """返回 {title, slug, images:[{order,url}], prev, next, mid, order}"""
        data = self._page.evaluate(
            """async ([m,c]) => {
                const resp = await fetch('https://v2.apikk.top/api/v2/chapter/getinfo?m='+m+'&c='+c,{cache:'no-cache'});
                const j = await resp.json();
                if(!j || j.code !== 200) throw new Error('api code '+(j&&j.code)+' '+JSON.stringify(j).slice(0,300));
                const enc = j.data.info.images.images;
                const imgs = await window.__cimg.r(enc);
                const info = j.data.info;
                return {
                    title: info.title, slug: info.slug, mid: info.mid,
                    order: info.order, prev: info.prev, next: info.next,
                    images: imgs.map(i => ({order:i.order, url:i.url}))
                };
            }""", [str(mid), str(cid)],
        )
        return data

    def stop(self):
        try:
            if self._context: self._context.close()
            if self._browser: self._browser.close()
            if self._pw: self._pw.stop()
        except Exception:
            pass


def get(url: str, session: requests.Session) -> str:
    r = session.get(url, headers=HEADERS, timeout=30)
    r.raise_for_status()
    if not r.encoding or r.encoding.lower() == "iso-8859-1":
        r.encoding = r.apparent_encoding or "utf-8"
    return r.text


def get_json(url: str, session: requests.Session) -> dict:
    r = session.get(url, headers=HEADERS, timeout=30)
    r.raise_for_status()
    return r.json()


def parse_manga_list(html: str):
    """解析列表页 -> [(title, url, cover)]"""
    soup = BeautifulSoup(html, "html.parser")
    items = []
    seen = set()
    for a in soup.select("a[href^='/manga/']"):
        h3 = a.find("h3")
        if not h3:
            continue
        title = h3.get_text(strip=True)
        href = urljoin(BASE, a["href"])
        img = a.find("img")
        cover = img["src"] if img and img.get("src") else ""
        if href in seen:
            continue
        # 过滤非漫画链接（/manga /manga/page/x 等）
        if not re.search(r"/manga/[^/]+/?$", href):
            continue
        seen.add(href)
        items.append((title, href, cover))
    return items


def get_total_pages(html: str) -> int:
    soup = BeautifulSoup(html, "html.parser")
    pages = []
    for a in soup.find_all("a", href=True):
        m = re.search(r"/manga/page/(\d+)", a["href"])
        if m:
            pages.append(int(m.group(1)))
    return max(pages) if pages else 1


def fetch_manga_detail(detail_url: str, session: requests.Session) -> dict:
    """从详情页取mid，再调API获取全部章节。"""
    html = get(detail_url, session)
    m = re.search(r'id="mangachapters"[^>]*data-mid="(\d+)"', html)
    if not m:
        raise RuntimeError("mid not found in detail page")
    mid = m.group(1)
    # 页面标题/描述
    soup = BeautifulSoup(html, "html.parser")
    h1 = soup.find("h1")
    title = h1.get_text(" ", strip=True) if h1 else ""
    title = re.sub(r"[\s\-–|]*(連載中|连载中|完結|完结|已完結|已完结)\s*$", "", title).strip()
    desc_tag = soup.find("meta", {"name": "description"})
    desc = desc_tag["content"] if desc_tag else ""
    cover_tag = soup.find("meta", {"property": "og:image"})
    cover = cover_tag["content"] if cover_tag else ""

    # 调官方API拉全部章节
    j = get_json(API_MANGA.format(mid=mid), session)
    if j.get("code") != 200:
        raise RuntimeError(f"manga api bad code {j.get('code')}")
    data = j["data"]
    chapters = []
    for ch in data.get("chapters", []):
        chapters.append({
            "cid": str(ch["id"]),
            "title": ch["attributes"].get("title", ""),
            "slug": ch["attributes"].get("slug", ""),
            "order": ch["attributes"].get("order", 0),
        })
    if not title:
        title = data.get("title", "")
    if not cover:
        cover = data.get("cover", "")
    if not desc:
        desc = data.get("desc", "")
    return {
        "mid": mid,
        "title": title or data.get("title", ""),
        "cover": cover,
        "description": desc,
        "authors": [],  # 页面里作者通常在面包屑下方，简化起见这里不解析
        "chapters": chapters,
        "slug": data.get("slug", ""),
    }


def download_one(url: str, path: Path, session: requests.Session, retries: int = 3) -> str:
    if path.exists() and path.stat().st_size > 1024:
        return "skip"
    tmp = path.with_suffix(path.suffix + ".part")
    for attempt in range(retries):
        try:
            with session.get(url, headers={"User-Agent": UA, "Referer": "https://bzmh.org/"},
                             timeout=60, stream=True) as r:
                if r.status_code != 200:
                    raise RuntimeError(f"HTTP {r.status}")
                data = r.content
                if len(data) < 500:
                    raise RuntimeError("body too small")
                tmp.write_bytes(data)
                tmp.replace(path)
                return "ok"
        except Exception:
            if tmp.exists():
                try:
                    tmp.unlink()
                except Exception:
                    pass
            time.sleep(1 + attempt * 2)
    return "fail"


def download_images(imgs, out_dir: Path, host: str, concurrency: int = 8):
    out_dir.mkdir(parents=True, exist_ok=True)
    stats = {"ok": 0, "skip": 0, "fail": 0}
    lock = Lock()

    def work(item):
        order = item.get("order") or 0
        rel = item["url"]
        s = requests.Session()
        s.headers.update({"User-Agent": UA})
        primary = host.rstrip("/") + rel
        p = out_dir / f"{order:03d}.webp"
        st = download_one(primary, p, s)
        with lock:
            stats[st] += 1
        if st == "fail":
            alt = IMG_HOST_T if host.startswith("https://c-") else IMG_HOST_C
            st2 = download_one(alt.rstrip("/") + rel, p, s)
            with lock:
                stats[st2] = stats.get(st2, 0) + 1
            if st2 == "fail":
                print(f"  [FAIL] {primary}", flush=True)

    with ThreadPoolExecutor(max_workers=concurrency) as ex:
        list(ex.map(work, imgs))
    return stats


def main():
    ap = argparse.ArgumentParser(description="bzmh.org 包子漫画全站爬虫（完美解密版）")
    ap.add_argument("-o", "--out", default="./bzmh_downloads", help="下载根目录")
    ap.add_argument("--start-page", type=int, default=1, help="列表起始页")
    ap.add_argument("--end-page", type=int, default=0, help="列表结束页（0=自动检测最大页）")
    ap.add_argument("--only-manga", default="", help="只抓某一部漫画（url/slug/标题关键字）")
    ap.add_argument("--max-chapters", type=int, default=0, help="每部最多抓几话（0=全部）")
    ap.add_argument("--concurrency", type=int, default=8, help="图片并发下载线程数")
    ap.add_argument("--host", default=IMG_HOST_C, help="图片CDN线路，默认主线路c，备用t")
    ap.add_argument("--index-only", action="store_true", help="只拉索引元数据，不下载图片")
    ap.add_argument("--no-image", action="store_true", help="不下载图片（同 --index-only）")
    args = ap.parse_args()

    out_root = Path(args.out).resolve()
    out_root.mkdir(parents=True, exist_ok=True)

    sess = requests.Session()
    sess.headers.update(HEADERS)

    print("[info] fetching manga list page 1 ...", flush=True)
    first_html = get(LIST_URL.format(page=1) if False else "https://bzmh.org/manga/page/1", sess)
    total = get_total_pages(first_html) if args.end_page <= 0 else args.end_page
    print(f"[info] total list pages: {total}", flush=True)

    dec = Decryptor()
    dec.start()

    all_manga = []
    failed = []
    index_path = out_root / "index.json"

    try:
        for page in range(args.start_page, total + 1):
            print(f"\n[list] page {page}/{total}", flush=True)
            html = first_html if page == 1 else get(f"https://bzmh.org/manga/page/{page}", sess)
            items = parse_manga_list(html)
            print(f"[list]   found {len(items)} manga", flush=True)

            for title, url, cover in items:
                if args.only_manga and args.only_manga not in url and args.only_manga not in title:
                    continue

                print(f"[manga] {title} -> {url}", flush=True)
                try:
                    info = fetch_manga_detail(url, sess)
                except Exception as e:
                    print(f"  [warn] detail failed: {e}", flush=True)
                    failed.append(("detail", url, str(e)))
                    continue

                mtitle = info["title"] or title
                manga_dir = out_root / safe_name(mtitle)
                manga_dir.mkdir(parents=True, exist_ok=True)

                # 保存封面
                if info.get("cover"):
                    try:
                        cp = manga_dir / "cover.webp"
                        if not cp.exists():
                            r = sess.get(info["cover"], timeout=30)
                            if r.status_code == 200 and len(r.content) > 500:
                                cp.write_bytes(r.content)
                    except Exception as e:
                        print(f"  [warn] cover failed: {e}", flush=True)

                chapters = info["chapters"]
                if args.max_chapters > 0:
                    chapters = chapters[: args.max_chapters]
                print(f"  chapters: {len(chapters)}", flush=True)

                manga_meta = {
                    "mid": info["mid"],
                    "title": mtitle,
                    "slug": info["slug"],
                    "url": url,
                    "cover": info.get("cover", ""),
                    "description": info.get("description", ""),
                    "chapters": [],
                }

                for ci, ch in enumerate(chapters):
                    cid = ch["cid"]
                    mid = info["mid"]
                    try:
                        t0 = time.time()
                        data = dec.decrypt_chapter(mid, cid)
                    except Exception as e:
                        print(f"    [{ci+1}/{len(chapters)}] decrypt failed: {e}", flush=True)
                        failed.append(("decrypt", ch.get("slug"), str(e)))
                        continue

                    ch_title = (data.get("title") or ch["title"] or f"chapter_{ci+1}").strip()
                    ch_dir = manga_dir / safe_name(ch_title)
                    imgs = data.get("images", [])
                    print(
                        f"  [{ci+1}/{len(chapters)}] {ch_title}  "
                        f"({len(imgs)} imgs, {time.time()-t0:.1f}s)", flush=True,
                    )

                    manga_meta["chapters"].append({
                        "title": ch_title,
                        "cid": cid,
                        "images_count": len(imgs),
                        "dir": ch_dir.name,
                        "url": f"{url.rstrip('/')}/{ch['slug']}/" if ch.get("slug") else url,
                    })

                    if not args.index_only and not args.no_image:
                        try:
                            res = download_images(imgs, ch_dir, args.host, args.concurrency)
                            print(
                                f"      ok={res['ok']} skip={res['skip']} fail={res['fail']}",
                                flush=True,
                            )
                            if res["fail"] > 0:
                                failed.append(("download_fail", ch_title, f"{res['fail']} imgs failed"))
                        except Exception as e:
                            print(f"      [warn] download error: {e}", flush=True)
                            failed.append(("download", ch_title, str(e)))

                (manga_dir / "meta.json").write_text(
                    json.dumps(manga_meta, ensure_ascii=False, indent=2), encoding="utf-8",
                )
                all_manga.append({
                    "title": mtitle, "dir": manga_dir.name,
                    "chapters": len(manga_meta["chapters"]), "url": url,
                })
                index_path.write_text(
                    json.dumps({"all": all_manga, "failed": failed}, ensure_ascii=False, indent=2),
                    encoding="utf-8",
                )

                if args.only_manga:
                    # 命中目标漫画后可以提前结束
                    print(f"[info] only-manga 模式：命中 '{mtitle}'，任务完成。", flush=True)
                    return
    finally:
        dec.stop()
        index_path.write_text(
            json.dumps({"all": all_manga, "failed": failed}, ensure_ascii=False, indent=2),
            encoding="utf-8",
        )

    print(f"\n[done] {len(all_manga)} manga saved -> {out_root}", flush=True)
    if failed:
        print(f"[failed] {len(failed)} items (see index.json)", flush=True)


if __name__ == "__main__":
    main()
