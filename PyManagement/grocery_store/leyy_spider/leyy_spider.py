#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
乐影院 (https://leyy.tv/) 全站爬虫
=============================================
功能:
  1. 抓取电影/电视剧/综艺/动漫/纪录片 全部分类列表
  2. 进入每个视频详情页, 抓取元数据(片名/封面/导演/演员/年份/地区/类型/简介/评分)
  3. 抓取所有播放源的所有集数, 解密RC4加密的真实m3u8播放地址
  4. 数据保存为 JSON / CSV, 支持增量(断点续爬)

依赖:
  pip install requests beautifulsoup4 lxml

用法:
  python leyy_spider.py                 # 默认全量爬取所有分类
  python leyy_spider.py -t 1            # 只爬电影(typeid=1)
  python leyy_spider.py -t 2 --max-pages 10   # 电视剧只爬前10页
  python leyy_spider.py --delay 1       # 设置请求间隔1秒
"""

import argparse
import csv
import json
import os
import re
import sys
import time
from pathlib import Path
from urllib.parse import urljoin

import requests
from bs4 import BeautifulSoup

# ================== 配置 ==================
BASE_URL = "https://leyy.tv"
DEFAULT_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/128.0.0.0 Safari/537.36"
    ),
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
    "Referer": BASE_URL + "/",
}

# 分类映射
CATEGORIES = {
    1: "电影",
    2: "电视剧",
    3: "综艺",
    4: "动漫",
    6: "纪录片",
}

# RC4 解密密钥 (来自页面JS: const key = "i_love_you")
RC4_KEY = "i_love_you"

# 输出目录
OUTPUT_DIR = Path("leyy_data")
OUTPUT_DIR.mkdir(exist_ok=True)


# ================== RC4解密 ==================
def rc4_decrypt(encrypted_hex: str, key: str = RC4_KEY) -> str:
    """RC4解密, 还原页面中加密的视频地址 (与JS端逻辑完全一致)"""
    try:
        encrypted_bytes = bytes.fromhex(encrypted_hex)
    except ValueError:
        return ""

    # KSA
    S = list(range(256))
    j = 0
    key_len = len(key)
    for i in range(256):
        j = (j + S[i] + ord(key[i % key_len])) % 256
        S[i], S[j] = S[j], S[i]

    # PRGA
    i = 0
    j = 0
    out = bytearray()
    for byte in encrypted_bytes:
        i = (i + 1) % 256
        j = (j + S[i]) % 256
        S[i], S[j] = S[j], S[i]
        k = S[(S[i] + S[j]) % 256]
        out.append(byte ^ k)

    return out.decode("utf-8", errors="replace")


# ================== 网络请求 ==================
class Session:
    def __init__(self, delay: float = 0.5, timeout: int = 15, retries: int = 3):
        self.delay = delay
        self.timeout = timeout
        self.retries = retries
        self.s = requests.Session()
        self.s.headers.update(DEFAULT_HEADERS)
        self._last_req = 0

    def get(self, url: str, **kwargs) -> requests.Response | None:
        # 简单限速
        wait = self.delay - (time.time() - self._last_req)
        if wait > 0:
            time.sleep(wait)
        for attempt in range(self.retries):
            try:
                resp = self.s.get(url, timeout=self.timeout, **kwargs)
                resp.raise_for_status()
                # 自动检测编码 (该站使用utf-8, 但requests有时会误判)
                if not resp.encoding or resp.encoding.lower() == "iso-8859-1":
                    resp.encoding = resp.apparent_encoding or "utf-8"
                self._last_req = time.time()
                return resp
            except requests.RequestException as e:
                print(f"  [!] 请求失败({attempt+1}/{self.retries}): {url} -> {e}")
                time.sleep(2 * (attempt + 1))
        return None


# ================== 列表页解析 ==================
def parse_list_page(html: str) -> tuple[list[dict], int]:
    """解析分类列表页, 返回 (视频条目列表, 总页数)"""
    soup = BeautifulSoup(html, "lxml")
    items = []

    # 策略: 先找h2/h3/h4标题(里面的a是带纯标题的详情链接), 再找外层卡片a(含封面/标签)
    # 列表页里标题形如 <h2><a href="/vodplay/120641-1-1.html">怨鬼网红</a></h2>
    for h in soup.select("h2 a[href*='/vodplay/'], h3 a[href*='/vodplay/'], h4 a[href*='/vodplay/']"):
        href = h.get("href", "")
        m = re.search(r"/vodplay/(\d+)-", href)
        if not m:
            continue
        vid = int(m.group(1))
        title = h.get_text(strip=True)
        if any(it["id"] == vid for it in items):
            continue
        items.append({
            "id": vid,
            "title": title,
            "cover": "",
            "url": urljoin(BASE_URL, f"/vodplay/{vid}-1-1.html"),
            "list_text": title,
        })

    # 补充封面: 找包裹同vid的卡片a(通常含img和完整的标签文本)
    vid_to_item = {it["id"]: it for it in items}
    for a in soup.select('a[href*="/vodplay/"]'):
        href = a.get("href", "")
        m = re.search(r"/vodplay/(\d+)-", href)
        if not m:
            continue
        vid = int(m.group(1))
        if vid not in vid_to_item:
            continue
        img = a.find("img")
        if img and not vid_to_item[vid]["cover"]:
            vid_to_item[vid]["cover"] = img.get("data-src") or img.get("src") or ""

    # 解析总页数: 找"尾页"链接, 格式 /vodshow/1--------2272---.html
    total_pages = 1
    for a in soup.select("a"):
        t = a.get_text(strip=True)
        if t == "尾页":
            m = re.search(r"--------(\d+)---", a.get("href", ""))
            if m:
                total_pages = int(m.group(1))
                break
    # 备选: 从分页数字中找最大值
    if total_pages == 1:
        nums = []
        for a in soup.select(".page a, .pages a, .pagination a"):
            if re.fullmatch(r"\d+", a.get_text(strip=True)):
                nums.append(int(a.get_text(strip=True)))
        if nums:
            total_pages = max(nums)

    return items, total_pages


def crawl_category(session: Session, type_id: int, max_pages: int = 0,
                   crawled_ids: set = None) -> list[dict]:
    """抓取某一分类的全部/指定页视频列表"""
    if crawled_ids is None:
        crawled_ids = set()
    cat_name = CATEGORIES.get(type_id, f"分类{type_id}")
    print(f"\n[*] 开始抓取分类: {cat_name} (typeid={type_id})")

    # 先抓第1页, 获取总页数
    first_url = f"{BASE_URL}/vodshow/{type_id}-----------.html"
    resp = session.get(first_url)
    if not resp:
        print(f"  [!] 无法访问分类首页: {first_url}")
        return []

    items, total_pages = parse_list_page(resp.text)
    pages_to_crawl = total_pages if max_pages <= 0 else min(max_pages, total_pages)
    print(f"  [i] 总页数: {total_pages}, 本次计划抓取: {pages_to_crawl} 页")

    all_items = []
    seen = set(crawled_ids)
    # 加入第1页结果
    for it in items:
        if it["id"] not in seen:
            it["type_id"] = type_id
            it["type_name"] = cat_name
            all_items.append(it)
            seen.add(it["id"])

    # 抓剩余页
    for page in range(2, pages_to_crawl + 1):
        url = f"{BASE_URL}/vodshow/{type_id}--------{page}---.html"
        resp = session.get(url)
        if not resp:
            continue
        items, _ = parse_list_page(resp.text)
        new_count = 0
        for it in items:
            if it["id"] not in seen:
                it["type_id"] = type_id
                it["type_name"] = cat_name
                all_items.append(it)
                seen.add(it["id"])
                new_count += 1
        print(f"  [i] 第{page}/{pages_to_crawl}页, 新增{new_count}部, 累计{len(all_items)}部")

    print(f"  [✓] 分类 [{cat_name}] 抓取完成, 共{len(all_items)}部视频")
    return all_items


# ================== 详情页解析 ==================
def parse_detail_page(html: str, vid: int) -> dict:
    """解析播放/详情页, 提取元数据和所有播放源/集数的真实地址"""
    soup = BeautifulSoup(html, "lxml")
    result = {
        "id": vid,
        "title": "",
        "year": "",
        "score": "",
        "cover": "",
        "description": "",
        "director": [],
        "actor": [],
        "genre": [],
        "area": "",
        "release_date": "",
        "play_sources": [],  # [{"source":"天堂", "episodes":[{"ep":"第1集","url":"m3u8..."}]}]
    }

    # -------- 1. 从 JSON-LD 取结构化数据 (最稳定) --------
    for script in soup.find_all("script", type="application/ld+json"):
        try:
            data = json.loads(script.string or "{}")
        except (json.JSONDecodeError, TypeError):
            continue

        # JSON-LD可能是 @graph 数组
        items = data.get("@graph", [data]) if isinstance(data, dict) else [data]
        for it in items:
            if not isinstance(it, dict):
                continue
            it_type = it.get("@type", "")
            if it_type in ("Movie", "TVSeries", "TVEpisode"):
                result["title"] = it.get("name", result["title"])
                result["cover"] = it.get("image", result["cover"])
                desc = it.get("description", "")
                # 简介会以"在线观看《XXX》..."开头, 清理掉模板话术保留真实剧情
                if desc:
                    # 去掉前缀"在线观看《XXX》电影/电视剧。XXX主要讲述："
                    desc = re.sub(r"^在线观看《[^》]+》[^。]*。", "", desc)
                    # 去掉结尾"乐影院提供高清..."广告
                    desc = re.sub(r"乐影院提供.*$", "", desc).strip("。 ，,")
                result["description"] = desc or it.get("description", "")
                result["release_date"] = it.get("datePublished", "")
                if "director" in it:
                    directors = it["director"]
                    if isinstance(directors, list):
                        result["director"] = [d.get("name", "") for d in directors if isinstance(d, dict)]
                    elif isinstance(directors, dict):
                        result["director"] = [directors.get("name", "")]
                if "actor" in it:
                    actors = it["actor"]
                    if isinstance(actors, list):
                        result["actor"] = [a.get("name", "") for a in actors if isinstance(a, dict)]
                    elif isinstance(actors, dict):
                        result["actor"] = [actors.get("name", "")]
                # 评分
                ar = it.get("aggregateRating")
                if isinstance(ar, dict):
                    result["score"] = ar.get("ratingValue", result["score"])
                # datePublished 提取年份
                date = it.get("datePublished", "")
                m = re.search(r"(\d{4})", date)
                if m:
                    result["year"] = m.group(1)

    # -------- 2. 从 <title> 标签和页面h2补充信息 --------
    # 页面 title 形如 "怨鬼网红 - 在线观看 - 电影 - 乐影院"
    title_tag = soup.find("title")
    if title_tag:
        t = title_tag.get_text(strip=True)
        m = re.match(r"(.+?)\s*-\s*在线观看", t)
        if m and not result["title"]:
            result["title"] = m.group(1).strip()

    # 详情页中的影片标题通常在内容区的h1/h2, 排除logo(h1 class=logo)
    for h in soup.find_all(["h1", "h2"]):
        cls = " ".join(h.get("class", []))
        if "logo" in cls:
            continue
        text = h.get_text(strip=True)
        # 形如 "怨鬼网红 (2026) 7.4"
        m = re.match(r"(.+?)\s*\((\d{4})\)\s*([\d.]+)?", text)
        if m:
            if not result["title"]:
                result["title"] = m.group(1).strip()
            if not result["year"] and m.group(2):
                result["year"] = m.group(2)
            if not result["score"] and m.group(3):
                result["score"] = m.group(3)
            break

    # -------- 3. 从标签链接补全类型/地区/演员 --------
    # URL格式: /vodsearch/<by>-<letter>-<area>-<lang>-<type>---...
    # 例: /vodsearch/----%E6%81%90%E6%80%96---------.html -> 第5段(按--分割)是类型
    KNOWN_AREAS = {"中国大陆", "中国香港", "中国台湾", "美国", "日本", "韩国", "泰国",
                   "英国", "法国", "德国", "印度", "西班牙", "意大利", "加拿大",
                   "马来西亚", "澳大利亚", "俄罗斯", "香港", "台湾", "其他", "其它",
                   "新加坡", "波兰", "挪威", "丹麦", "芬兰", "瑞典", "罗马尼亚",
                   "新西兰", "希腊", "巴西"}
    for a in soup.select("a[href*='/vodsearch/']"):
        href = a.get("href", "")
        text = a.get_text(strip=True)
        if not text or len(text) > 20:
            continue
        if text in KNOWN_AREAS:
            result["area"] = text
            continue
        # 通过URL路径区分: /vodsearch/ 后面是 by-letter-area-lang-type---year--order.html
        # 数字段之间以 - 分隔, 空段为 -
        # 演员链接(按主演搜): /vodsearch/-----Athit+Ariyawongsa--------.html
        #                    位置  1111122222...  (前5段为空, 第6段是人名)
        # 类型链接: /vodsearch/----%E6%81%90%E6%80%96---------.html
        #                    位置  11112222...  (前4段为空, 第5段是类型)
        # 地区链接: /vodsearch/--%E6%B3%B0%E5%9B%BD-----------.html
        #                    位置  11222...     (前2段为空, 第3段是地区)
        path = href.split("/vodsearch/")[-1].rstrip(".html")
        # 去掉开头非中文字符前的空段
        # 统计前缀连续 "-" 的数量, 即连续空段数
        m_dash = re.match(r"^(-+)", path)
        leading_dashes = len(m_dash.group(1)) if m_dash else 0
        # leading_dashes == 5 => 演员/导演; == 4 => 类型; == 2 => 地区; == 其他 => 其他筛选项
        if leading_dashes >= 5:
            # 演员/导演人名, 跳过
            continue
        if leading_dashes == 4:
            # 这是类型
            if text in ("推荐", "华语", "欧美", "国内", "国外", "国漫", "番剧"):
                continue
            if text not in result["genre"]:
                result["genre"].append(text)

    # -------- 4. 从 inline script 中取 urlDictionary + 播放源信息 --------
    # 提取 urlDictionary
    url_dict = {}
    for script in soup.find_all("script"):
        txt = script.string or ""
        if "urlDictionary" not in txt or "rc4Decrypt" not in txt:
            continue

        # 解析 urlDictionary[sid][nid] = "hexstr"
        pattern = r"urlDictionary\[(\d+)\]\[(\d+)\]\s*=\s*\"([0-9a-fA-F]+)\""
        for m in re.finditer(pattern, txt):
            sid = int(m.group(1))
            nid = int(m.group(2))
            enc = m.group(3)
            url_dict.setdefault(sid, {})[nid] = enc
        break  # 取到目标script即可

    # -------- 5. 解析播放源与集数(DOM) --------
    # 播放源标签: header dt[data-sid="N"]
    # 集数列表: .sort-list li[data-sid=][data-nid=] a
    play_sources = []
    source_names = {}
    # 播放源按钮通常在 header dt 中 (天堂 / 速播 / 金鹰 / 红牛 / 新浪 / 豆瓣)
    for dt in soup.select("dt[data-sid]"):
        sid = int(dt.get("data-sid", "0"))
        name = dt.get_text(strip=True)
        # 移除括号中的数字, 如"天堂(1)" -> "天堂"
        name = re.sub(r"\(\d+\)$", "", name).strip()
        if name and sid:
            source_names[sid] = name

    # 取每个播放源下的集数
    processed_sources = set()
    for li in soup.select(".sort-list li[data-sid][data-nid], .playlist li[data-sid][data-nid], ul li[data-sid][data-nid]"):
        sid = int(li.get("data-sid", "0"))
        nid = int(li.get("data-nid", "0"))
        a = li.find("a")
        ep_text = a.get_text(strip=True) if a else f"第{nid}集"
        enc = url_dict.get(sid, {}).get(nid, "")
        real_url = rc4_decrypt(enc) if enc else ""
        # 找到对应 source
        src_name = source_names.get(sid, f"源{sid}")
        # 放入结果
        src_entry = None
        for ps in play_sources:
            if ps["sid"] == sid:
                src_entry = ps
                break
        if src_entry is None:
            src_entry = {"sid": sid, "source_name": src_name, "episodes": []}
            play_sources.append(src_entry)
        src_entry["episodes"].append({
            "nid": nid,
            "episode": ep_text,
            "play_url": f"{BASE_URL}/vodplay/{vid}-{sid}-{nid}.html",
            "video_url": real_url,
        })

    # 补充: 如果DOM没取到, 直接从urlDictionary构造
    if not play_sources and url_dict:
        for sid, eps in url_dict.items():
            src_entry = {"sid": sid, "source_name": source_names.get(sid, f"源{sid}"), "episodes": []}
            for nid in sorted(eps.keys()):
                enc = eps[nid]
                real_url = rc4_decrypt(enc)
                src_entry["episodes"].append({
                    "nid": nid,
                    "episode": f"第{nid}集" if nid > 1 else "第1集/正片",
                    "play_url": f"{BASE_URL}/vodplay/{vid}-{sid}-{nid}.html",
                    "video_url": real_url,
                })
            play_sources.append(src_entry)

    # 按 nid 排序集数
    for ps in play_sources:
        ps["episodes"].sort(key=lambda x: x["nid"])

    result["play_sources"] = play_sources
    return result


def crawl_detail(session: Session, vid: int) -> dict | None:
    """抓取单个视频详情"""
    url = f"{BASE_URL}/vodplay/{vid}-1-1.html"
    resp = session.get(url)
    if not resp:
        return None
    return parse_detail_page(resp.text, vid)


# ================== 保存数据 ==================
def save_json(data: list, path: Path):
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    print(f"[✓] 已保存JSON: {path} ({len(data)}条)")


def save_csv(data: list, path: Path):
    """扁平化保存为CSV, 每部视频的每个播放源/每一集一行"""
    fields = [
        "id", "title", "type_name", "year", "score", "area",
        "genre", "director", "actor", "description", "cover",
        "source_name", "episode", "video_url", "play_url",
    ]
    with open(path, "w", encoding="utf-8-sig", newline="") as f:
        w = csv.DictWriter(f, fieldnames=fields)
        w.writeheader()
        for item in data:
            base = {
                "id": item.get("id", ""),
                "title": item.get("title", ""),
                "type_name": item.get("type_name", ""),
                "year": item.get("year", ""),
                "score": item.get("score", ""),
                "area": item.get("area", ""),
                "genre": "/".join(item.get("genre", [])),
                "director": "/".join(item.get("director", [])),
                "actor": "/".join(item.get("actor", [])),
                "description": item.get("description", ""),
                "cover": item.get("cover", ""),
            }
            sources = item.get("play_sources", [])
            if not sources:
                row = base.copy()
                row.update({"source_name": "", "episode": "", "video_url": "", "play_url": ""})
                w.writerow(row)
                continue
            for src in sources:
                for ep in src.get("episodes", []):
                    row = base.copy()
                    row.update({
                        "source_name": src.get("source_name", ""),
                        "episode": ep.get("episode", ""),
                        "video_url": ep.get("video_url", ""),
                        "play_url": ep.get("play_url", ""),
                    })
                    w.writerow(row)
    print(f"[✓] 已保存CSV: {path}")


# ================== 断点续爬状态 ==================
def load_state(path: Path) -> dict:
    if path.exists():
        with open(path, "r", encoding="utf-8") as f:
            return json.load(f)
    return {"crawled_ids": [], "videos": []}


def save_state(state: dict, path: Path):
    with open(path, "w", encoding="utf-8") as f:
        json.dump(state, f, ensure_ascii=False, indent=2)


# ================== 主流程 ==================
def main():
    parser = argparse.ArgumentParser(description="乐影院(leyy.tv)全站爬虫")
    parser.add_argument("-t", "--type", type=int, nargs="*",
                        default=list(CATEGORIES.keys()),
                        help="要爬的分类ID, 如 1 2 3 4 6 (默认全爬)")
    parser.add_argument("--max-pages", type=int, default=0,
                        help="每个分类最多爬几页, 0=全部页")
    parser.add_argument("--delay", type=float, default=0.6,
                        help="请求间隔(秒), 默认0.6")
    parser.add_argument("--no-detail", action="store_true",
                        help="只抓列表, 不进入详情页(速度快但没有真实播放地址)")
    parser.add_argument("--resume", action="store_true",
                        help="启用断点续爬, 从上次中断处继续")
    args = parser.parse_args()

    session = Session(delay=args.delay)

    type_ids = args.type
    print("=" * 60)
    print("  乐影院 (leyy.tv) 全站爬虫 启动")
    print(f"  分类: {[(t, CATEGORIES.get(t,'?')) for t in type_ids]}")
    print(f"  请求间隔: {args.delay}s, 抓详情: {not args.no_detail}")
    print("=" * 60)

    state_path = OUTPUT_DIR / "spider_state.json"
    state = load_state(state_path) if args.resume else {"crawled_ids": [], "videos": []}
    crawled_ids = set(state["crawled_ids"])

    # -------- 1. 收集所有视频列表 --------
    all_list_items = []
    for tid in type_ids:
        if tid not in CATEGORIES:
            print(f"[!] 未知分类ID: {tid}, 跳过")
            continue
        items = crawl_category(session, tid, args.max_pages)
        all_list_items.extend(items)

    # 列表去重(按vid)
    unique = {}
    for it in all_list_items:
        unique[it["id"]] = it
    all_list_items = list(unique.values())
    print(f"\n[*] 列表抓取完毕, 共 {len(all_list_items)} 部视频 (去重后)")

    # 保存列表快照
    save_json(all_list_items, OUTPUT_DIR / "video_list.json")

    if args.no_detail:
        print("[i] 已选择不抓详情, 结束。")
        return

    # -------- 2. 逐个进入详情页抓取元数据+真实播放地址 --------
    videos = state["videos"]
    existing_ids = {v["id"] for v in videos}

    todo = [it for it in all_list_items if it["id"] not in existing_ids]
    print(f"\n[*] 开始抓取详情, 待抓取: {len(todo)}部, 已完成: {len(videos)}部")

    for i, item in enumerate(todo, 1):
        vid = item["id"]
        title = item.get("title", f"ID:{vid}")
        print(f"  [{i}/{len(todo)}] 抓取: {title} (id={vid})")
        detail = crawl_detail(session, vid)
        if not detail:
            print(f"    [!] 详情抓取失败, 跳过")
            continue
        # 合并列表信息(类型名称)
        detail["type_id"] = item.get("type_id")
        detail["type_name"] = item.get("type_name", CATEGORIES.get(detail.get("type_id"), ""))
        # 列表里的封面优先补全
        if not detail.get("cover") and item.get("cover"):
            detail["cover"] = item["cover"]
        if not detail.get("title"):
            detail["title"] = title

        src_count = len(detail.get("play_sources", []))
        ep_count = sum(len(s["episodes"]) for s in detail.get("play_sources", []))
        print(f"    [✓] {detail['title']} | 年份:{detail.get('year','?')} "
              f"评分:{detail.get('score','?')} | {src_count}个源, {ep_count}集")

        videos.append(detail)
        crawled_ids.add(vid)

        # 每20部保存一次状态(断点续爬)
        if i % 20 == 0:
            state["crawled_ids"] = list(crawled_ids)
            state["videos"] = videos
            save_state(state, state_path)

    # -------- 3. 最终保存 --------
    state["crawled_ids"] = list(crawled_ids)
    state["videos"] = videos
    save_state(state, state_path)

    save_json(videos, OUTPUT_DIR / "video_detail_full.json")
    save_csv(videos, OUTPUT_DIR / "video_detail_full.csv")

    # 打印统计
    total_ep = sum(len(ep.get("episodes", []))
                   for v in videos for ep in v.get("play_sources", []))
    print("\n" + "=" * 60)
    print(f"  [✓] 全部完成!")
    print(f"  视频总数: {len(videos)}")
    print(f"  总集数/播放线路: {total_ep}")
    print(f"  输出目录: {OUTPUT_DIR.resolve()}")
    print("=" * 60)


if __name__ == "__main__":
    main()
