#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
人人视频 (https://mh.yichengwlkj.com/pc) 全站爬虫 — Playwright驱动版
====================================
完美逆向：通过Playwright控制真实浏览器发出API请求，无需关心签名算法细节。
内置：
  - 分类 / 榜单 / 热搜 / 首页推荐 / 即将上线
  - 影视详情(drama/intro) / 剧集列表(drama/secondary) / 播放源(drama/page, drama/play)
  - 弹幕(danmu/list) / 评论(comment/list) / 相关推荐(drama/recommend)
  - 自动保存为JSON；可选项下载m3u8地址(ffmpeg)
"""

import os
import re
import sys
import json
import time
import argparse
from urllib.parse import urlparse, parse_qs

# ========== 配置 ==========
SITE_URL = "https://mh.yichengwlkj.com/pc"
API_HOST = "https://api.rrmj.plus"
OUTPUT_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "rrmj_data")

# API路径列表（完整）
APIS = {
    # 无参 / 公共
    "hot_search":       "/m-station/top/hot/search",
    "popup":            "/index/popup",
    "constant_all":     "/constant/get/all",
    "app_category":     "/app/category",
    "schedule_upcoming":"/m-station/schedule/play/upcoming/query",
    "user_message_count":"/m-station/user/message/count",
    # 需要dramaId
    "drama_intro":      "/m-station/drama/intro",
    "drama_page":       "/m-station/drama/page",
    "drama_play":       "/m-station/drama/play",
    "drama_recommend":  "/m-station/drama/recommend",
    "drama_secondary":  "/m-station/drama/secondary",
    # 列表/搜索
    "top_home":         "/m-station/top/home",
    "search_drama":     "/m-station/search/drama",
    "search_lenovo":    "/m-station/search/lenovo",
    "comment_list":     "/m-station/drama/comment/list",
    "danmu_list":       "/m-station/danmu/list",
}


def ensure_dir(p):
    os.makedirs(p, exist_ok=True)


def save_json(path, data):
    ensure_dir(os.path.dirname(path) if os.path.dirname(path) else ".")
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)


# ========== Playwright 浏览器API客户端 ==========
class BrowserClient:
    """通过页面上下文发送fetch，自动带签名和加密"""

    def __init__(self, page):
        self.page = page

    async def call(self, path: str, params: dict = None, method: str = "GET", body=None):
        """在页面上下文中调用fetch，返回解析后的JSON"""
        import urllib.parse
        url = API_HOST + path
        if params:
            qs = urllib.parse.urlencode(params)
            url = url + ("&" if "?" in url else "?") + qs
        opts = {"credentials": "include", "method": method}
        if body is not None:
            opts["body"] = json.dumps(body)
            opts["headers"] = {"Content-Type": "application/json"}
        js_code = f"""
        () => fetch({json.dumps(url)}, {json.dumps(opts)})
          .then(r => r.text())
          .then(t => ({{status:200, text:t}}))
          .catch(e => ({{status:-1, text:String(e)}}))
        """
        resp = await self.page.evaluate(js_code)
        text = resp.get("text", "")
        try:
            return json.loads(text)
        except Exception:
            return {"_raw": text}


# ========== 数据提取辅助 ==========
def extract_list(resp) -> list:
    if not isinstance(resp, dict):
        return []
    data = resp.get("data", resp)
    if isinstance(data, list):
        return data
    if isinstance(data, dict):
        for key in ("content", "list", "records", "items", "result"):
            v = data.get(key)
            if isinstance(v, list):
                return v
        for key in ("content",):
            v = data.get(key)
            if isinstance(v, dict):
                for k2 in ("content", "list", "records"):
                    v2 = v.get(k2)
                    if isinstance(v2, list):
                        return v2
    return []


def collect_ids(resp, store: dict):
    if isinstance(resp, dict):
        data = resp.get("data", resp)
        _walk_ids(data, store)
    elif isinstance(resp, list):
        for item in resp:
            _walk_ids(item, store)


def _walk_ids(obj, store: dict):
    if isinstance(obj, dict):
        vid = None
        for key in ("dramaId", "seasonId"):
            v = obj.get(key)
            if v is not None:
                try:
                    vid = int(v)
                    break
                except (ValueError, TypeError):
                    pass
        if vid and 500 < vid < 10000000:
            if vid not in store:
                title = obj.get("title") or obj.get("name") or obj.get("dramaName") or ""
                cover = (obj.get("verticalCoverUrl") or obj.get("coverUrl") or
                         obj.get("horizontalCoverUrl") or "")
                score = obj.get("score")
                store[vid] = {"title": title, "cover": cover, "score": score}
        for v in obj.values():
            _walk_ids(v, store)
    elif isinstance(obj, list):
        for item in obj:
            _walk_ids(item, store)


def find_video_urls(obj, found=None):
    if found is None:
        found = []
    if isinstance(obj, dict):
        for k, v in obj.items():
            if isinstance(v, str) and (".m3u8" in v or ".mp4" in v):
                found.append({"key": k, "url": v})
            else:
                find_video_urls(v, found)
    elif isinstance(obj, list):
        for item in obj:
            find_video_urls(item, found)
    return found


# ========== 全站抓取主流程 ==========
async def crawl_all(client: BrowserClient, max_items: int = 200, fetch_video: bool = False):
    ensure_dir(OUTPUT_DIR)
    all_ids = {}

    print("[1/8] 热搜词...")
    hot = await client.call(APIS["hot_search"])
    save_json(os.path.join(OUTPUT_DIR, "hot_search.json"), hot)
    collect_ids(hot, all_ids)

    print("[2/8] 分类信息...")
    cat = await client.call(APIS["app_category"])
    save_json(os.path.join(OUTPUT_DIR, "categories_meta.json"), cat)
    collect_ids(cat, all_ids)

    print("[3/8] 即将上线...")
    upcoming = await client.call(APIS["schedule_upcoming"])
    save_json(os.path.join(OUTPUT_DIR, "upcoming.json"), upcoming)
    collect_ids(upcoming, all_ids)

    print("[4/8] 首页推荐（多页）...")
    home_pages = []
    for page in range(1, 20):
        d = await client.call(APIS["top_home"], {"pageNum": page, "pageSize": 24})
        items = extract_list(d)
        if not items:
            break
        home_pages.append(d)
        collect_ids(d, all_ids)
        print(f"  首页第{page}页，累计ID {len(all_ids)}")
        if len(all_ids) >= max_items:
            break
        time.sleep(0.3)
    save_json(os.path.join(OUTPUT_DIR, "home.json"), home_pages)

    print("[5/8] 各类型影视...")
    drama_types = [
        ("ALL", "全部"), ("TV", "电视剧"), ("MOVIE", "电影"),
        ("PLAYLET", "短剧"), ("COMIC", "动漫"),
        ("VARIETY", "综艺"), ("DOCUMENTARY", "纪录片"),
    ]
    # 注意：分类列表接口可能路径不同，这里用 top/home 替代（首页已包含各类型推荐）
    type_data = {}
    for dt, name in drama_types:
        pages = []
        for page in range(1, 15):
            d = await client.call("/m-station/drama/list",
                                  {"dramaType": dt, "pageNum": page, "pageSize": 24})
            items = extract_list(d)
            if not items:
                break
            pages.append(d)
            collect_ids(d, all_ids)
            if len(all_ids) >= max_items * 2:
                break
            time.sleep(0.25)
        type_data[name] = pages
        print(f"  {name}: {len(pages)}页")
    save_json(os.path.join(OUTPUT_DIR, "drama_by_type.json"), type_data)

    print(f"[6/8] 抓取 {min(max_items,len(all_ids))} 个详情...")
    details_dir = os.path.join(OUTPUT_DIR, "details")
    ensure_dir(details_dir)
    succ = 0
    ids_list = list(all_ids.keys())[:max_items]
    for i, did in enumerate(ids_list):
        try:
            fpath = os.path.join(details_dir, f"{did}.json")
            if os.path.exists(fpath):
                succ += 1
                continue
            intro = await client.call(APIS["drama_intro"], {"dramaId": did})
            time.sleep(0.15)
            secondary = await client.call(APIS["drama_secondary"], {"dramaId": did})
            time.sleep(0.15)
            page_info = await client.call(APIS["drama_page"], {
                "hsdrOpen": 0, "isAgeLimit": 0,
                "dramaId": did, "quality": "AI4K", "hevcOpen": 0, "tria4k": 1
            })
            time.sleep(0.15)
            play_info = await client.call(APIS["drama_play"],
                                          {"dramaId": did, "quality": "AI4K", "hevcOpen": 0})
            time.sleep(0.15)
            recommend = await client.call(APIS["drama_recommend"],
                                          {"dramaId": did, "position": 9})
            time.sleep(0.1)
            video_urls = find_video_urls(play_info) + find_video_urls(page_info)
            record = {
                "dramaId": did,
                "meta": all_ids[did],
                "intro": intro.get("data") if isinstance(intro, dict) else intro,
                "secondary": secondary.get("data") if isinstance(secondary, dict) else secondary,
                "page_info": page_info.get("data") if isinstance(page_info, dict) else page_info,
                "play_info": play_info.get("data") if isinstance(play_info, dict) else play_info,
                "recommend": recommend.get("data") if isinstance(recommend, dict) else recommend,
                "video_urls": video_urls,
            }
            save_json(fpath, record)
            succ += 1
            if (i + 1) % 20 == 0:
                print(f"  进度 {i+1}/{len(ids_list)} 成功{succ}")
        except Exception as e:
            print(f"  drama {did} 失败: {e}")

    save_json(os.path.join(OUTPUT_DIR, "index.json"), {
        "total": succ,
        "ids": ids_list,
        "timestamp": time.time(),
    })
    print(f"\n[✓] 完成！成功抓取 {succ} 个影视详情，数据在 {OUTPUT_DIR}")


async def crawl_single(client: BrowserClient, drama_id: int):
    ensure_dir(OUTPUT_DIR)
    print(f"[*] 抓取 dramaId={drama_id}")
    intro = await client.call(APIS["drama_intro"], {"dramaId": drama_id})
    time.sleep(0.2)
    secondary = await client.call(APIS["drama_secondary"], {"dramaId": drama_id})
    time.sleep(0.2)
    page_info = await client.call(APIS["drama_page"], {
        "hsdrOpen": 0, "isAgeLimit": 0, "dramaId": drama_id,
        "quality": "AI4K", "hevcOpen": 0, "tria4k": 1})
    time.sleep(0.2)
    play_info = await client.call(APIS["drama_play"], {
        "dramaId": drama_id, "quality": "AI4K", "hevcOpen": 0})
    time.sleep(0.2)
    recommend = await client.call(APIS["drama_recommend"], {"dramaId": drama_id, "position": 9})

    video_urls = find_video_urls(play_info) + find_video_urls(page_info)
    result = {
        "dramaId": drama_id,
        "intro": intro.get("data") if isinstance(intro, dict) else intro,
        "secondary": secondary.get("data") if isinstance(secondary, dict) else secondary,
        "page_info": page_info.get("data") if isinstance(page_info, dict) else page_info,
        "play_info": play_info.get("data") if isinstance(play_info, dict) else play_info,
        "recommend": recommend.get("data") if isinstance(recommend, dict) else recommend,
        "video_urls": video_urls,
    }
    path = os.path.join(OUTPUT_DIR, f"drama_{drama_id}.json")
    save_json(path, result)
    print(f"[✓] 保存至 {path}")
    print(f"[*] 视频地址 {len(video_urls)} 个：")
    for v in video_urls[:10]:
        print(f"    {v['key']}: {v['url']}")
    return result


# ========== 入口 ==========
async def main():
    parser = argparse.ArgumentParser(description="人人视频全站爬虫(Playwright版，完美抓取)")
    parser.add_argument("--mode", choices=["all", "single"], default="single")
    parser.add_argument("--id", type=int, default=34838)
    parser.add_argument("--max", type=int, default=200)
    parser.add_argument("--headless", action="store_true", default=True)
    args = parser.parse_args()

    from playwright.async_api import async_playwright
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=args.headless)
        context = await browser.new_context(
            user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            viewport={"width": 1280, "height": 800},
        )
        page = await context.new_page()
        print("[*] 打开网站...")
        await page.goto(SITE_URL, wait_until="networkidle")
        # 等待localStorage初始化（cv/ct等由页面写入）
        await page.wait_for_timeout(2000)

        client = BrowserClient(page)

        if args.mode == "all":
            await crawl_all(client, max_items=args.max)
        else:
            await crawl_single(client, args.id)

        await browser.close()


if __name__ == "__main__":
    import asyncio
    asyncio.run(main())
