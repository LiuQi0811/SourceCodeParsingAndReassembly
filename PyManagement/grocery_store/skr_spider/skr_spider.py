#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
樱之空动漫 (https://skr.skr2.cc:666/) 全站爬虫
================================================
* MacCMS V10 架构
* 播放页 player_aaaa.encrypt=2 解密已完美还原（unescape + base64 自定义字符集解码）
* 支持：多线程、断点续爬、分类全量抓取、元数据（标题/演员/导演/分类/封面/简介）、
        多播放源+所有分集直链解密、导出 JSON / CSV / M3U 播放列表
用法：
    python3 skr_spider.py                # 全量爬取（默认分类）
    python3 skr_spider.py --tids 1,46    # 指定分类
    python3 skr_spider.py --test         # 测试：只爬第1分类前2页
    python3 skr_spider.py --workers 10   # 并发数
输出目录：./skr_data/
"""
import os, sys, re, json, time, base64, argparse, csv, hashlib
import urllib.parse
from concurrent.futures import ThreadPoolExecutor, as_completed
from threading import Lock
import requests
from bs4 import BeautifulSoup

# ============ 站点配置 ============
BASE_URL = "https://skr.skr2.cc:666"
HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
                  "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
    "Referer": BASE_URL + "/",
}
# 默认分类（探测得到的有效 tid 列表）
DEFAULT_TIDS = [1, 2, 4, 22, 32, 46, 47, 74, 80, 81, 82, 83, 84, 85, 90, 91, 92]

OUT_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "skr_data")
os.makedirs(OUT_DIR, exist_ok=True)

# ============ 自定义 base64 解码（完全对齐 MacCMS player.js 中的字符映射表）============
_B64CHARS = (
    "ABCDEFGHIJKLMNOPQRSTUVWXYZ"
    "abcdefghijklmnopqrstuvwxyz"
    "0123456789+/"
)
def maccms_b64decode(s: str) -> str:
    """严格按照 MacCMS player.js 里的 base64DecodeChars 解码表实现。"""
    tab = [-1] * 256
    for i, ch in enumerate(_B64CHARS):
        tab[ord(ch)] = i
    s = s.replace("\n", "").replace("\r", "").replace(" ", "")
    i, n = 0, len(s)
    out = bytearray()
    while i < n:
        # c1
        while i < n:
            c1 = tab[ord(s[i]) & 0xFF]; i += 1
            if c1 != -1: break
        else: break
        # c2
        while i < n:
            c2 = tab[ord(s[i]) & 0xFF]; i += 1
            if c2 != -1: break
        else: break
        out.append((c1 << 2) | ((c2 & 0x30) >> 4))
        # c3
        while i < n:
            c3 = ord(s[i]) & 0xFF; i += 1
            if c3 == 61: return out.decode("latin1", errors="replace")  # '='
            c3 = tab[c3]
            if c3 != -1: break
        else: break
        out.append(((c2 & 0x0F) << 4) | ((c3 & 0x3C) >> 2))
        # c4
        while i < n:
            c4 = ord(s[i]) & 0xFF; i += 1
            if c4 == 61: return out.decode("latin1", errors="replace")
            c4 = tab[c4]
            if c4 != -1: break
        else: break
        out.append(((c3 & 0x03) << 6) | c4)
    return out.decode("latin1", errors="replace")


def decrypt_url(enc: str, encrypt_level) -> str:
    """按 encrypt 级别解密 player_aaaa.url。"""
    if enc is None: return ""
    if str(encrypt_level) == "2":
        return urllib.parse.unquote(maccms_b64decode(enc))
    elif str(encrypt_level) == "1":
        return urllib.parse.unquote(enc)
    else:  # 0 或其它——明文
        return enc


# ============ HTTP 会话 ============
SESSION = requests.Session()
SESSION.headers.update(HEADERS)
SESSION.verify = False  # 自签名证书
import urllib3
urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)


def http_get(url, retries=3, timeout=20):
    for i in range(retries):
        try:
            r = SESSION.get(url, timeout=timeout)
            r.encoding = r.apparent_encoding or "utf-8"
            return r
        except Exception as e:
            if i == retries - 1:
                raise
            time.sleep(1.5 * (i + 1))


# ============ 数据结构 ============
class Store:
    def __init__(self):
        self.lock = Lock()
        self.details = {}        # vod_id -> info dict
        self.seen_ids = set()
        self.detail_path = os.path.join(OUT_DIR, "videos.json")
        self.load()

    def load(self):
        if os.path.exists(self.detail_path):
            try:
                with open(self.detail_path, "r", encoding="utf-8") as f:
                    self.details = json.load(f)
                self.seen_ids = set(self.details.keys())
                print(f"[断点续爬] 已加载 {len(self.details)} 条已爬详情")
            except Exception as e:
                print(f"[警告] 读取旧进度失败: {e}")

    def save(self):
        with self.lock:
            tmp = self.detail_path + ".tmp"
            with open(tmp, "w", encoding="utf-8") as f:
                json.dump(self.details, f, ensure_ascii=False, indent=2)
            os.replace(tmp, self.detail_path)

    def add(self, vod_id, info):
        with self.lock:
            self.details[str(vod_id)] = info
            self.seen_ids.add(str(vod_id))

    def has(self, vod_id):
        return str(vod_id) in self.seen_ids


STORE = Store()


# ============ 分类 / 列表 ============
def get_total_pages(tid):
    """取分类总页数。"""
    url = f"{BASE_URL}/vodshow/{tid}--------1---/"
    html = http_get(url).text
    # 找“尾页”链接
    m = re.search(r'href="/vodshow/%d--------(\d+)---/"[^>]*>尾页' % tid, html)
    if m:
        return int(m.group(1))
    # 兜底：取所有分页数字中的最大值
    pages = [int(x) for x in re.findall(r'/vodshow/%d--------(\d+)---/' % tid, html)]
    return max(pages) if pages else 1


def list_page_vod_ids(tid, page):
    url = f"{BASE_URL}/vodshow/{tid}--------{page}---/"
    html = http_get(url).text
    ids = re.findall(r'href="/voddetail/(\d+)/"', html)
    return list(dict.fromkeys(ids))  # 保序去重


# ============ 详情页 ============
def parse_detail(vod_id):
    """解析详情页元数据 + 所有播放链接。"""
    url = f"{BASE_URL}/voddetail/{vod_id}/"
    html = http_get(url).text
    soup = BeautifulSoup(html, "html.parser")

    title_tag = soup.find("h1", class_="title")
    title = title_tag.get_text(strip=True) if title_tag else ""
    if not title:
        m = re.search(r'<title>([^<]+)</title>', html)
        title = m.group(1).split("免费")[0].split("在线")[0].strip() if m else ""

    cover = ""
    m = re.search(r'https://img\.yingk\.sbs:8443/upload/vod/[^"\'<>\s]+\.jpg', html)
    if m: cover = m.group(0)

    desc = ""
    m = re.search(r'property="og:description" content="([^"]+)"', html)
    if m:
        desc = m.group(1)
    else:
        m = re.search(r'class=["\'][^"\']*desc[^"\']*["\'][^>]*>(.*?)</(?:div|p|span)', html, re.S)
        if m: desc = re.sub(r'<[^>]+>', '', m.group(1)).strip()

    keywords = ""
    m = re.search(r'name="keywords" content="([^"]+)"', html)
    if m: keywords = m.group(1)

    # 信息项（类名随主题差异较大，用正则兜底）
    year = area = lang = director = actor = category = ""
    for block in re.findall(r'class=["\'](?:module-info-item|video-info-item|data-item)[^"\']*["\'][^>]*>(.*?)</div>', html, re.S):
        txt = re.sub(r'<[^>]+>', ' ', block).strip()
        txt = re.sub(r'\s+', ' ', txt)
        if '年份' in txt and not year:
            year = txt.split('年份')[-1].strip('：: ').strip()
        elif '地区' in txt and not area:
            area = txt.split('地区')[-1].strip('：: ').strip()
        elif '语言' in txt and not lang:
            lang = txt.split('语言')[-1].strip('：: ').strip()
        elif '导演' in txt and not director:
            director = txt.split('导演')[-1].strip('：: ').strip()
        elif ('主演' in txt or '声优' in txt) and not actor:
            actor = txt.split('主演')[-1] if '主演' in txt else txt.split('声优')[-1]
            actor = actor.strip('：: ').strip()
        elif ('类型' in txt or '分类' in txt) and not category:
            category = txt.split('类型')[-1] if '类型' in txt else txt.split('分类')[-1]
            category = category.strip('：: ').strip()

    # 所有播放页链接（去重）——格式 /vodplay/{id}-{sid}-{nid}/
    play_links = sorted(set(re.findall(r'/vodplay/%s-(\d+)-(\d+)/' % vod_id, html)))

    return {
        "vod_id": int(vod_id),
        "title": title,
        "cover": cover,
        "desc": desc,
        "year": year,
        "area": area,
        "lang": lang,
        "director": director,
        "actor": actor,
        "category": category,
        "detail_url": url,
        "play_links": [{"sid": int(s), "nid": int(n)} for s, n in play_links],
        "episodes": []   # 解密后填
    }


# ============ 播放页（含解密）============
def _extract_player_aaaa(html: str):
    """从播放页源码中精准提取 player_aaaa JSON（处理内嵌花括号的配对问题）。"""
    m = re.search(r'var\s+player_aaaa\s*=\s*\{', html)
    if not m: return None
    start = m.end() - 1
    depth = 0
    for i in range(start, len(html)):
        c = html[i]
        if c == '{': depth += 1
        elif c == '}':
            depth -= 1
            if depth == 0:
                try:
                    return json.loads(html[start:i+1])
                except Exception:
                    return None
    return None


def parse_play(vod_id, sid, nid):
    url = f"{BASE_URL}/vodplay/{vod_id}-{sid}-{nid}/"
    html = http_get(url).text
    data = _extract_player_aaaa(html)
    if data is None:
        return {"ok": False, "err": "player_aaaa not found / decode fail", "sid": sid, "nid": nid}

    enc_url = data.get("url", "")
    enc = data.get("encrypt", 0)
    real_url = decrypt_url(enc_url, enc)
    enc_next = data.get("url_next", "")
    next_url = decrypt_url(enc_next, enc) if enc_next else ""

    # 若该源 parse 字段有解析接口（ps=1），则此 url 是解析接口 URL（真正m3u8由解析接口二次返回）
    # 这里保持真实解密后的 url——用户/播放端自行通过解析接口获取真实流，或 url 已为直链
    vod_data = data.get("vod_data", {}) or {}
    return {
        "ok": True,
        "sid": sid,
        "nid": nid,
        "from": data.get("from", ""),
        "note": data.get("note", ""),
        "server": data.get("server", ""),
        "play_url": real_url,
        "play_url_next": next_url,
        "vod_name": vod_data.get("vod_name", ""),
    }


# ============ 导出 ============
def export_all():
    data = list(STORE.details.values())
    data.sort(key=lambda x: x.get("vod_id", 0))
    # JSON 已经实时写。写一份 CSV 和一份 M3U 列表
    csv_path = os.path.join(OUT_DIR, "videos.csv")
    with open(csv_path, "w", encoding="utf-8-sig", newline="") as f:
        w = csv.writer(f)
        w.writerow(["vod_id", "标题", "年份", "地区", "导演", "主演", "分类", "集数", "封面", "详情页", "简介"])
        for v in data:
            w.writerow([
                v["vod_id"], v["title"], v.get("year", ""), v.get("area", ""),
                v.get("director", ""), v.get("actor", ""), v.get("category", ""),
                len(v.get("episodes", [])), v.get("cover", ""), v["detail_url"],
                (v.get("desc", "") or "").replace("\n", " ")
            ])
    # 每部番一个 m3u 列表（所有分集所有源）
    m3u_dir = os.path.join(OUT_DIR, "m3u")
    os.makedirs(m3u_dir, exist_ok=True)
    for v in data:
        safe = re.sub(r'[\\/:*?"<>|]', '_', v["title"] or str(v["vod_id"]))[:80]
        fp = os.path.join(m3u_dir, f"{v['vod_id']}_{safe}.m3u")
        with open(fp, "w", encoding="utf-8") as f:
            f.write("#EXTM3U\n")
            for ep in v.get("episodes", []):
                if not ep.get("play_url"): continue
                label = f"[{ep.get('from','')}] 第{ep['nid']}集"
                if ep.get("note"): label += f" ({ep['note']})"
                f.write(f"#EXTINF:-1,{v['title']} - {label}\n")
                f.write(f"{ep['play_url']}\n")
    # 汇总索引 M3U
    with open(os.path.join(OUT_DIR, "all.m3u"), "w", encoding="utf-8") as f:
        f.write("#EXTM3U\n")
        for v in data:
            for ep in v.get("episodes", []):
                if not ep.get("play_url"): continue
                label = f"[{ep.get('from','')}] {v['title']} 第{ep['nid']}集"
                f.write(f"#EXTINF:-1,{label}\n")
                f.write(f"{ep['play_url']}\n")
    print(f"[导出] 共 {len(data)} 部，CSV={csv_path}, M3U={m3u_dir}/, all.m3u")


# ============ 主流程 ============
def crawl_detail(vod_id):
    if STORE.has(vod_id):
        return vod_id, "skip"
    try:
        info = parse_detail(vod_id)
        # 逐个播放页解密
        episodes = []
        for pl in info["play_links"]:
            ep = parse_play(vod_id, pl["sid"], pl["nid"])
            if ep.get("ok"):
                episodes.append(ep)
            else:
                episodes.append(ep)
            time.sleep(0.15)
        info["episodes"] = episodes
        # 用播放页vod_data补齐title等信息
        for ep in episodes:
            if ep.get("vod_name") and not info["title"]:
                info["title"] = ep["vod_name"]
            if ep.get("vod_name") and ep["vod_name"] != info.get("title"):
                break
        STORE.add(vod_id, info)
        return vod_id, "ok"
    except Exception as e:
        return vod_id, f"err: {e}"


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--tids", type=str, default="", help="逗号分隔分类ID，留空则默认全部分类")
    ap.add_argument("--workers", type=int, default=6)
    ap.add_argument("--test", action="store_true", help="测试模式：每分类只跑前2页")
    ap.add_argument("--pages", type=int, default=0, help="每分类最多爬多少页，0=全量")
    args = ap.parse_args()

    tids = DEFAULT_TIDS if not args.tids else [int(x) for x in args.tids.split(",") if x.strip()]
    print(f"[启动] 分类列表: {tids}, workers={args.workers}, test={args.test}")

    total_pages = {}
    for tid in tids:
        try:
            tp = get_total_pages(tid)
        except Exception as e:
            print(f"  分类{tid} 获取页数失败: {e}"); tp = 1
        total_pages[tid] = tp
        print(f"  分类 tid={tid} 总页数={tp}")

    # 收集所有待爬 vod_id
    all_ids = []
    for tid, tp in total_pages.items():
        max_p = min(tp, 2) if args.test else tp
        if args.pages > 0: max_p = min(max_p, args.pages)
        for p in range(1, max_p + 1):
            try:
                ids = list_page_vod_ids(tid, p)
                all_ids.extend(ids)
                print(f"  分类{tid} 第{p}/{max_p}页 -> {len(ids)} 条")
            except Exception as e:
                print(f"  分类{tid} 第{p}页抓取失败: {e}")
            time.sleep(0.3)
    all_ids = list(dict.fromkeys(all_ids))
    todo = [x for x in all_ids if not STORE.has(x)]
    print(f"[汇总] 共发现 {len(all_ids)} 部，待爬 {len(todo)} 部，已存在 {len(all_ids)-len(todo)} 部")

    done = 0; ok = 0; fail = 0; skip = 0
    last_save = time.time()
    with ThreadPoolExecutor(max_workers=args.workers) as ex:
        futures = {ex.submit(crawl_detail, vid): vid for vid in todo}
        for fut in as_completed(futures):
            vid = futures[fut]
            try:
                _, status = fut.result()
            except Exception as e:
                status = f"err: {e}"
            done += 1
            if status == "ok": ok += 1
            elif status == "skip": skip += 1
            else: fail += 1; print(f"  [FAIL] vod_id={vid} {status}")
            if done % 20 == 0 or time.time() - last_save > 15:
                STORE.save(); last_save = time.time()
                print(f"  [进度] {done}/{len(todo)} ok={ok} fail={fail} skip={skip}")
    STORE.save()
    export_all()
    print(f"[完成] 成功 {ok}，失败 {fail}，跳过 {skip}。输出目录: {OUT_DIR}")


if __name__ == "__main__":
    main()
