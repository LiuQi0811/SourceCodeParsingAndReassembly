#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
gqc.ink (共青春影院) 全站爬虫
========================================
功能:
  1. 按栏目(电影/连续剧/综艺/动漫/短剧)抓取全部影片列表
  2. 进入详情页抓取: 标题/封面/导演/主演/分类/地区/年份/更新时间/简介
  3. 解析播放页, 获取多线路/多集数的真实直链(m3u8/mp4)
  4. 结果保存为 JSON / CSV / SQLite 三种格式, 支持断点续爬
  5. 内置多线程、限速、重试、随机 UA 与 Referer 伪装

运行:
    python3 gqc_spider.py                 # 默认全量爬取
    python3 gqc_spider.py --cate dianying # 只爬电影
    python3 gqc_spider.py --pages 5       # 每个栏目只爬前5页(测试用)
    python3 gqc_spider.py --workers 8     # 8线程并发
    python3 gqc_spider.py --delay 1       # 请求间隔1秒
    python3 gqc_spider.py --no-video      # 跳过播放页, 只抓元信息
    python3 gqc_spider.py --download      # 额外把直链写入 download_list.txt 供 aria2/wget 批量下载
"""

import argparse
import json
import os
import random
import re
import sqlite3
import sys
import threading
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from urllib.parse import urljoin, unquote

import requests
from bs4 import BeautifulSoup

# ==================== 基础配置 ====================
BASE_URL = "https://gqc.ink"
DEFAULT_HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
                  "(KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
    "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
    "Referer": BASE_URL + "/",
}

# 栏目 key -> (路径前缀, 中文名)
CATEGORIES = {
    "dianying":  ("电影",   "/vodshow/dianying--------PAGELINK---.html"),
    "lianxuju":  ("连续剧", "/vodshow/lianxuju--------PAGELINK---.html"),
    "zongyi":    ("综艺",   "/vodshow/zongyi--------PAGELINK---.html"),
    "dongman":   ("动漫",   "/vodshow/dongman--------PAGELINK---.html"),
    "duanju":    ("短剧",   "/vodshow/duanju--------PAGELINK---.html"),
}

# 输出目录
OUT_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "gqc_data")
os.makedirs(OUT_DIR, exist_ok=True)

# 用户代理池
USER_AGENTS = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:126.0) Gecko/20100101 Firefox/126.0",
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
]


# ==================== 基础 HTTP 工具 ====================
class Fetcher:
    def __init__(self, delay=0.5, retries=3, timeout=15):
        self.delay = delay
        self.retries = retries
        self.timeout = timeout
        self.session = requests.Session()
        self.session.headers.update(DEFAULT_HEADERS)
        self._last_req = 0
        self._lock = threading.Lock()

    def _throttle(self):
        with self._lock:
            wait = self.delay - (time.time() - self._last_req)
            if wait > 0:
                time.sleep(wait + random.uniform(0, 0.3))
            self._last_req = time.time()

    def get(self, url, **kwargs):
        headers = kwargs.pop("headers", {}) or {}
        headers.setdefault("User-Agent", random.choice(USER_AGENTS))
        for i in range(self.retries):
            try:
                self._throttle()
                resp = self.session.get(url, headers=headers, timeout=self.timeout, **kwargs)
                resp.encoding = resp.apparent_encoding or "utf-8"
                if resp.status_code == 200:
                    return resp.text
                print(f"[warn] {url} -> HTTP {resp.status_code}, retry {i+1}")
            except Exception as e:
                print(f"[warn] {url} -> {e}, retry {i+1}")
            time.sleep(1.5 * (i + 1))
        return None


fetcher = None  # 全局 Fetcher, main() 中初始化


# ==================== 列表页解析 ====================
def parse_list_page(html):
    """从分类列表页提取影片详情链接 + 最大页数"""
    soup = BeautifulSoup(html, "html.parser")
    # 1) 影片详情链接
    ids = []
    for a in soup.find_all("a", href=True):
        m = re.match(r"/neirong/(\d+)\.html", a["href"])
        if m:
            ids.append(int(m.group(1)))
    ids = sorted(set(ids))
    # 2) 最大页数: data-total
    total_pages = 1
    jump_tag = soup.find(attrs={"data-total": True})
    if jump_tag:
        try:
            total_pages = int(jump_tag["data-total"])
        except (TypeError, ValueError):
            pass
    # 兜底: 找最后一个数字页
    page_links = soup.find_all("a", href=re.compile(r"/vodshow/[^-]+-+\d+---\.html"))
    nums = []
    for a in page_links:
        mm = re.search(r"(-+)(\d+)---\.html", a["href"])
        if mm:
            nums.append(int(mm.group(2)))
    if nums:
        total_pages = max(total_pages, max(nums))
    return ids, total_pages


# ==================== 详情页解析 ====================
def parse_detail_page(html, vid):
    """解析详情页, 返回元信息 dict"""
    soup = BeautifulSoup(html, "html.parser")
    info = {
        "id": vid,
        "url": f"{BASE_URL}/neirong/{vid}.html",
        "title": "",
        "cover": "",
        "director": "",
        "actors": [],
        "category": "",
        "region": "",
        "year": "",
        "update": "",
        "rating": "",
        "intro": "",
        "play_sources": [],  # [{source, url, episodes:[{ep, title, url}]}]
    }

    # 标题
    h1 = soup.find("h1")
    if h1 and h1.a:
        info["title"] = h1.a.get_text(strip=True)
    elif h1:
        info["title"] = h1.get_text(strip=True)

    # 封面: 详情页主海报 (a.fed-list-pics 的 data-original, 或 fed-poster 内图片)
    cover = ""
    poster_a = soup.select_one(".fed-poster a.fed-list-pics, .fed-deta-content a.fed-list-pics, a.fed-list-pics.fed-lazy")
    if poster_a:
        cover = poster_a.get("data-original") or poster_a.get("href") or ""
    if not cover:
        cover_img = soup.select_one(".fed-poster img, .fed-deta-images img")
        if cover_img:
            cover = cover_img.get("data-original") or cover_img.get("src", "")
    if cover and cover.startswith("/"):
        cover = BASE_URL + cover
    info["cover"] = cover

    # 信息条: 找到包含"导演/主演"的那个 ul.fed-part-rows (面包屑也是这个class)
    info_box = None
    for u in soup.find_all("ul", class_="fed-part-rows"):
        t = u.get_text()
        if "导演" in t or "主演" in t or "分类" in t:
            info_box = u
            break
    if info_box:
        # 用 li 粒度解析
        for li in info_box.find_all("li", recursive=False):
            txt = li.get_text(" ", strip=True)
            links = [a.get_text(strip=True) for a in li.find_all("a") if a.get_text(strip=True)]
            if txt.startswith("主演"):
                info["actors"] = links or [x.strip() for x in re.split(r"[&,，\s]+", txt.replace("主演：", "").replace("主演:", "")) if x.strip()]
            elif txt.startswith("导演"):
                info["director"] = links[0] if links else txt.split("：", 1)[-1].split(":")[-1].strip()
            elif txt.startswith("分类"):
                info["category"] = links[0] if links else ""
            elif txt.startswith("地区"):
                info["region"] = links[0] if links else ""
            elif txt.startswith("年份"):
                mm = re.search(r"(\d{4})", txt)
                if mm:
                    info["year"] = mm.group(1)
            elif txt.startswith("更新"):
                info["update"] = txt.split("：", 1)[-1].split(":")[-1].strip()
            elif txt.startswith("评分"):
                info["rating"] = txt.split("：", 1)[-1].split(":")[-1].strip()
            elif txt.startswith("简介"):
                # 去掉"简介："和豆瓣图标
                intro_text = li.get_text(" ", strip=True)
                intro_text = re.sub(r"^简介[：:]\s*", "", intro_text)
                info["intro"] = intro_text.strip()

    # 简介兜底: 独立简介区块
    if not info["intro"] or len(info["intro"]) < 20:
        intro_box = soup.find("span", class_=re.compile("fed-detail|fed-part-esan|fed-hidden")) or \
                    soup.find("div", class_=re.compile("fed-part-esan|fed-tabs-item.*简介|fed-deta-content"))
        if intro_box:
            info["intro"] = intro_box.get_text(" ", strip=True)
        else:
            desc = soup.find("meta", attrs={"name": "description"})
            if desc:
                info["intro"] = desc.get("content", "").strip()

    # 播放线路与集数
    # 线路按钮: .fed-drop-btns a[href="/bofang/{vid}-{src}-1.html"]
    source_btns = soup.select(".fed-drop-btns > a[href]")
    src_name = {}
    for a in source_btns:
        mm = re.match(rf"/bofang/{vid}-(\d+)-\d+\.html", a["href"])
        if mm:
            sid = int(mm.group(1))
            # 去掉徽章 <span> 后的名字
            name = a.find(string=True, recursive=False)
            if not name:
                name = a.get_text(strip=True)
            name = str(name).strip() or f"线路{sid}"
            src_name[sid] = name

    # 对应线路的集数列表: 多个 .fed-tabs-item 下 .fed-part-rows 中集数链接
    # 该站线路按钮与集数面板按顺序一一对应
    panels = soup.select(".fed-tabs-boxs > .fed-tabs-item, .fed-drop-boxs")
    play_sources = []
    # 方案B: 直接找所有集数链接, 通过 href 分组
    src_eps = {}
    for a in soup.find_all("a", href=re.compile(rf"/bofang/{vid}-(\d+)-(\d+)\.html")):
        # 排除线路按钮本身(按钮 href 总是指向第1集, 会造成重复)
        parent_cls = " ".join(a.parent.get("class", [])) if a.parent else ""
        if "fed-drop-btns" in parent_cls:
            continue
        mm = re.match(rf"/bofang/{vid}-(\d+)-(\d+)\.html", a["href"])
        if not mm:
            continue
        src, ep = int(mm.group(1)), int(mm.group(2))
        title = a.get_text(strip=True) or f"第{ep}集"
        # 过滤"立即播放"这种通用按钮——它指向第1集, 但不是真实集数
        if title in ("立即播放", "播放") and ep == 1:
            # 只有当该线路已有其他集时才跳过; 如果仅1集则保留
            if src in src_eps and any(e["ep"] == 1 for e in src_eps[src]):
                continue
        src_eps.setdefault(src, {})[ep] = {
            "ep": ep,
            "title": title,
            "play_url": BASE_URL + a["href"],
        }

    for src in sorted(src_eps.keys()):
        eps_list = sorted(src_eps[src].values(), key=lambda x: x["ep"])
        # 如果该线路只有1集且按钮名存在, 标题不用"立即播放"
        play_sources.append({
            "source_index": src,
            "source_name": src_name.get(src, f"线路{src}"),
            "episodes": eps_list,
        })
    info["play_sources"] = play_sources
    return info


# ==================== 播放页解析真实视频地址 ====================
def parse_play_page(html):
    """从播放页 iframe 提取 data-api + data-play 得到真实播放地址"""
    soup = BeautifulSoup(html, "html.parser")
    iframe = soup.find("iframe", id="fed-play-iframe") or soup.find("iframe", class_="fed-play-iframe")
    if not iframe:
        # 尝试 data-play 直接写在 iframe 上的 a 标签
        iframe = soup.find(attrs={"data-play": True})
    if not iframe:
        return None, None
    api = iframe.get("data-pars") or iframe.get("data-api") or ""
    play = iframe.get("data-play") or iframe.get("src", "")
    # 有些页面的真实地址直接写在 src, 另一些需要 api + url 拼接
    if play and (".m3u8" in play or ".mp4" in play):
        video_url = play
    elif api and play:
        video_url = api + play
    else:
        video_url = iframe.get("src", "")
    return video_url, iframe.get("data-next", "")


# ==================== 存储 ====================
class Storage:
    def __init__(self):
        self.json_path = os.path.join(OUT_DIR, "gqc_all.json")
        self.csv_path = os.path.join(OUT_DIR, "gqc_all.csv")
        self.db_path = os.path.join(OUT_DIR, "gqc.db")
        self.dl_path = os.path.join(OUT_DIR, "download_list.txt")
        self._lock = threading.Lock()
        self._cache = {}
        # SQLite
        self.conn = sqlite3.connect(self.db_path, check_same_thread=False)
        self.conn.execute("""
            CREATE TABLE IF NOT EXISTS videos (
                id INTEGER PRIMARY KEY,
                title TEXT,
                url TEXT,
                cover TEXT,
                director TEXT,
                actors TEXT,
                category TEXT,
                region TEXT,
                year TEXT,
                update_tag TEXT,
                rating TEXT,
                intro TEXT,
                play_sources TEXT,
                real_videos TEXT
            )
        """)
        self.conn.commit()
        # 断点: 已爬详情
        self._done_ids = set()
        cur = self.conn.execute("SELECT id FROM videos")
        for row in cur:
            self._done_ids.add(row[0])

    def is_done(self, vid):
        return vid in self._done_ids

    def save(self, info):
        with self._lock:
            self._cache[info["id"]] = info
            self._done_ids.add(info["id"])
            self.conn.execute("""
                INSERT OR REPLACE INTO videos
                (id,title,url,cover,director,actors,category,region,year,update_tag,rating,intro,play_sources,real_videos)
                VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)
            """, (
                info["id"], info["title"], info["url"], info["cover"],
                info["director"], ",".join(info["actors"]),
                info["category"], info["region"], info["year"],
                info["update"], info["rating"], info["intro"],
                json.dumps(info["play_sources"], ensure_ascii=False),
                json.dumps(info.get("real_videos", []), ensure_ascii=False),
            ))
            self.conn.commit()

    def flush(self):
        # JSON
        with open(self.json_path, "w", encoding="utf-8") as f:
            json.dump(list(self._cache.values()), f, ensure_ascii=False, indent=2)
        # CSV
        import csv
        with open(self.csv_path, "w", encoding="utf-8-sig", newline="") as f:
            w = csv.writer(f)
            w.writerow(["ID", "标题", "分类", "地区", "年份", "导演", "主演",
                        "更新", "评分", "封面", "详情页", "简介", "播放线路数", "视频直链"])
            for v in self._cache.values():
                urls = []
                for src in v.get("real_videos", v["play_sources"]):
                    for ep in src.get("episodes", []):
                        u = ep.get("video_url") or ep.get("play_url", "")
                        if u:
                            urls.append(u)
                w.writerow([
                    v["id"], v["title"], v["category"], v["region"], v["year"],
                    v["director"], "/".join(v["actors"][:5]), v["update"],
                    v["rating"], v["cover"], v["url"], v["intro"][:200],
                    len(v["play_sources"]), " | ".join(urls[:10]),
                ])
        # 下载列表
        with open(self.dl_path, "w", encoding="utf-8") as f:
            f.write("# aria2c -i download_list.txt  批量下载\n")
            for v in self._cache.values():
                for src in v.get("real_videos", []):
                    for ep in src["episodes"]:
                        u = ep.get("video_url", "")
                        if u and (".m3u8" in u or ".mp4" in u):
                            name = f"{v['title']}_{src.get('source_name','')}_{ep.get('title','')}.mp4"
                            name = re.sub(r'[\\/:*?"<>|]', "_", name)
                            f.write(f"{u}\n")
                            f.write(f"  out={name}\n")


# ==================== 主爬虫逻辑 ====================
def crawl_one_video(vid, fetch_video=True):
    """抓取单个视频详情 + 各集直链"""
    url = f"{BASE_URL}/neirong/{vid}.html"
    html = fetcher.get(url)
    if not html:
        print(f"[skip] 详情页失败 {vid}")
        return None
    info = parse_detail_page(html, vid)
    if not info["title"]:
        print(f"[skip] 无标题 {vid}")
        return None

    info["real_videos"] = []
    if fetch_video:
        for src in info["play_sources"]:
            new_src = {"source_index": src["source_index"],
                       "source_name": src["source_name"],
                       "episodes": []}
            for ep in src["episodes"]:
                play_html = fetcher.get(ep["play_url"],
                                        headers={"Referer": url})
                vurl, _next = (None, None)
                if play_html:
                    vurl, _next = parse_play_page(play_html)
                new_ep = dict(ep)
                new_ep["video_url"] = vurl or ""
                new_src["episodes"].append(new_ep)
            info["real_videos"].append(new_src)
    return info


def crawl_category(cate_key, max_pages=None, fetch_video=True, storage=None):
    cate_name, url_tpl = CATEGORIES[cate_key]
    print(f"\n========== 开始抓取栏目: {cate_name} ==========")
    # 第一页
    page1_url = f"{BASE_URL}/vodshow/{cate_key}-----------.html"
    html = fetcher.get(page1_url)
    if not html:
        print(f"[err] 无法打开 {cate_name} 第一页")
        return 0, 0
    ids, total = parse_list_page(html)
    if max_pages:
        total = min(total, max_pages)
    print(f"  -> 共 {total} 页, 第1页影片 {len(ids)} 部")

    done_count = 0
    all_ids = set()
    # 逐页
    for p in range(1, total + 1):
        if p == 1:
            page_ids = ids
            page_html = html
        else:
            purl = f"{BASE_URL}/vodshow/{cate_key}--------{p}---.html"
            page_html = fetcher.get(purl)
            if not page_html:
                print(f"  [warn] 第{p}页失败, 跳过")
                continue
            page_ids, _ = parse_list_page(page_html)
        new_ids = [i for i in page_ids if not storage.is_done(i)]
        all_ids.update(page_ids)
        print(f"  -> 第 {p}/{total} 页, 本页 {len(page_ids)} 部, 新增 {len(new_ids)} 部待爬")
        # 并发抓取详情
        with ThreadPoolExecutor(max_workers=ARGS.workers) as ex:
            futs = {ex.submit(crawl_one_video, vid, fetch_video): vid for vid in new_ids}
            for fut in as_completed(futs):
                vid = futs[fut]
                try:
                    info = fut.result()
                    if info:
                        storage.save(info)
                        done_count += 1
                        if done_count % 20 == 0:
                            storage.flush()
                            print(f"    ✓ 已累计完成 {done_count} 部, 最近: {info['title']}")
                except Exception as e:
                    print(f"    [err] {vid}: {e}")
    print(f"========== 栏目 {cate_name} 完成, 新增 {done_count} 部 ==========")
    return len(all_ids), done_count


def main():
    global fetcher, ARGS
    ap = argparse.ArgumentParser(description="gqc.ink 全站爬虫")
    ap.add_argument("--cate", nargs="+", choices=list(CATEGORIES.keys()),
                    default=list(CATEGORIES.keys()),
                    help="要爬取的栏目, 默认全部")
    ap.add_argument("--pages", type=int, default=0,
                    help="每个栏目最多爬多少页, 0=全部")
    ap.add_argument("--workers", type=int, default=4, help="并发线程数")
    ap.add_argument("--delay", type=float, default=0.8, help="请求间隔秒数")
    ap.add_argument("--no-video", action="store_true", help="不解析播放页(更快, 只拿元数据)")
    ap.add_argument("--download", action="store_true", help="额外生成下载列表")
    ARGS = ap.parse_args()

    fetcher = Fetcher(delay=ARGS.delay)
    storage = Storage()

    print(f"目标站点: {BASE_URL}")
    print(f"输出目录: {OUT_DIR}")
    print(f"爬取栏目: {ARGS.cate}  并发: {ARGS.workers}  限速: {ARGS.delay}s")
    print(f"解析视频直链: {not ARGS.no_video}")

    total_new = 0
    for cate in ARGS.cate:
        _, n = crawl_category(cate,
                              max_pages=ARGS.pages if ARGS.pages > 0 else None,
                              fetch_video=not ARGS.no_video,
                              storage=storage)
        total_new += n

    storage.flush()
    print("\n========================================")
    print(f"全部完成! 本次新增 {total_new} 部影片")
    print(f"  JSON   -> {storage.json_path}")
    print(f"  CSV    -> {storage.csv_path}")
    print(f"  SQLite -> {storage.db_path}")
    if ARGS.download and not ARGS.no_video:
        print(f"  下载列表 -> {storage.dl_path}")


if __name__ == "__main__":
    main()
