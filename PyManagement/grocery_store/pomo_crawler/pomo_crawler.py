#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
pomo.mom 全站爬虫
=================
功能：
  1. 抓取首页/各分类所有列表页，收集所有影片详情页链接
  2. 进入每个详情页，提取影片元信息 + 全部下载链接（夸克网盘/磁力等）
  3. 结果保存为 JSON、CSV，同时生成磁力链接 .txt 文件方便导入下载工具

逆向说明：
  经分析，该站下载链接完全明文存放在 <a class="..."> 的 data-url 属性中，
  无 JS 加密、无签名、无参数混淆，直接 HTTP 请求 + HTML 解析即可拿到真实链接。
  已完美"逆向"，实际零解密成本。

用法：
  python pomo_crawler.py                # 默认抓全部分类+首页
  python pomo_crawler.py --pages 5      # 每个分类只抓前5页（测试用）
  python pomo_crawler.py --only-home    # 只抓首页列表
  python pomo_crawler.py --delay 1.5    # 请求间隔秒数（防封）
"""

import argparse
import csv
import json
import os
import re
import sys
import time
import urllib.parse
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path

import requests
from bs4 import BeautifulSoup

# ---------- 配置 ----------
BASE_URL = "https://pomo.mom"
DEFAULT_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/126.0.0.0 Safari/537.36"
    ),
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
    "Referer": BASE_URL + "/",
}
TIMEOUT = 20
RETRIES = 3

# 分类（从导航栏抓取得到）
CATEGORIES = {
    "首页":        "/",
    "华语热门":    "/huayurm",
    "家庭影院":    "/jiating",
    "动画大电影":  "/donghuadadiany",
    "冷门佳片":    "/lengmenjiapian",
    "TOP250":      "/paihangbang",
    "蓝光原盘":    "/sort/12",
    "剧集":        "/dianshiju",
}

OUTPUT_DIR = Path("pomo_output")
OUTPUT_DIR.mkdir(exist_ok=True)


# ---------- 工具函数 ----------
def session() -> requests.Session:
    s = requests.Session()
    s.headers.update(DEFAULT_HEADERS)
    return s


def fetch(s: requests.Session, url: str) -> str | None:
    for i in range(RETRIES):
        try:
            r = s.get(url, timeout=TIMEOUT)
            if r.status_code == 200:
                r.encoding = r.apparent_encoding or "utf-8"
                return r.text
            print(f"  [!] HTTP {r.status_code} for {url}")
        except requests.RequestException as e:
            print(f"  [!] 请求异常({i+1}/{RETRIES}): {e}  url={url}")
            time.sleep(2)
    return None


def last_page_number(soup: BeautifulSoup) -> int:
    """从分页区提取最大页码，失败则返回 1。"""
    # 常见格式：末页链接 /page/223，或「... 223 »」
    a = soup.select_one('a:contains("»")')
    # BeautifulSoup select 不支持 :contains，手动找
    for a_tag in soup.find_all("a", href=True):
        m = re.search(r"/page/(\d+)/?$", a_tag["href"])
        if m:
            # 记录最大的
            pass
    # 更可靠：枚举所有 /page/N 链接取最大 N
    nums = []
    for a_tag in soup.find_all("a", href=True):
        m = re.search(r"/page/(\d+)(?:/)?$", a_tag["href"])
        if m:
            nums.append(int(m.group(1)))
    return max(nums) if nums else 1


# ---------- 列表页解析 ----------
def parse_list_page(html: str) -> tuple[list[dict], int]:
    """返回 (影片列表[{id,title,url}], 最大页码)。"""
    soup = BeautifulSoup(html, "html.parser")
    movies = []
    seen = set()
    for a in soup.find_all("a", href=True):
        href = a["href"]
        # 详情页链接形如 /3436
        m = re.match(r"^/(\d+)/?$", href)
        if not m:
            # 也兼容完整URL
            m = re.match(r"^https?://pomo\.mom/(\d+)/?$", href)
        if m:
            mid = m.group(1)
            if mid in seen:
                continue
            h3 = a.find("h3")
            if h3:
                seen.add(mid)
                movies.append({
                    "id": int(mid),
                    "title": h3.get_text(strip=True),
                    "url": f"{BASE_URL}/{mid}",
                })
    last_page = last_page_number(soup)
    return movies, last_page


# ---------- 详情页解析 ----------
def parse_detail_page(html: str, movie_url: str) -> dict:
    """解析详情页，返回影片元信息 + 下载资源列表。"""
    soup = BeautifulSoup(html, "html.parser")

    # 标题
    title = ""
    h = soup.find(["h1", "h2"])
    if h:
        title = h.get_text(strip=True)

    # 简介
    desc = ""
    intro_h = soup.find("h3", string=re.compile("剧情简介"))
    if intro_h:
        # 简介通常在紧随的兄弟节点中
        nxt = intro_h.find_next_sibling()
        if nxt:
            desc = nxt.get_text("\n", strip=True)
        else:
            # 取父级后面的段落
            parent = intro_h.parent
            if parent:
                # 直接取父级div内所有文本，去掉标题
                text = parent.get_text("\n", strip=True)
                desc = text.replace("剧情简介", "").strip()
    if not desc:
        # fallback: meta description
        md = soup.find("meta", attrs={"name": "description"})
        if md and md.get("content"):
            desc = md["content"].strip()

    # 封面
    cover = ""
    og = soup.find("meta", property="og:image")
    if og and og.get("content"):
        cover = og["content"]

    def _classify(url: str) -> str:
        if url.startswith("magnet:"):
            return "magnet"
        if "quark.cn" in url:
            return "quark"
        if "pan.baidu" in url:
            return "baidu"
        if "xunlei" in url or "thunder" in url:
            return "thunder"
        if "aliyundrive" in url or "alipan" in url:
            return "aliyun"
        if url.startswith(("ed2k://", "thunder://")):
            return "ed2k"
        if url.startswith("http"):
            return "http"
        return "unknown"

    # ---- 1) 静态 HTML 中的 data-url 链接 ----
    seen_urls: set[str] = set()
    downloads: list[dict] = []
    for a in soup.find_all("a", attrs={"data-url": True}):
        url = a["data-url"].strip()
        if not url or url in seen_urls:
            continue
        txt = a.get_text(strip=True)
        # 纯"下载"按钮：名称取前一个带真实文本的 a 标签
        name = ""
        if txt == "下载":
            prev = a.find_previous("a")
            while prev is not None:
                pt = prev.get_text(strip=True)
                pu = prev.get("data-url", "").strip()
                if pt and pt != "下载" and pu and pu != url:
                    name = pt
                    break
                prev = prev.find_previous("a")
        else:
            name = txt
        if not name:
            name = txt or "unknown"

        seen_urls.add(url)
        downloads.append({"name": name, "url": url, "type": _classify(url)})

    # ---- 2) JS 字符串中通过 insertAdjacentHTML/innerHTML 动态插入的链接 ----
    # 典型：href=\"https://pan.quark.cn/s/xxxxx\" title=\"资源名称...\"
    # 以及 onclick=\"window.open('xxxx')\" 等
    raw = html
    # 匹配 href="URL" 后跟 title="NAME" 的格式（JS转义过的 \"）
    pattern = re.compile(
        r'href=\\?"(https?://[^"\\]+(?:quark|baidu|aliyun|alipan)[^"\\]*)\\?"\s+title=\\?"([^"\\]{2,200})\\?"'
    )
    for m in pattern.finditer(raw):
        url = m.group(1).replace("\\/", "/").strip()
        name = m.group(2).replace("&amp;", "&").strip()
        if url and url not in seen_urls:
            seen_urls.add(url)
            downloads.append({"name": name, "url": url, "type": _classify(url)})

    # 匹配 onclick window.open('URL')  或 data-ajax 返回的链接
    for m in re.finditer(r"""(?:window\.open|location\.href)\s*\(\s*['"](https?://[^'"]+)['"]""", raw):
        url = m.group(1).strip()
        if url not in seen_urls and not url.endswith((".js", ".css", ".png", ".jpg", ".svg")):
            seen_urls.add(url)
            downloads.append({"name": "动态链接", "url": url, "type": _classify(url)})

    return {
        "title": title,
        "url": movie_url,
        "cover": cover,
        "description": desc,
        "downloads": downloads,
    }


# ---------- 主抓取流程 ----------
def crawl_category(name: str, path: str, s: requests.Session,
                   max_pages: int | None, delay: float) -> list[dict]:
    """抓一个分类的所有列表页，返回该分类下全部影片（id,title,url）。"""
    print(f"\n[分类] {name}  ({BASE_URL}{path})")
    all_movies: dict[int, dict] = {}

    # 第1页
    page_url = BASE_URL + path if path != "/" else BASE_URL + "/"
    html = fetch(s, page_url)
    if not html:
        print(f"  [!] 无法访问首页 {page_url}，跳过分类 {name}")
        return []
    movies, total_pages = parse_list_page(html)
    for m in movies:
        all_movies[m["id"]] = {**m, "category": name}
    print(f"  第 1/{total_pages} 页：新增 {len(movies)} 部")

    if max_pages:
        total_pages = min(total_pages, max_pages)

    # 其余页
    for p in range(2, total_pages + 1):
        if path == "/" or path == "":
            url = f"{BASE_URL}/page/{p}"
        else:
            url = f"{BASE_URL}{path.rstrip('/')}/page/{p}"
        time.sleep(delay)
        html = fetch(s, url)
        if not html:
            print(f"  [!] 第 {p} 页抓取失败，继续下一页")
            continue
        movies, _ = parse_list_page(html)
        new_cnt = 0
        for m in movies:
            if m["id"] not in all_movies:
                all_movies[m["id"]] = {**m, "category": name}
                new_cnt += 1
        print(f"  第 {p}/{total_pages} 页：新增 {new_cnt} 部 (累计 {len(all_movies)})")

    return list(all_movies.values())


def crawl_detail(movie: dict, s: requests.Session, delay: float) -> dict | None:
    time.sleep(delay)
    html = fetch(s, movie["url"])
    if not html:
        return None
    info = parse_detail_page(html, movie["url"])
    info["id"] = movie["id"]
    info["category"] = movie.get("category", "")
    info["list_title"] = movie.get("title", "")
    return info


# ---------- 输出 ----------
def save_results(all_data: list[dict]):
    # JSON 全量
    json_path = OUTPUT_DIR / "pomo_all_movies.json"
    with open(json_path, "w", encoding="utf-8") as f:
        json.dump(all_data, f, ensure_ascii=False, indent=2)
    print(f"\n[+] JSON 已保存：{json_path}  ({len(all_data)} 部影片)")

    # CSV 扁平版
    csv_path = OUTPUT_DIR / "pomo_download_links.csv"
    rows = []
    for mv in all_data:
        for d in mv.get("downloads", []):
            rows.append({
                "id": mv.get("id", ""),
                "category": mv.get("category", ""),
                "title": mv.get("title") or mv.get("list_title", ""),
                "url": mv.get("url", ""),
                "resource_name": d.get("name", ""),
                "link_type": d.get("type", ""),
                "download_url": d.get("url", ""),
            })
    with open(csv_path, "w", encoding="utf-8-sig", newline="") as f:
        w = csv.DictWriter(f, fieldnames=["id", "category", "title", "url",
                                          "resource_name", "link_type", "download_url"])
        w.writeheader()
        w.writerows(rows)
    print(f"[+] CSV  已保存：{csv_path}  ({len(rows)} 条下载链接)")

    # 磁力链接合集（导入 BT/迅雷/qBittorrent 用）
    mag_path = OUTPUT_DIR / "pomo_magnets.txt"
    mag_count = 0
    with open(mag_path, "w", encoding="utf-8") as f:
        for mv in all_data:
            written_header = False
            for d in mv.get("downloads", []):
                if d.get("type") == "magnet":
                    if not written_header:
                        f.write(f"\n# === {mv.get('title','')} ({mv.get('url','')}) ===\n")
                        written_header = True
                    name = d.get("name", "").replace("\n", " ").strip()
                    f.write(f"# {name}\n{d['url']}\n")
                    mag_count += 1
    print(f"[+] 磁力合集：{mag_path}  ({mag_count} 条磁力)")

    # 夸克网盘合集
    quark_path = OUTPUT_DIR / "pomo_quark.txt"
    q_count = 0
    with open(quark_path, "w", encoding="utf-8") as f:
        for mv in all_data:
            written_header = False
            for d in mv.get("downloads", []):
                if d.get("type") == "quark":
                    if not written_header:
                        f.write(f"\n# === {mv.get('title','')} ===\n")
                        written_header = True
                    name = d.get("name", "").replace("\n", " ").strip()
                    f.write(f"# {name}\n{d['url']}\n")
                    q_count += 1
    print(f"[+] 夸克合集：{quark_path}  ({q_count} 条夸克)")

    # 汇总
    total_links = sum(len(m.get("downloads", [])) for m in all_data)
    summary = {
        "movies_total": len(all_data),
        "download_links_total": total_links,
        "magnet_links": mag_count,
        "quark_links": q_count,
        "categories": sorted({m.get("category", "") for m in all_data}),
    }
    with open(OUTPUT_DIR / "summary.json", "w", encoding="utf-8") as f:
        json.dump(summary, f, ensure_ascii=False, indent=2)
    print(f"\n[✓] 全部抓取完成！输出目录：{OUTPUT_DIR.resolve()}")
    print(f"    影片：{summary['movies_total']} 部 | 下载链接：{total_links} 条 "
          f"(磁力 {mag_count} / 夸克 {q_count})")


# ---------- 入口 ----------
def main():
    parser = argparse.ArgumentParser(description="pomo.mom 全站爬虫（含下载链接提取）")
    parser.add_argument("--pages", type=int, default=None,
                        help="每个分类最多抓多少页（不指定则抓全部分页）")
    parser.add_argument("--only-home", action="store_true",
                        help="只抓首页（不抓其他分类）")
    parser.add_argument("--delay", type=float, default=1.0,
                        help="请求间隔秒数（默认1秒，防止被封）")
    parser.add_argument("--workers", type=int, default=8,
                        help="详情页并发线程数（默认8）")
    parser.add_argument("--resume", action="store_true",
                        help="断点续抓：从已有 pomo_all_movies.json 中跳过已完成的 id")
    args = parser.parse_args()

    s = session()
    # 先访问首页拿 cookie
    fetch(s, BASE_URL + "/")
    time.sleep(0.5)

    cats = {"首页": "/"} if args.only_home else CATEGORIES

    # Step 1: 收集所有列表页中的影片条目
    all_movies: dict[int, dict] = {}
    for name, path in cats.items():
        if name == "直播" or name == "求片":
            continue
        mlist = crawl_category(name, path, s, args.pages, args.delay)
        for m in mlist:
            if m["id"] not in all_movies:
                all_movies[m["id"]] = m
        time.sleep(args.delay)

    movie_list = list(all_movies.values())
    print(f"\n[列表完成] 共收集到 {len(movie_list)} 部影片，开始抓取详情页...")

    # 断点续抓
    done_ids: set[int] = set()
    if args.resume:
        jf = OUTPUT_DIR / "pomo_all_movies.json"
        if jf.exists():
            try:
                existed = json.load(open(jf, encoding="utf-8"))
                for mv in existed:
                    if mv.get("downloads"):
                        done_ids.add(mv["id"])
                print(f"[断点续抓] 已完成 {len(done_ids)} 部，继续剩余 {len(movie_list)-len(done_ids)} 部")
            except Exception as e:
                print(f"[!] 读取断点失败: {e}")

    todo = [m for m in movie_list if m["id"] not in done_ids]
    results: list[dict] = []
    if args.resume and done_ids:
        jf = OUTPUT_DIR / "pomo_all_movies.json"
        results = json.load(open(jf, encoding="utf-8"))

    # Step 2: 并发抓详情页
    done_cnt = len(done_ids)
    total_cnt = len(movie_list)
    with ThreadPoolExecutor(max_workers=args.workers) as ex:
        futures = {ex.submit(crawl_detail, m, s, args.delay * 0.5): m for m in todo}
        for fut in as_completed(futures):
            m = futures[fut]
            try:
                info = fut.result()
            except Exception as e:
                print(f"  [!] 异常 {m['url']}: {e}")
                info = None
            done_cnt += 1
            if info:
                results.append(info)
                dl_cnt = len(info.get("downloads", []))
                print(f"  [{done_cnt}/{total_cnt}] {info['title'][:40]}  -> {dl_cnt} 条下载链接")
            else:
                print(f"  [{done_cnt}/{total_cnt}] [失败] {m['title'][:40]}")

            # 定期保存（防中断丢失）
            if done_cnt % 50 == 0:
                with open(OUTPUT_DIR / "pomo_all_movies.json", "w", encoding="utf-8") as f:
                    json.dump(results, f, ensure_ascii=False, indent=2)

    # 按 id 排序
    results.sort(key=lambda x: x.get("id", 0), reverse=True)
    save_results(results)


if __name__ == "__main__":
    main()
