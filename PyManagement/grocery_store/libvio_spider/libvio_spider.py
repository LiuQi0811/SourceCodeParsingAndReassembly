"""
LIBVIO (libvio.host) 全站抓取工具  v1.1
================================================
反爬措施：
  1) CDN TLS 指纹检测 (curl/requests 直接 403) → 使用 curl_cffi impersonate='chrome124' 绕过
  2) CDN PoW (Proof of Work) 5秒盾（SHA256 哈希前缀碰撞）→ 本地 Python 求解，拿到 cookie 后直接访问，无需浏览器
视频源：player_aaaa 变量暴露 mp4 直链，"encrypt:3" 只是 MacCMS 标记，URL 本身无加密。

功能：
  - 自动求解 CDN PoW（无需 Playwright/Selenium，纯 Python 几十毫秒）
  - 抓取 5 大分类（电影/剧集/番剧/日韩/欧美）所有影视元数据
  - 抓取详情页 + 全部线路集数 MP4 直链
  - 断点续爬（JSON 本地缓存）
  - 多线程断点续传下载视频
  - 导出 M3U 播放列表（VLC/PotPlayer 直接看）
  - 关键词搜索

用法：
  python libvio_spider.py --crawl-meta                        # 仅抓取元数据+直链（推荐先跑）
  python libvio_spider.py --crawl-meta --download             # 抓完即下
  python libvio_spider.py --crawl-meta --types 1              # 只抓电影(type=1)
  python libvio_spider.py --crawl-meta --max-pages 3          # 每分类只抓3页（测试）
  python libvio_spider.py --export-m3u                        # 导出 M3U
  python libvio_spider.py --search "海贼王"                   # 搜索

依赖：pip install requests beautifulsoup4 curl_cffi

⚠ 版权说明：请遵守当地法律法规，本工具仅供学习交流使用，请勿用于侵权用途。
"""

import argparse
import hashlib
import json
import os
import random
import re
import sys
import time
import logging
from pathlib import Path
from urllib.parse import urljoin

from curl_cffi import requests as creq
from bs4 import BeautifulSoup

# ============================================================
# 配置
# ============================================================
BASE_URL = "https://libvio.host"
BROWSER = "chrome124"  # curl_cffi TLS 指纹
DEFAULT_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
        "(KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36"
    ),
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
    "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
    "Referer": BASE_URL + "/",
}

CATEGORIES = [
    (1, "电影"),
    (2, "剧集"),
    (4, "番剧"),
    (15, "日韩"),
    (16, "欧美"),
]

OUTPUT_DIR = Path(__file__).parent / "output"
OUTPUT_DIR.mkdir(exist_ok=True)
META_FILE = OUTPUT_DIR / "libvio_all.json"
DOWNLOAD_DIR = OUTPUT_DIR / "videos"
DOWNLOAD_DIR.mkdir(exist_ok=True)

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%H:%M:%S",
)
log = logging.getLogger("libvio")


# ============================================================
# CDN PoW 求解（SHA256 前缀碰撞）
# ============================================================
POW_PARAMS_RE = re.compile(
    r'(?:TS|SIG|DIFF|MODE)\s*=\s*"([^"]+)"'
)

def solve_pow(html: str) -> str | None:
    """从挑战页 HTML 中提取 PoW 参数并求解 nonce，返回 cookie 值。
    Cookie 格式：__cdn_pow = {TS}_{MODE}_{nonce}_{SIG}
    """
    # 提取四个参数（按出现顺序：TS SIG DIFF MODE）
    vals = POW_PARAMS_RE.findall(html)
    if len(vals) < 4:
        return None
    TS, SIG, DIFF, MODE = vals[0], vals[1], vals[2], vals[3]
    log.info("CDN PoW 挑战：TS=%s DIFF=%s MODE=%s", TS, DIFF, MODE)

    target = DIFF  # 哈希 hex 前缀
    sig_b = SIG.encode("ascii")
    nonce = 0
    t0 = time.time()
    # 难度 0000 = 4 个 0 前缀，期望 65536 次，Python 通常几十毫秒
    while True:
        h = hashlib.sha256(sig_b + str(nonce).encode("ascii")).hexdigest()
        if h.startswith(target):
            break
        nonce += 1
        if nonce > 5_000_000:  # 异常兜底
            log.error("PoW 求解超过上限，终止")
            return None
    elapsed = time.time() - t0
    log.info("PoW 求解完成：nonce=%d hash=%s 耗时 %.2fs", nonce, h[:16], elapsed)
    return f"{TS}_{MODE}_{nonce}_{SIG}"


