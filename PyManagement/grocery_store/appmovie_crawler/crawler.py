#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
APP影院 (appmovie.vip) 全站爬虫  (稳定版)
站点逆向分析结论:
  ✅ CMS: 苹果CMS Maccms v10 (blueghost模板)
  ✅ 加密状态: 无加密! "encrypt":0, player_data.url直接明文输出m3u8
  ✅ 无需JS逆向/解密算法, 直接正则提取即可
使用:
  python crawler.py --test            # 测试:各分类1页
  python crawler.py --type 1 --max-pages 5   # 爬电影前5页
  python crawler.py                   # 全量爬(耗时长,适合后台挂)
"""

import os, re, json, csv, time, argparse, logging
from urllib.parse import urljoin
import random

import requests
from bs4 import BeautifulSoup

BASE_URL = "https://www.appmovie.vip"
OUTPUT_DIR = os.path.dirname(os.path.abspath(__file__))

# ====== 请求配置(保守稳定优先) ======
TIMEOUT = 20
RETRIES = 4
SLEEP_MIN = 0.4
SLEEP_MAX = 1.0

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
                  "(KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
    "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
    "Accept-Encoding": "gzip, deflate, br",
    "Connection": "keep-alive",
    "Cache-Control": "max-age=0",
}

CATEGORIES = [
    (1,  "电影",   "movies.json"),
    (2,  "连续剧", "tv.json"),
    (3,  "综艺",   "variety.json"),
    (4,  "动漫",   "anime.json"),
    (13, "国产剧", "domestic_drama.json"),
    (14, "港台剧", "hk_tw_drama.json"),
    (15, "日韩剧", "jp_kr_drama.json"),
    (16, "欧美剧", "western_drama.json"),
]

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%H:%M:%S",
    handlers=[
        logging.FileHandler(os.path.join(OUTPUT_DIR, "crawler.log"), encoding="utf-8"),
        logging.StreamHandler(),
    ],
)
logger = logging.getLogger(__name__)


def make_session():
    import urllib3
    from requests.adapters import HTTPAdapter
    from urllib3.util.retry import Retry

    # 新版urllib3默认启用HTTP/2会被服务器RST反爬,强制回退HTTP/1.1
    try:
        urllib3.util.connection.HAS_H2 = False
    except Exception:
        pass

    s = requests.Session()
    s.headers.update(HEADERS)
    retry = Retry(total=3, backoff_factor=1.5,
                  status_forcelist=[500, 502, 503, 403, 429],
                  allowed_methods=["GET"])
    adapter = HTTPAdapter(max_retries=retry, pool_connections=3, pool_maxsize=6)
    s.mount("https://", adapter)
    s.mount("http://", adapter)
    # 建立初始cookie
    try:
        s.get(BASE_URL + "/", timeout=15)
    except Exception:
        pass
    return s


def polite_sleep():
    time.sleep(random.uniform(SLEEP_MIN, SLEEP_MAX))


def http_get(session, url, retry=RETRIES):
    for i in range(retry):
        try:
            polite_sleep()
            r = session.get(url, timeout=TIMEOUT, allow_redirects=True)
            r.encoding = "utf-8"
            if r.status_code == 200 and len(r.text) > 2000:
                return r.text
            if r.status_code == 403 or (r.status_code == 200 and len(r.text) < 2000):
                w = 5 + i * 4
                logger.warning(f"  被限速({r.status_code}), 等待{w}s后重试...")
                time.sleep(w)
                continue
            logger.warning(f"  状态码{r.status_code}, 长度{len(r.text)}, 重试{i+1}")
        except requests.exceptions.RequestException as e:
            w = 3 + i * 3
            logger.warning(f"  请求异常({type(e).__name__}), 等待{w}s后重试...")
            time.sleep(w)
    logger.error(f"  多次重试失败: {url}")
    return ""


def get_total_pages(session, type_id):
    html = http_get(session, f"{BASE_URL}/index.php/vod/show/id/{type_id}.html")
    if not html:
        return 1
    pages = re.findall(r'/id/' + str(type_id) + r'/page/(\d+)\.html', html)
    return max((int(p) for p in pages), default=1)


def parse_list(session, type_id, page):
    if page == 1:
        url = f"{BASE_URL}/index.php/vod/show/id/{type_id}.html"
    else:
        url = f"{BASE_URL}/index.php/vod/show/id/{type_id}/page/{page}.html"
    html = http_get(session, url)
    if not html:
        return []
    vids = []
    seen = set()
    for m in re.finditer(r'/vod/detail/id/(\d+)\.html', html):
        vid = m.group(1)
        if vid not in seen:
            seen.add(vid)
            vids.append((vid, f"{BASE_URL}/index.php/vod/detail/id/{vid}.html"))
    return vids


def parse_detail(session, vid, url):
    html = http_get(session, url)
    if not html:
        return None
    soup = BeautifulSoup(html, "lxml")

    title_tag = soup.select_one(".stui-content__detail h3.title")
    if not title_tag:
        title_tag = soup.select_one("h1")
    title = title_tag.get_text(strip=True) if title_tag else ""

    cover_tag = soup.select_one(".stui-content__thumb img")
    cover = ""
    if cover_tag:
        cover = cover_tag.get("data-original") or cover_tag.get("src", "")

    info = soup.select_one(".stui-content__detail")
    info_text = info.get_text(" ", strip=True) if info else ""

    def grab(pat):
        m = re.search(pat, info_text)
        return m.group(1).strip() if m else ""

    vtype    = grab(r'类型[：:]\s*([^\s]+)')
    area     = grab(r'地区[：:]\s*([^\s]+)')
    year     = grab(r'年份[：:]\s*(\d{4})')
    status   = grab(r'状态[：:]\s*([^\s]+)')
    director = grab(r'导演[：:]\s*([^\s]+)')
    am = re.search(r'主演[：:]\s*(.+?)(?:\s{2,}|导演|简介|$)', info_text)
    actors = am.group(1).strip() if am else ""
    dm = re.search(r'简介[：:]\s*(.+?)(?:详细|$)', info_text)
    desc = dm.group(1).strip() if dm else ""

    # 播放源解析(模板: h3源名 + ul列表)
    episodes = []
    play_blocks = soup.select("ul.stui-content__playlist")
    for idx, ul in enumerate(play_blocks):
        # 往前找最近的含"播放/云播"的文本作为源名
        src_name = f"线路{idx+1}"
        prev = ul.find_previous()
        for _ in range(10):
            if not prev:
                break
            t = prev.get_text(strip=True)
            if t and ("云播" in t or "播放" in t) and len(t) < 20:
                src_name = t
                break
            prev = prev.find_previous()

        for a in ul.select("li a"):
            href = a.get("href", "")
            if href and "/vod/play/" in href:
                episodes.append({
                    "source": src_name,
                    "ep": a.get_text(strip=True),
                    "play_page": urljoin(BASE_URL, href),
                    "url": "",
                    "encrypt": None,
                })
    return {
        "id": vid, "title": title, "cover": cover,
        "type": vtype, "area": area, "year": year, "status": status,
        "director": director, "actors": actors, "desc": desc,
        "detail_url": url, "episodes": episodes,
    }


def parse_play(session, ep):
    """解析播放页,提取m3u8直链. 该站encrypt=0,无需解密!"""
    html = http_get(session, ep["play_page"])
    if not html:
        return ep
    m = re.search(r'var\s+player_data\s*=\s*(\{.*?\})\s*</script>', html, re.DOTALL)
    if m:
        try:
            data = json.loads(m.group(1).replace('\\/', '/'))
            ep["url"]     = data.get("url", "")
            ep["encrypt"] = data.get("encrypt", 0)
            ep["from"]    = data.get("from", "")
            ep["note"]    = data.get("note", "")
        except json.JSONDecodeError:
            logger.warning(f"  player_data解析失败: {ep['play_page'][-50:]}")
    return ep


def batched(items, n):
    for i in range(0, len(items), n):
        yield items[i:i+n]


def crawl_category(type_id, type_name, max_pages=None):
    session = make_session()
    logger.info(f"===== 开始: {type_name} (id={type_id}) =====")

    total = get_total_pages(session, type_id)
    if max_pages:
        total = min(total, max_pages)
    logger.info(f"  总页数: {total}")

    videos = []
    seen = set()
    all_eps = []

    for page in range(1, total + 1):
        vids = parse_list(session, type_id, page)
        new_vids = [(v, u) for v, u in vids if v not in seen]
        for v, _ in new_vids:
            seen.add(v)
        logger.info(f"  第{page}/{total}页: {len(new_vids)}条新视频 (累计{len(videos)+len(new_vids)}部)")

        for vid, durl in new_vids:
            video = parse_detail(session, vid, durl)
            if video:
                videos.append(video)
                all_eps.extend(video["episodes"])

        if page % 5 == 0 or page == total:
            _save(videos, type_name)

    # 播放页: 用单session串行解析,最稳妥(并发会触发HTTP/2 RST反爬)
    logger.info(f"  详情爬取完毕, 开始解析{len(all_eps)}个播放链接(单连接串行,稳定优先)...")
    url_count = 0
    enc_count = 0
    for i, ep in enumerate(all_eps, 1):
        parse_play(session, ep)
        if ep.get("url"):
            url_count += 1
        if ep.get("encrypt", 0) != 0:
            enc_count += 1
        if i % 50 == 0 or i == len(all_eps):
            logger.info(f"    进度: {i}/{len(all_eps)} (已得直链{url_count})")
            _save(videos, type_name)

    _save(videos, type_name)
    logger.info(f"  ✓ {type_name}完成: {len(videos)}部, {url_count}条m3u8直链, 加密:{enc_count}")
    return videos


def _save(videos, type_name):
    path = os.path.join(OUTPUT_DIR, f"{type_name}.json")
    with open(path, "w", encoding="utf-8") as f:
        json.dump(videos, f, ensure_ascii=False, indent=2)


def save_csv(all_data, path):
    with open(path, "w", encoding="utf-8-sig", newline="") as f:
        w = csv.writer(f)
        w.writerow(["分类", "ID", "标题", "年份", "地区", "类型", "状态",
                    "导演", "主演", "播放源", "集数", "视频直链(m3u8)", "播放页", "详情页"])
        for cat, vs in all_data.items():
            for v in vs:
                if not v["episodes"]:
                    w.writerow([cat, v["id"], v["title"], v["year"], v["area"], v["type"],
                                v["status"], v["director"], v["actors"],
                                "", "", "", "", v["detail_url"]])
                for ep in v["episodes"]:
                    w.writerow([cat, v["id"], v["title"], v["year"], v["area"], v["type"],
                                v["status"], v["director"], v["actors"], ep["source"],
                                ep["ep"], ep["url"], ep["play_page"], v["detail_url"]])


def main():
    p = argparse.ArgumentParser(description="APP影院全站爬虫 (appmovie.vip)")
    p.add_argument("--test", action="store_true", help="测试:每个分类爬1页")
    p.add_argument("--type", type=int, default=0, help="指定分类ID (0=全部)")
    p.add_argument("--max-pages", type=int, default=0, help="每分类最大页数(0=全部)")
    args = p.parse_args()

    mp = 1 if args.test else (args.max_pages if args.max_pages else None)
    cats = [c for c in CATEGORIES if args.type == 0 or c[0] == args.type]

    logger.info("=" * 50)
    logger.info(f"APP影院全站爬虫启动")
    logger.info(f"目标分类: {[c[1] for c in cats]}")
    logger.info(f"最大页数: {mp or '全部'}")
    logger.info(f"请求间隔: {SLEEP_MIN}~{SLEEP_MAX}s, 单连接串行(稳定防封)")
    logger.info("=" * 50)

    results = {}
    for tid, tname, _ in cats:
        results[tname] = crawl_category(tid, tname, max_pages=mp)

    save_csv(results, os.path.join(OUTPUT_DIR, "all_videos.csv"))

    total_v = sum(len(v) for v in results.values())
    total_e = sum(1 for vs in results.values() for v in vs for ep in v["episodes"] if ep.get("url"))
    total_enc = sum(1 for vs in results.values() for v in vs for ep in v["episodes"] if ep.get("encrypt", 0) != 0)
    logger.info("=" * 50)
    logger.info(f"全部爬取完成!")
    logger.info(f"视频总数: {total_v} 部")
    logger.info(f"m3u8直链: {total_e} 条")
    logger.info(f"加密链接: {total_enc} 条 (该站点encrypt=0,此项应为0)")
    logger.info(f"输出目录: {OUTPUT_DIR}")
    logger.info("=" * 50)


if __name__ == "__main__":
    main()
