#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
WMMFLIX (idyclub.com) 全站爬虫
====================================================
站点结构分析（已人工逆向）：
- 系统：基于 phpwind 论坛改造的影视资源站
- 列表页 URL: https://www.idyclub.com/thread-{fid}-{page}
- 详情页 URL: https://www.idyclub.com/read-{tid}
- 渲染方式：服务端渲染 (SSR)，无前端 JS 加密 / 无动态签名 / 无滑块验证码
- 反爬强度：低 —— 仅需控制频率即可，无需 JS 逆向
- 下载链接：游客看到的是 [隐藏] + alert('游客无权查看，请登录')，
            登录后服务端直接输出真实网盘/磁力链接（并非前端解密），
            所以"逆向解密"的本质是带上有效 Cookie。

功能：
  1. 遍历所有板块全部页面（支持配置最大页数）
  2. 抓取影片详情页元信息（标题、年份、导演、主演、类型、IMDb/豆瓣、简介、海报）
  3. 登录态下抓取真实下载链接（夸克/百度/迅雷/UC/115网盘 + 磁力）
  4. 下载海报封面到本地
  5. 断点续爬（已完成的 tid/fid-page 会跳过）
  6. 结果导出为 JSON / CSV 双格式
  7. 内置礼貌爬取延迟，避免被封

使用：
  python idy_crawler.py                # 游客模式，抓全部公开元数据
  python idy_crawler.py --cookie "xxx" # 把浏览器 Cookie 字符串传进来，可抓下载链接
  python idy_crawler.py --max-pages 5  # 每个板块最多抓 5 页（调试用）