def make_session() -> creq.Session:
    """创建带反爬能力的会话：自动处理 PoW 5秒盾。"""
    s = creq.Session()
    s.headers.update(DEFAULT_HEADERS)
    # 首次访问求解PoW
    _ensure_pow(s)
    return s


def _ensure_pow(s: creq.Session):
    """确保当前会话已有有效 __cdn_pow cookie。"""
    r = s.get(BASE_URL + "/", impersonate=BROWSER, timeout=20)
    try:
        if not r.encoding:
            r.encoding = "utf-8"
    except Exception:
        pass
    text = r.text
    if r.status_code == 200 and "Checking your browser" not in text and "正在验证" not in text:
        log.info("会话已就绪，无需 PoW")
        return
    if r.status_code == 403 or "Checking your browser" in text or "正在验证" in text:
        cookie = solve_pow(text)
        if not cookie:
            raise RuntimeError("PoW 求解失败")
        s.cookies.set("__cdn_pow", cookie, domain="libvio.host", path="/")
        r2 = s.get(BASE_URL + "/", impersonate=BROWSER, timeout=20)
        if r2.status_code == 200:
            log.info("✅ PoW 验证通过，cookie 已生效")
        else:
            raise RuntimeError(f"PoW 后仍 status={r2.status_code}")


# ============================================================
# HTTP 请求封装
# ============================================================

def request_get(s: creq.Session, url: str, *, retries=4, timeout=25, **kwargs) -> str:
    last_exc = None
    for i in range(retries):
        try:
            resp = s.get(url, impersonate=BROWSER, timeout=timeout, **kwargs)
            # 拿文本（解决 curl_cffi encoding 时序问题）
            try:
                if not resp.encoding:
                    resp.encoding = "utf-8"
            except Exception:
                pass
            text = resp.text
            if resp.status_code == 403 or "Checking your browser" in text[:5000] or "正在验证" in text[:5000]:
                log.warning("收到 PoW 挑战页，重新求解… (第%d次)", i + 1)
                cookie = solve_pow(text)
                if cookie:
                    s.cookies.set("__cdn_pow", cookie, domain="libvio.host", path="/")
                time.sleep(0.8)
                continue
            if resp.status_code == 200:
                return text
            log.warning("GET %s -> HTTP %s (retry %d)", url, resp.status_code, i + 1)
        except Exception as e:
            last_exc = e
            log.warning("GET %s error: %s (retry %d)", url, e, i + 1)
        time.sleep(1.0 + i * 1.2)
    if last_exc:
        raise last_exc
    raise RuntimeError(f"GET {url} failed after {retries} retries")


# ============================================================
# 列表页解析
# ============================================================
def parse_list_page(html: str) -> list[dict]:
    soup = BeautifulSoup(html, "html.parser")
    items = []
    seen = set()
    # 遍历所有指向 /detail/ 的链接
    for a in soup.select("a[href*='/detail/']"):
        href = a.get("href", "").strip()
        title = (a.get("title") or a.get_text(strip=True) or "").strip()
        if not href or "/detail/" not in href or not title:
            continue
        url = urljoin(BASE_URL + "/", href)
        if url in seen:
            continue
        seen.add(url)

        # 回溯卡片父节点，取封面/评分
        card = a
        for _ in range(6):
            card = card.parent
            if card is None:
                break
            if getattr(card, "name", "") == "li":
                break
        cover, note, score = "", "", ""
        if card:
            img = card.select_one("img")
            if img:
                cover = img.get("data-original") or img.get("src") or ""
                cover = urljoin(BASE_URL + "/", cover) if cover else ""
            sub = card.select_one(".pic-text, .score, .stui-vodlist__detail p, span")
            if sub:
                txt = sub.get_text(" ", strip=True)
                m = re.search(r"(\d+\.\d+)", txt)
                if m:
                    score = m.group(1)
                note = txt

        items.append({
            "title": title,
            "detail_url": url,
            "cover": cover,
            "score": score,
            "note": note,
        })
    return items


