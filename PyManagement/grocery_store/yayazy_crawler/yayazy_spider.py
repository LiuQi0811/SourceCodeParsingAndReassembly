# -*- coding: utf-8 -*-
"""
丫丫资源网 (https://yayazy1.com/) 全站爬虫
============================================
站点特征: 苹果CMS(MacCMS)模板 yayazy, 播放地址为明文 m3u8, 无 JS 加密/混淆/签名,
          无需逆向解密, 直接 HTML 解析即可。

功能:
  1. 自动抓取首页导航中所有分类(含子分类)
  2. 自动翻遍每个分类的所有分页
  3. 进入详情页抓取: 标题 / 封面 / 年代 / 地区 / 类型 / 导演 / 主演 / 简介 / 更新信息
  4. 抓取所有播放源下的每一集: 集名 + 明文 m3u8 直链
  5. 结果输出:
        - output/videos.json   所有视频结构化数据 (一条视频一条记录, 含播放列表)
        - output/episodes.csv  扁平化的"视频-集-链接"表, 方便直接导入播放器/NAS
        - output/categories.json  分类映射表
  6. 支持断点续爬(已抓详情页跳过), 失败重试, 频率控制, 自定义 User-Agent

使用:
    python yayazy_spider.py                 # 默认全站爬取
    python yayazy_spider.py --only-cats     # 只抓分类列表, 不进详情
    python yayazy_spider.py --max-pages 3   # 每个分类最多抓 3 页(测试用)
    python yayazy_spider.py --delay 1       # 请求间隔 1 秒(默认 0.5)
    python yayazy_spider.py --download-m3u8 # 额外用 m3u8 直链保存为 .m3u 播放列表文件
"""

import argparse
import json
import os
import re
import sys
import time
import csv
import logging
from urllib.parse import urljoin, urlparse

import requests
from bs4 import BeautifulSoup

# ---------- 基础配置 ----------
BASE_URL = "https://yayazy1.com/"
HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/126.0.0.0 Safari/537.36"
    ),
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
    "Referer": BASE_URL,
}

OUT_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "output")
os.makedirs(OUT_DIR, exist_ok=True)

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%H:%M:%S",
)
log = logging.getLogger("yayazy")

# 已抓取详情页 ID 缓存(断点续爬)
SEEN_FILE = os.path.join(OUT_DIR, "seen_ids.json")


def load_seen():
    if os.path.exists(SEEN_FILE):
        with open(SEEN_FILE, "r", encoding="utf-8") as f:
            return set(json.load(f))
    return set()


def save_seen(seen):
    with open(SEEN_FILE, "w", encoding="utf-8") as f:
        json.dump(sorted(seen), f, ensure_ascii=False)


def http_get(url, retries=3, timeout=15):
    """带重试的 GET"""
    for i in range(retries):
        try:
            resp = requests.get(url, headers=HEADERS, timeout=timeout)
            resp.encoding = resp.apparent_encoding or "utf-8"
            if resp.status_code == 200:
                return resp.text
            log.warning("HTTP %s for %s", resp.status_code, url)
        except Exception as e:
            log.warning("请求失败(%s) %s: %s", i + 1, url, e)
        time.sleep(1 + i)
    return None


# ---------- 1. 抓取分类 ----------
def fetch_categories():
    """从首页解析所有一级/二级分类, 返回 [(cat_id, name, parent_name, url)]"""
    html = http_get(BASE_URL)
    if not html:
        log.error("无法访问首页")
        return []
    soup = BeautifulSoup(html, "lxml")
    cats = []
    seen_urls = set()

    # 主导航 li > a(href 包含 /vod/type/id/)
    nav = soup.select(".stui-header__menu li a") or soup.select("ul.stui-header__menu li a")
    if not nav:
        # 兜底: 全页所有分类链接
        nav = soup.select('a[href*="/vod/type/id/"]')

    # 为了拿到父子关系, 先解析整段导航的 ul > li
    menu = soup.select(".stui-header__menu > li")
    if not menu:
        menu = soup.find_all("li")

    for li in menu:
        a_top = li.find("a", href=re.compile(r"/vod/type/id/(\d+)\.html"))
        if not a_top:
            continue
        m = re.search(r"/vod/type/id/(\d+)\.html", a_top["href"])
        if not m:
            continue
        top_id = m.group(1)
        top_name = a_top.get_text(strip=True)
        top_url = urljoin(BASE_URL, a_top["href"])
        if top_url not in seen_urls:
            cats.append((top_id, top_name, "", top_url))
            seen_urls.add(top_url)

        # 子分类
        for a_sub in li.select("ul.dropdown li a"):
            m2 = re.search(r"/vod/type/id/(\d+)\.html", a_sub.get("href", ""))
            if not m2:
                continue
            sub_id = m2.group(1)
            sub_name = a_sub.get_text(strip=True)
            sub_url = urljoin(BASE_URL, a_sub["href"])
            if sub_url not in seen_urls:
                cats.append((sub_id, sub_name, top_name, sub_url))
                seen_urls.add(sub_url)

    log.info("发现 %d 个分类", len(cats))
    return cats


