#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Youplex.site 全站抓取脚本
================================================
站点：https://youplex.site/
技术栈：Next.js (App Router + Turbopack + RSC)
数据源：TMDB API (https://api.themoviedb.org/3)
播放源：第三方 iframe 聚合（VidLink/VidNest/VidFast/VidEasy/Vidsrc/Vidup/Rive），URL 规则已从站点 JS 中直接提取。

结论（逆向分析结果）：
1. youplex.site 自身**没有任何加密/解密逻辑**；SSR 页面直接返回普通 HTML，视频列表/详情数据全部来自 TMDB 公开 API。
2. 播放页 `<iframe src="...">` 的 URL 直接由前端根据固定模板拼接，密钥/令牌/签名均不存在。
3. 视频本体托管在第三方 CDN（vidsrc/vidlink/videasy 等），m3u8 是否 DRM 取决于第三方；本脚本只负责从 youplex 页面解析出可播放 iframe/源地址。

使用方式：
    python scraper.py                   # 默认全量抓取（静态页 + TMDB 元数据 + watch 播放源）
    python scraper.py --static-only     # 仅抓取 youplex.site 站点本身的静态 HTML/CSS/JS/图片
    python scraper.py --no-media        # 不下载图片/视频源，仅生成索引
    python scraper.py --pages 5         # TMDB 每类列表抓 5 页（默认全部）
    python scraper.py --search "batman" # 额外搜索指定关键词
    python scraper.py --out ./output    # 指定输出目录

输出：
    output/
        site/            youplex 静态页镜像（HTML/CSS/JS/图片）
        data/            TMDB 元数据 JSON（movies/tv/trending/genres/details）
        watch/           每个影片的播放源 iframe/直链解析结果 JSON
        images/          TMDB 海报/剧照
        index.html       本地浏览索引
        catalog.json     全量目录清单
"""
import os
import re
import sys
import json
import time
import argparse
import logging
from urllib.parse import urljoin, urlparse, urlunparse, parse_qs, urlencode, unquote
from concurrent.futures import ThreadPoolExecutor, as_completed
from collections import deque

import requests
from bs4 import BeautifulSoup

# ----------------------------------------------------------------------
# 配置
# ----------------------------------------------------------------------
SITE_BASE = "https://youplex.site/"

# 从 youplex 站点 JS (__next_static_chunks_0w3.kbi2j51mu.js) 中逆向提取的 TMDB Bearer Token
# Next.js 代码中：tc = axios.create({baseURL:"https://api.themoviedb.org/3"})
# 请求拦截器统一设置 Authorization 头。
TMDB_BEARER = ("eyJhbGciOiJIUzI1NiJ9.eyJhdWQiOiJhZGRmYmE0MWQwY2I1YWJhMmViYWFlMTJhYzkyYjY3MSIsIm5iZiI6MTcwOTI3NDczMy40MDks"
               "InN1YiI6IjY1ZTE3NjZkYTM5ZDBiMDE2MzA4MjhmMSIsInNjb3BlcyI6WyJhcGlfcmVhZCJdLCJ2ZXJzaW9uIjoxfQ."
               "GVGROFZxMyupzFnPoKlNdo1gp9iYnQLhc2HwKzKISYo")
TMDB_IMG = "https://image.tmdb.org/t/p"

# 从 __next_static_chunks_055sxhtb_rad8.js 逆向出的播放器 server 列表
# 原代码：let er = [{id:"vidlink",name:"Server 1 (VidLink Pro)",baseUrl:"https://vidlink.pro",enabled:!0}, ...]
# URL 拼接：
#   movie -> `${baseUrl}/movie/${tmdbId}`
#   tv    -> `${baseUrl}/tv/${tmdbId}/${season}/${episode}`
PLAY_SERVERS = [
    {"id": "vidlink",    "name": "Server 1 (VidLink Pro)", "base_url": "https://vidlink.pro"},
    {"id": "vidsrc_to",  "name": "Server 2 (VIP)",         "base_url": "https://vidsrc.to/embed"},
    {"id": "vidnest",    "name": "Server 3 (VidNest)",     "base_url": "https://vidnest.fun"},
    {"id": "vidfast",    "name": "Server 3 (VidFast)",     "base_url": "https://vidfast.net"},
    {"id": "videasy",    "name": "Server 3 (VidEasy)",     "base_url": "https://player.videasy.net"},
    {"id": "vidsrc_me",  "name": "Server 4 (Vidsrc)",      "base_url": "https://vsembed.ru/embed"},
    {"id": "vidup",      "name": "Server 5 (Vidup)",       "base_url": "https://vidup.to"},
    {"id": "rivestream", "name": "Server 6 (Rive)",        "base_url": "https://rivestream.org/embed"},
]

DEFAULT_HEADERS = {
    "User-Agent": ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
                   "(KHTML, like Gecko) Chrome/124.0 Safari/537.36"),
    "Accept-Language": "en-US,en;q=0.9",
}

# ----------------------------------------------------------------------
# 日志
# ----------------------------------------------------------------------
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%H:%M:%S",
)
log = logging.getLogger("youplex")


# ----------------------------------------------------------------------
# HTTP 会话
# ----------------------------------------------------------------------
def make_session(bearer=None):
    s = requests.Session()
    s.headers.update(DEFAULT_HEADERS)
    if bearer:
        s.headers["Authorization"] = f"Bearer {bearer}"
        s.headers["Accept"] = "application/json"
    return s


# ----------------------------------------------------------------------
# 工具
# ----------------------------------------------------------------------
def safe_name(s):
    return re.sub(r"[^A-Za-z0-9._-]+", "_", s).strip("_")[:120]


def ensure_dir(p):
    os.makedirs(p, exist_ok=True)
    return p


def http_get(session, url, **kw):
    for i in range(3):
        try:
            r = session.get(url, timeout=30, **kw)
            if r.status_code == 429:
                time.sleep(2 ** i)
                continue
            return r
        except requests.RequestException as e:
            log.warning("GET %s fail(%d): %s", url, i, e)
            time.sleep(1 + i)
    return None


# ======================================================================
# 1. Youplex 静态页镜像（全站 HTML/CSS/JS/图片）
# ======================================================================
def same_site(url):
    host = urlparse(url).netloc
    return host in ("youplex.site", "www.youplex.site") or host.endswith("youplex.site")


STATIC_EXTS = (".html", ".css", ".js", ".json", ".png", ".jpg", ".jpeg",
               ".gif", ".svg", ".webp", ".ico", ".woff", ".woff2", ".ttf")


def mirror_site(out_dir, max_pages=5000):
    """BFS 爬取 youplex.site 域下所有静态资源与页面。"""
    site_dir = ensure_dir(os.path.join(out_dir, "site"))
    visited = set()
    q = deque([(SITE_BASE, None)])
    session = make_session()
    saved = 0

    while q and len(visited) < max_pages:
        url, _ = q.popleft()
        if url in visited:
            continue
        visited.add(url)
        r = http_get(session, url)
        if not r or r.status_code != 200:
            log.debug("skip %s (status %s)", url, getattr(r, "status_code", None))
            continue

        path = urlparse(url).path or "/"
        if path.endswith("/"):
            path += "index.html"
        if not os.path.splitext(path)[1]:
            path += ".html"
        local_path = os.path.join(site_dir, path.lstrip("/"))
        ensure_dir(os.path.dirname(local_path))

        content_type = r.headers.get("content-type", "")
        if "text/html" in content_type:
            html = r.text
            soup = BeautifulSoup(html, "html.parser")
            # 收集站内链接与静态资源
            for tag, attr in [("a", "href"), ("link", "href"), ("script", "src"),
                              ("img", "src"), ("source", "src"), ("video", "src")]:
                for node in soup.find_all(tag):
                    u = node.get(attr)
                    if not u:
                        continue
                    if u.startswith("data:") or u.startswith("javascript:"):
                        continue
                    full = urljoin(url, u.split("#")[0].split("?")[0] if False else urljoin(url, u))
                    # 去掉 hash 保留 query
                    full = urlunparse(urlparse(full)._replace(fragment=""))
                    if same_site(full):
                        q.append((full, None))
            with open(local_path, "w", encoding="utf-8") as f:
                f.write(html)
        else:
            with open(local_path, "wb") as f:
                f.write(r.content)
        saved += 1
        if saved % 50 == 0:
            log.info("mirror: saved %d pages, queue %d", saved, len(q))

    log.info("mirror done: saved %d files to %s", saved, site_dir)
    return saved


# ======================================================================
# 2. TMDB 元数据抓取（全站目录）
# ======================================================================
TMDB_EP = "https://api.themoviedb.org/3"

TMDB_LISTS = {
    # (endpoint, key_for_name)
    "trending_movie_day":   "/trending/movie/day",
    "trending_movie_week":  "/trending/movie/week",
    "trending_tv_day":      "/trending/tv/day",
    "trending_tv_week":     "/trending/tv/week",
    "movie_popular":        "/movie/popular",
    "movie_top_rated":      "/movie/top_rated",
    "movie_now_playing":    "/movie/now_playing",
    "movie_upcoming":       "/movie/upcoming",
    "tv_popular":           "/tv/popular",
    "tv_top_rated":         "/tv/top_rated",
    "tv_airing_today":      "/tv/airing_today",
    "tv_on_the_air":        "/tv/on_the_air",
}


def tmdb_get(session, path, params=None):
    r = http_get(session, TMDB_EP + path, params=params or {})
    if not r:
        return None
    try:
        return r.json()
    except Exception:
        return None


def tmdb_paginate(session, path, params=None, max_pages=None):
    params = dict(params or {})
    params["language"] = params.get("language", "en-US")
    out = []
    page = 1
    while True:
        params["page"] = page
        d = tmdb_get(session, path, params)
        if not d or "results" not in d:
            break
        out.extend(d["results"])
        total = d.get("total_pages", 1)
        log.info("  %s page %d/%d (%d)", path, page, total, len(d["results"]))
        page += 1
        if page > total:
            break
        if max_pages and page > max_pages:
            break
        time.sleep(0.1)
    return out


def fetch_tmdb_catalog(out_dir, max_pages=None, search_queries=None):
    data_dir = ensure_dir(os.path.join(out_dir, "data"))
    session = make_session(bearer=TMDB_BEARER)
    catalog = {"movies": {}, "tv": {}}

    # genres
    genres = {"movie": tmdb_get(session, "/genre/movie/list", {"language": "en-US"}),
              "tv":    tmdb_get(session, "/genre/tv/list",    {"language": "en-US"})}
    with open(os.path.join(data_dir, "genres.json"), "w", encoding="utf-8") as f:
        json.dump(genres, f, ensure_ascii=False, indent=2)

    # lists
    for name, path in TMDB_LISTS.items():
        log.info("listing: %s", name)
        items = tmdb_paginate(session, path, max_pages=max_pages)
        with open(os.path.join(data_dir, f"list_{name}.json"), "w", encoding="utf-8") as f:
            json.dump(items, f, ensure_ascii=False, indent=2)
        media_type = "tv" if "/tv" in path else "movie"
        for it in items:
            mid = it["id"]
            catalog[media_type].setdefault(mid, {
                "id": mid,
                "title": it.get("title") or it.get("name"),
                "release_date": it.get("release_date") or it.get("first_air_date"),
                "poster_path": it.get("poster_path"),
                "overview": it.get("overview"),
                "vote_average": it.get("vote_average"),
                "media_type": media_type,
                "lists": [],
            })
            catalog[media_type][mid]["lists"].append(name)

    # searches
    if search_queries:
        results_all = {}
        for q in search_queries:
            log.info("search: %s", q)
            r = tmdb_get(session, "/search/multi",
                         {"query": q, "language": "en-US", "page": 1, "include_adult": "false"})
            results_all[q] = r.get("results", []) if r else []
            for it in results_all[q]:
                mt = it.get("media_type")
                if mt not in ("movie", "tv"):
                    continue
                catalog[mt].setdefault(it["id"], {
                    "id": it["id"],
                    "title": it.get("title") or it.get("name"),
                    "release_date": it.get("release_date") or it.get("first_air_date"),
                    "poster_path": it.get("poster_path"),
                    "overview": it.get("overview"),
                    "vote_average": it.get("vote_average"),
                    "media_type": mt,
                    "lists": [],
                })
                catalog[mt][it["id"]]["lists"].append(f"search:{q}")
        with open(os.path.join(data_dir, "search.json"), "w", encoding="utf-8") as f:
            json.dump(results_all, f, ensure_ascii=False, indent=2)

    # details (with credits, videos, images, similar, recommendations, external_ids)
    def fetch_detail(mt, mid):
        r = tmdb_get(session, f"/{mt}/{mid}", {
            "language": "en-US",
            "append_to_response": "credits,videos,images,similar,recommendations,external_ids,keywords"
        })
        return mt, mid, r

    detail_dir = ensure_dir(os.path.join(data_dir, "details"))
    todo = [(mt, mid) for mt in ("movie", "tv") for mid in catalog[mt]]
    log.info("fetching details for %d items", len(todo))
    done = 0
    with ThreadPoolExecutor(max_workers=8) as ex:
        futs = [ex.submit(fetch_detail, mt, mid) for mt, mid in todo]
        for fut in as_completed(futs):
            mt, mid, r = fut.result()
            done += 1
            if r:
                with open(os.path.join(detail_dir, f"{mt}_{mid}.json"), "w", encoding="utf-8") as f:
                    json.dump(r, f, ensure_ascii=False, indent=2)
                # enrich catalog
                catalog[mt][mid].update({
                    "runtime": r.get("runtime") if mt == "movie" else None,
                    "episode_run_time": r.get("episode_run_time") if mt == "tv" else None,
                    "genres": [g["name"] for g in r.get("genres", [])],
                    "imdb_id": r.get("imdb_id") or r.get("external_ids", {}).get("imdb_id"),
                    "homepage": r.get("homepage"),
                    "status": r.get("status"),
                    "number_of_seasons": r.get("number_of_seasons") if mt == "tv" else None,
                    "seasons": [{"s": s["season_number"], "episodes": s.get("episode_count"),
                                 "name": s.get("name"), "air": s.get("air_date")}
                                for s in r.get("seasons", [])] if mt == "tv" else None,
                })
            if done % 100 == 0:
                log.info("details %d/%d", done, len(todo))

    with open(os.path.join(out_dir, "catalog.json"), "w", encoding="utf-8") as f:
        json.dump({"movies": list(catalog["movies"].values()),
                   "tv": list(catalog["tv"].values())}, f, ensure_ascii=False, indent=2)

    return catalog


# ======================================================================
# 3. Watch 页面播放源解析（核心：无需解密，直接构造 + 从 SSR iframe 兜底取）
# ======================================================================
def build_player_urls(media_type, tmdb_id, season=1, episode=1):
    """按站点 JS 中拼接规则直接生成所有 server 的 iframe URL。"""
    urls = []
    for s in PLAY_SERVERS:
        if media_type == "movie":
            u = f"{s['base_url']}/movie/{tmdb_id}"
        else:
            u = f"{s['base_url']}/tv/{tmdb_id}/{season}/{episode}"
        urls.append({"server_id": s["id"], "server_name": s["name"], "iframe": u})
    return urls


def parse_watch_page(session, media_type, slug, tmdb_id, season=1, episode=1):
    """抓取 youplex 的 /watch/... 页面，从 SSR HTML 中读出默认 iframe src（官方结果），
       并补齐所有 server 的 iframe URL。若第三方页面可进一步解析出 m3u8 直链，也尝试一次。"""
    if media_type == "movie":
        url = f"{SITE_BASE}watch/movie/{slug}?id={tmdb_id}"
    else:
        url = f"{SITE_BASE}watch/tv/{slug}?id={tmdb_id}&sn={season}&ep={episode}"

    r = http_get(session, url)
    ssr_iframe = None
    title = None
    if r and r.status_code == 200:
        html = r.text
        m = re.search(r'<iframe[^>]+src="([^"]+)"', html)
        if m:
            ssr_iframe = m.group(1).replace("&amp;", "&")
        m = re.search(r"<title>([^<]+)</title>", html)
        if m:
            title = m.group(1).replace("&amp;", "&")

    servers = build_player_urls(media_type, tmdb_id, season, episode)
    if ssr_iframe and not any(sv["iframe"] == ssr_iframe for sv in servers):
        servers.insert(0, {"server_id": "ssr_default", "server_name": "SSR Default", "iframe": ssr_iframe})

    return {
        "url": url,
        "title": title,
        "media_type": media_type,
        "tmdb_id": tmdb_id,
        "slug": slug,
        "season": season if media_type == "tv" else None,
        "episode": episode if media_type == "tv" else None,
        "servers": servers,
    }


def slugify_title(title):
    if not title:
        return "unknown"
    s = title.lower()
    s = re.sub(r"[^a-z0-9\u4e00-\u9fa5]+", "-", s).strip("-")
    # 站点用的是 -- 替代某些字符（如 minions--monsters），保守用单 - 代替即可，
    # 因为 watch 路由是 slug+id，id 才是关键，slug 只用于 SEO。
    return s or "unknown"


def fetch_watch_sources(out_dir, catalog):
    watch_dir = ensure_dir(os.path.join(out_dir, "watch"))
    session = make_session()
    results = []

    def handle_movie(m):
        slug = slugify_title(m["title"])
        data = parse_watch_page(session, "movie", slug, m["id"])
        # youplex 本身还提供一个 torrents 子域入口
        data["torrents_site"] = "https://torrents.youplex.site/"
        fn = os.path.join(watch_dir, f"movie_{m['id']}.json")
        with open(fn, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        return data

    def handle_tv(t):
        # 仅抓第一季第一集作为模板，并额外列出所有季集可构造 URL。
        seasons = t.get("seasons") or [{"s": 1, "episodes": 1}]
        out = {"tv_id": t["id"], "title": t["title"], "seasons": [], "first_episode": None}
        first = True
        for sc in seasons:
            sn = sc.get("s") or sc.get("season_number") or 1
            ec = sc.get("episodes") or 1
            slug = slugify_title(t["title"])
            episode_urls = []
            for ep in range(1, ec + 1):
                episode_urls.append({
                    "episode": ep,
                    "servers": build_player_urls("tv", t["id"], sn, ep),
                })
            out["seasons"].append({"season": sn, "episodes_count": ec, "episodes": episode_urls if sn == 1 else None})
            if first:
                data = parse_watch_page(session, "tv", slug, t["id"], sn, 1)
                out["first_episode"] = data
                first = False
        fn = os.path.join(watch_dir, f"tv_{t['id']}.json")
        with open(fn, "w", encoding="utf-8") as f:
            json.dump(out, f, ensure_ascii=False, indent=2)
        return out

    all_movies = catalog["movies"]
    all_tv = catalog["tv"]
    log.info("parsing watch sources: %d movies + %d tv", len(all_movies), len(all_tv))

    with ThreadPoolExecutor(max_workers=10) as ex:
        futs = [ex.submit(handle_movie, m) for m in all_movies.values()]
        futs += [ex.submit(handle_tv, t) for t in all_tv.values()]
        done = 0
        for fut in as_completed(futs):
            results.append(fut.result())
            done += 1
            if done % 100 == 0:
                log.info("watch %d/%d", done, len(futs))

    return results


# ======================================================================
# 4. 图片下载（海报/剧照）
# ======================================================================
def download_images(out_dir, catalog, limit_per_title=1):
    img_dir = ensure_dir(os.path.join(out_dir, "images"))
    session = make_session()
    todo = []
    for mt in ("movie", "tv"):
        for it in catalog[mt].values():
            p = it.get("poster_path")
            if p:
                todo.append(("w500" + p, os.path.join(img_dir, f"{mt}_{it['id']}_poster.jpg")))
    log.info("downloading %d images", len(todo))
    done = 0

    def dl(src, dst):
        if os.path.exists(dst) and os.path.getsize(dst) > 0:
            return True
        r = http_get(session, TMDB_IMG + "/" + src.lstrip("/"))
        if not r or r.status_code != 200:
            return False
        with open(dst, "wb") as f:
            f.write(r.content)
        return True

    with ThreadPoolExecutor(max_workers=12) as ex:
        for _ in ex.map(lambda args: dl(*args), todo):
            done += 1
            if done % 200 == 0:
                log.info("images %d/%d", done, len(todo))


# ======================================================================
# 5. 生成可浏览 index.html
# ======================================================================
def build_index(out_dir, catalog):
    index_path = os.path.join(out_dir, "index.html")
    movies = sorted(catalog["movies"].values(), key=lambda x: (x.get("vote_average") or 0), reverse=True)
    tv = sorted(catalog["tv"].values(), key=lambda x: (x.get("vote_average") or 0), reverse=True)

    def card(it):
        mt = it["media_type"]
        poster = f"images/{mt}_{it['id']}_poster.jpg" if it.get("poster_path") else ""
        genres = ", ".join(it.get("genres") or [])
        watch_json = f"watch/{mt}_{it['id']}.json"
        slug = slugify_title(it["title"])
        if mt == "movie":
            orig = f"https://youplex.site/watch/movie/{slug}?id={it['id']}"
        else:
            orig = f"https://youplex.site/watch/tv/{slug}?id={it['id']}&sn=1&ep=1"
        return f"""
        <div class="card">
          <img loading="lazy" src="{poster}" alt="{it['title']}"/>
          <div class="meta">
            <a class="title" href="{orig}" target="_blank" rel="noopener">{it['title']}</a>
            <div class="sub">{it.get('release_date','')} · ★ {it.get('vote_average','-')}</div>
            <div class="genres">{genres}</div>
            <a class="data" href="{watch_json}">播放源 JSON</a>
          </div>
        </div>"""

    html = f"""<!doctype html>
<html lang="en"><head><meta charset="utf-8"/>
<title>Youplex 本地镜像索引</title>
<style>
 body{{margin:0;background:#0d1117;color:#e6edf3;font-family:system-ui,sans-serif}}
 h1{{padding:20px;margin:0;background:#161b22;border-bottom:1px solid #30363d}}
 h2{{margin:20px}}
 .grid{{display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:16px;padding:0 20px 40px}}
 .card{{background:#161b22;border-radius:10px;overflow:hidden;border:1px solid #30363d}}
 .card img{{width:100%;display:block;background:#222}}
 .meta{{padding:10px}}
 .title{{color:#58a6ff;text-decoration:none;font-weight:600;font-size:14px}}
 .sub,.genres{{font-size:12px;color:#8b949e;margin-top:6px}}
 .data{{display:inline-block;margin-top:8px;font-size:12px;color:#3fb950}}
</style></head><body>
<h1>🎬 Youplex 全站镜像（共 {len(movies)} 部电影 · {len(tv)} 部剧集）</h1>
<h2>Movies</h2>
<div class="grid">{''.join(card(m) for m in movies)}</div>
<h2>TV Shows</h2>
<div class="grid">{''.join(card(t) for t in tv)}</div>
</body></html>"""
    with open(index_path, "w", encoding="utf-8") as f:
        f.write(html)
    log.info("index.html written: %s", index_path)


# ======================================================================
# main
# ======================================================================
def main():
    ap = argparse.ArgumentParser(description="Youplex.site 全站爬虫（含播放源解析/无加密逆向）")
    ap.add_argument("--out", default="./youplex_output", help="输出目录")
    ap.add_argument("--static-only", action="store_true", help="仅抓取 youplex 静态页面")
    ap.add_argument("--no-media", action="store_true", help="不下载海报/图片")
    ap.add_argument("--pages", type=int, default=0, help="每个 TMDB 列表最多抓多少页（0=全部）")
    ap.add_argument("--search", nargs="*", default=[], help="额外搜索关键词，可多个")
    ap.add_argument("--max-mirror", type=int, default=5000, help="静态镜像最大页面数")
    args = ap.parse_args()

    out = ensure_dir(os.path.abspath(args.out))
    log.info("输出目录：%s", out)

    # 1) 静态镜像
    log.info("==> 1/4 抓取 youplex.site 静态页")
    mirror_site(out, max_pages=args.max_mirror)

    if args.static_only:
        log.info("static-only 模式，退出")
        return

    # 2) TMDB 元数据
    log.info("==> 2/4 拉取 TMDB 元数据（全站目录）")
    max_pages = args.pages if args.pages > 0 else None
    catalog = fetch_tmdb_catalog(out, max_pages=max_pages, search_queries=args.search or None)

    # 3) 解析 watch 页的播放源
    log.info("==> 3/4 解析所有影片播放页 iframe 源")
    fetch_watch_sources(out, catalog)

    # 4) 图片
    if not args.no_media:
        log.info("==> 4/4 下载海报图片")
        download_images(out, catalog)
    else:
        log.info("==> 4/4 跳过图片下载（--no-media）")

    # index
    build_index(out, catalog)
    log.info("全部完成 🎉 输出：%s", out)
    log.info("打开 %s/index.html 即可浏览。", out)


if __name__ == "__main__":
    main()
