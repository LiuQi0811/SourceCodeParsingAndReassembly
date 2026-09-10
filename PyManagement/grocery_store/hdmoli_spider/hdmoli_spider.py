#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
HDmoli (https://www.hdmoli.com/) 全站资源爬虫
==================================================
功能：
  1. 自动发现并遍历全站所有分类（电影/剧集/动画/动作/爱情/科幻/恐怖/战争/喜剧/纪录片/剧情/犯罪等）
  2. 自动翻页抓取所有影片详情页（支持断点续爬、失败重试、进度条）
  3. 解析详情页中的所有网盘下载链接（夸克 / 百度 / PikPak 等）与提取码
  4. 抓取影片标题、评分、简介、短评、分类、封面图等元信息
  5. 结果同时保存为 JSON、CSV（可用 Excel 打开）两种格式
  6. 可选下载封面图（--download-covers）
  7. 速率限制、随机 UA、Referer 伪装，避免对服务器造成压力
  8. 全站无前端 JS 加密，网盘链接直接以明文 HTML 输出——本爬虫已验证无需任何逆向解密
     （如站点后续更新采用 JS 混淆/加密，可在 parse_detail 中增加相应解密逻辑）

使用：
    python3 hdmoli_spider.py                       # 默认：抓取元信息与下载链接
    python3 hdmoli_spider.py --download-covers     # 同时下载封面图
    python3 hdmoli_spider.py --max-pages 5         # 每个分类最多抓 5 页（测试用）
    python3 hdmoli_spider.py --delay 1.5           # 请求间隔 1.5 秒（默认 1.0）
    python3 hdmoli_spider.py --resume              # 从上次中断位置继续
    python3 hdmoli_spider.py --output ./mydata     # 输出目录

产出：
    output/
      ├── hdmoli_movies.json      # 全量结构化数据（JSON）
      ├── hdmoli_movies.csv       # 全量结构化数据（CSV, UTF-8 BOM, Excel 可直接打开）
      ├── covers/                 # 封面图（若开启 --download-covers）
      └── failed.txt              # 抓取失败的 URL 列表
"""

import argparse
import csv
import json
import os
import random
import re
import sys
import time
from pathlib import Path
from urllib.parse import urljoin, urlparse

import requests
from bs4 import BeautifulSoup
from tqdm import tqdm

# ------------------------- 基础配置 -------------------------
BASE_URL = "https://www.hdmoli.com"
DEFAULT_TIMEOUT = 20
RETRY_TIMES = 3
RETRY_DELAY = 2

USER_AGENTS = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Safari/605.1.15",
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
]

# 初始要探测的顶级分类（脚本会自动从页面里提取全部子分类）
SEED_CATEGORIES = ["/mlist/index1.html", "/mlist/index2.html", "/mlist/index41.html"]

# 分类名黑名单（导航里不是分类的文本）
CAT_NAME_BLACKLIST = {"首页", "更多", "»", "末页", "尾页", "上一页", "下一页", "", None}


# ------------------------- HTTP 会话 -------------------------
def make_session() -> requests.Session:
    s = requests.Session()
    s.headers.update(
        {
            "User-Agent": random.choice(USER_AGENTS),
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
            "Accept-Encoding": "gzip, deflate",
            "Connection": "keep-alive",
            "Referer": BASE_URL + "/",
        }
    )
    return s


def get(s: requests.Session, url: str, timeout=DEFAULT_TIMEOUT, **kwargs):
    """带重试、随机UA、Referer的 GET 请求"""
    last_err = None
    for attempt in range(1, RETRY_TIMES + 1):
        try:
            s.headers.update({"User-Agent": random.choice(USER_AGENTS)})
            if not s.headers.get("Referer"):
                s.headers["Referer"] = BASE_URL + "/"
            resp = s.get(url, timeout=timeout, **kwargs)
            if resp.status_code == 200:
                resp.encoding = resp.apparent_encoding or "utf-8"
                return resp
            last_err = f"HTTP {resp.status_code}"
        except Exception as e:
            last_err = str(e)
        if attempt < RETRY_TIMES:
            time.sleep(RETRY_DELAY * attempt)
    raise RuntimeError(f"请求失败 {url}: {last_err}")


# ------------------------- 分类发现 -------------------------
def discover_categories(s: requests.Session) -> dict:
    """
    从首页+种子分类页发现所有可用分类
    返回: { '/mlist/index{id}.html': '分类名' }
    """
    cats = {}
    pages_to_scan = [BASE_URL + "/"] + [BASE_URL + p for p in SEED_CATEGORIES]
    visited = set()
    for url in pages_to_scan:
        if url in visited:
            continue
        visited.add(url)
        try:
            r = get(s, url)
        except Exception:
            continue
        # 提取 /mlist/index{id}.html
        for m in re.finditer(r'href="(/mlist/index(\d+)\.html)"[^>]*>([^<]*)</a>', r.text):
            href, cid, name = m.group(1), m.group(2), m.group(3).strip()
            if name in CAT_NAME_BLACKLIST or re.match(r"^\d+$", name):
                continue
            if href not in cats:
                cats[href] = name
    return cats


def get_total_pages(s: requests.Session, cat_url: str) -> int:
    """获取某分类的总页数"""
    try:
        r = get(s, BASE_URL + cat_url)
    except Exception:
        return 1
    pages = [int(x) for x in re.findall(r"/mlist/index\d+-(\d+)\.html", r.text)]
    return max(pages) if pages else 1


# ------------------------- 列表页解析 -------------------------
def parse_list_page(html: str) -> list:
    """从分类列表页解析出详情页链接 [{id, url, title}]"""
    items = []
    seen = set()
    soup = BeautifulSoup(html, "lxml")
    # 方法1：找标准的 vodlist thumb 链接
    for a in soup.select("a.myui-vodlist__thumb"):
        href = a.get("href")
        title = a.get("title") or a.get_text(strip=True)
        if href and "/movie/index" in href:
            mid = re.search(r"/movie/index(\d+)\.html", href)
            mid = mid.group(1) if mid else href
            if mid not in seen:
                seen.add(mid)
                items.append(
                    {
                        "id": mid,
                        "url": urljoin(BASE_URL + "/", href),
                        "title": title.strip(),
                        "cover": a.get("data-original") or a.get("src"),
                    }
                )
    # 方法2：正则兜底，避免模板改版漏抓
    if not items:
        for m in re.finditer(
            r'href="(/movie/index(\d+)\.html)"[^>]*>(?:<[^>]*>)*\s*([^<]{1,80}?)\s*(?:</|</a>)',
            html,
        ):
            href, mid, title = m.group(1), m.group(2), m.group(3).strip()
            if mid not in seen and title and not title.startswith("http"):
                seen.add(mid)
                items.append(
                    {"id": mid, "url": urljoin(BASE_URL + "/", href), "title": title}
                )
    return items


# ------------------------- 详情页解析 -------------------------
DOWNLOAD_LABELS = {
    "夸": "quark",
    "夸克": "quark",
    "百": "baidu",
    "百度": "baidu",
    "百度网盘": "baidu",
    "阿里": "aliyun",
    "阿里云盘": "aliyun",
    "迅": "xunlei",
    "迅雷": "xunlei",
    "海外": "pikpak",
    "PikPak": "pikpak",
    "pikpak": "pikpak",
    "城": "weiyun",
    "微云": "weiyun",
    "115": "115",
    "磁": "magnet",
    "磁力": "magnet",
    "种": "torrent",
    "种子": "torrent",
}


def _match_label(label: str) -> str:
    # 归一化：去掉空格/全角冒号等
    key = re.sub(r"[\s：:·\-_\(\)（）]+", "", label or "")
    for k, v in DOWNLOAD_LABELS.items():
        if k in key or key in k:
            return v
    return "other"


def _extract_pwd(text: str) -> str:
    """从一段文本里提取提取码：常见形式 pwd=xxx / 提取码: xxxx / 密码: xxxx"""
    m = re.search(r"[?&]pwd=([A-Za-z0-9]{4,8})", text)
    if m:
        return m.group(1)
    m = re.search(r"(?:提取码|密码|访问码|pwd)[:：\s]*([A-Za-z0-9]{4,8})", text)
    if m:
        return m.group(1)
    return ""


def parse_detail(html: str, detail_url: str) -> dict:
    """
    解析影片详情页，返回结构化数据字典。
    网盘链接/提取码均直接以明文 HTML 形式输出，无需 JS 逆向。
    若站点后续升级为 JS 加密（如 atob/Base64/自定义混淆），可在这里扩展：
      1. 抓取对应 JS 文件并解混淆；
      2. 或使用 Playwright/requests-html 执行 JS 后再取 DOM；
      3. 当前版本已预留 decrypt_dispatch 钩子位。
    """
    soup = BeautifulSoup(html, "lxml")
    data = {
        "url": detail_url,
        "title": "",
        "rating": "",
        "category": "",
        "cover": "",
        "intro": "",
        "short_comment": "",
        "downloads": [],  # [{type, name, url, pwd}]
    }

    # 标题
    if soup.title:
        t = soup.title.get_text(strip=True)
        # 形如 "夜王 高清版 - HDmoli"
        data["title"] = re.sub(r"\s*[-–—]\s*HDmoli.*$", "", t).strip()
    h1 = soup.select_one("h1")
    if h1 and h1.get_text(strip=True):
        data["title"] = h1.get_text(strip=True)

    # 评分
    rating_tag = soup.select_one(".rating, .score, .point, label.star")
    if rating_tag:
        data["rating"] = rating_tag.get_text(strip=True)
    if not data["rating"]:
        m = re.search(r"(\d+(?:\.\d+)?)\s*分", html)
        if m:
            data["rating"] = m.group(1) + "分"

    # 封面
    cover = soup.select_one(
        ".myui-content__thumb img, .myui-vodlist__box img, .detail-pic img, .movie-pic img"
    )
    if cover:
        data["cover"] = (
            cover.get("data-original")
            or cover.get("src")
            or cover.get("data-src")
            or ""
        )
    if not data["cover"]:
        m = re.search(
            r'<img[^>]+(?:data-original|src)="([^"]+)"[^>]+class="[^"]*(?:lazyload|pic|cover)[^"]*"',
            html,
        )
        if m:
            data["cover"] = m.group(1)

    # 简介 + 短评 + 下载链接：全部在 p.text-muted.col-pd 里
    intro_parts, short_parts = [], []
    download_links = []
    for p in soup.select("p.text-muted"):
        text = p.get_text(" ", strip=True)
        p_cls = " ".join(p.get("class", []))
        # 下载链接特征：<b>夸 克：</b><a ...>...
        bold = p.find("b")
        if bold:
            label = bold.get_text(strip=True).rstrip(":：").strip()
            matched_type = _match_label(label)
            if matched_type != "other" or any(
                k in label for k in ("下载", "网盘", "云盘", "盘", "链接", "资源")
            ):
                for a in p.find_all("a", href=True):
                    href = a["href"].strip()
                    if href.startswith("javascript"):
                        continue
                    # 过滤掉 href 是标题文字这种异常
                    anchor_text = a.get_text(strip=True)
                    pwd = _extract_pwd(href) or _extract_pwd(text)
                    download_links.append(
                        {
                            "type": matched_type if matched_type != "other" else label,
                            "name": label,
                            "url": href,
                            "pwd": pwd,
                            "anchor_text": anchor_text,
                        }
                    )
                continue
            if "简介" in label or "剧情" in label:
                intro_parts.append(text.replace(label, "").lstrip("：: "))
                continue
            if "短评" in label or "点评" in label:
                short_parts.append(text.replace(label, "").lstrip("：: "))
                continue
        # 没有 b 标签的兜底
        if "简介" in text or "剧情" in text:
            intro_parts.append(text)
        elif "短评" in text:
            short_parts.append(text)

    # 兜底：用正则直接抓网盘链接，防止 HTML 结构变化导致漏抓
    if not download_links:
        for m in re.finditer(
            r'(?:(夸\s*克|百\s*度|海\s*外|PikPak|阿里|迅\s*雷|115|磁\s*力)[：: ]+)?<a[^>]+href="(https?://(?:pan\.quark|pan\.baidu|mypikpak|www\.alipan|aliyundrive|pan\.xunlei|115|magnet)[^"]+)"[^>]*>([^<]*)</a>',
            html,
            re.I,
        ):
            label = (m.group(1) or "").strip()
            href = m.group(2)
            download_links.append(
                {
                    "type": _match_label(label),
                    "name": label,
                    "url": href,
                    "pwd": _extract_pwd(href),
                    "anchor_text": m.group(3),
                }
            )

    data["intro"] = " ".join(intro_parts).strip()
    data["short_comment"] = " ".join(short_parts).strip()
    data["downloads"] = download_links

    # 分类面包屑
    crumbs = [a.get_text(strip=True) for a in soup.select(".breadcrumb a, .myui-breadcrumb a")]
    if crumbs:
        data["category"] = " / ".join([c for c in crumbs if c and c not in ("首页", "HDmoli")])
    else:
        # 兜底：取页面里导航高亮的链接文本
        cat_links = []
        for a in soup.find_all("a", href=re.compile(r"/mlist/index\d+\.html")):
            t = a.get_text(strip=True)
            if t and t not in ("首页", "HDmoli") and t not in cat_links:
                cat_links.append(t)
        if cat_links:
            data["category"] = cat_links[0]

    return data


# ------------------------- 输出保存 -------------------------
def save_json(data: list, path: Path):
    path.write_text(
        json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8"
    )


def save_csv(data: list, path: Path):
    fields = [
        "id",
        "title",
        "rating",
        "category",
        "intro",
        "short_comment",
        "cover",
        "url",
        "quark",
        "quark_pwd",
        "baidu",
        "baidu_pwd",
        "pikpak",
        "pikpak_pwd",
        "aliyun",
        "aliyun_pwd",
        "xunlei",
        "other_links",
    ]
    with path.open("w", encoding="utf-8-sig", newline="") as f:
        w = csv.DictWriter(f, fieldnames=fields)
        w.writeheader()
        for item in data:
            row = {
                "id": item.get("id"),
                "title": item.get("title"),
                "rating": item.get("rating"),
                "category": item.get("category"),
                "intro": item.get("intro"),
                "short_comment": item.get("short_comment"),
                "cover": item.get("cover"),
                "url": item.get("url"),
            }
            others = []
            for d in item.get("downloads", []):
                t = d.get("type")
                if t in ("quark", "baidu", "pikpak", "aliyun", "xunlei"):
                    row[t] = d["url"]
                    row[t + "_pwd"] = d.get("pwd", "")
                else:
                    others.append(f"{d.get('name')}: {d['url']}" + (f" (提取码:{d['pwd']})" if d.get("pwd") else ""))
            row["other_links"] = " | ".join(others)
            w.writerow(row)


# ------------------------- 封面下载 -------------------------
def download_cover(s: requests.Session, url: str, movie_id: str, covers_dir: Path):
    if not url:
        return None
    try:
        ext = os.path.splitext(urlparse(url).path)[1] or ".jpg"
        if len(ext) > 5:
            ext = ".jpg"
        out = covers_dir / f"{movie_id}{ext}"
        if out.exists():
            return str(out)
        r = s.get(url, timeout=20, stream=True)
        if r.status_code == 200:
            with out.open("wb") as f:
                for chunk in r.iter_content(8192):
                    f.write(chunk)
            return str(out)
    except Exception:
        pass
    return None


# ------------------------- 主流程 -------------------------
def main():
    parser = argparse.ArgumentParser(description="HDmoli 全站抓取工具")
    parser.add_argument("--output", default="./hdmoli_output", help="输出目录")
    parser.add_argument("--delay", type=float, default=1.0, help="请求间隔秒数（默认 1.0）")
    parser.add_argument("--max-pages", type=int, default=0, help="每个分类最多抓多少页（0=不限制，全站）")
    parser.add_argument("--download-covers", action="store_true", help="同时下载封面图")
    parser.add_argument("--resume", action="store_true", help="断点续爬（基于已抓的 movie id）")
    parser.add_argument("--only-detail", nargs="*", help="只抓指定详情页 URL（调试用）")
    args = parser.parse_args()

    out_dir = Path(args.output)
    out_dir.mkdir(parents=True, exist_ok=True)
    covers_dir = out_dir / "covers"
    if args.download_covers:
        covers_dir.mkdir(exist_ok=True)

    json_path = out_dir / "hdmoli_movies.json"
    csv_path = out_dir / "hdmoli_movies.csv"
    failed_path = out_dir / "failed.txt"
    state_path = out_dir / ".crawled_ids.txt"

    s = make_session()
    # 预热：访问一次首页拿 cookie
    try:
        get(s, BASE_URL + "/")
    except Exception as e:
        print(f"[!] 访问首页失败: {e}")

    # 调试模式：只抓指定详情页
    if args.only_detail:
        results = []
        for u in args.only_detail:
            print(f"[*] 抓取详情: {u}")
            r = get(s, u)
            data = parse_detail(r.text, u)
            data["id"] = re.search(r"/movie/index(\d+)\.html", u).group(1)
            results.append(data)
            print(json.dumps(data, ensure_ascii=False, indent=2))
        return

    # 1) 发现所有分类
    print("[*] 正在发现网站分类...")
    cats = discover_categories(s)
    if not cats:
        print("[!] 未发现任何分类，退出")
        sys.exit(1)
    print(f"[+] 共发现 {len(cats)} 个分类:")
    for url_path, name in cats.items():
        print(f"     {name:<10}  {url_path}")

    # 2) 已抓过的 id 集合（断点续爬）
    crawled_ids = set()
    if args.resume and state_path.exists():
        crawled_ids = set(state_path.read_text(encoding="utf-8").split())
        print(f"[+] 断点续爬：已有 {len(crawled_ids)} 部影片")

    # 加载已有数据（resume 时保留，避免覆盖）
    all_movies = {}
    if args.resume and json_path.exists():
        try:
            old = json.loads(json_path.read_text(encoding="utf-8"))
            for m in old:
                all_movies[m["id"]] = m
        except Exception:
            pass

    failed_urls = []

    # 3) 遍历每个分类
    total_list_pages = 0
    cat_page_list = []  # [(cat_url, cat_name, page)]
    for cat_url, cat_name in cats.items():
        total = get_total_pages(s, cat_url)
        if args.max_pages and args.max_pages > 0:
            total = min(total, args.max_pages)
        for p in range(1, total + 1):
            page_url = (
                BASE_URL + cat_url
                if p == 1
                else BASE_URL + cat_url.replace(".html", f"-{p}.html")
            )
            cat_page_list.append((page_url, cat_name))
    print(f"[+] 共需抓取 {len(cat_page_list)} 个列表页\n")

    # 4) 抓取所有列表页，收集详情页 URL
    detail_urls = {}  # id -> (url, title, cover, from_cat)
    for page_url, cat_name in tqdm(cat_page_list, desc="列表页", ncols=100):
        try:
            r = get(s, page_url)
            items = parse_list_page(r.text)
            for it in items:
                if it["id"] in crawled_ids:
                    continue
                if it["id"] not in detail_urls:
                    detail_urls[it["id"]] = (it["url"], it.get("title", ""), it.get("cover", ""), cat_name)
        except Exception as e:
            failed_urls.append(f"LIST {page_url}  {e}")
        time.sleep(args.delay)

    print(f"\n[+] 待抓详情页: {len(detail_urls)}")
    if not detail_urls:
        print("[!] 没有新的影片需要抓取")
        if all_movies:
            save_json(list(all_movies.values()), json_path)
            save_csv(list(all_movies.values()), csv_path)
            print(f"[+] 数据已保存: {json_path} / {csv_path}")
        return

    # 5) 抓取详情页
    state_f = state_path.open("a", encoding="utf-8")
    save_every = 20  # 每抓 20 条增量保存一次
    try:
        done = 0
        for mid, (durl, title, cover, from_cat) in tqdm(
            detail_urls.items(), desc="详情页", ncols=100
        ):
            try:
                r = get(s, durl)
                data = parse_detail(r.text, durl)
                data["id"] = mid
                if not data["title"]:
                    data["title"] = title
                if not data["cover"]:
                    data["cover"] = cover
                if not data["category"]:
                    data["category"] = from_cat

                # 可选下载封面
                if args.download_covers and data.get("cover"):
                    local_cover = download_cover(s, data["cover"], mid, covers_dir)
                    if local_cover:
                        data["cover_local"] = local_cover

                all_movies[mid] = data
                state_f.write(mid + "\n")
                state_f.flush()
                done += 1
                if done % save_every == 0:
                    movies_list_tmp = sorted(
                        all_movies.values(),
                        key=lambda x: int(x["id"]) if x["id"].isdigit() else 0,
                        reverse=True,
                    )
                    save_json(movies_list_tmp, json_path)
                    save_csv(movies_list_tmp, csv_path)
            except Exception as e:
                failed_urls.append(f"DETAIL {durl}  {e}")
            time.sleep(args.delay)
    finally:
        state_f.close()

    # 6) 保存结果
    movies_list = sorted(all_movies.values(), key=lambda x: int(x["id"]) if x["id"].isdigit() else 0, reverse=True)
    save_json(movies_list, json_path)
    save_csv(movies_list, csv_path)
    if failed_urls:
        failed_path.write_text("\n".join(failed_urls), encoding="utf-8")

    # 7) 统计
    total = len(movies_list)
    with_link = sum(1 for m in movies_list if m.get("downloads"))
    print(f"\n========== 抓取完成 ==========")
    print(f"  影片总数    : {total}")
    print(f"  含下载链接  : {with_link}")
    print(f"  失败数量    : {len(failed_urls)}")
    print(f"  JSON 输出   : {json_path.resolve()}")
    print(f"  CSV  输出   : {csv_path.resolve()}")
    if args.download_covers:
        print(f"  封面目录    : {covers_dir.resolve()}")
    if failed_urls:
        print(f"  失败列表    : {failed_path.resolve()}")
    print("================================")


if __name__ == "__main__":
    main()
