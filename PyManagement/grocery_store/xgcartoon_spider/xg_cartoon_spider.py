#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
西瓜卡通 (xgcartoon.com) 全站爬虫
================================

站点结构（经实测验证）：
  - 首页 / 分类页：      https://cn1.xgcartoon.com/
                          https://cn1.xgcartoon.com/type/{category}?page=N
  - 动漫详情页：          https://cn1.xgcartoon.com/detail/{slug}__{animeId}
  - 集数跳转：            /user/page_direct?cartoon_id={slug}&chapter_id={episodeId}
                          返回 302 -> https://www.cnxgct.com/video/{slug}/{episodeId}.html
  - 视频源API（关键）：   GET https://cn1.xgcartoon.com/user/amp/content_pframe_url
                              ?chapter_id={episodeId}&level={low|middle|high}&expires=3600
                          返回 JSON: {"data":"https://pframe.xgcartoon.com/pframe/player.htm?vid={uuid}","result":true}
  - HLS 视频流：         https://xgct-video.bzcdn.net/{vid}/playlist.m3u8
  - 视频缩略图：         https://xgct-video.bzcdn.net/{vid}/thumbnail.jpg

免费用户 level 可选 low/middle（对应 480p/720p）；VIP 可调用 content_vpframe_url 取 high/4K 源。

用法：
  # 仅抓取索引（全部动漫 + 集数 + 视频地址，不下载视频文件）
  python xg_cartoon_spider.py --index-only

  # 抓取元数据并下载所有视频（m3u8 -> mp4，需要 ffmpeg）
  python xg_cartoon_spider.py --download

  # 指定并发/输出目录/清晰度：
  python xg_cartoon_spider.py --download --workers 8 --quality high --output ./xg_data