"""

import argparse
import csv
import json
import os
import re
import sys
import time
import random
import hashlib
from pathlib import Path
from urllib.parse import urljoin, urlparse

import requests
from bs4 import BeautifulSoup
from concurrent.futures import ThreadPoolExecutor, as_completed

# ========================= 配置 =========================
BASE_URL    = "https://www.idyclub.com"
HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
                  "(KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
    "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
    "Referer": BASE_URL + "/",
    "Connection": "keep-alive",
}

# 站点主板块（已逆向出 fid 映射）
FORUMS = {
    1:  "电影",
    18: "剧集",
    28: "综艺",
    23: "动漫",
    15: "交流",
}

# 电影板块下的子板块（欧美/华语/日本/韩国/亚洲 等）
SUB_FORUMS_MOVIE = {
    5:  "欧美电影",
    6:  "华语电影",
    7:  "日本电影",
    8:  "韩国电影",
    9:  "亚洲电影",
    14: "往期电影",
    26: "专享电影",
}
# 剧板块下的子板块
SUB_FORUMS_TV = {
    19: "欧美剧",
    20: "大陆剧",
    21: "港台剧",
    22: "日剧",
    17: "韩剧",
    25: "泰剧",
    24: "动漫剧集",
    27: "往期剧集",
}
# 综艺板块下的子板块
SUB_FORUMS_VARIETY = {
    29: "大陆综艺",
    30: "日韩综艺",
    31: "港台综艺",
    32: "欧美综艺",
}

ALL_FORUMS = {}
ALL_FORUMS.update(FORUMS)
ALL_FORUMS.update(SUB_FORUMS_MOVIE)
ALL_FORUMS.update(SUB_FORUMS_TV)
ALL_FORUMS.update(SUB_FORUMS_VARIETY)

# 输出目录
OUT_DIR     = Path("output")
IMG_DIR     = OUT_DIR / "posters"
DATA_DIR    = OUT_DIR / "data"
PROGRESS_FILE = DATA_DIR / "progress.json"

# 已完成集合
done_list_pages = set()   # (fid, page)
done_tids       = set()   # tid


# ========================= 工具函数 =========================
def init_dirs():
    OUT_DIR.mkdir(exist_ok=True)
    IMG_DIR.mkdir(parents=True, exist_ok=True)
    DATA_DIR.mkdir(parents=True, exist_ok=True)


def load_progress():
    if PROGRESS_FILE.exists():
        try:
            d = json.loads(PROGRESS_FILE.read_text(encoding="utf-8"))
            done_list_pages.update(tuple(x) for x in d.get("list_pages", []))
            done_tids.update(d.get("tids", []))
            print(f"[断点] 已完成列表页 {len(done_list_pages)}，详情页 {len(done_tids)}")
        except Exception as e:
            print(f"[警告] progress.json 读取失败: {e}")


def save_progress():
    PROGRESS_FILE.write_text(json.dumps({
        "list_pages": list(done_list_pages),
        "tids": list(done_tids),
    }, ensure_ascii=False, indent=2), encoding="utf-8")


def polite_sleep(a=0.8, b=2.0):
    """礼貌爬取延迟"""
    time.sleep(random.uniform(a, b))


def parse_cookie_str(cookie_str: str) -> dict:
    """把浏览器复制出来的 Cookie 字符串解析成 dict"""
    cookies = {}
    if not cookie_str:
        return cookies
    for pair in cookie_str.split(";"):
        pair = pair.strip()
        if "=" in pair:
            k, v = pair.split("=", 1)
            cookies[k.strip()] = v.strip()
    return cookies


def safe_get(session: requests.Session, url: str, encoding="utf-8", retries=3):
    for i in range(retries):
        try:
            resp = session.get(url, timeout=20)
            resp.encoding = encoding
            if resp.status_code == 200:
                return resp.text
            elif resp.status_code == 403:
                print(f"[403] 被拦截了，等待 10s 重试: {url}")
                time.sleep(10)
            else:
                print(f"[HTTP {resp.status_code}] {url}")
        except Exception as e:
            print(f"[请求异常] {url}: {e}")
        time.sleep(2 + i * 2)
    return None


# ========================= 列表页解析 =========================
def parse_list_page(html: str):
    """
    解析列表页，返回:
      - tids: 帖子ID列表
      - max_page: 最大页数
    """
    soup = BeautifulSoup(html, "html.parser")
    tids = []

    # 帖子链接：<a href="/read-83371068">标题</a>
    for a in soup.find_all("a", href=re.compile(r"/read-(\d+)")):
        m = re.search(r"/read-(\d+)", a["href"])
        if m:
            tids.append(int(m.group(1)))

    # 去重保序
    seen = set()
    unique_tids = []
    for t in tids:
        if t not in seen:
            seen.add(t)
            unique_tids.append(t)

    # 最大页数：找所有分页数字
    max_page = 1
    for a in soup.find_all("a", href=re.compile(r"/thread-\d+-(\d+)")):
        m = re.search(r"/thread-\d+-(\d+)", a["href"])
        if m:
            p = int(m.group(1))
            if p > max_page:
                max_page = p

    # 兜底：看页码文本
    for a in soup.find_all("a"):
        t = a.get_text(strip=True)
        if t.isdigit():
            p = int(t)
            if p > max_page:
                max_page = p

    return unique_tids, max_page


# ========================= 详情页解析 =========================
def parse_detail_page(html: str, tid: int):
    """
    解析详情页，返回影片信息 dict。
    已逆向页面结构：
      - 标题:   #info h2 / h2.xiaoshi
      - 海报:   #mainpic img.src
      - 信息:   #info p 依次为 导演/编剧/主演/类型/国家/语言/日期/片长/又名/IMDb/豆瓣
      - 简介:   .editor_content blockquote
      - 下载:   .post_tab_edit_cont li > a ，登录后 href 会变成真实链接，
                游客模式 href="javascript:alert('游客无权查看，请登录');"
    """
    soup = BeautifulSoup(html, "html.parser")
    info = {
        "tid": tid,
        "url": f"{BASE_URL}/read-{tid}",
        "title": "",
        "year": "",
        "poster": "",
        "director": "",
        "writer": "",
        "actors": "",
        "genre": "",
        "country": "",
        "language": "",
        "release_date": "",
        "runtime": "",
        "aka": "",
        "imdb": "",
        "douban": "",
        "douban_rating": "",
        "summary": "",
        "download_links": [],  # [{type, title, uploader, date, link}]
    }

    # ---------- 标题 ----------
    title_tag = soup.select_one("h2.xiaoshi") or soup.select_one("#info h2")
    if title_tag:
        raw = title_tag.get_text(" ", strip=True)
        # 尝试分离年份
        m = re.search(r"\((\d{4})\)", raw)
        if m:
            info["year"] = m.group(1)
        info["title"] = re.sub(r"\s*\(\d{4}\)\s*$", "", raw).strip()

    # ---------- 海报 ----------
    poster_img = soup.select_one("#mainpic img")
    if poster_img and poster_img.get("src"):
        info["poster"] = urljoin(BASE_URL, poster_img["src"])

    # ---------- 基础信息（#info 下的 <p>） ----------
    for p in soup.select("#info p"):
        text = p.get_text(" ", strip=True)
        pl = p.select_one(".pl")
        label = pl.get_text(strip=True) if pl else ""
        value = text.replace(label, "").strip().lstrip(":").strip()

        if "导演" in label:
            info["director"] = value
        elif "编剧" in label:
            info["writer"] = value
        elif "主演" in label:
            info["actors"] = value
        elif "类型" in label:
            info["genre"] = value
        elif "制片国家" in label:
            info["country"] = value
        elif "语言" in label:
            info["language"] = value
        elif "上映日期" in label:
            info["release_date"] = value
        elif "片长" in label:
            info["runtime"] = value
        elif "又名" in label:
            info["aka"] = value
        elif "IMDb" in label:
            imdb_a = p.find("a", href=re.compile(r"imdb\.com"))
            if imdb_a:
                info["imdb"] = imdb_a.get_text(strip=True)

    # 豆瓣评分
    for span in soup.find_all("span", style=re.compile(r"color:#072|color:.*072")):
        t = span.get_text(strip=True)
        if re.search(r"\d+\.\d+分", t):
            info["douban_rating"] = t.replace("分", "")
    douban_a = soup.find("a", href=re.compile(r"movie\.douban\.com/subject"))
    if douban_a and not info.get("douban_subject"):
        m = re.search(r"subject/(\d+)", douban_a["href"])
        if m:
            info["douban"] = m.group(1)

    # ---------- 剧情简介 ----------
    summary_div = soup.select_one("#editor_content .editor_content")
    if summary_div:
        # 去掉所有 blockquote 标签里的装饰文本
        s = summary_div.get_text("\n", strip=True)
        s = re.sub(r"海洋奇缘：启航的剧情简介·+", "", s)
        s = s.strip()
        info["summary"] = s

    # ---------- 下载链接 ----------
    # 每个分组: <p class="title">夸克网盘</p>  后接 <ul><li>...</li></ul>
    tab_cont = soup.select_one("#tabList .post_tab_edit_cont")
    if tab_cont:
        current_type = ""
        for child in tab_cont.children:
            if not hasattr(child, "name"):
                continue
            if child.name == "p" and "title" in (child.get("class") or []):
                current_type = child.get_text(strip=True)
            elif child.name == "ul":
                for li in child.find_all("li", recursive=False):
                    a = li.find("a")
                    if not a:
                        continue
                    href = a.get("href", "")
                    title = a.get_text(" ", strip=True)
                    # 解析上传者和日期：<span class="huise"> 内有两个 span
                    uploader = ""
                    date = ""
                    huise = li.select_one("span.huise")
                    if huise:
                        spans = huise.find_all("span")
                        if len(spans) >= 1:
                            uploader = spans[0].get_text(strip=True)
                        if len(spans) >= 2:
                            date = spans[1].get_text(strip=True)

                    # 判断是否隐藏（游客模式）
                    is_hidden = href.startswith("javascript:") or "[隐藏]" in li.get_text()

                    info["download_links"].append({
                        "type": current_type,
                        "title": title,
                        "uploader": uploader,
                        "date": date,
                        "link": href if not is_hidden else "",
                        "hidden": is_hidden,
                    })

    return info


# ========================= 图片下载 =========================
def download_poster(session: requests.Session, poster_url: str, tid: int):
    if not poster_url:
        return ""
    try:
        ext = os.path.splitext(urlparse(poster_url).path)[1] or ".jpg"
        fname = f"{tid}{ext}"
        fpath = IMG_DIR / fname
        if fpath.exists():
            return str(fpath)
        resp = session.get(poster_url, timeout=20)
        if resp.status_code == 200 and len(resp.content) > 1000:
            fpath.write_bytes(resp.content)
            return str(fpath)
    except Exception as e:
        print(f"  [海报下载失败] {poster_url}: {e}")
    return ""


# ========================= 主流程 =========================
def crawl_all(cookie_str: str = "", max_pages: int = 0, workers: int = 3, download_posters: bool = True):
    """
    全站抓取主函数
      cookie_str     : 浏览器中复制的 Cookie 字符串（含 winduser / cookie_token 等即可）
      max_pages      : 每个板块最多抓取多少页，0 = 抓全部
      workers        : 详情页并发线程数
      download_posters: 是否下载海报
    """
    init_dirs()
    load_progress()

    session = requests.Session()
    session.headers.update(HEADERS)
    cookies = parse_cookie_str(cookie_str)
    session.cookies.update(cookies)

    # 先请求首页，拿到初始 cookie / token
    try:
        session.get(BASE_URL + "/", timeout=15)
    except Exception as e:
        print(f"[首页请求失败] {e}")

    is_logged_in = bool(cookies)
    print(f"\n========== WMMFLIX 全站爬虫 ==========")
    print(f"登录状态: {'已登录（可抓下载链接）' if is_logged_in else '游客模式（下载链接将显示为隐藏）'}")
    print(f"板块数量: {len(ALL_FORUMS)}")
    print(f"输出目录: {OUT_DIR.absolute()}")
    print("========================================\n")

    all_movies = []
    # 加载已抓取的详情页缓存
    cache_file = DATA_DIR / "movies.json"
    if cache_file.exists():
        try:
            all_movies = json.loads(cache_file.read_text(encoding="utf-8"))
        except:
            all_movies = []
    existing_tids = {m["tid"] for m in all_movies}

    # -------------- 第一步：遍历所有板块的所有列表页，收集 tid --------------
    all_tids = set()
    for fid, fname in ALL_FORUMS.items():
        print(f"\n>>> 板块 [{fname}] (fid={fid})")
        # 先抓第 1 页，探测总页数
        first_url = f"{BASE_URL}/thread-{fid}"
        html = safe_get(session, first_url)
        if not html:
            print(f"  [跳过] 无法访问: {first_url}")
            continue
        tids, total_pages = parse_list_page(html)
        if max_pages > 0:
            total_pages = min(total_pages, max_pages)
        print(f"  共 {total_pages} 页")

        for page in range(1, total_pages + 1):
            key = (fid, page)
            if key in done_list_pages:
                # 已经抓过的页面，直接从缓存读取 tids？简单起见直接跳过
                continue
            page_url = f"{BASE_URL}/thread-{fid}-{page}" if page > 1 else first_url
            if page > 1:
                polite_sleep(0.5, 1.5)
                html = safe_get(session, page_url)
                if not html:
                    continue
                tids, _ = parse_list_page(html)

            new_tids = [t for t in tids if t not in all_tids]
            all_tids.update(new_tids)
            done_list_pages.add(key)
            print(f"  第 {page} 页: {len(new_tids)} 个新帖子 (累计 {len(all_tids)})")

            # 每 5 页保存一次进度
            if page % 5 == 0:
                save_progress()

    save_progress()
    print(f"\n[列表页抓取完成] 共收集到 {len(all_tids)} 个唯一帖子 ID")

    # 过滤掉已经抓过的
    tids_to_crawl = [t for t in all_tids if t not in done_tids and t not in existing_tids]
    print(f"待抓取详情页: {len(tids_to_crawl)}\n")

    # -------------- 第二步：多线程抓取详情页 --------------
    count = 0
    failed = 0

    def crawl_one(tid):
        url = f"{BASE_URL}/read-{tid}"
        html = safe_get(session, url)
        if not html:
            return None, tid
        info = parse_detail_page(html, tid)
        if download_posters and info.get("poster"):
            local_poster = download_poster(session, info["poster"], tid)
            if local_poster:
                info["poster_local"] = local_poster
        return info, tid

    with ThreadPoolExecutor(max_workers=workers) as pool:
        futures = {pool.submit(crawl_one, t): t for t in tids_to_crawl}
        for fut in as_completed(futures):
            info, tid = fut.result()
            count += 1
            if info is None:
                failed += 1
                print(f"  [{count}/{len(tids_to_crawl)}] ❌ read-{tid} 失败")
            else:
                all_movies.append(info)
                done_tids.add(tid)
                title_show = (info["title"] or f"tid={tid}")[:30]
                dl_count = sum(1 for d in info["download_links"] if not d.get("hidden"))
                print(f"  [{count}/{len(tids_to_crawl)}] ✓ {title_show}  ({len(info['download_links'])}个资源, 可见{dl_count})")

            # 每 20 条保存一次
            if count % 20 == 0:
                cache_file.write_text(
                    json.dumps(all_movies, ensure_ascii=False, indent=2),
                    encoding="utf-8"
                )
                save_progress()
            polite_sleep(0.3, 1.0)

    # 最终保存
    cache_file.write_text(
        json.dumps(all_movies, ensure_ascii=False, indent=2),
        encoding="utf-8"
    )
    save_progress()

    # -------------- 第三步：导出 CSV --------------
    csv_file = DATA_DIR / "movies.csv"
    with open(csv_file, "w", encoding="utf-8-sig", newline="") as f:
        writer = csv.writer(f)
        writer.writerow([
            "tid", "标题", "年份", "导演", "编剧", "主演", "类型",
            "国家/地区", "语言", "上映日期", "片长", "又名",
            "IMDb", "豆瓣ID", "豆瓣评分",
            "夸克网盘", "百度网盘", "迅雷云盘", "UC网盘", "115网盘", "磁力下载", "其他下载",
            "海报URL", "详情页", "简介"
        ])
        for m in all_movies:
            dl_by_type = {}
            for d in m.get("download_links", []):
                if d.get("hidden"):
                    continue
                t = d.get("type", "其他")
                line = f"{d['title']}"
                if d.get("link"):
                    line += f" => {d['link']}"
                dl_by_type.setdefault(t, []).append(line)
            writer.writerow([
                m["tid"], m["title"], m["year"],
                m["director"], m["writer"], m["actors"], m["genre"],
                m["country"], m["language"], m["release_date"], m["runtime"], m["aka"],
                m["imdb"], m["douban"], m["douban_rating"],
                " | ".join(dl_by_type.get("夸克网盘", [])),
                " | ".join(dl_by_type.get("百度网盘", [])),
                " | ".join(dl_by_type.get("迅雷云盘", [])),
                " | ".join(dl_by_type.get("UC网盘", [])),
                " | ".join(dl_by_type.get("115网盘", [])),
                " | ".join(dl_by_type.get("磁力下载", [])),
                " | ".join(dl_by_type.get("其他下载", [])),
                m.get("poster", ""), m["url"], m["summary"],
            ])

    # -------------- 第四步：生成汇总报告 --------------
    total = len(all_movies)
    total_dl = sum(len(m["download_links"]) for m in all_movies)
    visible_dl = sum(1 for m in all_movies for d in m["download_links"] if not d["hidden"])
    posters = sum(1 for m in all_movies if m.get("poster_local"))

    report = f"""