def get_total_pages(html: str) -> int:
    m = re.search(r'href="[^"]*?-(\d+)\.html"[^>]*>\s*尾页', html)
    if m:
        return int(m.group(1))
    nums = [int(x) for x in re.findall(r'/type/\d+(?:-\d+)*-(\d+)\.html', html)]
    return max(nums) if nums else 1


def category_url(type_id: int, page: int) -> str:
    if page <= 1:
        return f"{BASE_URL}/type/{type_id}.html"
    return f"{BASE_URL}/type/{type_id}--------{page}.html"


# ============================================================
# 详情页/播放页解析
# ============================================================
PLAYER_AAAA_RE = re.compile(r"var\s+player_aaaa\s*=\s*(\{.+?\})\s*</script>", re.S)


def parse_player_aaaa(html: str) -> dict | None:
    m = PLAYER_AAAA_RE.search(html)
    if not m:
        return None
    raw = m.group(1).replace("\\/", "/")
    try:
        return json.loads(raw)
    except Exception:
        # 尝试非严格：用正则提取 url 字段兜底
        data = {}
        for k in ("flag", "encrypt", "url", "url_next", "link", "link_next", "link_pre",
                  "from", "server", "note", "id", "sid", "nid", "trysee", "points"):
            mm = re.search(rf'"{k}"\s*:\s*("(?:[^"\\]|\\.)*"|-?\d+)', raw)
            if mm:
                v = mm.group(1)
                if v.startswith('"'):
                    v = v[1:-1].replace("\\/", "/").replace('\\"', '"')
                else:
                    try:
                        v = int(v)
                    except ValueError:
                        v = 0
                data[k] = v
        return data


def extract_play_links(detail_html: str) -> list[dict]:
    """从详情页提取所有线路的每集播放URL。"""
    soup = BeautifulSoup(detail_html, "html.parser")
    eps = []
    # 按块提取（可能多个线路tab）
    blocks = soup.select(".stui-vodlist__head + *, .tab-content, .stui-content__playlist, .module-play-list")
    if not blocks:
        blocks = [soup]
    seen_play_urls = set()
    # 先找真正的集数链接
    for block in blocks:
        src = "default"
        head = block.find_previous(["h3", "h4", "span", "a"])
        if head:
            src = head.get_text(strip=True) or src
        for a in block.select("a[href*='/w/']"):
            href = a.get("href", "").strip()
            name = a.get_text(strip=True)
            if not href or not name:
                continue
            if name in ("立即播放", "播放", "播放全部"):
                continue
            play_url = urljoin(BASE_URL + "/", href)
            if play_url in seen_play_urls:
                continue
            seen_play_urls.add(play_url)
            eps.append({
                "ep_name": name,
                "play_url": play_url,
                "source": src,
            })
    # 兜底：电影类单集，只有"立即播放"按钮
    if not eps:
        for a in soup.select("a[href*='/w/']"):
            href = a.get("href", "").strip()
            name = a.get_text(strip=True)
            if href and name:
                play_url = urljoin(BASE_URL + "/", href)
                if play_url in seen_play_urls:
                    continue
                seen_play_urls.add(play_url)
                eps.append({
                    "ep_name": "正片",
                    "play_url": play_url,
                    "source": "default",
                })
                break
    return eps