# ---------- 2. 解析列表页 ----------
def parse_list_page(url):
    """返回 (detail_links, total_pages)
       detail_links: [(vod_id, title, url, cover, sub_info)]
       total_pages: 最大页码 (拿不到就返回 None)
    """
    html = http_get(url)
    if not html:
        return [], None
    soup = BeautifulSoup(html, "lxml")

    links = []
    # 通用: 所有指向详情页的 a
    for a in soup.select('a[href*="/vod/detail/id/"]'):
        href = a.get("href", "")
        m = re.search(r"/vod/detail/id/(\d+)\.html", href)
        if not m:
            continue
        vid = m.group(1)
        # 列表项卡片: 通常外层是 li
        card = a.find_parent("li")
        title = a.get("title") or a.get_text(strip=True)
        cover = ""
        sub_info = ""
        if card:
            img = card.find("img")
            if img:
                cover = img.get("data-original") or img.get("src") or ""
                cover = urljoin(BASE_URL, cover)
            p_text = " / ".join(p.get_text(strip=True) for p in card.find_all("a") if p != a)
            sub_info = p_text
        if not title:
            continue
        full_url = urljoin(BASE_URL, href)
        links.append((vid, title, full_url, cover, sub_info))

    # 去重(按 id)
    uniq = {}
    for item in links:
        uniq[item[0]] = item
    links = list(uniq.values())

    # 总页数
    total = None
    # 找分页区: "末页" / "下一页" / 最大数字
    page_links = soup.select('a[href*="/vod/type/id/"]')
    max_p = 1
    for pl in page_links:
        hp = pl.get("href", "")
        mp = re.search(r"/vod/type/id/\d+/page/(\d+)\.html", hp)
        if mp:
            max_p = max(max_p, int(mp.group(1)))
        mp2 = re.search(r"page/(\d+)\.html", hp)
        if mp2 and re.search(r"/vod/type/id/", hp):
            max_p = max(max_p, int(mp2.group(1)))
    total = max_p if max_p > 1 else 1

    return links, total