"""

import argparse
import json
import os
import re
import sys
import time
import logging
import subprocess
from concurrent.futures import ThreadPoolExecutor, as_completed
from urllib.parse import urljoin, urlencode

import requests
from bs4 import BeautifulSoup
from tqdm import tqdm

# ---------------------------------------------------------------------------
# 常量
# ---------------------------------------------------------------------------

BASE_CN = "https://cn1.xgcartoon.com"
BASE_WWW = "https://www.cnxgct.com"
CDN_VIDEO = "https://xgct-video.bzcdn.net"

DEFAULT_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
        "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
    ),
    "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
    "Referer": "https://cn1.xgcartoon.com/",
}

# 详情页链接：/detail/{slug} ，其中 slug 的最后一段（最后一个 `-` 之后）是站点内 anime_id
# （AMP 重写模式下有时会出现 __{id} 形式，统一按最后一个 `-` 或 `__` 切分）
RE_DETAIL_HREF = re.compile(r"/detail/([A-Za-z0-9\-_]+)/?$")
# 集数跳转：/user/page_direct?cartoon_id={slug}&chapter_id={eid}
RE_PAGE_DIRECT = re.compile(r"/user/page_direct\?")
# UUID（vid）
RE_UUID = re.compile(r"vid=([0-9a-fA-F\-]{36})")

# 导航栏分类（来自首页）
CATEGORIES = [
    "all", "kehuan", "chuanyue", "rexue", "dianjing", "zhanzheng",
    "dongzuo", "jingsong", "zainan", "danmei", "yiliao",
    "aiqing", "rixichang", "xuanyi", "gaoxiao", "rexuezhandou",
    "qihuan", "maoxian", "tongnian", "jingtian", "meishi",
]

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%H:%M:%S",
)
log = logging.getLogger("xg-spider")


# ---------------------------------------------------------------------------
# HTTP
# ---------------------------------------------------------------------------

class HttpClient:
    def __init__(self, delay: float = 0.3, timeout: int = 20, retries: int = 3):
        self.session = requests.Session()
        self.session.headers.update(DEFAULT_HEADERS)
        self.delay = delay
        self.timeout = timeout
        self.retries = retries
        self._last = 0.0

    def _throttle(self):
        d = time.time() - self._last
        if d < self.delay:
            time.sleep(self.delay - d)
        self._last = time.time()

    def get(self, url: str, **kwargs) -> requests.Response:
        last_exc = None
        for i in range(self.retries):
            self._throttle()
            try:
                r = self.session.get(url, timeout=self.timeout, **kwargs)
                if r.status_code == 200:
                    return r
                log.warning("GET %s -> %s (retry %d)", url, r.status_code, i + 1)
            except requests.RequestException as e:
                last_exc = e
                log.warning("GET %s 异常: %s (retry %d)", url, e, i + 1)
            time.sleep(1.0 * (i + 1))
        if last_exc:
            raise last_exc
        raise RuntimeError(f"GET {url} 失败")

    def get_json(self, url: str, **kwargs):
        r = self.get(url, **kwargs)
        try:
            return r.json()
        except Exception:
            return None


# ---------------------------------------------------------------------------
# 爬虫主体
# ---------------------------------------------------------------------------

class XgCartoonSpider:
    def __init__(self, output_dir: str, workers: int = 4,
                 download_video: bool = False, download_covers: bool = True,
                 index_only: bool = False, quality: str = "middle"):
        self.output_dir = os.path.abspath(output_dir)
        self.workers = workers
        self.download_video = download_video
        self.download_covers = download_covers
        self.index_only = index_only
        self.quality = quality  # low / middle / high
        self.http = HttpClient(delay=0.25)
        os.makedirs(self.output_dir, exist_ok=True)
        self.covers_dir = os.path.join(self.output_dir, "covers")
        self.videos_dir = os.path.join(self.output_dir, "videos")
        if download_covers:
            os.makedirs(self.covers_dir, exist_ok=True)
        if download_video:
            os.makedirs(self.videos_dir, exist_ok=True)

    # ---------- 列表页 ----------

    def _extract_detail_links(self, html: str) -> list[dict]:
        soup = BeautifulSoup(html, "html.parser")
        out, seen = [], set()
        for a in soup.find_all("a", href=True):
            m = RE_DETAIL_HREF.search(a["href"])
            if not m:
                continue
            slug = m.group(1)
            # 从 slug 中提取 anime_id：优先按 __ 分割，否则取最后一个 `-` 之后的部分
            if "__" in slug:
                slug_main, aid = slug.rsplit("__", 1)
            else:
                slug_main = slug
                aid = slug.rsplit("-", 1)[-1] if "-" in slug else slug
            if aid in seen:
                continue
            seen.add(aid)
            title_el = a.find(["h1", "h2", "h3"])
            title = title_el.get_text(strip=True) if title_el else ""
            cover_img = a.find("amp-img") or a.find("img")
            cover = cover_img.get("src", "") if cover_img else ""
            out.append({
                "anime_id": aid,
                "slug": slug_main or slug,
                "slug_full": slug,
                "title": title,
                "cover": cover,
                "detail_url": urljoin(BASE_CN, a["href"]),
            })
        return out

    def fetch_all_animes(self) -> list[dict]:
        log.info("开始收集全站动漫列表...")
        animes: dict[str, dict] = {}

        # 首页
        home_html = self.http.get(BASE_CN + "/").text
        for it in self._extract_detail_links(home_html):
            animes[it["anime_id"]] = it
        log.info("首页: %d 部", len(animes))

        # 分类页翻页
        for cat in CATEGORIES:
            page = 1
            while True:
                url = f"{BASE_CN}/type/{cat}"
                if page > 1:
                    url += f"?page={page}"
                try:
                    html = self.http.get(url).text
                except Exception as e:
                    log.warning("分类页失败 %s: %s", url, e)
                    break
                items = self._extract_detail_links(html)
                if not items:
                    break
                new = 0
                for it in items:
                    if it["anime_id"] not in animes:
                        animes[it["anime_id"]] = it
                        new += 1
                log.info("分类[%s] p%d -> %d (新增 %d)", cat, page, len(items), new)
                # 若本页结果很少，认为到底
                if len(items) < 12 or new == 0:
                    break
                page += 1
                if page > 80:
                    break

        log.info("共收集到 %d 部动漫", len(animes))
        return list(animes.values())

    # ---------- 详情页 ----------

    def fetch_anime_detail(self, anime: dict) -> dict:
        """解析详情页：标题、作者、地区、描述、全部集数chapter_id"""
        url = anime["detail_url"]
        try:
            html = self.http.get(url).text
        except Exception as e:
            log.error("详情页失败 %s: %s", url, e)
            return anime

        soup = BeautifulSoup(html, "html.parser")

        # 标题
        h1 = soup.find("h1")
        if h1:
            anime["title"] = h1.get_text(strip=True)

        # 面包屑
        crumbs = [a.get_text(strip=True) for a in soup.select("nav a")]
        anime["breadcrumbs"] = [c for c in crumbs if c]

        # 元信息（作者/地区/标签）
        meta_block = soup.find(class_=re.compile("detail|info|meta", re.I))
        meta_text = meta_block.get_text(" ", strip=True) if meta_block else ""
        anime["meta"] = meta_text[:500]

        # 描述
        desc_el = soup.find(class_=re.compile("desc|summary|intro", re.I))
        if desc_el:
            anime["description"] = desc_el.get_text(" ", strip=True)[:1000]

        # 提取所有集数
        episodes, seen = [], set()
        first_chapter_id = None
        for a in soup.find_all("a", href=True):
            href = a["href"]
            if not RE_PAGE_DIRECT.search(href):
                continue
            qs = href.split("?", 1)[1] if "?" in href else ""
            params = {}
            for kv in qs.split("&"):
                if "=" in kv:
                    k, v = kv.split("=", 1)
                    params[k] = v
            cid = params.get("cartoon_id", "")
            chid = params.get("chapter_id", "")
            if not chid or chid in seen:
                continue
            # 取标题，按 DOM 结构：通常在 <a>第01话</a>
            title = a.get_text(strip=True)
            # 过滤掉非集数链接（"播放/上一集/下一集/收藏/刷新/剧场模式/..."）
            if title in ("播放", "收藏", "刷新", "上一集", "下一集", "剧场模式"):
                continue
            if not (title.startswith("第") or re.match(r"^\d+", title) or
                    re.match(r"^(EP|ep|第|Vol|vol|OVA|SP|剧场)", title)):
                continue
            seen.add(chid)
            episodes.append({
                "episode_id": chid,
                "cartoon_slug": cid or anime.get("slug", ""),
                "title": title.split("\n")[0].strip(),
                "play_url": f"{BASE_WWW}/video/{cid or anime.get('slug','')}/{chid}.html",
            })
        # 按集数序号排序（从第01话开始）
        def _ep_order(ep):
            m = re.search(r"第(\d+)", ep["title"])
            return int(m.group(1)) if m else 99999
        episodes.sort(key=_ep_order)
        anime["episodes"] = episodes
        anime["total_episodes"] = len(episodes)
        return anime

    # ---------- 视频源解析 ----------

    def fetch_episode_video(self, episode: dict) -> dict:
        """通过 content_pframe_url API 拿到 vid，再拼 m3u8"""
        chid = episode["episode_id"]
        api = f"{BASE_CN}/user/amp/content_pframe_url?chapter_id={chid}&level={self.quality}&expires=3600"
        try:
            data = self.http.get_json(api)
        except Exception as e:
            log.warning("pframe API 失败 %s: %s", chid, e)
            data = None

        vid = None
        pframe_url = None
        if data and data.get("result"):
            pframe_url = data.get("data", "")
            m = RE_UUID.search(pframe_url)
            if m:
                vid = m.group(1)

        episode["vid"] = vid
        episode["pframe_url"] = pframe_url
        if vid:
            episode["m3u8"] = f"{CDN_VIDEO}/{vid}/playlist.m3u8"
            episode["thumbnail"] = f"{CDN_VIDEO}/{vid}/thumbnail.jpg"
        else:
            episode["m3u8"] = None
            episode["thumbnail"] = None
        return episode

    # ---------- 下载 ----------

    @staticmethod
    def safe_name(s: str) -> str:
        s = re.sub(r'[\\/:*?"<>|]+', "_", s or "").strip().strip(".")
        return s[:80] if len(s) > 80 else s

    def _download_file(self, url: str, dst: str) -> bool:
        try:
            with self.http.session.get(url, stream=True, timeout=30) as r:
                r.raise_for_status()
                with open(dst, "wb") as f:
                    for chunk in r.iter_content(1 << 15):
                        if chunk:
                            f.write(chunk)
            return True
        except Exception as e:
            log.warning("下载失败 %s: %s", url, e)
            return False

    def _download_m3u8(self, m3u8_url: str, mp4_path: str) -> bool:
        cmd = [
            "ffmpeg", "-y", "-loglevel", "error",
            "-headers", f"Referer: https://pframe.xgcartoon.com/\r\n",
            "-i", m3u8_url,
            "-c", "copy",
            "-bsf:a", "aac_adtstoasc",
            mp4_path,
        ]
        try:
            subprocess.run(cmd, check=True)
            return True
        except FileNotFoundError:
            log.error("未检测到 ffmpeg，请安装 ffmpeg 并加入 PATH")
            return False
        except subprocess.CalledProcessError as e:
            log.error("ffmpeg 转码失败: %s", e)
            return False

    # ---------- 主流程 ----------

    def run(self):
        t0 = time.time()

        # 1) 列表
        animes = self.fetch_all_animes()

        # 2) 详情（多线程）
        log.info("开始抓取 %d 部动漫的详情与集数...", len(animes))
        detailed: list[dict] = []
        with ThreadPoolExecutor(max_workers=self.workers) as ex:
            futs = {ex.submit(self.fetch_anime_detail, a): a for a in animes}
            for fut in tqdm(as_completed(futs), total=len(futs), desc="详情"):
                detailed.append(fut.result())

        # 按标题排序便于查看
        detailed.sort(key=lambda x: x.get("title", ""))

        index_path = os.path.join(self.output_dir, "index.json")
        with open(index_path, "w", encoding="utf-8") as f:
            json.dump(detailed, f, ensure_ascii=False, indent=2)
        log.info("索引已保存: %s (%d 部)", index_path, len(detailed))

        if self.index_only:
            log.info("索引模式完成，不解析视频源。")
            return

        # 3) 解析每集的视频源
        total_eps = sum(len(a.get("episodes", [])) for a in detailed)
        log.info("开始解析 %d 集的视频源 (quality=%s)...", total_eps, self.quality)

        for anime in tqdm(detailed, desc="解析/下载", position=0):
            title = self.safe_name(anime.get("title") or anime.get("slug") or anime["anime_id"])
            a_video_dir = os.path.join(self.videos_dir, title)
            a_cover_dir = os.path.join(self.covers_dir, title)
            if self.download_video:
                os.makedirs(a_video_dir, exist_ok=True)
            if self.download_covers:
                os.makedirs(a_cover_dir, exist_ok=True)

            episodes = anime.get("episodes", [])

            def _proc(ep: dict) -> dict:
                ep = self.fetch_episode_video(ep)
                ep_title = self.safe_name(ep.get("title") or ep["episode_id"])

                if self.download_covers and ep.get("thumbnail"):
                    cpath = os.path.join(a_cover_dir, f"{ep_title}.jpg")
                    if not os.path.exists(cpath):
                        self._download_file(ep["thumbnail"], cpath)
                    ep["cover_local"] = cpath

                if self.download_video and ep.get("m3u8"):
                    mpath = os.path.join(a_video_dir, f"{ep_title}.mp4")
                    if not os.path.exists(mpath):
                        ok = self._download_m3u8(ep["m3u8"], mpath)
                        ep["video_local"] = mpath if ok else None
                    else:
                        ep["video_local"] = mpath
                return ep

            with ThreadPoolExecutor(max_workers=self.workers) as ex:
                processed = [f.result() for f in as_completed(
                    [ex.submit(_proc, e) for e in episodes])]
            by_id = {e["episode_id"]: e for e in processed}
            anime["episodes"] = [by_id[e["episode_id"]] for e in episodes]

            # 增量保存
            with open(os.path.join(self.output_dir, "full_data.json"), "w", encoding="utf-8") as f:
                json.dump(detailed, f, ensure_ascii=False, indent=2)

        final_path = os.path.join(self.output_dir, "full_data.json")
        with open(final_path, "w", encoding="utf-8") as f:
            json.dump(detailed, f, ensure_ascii=False, indent=2)

        log.info("全部完成！共 %d 部动漫，耗时 %.1f 秒", len(detailed), time.time() - t0)
        log.info("完整数据: %s", final_path)


# ---------------------------------------------------------------------------
def main():
    p = argparse.ArgumentParser(description="西瓜卡通 (xgcartoon.com) 全站爬虫")
    p.add_argument("--output", "-o", default="./xgcartoon_data", help="输出目录")
    p.add_argument("--workers", "-w", type=int, default=4, help="并发线程数")
    p.add_argument("--index-only", action="store_true",
                   help="仅抓取动漫/集数索引，不解析视频源、不下载")
    p.add_argument("--download", "-d", action="store_true",
                   help="下载视频（通过 ffmpeg 把 m3u8 合成为 mp4）")
    p.add_argument("--no-covers", action="store_true", help="不下载封面")
    p.add_argument("--quality", "-q", default="middle",
                   choices=["low", "middle", "high"],
                   help="清晰度：low(480p)/middle(720p，默认)/high(需VIP)")
    args = p.parse_args()

    spider = XgCartoonSpider(
        output_dir=args.output,
        workers=args.workers,
        download_video=args.download,
        download_covers=not args.no_covers,
        index_only=args.index_only,
        quality=args.quality,
    )
    spider.run()


if __name__ == "__main__":
    main()
