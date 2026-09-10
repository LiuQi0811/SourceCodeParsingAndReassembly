#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
IndieLens (indielens.org) 全站抓取工具
======================================

逆向分析结论：
  - 前端：Angular 17+ SPA，静态资源清单已硬编码在本脚本中
  - 后端：https://api.indielens.org/  （TMDB v3 兼容代理，免 API Key，无加密/签名）
  - 图片：image.tmdb.org / media.themoviedb.org
  - 视频：第三方 iframe（vidsrcme.ru / player.videasy.net），属于外站，本脚本只记录链接
  - i18n：10 种语言（de, en, es, fr, hi, ja, ko, pt, ru, zh），/i18n/{lang}.json
  - TMDB 原生 500 页限制：脚本默认按"年份×类型"切片绕过，可通过 --full 启用

用法示例：
  python indielens_scraper.py                       # 默认模式：静态资源 + 核心元数据
  python indielens_scraper.py --full                # 全量抓取（按年份×类型切片，数据量大）
  python indielens_scraper.py --no-images           # 不下载海报/剧照
  python indielens_scraper.py --concurrency 8       # 并发数
  python indielens_scraper.py --out ./indielens_dump --lang zh-CN

输出目录结构：
  indielens_dump/
  ├── site/                # 前端静态镜像（HTML/JS/CSS/SVG/字体/i18n/manifest）
  ├── api/
  │   ├── genres/          # 分类列表
  │   ├── configuration/   # countries 等配置
  │   ├── trending/        # 热门榜单
  │   ├── discover/        # 发现列表（按 type/genre/year 切片）
  │   ├── movies/          # 每部电影详情 {id}.json
  │   ├── tv/              # 剧集详情 {id}.json  + seasons/{id}_{n}.json
  │   ├── persons/         # 人物详情 {id}.json
  │   ├── collections/     # 合集详情 {id}.json
  │   ├── topics/          # 主题（关键词）列表与作品
  │   └── search/          # 搜索演示
  └── images/
      ├── poster/          # 海报 w342
      ├── backdrop/        # 背景 w1280
      ├── profile/         # 头像 w185
      └── logo/            # 标志
