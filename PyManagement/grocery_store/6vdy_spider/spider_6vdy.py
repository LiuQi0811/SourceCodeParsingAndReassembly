#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
6vdy.org 全站电影资源抓取爬虫
- 遍历所有分类 -> 所有分页 -> 所有详情页
- 提取影片基本信息 + 磁力链接 + 网盘链接
- 结果保存为 JSON / CSV / 可读 Markdown
- 支持断点续爬、随机 UA、请求间隔、失败重试
"""

import os
import re
import sys
import json
import time
import random
import logging
import csv
from urllib.parse import urljoin, urlparse
from concurrent.futures import ThreadPoolExecutor, as_completed

import requests
from bs4 import BeautifulSoup

# ============ 配置 ============
BASE_URL = "https://www.6vdy.org"
OUTPUT_DIR = "/home/user/11532227387579556634/6vdy_data"
HTML_DIR = os.path.join(OUTPUT_DIR, "html")        # 原始HTML备份
os.makedirs(HTML_DIR, exist_ok=True)

MAX_WORKERS = 3            # 并发线程（不要太大以免被封）
MIN_SLEEP = 0.5
MAX_SLEEP = 1.5
TIMEOUT = 20
MAX_RETRY = 3

# 全站分类（从首页菜单提取）
CATEGORIES = [
    ("xijupian",       "喜剧片"),
    ("dongzuopian",    "动作片"),
    ("aiqingpian",     "爱情片"),
    ("kehuanpian",     "科幻片"),
    ("kongbupian",     "恐怖片"),
    ("juqingpian",     "剧情片"),
    ("zhanzhengpian",  "战争片"),
    ("jilupian",       "纪录片"),
    ("donghuapian",    "动画片"),
    ("dianshiju/guoju",   "国剧"),
    ("dianshiju/duanju",  "短剧"),
    ("dianshiju/rihanju", "日韩剧"),
    ("dianshiju/oumeiju", "欧美剧"),
    ("ZongYi",         "综艺"),
]

USER_AGENTS = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:120.0) Gecko/20100101 Firefox/120.0",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Safari/605.1.15",
]

# ============ 日志 ============
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[
        logging.StreamHandler(sys.stdout),
        logging.FileHandler(os.path.join(OUTPUT_DIR, "spider.log"), encoding="utf-8"),
    ],
)
log = logging.getLogger("6vdy")

# ============ 会话 ============
session = requests.Session()
session.headers.update({
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
    "Connection": "keep-alive",
})

def get_headers(referer=None):
    h = {"User-Agent": random.choice(USER_AGENTS)}
    if referer:
        h["Referer"] = referer
    return h

def fetch(url, referer=BASE_URL):
    """带重试的GET"""
    for i in range(MAX_RETRY):
        try:
            time.sleep(random.uniform(MIN_SLEEP, MAX_SLEEP))
            r = session.get(url, headers=get_headers(referer), timeout=TIMEOUT)
            r.encoding = r.apparent_encoding or "utf-8"
            if r.status_code == 200 and len(r.text) > 1000:
                return r.text
            log.warning(f"状态{r.status_code}或响应过短 {url} (retry {i+1})")
        except Exception as e:
            log.warning(f"请求异常 {url}: {e} (retry {i+1})")
        time.sleep(2 * (i + 1))
    return None

# ============ 分类分页探测 ============
def detect_max_page(cat_path):
    """探测某分类的最大分页"""
    first_url = f"{BASE_URL}/{cat_path}/"
    if cat_path.startswith("dianshiju") or cat_path == "ZongYi":
        first_url = f"{BASE_URL}/{cat_path}/"
    html = fetch(first_url)
    if not html:
        return 1
    # 匹配 index_N.html 形式的最后一页
    pages = re.findall(r'index_(\d+)\.html', html)
    if pages:
        return max(int(p) for p in pages)
    # 没有分页则只有1页
    return 1

# ============ 列表页：提取详情链接 ============
LIST_LINK_RE = re.compile(r'href="(/[^" ]+/\d+\.html)"')

def parse_list_page(cat_path, page):
    if page == 1:
        url = f"{BASE_URL}/{cat_path}/"
    else:
        url = f"{BASE_URL}/{cat_path}/index_{page}.html"
    html = fetch(url)
    if not html:
        return []
    links = set()
    for m in LIST_LINK_RE.findall(html):
        # 仅保留同分类下的详情链接
        if m.startswith(f"/{cat_path.split('/')[0]}/") or cat_path in m:
            full = urljoin(BASE_URL, m)
            if re.search(r'/\d+\.html$', full):
                links.add(full)
    return list(links)

# ============ 详情页：解析资源 ============
def parse_detail(url, category_name):
    html = fetch(url)
    if not html:
        return None
    # 保存原始HTML
    m = re.search(r'/(\d+)\.html', url)
    pid = m.group(1) if m else str(int(time.time() * 1000))
    safe_cat = category_name.replace("/", "_")
    html_path = os.path.join(HTML_DIR, f"{safe_cat}_{pid}.html")
    with open(html_path, "w", encoding="utf-8") as f:
        f.write(html)

    soup = BeautifulSoup(html, "html.parser")

    # 标题：文章区 h1 优先，其次 <title>
    title = ""
    # 尝试在正文区域找 h1/h2
    for sel in ["h1.post-title", "h1.entry-title", "div.post h1", "div.post h2", "article h1"]:
        t = soup.select_one(sel)
        if t:
            title = t.get_text(strip=True)
            break
    if not title:
        # 取页面中最后一个 h1（站点logo是第一个h1，文章标题是第二个）
        h1s = soup.find_all("h1")
        if len(h1s) >= 2:
            title = h1s[-1].get_text(strip=True)
        elif h1s:
            title = h1s[0].get_text(strip=True)
    if not title:
        t = soup.find("title")
        if t:
            title = t.get_text(strip=True).split("-")[0].strip()

    # 正文内容
    post = soup.find("div", id="post_content")
    post_text = post.get_text("\n", strip=True) if post else ""
    post_html = str(post) if post else ""

    # --- 提取所有下载链接 ---
    magnets = []       # 磁力
    thunders = []      # 迅雷
    ed2ks = []         # ed2k
    ftps = []          # ftp
    netdisks = []      # 网盘（夸克/百度/迅雷/阿里/115/UC 等）

    if post:
        # 磁力
        for a in post.find_all("a", href=True):
            href = a["href"].strip()
            text = a.get_text(strip=True)
            if href.startswith("magnet:"):
                magnets.append({"text": text, "url": href})
            elif href.startswith("thunder://"):
                thunders.append({"text": text, "url": href})
            elif href.startswith("ed2k://"):
                ed2ks.append({"text": text, "url": href})
            elif href.startswith("ftp://") or href.startswith("ftps://"):
                ftps.append({"text": text, "url": href})
            else:
                # 网盘
                domain = urlparse(href).netloc.lower()
                if any(k in domain for k in [
                    "pan.quark", "pan.baidu", "pan.xunlei", "aliyundrive",
                    "alipan", "115.com", "drive.uc", "yunpan", "weiyun",
                    "mega.nz", "cloud.189"
                ]):
                    # 从父节点提取提取码（形如 pwd=xxx 或 提取码: xxxx）
                    pwd = ""
                    m_pwd = re.search(r'pwd=([a-zA-Z0-9]{4})', href)
                    if m_pwd:
                        pwd = m_pwd.group(1)
                    else:
                        parent_text = a.parent.get_text(" ", strip=True) if a.parent else ""
                        m_pwd2 = re.search(r'(?:提取码|密码|pwd)[：: ]*\s*([a-zA-Z0-9]{4})', parent_text)
                        if m_pwd2:
                            pwd = m_pwd2.group(1)
                    netdisks.append({
                        "text": text,
                        "url": href,
                        "platform": domain,
                        "pwd": pwd,
                    })

    # 简介（◎开头的元信息）
    meta_info = ""
    if post_text:
        lines = post_text.split("\n")
        meta_lines = []
        for line in lines:
            if line.startswith("◎") or (meta_lines and not line.startswith("【") and not line.startswith("磁力") and not line.startswith("链接") and not line.startswith("http")):
                meta_lines.append(line)
            if "【下载地址】" in line or "下载地址" in line:
                break
        meta_info = "\n".join(meta_lines).strip()

    # 海报
    cover = ""
    if post:
        img = post.find("img")
        if img and img.get("src"):
            cover = img["src"]

    return {
        "id": pid,
        "category": category_name,
        "title": title,
        "cover": cover,
        "url": url,
        "meta": meta_info,
        "magnets": magnets,
        "thunders": thunders,
        "ed2ks": ed2ks,
        "ftps": ftps,
        "netdisks": netdisks,
        "html_path": html_path,
    }

# ============ 主流程 ============
def load_seen():
    seen_path = os.path.join(OUTPUT_DIR, "seen.json")
    if os.path.exists(seen_path):
        with open(seen_path, "r", encoding="utf-8") as f:
            return set(json.load(f))
    return set()

def save_seen(seen):
    with open(os.path.join(OUTPUT_DIR, "seen.json"), "w", encoding="utf-8") as f:
        json.dump(list(seen), f, ensure_ascii=False)

def save_results(results):
    # JSON
    with open(os.path.join(OUTPUT_DIR, "movies.json"), "w", encoding="utf-8") as f:
        json.dump(results, f, ensure_ascii=False, indent=2)
    # CSV（扁平化一行一条链接）
    csv_path = os.path.join(OUTPUT_DIR, "movies.csv")
    with open(csv_path, "w", encoding="utf-8-sig", newline="") as f:
        w = csv.writer(f)
        w.writerow(["标题", "分类", "链接类型", "名称", "链接", "提取码", "详情页"])
        for r in results:
            for item in r["magnets"]:
                w.writerow([r["title"], r["category"], "磁力", item["text"], item["url"], "", r["url"]])
            for item in r["thunders"]:
                w.writerow([r["title"], r["category"], "迅雷", item["text"], item["url"], "", r["url"]])
            for item in r["ed2ks"]:
                w.writerow([r["title"], r["category"], "ED2K", item["text"], item["url"], "", r["url"]])
            for item in r["ftps"]:
                w.writerow([r["title"], r["category"], "FTP", item["text"], item["url"], "", r["url"]])
            for item in r["netdisks"]:
                w.writerow([r["title"], r["category"], f"网盘({item['platform']})", item["text"], item["url"], item["pwd"], r["url"]])
    # Markdown 汇总
    md_path = os.path.join(OUTPUT_DIR, "movies.md")
    with open(md_path, "w", encoding="utf-8") as f:
        f.write(f"# 6v电影 资源汇总（共 {len(results)} 部）\n\n")
        f.write(f"> 数据来源：{BASE_URL}  抓取时间：{time.strftime('%Y-%m-%d %H:%M:%S')}\n\n")
        # 按分类分组
        by_cat = {}
        for r in results:
            by_cat.setdefault(r["category"], []).append(r)
        for cat, items in by_cat.items():
            f.write(f"\n## {cat}（{len(items)}部）\n\n")
            for r in items:
                f.write(f"### {r['title']}\n\n")
                if r["cover"]:
                    f.write(f"![poster]({r['cover']})\n\n")
                f.write(f"- 详情页：{r['url']}\n")
                if r["meta"]:
                    f.write(f"- 简介：\n```\n{r['meta'][:800]}\n```\n")
                if r["magnets"]:
                    f.write(f"- **磁力链接**：\n")
                    for m in r["magnets"]:
                        f.write(f"  - [{m['text']}]({m['url']})\n")
                if r["netdisks"]:
                    f.write(f"- **网盘链接**：\n")
                    for nd in r["netdisks"]:
                        pwd_info = f" 提取码：`{nd['pwd']}`" if nd["pwd"] else ""
                        f.write(f"  - [{nd['platform']}] [{nd['text']}]({nd['url']}){pwd_info}\n")
                f.write("\n")
    log.info(f"结果已保存：{csv_path} / {md_path}")

def main():
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    seen = load_seen()
    results = []

    # 加载已抓取结果（断点续爬）
    result_path = os.path.join(OUTPUT_DIR, "movies.json")
    if os.path.exists(result_path):
        try:
            with open(result_path, "r", encoding="utf-8") as f:
                results = json.load(f)
        except Exception:
            results = []
    log.info(f"已抓取 {len(results)} 条记录，开始继续...")

    # 第一步：收集所有详情页链接
    all_detail_urls = []
    for cat_path, cat_name in CATEGORIES:
        max_page = detect_max_page(cat_path)
        log.info(f"[{cat_name}] 共 {max_page} 页")
        with ThreadPoolExecutor(max_workers=MAX_WORKERS) as ex:
            futures = {ex.submit(parse_list_page, cat_path, p): p for p in range(1, max_page + 1)}
            for fut in as_completed(futures):
                links = fut.result()
                for link in links:
                    if link not in seen:
                        all_detail_urls.append((link, cat_name))
        time.sleep(1)

    # 去重
    all_detail_urls = [(u, c) for u, c in dict.fromkeys((u, c) for u, c in all_detail_urls).keys()]
    log.info(f"待抓取详情页总数：{len(all_detail_urls)}")

    # 第二步：并发抓取详情页
    done = 0
    with ThreadPoolExecutor(max_workers=MAX_WORKERS) as ex:
        futures = {ex.submit(parse_detail, url, cat): (url, cat) for url, cat in all_detail_urls}
        for fut in as_completed(futures):
            url, cat = futures[fut]
            try:
                data = fut.result()
                if data:
                    results.append(data)
                    seen.add(url)
                    done += 1
                    link_count = len(data["magnets"]) + len(data["thunders"]) + len(data["ed2ks"]) + len(data["ftps"]) + len(data["netdisks"])
                    log.info(f"[{done}/{len(all_detail_urls)}] [{cat}] {data['title']} -> {link_count} 条链接")
                else:
                    log.warning(f"解析失败：{url}")
            except Exception as e:
                log.error(f"抓取异常 {url}: {e}")
            # 每 50 条保存一次
            if done % 50 == 0:
                save_results(results)
                save_seen(seen)

    save_results(results)
    save_seen(seen)

    # 统计
    total_magnet = sum(len(r["magnets"]) for r in results)
    total_netdisk = sum(len(r["netdisks"]) for r in results)
    total_thunder = sum(len(r["thunders"]) for r in results)
    total_ed2k = sum(len(r["ed2ks"]) for r in results)
    log.info("=" * 50)
    log.info(f"抓取完成！共 {len(results)} 部影片")
    log.info(f"  磁力链接：{total_magnet} 条")
    log.info(f"  网盘链接：{total_netdisk} 条")
    log.info(f"  迅雷链  ：{total_thunder} 条")
    log.info(f"  ED2K    ：{total_ed2k} 条")
    log.info(f"输出目录：{OUTPUT_DIR}")

if __name__ == "__main__":
    main()
