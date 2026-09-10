#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
小众技术工具库 (https://www.xiaozhongjishu.com/) 全站爬虫
==========================================================
策略:
  1) 通过 WordPress REST API (wp-json/wp/v2) 抓取所有文章类型的结构化数据
     - sites  (网址导航)  : 611+ 条
     - posts  (文章)      : 9 条
     - pages  (页面)      : 17 条
     - bulletin (公告)    : 2 条
  2) 通过 REST API 获取所有分类、标签（含 OneNav 自定义 taxonomy）
  3) 对每个站点详情页补抓 HTML，提取 REST API 不返回的自定义字段:
     - 外链 URL (btn-visit)
     - 网站图标 / 缩略图
     - 点击量、点赞数、评论数
     - 一句话简介
  4) 支持断点续爬、并发请求、失败重试、限速
  5) 输出 JSON / CSV / Markdown 三种格式

依赖:
  pip install requests beautifulsoup4 lxml

使用:
  python crawler.py                 # 默认全部抓取
  python crawler.py --type sites    # 只抓网址
  python crawler.py --no-detail     # 不抓详情页 (快，但缺外链URL等)
  python crawler.py --workers 8     # 并发数 (默认5)
  python crawler.py --delay 0.5     # 请求间隔秒数 (默认0.3)
  python crawler.py --out output    # 输出目录 (默认 ./output)
