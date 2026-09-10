#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
bbibi.cc (4K在线) 全站爬虫
==========================
功能：
  1. 抓取所有分类下列表页 → 收集全部影片详情页URL
  2. 进入详情页解析影片元数据（标题、封面、年代、地区、演员、导演、简介）
  3. 进入播放页解析全部播放线路与分集的 m3u8 直链（明文，无需解密）
  4. 可选：使用 m3u8 下载视频（TS 分片合并为 MP4，需 ffmpeg）
  5. 结果输出为 JSON + CSV，支持断点续爬、多线程、限速

网站关键分析（已验证）：
  - 视频源完全明文：播放页内嵌 JS 变量 var now="https://xxx/index.m3u8"
  - 无加密、无混淆、无签名，无需逆向
  - 播放器 iframe: /js/player/mtm3u8.html → 第三方解析 maotai888.vip
  - 我们直接从页面源码提取 now 变量即可获得真实 m3u8 地址，跳过第三方解析
"""

import os
import re
import sys
import json
import time
import csv
import random
import logging
import argparse
import hashlib
from urllib.parse import urljoin, urlparse
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path

import requests
from bs4 import BeautifulSoup

# ========== 配置 ==========
BASE_URL = "https://www.bbibi.cc"
DEFAULT_HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
                  "(KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
    "Referer": BASE_URL + "/",
}
CATEGORIES = {
    1: "电影",
    2: "电视剧",
    3: "综艺",
    4: "动漫",
}
# 站点详情分类链接（子分类也可用相同方式，此处主分类4个已覆盖全站核心内容）
TIMEOUT = 20
RETRY = 3
SLEEP_RANGE = (0.3, 1.0)  # 请求间隔随机秒数

# ========== 日志 ==========
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%H:%M:%S",
)
log = logging.getLogger("bbibi")


# ========== 核心工具 ==========
class Session:
    def __init__(self):
        self.s = requests.Session()
        self.s.headers.update(DEFAULT_HEADERS)

    def get(self, url, **kwargs):
        for i in range(RETRY):
            try:
                r = self.s.get(url, timeout=TIMEOUT, **kwargs)
                r.encoding = r.apparent_encoding or "utf-8"
                return r
            except Exception as e:
                log.warning(f"请求失败({i+1}/{RETRY}) {url}: {e}")
                time.sleep(1 + i)
        return None


session = Session()


def safe_sleep():
    time.sleep(random.uniform(*SLEEP_RANGE))


# ========== 步骤1：列表页 → 视频详情URL集合 ==========
def get_list_page_urls(cate_id, page):
    """构造某分类某分页的URL"""
    if page <= 1:
        return f"{BASE_URL}/list/?{cate_id}.html"
    return f"{BASE_URL}/list/?{cate_id}-{page}.html"


def get_max_page(cate_id):
    """探测某分类的最大页数"""
    url = get_list_page_urls(cate_id, 1)
    r = session.get(url)
    if not r:
        return 1
    # 尾页链接: /list/?1-2681.html
    m = re.search(rf'/list/\?{cate_id}-(\d+)\.html[^"]*">[^<]*尾页', r.text)
    if m:
        return int(m.group(1))
    # 退化：找最大页码
    pages = re.findall(rf'/list/\?{cate_id}(?:-(\d+))?\.html', r.text)
    nums = [int(x) for x in pages if x]
    return max(nums) if nums else 1


def parse_list_page(cate_id, page):
    """解析列表页，返回该页所有影片详情URL及简要信息"""
    url = get_list_page_urls(cate_id, page)
    r = session.get(url)
    if not r:
        return []
    # 详情页链接形如 /detail/?213675.html  （海洋CMS 常见路由，也可能是 /video/? 直接进播放页）
    # 实际测试站点可能为 /detail/?xx.html  或 /video/?xx-x-x.html
    # 先抓 detail 页
    items = []
    seen = set()
    # 影片详情正则（海洋CMS常见规则）
    for m in re.finditer(r'<a[^>]+href="(/(?:detail|video)/\?(\d+)[^"]*)"[^>]*>([^<]+)</a>', r.text):
        link, vid, title = m.group(1), m.group(2), m.group(3).strip()
        if vid in seen:
            continue
        if not title or len(title) > 80:
            continue
        seen.add(vid)
        items.append({
            "vid": vid,
            "title": title,
            "detail_url": urljoin(BASE_URL, f"/detail/?{vid}.html"),
            "play_url": urljoin(BASE_URL, f"/video/?{vid}-0-0.html"),
            "category": CATEGORIES.get(cate_id, str(cate_id)),
        })
    return items


# ========== 步骤2：详情页解析元数据 ==========
def parse_detail_page(vid):
    """解析详情页，获取影片元数据 + 播放线路分集链接"""
    url = f"{BASE_URL}/detail/?{vid}.html"
    r = session.get(url)
    if not r or r.status_code != 200:
        # 尝试直接访问播放页作为退化
        return parse_detail_from_play_page(vid)

    html = r.text
    soup = BeautifulSoup(html, "html.parser")

    data = {"vid": vid, "detail_url": url}

    # 标题
    title_el = soup.find(["h1", "h2"], class_=re.compile(r"title|name", re.I)) or soup.find("h1")
    data["title"] = title_el.get_text(strip=True) if title_el else ""
    if not data["title"]:
        m = re.search(r'<h1[^>]*>([^<]+)</h1>', html)
        if m:
            data["title"] = m.group(1).strip()

    # 封面
    cover = ""
    img = soup.find("div", class_=re.compile(r"pic|poster|stui-content__thumb", re.I))
    if img:
        img_tag = img.find("img")
        if img_tag:
            cover = img_tag.get("data-original") or img_tag.get("src") or ""
    if not cover:
        m = re.search(r'<img[^>]+class="[^"]*(?:lazy|pic)[^"]*"[^>]+(?:data-original|src)="([^"]+)"', html)
        if m:
            cover = m.group(1)
    data["cover"] = urljoin(BASE_URL, cover) if cover else ""

    # 详情区块文本（年代/地区/导演/主演/简介）
    text_block = soup.get_text(" ", strip=True)

    def _extract(pattern):
        m = re.search(pattern, html, re.S)
        return m.group(1).strip() if m else ""

    data["year"] = _extract(r'(?:年\s*代|上映时间|年份)[^<]*：?\s*</?[^>]*>\s*([^<\n]{2,20})')
    data["area"] = _extract(r'(?:产\s*地|地\s*区)[^<]*：?\s*</?[^>]*>\s*([^<\n]{2,20})')
    data["director"] = _extract(r'(?:导\s*演)[^<]*：?\s*</?[^>]*>\s*([^<\n]{2,80})')
    data["actors"] = _extract(r'(?:主\s*演)[^<]*：?\s*</?[^>]*>\s*([^<\n]{2,300})')
    data["genre"] = _extract(r'(?:类\s*型)[^<]*：?\s*</?[^>]*>\s*([^<\n]{2,100})')
    data["language"] = _extract(r'(?:语\s*言)[^<]*：?\s*</?[^>]*>\s*([^<\n]{2,20})')
    data["rating"] = _extract(r'class="[^"]*score[^"]*"[^>]*>([^<]+)<')

    # 简介
    desc_el = soup.find("span", class_=re.compile(r"detail|desc|sketch|content", re.I)) or \
              soup.find("div", class_=re.compile(r"desc|intro|plot|juqing|summary", re.I))
    if desc_el:
        data["description"] = desc_el.get_text(" ", strip=True)
    else:
        m = re.search(r'(?:剧情介绍|简介|剧情)[^<]*</[^>]+>\s*<span[^>]*>(.*?)</span>', html, re.S)
        data["description"] = re.sub(r'<[^>]+>', '', m.group(1)).strip() if m else ""

    # 播放线路 & 分集链接
    data["play_sources"] = extract_play_sources(html, vid)

    return data


def extract_play_sources(html, vid):
    """
    从详情页精确解析所有播放线路与分集
    站点结构（已验证）：
      <a href="#playlist1" data-toggle="tab">mtm3u8</a>        ← 线路名
      <div id="playlist1">
        <ul class="myui-content__list ...">
          <li id="00"><a href="/video/?213675-0-0.html">正片</a></li>
          ...
        </ul>
      </div>
      <a href="#playlist2" data-toggle="tab">iKun资源站</a>
      <div id="playlist2">...</div>
    """
    sources = []

    # 1. 先找所有线路名: href="#playlistN"
    tab_links = re.findall(
        r'<a[^>]+href="#playlist(\d+)"[^>]*data-toggle="tab"[^>]*>([^<]+)</a>',
        html,
    )
    if not tab_links:
        # 退化匹配
        tab_links = re.findall(
            r'<a[^>]+href="#playlist(\d+)"[^>]*>([^<]+)</a>',
            html,
        )

    for playlist_id, src_name in tab_links:
        src_name = src_name.strip()
        # 2. 定位该 playlist 块（在 playlistN 到下一个 playlistN+1 或其他div之间）
        block_m = re.search(
            r'<div\s+id="playlist' + playlist_id + r'"[^>]*>(.*?)</div>\s*(?=<div\s+id="playlist|$)',
            html, re.S,
        )
        if not block_m:
            # 更宽松：从 id="playlistN" 截取到下一个同层级div
            pattern = r'<div\s+id="playlist' + playlist_id + r'"[^>]*>(.*)'
            m2 = re.search(pattern, html, re.S)
            block_html = m2.group(1) if m2 else ""
        else:
            block_html = block_m.group(1)

        # 3. 在该块内抓取所有视频链接
        eps = []
        for m in re.finditer(
            r'<a[^>]+href="(/video/\?(\d+)-(\d+)-(\d+)\.html)"[^>]*>([^<]+)</a>',
            block_html,
        ):
            link, _v, vfrom, vpart, ep_name = m.group(1), m.group(2), m.group(3), m.group(4), m.group(5)
            # 只保留当前vid的链接（避免推荐区串入）
            if _v != vid:
                continue
            eps.append({
                "ep_name": ep_name.strip(),
                "play_url": urljoin(BASE_URL, link),
                "vpart": int(vpart),
            })
        eps.sort(key=lambda x: x["vpart"])
        vfrom = eps[0]["vpart"] if eps else 0
        # vfrom 取自链接第二位
        vfrom_m = re.search(r'/video/\?\d+-(\d+)-', block_html)
        if vfrom_m:
            vfrom = int(vfrom_m.group(1))
        sources.append({"source_name": src_name, "vfrom": vfrom, "episodes": eps})

    return sources


def parse_detail_from_play_page(vid):
    """退化方案：若详情页异常，用播放页标题作为影片数据"""
    url = f"{BASE_URL}/video/?{vid}-0-0.html"
    r = session.get(url)
    if not r:
        return {"vid": vid, "title": vid, "play_sources": []}
    m = re.search(r'<h1[^>]*>([^<]+)</h1>', r.text)
    title = m.group(1).strip() if m else vid
    m3u8 = extract_m3u8_from_play(r.text)
    return {
        "vid": vid,
        "title": title,
        "cover": "",
        "year": "",
        "area": "",
        "director": "",
        "actors": "",
        "description": "",
        "play_sources": [{
            "source_name": "mtm3u8",
            "vfrom": 0,
            "episodes": [{
                "ep_name": "正片",
                "play_url": url,
                "vpart": 0,
                "m3u8": m3u8,
            }],
        }],
    }


# ========== 步骤3：播放页 → 提取明文m3u8 ==========
def extract_m3u8_from_play(html):
    """
    核心：从播放页直接提取明文 m3u8 地址
    已验证页面中存在：var now="https://xxx/index.m3u8";
    """
    # 主匹配
    m = re.search(r'var\s+now\s*=\s*["\']([^"\']+\.m3u8[^"\']*)["\']', html)
    if m:
        return m.group(1)
    # 退化：匹配任意m3u8
    m = re.search(r'(https?://[^\s"\'<>]+\.m3u8[^\s"\'<>]*)', html)
    if m:
        return m.group(1)
    return ""


def fetch_episode_m3u8(play_url):
    """访问单集播放页，提取m3u8直链"""
    r = session.get(play_url)
    if not r:
        return ""
    return extract_m3u8_from_play(r.text)


def enrich_video_with_m3u8(video):
    """给影片所有分集填入m3u8"""
    for src in video.get("play_sources", []):
        for ep in src.get("episodes", []):
            if not ep.get("m3u8"):
                ep["m3u8"] = fetch_episode_m3u8(ep["play_url"])
                safe_sleep()
    return video


# ========== 步骤4（可选）：m3u8 → MP4 下载 ==========
def download_m3u8(m3u8_url, output_path, headers=None, concurrency=8):
    """
    使用 ffmpeg 下载 m3u8 为 mp4
    需要系统已安装 ffmpeg
    """
    import subprocess
    hdr = headers or {"Referer": BASE_URL + "/", "User-Agent": DEFAULT_HEADERS["User-Agent"]}
    # 用 ffmpeg 最稳健
    cmd = [
        "ffmpeg", "-y",
        "-headers", "".join(f"{k}: {v}\r\n" for k, v in hdr.items()),
        "-i", m3u8_url,
        "-c", "copy",
        "-bsf:a", "aac_adtstoasc",
        output_path,
    ]
    log.info(f"开始下载: {output_path}")
    result = subprocess.run(cmd, capture_output=True, text=True)
    if result.returncode != 0:
        log.error(f"ffmpeg 失败: {result.stderr[-500:]}")
        return False
    log.info(f"下载完成: {output_path}")
    return True


# ========== 主流程 ==========
def crawl_all_vids(cate_ids, max_pages=None, workers=5, state_file="crawl_state.json"):
    """第一步：遍历所有列表页收集vid"""
    # 断点续爬
    if os.path.exists(state_file):
        with open(state_file, "r", encoding="utf-8") as f:
            state = json.load(f)
        log.info(f"加载已爬取状态: {len(state.get('vids', {}))} 条vid已收集")
    else:
        state = {"vids": {}}

    for cate in cate_ids:
        total_pages = get_max_page(cate)
        if max_pages:
            total_pages = min(total_pages, max_pages)
        log.info(f"分类 [{CATEGORIES.get(cate, cate)}] 共 {total_pages} 页")

        def _job(p):
            return parse_list_page(cate, p)

        with ThreadPoolExecutor(max_workers=workers) as ex:
            futures = {ex.submit(_job, p): p for p in range(1, total_pages + 1)}
            done = 0
            for fut in as_completed(futures):
                p = futures[fut]
                try:
                    items = fut.result()
                except Exception as e:
                    log.error(f"第{p}页解析失败: {e}")
                    items = []
                for it in items:
                    state["vids"][it["vid"]] = it
                done += 1
                if done % 10 == 0 or done == total_pages:
                    log.info(f"  [{CATEGORIES.get(cate, cate)}] 进度 {done}/{total_pages} 累计vids: {len(state['vids'])}")
                    with open(state_file, "w", encoding="utf-8") as f:
                        json.dump(state, f, ensure_ascii=False, indent=2)
                safe_sleep()

    with open(state_file, "w", encoding="utf-8") as f:
        json.dump(state, f, ensure_ascii=False, indent=2)
    return state


def crawl_details(vids_data, output_json="bbibi_all.json", workers=5, video_dir=None, download=False):
    """第二步：爬取每个vid的详情与m3u8"""
    result_file = output_json
    if os.path.exists(result_file):
        with open(result_file, "r", encoding="utf-8") as f:
            results = json.load(f)
        done_vids = {v["vid"] for v in results}
        log.info(f"已有 {len(done_vids)} 条影片详情，继续爬取剩余")
    else:
        results = []
        done_vids = set()

    pending = [v for vid, v in vids_data.items() if vid not in done_vids]
    log.info(f"待爬取详情: {len(pending)} 部影片")

    if video_dir and download:
        Path(video_dir).mkdir(parents=True, exist_ok=True)

    def _job(item):
        try:
            vid = item["vid"]
            detail = parse_detail_page(vid)
            # 合并列表页摘要信息
            detail["category"] = item.get("category", "")
            # 补全m3u8
            detail = enrich_video_with_m3u8(detail)
            # 下载
            if video_dir and download:
                for src in detail.get("play_sources", []):
                    for i, ep in enumerate(src.get("episodes", [])):
                        if ep.get("m3u8"):
                            safe_title = re.sub(r'[\\/:*?"<>|]', "_", detail["title"])
                            ep_name = re.sub(r'[\\/:*?"<>|]', "_", ep["ep_name"])
                            out = os.path.join(video_dir, f"{safe_title}_{ep_name}.mp4")
                            if not os.path.exists(out):
                                try:
                                    download_m3u8(ep["m3u8"], out)
                                except Exception as e:
                                    log.error(f"下载失败 {detail['title']}-{ep_name}: {e}")
            return detail
        except Exception as e:
            log.error(f"解析影片失败 {item.get('vid')}: {e}")
            return None

    count = 0
    with ThreadPoolExecutor(max_workers=workers) as ex:
        futures = {ex.submit(_job, it): it for it in pending}
        for fut in as_completed(futures):
            d = fut.result()
            if d:
                results.append(d)
                count += 1
                if count % 20 == 0:
                    log.info(f"详情进度: {count}/{len(pending)}")
                    with open(result_file, "w", encoding="utf-8") as f:
                        json.dump(results, f, ensure_ascii=False, indent=2)
            safe_sleep()

    with open(result_file, "w", encoding="utf-8") as f:
        json.dump(results, f, ensure_ascii=False, indent=2)

    # 导出CSV
    export_csv(results)
    return results


def export_csv(results, csv_path="bbibi_all.csv"):
    """导出简表CSV"""
    rows = []
    for v in results:
        for src in v.get("play_sources", []):
            for ep in src.get("episodes", []):
                rows.append({
                    "vid": v.get("vid"),
                    "title": v.get("title"),
                    "category": v.get("category"),
                    "year": v.get("year"),
                    "area": v.get("area"),
                    "source": src.get("source_name"),
                    "episode": ep.get("ep_name"),
                    "m3u8": ep.get("m3u8", ""),
                    "play_url": ep.get("play_url"),
                    "cover": v.get("cover"),
                    "director": v.get("director"),
                    "actors": v.get("actors"),
                })
    with open(csv_path, "w", encoding="utf-8-sig", newline="") as f:
        if rows:
            w = csv.DictWriter(f, fieldnames=list(rows[0].keys()))
            w.writeheader()
            w.writerows(rows)
    log.info(f"CSV已导出: {csv_path}  共 {len(rows)} 条分集记录")


# ========== 单影片快速爬取 ==========
def crawl_single(url_or_vid, download=False, video_dir="./downloads"):
    """只爬取单个影片（用于测试）"""
    m = re.search(r'(\d+)', url_or_vid)
    if not m:
        log.error("无法识别vid")
        return
    vid = m.group(1)
    log.info(f"爬取单个影片 vid={vid}")
    detail = parse_detail_page(vid)
    detail = enrich_video_with_m3u8(detail)
    print(json.dumps(detail, ensure_ascii=False, indent=2))
    if download:
        Path(video_dir).mkdir(parents=True, exist_ok=True)
        for src in detail.get("play_sources", []):
            for ep in src.get("episodes", []):
                if ep.get("m3u8"):
                    safe_title = re.sub(r'[\\/:*?"<>|]', "_", detail["title"])
                    ep_name = re.sub(r'[\\/:*?"<>|]', "_", ep["ep_name"])
                    out = os.path.join(video_dir, f"{safe_title}_{ep_name}.mp4")
                    download_m3u8(ep["m3u8"], out)
    return detail


# ========== CLI ==========
def main():
    parser = argparse.ArgumentParser(description="bbibi.cc 全站爬虫 (m3u8明文直链)")
    parser.add_argument("--mode", choices=["all", "list", "detail", "single"], default="all",
                        help="运行模式: all=全站; list=只收集vid; detail=基于state抓详情; single=单部")
    parser.add_argument("--cate", type=str, default="1,2,3,4", help="要爬的分类ID，逗号分隔，默认1,2,3,4")
    parser.add_argument("--max-pages", type=int, default=0, help="每个分类最多爬多少页，0=全部")
    parser.add_argument("--workers", type=int, default=5, help="并发线程数")
    parser.add_argument("--delay", type=float, default=0.5, help="请求基础间隔(秒)")
    parser.add_argument("--download", action="store_true", help="是否下载视频为MP4（需ffmpeg）")
    parser.add_argument("--video-dir", type=str, default="./downloads", help="视频保存目录")
    parser.add_argument("--single", type=str, default="", help="单影片URL或vid")
    parser.add_argument("--output", type=str, default="bbibi_all.json", help="输出JSON文件")
    args = parser.parse_args()

    global SLEEP_RANGE
    SLEEP_RANGE = (args.delay * 0.6, args.delay * 1.5)

    cate_ids = [int(x) for x in args.cate.split(",") if x.strip().isdigit()]

    if args.mode == "single" and args.single:
        crawl_single(args.single, download=args.download, video_dir=args.video_dir)
        return

    state_file = "crawl_state.json"

    if args.mode in ("all", "list"):
        mp = args.max_pages if args.max_pages > 0 else None
        state = crawl_all_vids(cate_ids, max_pages=mp, workers=args.workers, state_file=state_file)
    else:
        with open(state_file, "r", encoding="utf-8") as f:
            state = json.load(f)

    if args.mode in ("all", "detail"):
        crawl_details(
            state["vids"],
            output_json=args.output,
            workers=max(1, args.workers // 2),  # 详情页放慢一点
            video_dir=args.video_dir if args.download else None,
            download=args.download,
        )

    log.info("全部任务完成")


if __name__ == "__main__":
    main()