# ---------- 3. 解析详情页 ----------
def parse_detail(url):
    """抓取单个详情页, 返回 dict"""
    html = http_get(url)
    if not html:
        return None
    soup = BeautifulSoup(html, "lxml")
    data = {
        "url": url,
        "title": "",
        "cover": "",
        "director": "",
        "actors": "",
        "region": "",
        "language": "",
        "year": "",
        "category": "",
        "update": "",
        "desc": "",
        "play_sources": [],  # [{"source": "yym3u8", "episodes": [{"name":"第01集", "url":"..."}] }]
    }

    # 标题
    h1 = soup.find("h1")
    if h1:
        data["title"] = h1.get_text(strip=True)
    if not data["title"]:
        t = soup.find("title")
        if t:
            data["title"] = re.sub(r"(详情介绍|在线观看|迅雷下载).*$", "", t.get_text()).strip(" -")

    # 封面
    img = soup.select_one(".stui-content__thumb img") or soup.select_one(".detail-pic img") or soup.find("img", class_="lazyload")
    if img:
        data["cover"] = img.get("data-original") or img.get("src") or ""
        data["cover"] = urljoin(BASE_URL, data["cover"])

    # 信息块: 多个 p/span, 含"导演/主演/类型/地区/语言/上映/更新"
    info_block = soup.select_one(".stui-content__detail") or soup.select_one(".detail-info") or soup
    info_text = info_block.get_text("\n", strip=True)

    def extract(pattern, text, default=""):
        m = re.search(pattern, text)
        return m.group(1).strip() if m else default

    data["director"] = extract(r"导演[：:]\s*([^\n]+)", info_text)
    data["actors"]   = extract(r"主演[：:]\s*([^\n]+)", info_text)
    data["category"] = extract(r"类型[：:]\s*([^\n]+)", info_text)
    data["region"]   = extract(r"地区[：:]\s*([^\n]+)", info_text)
    data["language"] = extract(r"语言[：:]\s*([^\n]+)", info_text)
    data["year"]     = extract(r"上映[：:]\s*([^\n]+)", info_text) or extract(r"年份[：:]\s*([^\n]+)", info_text)
    data["update"]   = extract(r"更新[：:]\s*([^\n]+)", info_text)

    # 简介
    desc = soup.select_one(".stui-content__desc") or soup.select_one(".detail-desc")
    if desc:
        data["desc"] = desc.get_text("\n", strip=True)
    else:
        # 找包含"剧情介绍"后的段落
        h3 = soup.find("h3", string=re.compile(r"剧情介绍|简介"))
        if h3:
            nxt = h3.find_next("p") or h3.find_next("div")
            if nxt:
                data["desc"] = nxt.get_text("\n", strip=True)

    # 播放列表: 每一个 .stui-vodlist__head (播放源) 下的 ul li a
    # 播放源标题形如 "播放类型：yym3u8"
    play_blocks = soup.select(".stui-content__playlist") or soup.select(".playlist")
    if not play_blocks:
        play_blocks = soup.select('[class*="playlist"]')

    # 同时抓播放源名
    heads = soup.select(".stui-pannel__head h3, .stui-vodlist__head h3") or soup.select("h3")
    source_names = []
    for h in heads:
        txt = h.get_text(strip=True)
        if "播放" in txt or "源" in txt or "$" in txt:
            source_names.append(txt)
    if not source_names:
        source_names = ["yym3u8"]

    for idx, block in enumerate(play_blocks):
        source_name = source_names[idx] if idx < len(source_names) else f"source_{idx+1}"
        # 取形如 "播放类型：yym3u8" 中的后缀
        sm = re.search(r"[：:](\S+)", source_name)
        if sm:
            source_name = sm.group(1)

        episodes = []
        for a in block.select("li a") or block.select("a"):
            raw = a.get_text(strip=True)
            href = a.get("href", "")
            # 丫丫资源站的链接文本本身就包含 "第01集$https://...m3u8" 明文
            if "$" in raw:
                name, purl = raw.split("$", 1)
                episodes.append({"name": name.strip(), "url": purl.strip()})
            elif href and re.match(r"https?://", href):
                # 兜底: a 标签 href 直接是播放地址
                episodes.append({"name": raw or f"ep{len(episodes)+1}", "url": href})
            else:
                # 再兜底: 可能是播放页 /vod/play/id/...sid/...nid/...html
                # 但本站测试已在文本里明文, 这里不做播放器页解密(如后续有播放器页再扩展)
                full = urljoin(BASE_URL, href)
                episodes.append({"name": raw, "url": full})
        if episodes:
            data["play_sources"].append({"source": source_name, "episodes": episodes})

    # 如果没在 .playlist 里拿到, 从页面直接正则匹配 m3u8 链接 (兜底)
    if not any(ps["episodes"] for ps in data["play_sources"]):
        m3u8s = re.findall(r"https?://[^\s\"'<>]+\.m3u8[^\s\"'<>]*", html)
        eps = []
        for i, u in enumerate(dict.fromkeys(m3u8s)):
            eps.append({"name": f"线路{i+1}", "url": u})
        if eps:
            data["play_sources"].append({"source": "m3u8_auto", "episodes": eps})

    return data


