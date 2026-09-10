#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
独播库 (https://www.dbku.tv/) 全站抓取工具
================================================
功能：
  1. 抓取全部分类的影视列表（电影 / 连续剧 / 综艺 / 动漫 及子分类）
  2. 抓取每部影视的详情（标题/评分/分类/地区/年份/主演/导演/简介/封面/更新时间）
  3. 抓取每一集的播放地址（自动解密 player_data.url 得到 m3u8/mp4 直链）
  4. 结果保存为 JSON / CSV，并支持增量抓取、断点续爬、多线程并发
  5. 可选：使用 m3u8 / ffmpeg 下载视频文件

依赖：
  pip install requests beautifulsoup4 lxml tqdm
  （下载视频时需系统安装 ffmpeg）

用法：
  # 1. 全量抓取元数据（默认）
  python dbku_crawler.py

  # 2. 只抓取指定分类（1=电影 2=连续剧 3=综艺 4=动漫）
  python dbku_crawler.py --types 1 2

  # 3. 限制列表翻页页数（每个分类最多抓 N 页）
  python dbku_crawler.py --max-pages 5

  # 4. 抓取视频直链（播放页）并保存
  python dbku_crawler.py --fetch-play-url

  # 5. 下载视频（需要 ffmpeg）
  python dbku_crawler.py --fetch-play-url --download --download-dir ./videos

  # 6. 并发数与延迟
  python dbku_crawler.py --workers 8 --delay 0.5

输出：
  output/dbku_index.json      所有影视索引
  output/dbku_detail.json     详情 + 播放源
  output/dbku_videos.csv      表格形式索引
  output/images/              封面图
  output/videos/              下载的视频（--download 时）
"""

import argparse
import base64
import csv
import json
import os
import re
import sys
import time
import random
import logging
import urllib.parse
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path

import requests
from bs4 import BeautifulSoup
from urllib3.util.retry import Retry
from requests.adapters import HTTPAdapter

# ========== 配置 ==========
BASE_URL = "https://www.dbku.tv"
HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
                  "(KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
    "Referer": BASE_URL + "/",
}
TIMEOUT = 15
RETRY_TIMES = 3

# 主分类（顶部分类栏的四个入口）
MAIN_CATEGORIES = {
    1: "电影",
    2: "连续剧",
    3: "综艺",
    4: "动漫",
}

# ========== 日志 ==========
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%H:%M:%S",
)
log = logging.getLogger("dbku")


# ========== 工具函数 ==========
def make_session() -> requests.Session:
    """创建带重试和随机 UA 的会话。"""
    s = requests.Session()
    s.headers.update(HEADERS)
    retry = Retry(
        total=RETRY_TIMES,
        backoff_factor=1,
        status_forcelist=[429, 500, 502, 503, 504],
        allowed_methods=["GET", "HEAD"],
    )
    s.mount("https://", HTTPAdapter(max_retries=retry))
    s.mount("http://", HTTPAdapter(max_retries=retry))
    return s


def polite_get(session: requests.Session, url: str, delay: float = 0.3) -> requests.Response:
    """礼貌 GET：随机延迟 + 固定 Referer。"""
    time.sleep(delay + random.random() * delay)
    resp = session.get(url, timeout=TIMEOUT)
    resp.raise_for_status()
    # 站点编码是 utf-8，强制指定避免乱码
    resp.encoding = resp.apparent_encoding or "utf-8"
    return resp


def decrypt_url(enc: str) -> str:
    """
    解密 player_data.url：
    encrypt=2 时为 base64(decodeURIComponent(..))，Python 侧实际是
        decodeURIComponent(atob(enc))
    实测 enc 是 「URL编码后的m3u8」再 base64，所以要先 b64decode 再 url-unquote。
    """
    try:
        raw = base64.b64decode(enc).decode("utf-8", errors="replace")
        return urllib.parse.unquote(raw)
    except Exception as e:
        log.warning("解密URL失败: %s", e)
        return enc


def to_abs_url(u: str) -> str:
    if not u:
        return ""
    if u.startswith("//"):
        return "https:" + u
    if u.startswith("/"):
        return BASE_URL + u
    return u


# ========== 抓取：分类列表页 ==========
def fetch_category_ids(session: requests.Session) -> dict:
    """
    从首页获取所有子分类ID，返回 {type_id: type_name}。
    顶部4个主分类只是入口，每个入口下还有陆剧/日韩剧/短剧/台泰剧等子分类，
    这里扫描所有分类页链接，整理完整分类表。
    """
    cats = dict(MAIN_CATEGORIES)
    for tid in list(MAIN_CATEGORIES.keys()):
        url = f"{BASE_URL}/vodtype/{tid}.html"
        try:
            html = polite_get(session, url).text
        except Exception as e:
            log.warning("访问分类页 %s 失败：%s", url, e)
            continue
        soup = BeautifulSoup(html, "lxml")
        # 筛选链接: /vodshow/<id>-----------.html
        for a in soup.select('a[href*="/vodshow/"]'):
            href = a.get("href", "")
            m = re.search(r"/vodshow/(\d+)-", href)
            if m:
                cid = int(m.group(1))
                name = a.get_text(strip=True)
                if name and cid not in cats and name not in {
                    "全部", "重置", "时间", "人气", "评分", "更多",
                }:
                    cats[cid] = name
    log.info("识别到 %d 个分类", len(cats))
    return cats


def parse_list_page(html: str):
    """解析一个列表页，返回该页的影视条目列表 + 是否有下一页。"""
    soup = BeautifulSoup(html, "lxml")
    items = {}
    # 该站列表项结构:
    # <ul class="myui-vodlist">
    #   <li>
    #     <a class="myui-vodlist__thumb lazyload" href="/voddetail/xxx.html" data-original="封面">
    #       <span class="pic-tag"><span class="tag">8.3分</span></span>
    #       <span class="pic-text">全30集</span>
    #     </a>
    #     <div class="myui-vodlist__detail"><h4><a href="/voddetail/xxx.html" title="标题">标题</a></h4></div>
    #   </li>
    # 只取缩略图a（含封面/评分/集数信息），然后通过 h4 a 补全标题
    for li in soup.select("ul.myui-vodlist > li"):
        thumb_a = li.select_one("a.myui-vodlist__thumb[href*='/voddetail/']")
        if not thumb_a:
            continue
        href = thumb_a.get("href", "")
        m = re.search(r"/voddetail/(\d+)\.html", href)
        if not m:
            continue
        vid = int(m.group(1))
        # 标题优先 h4 中带 title 属性的 a
        title = ""
        h4a = li.select_one("h4 a[title], h4.title a")
        if h4a:
            title = h4a.get("title", "") or h4a.get_text(strip=True)
        if not title:
            title = thumb_a.get("title", "")
        # 封面
        cover = thumb_a.get("data-original") or thumb_a.get("src") or ""
        # 评分 & 集数
        score = ""
        note = ""
        stag = li.select_one(".pic-tag .tag, .pic-tag span.tag")
        if stag:
            score = stag.get_text(strip=True)
        ntag = li.select_one(".pic-text")
        if ntag:
            note = ntag.get_text(strip=True)
        if not title:
            continue
        items[vid] = {
            "id": vid,
            "title": title,
            "url": to_abs_url(href),
            "score": score,
            "note": note,
            "cover": to_abs_url(cover),
        }
    items = list(items.values())

    # 分页：只从分页区 myui-page 中识别页码（避免把年份2026误判成页码）
    max_page = 1
    pager = soup.select_one("ul.myui-page, .pagination, .page")
    if pager:
        for a in pager.find_all("a", href=True):
            href = a["href"]
            pm = re.search(r"/vodshow/\d+-+(\d+)-*\.html", href)
            if pm:
                p = int(pm.group(1))
                if p > max_page:
                    max_page = p
            pm2 = re.search(r"/vodtype/\d+-(\d+)\.html", href)
            if pm2:
                p = int(pm2.group(1))
                if p > max_page:
                    max_page = p
    return items, max_page, bool(pager)


def crawl_category(session: requests.Session, cid: int, cname: str,
                   max_pages: int = 0, delay: float = 0.3,
                   state: dict = None):
    """爬取单个分类下的所有列表页，返回去重后的条目列表。

    苹果CMS(mytheme) 分页URL格式: /vodshow/{cid}--------{page}---.html
    （cid 和 page 之间共 8 个短横线；该站还有 /vodtype/{cid}.html 作为第1页入口）
    """
    collected = {}
    page = 1
    pages_seen_max = 1
    while True:
        if max_pages and page > max_pages:
            break
        # 第一页使用 /vodtype/{cid}.html（或 /vodshow/{cid}-----------.html 都能访问），
        # 后续页使用 /vodshow/{cid}--------{page}---.html（8个-）
        if page == 1:
            url = f"{BASE_URL}/vodshow/{cid}-----------.html"
            alt_url = f"{BASE_URL}/vodtype/{cid}.html"
        else:
            url = f"{BASE_URL}/vodshow/{cid}--------{page}---.html"
            alt_url = url
        try:
            resp = polite_get(session, url, delay=delay)
            html = resp.text
            items, total_pages, _ = parse_list_page(html)
            # 若第一页在主URL无数据，则尝试 vodtype 入口（主分类1/2/3/4会跳转到vodtype）
            if page == 1 and not items:
                html = polite_get(session, alt_url, delay=delay).text
                items, total_pages, _ = parse_list_page(html)
        except Exception as e:
            log.warning("[%s] 第%d页抓取失败：%s", cname, page, e)
            break
        if not items:
            log.info("[%s] 第%d页无数据，结束", cname, page)
            break
        before = len(collected)
        for it in items:
            it["category_id"] = cid
            it["category"] = cname
            collected[it["id"]] = it
        log.info("[%s] 第%d页 本页%d条 / 累计%d条 (总页数~%d)",
                 cname, page, len(items), len(collected), total_pages)
        # 页面自带的总页数更准确
        if total_pages > pages_seen_max:
            pages_seen_max = total_pages
        if page >= pages_seen_max:
            break
        page += 1
        if state is not None:
            state["list_pages"] = state.get("list_pages", 0) + 1
    log.info("[%s] 完成，共 %d 条", cname, len(collected))
    return list(collected.values())


# ========== 抓取：详情页 ==========
# 详情区 <p class="data"> 结构：
#   分类：<a>日韩剧</a>  地区：<a>韩国</a>  年份：<a>2026</a>
#   更新：<span class="text-red">2026-09-09 23:56</span>
#   主演：<a>..</a> <a>..</a>
#   导演：<a>..</a>
#   简介：正文... <a href="#desc">详情</a>
def crawl_detail(session: requests.Session, vid: int, delay: float = 0.3) -> dict:
    """抓取单个影视的详情页，返回详情字典（不含播放源）。"""
    url = f"{BASE_URL}/voddetail/{vid}.html"
    try:
        html = polite_get(session, url, delay=delay).text
    except Exception as e:
        log.warning("详情页 %d 抓取失败：%s", vid, e)
        return {"id": vid, "detail_url": url, "_error": str(e)}

    soup = BeautifulSoup(html, "lxml")
    info = {"id": vid, "detail_url": url}

    # 标题
    h1 = soup.find("h1")
    if h1:
        info["title"] = h1.get_text(strip=True)

    # 封面
    cover_el = soup.select_one(".myui-content__thumb img, .module-item-pic img, .myui-pic img")
    if cover_el:
        info["cover"] = to_abs_url(cover_el.get("data-original") or cover_el.get("src", ""))

    # 评分
    score_el = soup.select_one(".branch, .score .branch, #rating .branch")
    if score_el:
        info["rating"] = score_el.get_text(strip=True)

    detail_div = soup.select_one(".myui-content__detail")
    meta = {"category": [], "area": [], "year": [], "actors": [],
            "director": [], "updated": ""}

    if detail_div:
        # 面包屑 (首页 > 子分类 > 片名) 作为基础分类
        crumb = soup.select(".myui-breadcrumb a, .breadcrumb a, #content-container > a")
        crumb_names = [a.get_text(strip=True) for a in crumb
                       if a.get_text(strip=True) and a.get_text(strip=True) != "首页"]
        meta["category"] = list(dict.fromkeys(crumb_names))  # 去重保序

        for p in detail_div.find_all("p", class_="data"):
            p_text = p.get_text(" ", strip=True)
            a_list = [(a, a.get_text(strip=True)) for a in p.find_all("a")]
            a_list = [(a, t) for a, t in a_list if t]
            red = p.find("span", class_="text-red")
            if red and "更新" in p_text:
                meta["updated"] = red.get_text(strip=True)
                continue
            # 分类 / 地区 / 年份 混在同一个 <p>，根据 a 文本在整段文字中的位置
            # 位于哪个 label（分类：/地区：/年份：）之后，就归属到哪个字段
            segments = [("分类：", "category"), ("地区：", "area"), ("年份：", "year")]
            if any(lab in p_text for lab, _ in segments):
                for a, txt in a_list:
                    a_pos = p_text.find(txt)
                    best_key, best_pos = None, -1
                    for lab, key in segments:
                        pos = p_text.find(lab)
                        if 0 <= pos < a_pos and pos > best_pos:
                            best_pos = pos
                            best_key = key
                    if best_key == "category":
                        if txt not in meta["category"]:
                            meta["category"].append(txt)
                    elif best_key == "area":
                        meta["area"] = [txt]
                    elif best_key == "year":
                        meta["year"] = [txt]
            elif "主演" in p_text:
                meta["actors"] = [t for _, t in a_list]
            elif "导演" in p_text:
                meta["director"] = [t for _, t in a_list]

        # 简介
        desc = ""
        sketch = soup.select_one(".content .sketch, .sketch.content, #desc .content")
        if sketch:
            desc = sketch.get_text(" ", strip=True)
            # 去掉末尾多余的"详情"字样
            desc = re.sub(r"\s*详情\s*$", "", desc).strip()
            # 若文本因为展开/折叠存在完全重复则去重
            if len(desc) > 10:
                half = len(desc) // 2
                if desc[:half].strip() == desc[half:].strip():
                    desc = desc[:half].strip()
        if desc:
            meta["description"] = desc

    info["categories"] = meta["category"]
    info["area"] = meta["area"][0] if meta["area"] else ""
    info["year"] = meta["year"][0] if meta["year"] else ""
    info["actors"] = meta["actors"]
    info["director"] = meta["director"][0] if meta["director"] else ""
    info["updated_at"] = meta["updated"]
    info["description"] = meta.get("description", "")

    # 播放源（播放列表分组，每个 <div id="playlistN"> 为一个源）
    play_sources = []
    for tab in soup.select('[id^="playlist"]'):
        src_name = ""
        # 对应的 tab 头名称
        tid = tab.get("id", "")
        tab_head = soup.select_one(f'a[href="#{tid}"]')
        if tab_head:
            src_name = tab_head.get_text(strip=True)
        episodes = []
        for a in tab.select("a[href*='/vodplay/']"):
            href = a.get("href", "")
            m = re.match(r"/vodplay/(\d+)-(\d+)-(\d+)\.html", href)
            if m:
                episodes.append({
                    "name": a.get_text(strip=True),
                    "vid": int(m.group(1)),
                    "sid": int(m.group(2)),
                    "nid": int(m.group(3)),
                    "play_url": to_abs_url(href),
                })
        if episodes:
            play_sources.append({"source": src_name or f"线路{len(play_sources)+1}",
                                 "episodes": episodes})
    info["play_sources"] = play_sources
    return info


# ========== 抓取：播放页（视频地址） ==========
# 页面里包含：
#   var player_data = {"flag":"play","encrypt":2,...,"url":"<base64(enc)>","from":"vidjs25",...}
PLAYER_DATA_RE = re.compile(r"var\s+player_data\s*=\s*(\{.*?\})\s*</script>", re.S)

def crawl_play_url(session: requests.Session, vid: int, sid: int, nid: int,
                   delay: float = 0.2) -> dict:
    """抓取单个播放页面并解密得到直链地址。"""
    url = f"{BASE_URL}/vodplay/{vid}-{sid}-{nid}.html"
    try:
        html = polite_get(session, url, delay=delay).text
    except Exception as e:
        return {"vid": vid, "sid": sid, "nid": nid, "play_page": url, "_error": str(e)}
    m = PLAYER_DATA_RE.search(html)
    result = {"vid": vid, "sid": sid, "nid": nid, "play_page": url}
    if not m:
        result["_error"] = "player_data not found"
        return result
    try:
        data = json.loads(m.group(1))
    except json.JSONDecodeError as e:
        result["_error"] = f"json parse error: {e}"
        return result
    enc = data.get("url", "")
    enc_next = data.get("url_next", "")
    result["raw_encrypt"] = data.get("encrypt", 0)
    result["from"] = data.get("from", "")
    result["note"] = data.get("note", "")
    result["video_url"] = decrypt_url(enc) if enc else ""
    result["video_url_next"] = decrypt_url(enc_next) if enc_next else ""
    result["vod_name_enc"] = data.get("vod_data", {}).get("vod_name", "")
    return result


# ========== 封面下载 ==========
def download_cover(session: requests.Session, url: str, save_dir: Path, vid: int):
    if not url:
        return ""
    try:
        ext = os.path.splitext(urllib.parse.urlparse(url).path)[1] or ".jpg"
        fp = save_dir / f"{vid}{ext}"
        if fp.exists():
            return str(fp)
        r = session.get(url, timeout=TIMEOUT, headers={**HEADERS, "Referer": BASE_URL+"/"})
        r.raise_for_status()
        fp.write_bytes(r.content)
        return str(fp)
    except Exception as e:
        log.debug("封面下载失败 %s: %s", url, e)
        return ""


# ========== 视频下载（ffmpeg） ==========
def download_video_ffmpeg(url: str, save_path: str, headers: dict = None):
    import subprocess
    cmd = ["ffmpeg", "-y", "-allowed_extensions", "ALL",
           "-protocol_whitelist", "file,http,https,tcp,tls,crypto"]
    if headers:
        for k, v in headers.items():
            cmd += ["-headers", f"{k}: {v}\r\n"]
    cmd += ["-i", url, "-c", "copy", "-bsf:a", "aac_adtstoasc", save_path]
    subprocess.run(cmd, check=True)


# ========== 主流程 ==========
def main():
    parser = argparse.ArgumentParser(description="独播库(www.dbku.tv)全站爬虫")
    parser.add_argument("--types", type=int, nargs="*", default=None,
                        help="要抓取的分类ID，默认所有主分类。1=电影 2=连续剧 3=综艺 4=动漫")
    parser.add_argument("--max-pages", type=int, default=0,
                        help="每个分类最多抓多少页，0=全部页")
    parser.add_argument("--workers", type=int, default=4, help="并发线程数")
    parser.add_argument("--delay", type=float, default=0.3, help="基础请求延迟(秒)")
    parser.add_argument("--fetch-play-url", action="store_true",
                        help="是否抓取每个播放页的视频直链(m3u8)")
    parser.add_argument("--download", action="store_true",
                        help="是否下载视频(需要安装ffmpeg，默认仅抓取直链)")
    parser.add_argument("--download-dir", type=str, default="./output/videos",
                        help="视频下载目录")
    parser.add_argument("--download-covers", action="store_true",
                        help="是否下载封面图")
    parser.add_argument("--output", type=str, default="./output", help="输出目录")
    parser.add_argument("--resume", action="store_true", help="断点续爬")
    args = parser.parse_args()

    out_dir = Path(args.output)
    out_dir.mkdir(parents=True, exist_ok=True)
    (out_dir / "images").mkdir(parents=True, exist_ok=True)

    session = make_session()

    # 1. 获取全部分类
    log.info("正在获取分类列表...")
    all_cats = fetch_category_ids(session)
    if args.types:
        cats = {tid: name for tid, name in all_cats.items() if tid in args.types}
        # 如果指定了主分类，同时包含该主分类下默认抓到的子分类
        if not cats:
            cats = {tid: all_cats.get(tid, f"cat{tid}") for tid in args.types}
    else:
        cats = MAIN_CATEGORIES  # 默认只抓4大主分类
    log.info("即将抓取分类：%s", cats)

    # 2. 列表抓取
    index_path = out_dir / "dbku_index.json"
    if args.resume and index_path.exists():
        log.info("从断点恢复索引 %s", index_path)
        index_data = json.loads(index_path.read_text(encoding="utf-8"))
        all_items = {it["id"]: it for it in index_data.get("items", [])}
    else:
        all_items = {}

    state = {"list_pages": 0}
    for cid, cname in cats.items():
        log.info("===== 开始抓取分类 [%s] id=%d =====", cname, cid)
        items = crawl_category(session, cid, cname,
                               max_pages=args.max_pages,
                               delay=args.delay, state=state)
        for it in items:
            # 合并时保留首次见到的更完整字段
            if it["id"] in all_items:
                old = all_items[it["id"]]
                for k, v in it.items():
                    if not old.get(k) and v:
                        old[k] = v
                if cname not in old.get("categories", []):
                    old.setdefault("categories", []).append(cname)
            else:
                it["categories"] = [cname]
                all_items[it["id"]] = it
        # 每抓完一个分类保存一次
        (index_path.parent).mkdir(parents=True, exist_ok=True)
        index_path.write_text(json.dumps({
            "base_url": BASE_URL,
            "fetched_at": time.strftime("%Y-%m-%d %H:%M:%S"),
            "total": len(all_items),
            "items": list(all_items.values()),
        }, ensure_ascii=False, indent=2), encoding="utf-8")
        log.info("索引已保存到 %s（%d 条）", index_path, len(all_items))

    log.info("列表抓取完成，共 %d 部影视", len(all_items))

    # 3. 详情抓取
    detail_path = out_dir / "dbku_detail.json"
    if args.resume and detail_path.exists():
        details = {int(k): v for k, v in json.loads(
            detail_path.read_text(encoding="utf-8")).items()}
    else:
        details = {}

    todo_vids = [vid for vid in all_items.keys() if vid not in details]
    log.info("待抓取详情：%d 部", len(todo_vids))

    def _detail_worker(vid):
        d = crawl_detail(session, vid, delay=args.delay)
        if args.download_covers and d.get("cover"):
            d["cover_local"] = download_cover(
                session, d["cover"], out_dir / "images", vid)
        return vid, d

    done = 0
    with ThreadPoolExecutor(max_workers=args.workers) as ex:
        futs = [ex.submit(_detail_worker, vid) for vid in todo_vids]
        for fut in as_completed(futs):
            vid, d = fut.result()
            details[vid] = d
            done += 1
            if done % 50 == 0 or done == len(todo_vids):
                log.info("详情进度 %d/%d", done, len(todo_vids))
                detail_path.write_text(
                    json.dumps(details, ensure_ascii=False, indent=2),
                    encoding="utf-8")

    detail_path.write_text(
        json.dumps(details, ensure_ascii=False, indent=2), encoding="utf-8")
    log.info("详情已保存到 %s", detail_path)

    # 4. 播放地址抓取（每个播放页 -> m3u8/mp4）
    if args.fetch_play_url:
        play_path = out_dir / "dbku_play_urls.json"
        if args.resume and play_path.exists():
            play_urls = {tuple(k.split("-")): v for k, v in json.loads(
                play_path.read_text(encoding="utf-8")).items()}
        else:
            play_urls = {}

        todo_ep = []
        for vid, d in details.items():
            for src in d.get("play_sources", []):
                for ep in src.get("episodes", []):
                    key = (str(vid), str(ep["sid"]), str(ep["nid"]))
                    if key not in play_urls or play_urls[key].get("_error"):
                        todo_ep.append((vid, ep["sid"], ep["nid"], src["source"], ep["name"]))
        log.info("待抓取播放地址：%d 集", len(todo_ep))

        def _play_worker(job):
            vid, sid, nid, src_name, ep_name = job
            r = crawl_play_url(session, vid, sid, nid, delay=args.delay)
            r["source"] = src_name
            r["episode"] = ep_name
            return (str(vid), str(sid), str(nid)), r

        done = 0
        with ThreadPoolExecutor(max_workers=args.workers) as ex:
            futs = [ex.submit(_play_worker, j) for j in todo_ep]
            for fut in as_completed(futs):
                key, r = fut.result()
                play_urls[key] = r
                done += 1
                if done % 100 == 0 or done == len(todo_ep):
                    log.info("播放地址进度 %d/%d  当前直链示例：%s",
                             done, len(todo_ep), r.get("video_url", "")[:80])
                    flat = {f"{k[0]}-{k[1]}-{k[2]}": v for k, v in play_urls.items()}
                    play_path.write_text(
                        json.dumps(flat, ensure_ascii=False, indent=2),
                        encoding="utf-8")

        flat = {f"{k[0]}-{k[1]}-{k[2]}": v for k, v in play_urls.items()}
        play_path.write_text(
            json.dumps(flat, ensure_ascii=False, indent=2), encoding="utf-8")
        log.info("播放地址已保存到 %s", play_path)

        # 5. 视频下载（可选，需 ffmpeg）
        if args.download:
            vdir = Path(args.download_dir)
            vdir.mkdir(parents=True, exist_ok=True)
            log.info("开始下载视频到 %s", vdir)
            ok = 0
            fail = 0
            for (vid, sid, nid), info in play_urls.items():
                vurl = info.get("video_url", "")
                if not vurl:
                    fail += 1
                    continue
                det = details.get(int(vid), {})
                title = det.get("title", f"vid{vid}")
                ep = info.get("episode", f"{sid}-{nid}")
                safe = re.sub(r'[\\/:*?"<>|]', "_", f"{title}_{ep}")
                out_file = vdir / f"{safe}.mp4"
                if out_file.exists():
                    ok += 1
                    continue
                try:
                    log.info("下载：%s", out_file.name)
                    download_video_ffmpeg(
                        vurl, str(out_file),
                        headers={"Referer": BASE_URL + "/",
                                 "User-Agent": HEADERS["User-Agent"]})
                    ok += 1
                except Exception as e:
                    log.warning("下载失败 %s：%s", safe, e)
                    fail += 1
            log.info("下载完成：成功 %d / 失败 %d", ok, fail)

    # 6. 导出 CSV（简易索引表）
    csv_path = out_dir / "dbku_videos.csv"
    with csv_path.open("w", newline="", encoding="utf-8-sig") as f:
        w = csv.writer(f)
        w.writerow(["ID", "标题", "分类", "地区", "年份", "评分", "导演",
                    "主演", "更新时间", "集数", "详情页", "封面"])
        for vid, d in sorted(details.items()):
            eps = 0
            for s in d.get("play_sources", []):
                eps = max(eps, len(s.get("episodes", [])))
            w.writerow([
                vid,
                d.get("title", ""),
                "/".join(d.get("categories", [])),
                d.get("area", ""),
                d.get("year", ""),
                d.get("rating", ""),
                d.get("director", ""),
                ",".join(d.get("actors", [])),
                d.get("updated_at", ""),
                eps,
                d.get("detail_url", ""),
                d.get("cover", ""),
            ])
    log.info("CSV索引已保存到 %s", csv_path)

    log.info("===== 全部完成 =====")
    log.info("输出目录：%s", out_dir.resolve())
    log.info("  - 索引  %s", index_path)
    log.info("  - 详情  %s", detail_path)
    if args.fetch_play_url:
        log.info("  - 直链  %s", play_path)
    log.info("  - CSV   %s", csv_path)


if __name__ == "__main__":
    main()