def parse_detail_meta(html: str) -> dict:
    soup = BeautifulSoup(html, "html.parser")
    info = {"director": "", "actors": "", "year": "", "area": "",
            "genre": "", "intro": "", "douban": ""}
    h1 = soup.select_one("h1")
    if h1:
        info["title"] = h1.get_text(strip=True)
    data = soup.select_one(".stui-content__detail .data, .detail .data")
    if data:
        text = data.get_text(" / ", strip=True)
        for part in text.split("/"):
            part = part.strip()
            if re.fullmatch(r"\d{4}", part):
                info["year"] = part
        db_a = data.select_one("a[href*='douban']")
        if db_a:
            info["douban"] = db_a.get("href", "")
    actors = [a.get_text(strip=True) for a in soup.select("a[href*='/actor/']")][:10]
    info["actors"] = ",".join(actors)
    directors = [a.get_text(strip=True) for a in soup.select("a[href*='/director/']")][:3]
    info["director"] = ",".join(directors)
    desc = soup.select_one(".desc, .detail .sketch")
    if desc:
        info["intro"] = desc.get_text(" ", strip=True)
    return info


def fetch_mp4_url(s: creq.Session, play_url: str) -> tuple[str, str]:
    """返回 (mp4_url, source_type)。source_type 可能为 mp4/m3u8/quark/xunlei/other。"""
    html = request_get(s, play_url)
    aaaa = parse_player_aaaa(html) or {}
    url = aaaa.get("url", "")
    if url.startswith("//"):
        url = "https:" + url
    frm = (aaaa.get("from", "") or "").lower()
    if not url:
        return "", "none"
    if "pan.quark.cn" in url or "quark.cn" in url or frm in ("kuake", "quark"):
        return url, "quark"
    if "pan.xunlei.com" in url or frm in ("xunlei", "xl"):
        return url, "xunlei"
    if url.endswith(".m3u8") or ".m3u8" in url:
        return url, "m3u8"
    if url.endswith(".mp4"):
        return url, "mp4"
    return url, "other"


# ============================================================
# 抓取流程
# ============================================================
def crawl_category(s: creq.Session, type_id: int, type_name: str,
                   max_pages: int | None = None) -> list[dict]:
    log.info("========== 分类 [%s] (type=%s) ==========", type_name, type_id)
    first_html = request_get(s, category_url(type_id, 1))
    total = get_total_pages(first_html)
    if max_pages and max_pages < total:
        total = max_pages
    log.info("总页数：%d", total)

    all_vods, seen = [], set()

    def _add(items):
        n = 0
        for it in items:
            if it["detail_url"] not in seen:
                seen.add(it["detail_url"])
                it["category_id"] = type_id
                it["category"] = type_name
                all_vods.append(it)
                n += 1
        return n

    _add(parse_list_page(first_html))
    for p in range(2, total + 1):
        try:
            html = request_get(s, category_url(type_id, p))
        except Exception as e:
            log.error("第%d页失败：%s", p, e)
            continue
        new = _add(parse_list_page(html))
        log.info("  第 %d/%d 页  +%d (累计 %d)", p, total, new, len(all_vods))
        time.sleep(random.uniform(0.4, 1.0))
    return all_vods


def enrich_one(s: creq.Session, vod: dict) -> dict:
    try:
        html = request_get(s, vod["detail_url"])
        meta = parse_detail_meta(html)
        vod.update({k: v for k, v in meta.items() if v})
        eps = extract_play_links(html)
        resolved = []
        for ep in eps:
            try:
                mp4, stype = fetch_mp4_url(s, ep["play_url"])
                ep["mp4_url"] = mp4
                ep["source_type"] = stype
            except Exception as e:
                log.warning("    集数解析失败 %s: %s", ep.get("ep_name"), e)
                ep["mp4_url"] = ""
                ep["source_type"] = "error"
            resolved.append(ep)
            time.sleep(random.uniform(0.2, 0.5))
        vod["episodes"] = resolved
        log.info("  ✓ 《%s》— %d 集", vod.get("title", ""), len(resolved))
    except Exception as e:
        log.error("  ✗ 《%s》详情失败：%s", vod.get("title"), e)
        vod["episodes"] = []
    return vod


