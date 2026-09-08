#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
茶杯狐(cupfoxyy.com) 动漫元数据采集脚本
==========================================
功能：采集动漫分类下的元数据，包含
      - 名称、评分、导演、主演/声优、类型、地区、语言、上映时间、更新状态、简介
      - 每部动漫的所有集数链接、多条播放线路
      - 播放页的 m3u8 直链地址（仅采集地址字符串，不下载视频）

合规声明：
    1. 本脚本仅采集网站公开的文本元数据（标题、简介、链接地址等）；
    2. 脚本不包含任何视频分片（.ts）下载、保存、合并逻辑；
    3. 采集到的m3u8地址仅作为数据字段打印/存储，不触发任何视频传输；
    4. 请控制请求频率，尊重robots协议，采集结果仅用于个人技术学习；
    5. 请勿将采集到的链接用于下载、传播或商用。
"""

import requests
import re
import json
import csv
import time
import random
from bs4 import BeautifulSoup
from urllib.parse import urljoin
from datetime import datetime

# ======================== 配置 ========================
BASE_URL = "https://www.cupfoxyy.com"
ANIME_CATEGORY_URL = f"{BASE_URL}/vodshow/id/4.html"  # 动漫分类
MAX_PAGES = 2                 # 采集页数（默认2页，可修改）
MAX_EPS_PER_LINE = 2          # 每条线路提取前N集的m3u8（设为None则全部提取）
DELAY_MIN = 1.2               # 请求最小间隔(秒)
DELAY_MAX = 2.5               # 请求最大间隔(秒)
TIMEOUT = 15
SAVE_CSV = True
CSV_FILENAME = f"cupfox_anime_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv"

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
                  "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Accept-Language": "zh-CN,zh;q=0.9",
}
# =======================================================


def polite_sleep():
    time.sleep(random.uniform(DELAY_MIN, DELAY_MAX))


def fetch(url, session=None, retries=3):
    s = session or requests
    for attempt in range(retries):
        try:
            resp = s.get(url, headers=HEADERS, timeout=TIMEOUT)
            resp.encoding = "utf-8"
            resp.raise_for_status()
            return resp.text
        except requests.RequestException as e:
            if attempt < retries - 1:
                wait = DELAY_MAX * (attempt + 1)
                print(f"    ⏳ 请求超时/失败，{wait:.1f}s后重试({attempt+1}/{retries})...")
                time.sleep(wait)
            else:
                print(f"    ❌ 请求失败 {url}: {e}")
                return None


def parse_category_page(html):
    """解析分类列表页，返回该页所有动漫的详情链接"""
    soup = BeautifulSoup(html, "html.parser")
    items = []
    seen = set()
    for a in soup.select("a[href^='/detail/']"):
        href = a.get("href", "")
        if href.startswith("/detail/") and href not in seen:
            seen.add(href)
            items.append(urljoin(BASE_URL, href))
    return items


def parse_detail_page(html, detail_url):
    """解析详情页，提取全部元数据"""
    soup = BeautifulSoup(html, "html.parser")
    result = {
        "title": "",
        "score": "",
        "director": "",
        "actors": "",
        "alias": "",
        "category_tags": "",   # 类型标签（如国产动漫）
        "language": "",
        "release_date": "",
        "duration": "",
        "status": "",
        "description": "",
        "play_lines": [],
        "m3u8_list": [],
        "detail_url": detail_url,
    }

    # ---------- 标题 ----------
    h1 = soup.select_one("h1")
    if h1:
        result["title"] = h1.get_text(strip=True)
    if not result["title"] and soup.title:
        t = soup.title.get_text(strip=True)
        result["title"] = t.split("-")[0].strip().strip("《》")

    # ---------- 分类标签 ----------
    tags = soup.select(".tags a.tag")
    if tags:
        result["category_tags"] = "/".join(t.get_text(strip=True) for t in tags)

    # ---------- 导演 / 主演 / 别名（精确按class定位） ----------
    # 导演
    for div in soup.select(".director"):
        name_div = div.select_one(".name")
        if name_div and "导演" in name_div.get_text():
            # 提取导演名：去掉.name子元素后的文本
            name_div.extract()
            result["director"] = div.get_text(strip=True)
            break

    # 主演
    for div in soup.select(".director"):
        name_div = div.select_one(".name")
        if name_div and "主演" in name_div.get_text():
            name_div.extract()
            result["actors"] = div.get_text(strip=True)
            break

    # 别名
    roles_div = soup.select_one(".roles")
    if roles_div:
        name_div = roles_div.select_one(".name")
        if name_div:
            name_div.extract()
            result["alias"] = roles_div.get_text(strip=True)

    # ---------- 评分 ----------
    score_tag = soup.select_one(".score")
    if score_tag:
        txt = score_tag.get_text(strip=True)
        if re.match(r'^\d+(\.\d+)?$', txt):
            result["score"] = txt

    # ---------- 更新状态 ----------
    status_tag = soup.select_one(".tag-box .tag.text-overflow")
    if status_tag:
        result["status"] = status_tag.get_text(strip=True)
    if not result["status"]:
        m = re.search(r'(更新至[第0-9a-zA-Z集期]+|已完结|完结|全\d+集)', soup.get_text())
        if m:
            result["status"] = m.group(1)

    # ---------- 语言 / 上映时间 / 片长（item模块） ----------
    # 结构: <div class="item"><div class="item-top">值</div><div class="item-bottom">标签</div></div>
    for item in soup.select(".other-box .item"):
        top = item.select_one(".item-top")
        bot = item.select_one(".item-bottom")
        if top and bot:
            val = top.get_text(strip=True)
            label = bot.get_text(strip=True)
            if "语言" in label:
                result["language"] = val
            elif "上映" in label:
                result["release_date"] = val
            elif "片长" in label:
                result["duration"] = val

    # ---------- 简介 ----------
    intro_div = soup.select_one(".vod-content .wrapper_more_text")
    if intro_div:
        # 去掉label标签
        label = intro_div.select_one("label")
        if label:
            label.extract()
        desc = intro_div.get_text(" ", strip=True)
        result["description"] = re.sub(r'\s+', ' ', desc)[:600]
    else:
        # 备用：meta description
        meta = soup.find("meta", attrs={"name": "description"})
        if meta and meta.get("content"):
            c = meta["content"]
            # 去掉前缀的站点描述
            if "剧情介绍:" in c:
                c = c.split("剧情介绍:", 1)[1]
            result["description"] = c[:600]

    # ---------- 播放线路 + 集数 ----------
    tab_links = soup.select('.nav-btn a[href^="#playlist"]')
    for t in tab_links:
        line_id = t["href"].replace("#", "")
        line_name = t.get_text(strip=True)
        ep_div = soup.find(id=line_id)
        if not ep_div:
            continue
        eps = ep_div.select("a")
        ep_list = []
        for ep in eps:
            ep_list.append({
                "ep_name": ep.get_text(strip=True),
                "ep_url": urljoin(BASE_URL, ep.get("href", "")),
            })
        if ep_list:
            result["play_lines"].append({
                "line_name": line_name,
                "episodes": ep_list,
            })

    return result


def extract_m3u8(html):
    """从播放页提取m3u8地址（仅解析文本）"""
    m = re.search(r'var\s+player_aaaa\s*=\s*(\{.*?\})\s*</script>', html, re.S)
    if m:
        try:
            data = json.loads(m.group(1))
            url = data.get("url", "")
            encrypt = data.get("encrypt", 0)
            if url and encrypt == 0 and ".m3u8" in url:
                return url
            if url and encrypt != 0:
                return f"[encrypt={encrypt}]" + url[:100]
        except json.JSONDecodeError:
            pass
    m = re.search(r'(https?://[^\s"\'<>\\]+\.m3u8[^\s"\'<>\\]*)', html)
    if m:
        return m.group(1)
    return ""


def collect_m3u8(anime, session):
    """采集m3u8地址"""
    results = []
    for line in anime["play_lines"]:
        line_name = line["line_name"]
        eps_to_process = line["episodes"]
        if MAX_EPS_PER_LINE is not None:
            eps_to_process = line["episodes"][:MAX_EPS_PER_LINE]
        print(f"      📺 线路「{line_name}」- 提取{len(eps_to_process)}集m3u8...")
        for ep in eps_to_process:
            polite_sleep()
            html = fetch(ep["ep_url"], session)
            m3u8 = extract_m3u8(html) if html else ""
            results.append({
                "line_name": line_name,
                "ep_name": ep["ep_name"],
                "m3u8_url": m3u8,
            })
            icon = "✅" if m3u8 and not m3u8.startswith("[encrypt") else ("⚠️" if m3u8 else "❌")
            print(f"        {icon} {ep['ep_name']}: {m3u8[:100]}{'...' if len(m3u8)>100 else ''}")
    return results


def save_csv(all_anime):
    with open(CSV_FILENAME, "w", encoding="utf-8-sig", newline="") as f:
        writer = csv.writer(f)
        writer.writerow([
            "动漫名称", "评分", "导演", "主演/声优", "别名", "类型标签",
            "语言", "上映时间", "片长", "更新状态",
            "简介", "详情页",
            "播放线路(名称/集数)", "集数链接样本",
            "m3u8地址(线路/集数/地址)"
        ])
        for a in all_anime:
            line_infos = []
            ep_samples = []
            for line in a["play_lines"]:
                ep_names = [e["ep_name"] for e in line["episodes"]]
                line_infos.append(f"【{line['line_name']}】{len(ep_names)}集: {', '.join(ep_names[:8])}{'...' if len(ep_names)>8 else ''}")
                for e in line["episodes"][:3]:
                    ep_samples.append(f"[{line['line_name']}|{e['ep_name']}] {e['ep_url']}")
            m3u8_infos = [f"[{m['line_name']}|{m['ep_name']}] {m['m3u8_url']}" for m in a["m3u8_list"]]

            writer.writerow([
                a["title"], a["score"], a["director"], a["actors"], a["alias"],
                a["category_tags"], a["language"], a["release_date"], a["duration"],
                a["status"], a["description"], a["detail_url"],
                "\n".join(line_infos), "\n".join(ep_samples),
                "\n".join(m3u8_infos),
            ])
    print(f"\n💾 数据已保存: {CSV_FILENAME}")


def main():
    print("=" * 72)
    print("🎬 茶杯狐动漫元数据采集器")
    print("   (仅采集公开文本元数据与m3u8地址字符串，不下载视频)")
    print("=" * 72)
    print(f"目标分类 : 动漫 (ID=4)")
    print(f"采集页数 : {MAX_PAGES} 页")
    print(f"每线取样 : {MAX_EPS_PER_LINE} 集m3u8" if MAX_EPS_PER_LINE else "每线取样 : 全部集")
    print(f"请求间隔 : {DELAY_MIN}-{DELAY_MAX}s")
    print("=" * 72)

    session = requests.Session()
    session.headers.update(HEADERS)
    all_anime = []

    for page in range(1, MAX_PAGES + 1):
        page_url = ANIME_CATEGORY_URL if page == 1 else f"{BASE_URL}/vodshow/id/4/page/{page}.html"
        print(f"\n📄 第 {page} 页: {page_url}")
        html = fetch(page_url, session)
        if not html:
            continue
        links = parse_category_page(html)
        # 去重
        exist_urls = {a["detail_url"] for a in all_anime}
        links = [l for l in links if l not in exist_urls]
        print(f"    发现 {len(links)} 部新动漫")

        for idx, durl in enumerate(links, 1):
            print(f"\n  [{page}-{idx}/{len(links)}] {durl}")
            polite_sleep()
            dh = fetch(durl, session)
            if not dh:
                continue
            anime = parse_detail_page(dh, durl)
            print(f"    📌 {anime['title']}  ⭐{anime['score']}  {anime['status']}")
            print(f"       导演: {anime['director']}")
            print(f"       主演: {anime['actors'][:50]}{'...' if len(anime['actors'])>50 else ''}")
            print(f"       标签: {anime['category_tags']} | 语言: {anime['language']} | 上映: {anime['release_date']} | 片长: {anime['duration']}")
            print(f"       简介: {anime['description'][:70]}{'...' if len(anime['description'])>70 else ''}")
            line_summary = ", ".join(
                "{}({})".format(l["line_name"], len(l["episodes"])) for l in anime["play_lines"]
            )
            print(f"       线路: {line_summary}")

            anime["m3u8_list"] = collect_m3u8(anime, session)
            all_anime.append(anime)

    # ========== 汇总 ==========
    print("\n" + "=" * 72)
    print(f"🎉 采集完成！共 {len(all_anime)} 部动漫")
    print("=" * 72)
    for i, a in enumerate(all_anime, 1):
        print(f"\n{'─'*72}")
        print(f"【{i}】《{a['title']}》 ⭐{a['score']} | {a['status']}")
        print(f"    导演: {a['director']}")
        print(f"    主演: {a['actors']}")
        print(f"    类型: {a['category_tags']} | 语言: {a['language']} | 上映: {a['release_date']} | 片长: {a['duration']}")
        print(f"    简介: {a['description'][:150]}{'...' if len(a['description'])>150 else ''}")
        print(f"    详情: {a['detail_url']}")
        print(f"    播放线路:")
        for line in a["play_lines"]:
            eps = [e["ep_name"] for e in line["episodes"]]
            print(f"      ▶ {line['line_name']} ({len(eps)}集): {', '.join(eps[:8])}{'...' if len(eps)>8 else ''}")
            for e in line["episodes"][:3]:
                print(f"          {e['ep_name']}: {e['ep_url']}")
        print(f"    m3u8直链:")
        for m in a["m3u8_list"]:
            print(f"      📺 [{m['line_name']}|{m['ep_name']}] {m['m3u8_url']}")

    if SAVE_CSV and all_anime:
        save_csv(all_anime)

    print("\n" + "=" * 72)
    print("⚠️  合规声明：本脚本仅采集公开页面的文本元数据，")
    print("    不包含视频下载逻辑，请勿使用m3u8地址下载/传播版权内容。")
    print("=" * 72)


if __name__ == "__main__":
    main()