# ---------- 4. 主流程 ----------
def main():
    ap = argparse.ArgumentParser(description="丫丫资源网全站爬虫")
    ap.add_argument("--delay", type=float, default=0.5, help="请求间隔秒数, 默认0.5")
    ap.add_argument("--max-pages", type=int, default=0, help="每个分类最多抓多少页, 0=全部")
    ap.add_argument("--only-cats", action="store_true", help="仅输出分类列表, 不抓详情")
    ap.add_argument("--download-m3u8", action="store_true", help="把每个视频的 m3u8 链保存为 .m3u 播放列表")
    ap.add_argument("--cat-id", type=str, default="", help="只抓指定分类ID, 例如 13")
    args = ap.parse_args()

    seen = load_seen()
    log.info("已缓存详情页 %d 个 (断点续爬)", len(seen))

    # 1) 分类
    cats = fetch_categories()
    if args.cat_id:
        cats = [c for c in cats if c[0] == args.cat_id]
        log.info("按 --cat-id=%s 过滤后剩余 %d 个分类", args.cat_id, len(cats))

    with open(os.path.join(OUT_DIR, "categories.json"), "w", encoding="utf-8") as f:
        json.dump(
            [{"id": c[0], "name": c[1], "parent": c[2], "url": c[3]} for c in cats],
            f, ensure_ascii=False, indent=2,
        )

    if args.only_cats:
        log.info("分类已保存到 output/categories.json, --only-cats 模式结束")
        return

    # 2) 遍历分类 -> 翻页 -> 详情
    all_videos = []
    all_ep_rows = []  # for CSV
    new_seen = set(seen)

    total_cats = len(cats)
    for ci, (cid, cname, cparent, curl) in enumerate(cats, 1):
        log.info("[%d/%d] 分类 %s/%s (id=%s) -> %s", ci, total_cats, cparent, cname, cid, curl)

        # 第 1 页先探
        first_page = curl
        page1_links, total_p = parse_list_page(first_page)
        if not page1_links:
            log.warning("  分类无内容, 跳过")
            time.sleep(args.delay)
            continue
        log.info("  共约 %d 页, 开始抓取", total_p or "?")

        max_pages = args.max_pages if args.max_pages > 0 else (total_p or 9999)

        for page_no in range(1, max_pages + 1):
            if page_no == 1:
                links = page1_links
            else:
                # 苹果CMS分页URL: /index.php/vod/type/id/1/page/2.html
                page_url = re.sub(r"(\.html)$", f"/page/{page_no}.html", curl)
                # 若 curl 已经是 /page/N.html, 替换
                page_url = re.sub(r"/page/\d+\.html$", f"/page/{page_no}.html", page_url)
                links, _ = parse_list_page(page_url)
                time.sleep(args.delay)

            if not links:
                log.info("  第 %d 页无数据, 该分类结束", page_no)
                break

            log.info("  第 %d/%d 页: %d 条", page_no, max_pages, len(links))
            for vi, (vid, title, vurl, cover, sub_info) in enumerate(links, 1):
                if vid in new_seen:
                    continue
                log.info("    [%d/%d] %s (id=%s)", vi, len(links), title[:30], vid)
                detail = parse_detail(vurl)
                time.sleep(args.delay)
                if not detail:
                    log.warning("     详情抓取失败, 跳过")
                    continue
                detail["vod_id"] = vid
                detail["category_id"] = cid
                detail["category_name"] = cname
                detail["category_parent"] = cparent
                if cover and not detail.get("cover"):
                    detail["cover"] = cover
                all_videos.append(detail)
                new_seen.add(vid)

                # 扁平化
                for src in detail["play_sources"]:
                    for ep in src["episodes"]:
                        all_ep_rows.append({
                            "vod_id": vid,
                            "title": detail["title"],
                            "category": detail["category_name"],
                            "source": src["source"],
                            "episode": ep["name"],
                            "url": ep["url"],
                            "detail_url": vurl,
                        })

                # 每 20 条增量保存一次, 防中断丢失
                if len(all_videos) % 20 == 0:
                    save_outputs(all_videos, all_ep_rows, new_seen)

    # 最终保存
    save_outputs(all_videos, all_ep_rows, new_seen)

    # m3u 播放列表
    if args.download_m3u8:
        write_m3u(all_videos)

    log.info("全部完成! 共抓到 %d 个视频, %d 条播放记录", len(all_videos), len(all_ep_rows))
    log.info("结果目录: %s", OUT_DIR)


def save_outputs(videos, rows, seen):
    with open(os.path.join(OUT_DIR, "videos.json"), "w", encoding="utf-8") as f:
        json.dump(videos, f, ensure_ascii=False, indent=2)
    with open(os.path.join(OUT_DIR, "episodes.csv"), "w", encoding="utf-8-sig", newline="") as f:
        w = csv.DictWriter(f, fieldnames=["vod_id", "title", "category", "source", "episode", "url", "detail_url"])
        w.writeheader()
        w.writerows(rows)
    save_seen(seen)


def write_m3u(videos):
    """把每个视频写成一个 .m3u 播放列表, NAS/播放器可直接打开"""
    m3u_dir = os.path.join(OUT_DIR, "m3u_playlists")
    os.makedirs(m3u_dir, exist_ok=True)
    for v in videos:
        safe = re.sub(r'[\\/:*?"<>|]', "_", v["title"])[:80]
        lines = ["#EXTM3U"]
        for src in v["play_sources"]:
            for ep in src["episodes"]:
                lines.append(f'#EXTINF:-1 group-title="{src["source"]}",{ep["name"]}')
                lines.append(ep["url"])
        with open(os.path.join(m3u_dir, f"{safe}.m3u"), "w", encoding="utf-8") as f:
            f.write("\n".join(lines))
    log.info("已生成 %d 个 .m3u 播放列表 -> %s", len(videos), m3u_dir)


if __name__ == "__main__":
    main()