# ============================================================
# 持久化
# ============================================================
def load_meta() -> dict:
    if META_FILE.exists():
        try:
            return json.loads(META_FILE.read_text(encoding="utf-8"))
        except Exception:
            pass
    return {"site": BASE_URL, "vods": []}


def save_meta(meta: dict):
    tmp = META_FILE.with_suffix(".tmp")
    tmp.write_text(json.dumps(meta, ensure_ascii=False, indent=2), encoding="utf-8")
    tmp.replace(META_FILE)


# ============================================================
# 下载
# ============================================================
INVALID_RE = re.compile(r'[\\/:*?"<>|\r\n\t]+')

def safe_name(s: str) -> str:
    return INVALID_RE.sub("_", s).strip(". ")[:180]


def download_file(s: creq.Session, url: str, path: Path, chunk=1024 * 1024) -> bool:
    headers = {"Referer": BASE_URL + "/", "User-Agent": DEFAULT_HEADERS["User-Agent"]}
    existing = path.stat().st_size if path.exists() else 0

    # 先拿总大小
    total_size = None
    try:
        hr = s.head(url, impersonate=BROWSER, headers=headers, timeout=15)
        if hr.status_code < 400:
            cl = int(hr.headers.get("Content-Length", "0") or 0)
            if cl:
                total_size = cl
    except Exception:
        pass

    if total_size and existing >= total_size:
        log.info("    已存在：%s（%.1f MB）", path.name, existing / 1048576)
        return True

    req_headers = dict(headers)
    mode = "wb"
    resume_from = 0
    if existing > 0:
        req_headers["Range"] = f"bytes={existing}-"
        mode = "ab"
        resume_from = existing

    for attempt in range(3):
        try:
            r = s.get(url, impersonate=BROWSER, headers=req_headers, stream=True, timeout=120)
            if resume_from and r.status_code == 416:
                return True
            if r.status_code >= 400:
                raise IOError(f"HTTP {r.status_code}")
            if r.status_code == 200 and resume_from > 0:
                # 服务器不支持Range，从头下
                mode = "wb"
                resume_from = 0
                existing = 0
            cl = int(r.headers.get("Content-Length", "0") or 0)
            total = existing + cl if cl else total_size
            try:
                f = open(path, mode)
                try:
                    done = existing
                    last_pct = -1
                    for chunk_b in r.iter_content(chunk_size=chunk):
                        if chunk_b:
                            f.write(chunk_b)
                            done += len(chunk_b)
                            if total:
                                pct = int(done * 100 / total)
                                if pct != last_pct and pct % 2 == 0:
                                    print(f"\r    {path.name} {pct}% ({done/1048576:.1f}/{total/1048576:.1f} MB)",
                                          end="", flush=True)
                                    last_pct = pct
                finally:
                    f.close()
            finally:
                r.close()
            print()
            return True
        except Exception as e:
            log.warning("    下载失败(%d) %s: %s", attempt + 1, path.name, e)
            existing = path.stat().st_size if path.exists() else 0
            mode = "ab"
            resume_from = existing
            req_headers["Range"] = f"bytes={existing}-"
            time.sleep(2)
    return False


def download_all(s: creq.Session, meta: dict, max_vods=None):
    vods = meta["vods"][:max_vods] if max_vods else meta["vods"]
    for idx, vod in enumerate(vods, 1):
        title = safe_name(vod.get("title", f"unknown_{idx}"))
        cat = safe_name(vod.get("category", "未分类"))
        out_dir = DOWNLOAD_DIR / cat / title
        out_dir.mkdir(parents=True, exist_ok=True)
        log.info("[%d/%d] 《%s》%d 集", idx, len(vods), vod.get("title"), len(vod.get("episodes", [])))
        for ep in vod.get("episodes", []):
            mp4 = ep.get("mp4_url", "")
            if not mp4:
                continue
            name = safe_name(f"{ep['ep_name']}.mp4")
            download_file(s, mp4, out_dir / name)
            time.sleep(0.3)