"""

from __future__ import annotations
import argparse
import json
import os
import re
import sys
import time
import logging
import hashlib
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor, as_completed
from urllib.parse import urljoin, urlparse

import requests
from tqdm import tqdm

# ---------------------------------------------------------------------------
# 配置
# ---------------------------------------------------------------------------
ORIGIN = "https://indielens.org/"
API_BASE = "https://api.indielens.org/"
SITE_STATIC = "/sites/indielens/"          # Angular 中 siteConfig.static
IMAGE_BASE = "https://image.tmdb.org/t/p/"
MEDIA_IMAGE_BASE = "https://media.themoviedb.org/t/p/"

DEFAULT_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
    ),
    "Accept": "application/json, text/plain, */*",
    "Accept-Language": "en-US,en;q=0.9",
    "Referer": ORIGIN,
}

# 前端静态资源清单（从 HTML/JS 逆向得到）
STATIC_ASSETS = [
    # 入口 HTML + Angular 构建产物（hash 可能会变，脚本会自动探测更新）
    "/",
    "/monetag.js",
    # 品牌图标 / 占位图 / manifest
    "/sites/indielens/brand.svg",
    "/sites/indielens/favicon.ico",
    "/sites/indielens/web-app-manifest-192x192.png",
    "/sites/indielens/web-app-manifest-512x512.png",
    "/no-image.svg",
    "/no-photo.svg",
    # animate.css (CDN) —— 本地镜像
    "https://cdnjs.cloudflare.com/ajax/libs/animate.css/4.1.1/animate.min.css",
]

# 10 种前端语言
LANGS = ["de", "en", "es", "fr", "hi", "ja", "ko", "pt", "ru", "zh"]

# TMDB 媒体类型
MEDIA_TYPES = ["movie", "tv"]

# Topics 关键词（逆向自 main.js 中 sy 数组）
TOPICS = [
    {"name": "All", "id": None},
    {"name": "Adventure", "id": "322942"},
    {"name": "Friendship", "id": "6054"},
    {"name": "Revenge", "id": "9748"},
    {"name": "Time Travel", "id": "4379"},
    {"name": "Artificial Intelligence", "id": "310"},
    {"name": "Martial Arts", "id": "779"},
    {"name": "Space Exploration", "id": "191132"},
    {"name": "Superhero", "id": "9715"},
    {"name": "Zombie", "id": "12377"},
    {"name": "Road Trip", "id": "7312"},
    {"name": "Manga", "id": "295446"},
    {"name": "Band", "id": "311916"},
    {"name": "Cooking", "id": "1918"},
    {"name": "Murder", "id": "9826"},
    {"name": "Spy", "id": "470"},
    {"name": "Confession", "id": "718"},
    {"name": "Vampire", "id": "3133"},
    {"name": "Wild West", "id": "155573"},
    {"name": "Corruption", "id": "417"},
    {"name": "Business", "id": "12094"},
    {"name": "Coming of age", "id": "10683"},
    {"name": "Cyberpunk", "id": "12190"},
    {"name": "Cars", "id": "286354"},
    {"name": "Shootout", "id": "10950"},
]

# TMDB 500 页上限的应对：按年份切片，覆盖 1900 ~ 2026
YEARS = list(range(1900, 2027))

# 图片尺寸（挑选站点实际用到的）
IMG_SIZES = {
    "poster": "w342",
    "backdrop": "w1280",
    "profile": "w185",
    "logo": "w45",
}

# ---------------------------------------------------------------------------
# 日志
# ---------------------------------------------------------------------------
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%H:%M:%S",
)
log = logging.getLogger("indielens")


# ---------------------------------------------------------------------------
# HTTP 会话（带重试 + 限速）
# ---------------------------------------------------------------------------
class Scraper:
    def __init__(self, out: Path, concurrency: int = 6, rate_limit: float = 0.2,
                 download_images: bool = True, lang: str = "en-US",
                 full: bool = False, max_pages_per_slice: int = 500):
        self.out = out
        self.concurrency = concurrency
        self.rate_limit = rate_limit
        self.download_images = download_images
        self.lang = lang
        self.full = full
        self.max_pages_per_slice = max_pages_per_slice
        self.session = requests.Session()
        self.session.headers.update(DEFAULT_HEADERS)
        self._last_call = 0.0
        # 记录已抓取的详情 id，避免重复
        self._seen_ids = {"movie": set(), "tv": set(), "person": set(), "collection": set()}
        # 记录已下载图片
        self._seen_images = set()
        # 动态探测的 JS/CSS 文件名
        self.bundles = {"main": None, "polyfills": None, "styles": None}

    # ---- 基础 HTTP ----
    def _throttle(self):
        dt = time.time() - self._last_call
        if dt < self.rate_limit:
            time.sleep(self.rate_limit - dt)
        self._last_call = time.time()

    def get(self, url: str, *, _json: bool = True, _retries: int = 4, **kwargs):
        self._throttle()
        for i in range(_retries):
            try:
                r = self.session.get(url, timeout=30, **kwargs)
                if r.status_code == 429:
                    wait = int(r.headers.get("Retry-After", "3"))
                    log.warning(f"Rate limited on {url}, sleep {wait}s")
                    time.sleep(wait)
                    continue
                if r.status_code >= 500:
                    time.sleep(1 + i)
                    continue
                r.raise_for_status()
                if _json:
                    return r.json()
                return r.content
            except (requests.RequestException, ValueError) as e:
                if i == _retries - 1:
                    log.error(f"Failed GET {url}: {e}")
                    return None if _json else b""
                time.sleep(1 + i * 2)

    def download(self, url: str, dest: Path) -> bool:
        """下载二进制到文件，断点续传。返回是否新下载。"""
        dest.parent.mkdir(parents=True, exist_ok=True)
        if dest.exists() and dest.stat().st_size > 0:
            return False
        data = self.get(url, _json=False)
        if not data:
            return False
        tmp = dest.with_suffix(dest.suffix + ".part")
        tmp.write_bytes(data)
        tmp.replace(dest)
        return True

    # ---- 工具 ----
    @staticmethod
    def _slug(path: str) -> Path:
        """把 URL 路径转成安全的本地路径"""
        path = path.split("?", 1)[0].split("#", 1)[0]
        if path.startswith("http"):
            p = urlparse(path)
            path = f"_external/{p.netloc}{p.path}"
        if path.endswith("/"):
            path = path + "index.html"
        if path.startswith("/"):
            path = path.lstrip("/")
        if not path:
            path = "index.html"
        return Path(path)

    def _save_json(self, where: Path, data):
        where.parent.mkdir(parents=True, exist_ok=True)
        where.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")

    def _queue_image(self, path: str | None, kind: str):
        """根据 TMDB 路径生成图片 URL 并排队下载"""
        if not self.download_images or not path:
            return
        if path in self._seen_images:
            return
        self._seen_images.add(path)
        size = IMG_SIZES.get(kind, "original")
        url = f"{IMAGE_BASE}{size}{path}"
        # 处理 media.themoviedb.org 备用
        local = self.out / "images" / kind / path.lstrip("/")
        self.download(url, local)

    # ---- 前端静态资源 ----
    def _probe_entry_bundles(self):
        """访问首页，探测当前构建的 main/polyfills/styles 文件名（含 hash）"""
        html = self.get(ORIGIN, _json=False)
        if not html:
            return
        html = html.decode("utf-8", errors="ignore")
        (self.out / "site" / "index.html").parent.mkdir(parents=True, exist_ok=True)
        (self.out / "site" / "index.html").write_text(html, encoding="utf-8")
        for key, pattern in [
            ("main", re.compile(r'src="(main-[A-Z0-9]+\.js)"')),
            ("polyfills", re.compile(r'src="(polyfills-[A-Z0-9]+\.js)"')),
            ("styles", re.compile(r'href="(styles-[A-Z0-9]+\.css)"')),
        ]:
            m = pattern.search(html)
            if m:
                self.bundles[key] = m.group(1)
                log.info(f"Detected bundle {key} = {m.group(1)}")

    def fetch_site_assets(self):
        """下载前端静态镜像"""
        log.info("==> 1. 下载前端静态资源")
        site = self.out / "site"
        # 探测并保存入口
        self._probe_entry_bundles()
        # 固定静态资源
        assets = list(STATIC_ASSETS)
        # 动态 bundle
        for k, v in self.bundles.items():
            if v and v not in assets and ("/" + v) not in assets:
                assets.append("/" + v)
        for url in assets:
            full = url if url.startswith("http") else urljoin(ORIGIN, url)
            rel = self._slug(url if not url.startswith("http") else url)
            dest = site / rel
            is_new = self.download(full, dest)
            log.info(f"  {'↓' if is_new else '·'} {rel}")
        # i18n 翻译文件
        log.info("  → 下载 i18n 翻译文件")
        for lang in LANGS:
            url = f"{ORIGIN}i18n/{lang}.json"
            self.download(url, site / "i18n" / f"{lang}.json")
        log.info(f"     共 {len(LANGS)} 个语言包")

    # ---- API 辅助 ----
    def api_get(self, path: str, params: dict | None = None):
        sep = "&" if "?" in path else "?"
        url = f"{API_BASE}{path}{sep}language={self.lang}"
        if params:
            from urllib.parse import urlencode
            url += "&" + urlencode(params)
        return self.get(url)

    def api_paginate(self, path: str, params: dict | None = None,
                     max_pages: int | None = None) -> list[dict]:
        """自动翻页收集所有 results（受 max_pages 限制）"""
        params = dict(params or {})
        out = []
        page = 1
        while True:
            params["page"] = page
            d = self.api_get(path, params)
            if not d or "results" not in d:
                break
            out.extend(d["results"])
            total_pages = d.get("total_pages", 1)
            if page >= total_pages:
                break
            if max_pages and page >= max_pages:
                break
            page += 1
        return out

    # ---- 1) 基础配置 ----
    def fetch_configuration(self):
        log.info("==> 2. 抓取基础配置 (genres / countries)")
        api = self.out / "api"
        # countries
        countries = self.api_get("configuration/countries") or []
        self._save_json(api / "configuration" / "countries.json", countries)
        log.info(f"  countries: {len(countries)}")
        # genres
        genres = {}
        for t in MEDIA_TYPES:
            d = self.api_get(f"genre/{t}/list") or {}
            genres[t] = d.get("genres", [])
            self._save_json(api / "genres" / f"{t}.json", genres[t])
        # anime = tv genre 16
        genres["anime"] = [{"id": 16, "name": "Animation"}] + [g for g in genres["tv"] if g["id"] != 16]
        self._save_json(api / "genres" / "anime.json", genres["anime"])
        log.info(f"  genres: movie={len(genres['movie'])}, tv={len(genres['tv'])}")
        return genres

    # ---- 2) Trending ----
    def fetch_trending(self, pages=5):
        log.info("==> 3. 抓取 Trending 榜单")
        api = self.out / "api" / "trending"
        out = {}
        for t in ["movie", "tv", "all"]:
            out[t] = {}
            for w in ["day", "week"]:
                items = self.api_paginate(f"trending/{t}/{w}", max_pages=pages)
                out[t][w] = items
                self._extract_ids_from_list(items)
                log.info(f"  trending/{t}/{w}: {len(items)} 条（前{pages}页）")
        self._save_json(api / "trending.json", out)
        return out

    # ---- 3) Discover（按切片）----
    def fetch_discover(self, genres):
        log.info("==> 4. 抓取 Discover 列表")
        api = self.out / "api" / "discover"
        all_slices = {}

        slices = []
        # 默认模式：按 genre × 当前十年，不跨年切片
        if not self.full:
            for t in MEDIA_TYPES + ["anime"]:
                gs = genres[t]
                for g in gs[:3]:  # 默认只取前 3 个 genre（快速样例）
                    slices.append((t, g["id"], None))
            # 默认再取最近 3 年，每切片限 3 页
            for y in range(2024, 2027):
                for t in MEDIA_TYPES:
                    slices.append((t, None, y))
            self.max_pages_per_slice = 3
        else:
            # 全量：按 年份×genre 切片以绕过 500 页限制
            for t in MEDIA_TYPES + ["anime"]:
                gs = genres[t]
                for g in gs:
                    for y in YEARS:
                        slices.append((t, g["id"], y))

        log.info(f"  共 {len(slices)} 个切片，开始并发拉取...")

        def _do(slc):
            t, gid, y = slc
            params = {"sort_by": "popularity.desc"}
            if gid:
                params["with_genres"] = str(gid) if t != "anime" else f"{gid},16" if gid != 16 else "16"
            if y:
                if t == "movie":
                    params["primary_release_year"] = str(y)
                else:
                    params["first_air_date_year"] = str(y)
            # 注意 anine 是 tv + genre 16
            real_type = "tv" if t == "anime" else t
            items = []
            page = 1
            while True:
                params["page"] = page
                d = self.api_get(f"discover/{real_type}", params)
                if not d or "results" not in d:
                    break
                items.extend(d["results"])
                if page >= d.get("total_pages", 1) or page >= self.max_pages_per_slice:
                    break
                page += 1
            return slc, items

        results = []
        with ThreadPoolExecutor(max_workers=self.concurrency) as ex:
            futs = [ex.submit(_do, s) for s in slices]
            for fu in tqdm(as_completed(futs), total=len(futs), desc="discover"):
                slc, items = fu.result()
                t, gid, y = slc
                key = f"{t}/g{gid or 'all'}/y{y or 'all'}"
                all_slices[key] = [{"id": i["id"], "media_type": i.get("media_type", t)} for i in items]
                self._extract_ids_from_list(items)
                results.append(len(items))
        log.info(f"  discover 完成，累计拉取列表条目 {sum(results)}")
        self._save_json(api / "slices.json", all_slices)
        return all_slices

    # ---- 4) Topics ----
    def fetch_topics(self, max_pages=20):
        log.info("==> 5. 抓取 Topics（关键词主题）")
        api = self.out / "api" / "topics"
        out = {"topics": TOPICS, "items": {}}
        for tpc in TOPICS:
            kid = tpc["id"]
            name = tpc["name"]
            params = {"sort_by": "popularity.desc"}
            if kid:
                params["with_keywords"] = kid
            items = self.api_paginate("discover/movie", params, max_pages=max_pages)
            out["items"][name] = [{"id": i["id"], "title": i.get("title"), "release_date": i.get("release_date")}
                                  for i in items]
            self._extract_ids_from_list(items)
            log.info(f"  topic '{name}': {len(items)} 条")
        self._save_json(api / "topics.json", out)
        return out

    # ---- 5) Popular People ----
    def fetch_persons_list(self, pages: int = 20):
        log.info(f"==> 6. 抓取 Popular People（前 {pages} 页）")
        people = []
        for p in range(1, pages + 1):
            d = self.api_get("person/popular", {"page": p})
            if not d or "results" not in d:
                break
            people.extend(d["results"])
            for p_ in d["results"]:
                self._seen_ids["person"].add(p_["id"])
                self._queue_image(p_.get("profile_path"), "profile")
        self._save_json(self.out / "api" / "person" / "popular.json", people)
        log.info(f"  people: {len(people)}")
        return people

    # ---- 6) 详情抓取 ----
    def _extract_ids_from_list(self, items):
        for it in items:
            mid = it.get("id")
            mt = it.get("media_type")
            if not mid:
                continue
            if mt in ("movie", "tv"):
                self._seen_ids[mt].add(mid)
            # 默认 movie
            if "title" in it and mt is None:
                self._seen_ids["movie"].add(mid)
            elif "name" in it and mt is None:
                self._seen_ids["tv"].add(mid)
            # 排队图片
            self._queue_image(it.get("poster_path"), "poster")
            self._queue_image(it.get("backdrop_path"), "backdrop")
            self._queue_image(it.get("profile_path"), "profile")

    def fetch_detail(self, media_type: str, mid: int) -> dict | None:
        """抓取单个 movie/tv 的详情（append_to_response 全量）"""
        extra = "videos,images,keywords,credits,similar,recommendations,reviews"
        if media_type == "tv":
            extra += ",content_ratings,external_ids"
        d = self.api_get(f"{media_type}/{mid}", {"append_to_response": extra})
        if not d or "id" not in d:
            return None
        # 收集图片
        self._queue_image(d.get("poster_path"), "poster")
        self._queue_image(d.get("backdrop_path"), "backdrop")
        for img in d.get("images", {}).get("posters", []):
            self._queue_image(img.get("file_path"), "poster")
        for img in d.get("images", {}).get("backdrops", []):
            self._queue_image(img.get("file_path"), "backdrop")
        for img in d.get("images", {}).get("logos", []):
            self._queue_image(img.get("file_path"), "logo")
        # 收集演职员 id
        for c in d.get("credits", {}).get("cast", []) + d.get("credits", {}).get("crew", []):
            self._seen_ids["person"].add(c["id"])
            self._queue_image(c.get("profile_path"), "profile")
        # 收集 belongs_to_collection
        bc = d.get("belongs_to_collection")
        if bc and bc.get("id"):
            self._seen_ids["collection"].add(bc["id"])
            self._queue_image(bc.get("poster_path"), "poster")
            self._queue_image(bc.get("backdrop_path"), "backdrop")
        # similar / recommendations -> 继续补 id
        for k in ("similar", "recommendations"):
            lst = d.get(k, {}).get("results", [])
            for it in lst:
                self._seen_ids[media_type].add(it["id"])
        # TV: 季
        if media_type == "tv":
            for s in d.get("seasons", []):
                self._queue_image(s.get("poster_path"), "poster")
        return d

    def fetch_all_details(self, max_items_per_type: int | None = None):
        log.info("==> 7. 抓取所有 movie/tv 详情（含演职员/推荐/评论/视频）")
        api = self.out / "api"
        for t in MEDIA_TYPES:
            ids = sorted(self._seen_ids[t])
            if max_items_per_type:
                ids = ids[:max_items_per_type]
            log.info(f"  {t} 共 {len(ids)} 个 id 待抓")
            out_dir = api / {"movie": "movies", "tv": "tv"}[t]
            out_dir.mkdir(parents=True, exist_ok=True)
            done = 0
            with ThreadPoolExecutor(max_workers=self.concurrency) as ex:
                def _one(mid):
                    fp = out_dir / f"{mid}.json"
                    if fp.exists():
                        return ("skip", mid)
                    d = self.fetch_detail(t, mid)
                    if d:
                        self._save_json(fp, d)
                        return ("ok", mid)
                    return ("fail", mid)
                for r in tqdm(ex.map(_one, ids), total=len(ids), desc=f"detail:{t}"):
                    done += 1

    # ---- 7) TV 季集详情 ----
    def fetch_tv_seasons(self, max_tv: int | None = None):
        log.info("==> 8. 抓取 TV 季详情")
        tv_dir = self.out / "api" / "tv"
        season_dir = tv_dir / "seasons"
        season_dir.mkdir(parents=True, exist_ok=True)
        tv_files = sorted(tv_dir.glob("*.json"))
        if max_tv:
            tv_files = tv_files[:max_tv]
        count = 0
        for fp in tqdm(tv_files, desc="seasons"):
            try:
                d = json.loads(fp.read_text(encoding="utf-8"))
            except Exception:
                continue
            tid = d["id"]
            for s in d.get("seasons", []):
                sn = s.get("season_number")
                if sn is None:
                    continue
                sfp = season_dir / f"{tid}_{sn}.json"
                if sfp.exists():
                    continue
                sd = self.api_get(f"tv/{tid}/season/{sn}")
                if sd:
                    self._save_json(sfp, sd)
                    count += 1
                    for ep in sd.get("episodes", []):
                        self._queue_image(ep.get("still_path"), "backdrop")
                        for c in ep.get("crew", []) + ep.get("guest_stars", []):
                            self._seen_ids["person"].add(c["id"])
        log.info(f"  下载了 {count} 个 season 详情")

    # ---- 8) Person / Collection 详情 ----
    def fetch_person_details(self, max_persons: int | None = None):
        log.info("==> 9. 抓取 Person 详情")
        out = self.out / "api" / "persons"
        out.mkdir(parents=True, exist_ok=True)
        ids = sorted(self._seen_ids["person"])
        if max_persons:
            ids = ids[:max_persons]

        def _one(pid):
            fp = out / f"{pid}.json"
            if fp.exists():
                return
            d = self.api_get(f"person/{pid}", {"append_to_response": "combined_credits,images,external_ids"})
            if d and "id" in d:
                self._save_json(fp, d)
                self._queue_image(d.get("profile_path"), "profile")
                for img in d.get("images", {}).get("profiles", []):
                    self._queue_image(img.get("file_path"), "profile")

        with ThreadPoolExecutor(max_workers=self.concurrency) as ex:
            list(tqdm(ex.map(_one, ids), total=len(ids), desc="persons"))
        log.info(f"  person 详情完成: {len(ids)}")

    def fetch_collections(self):
        log.info("==> 10. 抓取 Collection 详情")
        out = self.out / "api" / "collections"
        out.mkdir(parents=True, exist_ok=True)
        ids = sorted(self._seen_ids["collection"])

        def _one(cid):
            fp = out / f"{cid}.json"
            if fp.exists():
                return
            d = self.api_get(f"collection/{cid}")
            if d and "id" in d:
                self._save_json(fp, d)
                self._queue_image(d.get("poster_path"), "poster")
                self._queue_image(d.get("backdrop_path"), "backdrop")
                for p in d.get("parts", []):
                    self._seen_ids["movie"].add(p["id"])
        with ThreadPoolExecutor(max_workers=self.concurrency) as ex:
            list(tqdm(ex.map(_one, ids), total=len(ids), desc="collections"))
        log.info(f"  collection 完成: {len(ids)}")

    # ---- 9) 搜索接口演示 ----
    def fetch_search_demo(self):
        log.info("==> 11. 搜索接口探测（top 常见词）")
        out = self.out / "api" / "search"
        out.mkdir(parents=True, exist_ok=True)
        demo_queries = ["love", "war", "hero", "dark", "night", "city", "girl", "man", "world"]
        for q in demo_queries:
            d = self.api_get("search/multi", {"query": q, "include_adult": "false", "page": 1})
            if d:
                self._save_json(out / f"{q}.json", d)
                self._extract_ids_from_list(d.get("results", []))
        log.info(f"  搜索 demo 完成: {len(demo_queries)} 个词")

    # ---- 10) 生成首页路由预渲染索引 ----
    def build_index(self):
        log.info("==> 12. 写入索引文件 index.json")
        idx = {
            "origin": ORIGIN,
            "api": API_BASE,
            "language": self.lang,
            "bundles": self.bundles,
            "topics": TOPICS,
            "stats": {
                "movies": len(self._seen_ids["movie"]),
                "tv": len(self._seen_ids["tv"]),
                "person": len(self._seen_ids["person"]),
                "collection": len(self._seen_ids["collection"]),
                "images": len(self._seen_images),
            },
            "routes": [
                "/", "/movie", "/tv", "/anime", "/topics",
                "/search", "/about-us", "/faq", "/feedback",
                "/partners", "/privacy-policy",
                "/following", "/history", "/playlist",
            ],
        }
        self._save_json(self.out / "index.json", idx)
        log.info(f"  统计: {idx['stats']}")

    # ---- 主流程 ----
    def run(self):
        t0 = time.time()
        self.out.mkdir(parents=True, exist_ok=True)
        # 1) 静态站点
        self.fetch_site_assets()
        # 2) 配置
        genres = self.fetch_configuration()
        # 3) Trending
        self.fetch_trending(pages=5 if self.full else 2)
        # 4) Topics
        self.fetch_topics(max_pages=20 if self.full else 2)
        # 5) Search demo
        self.fetch_search_demo()
        # 6) Discover 列表（这一步收集 id）
        self.fetch_discover(genres)
        # 7) Popular people
        self.fetch_persons_list(pages=10)
        # 8) 详情
        max_d = None if self.full else 100
        self.fetch_all_details(max_items_per_type=max_d)
        # 9) TV seasons
        self.fetch_tv_seasons(max_tv=max_d)
        # 10) collections（可能从 movie 详情里发现更多 movie id）
        self.fetch_collections()
        # 11) persons
        self.fetch_person_details(max_persons=None if self.full else 500)
        # 12) 索引
        self.build_index()
        log.info(f"✅ 全部完成，耗时 {time.time()-t0:.1f}s，输出目录: {self.out}")


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------
def main():
    ap = argparse.ArgumentParser(description="IndieLens.org 全站抓取（含 API 逆向）")
    ap.add_argument("--out", default="./indielens_dump", help="输出目录")
    ap.add_argument("--concurrency", type=int, default=6, help="并发数（默认6）")
    ap.add_argument("--rate-limit", type=float, default=0.15, help="单线程请求间隔秒（默认0.15s）")
    ap.add_argument("--no-images", action="store_true", help="不下载海报/剧照/头像")
    ap.add_argument("--lang", default="en-US", help="语言（默认 en-US，例如 zh-CN）")
    ap.add_argument("--full", action="store_true",
                    help="全量模式：按 年份×类型 切片绕过 500 页上限，会抓上百万条，耗时数小时")
    args = ap.parse_args()

    s = Scraper(
        out=Path(args.out).resolve(),
        concurrency=args.concurrency,
        rate_limit=args.rate_limit,
        download_images=not args.no_images,
        lang=args.lang,
        full=args.full,
    )
    s.run()


if __name__ == "__main__":
    main()