================= 抓取完成 =================
  帖子总数     : {total}
  下载链接总数 : {total_dl}
  可见链接     : {visible_dl} {'(游客模式大部分隐藏，传 Cookie 可抓真实链接)' if not is_logged_in else ''}
  海报已下载   : {posters}
  失败数       : {failed}

输出文件：
  ✅ JSON   : {cache_file.absolute()}
  ✅ CSV    : {csv_file.absolute()}
  ✅ 海报   : {IMG_DIR.absolute()}/
  ✅ 进度   : {PROGRESS_FILE.absolute()}

💡 提示：
  如需抓取真实网盘/磁力链接，请先在浏览器登录 idyclub.com，
  然后在浏览器 DevTools -> Application -> Cookies 复制完整 Cookie 字符串，
  用如下命令重新运行：
     python idy_crawler.py --cookie "cookie1=v1; cookie2=v2; ..."
  （断点续爬会自动跳过已完成的帖子，只补抓缺失项）
=============================================
"""
    print(report)
    (OUT_DIR / "README_抓取结果.txt").write_text(report, encoding="utf-8")


# ========================= 入口 =========================
def main():
    parser = argparse.ArgumentParser(description="WMMFLIX (idyclub.com) 全站爬虫 —— 无加密逆向、支持断点续爬")
    parser.add_argument("--cookie", type=str, default="",
                        help="浏览器中复制的 Cookie 字符串（登录后可抓下载链接）")
    parser.add_argument("--max-pages", type=int, default=0,
                        help="每个板块最多抓取多少页（0=全部，调试用可填 3 或 5）")
    parser.add_argument("--workers", type=int, default=3,
                        help="详情页并发线程数（建议 2~5，过高容易被封）")
    parser.add_argument("--no-posters", action="store_true",
                        help="不下载海报图片")
    args = parser.parse_args()

    crawl_all(
        cookie_str=args.cookie,
        max_pages=args.max_pages,
        workers=args.workers,
        download_posters=not args.no_posters,
    )


if __name__ == "__main__":
    main()