# ============================================================
# M3U 导出
# ============================================================
def export_m3u(meta: dict) -> Path:
    out = OUTPUT_DIR / "libvio_all.m3u"
    lines = ["#EXTM3U"]
    cnt = 0
    for vod in meta["vods"]:
        for ep in vod.get("episodes", []):
            u = ep.get("mp4_url", "")
            if not u:
                continue
            lines.append(f'#EXTINF:-1 group-title="{vod.get("category","")}", {vod.get("title","")} - {ep.get("ep_name","")}')
            lines.append(u)
            cnt += 1
    out.write_text("\n".join(lines), encoding="utf-8")
    log.info("已导出 M3U：%s（%d 条）", out, cnt)
    return out


# ============================================================
# 搜索
# ============================================================
def search(s: creq.Session, kw: str, page: int = 1) -> list[dict]:
    url = f"{BASE_URL}/search/-------------.html"
    html = request_get(s, url, params={"wd": kw, "page": page})
    return parse_list_page(html)


# ============================================================
# main
# ============================================================
def main():
    p = argparse.ArgumentParser(description="LIBVIO 全站抓取（含CDN PoW完美逆向）")
    p.add_argument("--crawl-meta", action="store_true", help="抓取全站元数据+MP4直链")
    p.add_argument("--download", action="store_true", help="下载视频文件（建议先 --crawl-meta）")
    p.add_argument("--export-m3u", action="store_true", help="导出 M3U 播放列表")
    p.add_argument("--types", nargs="+", type=int, help=f"分类ID，默认全部：{[c[0] for c in CATEGORIES]}")
    p.add_argument("--max-pages", type=int, help="每个分类最大页数（测试用）")
    p.add_argument("--max-vods", type=int, help="最多下载多少部影视")
    p.add_argument("--search", type=str, help="关键词搜索")
    args = p.parse_args()

    log.info("初始化会话（自动求解 CDN PoW）…")
    s = make_session()

    if args.search:
        log.info("搜索：%s", args.search)
        for r in search(s, args.search):
            print(f"  [{r.get('note','')}] {r['title']}  {r['detail_url']}")
        return

    if not (args.crawl_meta or args.download or args.export_m3u):
        p.print_help()
        print("\n提示：至少指定 --crawl-meta / --download / --export-m3u 中的一个。")
        return

    meta = load_meta()

    if args.crawl_meta:
        cats = CATEGORIES
        if args.types:
            cats = [c for c in CATEGORIES if c[0] in args.types]
        existing_urls = {v["detail_url"] for v in meta.get("vods", [])}
        for tid, tname in cats:
            cat_vods = crawl_category(s, tid, tname, max_pages=args.max_pages)
            new = [v for v in cat_vods if v["detail_url"] not in existing_urls]
            log.info("分类 %s 新影视 %d 部，开始解析详情…", tname, len(new))
            for i, vod in enumerate(new, 1):
                log.info("[%d/%d] %s", i, len(new), vod["title"])
                v = enrich_one(s, vod)
                meta.setdefault("vods", []).append(v)
                existing_urls.add(v["detail_url"])
                save_meta(meta)
                time.sleep(random.uniform(0.3, 0.7))
        log.info("✅ 元数据抓取完成，共 %d 部 → %s", len(meta["vods"]), META_FILE)

    if args.download:
        if not meta.get("vods"):
            log.error("元数据为空，请先 --crawl-meta")
            sys.exit(1)
        download_all(s, meta, max_vods=args.max_vods)
        log.info("✅ 下载完成 → %s", DOWNLOAD_DIR)

    if args.export_m3u:
        if not meta.get("vods"):
            log.error("元数据为空，请先 --crawl-meta")
            sys.exit(1)
        export_m3u(meta)


if __name__ == "__main__":
    main()
