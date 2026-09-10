#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
咕咕番(gugu3.com) 轻量全站抓取脚本 (无需浏览器)
- 抓取全部番剧元数据(标题/封面/简介/演员/导演/标签/集数列表/线路/加密播放URL)
- 不依赖浏览器，仅用 requests + BeautifulSoup
- 加密的播放URL原样输出，若要真实m3u8请使用 gugu3_crawler.py 的浏览器解密版

用法:
    python3 gugu3_simple.py                  # 抓取全站元数据
    python3 gugu3_simple.py --max-pages 3    # 只爬前3页
    python3 gugu3_simple.py --output data.json
"""
import argparse
import json
import re
import time
from pathlib import Path
import requests
from bs4 import BeautifulSoup
from urllib.parse import urljoin

BASE = "https://www.gugu3.com"
HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
                  "(KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36",
    "Referer": BASE+"/",
}
s = requests.Session(); s.headers.update(HEADERS)


def fetch_list(pg:int):
    r = s.get(f"{BASE}/index.php/ajax/data", params={"mid":1,"pg":pg,"limit":24}, timeout=15)
    r.raise_for_status(); return r.json()

def fetch_detail(vid:int):
    r = s.get(f"{BASE}/index.php/vod/detail/id/{vid}.html", timeout=15)
    r.raise_for_status()
    html = r.text
    soup = BeautifulSoup(html, "lxml")
    # 标题
    title = ""
    m = re.search(r"<title>([^<]+)", html)
    if m: title = m.group(1).split("_")[0].split("高清完整版")[0].strip()
    # 封面
    cover = ""
    img = soup.select_one(".detail-pic img, .vod-detail-pic img, .detail-sketch img")
    if img: cover = img.get("data-src") or img.get("src") or ""
    # 简介
    desc = ""
    for sel in (".desc-content", ".vod-content", ".sketch-content", ".detail-blurb"):
        el = soup.select_one(sel)
        if el:
            desc = el.get_text(" ", strip=True); break
    # 演员/导演
    actor = director = area = year = ""
    info = soup.select(".detail-info li, .vod-info li")
    for li in info:
        txt = li.get_text(" ", strip=True)
        if "演员" in txt: actor = txt.split("：",1)[-1].strip()
        elif "导演" in txt: director = txt.split("：",1)[-1].strip()
        elif "地区" in txt: area = txt.split("：",1)[-1].strip()
        elif "年代" in txt or "年份" in txt: year = txt.split("：",1)[-1].strip()
    # 线路&集数：优先从anthology-list-box解析（页面DOM）
    sources = []
    # 1) 试JS变量
    pf = re.search(r"vod_play_from\s*=\s*'([^']+)'", html)
    pu = re.search(r"vod_play_url\s*=\s*'([^']+)'", html)
    if pf and pu:
        names = pf.group(1).split("$$$")
        urlblocks = pu.group(1).split("$$$")
        for i,(name,block) in enumerate(zip(names,urlblocks), start=1):
            eps=[]
            for j,ep in enumerate(block.split("#"), start=1):
                if not ep: continue
                p = ep.split("$")
                ep_name = p[0] if p else f"第{j}集"
                enc_url = p[1] if len(p)>1 else ""
                eps.append({
                    "nid": j, "name": ep_name, "enc_url": enc_url,
                    "play_url": f"{BASE}/index.php/vod/play/id/{vid}/sid/{i}/nid/{j}.html",
                })
            sources.append({"sid": i, "name": name, "episodes": eps})
    else:
        # 2) 从 anthology-tab + anthology-list-box DOM 解析
        tab_names = []
        for a in soup.select(".anthology-tab .swiper-slide, .anthology-tab a"):
            # 移除badge子元素的文本
            name_parts = [t for t in a.find_all(string=True, recursive=False)]
            badge = a.select_one(".badge")
            name = a.get_text(strip=True)
            if badge:
                name = name.replace(badge.get_text(strip=True), "").strip()
            name = name.replace("\xa0","").strip()
            if name: tab_names.append(name)
        boxes = soup.select(".anthology-list-box")
        if not tab_names:
            tab_names = [f"线路{i+1}" for i in range(len(boxes))]
        for i, (box, tname) in enumerate(zip(boxes, tab_names)):
            eps=[]
            for j, a in enumerate(box.select("a"), start=1):
                href = a.get("href","")
                m2 = re.search(r"/sid/(\d+)/nid/(\d+)\.html", href)
                if not m2: continue
                eps.append({
                    "nid": int(m2.group(2)),
                    "name": a.get_text(strip=True) or f"第{j}集",
                    "enc_url": "",
                    "play_url": urljoin(BASE, href),
                })
            if eps:
                # sid从第一个集数链接里取
                m3 = re.search(r"/sid/(\d+)/", eps[0]["play_url"])
                real_sid = int(m3.group(1)) if m3 else i+1
                sources.append({"sid": real_sid, "name": tname, "episodes": eps})
    # 分类/标签
    tags = []
    for a in soup.select(".detail-info a[href*='/show/'], .vod-class a"):
        t = a.get_text(strip=True)
        if t: tags.append(t)
    return {
        "id": vid,
        "title": title,
        "cover": cover,
        "desc": desc,
        "actor": actor, "director": director, "area": area, "year": year,
        "tags": tags,
        "sources": sources,
        "detail_url": f"{BASE}/index.php/vod/detail/id/{vid}.html",
    }

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--output", default="gugu3_all.json")
    ap.add_argument("--start-page", type=int, default=1)
    ap.add_argument("--max-pages", type=int, default=None)
    args = ap.parse_args()

    all_vods=[]
    pg = args.start_page
    while True:
        print(f"[→] 第{pg}页", flush=True)
        try:
            d = fetch_list(pg)
        except Exception as e:
            print(f"  ! 失败: {e}"); time.sleep(3); pg+=1; continue
        if d.get("code")!=1: break
        pagecount = d.get("pagecount",1)
        for it in d.get("list",[]):
            vid = it["vod_id"]
            try:
                dt = fetch_detail(vid)
                # 合并列表API已有的字段
                dt["remarks"] = it.get("vod_remarks","")
                dt["blurb"] = it.get("vod_blurb","")
                all_vods.append(dt)
                print(f"  ✓ {dt['title']} ({len(dt['sources'])}条线路)")
            except Exception as e:
                print(f"  ! {vid} 详情失败: {e}")
            time.sleep(0.3)
        if args.max_pages and pg>=args.start_page+args.max_pages-1: break
        if pg>=pagecount: break
        pg+=1
        time.sleep(1)
    Path(args.output).write_text(json.dumps(all_vods, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"\n[✓] 共抓取 {len(all_vods)} 部番剧 → {args.output}")

if __name__=="__main__":
    main()
