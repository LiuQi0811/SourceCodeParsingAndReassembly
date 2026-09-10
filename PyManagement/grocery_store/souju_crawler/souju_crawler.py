#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
搜剧AI (ai.baipiaozhe.com / souju.ai) 全站爬虫
================================================
逆向解密完成：HMAC-SHA256 签名算法已还原
签名消息格式: METHOD + \n + PATH + QUERY + \n + TIMESTAMP(ms) + \n + NONCE(16字节hex)
HMAC密钥 (hardcoded in JS bundle): f39d73aa7a6426203cdee1ef17b31d3b7ea8c23f4c59c62a3a8aa0f39ee5e79d

功能:
  1. 关键词搜索影视/短剧/动漫/综艺
  2. 获取详情 + 剧集列表
  3. 解析播放源, 返回多个CDN的明文m3u8直链 (无需二次解密)
  4. 分页遍历片库
  5. 短剧feed流
  6. 追剧日历
  7. 下载m3u8为mp4 (需ffmpeg)
"""

import hmac
import hashlib
import time
import os
import json
import re
import sys
import urllib.parse
from typing import Optional, Dict, List, Any, Iterator

import requests


# ============================================================
# 常量 (从前端JS movie-card-runtime-DAvo4EEk.js 中逆向提取)
# ============================================================
SECRET_KEY = "f39d73aa7a6426203cdee1ef17b31d3b7ea8c23f4c59c62a3a8aa0f39ee5e79d"
BASE_URL = "https://ai.baipiaozhe.com"
BUILD_VERSION = "aimovie-v2026.09.09.2-72abea110b8e-web"
CLIENT_NAME = "movie-search-frontend"
CLIENT_VERSION = "1.0.0"
PROTOCOL_VERSION = "2026-07-05.library-v2.playback-v1"

DEFAULT_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/129.0.0.0 Safari/537.36"
    ),
    "Accept": "application/json",
    "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
}


class SoujuCrawler:
    """搜剧AI 全站爬虫客户端"""

    def __init__(self, base_url: str = BASE_URL, session: Optional[requests.Session] = None):
        self.base_url = base_url.rstrip("/")
        self.session = session or requests.Session()
        self.session.headers.update(DEFAULT_HEADERS)

    # ---------- 签名核心 (逆向成果) ----------
    @staticmethod
    def _gen_nonce() -> str:
        """生成16字节随机nonce (32位hex), 与前端sl()函数一致"""
        return os.urandom(16).hex()

    def _sign(self, method: str, path: str, query: str = "") -> tuple:
        """
        生成请求签名
        签名串 = f"{METHOD}\\n{PATH}{QUERY}\\n{TIMESTAMP_MS}\\n{NONCE}"
        算法   = HMAC-SHA256(SECRET_KEY, 签名串).hexdigest()
        """
        timestamp = str(int(time.time() * 1000))
        nonce = self._gen_nonce()
        message = f"{method.upper()}\n{path}{query}\n{timestamp}\n{nonce}"
        signature = hmac.new(
            SECRET_KEY.encode("utf-8"),
            message.encode("utf-8"),
            hashlib.sha256,
        ).hexdigest()
        return timestamp, nonce, signature

    def _signed_headers(self, method: str, path: str, query: str = "",
                        content_type: Optional[str] = None) -> Dict[str, str]:
        """构造带签名的完整请求头"""
        timestamp, nonce, signature = self._sign(method, path, query)
        headers = {
            "Origin": self.base_url,
            "Referer": self.base_url + "/",
            "x-ai-movie-build-version": BUILD_VERSION,
            "x-ai-movie-client-name": CLIENT_NAME,
            "x-ai-movie-client-version": CLIENT_VERSION,
            "x-ai-movie-nonce": nonce,
            "x-ai-movie-protocol-version": PROTOCOL_VERSION,
            "x-ai-movie-signature": signature,
            "x-ai-movie-timestamp": timestamp,
        }
        if content_type:
            headers["Content-Type"] = content_type
        return headers

    def _request(self, method: str, path: str, params: Optional[Dict] = None,
                 json_body: Optional[Any] = None, timeout: int = 20) -> Dict:
        """统一签名请求入口"""
        # 构造query string (保持稳定排序, 与前端URLSearchParams行为一致)
        query = ""
        if params:
            query = "?" + urllib.parse.urlencode(
                [(k, v) for k, v in params.items() if v is not None],
                safe="",
                encoding="utf-8",
            )
        headers = self._signed_headers(
            method, path, query,
            content_type="application/json" if json_body is not None else None,
        )
        url = f"{self.base_url}{path}{query}"
        resp = self.session.request(
            method=method.upper(),
            url=url,
            headers=headers,
            data=json.dumps(json_body, ensure_ascii=False).encode("utf-8") if json_body is not None else None,
            timeout=timeout,
        )
        resp.raise_for_status()
        return resp.json()

    # ================================================================
    #  API 封装
    # ================================================================

    # ---- 1. 搜索/片库浏览 ----
    def browse_catalog(self, q: str = "", page: int = 1, limit: int = 20,
                       query_mode: str = "fast_v3", search_fields: str = "all",
                       intent: str = "catalog_search",
                       content_kind: Optional[str] = None,
                       year: Optional[int] = None,
                       genre: Optional[str] = None,
                       area: Optional[str] = None) -> Dict:
        """
        搜索/浏览片库
        :param q:              搜索关键词 (空字符串返回首页推荐)
        :param page:           页码 (从1开始)
        :param limit:          每页数量 (最大建议48)
        :param query_mode:     fast_v3 (快速) / 其他
        :param search_fields:  all / title / actor / director
        :param intent:         catalog_search / catalog_browse
        :param content_kind:   过滤类型: movie / series / short_drama / anime / variety
        :param year:           年份过滤
        :param genre:          类型过滤
        :param area:           地区过滤
        """
        params = {
            "page": page,
            "limit": limit,
            "query_mode": query_mode,
            "search_fields": search_fields,
            "q": q,
            "intent": intent,
        }
        if content_kind:
            params["content_kind"] = content_kind
        if year:
            params["year"] = year
        if genre:
            params["genre"] = genre
        if area:
            params["area"] = area
        return self._request("GET", "/v1/browse/catalog", params=params)

    def search(self, keyword: str, page: int = 1, limit: int = 20, **kwargs) -> Dict:
        """搜索关键词的快捷封装"""
        return self.browse_catalog(q=keyword, page=page, limit=limit,
                                   intent="catalog_search", **kwargs)

    def iterate_catalog(self, q: str = "", start_page: int = 1,
                        max_pages: Optional[int] = None, **kwargs) -> Iterator[Dict]:
        """
        分页迭代遍历片库/搜索结果
        自动翻页直到没有更多结果或达到max_pages
        """
        page = start_page
        pages_fetched = 0
        limit = kwargs.pop("limit", 20)
        while True:
            data = self.browse_catalog(q=q, page=page, limit=limit, **kwargs)
            cards = data.get("cards", [])
            if not cards:
                break
            yield data
            pages_fetched += 1
            if max_pages and pages_fetched >= max_pages:
                break
            # 判断是否还有下一页
            pagination = data.get("pagination", {})
            if pagination.get("has_more") is False:
                break
            if len(cards) < limit:
                break
            page += 1
            time.sleep(0.3)  # 礼貌延迟

    # ---- 2. 影视详情 ----
    def get_detail(self, variant_id: str) -> Dict:
        """
        获取影视详情
        :param variant_id: 影片variant_id (形如 av_xxxxx)
        """
        return self._request("GET", f"/v1/catalog/{variant_id}/detail")

    # ---- 3. 剧集列表 ----
    def get_episodes(self, variant_id: str, limit: int = 100, offset: int = 0) -> Dict:
        """
        获取剧集列表
        :param variant_id: 影片variant_id
        :param limit:      每批返回数量
        :param offset:     偏移量 (用于翻页)
        """
        params = {"limit": limit, "offset": offset}
        return self._request("GET", f"/v1/catalog/{variant_id}/episodes", params=params)

    def get_all_episodes(self, variant_id: str) -> List[Dict]:
        """获取全部剧集 (自动翻页)"""
        episodes = []
        offset = 0
        while True:
            data = self.get_episodes(variant_id, limit=100, offset=offset)
            eps = data.get("episodes", [])
            episodes.extend(eps)
            pagination = data.get("episode_pagination", {})
            if not pagination.get("has_more"):
                break
            offset += len(eps)
            time.sleep(0.2)
        return episodes

    # ---- 4. 播放源解析 (返回明文m3u8直链, 无需任何解密) ----
    def resolve_playback(self, episode_token: str) -> Dict:
        """
        解析播放源 (第一步: 获取所有可用线路和初始URL)
        :param episode_token: 剧集token (形如 YJ-xxxxxx)
        :return: 返回 line_options 列表, 每个线路包含:
                 - provider_name: 源名称
                 - url:           m3u8直链 (部分线路已直接可用)
                 - url_kind:      m3u8
                 - 需要二次resolve的线路会返回 ticket, 需调用 resolve_line
        """
        return self._request("GET", f"/v1/playback/resolve/{episode_token}")

    def resolve_line(self, ticket: str) -> Dict:
        """
        二次解析线路 (使用JWT ticket获取真实m3u8地址)
        :param ticket: resolve_playback 返回的ticket (rpt1.xxx格式的JWT)
        :return: 包含真实m3u8直链的完整播放信息
        """
        body = {"ticket": ticket}
        return self._request("POST", "/v1/playback/resolve-line", json_body=body)

    def get_playback_urls(self, episode_token: str) -> List[Dict]:
        """
        一步获取某集所有可用播放线路的明文m3u8直链
        自动处理ticket二次解析
        返回: [{"provider": "...", "url": "https://...m3u8", "quality": "...", "resolved": bool}, ...]
        """
        playback = self.resolve_playback(episode_token)
        results = []
        for line in playback.get("line_options", []):
            provider = line.get("provider_name", line.get("label", "unknown"))
            url = line.get("url", "")
            resolved = line.get("resolved", False)
            play_from = line.get("play_from", "")
            entry = {
                "provider_id": line.get("provider_id"),
                "provider": provider,
                "play_from": play_from,
                "url_kind": line.get("url_kind"),
                "quality_priority": line.get("preference_weight", 0),
                "url": url,
                "resolved": resolved,
            }
            if resolved and url:
                results.append(entry)
            elif not resolved and line.get("ticket"):
                # 需要二次解析
                try:
                    detail = self.resolve_line(line["ticket"])
                    # 从detail里拿到选中线路url
                    for lo in detail.get("line_options", []):
                        if lo.get("selected") and lo.get("url"):
                            entry["url"] = lo["url"]
                            entry["resolved"] = True
                            results.append(entry)
                            break
                except Exception as e:
                    entry["error"] = str(e)
                    results.append(entry)
                time.sleep(0.15)
        # 按优先级排序 (高优先级在前)
        results.sort(key=lambda x: -x.get("quality_priority", 0))
        return results

    # ---- 5. 短剧Feed流 ----
    def short_drama_feed(self, limit: int = 12) -> Dict:
        """获取短剧推荐流 (首页短剧横向滑动的数据源)"""
        return self._request("GET", "/v1/short-drama/feed", params={"limit": limit})

    # ---- 6. 追剧日历 ----
    def calendar(self, date: Optional[str] = None) -> Dict:
        """
        获取追剧日历
        :param date: 日期字符串 YYYY-MM-DD, 默认今天
        """
        params = {}
        if date:
            params["date"] = date
        return self._request("GET", "/v1/calendar", params=params)

    # ---- 7. 弹幕源 ----
    def get_danmaku_source(self, episode_id: str) -> Dict:
        """获取弹幕源"""
        encoded = urllib.parse.quote(episode_id, safe="")
        return self._request("GET", f"/v1/danmuku/episodes/{encoded}/source")

    # ---- 8. 评论 ----
    def get_comments(self, variant_id: str, limit: int = 20, offset: int = 0,
                     sort: str = "latest") -> Dict:
        """获取评论"""
        params = {
            "variant_id": variant_id,
            "limit": limit,
            "offset": offset,
            "sort": sort,
            "include_folded": "false",
            "include_total": "true",
            "include_folded_count": "true",
            "reply_preview_limit": 0,
        }
        return self._request("GET", "/v1/comments", params=params)

    # ---- 9. 会话/线程 (AI搜索上下文) ----
    def create_thread(self, title: str, metadata: Optional[Dict] = None) -> Dict:
        """创建搜索会话线程 (用于AI上下文连续搜索)"""
        import uuid
        body = {
            "title": title,
            "metadata": metadata or {
                "search_fields": "all",
                "search_scope_label": "综合",
                "search_mode": "fast",
                "source": "movie_composer_route",
                "submission_id": str(uuid.uuid4()),
            },
        }
        return self._request("POST", "/v1/threads", json_body=body)


# ============================================================
#  辅助工具: m3u8下载为mp4 (调用ffmpeg)
# ============================================================
def download_m3u8(m3u8_url: str, output_path: str, ffmpeg_bin: str = "ffmpeg",
                  headers: Optional[Dict] = None) -> bool:
    """
    使用ffmpeg下载m3u8流为mp4文件
    :param m3u8_url:   m3u8直链
    :param output_path:输出mp4路径
    :param ffmpeg_bin: ffmpeg可执行文件路径
    :param headers:    额外HTTP头 (部分CDN需要Referer等)
    """
    import subprocess
    import shlex

    if not shutil.which(ffmpeg_bin):
        print(f"[!] 未找到ffmpeg, 请先安装: apt install ffmpeg / brew install ffmpeg")
        return False

    cmd = [ffmpeg_bin, "-y", "-loglevel", "warning", "-stats"]
    # 添加User-Agent等头
    user_agent = DEFAULT_HEADERS["User-Agent"]
    cmd += ["-user_agent", user_agent]
    if headers:
        for k, v in headers.items():
            cmd += ["-headers", f"{k}: {v}\r\n"]
    cmd += ["-i", m3u8_url, "-c", "copy", "-bsf:a", "aac_adtstoasc", output_path]

    print(f"[+] 开始下载: {output_path}")
    print(f"    URL: {m3u8_url}")
    try:
        result = subprocess.run(cmd, timeout=3600)
        if result.returncode == 0:
            size_mb = os.path.getsize(output_path) / 1024 / 1024
            print(f"[✓] 下载完成! 文件大小: {size_mb:.2f} MB")
            return True
        else:
            print(f"[✗] ffmpeg返回错误码: {result.returncode}")
            return False
    except FileNotFoundError:
        print(f"[!] ffmpeg不可用")
        return False
    except subprocess.TimeoutExpired:
        print(f"[!] 下载超时")
        return False


import shutil  # noqa: E402 (for download_m3u8)


# ============================================================
#  CLI 入口
# ============================================================
def print_card(card: Dict, index: int = 0):
    """打印影片卡片信息"""
    prefix = f"[{index}] " if index else "  "
    kind_map = {
        "movie": "电影", "series": "剧集", "short_drama": "短剧",
        "anime": "动漫", "variety": "综艺",
    }
    kind = kind_map.get(card.get("content_kind", ""), card.get("content_kind", ""))
    title = card.get("title", "未知")
    year = card.get("year", "")
    area = card.get("area", "")
    genres = "/".join(card.get("genres", [])[:3])
    actors = ",".join(card.get("actors", [])[:3])
    directors = ",".join(card.get("directors", [])[:2])
    vid = card.get("id", "")
    mark = "★" if card.get("availability", {}).get("playable") else "☆"
    print(f"{prefix}{mark} {title} ({year})  [{kind}] {area} {genres}")
    if actors:
        print(f"     演员: {actors}")
    if directors:
        print(f"     导演: {directors}")
    print(f"     ID: {vid}")
    print()


def cli_search(keyword: str, max_pages: int = 3):
    """CLI: 搜索并展示结果"""
    crawler = SoujuCrawler()
    print(f"\n========== 搜索: {keyword} ==========\n")
    count = 0
    for page_data in crawler.iterate_catalog(q=keyword, start_page=1, limit=20, max_pages=max_pages):
        for card in page_data.get("cards", []):
            count += 1
            print_card(card, count)
    print(f"共获取 {count} 条结果\n")


def cli_detail_and_play(variant_id: str, ep_index: int = 0, download: bool = False):
    """CLI: 获取详情, 列出剧集, 解析播放源"""
    crawler = SoujuCrawler()
    print(f"\n========== 详情: {variant_id} ==========\n")

    detail = crawler.get_detail(variant_id)
    print(f"标题: {detail.get('title')}")
    print(f"类型: {detail.get('content_kind')} | 年份: {detail.get('year')} | 地区: {detail.get('area')}")
    print(f"简介: {detail.get('description', '')[:200]}\n")

    episodes = crawler.get_all_episodes(variant_id)
    print(f"共 {len(episodes)} 集:\n")
    for i, ep in enumerate(episodes):
        marker = "▶" if i == ep_index else " "
        print(f"  {marker} [{i}] {ep.get('display_name', ep.get('title', '?'))}  token={ep.get('token')}")

    if ep_index >= len(episodes):
        ep_index = 0
    ep = episodes[ep_index]
    token = ep.get("token")
    print(f"\n========== 解析播放源: {ep.get('display_name')} ==========\n")
    urls = crawler.get_playback_urls(token)
    for i, u in enumerate(urls):
        status = "✓" if u["resolved"] else "✗"
        print(f"  [{i}] {status} {u['provider']}  (priority={u['quality_priority']})")
        if u["resolved"]:
            print(f"      {u['url']}\n")

    if download and urls:
        # 选择第一条可用线路下载
        for u in urls:
            if u["resolved"] and u["url"].endswith(".m3u8"):
                safe_title = re.sub(r'[\\/:*?"<>|]', '_', detail.get('title', 'video'))
                out_path = f"{safe_title}_ep{ep_index+1}.mp4"
                download_m3u8(u["url"], out_path)
                break


def cli_short_drama():
    """CLI: 短剧Feed"""
    crawler = SoujuCrawler()
    data = crawler.short_drama_feed(limit=24)
    print(f"\n========== 短剧推荐 ==========\n")
    for i, item in enumerate(data.get("items", []), 1):
        print_card(item, i)


def cli_full_crawl(keyword: str = "", output_file: str = "souju_data.json",
                   max_pages: int = 10, fetch_episodes: bool = False,
                   fetch_playback: bool = False):
    """
    全站抓取: 抓取片库数据保存为JSON
    :param keyword:        搜索关键词 (空则拉取推荐流)
    :param output_file:    输出JSON文件路径
    :param max_pages:      最大翻页数
    :param fetch_episodes: 是否拉取每部剧的剧集列表
    :param fetch_playback: 是否拉取每集的播放源m3u8 (较慢)
    """
    crawler = SoujuCrawler()
    all_data = []
    total_cards = 0

    print(f"[*] 开始全站抓取, 关键词={keyword or '(推荐)'}, max_pages={max_pages}")
    print(f"[*] 拉取剧集: {fetch_episodes}, 拉取播放源: {fetch_playback}\n")

    for page_data in crawler.iterate_catalog(q=keyword, start_page=1, limit=48, max_pages=max_pages):
        for card in page_data.get("cards", []):
            total_cards += 1
            entry = dict(card)
            vid = card.get("id")
            print(f"  [{total_cards}] {card.get('title')} ({card.get('year')})")

            if fetch_episodes and vid:
                try:
                    entry["detail"] = crawler.get_detail(vid)
                    entry["episodes"] = crawler.get_all_episodes(vid)
                    time.sleep(0.2)

                    if fetch_playback and entry["episodes"]:
                        first_ep = entry["episodes"][0]
                        token = first_ep.get("token")
                        if token:
                            entry["playback_urls"] = crawler.get_playback_urls(token)
                            time.sleep(0.3)
                except Exception as e:
                    entry["error"] = str(e)
            all_data.append(entry)
        print(f"  --- 已完成一页, 累计 {total_cards} 条 ---\n")

    with open(output_file, "w", encoding="utf-8") as f:
        json.dump({
            "keyword": keyword,
            "total": len(all_data),
            "crawled_at": time.strftime("%Y-%m-%d %H:%M:%S"),
            "items": all_data,
        }, f, ensure_ascii=False, indent=2)
    print(f"[✓] 抓取完成! 共 {len(all_data)} 条, 已保存到 {output_file}")


def main():
    import argparse
    parser = argparse.ArgumentParser(
        description="搜剧AI (ai.baipiaozhe.com) 全站爬虫 - HMAC签名已逆向",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
使用示例:
  # 搜索影片
  python souju_crawler.py search "凡人修仙传"

  # 获取详情并解析播放源
  python souju_crawler.py detail av_xxx --ep 0

  # 获取详情+下载第一集
  python souju_crawler.py detail av_xxx --ep 0 --download

  # 短剧推荐
  python souju_crawler.py shortdrama

  # 全站抓取(仅片库列表)
  python souju_crawler.py crawl -o all_movies.json --max-pages 20

  # 全站抓取(含剧集和播放源)
  python souju_crawler.py crawl -o all_data.json --max-pages 5 --episodes --playback
        """,
    )
    subparsers = parser.add_subparsers(dest="command", required=True)

    # search
    p_search = subparsers.add_parser("search", help="搜索影视")
    p_search.add_argument("keyword", help="搜索关键词")
    p_search.add_argument("--pages", type=int, default=3, help="最大页数 (默认3)")

    # detail
    p_detail = subparsers.add_parser("detail", help="获取详情+播放源")
    p_detail.add_argument("variant_id", help="影片ID (av_开头)")
    p_detail.add_argument("--ep", type=int, default=0, help="集数索引 (默认0=第一集)")
    p_detail.add_argument("--download", action="store_true", help="下载该集为mp4 (需ffmpeg)")

    # shortdrama
    subparsers.add_parser("shortdrama", help="短剧推荐流")

    # crawl
    p_crawl = subparsers.add_parser("crawl", help="全站批量抓取")
    p_crawl.add_argument("-k", "--keyword", default="", help="搜索关键词 (空则拉取推荐)")
    p_crawl.add_argument("-o", "--output", default="souju_data.json", help="输出JSON路径")
    p_crawl.add_argument("--max-pages", type=int, default=10, help="最大翻页数")
    p_crawl.add_argument("--episodes", action="store_true", help="拉取剧集列表")
    p_crawl.add_argument("--playback", action="store_true", help="拉取播放源m3u8 (较慢,需配合--episodes)")

    args = parser.parse_args()

    if args.command == "search":
        cli_search(args.keyword, max_pages=args.pages)
    elif args.command == "detail":
        cli_detail_and_play(args.variant_id, ep_index=args.ep, download=args.download)
    elif args.command == "shortdrama":
        cli_short_drama()
    elif args.command == "crawl":
        cli_full_crawl(
            keyword=args.keyword,
            output_file=args.output,
            max_pages=args.max_pages,
            fetch_episodes=args.episodes,
            fetch_playback=args.playback,
        )


if __name__ == "__main__":
    main()