"""

import argparse
import csv
import json
import os
import re
import sys
import time
import logging
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime
from urllib.parse import urljoin, urlparse

import requests
from bs4 import BeautifulSoup

# ============================================================
# 配置
# ============================================================
BASE_URL = "https://www.xiaozhongjishu.com"
API_BASE = f"{BASE_URL}/wp-json/wp/v2"

DEFAULT_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/124.0.0.0 Safari/537.36"
    ),
    "Accept": "application/json, text/html, */*",
    "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
    "Referer": BASE_URL + "/",
}

# WordPress 支持的文章类型 -> (API endpoint, 中文名)
POST_TYPES = {
    "sites":    ("sites",    "网址导航"),
    "posts":    ("posts",    "文章"),
    "pages":    ("pages",    "页面"),
    "bulletin": ("bulletin", "公告"),
}

# 分类/标签 taxonomy
TAXONOMIES = {
    "favorites":  "网址分类",
    "sitetag":    "网址标签",
    "category":   "文章分类",
    "post_tag":   "文章标签",
    "apps":       "APP分类",
    "apptag":     "APP标签",
    "books":      "书籍分类",
    "booktag":    "书籍标签",
}

# ============================================================
# 工具函数
# ============================================================
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%H:%M:%S",
)
log = logging.getLogger("xzjs-crawler")


class HttpClient:
    """带重试和限速的 HTTP 客户端"""

    def __init__(self, delay=0.3, timeout=20, max_retries=3):
        self.session = requests.Session()
        self.session.headers.update(DEFAULT_HEADERS)
        self.delay = delay
        self.timeout = timeout
        self.max_retries = max_retries
        self._last_request = 0

    def _throttle(self):
        elapsed = time.time() - self._last_request
        if elapsed < self.delay:
            time.sleep(self.delay - elapsed)
        self._last_request = time.time()

    def get(self, url, **kwargs):
        for attempt in range(1, self.max_retries + 1):
            self._throttle()
            try:
                resp = self.session.get(url, timeout=self.timeout, **kwargs)
                if resp.status_code == 200:
                    return resp
                if resp.status_code == 404:
                    log.warning(f"404: {url}")
                    return None
                log.warning(f"HTTP {resp.status_code} (attempt {attempt}/{self.max_retries}): {url}")
            except requests.RequestException as e:
                log.warning(f"Request error (attempt {attempt}/{self.max_retries}): {e}")
            if attempt < self.max_retries:
                time.sleep(1.5 * attempt)
        return None


def html_to_text(html):
    """HTML 转纯文本"""
    if not html:
        return ""
    soup = BeautifulSoup(html, "lxml")
    for tag in soup(["script", "style"]):
        tag.decompose()
    text = soup.get_text(separator="\n")
    lines = [ln.strip() for ln in text.splitlines() if ln.strip()]
    return "\n".join(lines)


def clean_text(s):
    if not s:
        return ""
    return re.sub(r"\s+", " ", s).strip()


# ============================================================
# API 抓取
# ============================================================
def fetch_total_pages(client, endpoint, per_page=100):
    """获取某 endpoint 的总条数和总页数"""
    url = f"{API_BASE}/{endpoint}?per_page={per_page}&page=1"
    resp = client.get(url)
    if resp is None:
        return 0, 0
    total = int(resp.headers.get("X-WP-Total", "0"))
    total_pages = int(resp.headers.get("X-WP-TotalPages", "1"))
    return total, total_pages


def fetch_paginated_api(client, endpoint, per_page=100):
    """分页抓取 API 全部数据"""
    total, total_pages = fetch_total_pages(client, endpoint, per_page)
    log.info(f"  → {endpoint}: 共 {total} 条, {total_pages} 页")
    items = []
    for page in range(1, total_pages + 1):
        url = f"{API_BASE}/{endpoint}?per_page={per_page}&page={page}"
        if endpoint in ("sites",):
            # _embed 获取关联信息
            url += "&_embed"
        resp = client.get(url)
        if resp is None:
            log.error(f"  第 {page} 页失败，跳过")
            continue
        try:
            data = resp.json()
            if isinstance(data, list):
                items.extend(data)
            else:
                log.warning(f"  第 {page} 页返回非列表")
        except json.JSONDecodeError:
            log.error(f"  第 {page} 页 JSON 解析失败")
    return items


def fetch_detail_page(client, url):
    """抓取详情页 HTML，提取外链URL、图片、点击量、简介等"""
    resp = client.get(url)
    if resp is None:
        return {}
    html = resp.text
    soup = BeautifulSoup(html, "lxml")

    result = {}

    # 1) 外链访问链接
    btn_visit = soup.select_one("a.btn-visit")
    if btn_visit and btn_visit.get("href"):
        result["external_url"] = btn_visit["href"].strip()

    # 2) 网站图标
    icon_img = soup.select_one(".site-header-icon img.site-icon")
    if icon_img:
        src = icon_img.get("data-src") or icon_img.get("src")
        if src:
            result["icon"] = src.strip()

    # 3) 一句话简介
    desc_p = soup.select_one("p.site-description")
    if desc_p:
        result["excerpt_short"] = clean_text(desc_p.get_text())

    # 4) 统计数据: 点击 / 点赞 / 评论
    for stat in soup.select(".stat-item"):
        text = clean_text(stat.get_text())
        if "次点击" in stat.get("title", "") or "icon-chakan" in str(stat):
            sp = stat.select_one("span")
            if sp:
                try:
                    result["views"] = int(sp.get_text().replace(",", "").strip())
                except ValueError:
                    pass
        btn = stat.select_one("button.btn-like")
        if btn:
            lc = stat.select_one("span.like-count")
            if lc:
                try:
                    result["likes"] = int(lc.get_text().strip())
                except ValueError:
                    result["likes"] = 0
        if "icon-comment" in str(stat):
            sp = stat.select_one("span")
            if sp:
                try:
                    result["comments_count"] = int(sp.get_text().strip())
                except ValueError:
                    pass

    # 5) og:image 作为封面图
    og_img = soup.find("meta", property="og:image")
    if og_img and og_img.get("content"):
        result["og_image"] = og_img["content"].strip()

    # 6) 从 meta description 取长描述
    meta_desc = soup.find("meta", attrs={"name": "description"})
    if meta_desc and meta_desc.get("content"):
        result["meta_description"] = meta_desc["content"].strip()

    # 7) 文章内所有外链
    external_links = []
    content_area = soup.select_one(".content-area") or soup.select_one(".entry-content") or soup
    for a in content_area.select("a[href]"):
        href = a["href"].strip()
        if href.startswith("http") and "xiaozhongjishu.com" not in href:
            external_links.append({"text": clean_text(a.get_text()), "url": href})
    if external_links:
        result["content_external_links"] = external_links

    # 8) 正文内图片
    images = []
    for img in content_area.select("img[src]"):
        src = img.get("data-src") or img.get("src")
        if src and "xiaozhongjishu.com" in src:
            images.append({
                "src": src,
                "alt": img.get("alt", ""),
            })
    if images:
        result["content_images"] = images

    return result


# ============================================================
# 数据规范化
# ============================================================
def normalize_post(item, post_type):
    """把 API 返回的原始对象统一成干净的 dict"""
    title = item.get("title", {}).get("rendered", "") or ""
    title = clean_text(BeautifulSoup(title, "lxml").get_text())

    content_html = item.get("content", {}).get("rendered", "") or ""
    content_text = html_to_text(content_html)

    excerpt_html = item.get("excerpt", {}).get("rendered", "" ) if "excerpt" in item else ""
    excerpt_text = html_to_text(excerpt_html) if excerpt_html else ""

    out = {
        "id": item.get("id"),
        "type": post_type,
        "title": title,
        "slug": item.get("slug", ""),
        "url": item.get("link", ""),
        "date": item.get("date", ""),
        "modified": item.get("modified", ""),
        "status": item.get("status", ""),
        "author": item.get("author", ""),
        "content_html": content_html,
        "content_text": content_text,
        "excerpt": excerpt_text,
        "comment_status": item.get("comment_status", ""),
    }

    # taxonomy
    for tax in ("favorites", "sitetag", "category", "post_tag",
                "apps", "apptag", "books", "booktag"):
        if tax in item and item[tax]:
            out[tax] = item[tax]

    # _embedded 里的分类/标签名
    embedded = item.get("_embedded", {})
    term_map = {}
    for wp_term in embedded.get("wp:term", []) or []:
        for t in wp_term:
            tax_name = t.get("taxonomy")
            term_map.setdefault(tax_name, []).append({
                "id": t.get("id"),
                "name": t.get("name", ""),
                "slug": t.get("slug", ""),
            })
    if term_map:
        out["terms"] = term_map

    return out


# ============================================================
# 主流程
# ============================================================
def main():
    parser = argparse.ArgumentParser(description="小众技术工具库全站爬虫")
    parser.add_argument("--type", choices=list(POST_TYPES.keys()) + ["all"], default="all", help="抓取类型 (默认 all)")
    parser.add_argument("--no-detail", action="store_true", help="跳过详情页二次抓取 (更快但无外链URL等)")
    parser.add_argument("--workers", type=int, default=5, help="并发线程数 (默认5)")
    parser.add_argument("--delay", type=float, default=0.3, help="请求间隔秒数 (默认0.3)")
    parser.add_argument("--out", default="output", help="输出目录 (默认 ./output)")
    parser.add_argument("--resume", action="store_true", default=True, help="断点续爬 (默认开启)")
    args = parser.parse_args()

    os.makedirs(args.out, exist_ok=True)
    raw_dir = os.path.join(args.out, "raw")
    os.makedirs(raw_dir, exist_ok=True)

    client = HttpClient(delay=args.delay)

    # ---------- 1) 抓分类和标签 ----------
    log.info("=" * 60)
    log.info("Step 1: 抓取分类与标签")
    log.info("=" * 60)
    all_terms = {}
    for tax_key, tax_name in TAXONOMIES.items():
        cache_file = os.path.join(raw_dir, f"tax_{tax_key}.json")
        if args.resume and os.path.exists(cache_file):
            log.info(f"  [缓存] {tax_key} ({tax_name})")
            with open(cache_file, "r", encoding="utf-8") as f:
                all_terms[tax_key] = json.load(f)
            continue
        try:
            items = fetch_paginated_api(client, tax_key, per_page=100)
            all_terms[tax_key] = [
                {"id": t.get("id"), "name": t.get("name"), "slug": t.get("slug"),
                 "count": t.get("count"), "description": t.get("description", ""),
                 "parent": t.get("parent", 0), "link": t.get("link", "")}
                for t in items
            ]
            with open(cache_file, "w", encoding="utf-8") as f:
                json.dump(all_terms[tax_key], f, ensure_ascii=False, indent=2)
        except Exception as e:
            log.warning(f"  {tax_key} 抓取失败: {e}")
            all_terms[tax_key] = []

    with open(os.path.join(args.out, "taxonomies.json"), "w", encoding="utf-8") as f:
        json.dump(all_terms, f, ensure_ascii=False, indent=2)

    # ---------- 2) 确定要抓取的 post types ----------
    if args.type == "all":
        types_to_fetch = list(POST_TYPES.keys())
    else:
        types_to_fetch = [args.type]

    all_posts = {}
    for pt in types_to_fetch:
        endpoint, cn_name = POST_TYPES[pt]
        log.info("=" * 60)
        log.info(f"Step 2.{pt}: 抓取 {cn_name} ({endpoint})")
        log.info("=" * 60)
        cache_file = os.path.join(raw_dir, f"type_{pt}.json")
        if args.resume and os.path.exists(cache_file):
            log.info(f"  [缓存] 读取 {pt} 列表")
            with open(cache_file, "r", encoding="utf-8") as f:
                raw_items = json.load(f)
        else:
            raw_items = fetch_paginated_api(client, endpoint, per_page=100)
            with open(cache_file, "w", encoding="utf-8") as f:
                json.dump(raw_items, f, ensure_ascii=False, indent=2)

        posts = [normalize_post(it, pt) for it in raw_items]
        all_posts[pt] = posts
        log.info(f"  → 获取 {len(posts)} 条 {cn_name}")

    # ---------- 3) 对 sites 类型补抓详情页 (提取外链URL等) ----------
    if "sites" in all_posts and not args.no_detail:
        log.info("=" * 60)
        log.info(f"Step 3: 抓取 {len(all_posts['sites'])} 个站点详情页 (并发={args.workers})")
        log.info("=" * 60)
        detail_cache_file = os.path.join(raw_dir, "sites_detail.json")
        detail_map = {}
        if args.resume and os.path.exists(detail_cache_file):
            with open(detail_cache_file, "r", encoding="utf-8") as f:
                detail_map = json.load(f)
            log.info(f"  [缓存] 已有 {len(detail_map)} 条详情")

        todo = [(p["id"], p["url"]) for p in all_posts["sites"] if str(p["id"]) not in detail_map]
        log.info(f"  待抓取: {len(todo)} 条")

        done_count = 0
        if todo:
            with ThreadPoolExecutor(max_workers=args.workers) as ex:
                futures = {ex.submit(fetch_detail_page, client, url): (pid, url) for pid, url in todo}
                for fut in as_completed(futures):
                    pid, url = futures[fut]
                    try:
                        detail = fut.result()
                    except Exception as e:
                        log.error(f"  详情失败 [{pid}]: {e}")
                        detail = {}
                    detail_map[str(pid)] = detail
                    done_count += 1
                    if done_count % 20 == 0 or done_count == len(todo):
                        log.info(f"  进度: {done_count}/{len(todo)}")
                        # 定期保存
                        with open(detail_cache_file, "w", encoding="utf-8") as f:
                            json.dump(detail_map, f, ensure_ascii=False, indent=2)

            with open(detail_cache_file, "w", encoding="utf-8") as f:
                json.dump(detail_map, f, ensure_ascii=False, indent=2)

        # 合并详情到 posts
        for p in all_posts["sites"]:
            d = detail_map.get(str(p["id"]), {})
            for k, v in d.items():
                p[k] = v

    # ---------- 4) 保存最终数据 ----------
    log.info("=" * 60)
    log.info("Step 4: 导出结果")
    log.info("=" * 60)

    # 统一 JSON
    final_data = {
        "meta": {
            "site": BASE_URL,
            "site_name": "小众技术工具库",
            "crawled_at": datetime.now().isoformat(),
            "counts": {pt: len(all_posts.get(pt, [])) for pt in POST_TYPES},
            "taxonomy_counts": {tk: len(all_terms.get(tk, [])) for tk in TAXONOMIES},
        },
        "taxonomies": all_terms,
    }
    for pt, posts in all_posts.items():
        final_data[pt] = posts

    json_path = os.path.join(args.out, "xiaozhongjishu_full.json")
    with open(json_path, "w", encoding="utf-8") as f:
        json.dump(final_data, f, ensure_ascii=False, indent=2)
    log.info(f"  ✓ JSON: {json_path}")

    # CSV (仅 sites，含关键字段)
    if "sites" in all_posts:
        csv_path = os.path.join(args.out, "sites.csv")
        fields = [
            "id", "title", "external_url", "url", "excerpt_short",
            "meta_description", "icon", "og_image",
            "views", "likes", "comments_count",
            "date", "modified", "categories", "tags",
        ]
        with open(csv_path, "w", encoding="utf-8-sig", newline="") as f:
            w = csv.DictWriter(f, fieldnames=fields, extrasaction="ignore")
            w.writeheader()
            for p in all_posts["sites"]:
                row = dict(p)
                # 把 terms 里的分类/标签拍平
                terms = p.get("terms", {})
                row["categories"] = " | ".join(t["name"] for t in terms.get("favorites", []))
                row["tags"] = " | ".join(t["name"] for t in terms.get("sitetag", []))
                w.writerow(row)
        log.info(f"  ✓ CSV : {csv_path} (共 {len(all_posts['sites'])} 条网址)")

    # Markdown 导航
    md_path = os.path.join(args.out, "README.md")
    with open(md_path, "w", encoding="utf-8") as f:
        f.write(f"# 小众技术工具库 - 全站数据导出\n\n")
        f.write(f"- 来源: {BASE_URL}\n")
        f.write(f"- 抓取时间: {final_data['meta']['crawled_at']}\n\n")
        f.write(f"## 数据概览\n\n")
        f.write(f"| 类型 | 数量 |\n|------|------|\n")
        for k, v in final_data["meta"]["counts"].items():
            f.write(f"| {POST_TYPES[k][1]} ({k}) | {v} |\n")
        f.write(f"\n## 分类统计\n\n")
        f.write(f"| 分类体系 | 数量 |\n|----------|------|\n")
        for k, v in final_data["meta"]["taxonomy_counts"].items():
            f.write(f"| {TAXONOMIES.get(k,k)} | {v} |\n")
        if "sites" in all_posts:
            f.write(f"\n## 网址一览 (共 {len(all_posts['sites'])} 条)\n\n")
            # 按分类分组
            cat_groups = {}
            no_cat = []
            for p in all_posts["sites"]:
                terms = p.get("terms", {}).get("favorites", [])
                if terms:
                    for t in terms:
                        cat_groups.setdefault(t["name"], []).append(p)
                else:
                    no_cat.append(p)
            for cat, items in sorted(cat_groups.items(), key=lambda x: -len(x[1])):
                f.write(f"\n### {cat} ({len(items)})\n\n")
                for it in items:
                    ext = it.get("external_url", "")
                    link = ext or it.get("url", "")
                    desc = it.get("excerpt_short") or it.get("meta_description", "")
                    if len(desc) > 80:
                        desc = desc[:80] + "…"
                    f.write(f"- [{it['title']}]({link})")
                    if desc:
                        f.write(f" - {desc}")
                    f.write("\n")
            if no_cat:
                f.write(f"\n### 未分类 ({len(no_cat)})\n\n")
                for it in no_cat:
                    link = it.get("external_url") or it.get("url", "")
                    f.write(f"- [{it['title']}]({link})\n")
    log.info(f"  ✓ MD  : {md_path}")

    # ---------- 5) 简单摘要 ----------
    log.info("=" * 60)
    log.info("抓取完成 ✓")
    log.info("=" * 60)
    total_sites = len(all_posts.get("sites", []))
    with_ext = sum(1 for p in all_posts.get("sites", []) if p.get("external_url"))
    log.info(f"  网址总数: {total_sites}, 已解析外链URL: {with_ext}")
    log.info(f"  输出目录: {os.path.abspath(args.out)}")


if __name__ == "__main__":
    main()
