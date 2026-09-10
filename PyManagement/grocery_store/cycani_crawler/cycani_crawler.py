#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
次元城动画 (cycani.org) 全站爬虫
=================================
功能：
  1. 抓取所有番剧元数据（分区、番剧列表、详情、选集、评论、弹幕、推荐、排行、周表、广告）
  2. 下载封面、头像、广告图等静态资源
  3. 可选：登录后通过 play-url 获取真实 m3u8/mpd 播放地址，并用 ffmpeg/yt-dlp 下载视频

接口说明（已逆向分析前端源码）：
  * 所有公开元数据接口均返回标准 JSON {code,msg,data}，code=0 表示成功
  * 公共请求头必须带：X-App-Name: cyc_web / X-App-Version: cycweb / X-Time-Zone: Asia/Shanghai
  * 视频播放地址 /v2/sections/{id}/play-url 需要登录后 Bearer Token
  * 视频流本身为标准 HLS(m3u8)/DASH(mpd)，无 DRM 加密
"""

import argparse
import json
import os
import re
import sys
import time
import logging
from pathlib import Path
from urllib.parse import urlparse

import requests
from concurrent.futures import ThreadPoolExecutor, as_completed

# ---------------------------------------------------------------------------
# 配置
# ---------------------------------------------------------------------------
BASE_URL = "https://www.cycani.org"
API_BASE = BASE_URL + "/api"
DEFAULT_HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
                  "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Referer": BASE_URL + "/",
    "Accept": "application/json",
    "X-App-Name": "cyc_web",
    "X-App-Version": "cycweb",
    "X-Time-Zone": "Asia/Shanghai",
}

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%H:%M:%S",
)
log = logging.getLogger("cycani")


# ---------------------------------------------------------------------------
# HTTP 客户端
# ---------------------------------------------------------------------------
class CycaniClient:
    def __init__(self, token: str | None = None, timeout: int = 30,
                 retry: int = 3, delay: float = 0.3):
        self.session = requests.Session()
        self.session.headers.update(DEFAULT_HEADERS)
        if token:
            self.session.headers["Authorization"] = f"Bearer {token}"
        self.timeout = timeout
        self.retry = retry
        self.delay = delay

    def _request(self, method, path, **kwargs):
        url = path if path.startswith("http") else API_BASE + path
        params = kwargs.pop("params", None)
        for i in range(self.retry):
            try:
                resp = self.session.request(
                    method, url, params=params, timeout=self.timeout, **kwargs
                )
                if resp.status_code == 429:
                    log.warning("触发限流，睡眠 5s")
                    time.sleep(5)
                    continue
                resp.raise_for_status()
                time.sleep(self.delay)
                return resp
            except requests.RequestException as e:
                if i == self.retry - 1:
                    raise
                log.warning(f"请求失败 {url}，重试 {i+1}/{self.retry}：{e}")
                time.sleep(1.5 * (i + 1))

    def get_json(self, path, **params):
        resp = self._request("GET", path, params=params)
        data = resp.json()
        if data.get("code") != 0:
            raise RuntimeError(
                f"接口 {path} 返回错误 code={data.get('code')} msg={data.get('msg')}"
            )
        return data.get("data")

    def get_raw(self, url, **kwargs):
        return self._request("GET", url, **kwargs)


# ---------------------------------------------------------------------------
# 各类 API 封装
# ---------------------------------------------------------------------------
class CycaniAPI:
    def __init__(self, client: CycaniClient):
        self.c = client

    # --- 基础公共接口 ---
    def zones(self):
        """分区列表"""
        return self.c.get_json("/video-zones").get("list", [])

    def adverts(self, position="banner"):
        return self.c.get_json("/app/adverts", position=position).get("list", [])

    def recommend_sections(self):
        """首页推荐番组"""
        return self.c.get_json("/index/recommend").get("list", [])

    def weekday_schedule(self, weekday=None):
        """追番周表。weekday=None 返回全周；1~7 周一到周日"""
        if weekday is None:
            data = self.c.get_json("/index/weekday").get("list", [])
        else:
            data = self.c.get_json("/index/weekday", weekday=weekday).get("list", [])
        return data

    def ranks(self):
        """榜单分类"""
        return self.c.get_json("/ranks").get("list", [])

    def rank_videos(self, rank_id):
        return self.c.get_json(f"/ranks/{rank_id}/videos").get("list", [])

    # --- 番剧列表 ---
    def list_videos(self, page=1, page_size=24, zone_id=None,
                    category=None, area=None, language=None,
                    year=None, order_by="update_time"):
        params = {"page": page, "page_size": page_size, "order_by": order_by}
        if zone_id: params["zone_id"] = zone_id
        if category: params["tag"] = category
        if area: params["area"] = area
        if language: params["language"] = language
        if year: params["year"] = year
        return self.c.get_json("/videos", **params)

    def search_videos(self, q, page=1, page_size=24, zone_id=None):
        params = {"q": q, "page": page, "page_size": page_size}
        if zone_id: params["zone_id"] = zone_id
        return self.c.get_json("/videos/search", **params)

    # --- 单部番剧 ---
    def video_detail(self, video_id):
        return self.c.get_json(f"/videos/{video_id}")

    def video_sections(self, video_id, player_code, page=1, page_size=48):
        """选集列表。player_code 从详情 play_from[*].code 获取，如 'cychub'。
        服务端 page_size 上限 100。"""
        page_size = min(max(int(page_size), 1), 100)
        return self.c.get_json(
            f"/videos/{video_id}/sections",
            player_code=player_code, page=page, page_size=page_size
        )

    def video_comments(self, video_id, order_by="time", page=1, page_size=20):
        return self.c.get_json(
            f"/videos/{video_id}/comments",
            order_by=order_by, page=page, page_size=page_size
        )

    def video_recommendations(self, video_id, limit=12):
        return self.c.get_json(
            f"/videos/{video_id}/recommendations", limit=limit
        ).get("list", [])

    def section_danmaku(self, section_id, segment_index=None):
        params = {}
        if segment_index is not None and segment_index >= 1:
            params["segment_index"] = segment_index
        return self.c.get_json(f"/sections/{section_id}/danmaku", **params)

    # --- 需要登录 ---
    def play_url(self, section_id):
        """
        获取真实播放地址，返回 {name, url}。需要登录 Bearer Token。
        """
        return self.c.get_json(f"/v2/sections/{section_id}/play-url")


# ---------------------------------------------------------------------------
# 资源下载辅助
# ---------------------------------------------------------------------------
INVALID_CHARS = re.compile(r'[\\/:*?"<>|\r\n\t]+')

def safe_name(s: str, maxlen: int = 80) -> str:
    s = INVALID_CHARS.sub("_", s).strip().strip(".")
    return s[:maxlen] or "unnamed"


def download_file(client: CycaniClient, url: str, out_path: Path, overwrite=False):
    if out_path.exists() and not overwrite:
        return out_path
    out_path.parent.mkdir(parents=True, exist_ok=True)
    # 直接下载原始 CDN，不走百度 gimg 代理以避免盗链问题
    real_url = url
    m = re.search(r"[?&]src=([^&]+)", url)
    if "gimg1.baidu.com" in url and m:
        real_url = "https://" + m.group(1)
    try:
        r = client.get_raw(real_url, stream=True)
        with open(out_path, "wb") as f:
            for chunk in r.iter_content(chunk_size=64 * 1024):
                if chunk:
                    f.write(chunk)
        return out_path
    except Exception as e:
        log.warning(f"下载失败 {real_url}: {e}")
        return None


# ---------------------------------------------------------------------------
# 全站爬虫主逻辑
# ---------------------------------------------------------------------------
class CycaniCrawler:
    def __init__(self, out_dir: str, token: str | None = None,
                 download_images: bool = True, max_workers: int = 4,
                 page_size: int = 50, fetch_danmaku: bool = True,
                 fetch_comments: bool = True, comment_pages: int = 5):
        self.out_dir = Path(out_dir)
        self.img_dir = self.out_dir / "images"
        self.meta_dir = self.out_dir / "metadata"
        self.video_dir = self.out_dir / "videos"
        for d in (self.out_dir, self.img_dir, self.meta_dir, self.video_dir):
            d.mkdir(parents=True, exist_ok=True)

        self.client = CycaniClient(token=token, delay=0.25)
        self.api = CycaniAPI(self.client)
        self.download_images = download_images
        self.max_workers = max_workers
        self.page_size = page_size
        self.fetch_danmaku = fetch_danmaku
        self.fetch_comments = fetch_comments
        self.comment_pages = comment_pages

    # ---------- 图片下载 ----------
    def _schedule_image(self, url, subdir):
        if not url or not self.download_images:
            return None
        try:
            parsed = urlparse(url)
            name = os.path.basename(parsed.path) or "image.bin"
            if "gimg1.baidu.com" in url:
                m = re.search(r"[?&]src=([^&]+)", url)
                if m:
                    name = os.path.basename(m.group(1))
            target = self.img_dir / subdir / name
            return (url, target)
        except Exception:
            return None

    def _download_images_batch(self, tasks):
        tasks = [t for t in tasks if t]
        if not tasks:
            return {}
        local_map = {}
        with ThreadPoolExecutor(max_workers=self.max_workers) as ex:
            futs = {ex.submit(download_file, self.client, u, p): (u, p) for u, p in tasks}
            for fut in as_completed(futs):
                u, p = futs[fut]
                try:
                    res = fut.result()
                    if res:
                        local_map[u] = str(res.relative_to(self.out_dir))
                except Exception as e:
                    log.warning(f"图片下载异常 {u}: {e}")
        return local_map

    # ---------- 单部番剧抓取 ----------
    def _crawl_video(self, video_id):
        vdir = self.video_dir / str(video_id)
        vdir.mkdir(parents=True, exist_ok=True)
        detail_file = vdir / "detail.json"
        if detail_file.exists():
            try:
                return json.load(open(detail_file, "r", encoding="utf-8"))
            except Exception:
                pass

        log.info(f"  抓取番剧 {video_id}")
        detail = self.api.video_detail(video_id)

        # 封面
        img_tasks = []
        cover = detail.get("cover_url")
        cover_local = None
        if cover:
            t = self._schedule_image(cover, "covers")
            if t:
                img_tasks.append(t)

        # 选集（按所有播放源）
        all_sections = {}
        play_from = detail.get("play_from") or []
        for src in play_from:
            code = src.get("code")
            if not code:
                continue
            try:
                sec_data = self.api.video_sections(
                    video_id, player_code=code, page=1, page_size=min(self.page_size, 100)
                )
                sections = sec_data.get("list", [])
                # 翻页
                pager = sec_data.get("pager") or {}
                total = pager.get("total", len(sections))
                page = 1
                while len(sections) < total:
                    page += 1
                    more = self.api.video_sections(
                        video_id, player_code=code, page=page, page_size=min(self.page_size, 100)
                    )
                    sections.extend(more.get("list", []))
                    if not more.get("list"):
                        break
                all_sections[code] = {
                    "title": src.get("title") or code,
                    "count": src.get("count"),
                    "sections": sections,
                }
            except Exception as e:
                log.warning(f"  选集获取失败 {video_id}/{code}: {e}")
                all_sections[code] = {"error": str(e)}

        # 弹幕（每个选集）
        danmaku_map = {}
        if self.fetch_danmaku:
            for code, sdata in all_sections.items():
                if "sections" not in sdata:
                    continue
                for sec in sdata["sections"]:
                    sid = sec.get("id")
                    if not sid:
                        continue
                    try:
                        dm = self.api.section_danmaku(sid)
                        danmaku_map[sid] = dm.get("items", []) if isinstance(dm, dict) else []
                    except Exception as e:
                        log.warning(f"  弹幕失败 {sid}: {e}")

        # 评论
        comments = []
        if self.fetch_comments:
            for cp in range(1, self.comment_pages + 1):
                try:
                    cd = self.api.video_comments(
                        video_id, page=cp, page_size=50
                    )
                    lst = cd.get("list", []) if isinstance(cd, dict) else []
                    comments.extend(lst)
                    pager = cd.get("pager") or {}
                    if cp >= (pager.get("total", 0) + pager.get("page_size", 50) - 1) // pager.get("page_size", 50):
                        break
                    if not lst:
                        break
                except Exception as e:
                    log.warning(f"  评论失败 {video_id} page{cp}: {e}")
                    break

        # 推荐
        try:
            recs = self.api.video_recommendations(video_id, limit=24)
        except Exception as e:
            log.warning(f"  推荐失败 {video_id}: {e}")
            recs = []

        # 播放地址（若已登录）
        play_urls = {}
        if self.client.session.headers.get("Authorization"):
            for code, sdata in all_sections.items():
                for sec in sdata.get("sections", []):
                    sid = sec.get("id")
                    if not sid:
                        continue
                    try:
                        pu = self.api.play_url(sid)
                        play_urls[sid] = pu
                    except Exception as e:
                        play_urls[sid] = {"error": str(e)}

        # 下载封面
        local_map = self._download_images_batch(img_tasks)
        if cover and cover in local_map:
            cover_local = local_map[cover]

        # 整理输出
        result = {
            "detail": detail,
            "sections_by_source": all_sections,
            "danmaku": danmaku_map,
            "comments": comments,
            "recommendations": recs,
            "play_urls": play_urls,
            "local": {"cover": cover_local},
        }
        with open(detail_file, "w", encoding="utf-8") as f:
            json.dump(result, f, ensure_ascii=False, indent=2)
        return result

    # ---------- 爬取整个分区的全部番剧 ----------
    def _crawl_zone_all(self, zone_id, order_by="update_time"):
        page = 1
        video_ids = []
        while True:
            log.info(f"  分区 {zone_id} 第 {page} 页")
            data = self.api.list_videos(
                page=page, page_size=self.page_size,
                zone_id=zone_id, order_by=order_by
            )
            lst = data.get("list", []) if isinstance(data, dict) else []
            for v in lst:
                vid = v.get("id") or v.get("video_id")
                if vid:
                    video_ids.append(vid)
            pager = data.get("pager", {}) if isinstance(data, dict) else {}
            total = pager.get("total", 0)
            if not lst or page * self.page_size >= total:
                break
            page += 1
        return video_ids

    # ---------- 入口 ----------
    def run(self):
        log.info("=== 步骤 1/6：抓取分区信息 ===")
        zones = self.api.zones()
        json.dump(zones, open(self.meta_dir / "zones.json", "w", encoding="utf-8"),
                  ensure_ascii=False, indent=2)

        log.info("=== 步骤 2/6：抓取首页推荐、广告、周表、榜单 ===")
        home = {
            "banners": self.api.adverts("banner"),
            "video_info_ads": self.api.adverts("video_info"),
            "recommend_sections": self.api.recommend_sections(),
            "weekday_schedule": self.api.weekday_schedule(),
        }
        # 榜单
        ranks = self.api.ranks()
        rank_data = []
        for r in ranks:
            try:
                vs = self.api.rank_videos(r["id"])
                rank_data.append({"rank": r, "videos": vs})
            except Exception as e:
                log.warning(f"榜单 {r.get('name')} 获取失败：{e}")
        home["ranks"] = rank_data
        json.dump(home, open(self.meta_dir / "home.json", "w", encoding="utf-8"),
                  ensure_ascii=False, indent=2)

        # 下载广告/封面占位
        img_tasks = []
        for ad in home["banners"] + home.get("video_info_ads", []):
            img_tasks.append(self._schedule_image(ad.get("content"), "ads"))
        # 推荐区里的封面
        for sec in home["recommend_sections"]:
            for v in sec.get("videos", []):
                img_tasks.append(self._schedule_image(v.get("cover_url") or v.get("banner_url"), "covers"))
        for r in rank_data:
            for v in r["videos"]:
                img_tasks.append(self._schedule_image(v.get("cover_url"), "covers"))
        self._download_images_batch(img_tasks)

        log.info("=== 步骤 3/6：获取所有番剧 ID ===")
        all_ids = set()
        for z in zones:
            zid = z.get("id")
            log.info(f"  遍历分区 {zid} {z.get('name')}")
            ids = self._crawl_zone_all(zid)
            all_ids.update(ids)
        # 兜底：把推荐/周表/榜单里提到的也加进去
        for sec in home["recommend_sections"]:
            for v in sec.get("videos", []):
                vid = v.get("id") or v.get("video_id")
                if vid:
                    all_ids.add(vid)
        for wd in home["weekday_schedule"]:
            for v in wd.get("videos", []):
                vid = v.get("id") or v.get("video_id")
                if vid:
                    all_ids.add(vid)
        for r in rank_data:
            for v in r["videos"]:
                vid = v.get("id") or v.get("video_id")
                if vid:
                    all_ids.add(vid)

        log.info(f"  共发现 {len(all_ids)} 部番剧")
        json.dump(sorted(all_ids), open(self.meta_dir / "all_video_ids.json", "w",
                                        encoding="utf-8"), ensure_ascii=False, indent=2)

        log.info("=== 步骤 4/6：并发抓取每部番剧详情/选集/弹幕/评论 ===")
        done = 0
        with ThreadPoolExecutor(max_workers=self.max_workers) as ex:
            futs = {ex.submit(self._crawl_video, vid): vid for vid in sorted(all_ids)}
            for fut in as_completed(futs):
                vid = futs[fut]
                done += 1
                try:
                    fut.result()
                except Exception as e:
                    log.error(f"  番剧 {vid} 抓取失败：{e}")
                if done % 20 == 0:
                    log.info(f"  进度 {done}/{len(all_ids)}")

        log.info("=== 步骤 5/6：汇总索引 ===")
        # 为每部番剧构建一份精简索引，便于快速检索
        index = []
        for vid in sorted(all_ids):
            fp = self.video_dir / str(vid) / "detail.json"
            if not fp.exists():
                continue
            try:
                blob = json.load(open(fp, "r", encoding="utf-8"))
                d = blob.get("detail", {})
                index.append({
                    "id": vid,
                    "title": d.get("title"),
                    "zone_id": d.get("zone_id"),
                    "year": d.get("year"),
                    "area": d.get("area"),
                    "language": d.get("language"),
                    "version": d.get("version"),
                    "score": d.get("score"),
                    "hits": d.get("hits"),
                    "total": d.get("total"),
                    "completed": d.get("completed"),
                    "categories": d.get("categories"),
                    "tags": d.get("tags"),
                    "cover_url": d.get("cover_url"),
                    "cover_local": (blob.get("local") or {}).get("cover"),
                    "detail_path": str(fp.relative_to(self.out_dir)),
                })
            except Exception as e:
                log.warning(f"索引失败 {vid}: {e}")
        json.dump(index, open(self.meta_dir / "index.json", "w", encoding="utf-8"),
                  ensure_ascii=False, indent=2)

        log.info("=== 步骤 6/6：抓取前端静态资源（首页/JS/CSS，供离线浏览） ===")
        self._mirror_static_assets()

        log.info(f"全部完成。数据目录：{self.out_dir}")

    def _mirror_static_assets(self):
        """保存 SPA 的入口页和 JS/CSS 资源，仅供参考"""
        static_dir = self.out_dir / "static"
        static_dir.mkdir(exist_ok=True)
        try:
            r = self.client.get_raw("/")
            html = r.text
            (static_dir / "index.html").write_text(html, encoding="utf-8")
            # 提取 js/css
            for m in re.finditer(r'(?:src|href)=["\'](/assets/[^"\']+)["\']', html):
                asset = m.group(1)
                try:
                    ar = self.client.get_raw(asset)
                    target = static_dir / asset.lstrip("/")
                    target.parent.mkdir(parents=True, exist_ok=True)
                    target.write_bytes(ar.content)
                except Exception as e:
                    log.warning(f"静态资源 {asset} 下载失败：{e}")
        except Exception as e:
            log.warning(f"镜像静态资源失败：{e}")


# ---------------------------------------------------------------------------
# 视频下载工具（需要 token）
# ---------------------------------------------------------------------------
def download_video_from_playurl(play_url: str, out_path: Path):
    """
    使用 yt-dlp 下载 m3u8/mp4 视频。需系统已安装 yt-dlp 与 ffmpeg。
    """
    import shutil, subprocess
    if not shutil.which("yt-dlp"):
        raise RuntimeError("未找到 yt-dlp，请先安装：pip install yt-dlp")
    out_path.parent.mkdir(parents=True, exist_ok=True)
    cmd = [
        "yt-dlp",
        "--no-warnings",
        "-f", "bestvideo+bestaudio/best",
        "--merge-output-format", "mp4",
        "-o", str(out_path),
        "--no-check-certificates",
        "--referer", BASE_URL + "/",
        play_url,
    ]
    log.info(" ".join(cmd))
    subprocess.check_call(cmd)


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------
def main():
    parser = argparse.ArgumentParser(description="次元城动画 (cycani.org) 全站爬虫")
    parser.add_argument("-o", "--out", default="./cycani_data", help="输出目录，默认 ./cycani_data")
    parser.add_argument("-t", "--token", default=None, help="（可选）登录后拿到的 Bearer Token，用于获取播放地址")
    parser.add_argument("-w", "--workers", type=int, default=4, help="并发线程数（默认 4）")
    parser.add_argument("--page-size", type=int, default=50, help="列表分页大小（默认 50）")
    parser.add_argument("--no-images", action="store_true", help="跳过图片下载")
    parser.add_argument("--no-danmaku", action="store_true", help="跳过弹幕抓取")
    parser.add_argument("--no-comments", action="store_true", help="跳过评论抓取")
    parser.add_argument("--comment-pages", type=int, default=3, help="每部番剧最多抓多少页评论（默认 3）")
    parser.add_argument("--only-video", type=int, default=None, help="仅抓取指定 video_id 的番剧（调试用）")
    args = parser.parse_args()

    crawler = CycaniCrawler(
        out_dir=args.out,
        token=args.token,
        download_images=not args.no_images,
        max_workers=args.workers,
        page_size=args.page_size,
        fetch_danmaku=not args.no_danmaku,
        fetch_comments=not args.no_comments,
        comment_pages=args.comment_pages,
    )
    if args.only_video:
        crawler._crawl_video(args.only_video)
        log.info(f"单部抓取完成：{args.out}/videos/{args.only_video}/detail.json")
    else:
        crawler.run()


if __name__ == "__main__":
    main()
