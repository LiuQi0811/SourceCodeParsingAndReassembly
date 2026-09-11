#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
AppleWalls (applewalls.com) 全站壁纸爬虫 —— 中文(zh)默认
=======================================================
【站点逆向分析结论】
  • 技术栈: Next.js 14 App Router (RSC 流式渲染) + Cloudflare CDN
  • 图片CDN: https://static.applewalls.com/   完全公开，无签名/鉴权/加密/防盗链
  • 数据位置: <script>self.__next_f.push(...)</script> 的 RSC payload 中直接内嵌
              JSON 片段（name/date/count/item[*]），无需JS执行、无加密解密
  • 图片字段:
      originPath  -> 原图 (png/jpg/mp4)  https://static.applewalls.com/{URL编码路径}
      compressPath-> 预览 (webp/jpg)     同上
  • 额外字段: 部分集合（如Live动态壁纸）会带 "tag":"" 等附加字段，已兼容

【目录结构】
  applewalls_downloads/
    index.json              —— 全量元数据索引（含本地路径映射）
    failed_downloads.json   —— 失败清单（如有）
    {category}/
      {collection}/
        {name}.{ext}        —— 原图（png/jpg/mp4...）
        _preview/{name}.webp—— 预览图（--preview 时下载）

用法:
    python3 applewalls_crawler.py                   # 下载全部原图（默认zh）
    python3 applewalls_crawler.py --no-download     # 只生成索引，不下载
    python3 applewalls_crawler.py --compress-only   # 只下载预览图（省流量）
    python3 applewalls_crawler.py --preview         # 原图+预览都下载
    python3 applewalls_crawler.py -w 8 -o ./wp      # 8线程，自定义输出目录
    python3 applewalls_crawler.py -l en             # 英文站
"""

import argparse
import json
import os
import re
import sys
import time
import threading
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path
from urllib.parse import quote, urlparse

import requests

# ---------- 配置 ----------
BASE_URL = "https://www.applewalls.com"
STATIC_BASE = "https://static.applewalls.com/"
DEFAULT_LANG = "zh"
DEFAULT_OUTPUT = "./applewalls_downloads"

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
        "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    ),
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
    "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
}


def make_session():
    s = requests.Session()
    s.headers.update(HEADERS)
    return s


# ---------- 工具函数 ----------
def req_get(session, url, retries=3, delay=1.2, stream=False, timeout=30, extra_headers=None):
    last_err = None
    hdrs = {}
    if extra_headers:
        hdrs.update(extra_headers)
    for i in range(retries):
        try:
            r = session.get(url, headers=hdrs, timeout=timeout, stream=stream, allow_redirects=True)
            if r.status_code == 429:
                time.sleep(delay * (i + 2))
                continue
            if r.status_code >= 500:
                time.sleep(delay * (i + 1))
                continue
            r.raise_for_status()
            return r
        except Exception as e:
            last_err = e
            time.sleep(delay * (i + 1))
    raise last_err


def extract_rsc_strings(html: str) -> str:
    out = []
    for m in re.finditer(r"<script>self\.__next_f\.push\((.*?)\)</script>", html, re.DOTALL):
        try:
            data = json.loads(m.group(1))
        except json.JSONDecodeError:
            continue

        def walk(o):
            if isinstance(o, str):
                out.append(o)
            elif isinstance(o, list):
                for it in o:
                    walk(it)
            elif isinstance(o, dict):
                for v in o.values():
                    walk(v)

        walk(data)
    return "".join(out)


_SAFE_RE = re.compile(r'[\\/:*?"<>|]')


def safe_name(name: str) -> str:
    return _SAFE_RE.sub("_", name).strip().strip(".")[:180]


# ---------- 正则（兼容可选字段） ----------
ITEM_RE = re.compile(
    r'\{"name":"(?P<name>[^"]+)","type":"(?P<type>[^"]+)","size":"(?P<size>[^"]+)",'
    r'"originPath":"(?P<originPath>[^"]+)","compressPath":"(?P<compressPath>[^"]+)"'
    r'(?:,"[^"]+":"[^"]*")*\}'  # 兼容 tag 等未来可能新增的额外字段
)
COLL_RE = re.compile(r'"name":"(?P<name>[^"]+)","date":"(?P<date>[^"]*)",(?:"count":\d+,)?"item":\[')


# ---------- 站点结构发现 ----------
def fetch_category_urls(session, lang: str):
    r = req_get(session, BASE_URL + "/sitemap.xml")
    locs = re.findall(r"<loc>(.*?)</loc>", r.text)
    prefix = f"{BASE_URL}/{lang}"
    cats = []
    for u in locs:
        if not u.startswith(prefix):
            continue
        if u == prefix or u.endswith("-wallpapers"):
            cats.append(u)
    home = f"{BASE_URL}/{lang}"
    if home not in cats:
        cats.insert(0, home)
    return sorted(set(cats))


def discover_detail_urls(session, category_urls, lang: str):
    detail = set()
    pattern = re.compile(
        r'(?:href=|")(/' + re.escape(lang) +
        r"/wallpapers/[a-zA-Z0-9\-（）\(\)\.]+/[a-zA-Z0-9\-（）\(\)\.]+)\"?"
    )
    for i, c in enumerate(category_urls, 1):
        try:
            r = req_get(session, c, timeout=20)
            for m in pattern.finditer(r.text):
                href = m.group(1).split("#")[0].split("?")[0]
                parts = [p for p in href.split("/") if p]
                if len(parts) >= 4 and len(parts[-1]) >= 2:
                    detail.add(BASE_URL + href)
            if i % 3 == 0 or i == len(category_urls):
                print(f"    扫描聚合页 {i}/{len(category_urls)}，已发现详情页 {len(detail)}", flush=True)
            time.sleep(0.15)
        except Exception as e:
            print(f"    ! 聚合页失败 {c}: {e}")
    return sorted(detail)


def parse_detail_page(session, url: str, lang: str):
    r = req_get(session, url, timeout=30)
    html = r.text
    rsc = extract_rsc_strings(html)

    path = urlparse(url).path
    parts = [p for p in path.split("/") if p]
    category = parts[2] if len(parts) > 2 else "misc"
    slug = parts[3] if len(parts) > 3 else "unknown"

    items = []
    for m in ITEM_RE.finditer(rsc):
        op = m.group("originPath")
        cp = m.group("compressPath")
        items.append({
            "name": m.group("name"),
            "type": m.group("type"),
            "size": m.group("size"),
            "originPath": op,
            "compressPath": cp,
            "origin_url": STATIC_BASE + quote(op, safe="/%"),
            "compress_url": STATIC_BASE + quote(cp, safe="/%"),
        })

    # 优先取 deviceData 块里的名称（最干净）
    cm2 = re.search(r'deviceData":\{"name":"([^"]+)","date":"([^"]*)"', rsc)
    if cm2:
        coll_name, date_str = cm2.group(1), cm2.group(2)
    else:
        cm = COLL_RE.search(rsc)
        coll_name = cm.group("name") if cm else slug.replace("-", " ").title()
        date_str = cm.group("date") if cm else ""

    dm = re.search(r'<meta\s+name="description"\s+content="([^"]+)"', html)
    desc = dm.group(1) if dm else ""

    return {
        "page_url": url, "lang": lang, "category": category, "slug": slug,
        "collection": coll_name, "date": date_str, "description": desc,
        "items": items,
    }


def parse_size_mb(s: str) -> float:
    s = s.strip()
    try:
        if "GB" in s:
            return float(s.replace("GB", "")) * 1024
        if "MB" in s:
            return float(s.replace("MB", ""))
        if "KB" in s:
            return float(s.replace("KB", "")) / 1024
    except Exception:
        pass
    return 0


# ---------- 下载 ----------
def download_one(session, url: str, save_path: Path, skip_existing: bool = True):
    save_path.parent.mkdir(parents=True, exist_ok=True)
    if skip_existing and save_path.exists() and save_path.stat().st_size > 2048:
        # 小文件(图标等)也可能小于2K，所以再走HEAD确认
        try:
            head = session.head(url, timeout=15, allow_redirects=True)
            rs = int(head.headers.get("content-length", 0))
            if rs and save_path.stat().st_size == rs:
                return "skipped"
            if not rs and save_path.stat().st_size > 0:
                return "skipped"
        except Exception:
            if save_path.stat().st_size > 2048:
                return "skipped"

    tmp = save_path.with_suffix(save_path.suffix + ".part")
    downloaded = tmp.stat().st_size if tmp.exists() else 0
    for attempt in range(4):
        try:
            hdrs = {}
            if downloaded > 0:
                hdrs["Range"] = f"bytes={downloaded}-"
            r = session.get(url, headers=hdrs, timeout=180, stream=True, allow_redirects=True)
            if r.status_code == 416:
                tmp.rename(save_path)
                return "skipped"
            if r.status_code in (403, 404):
                return f"failed:{r.status_code}"
            r.raise_for_status()
            mode = "ab" if downloaded > 0 and r.status_code == 206 else "wb"
            with open(tmp, mode) as f:
                for chunk in r.iter_content(chunk_size=1024 * 256):
                    if chunk:
                        f.write(chunk)
            tmp.rename(save_path)
            return "ok"
        except Exception as e:
            downloaded = tmp.stat().st_size if tmp.exists() else 0
            time.sleep(1.5 * (attempt + 1))
            last_err = e
    return f"failed:{last_err}"


# ---------- 主流程 ----------
def main():
    ap = argparse.ArgumentParser(description="AppleWalls 全站壁纸爬虫")
    ap.add_argument("--output", "-o", default=DEFAULT_OUTPUT, help="下载目录")
    ap.add_argument("--workers", "-w", type=int, default=6, help="并发下载线程数（默认 6）")
    ap.add_argument("--lang", "-l", default=DEFAULT_LANG, help="语言 zh/en/ja/vi/zh-hant（默认 zh）")
    ap.add_argument("--no-download", action="store_true", help="只生成索引不下载")
    ap.add_argument("--preview", action="store_true", help="同时下载预览图")
    ap.add_argument("--compress-only", action="store_true", help="只下载预览图")
    ap.add_argument("--resume", action="store_true", help="跳过元数据抓取，直接使用已有 index.json 继续下载")
    args = ap.parse_args()

    out_dir = Path(args.output).resolve()
    out_dir.mkdir(parents=True, exist_ok=True)
    index_path = out_dir / "index.json"

    print("=" * 64)
    print(" AppleWalls 全站壁纸爬虫")
    print(f"  语言: {args.lang}    输出: {out_dir}    线程: {args.workers}")
    if args.no_download:
        print("  模式: 仅抓取元数据索引")
    elif args.compress_only:
        print("  模式: 仅下载预览图（体积小）")
    else:
        print(f"  模式: 下载原图{' + 预览图' if args.preview else ''}")
    print("=" * 64)

    # ---------- 元数据阶段 ----------
    if args.resume and index_path.exists():
        print("\n[resume] 读取已有 index.json ...")
        with open(index_path, "r", encoding="utf-8") as f:
            index = json.load(f)
        collections = index["collections"]
        print(f"  共 {len(collections)} 个集合, {index['totals']['items']} 张资源")
    else:
        session = make_session()

        print("\n[1/4] 读取 sitemap 聚合页 ...")
        cats = fetch_category_urls(session, args.lang)
        for c in cats:
            print("  -", c)
        print(f"  共 {len(cats)} 个聚合页")

        print("\n[2/4] 扫描详情页 ...")
        details = discover_detail_urls(session, cats, args.lang)
        print(f"  共 {len(details)} 个详情页")

        print("\n[3/4] 解析详情页元数据（多线程）...")
        collections = []
        failed_pages = []
        t0 = time.time()
        lock = threading.Lock()
        done_count = [0]

        def _parse(u):
            s = make_session()
            return parse_detail_page(s, u, args.lang)

        with ThreadPoolExecutor(max_workers=4) as ex:
            futs = {ex.submit(_parse, d): d for d in details}
            for fut in as_completed(futs):
                d = futs[fut]
                with lock:
                    done_count[0] += 1
                    i = done_count[0]
                try:
                    info = fut.result()
                    with lock:
                        collections.append(info)
                    if i % 30 == 0 or i == len(details):
                        tot = sum(len(c["items"]) for c in collections)
                        el = time.time() - t0
                        print(f"    [{i}/{len(details)}] 用时 {el:.0f}s, 已解析 {tot} 个资源", flush=True)
                except Exception as e:
                    with lock:
                        failed_pages.append({"url": d, "error": str(e)})
                    print(f"    ! 解析失败 {d}: {e}")

        collections.sort(key=lambda x: x["page_url"])
        total_items = sum(len(c["items"]) for c in collections)
        total_mb = sum(parse_size_mb(it["size"]) for c in collections for it in c["items"])
        print(f"\n  解析完成: {len(collections)} 个集合, {total_items} 张资源, 失败 {len(failed_pages)} 页")
        print(f"  总大小约: {total_mb:.0f} MB ({total_mb/1024:.2f} GB)")

        index = {
            "site": BASE_URL, "lang": args.lang,
            "generated_at": time.strftime("%Y-%m-%d %H:%M:%S"),
            "totals": {
                "collections": len(collections), "items": total_items,
                "approx_size_mb": round(total_mb, 1),
            },
            "collections": collections, "failed_pages": failed_pages,
        }
        with open(index_path, "w", encoding="utf-8") as f:
            json.dump(index, f, ensure_ascii=False, indent=2)
        print(f"  索引已保存: {index_path}")

    if args.no_download:
        print("\n[跳过下载] 仅元数据抓取完成。")
        return

    # ---------- 下载阶段 ----------
    print(f"\n[4/4] 开始下载（{args.workers} 线程）...")
    tasks = []
    for col in collections:
        folder = out_dir / col["category"] / safe_name(col["collection"])
        for item in col["items"]:
            targets = []
            if args.compress_only:
                targets.append(("compress", item["compress_url"]))
            else:
                targets.append(("origin", item["origin_url"]))
                if args.preview:
                    targets.append(("compress", item["compress_url"]))
            for kind, url in targets:
                remote_name = url.rsplit("/", 1)[-1]
                ext = os.path.splitext(remote_name)[1] or ".bin"
                sub = folder if kind == "origin" else folder / "_preview"
                fn = safe_name(item["name"]) + ext
                tasks.append({
                    "collection": col["collection"],
                    "item_name": item["name"],
                    "kind": kind,
                    "url": url,
                    "save_path": sub / fn,
                })

    print(f"  总任务数: {len(tasks)}")

    tlocal = threading.local()

    def get_sess():
        if not hasattr(tlocal, "s"):
            tlocal.s = make_session()
        return tlocal.s

    ok = skipped = failed = 0
    done = 0
    failed_list = []
    lock = threading.Lock()

    def run(t):
        try:
            st = download_one(get_sess(), t["url"], t["save_path"])
        except Exception as e:
            st = f"failed:{e}"
        return t, st

    t0 = time.time()
    with ThreadPoolExecutor(max_workers=args.workers) as ex:
        futures = [ex.submit(run, t) for t in tasks]
        for fut in as_completed(futures):
            t, st = fut.result()
            with lock:
                done += 1
                if st == "ok":
                    ok += 1
                elif st == "skipped":
                    skipped += 1
                else:
                    failed += 1
                    failed_list.append({"url": t["url"], "path": str(t["save_path"]), "status": st})
            if done % 30 == 0 or done == len(tasks):
                el = time.time() - t0
                speed = (ok + skipped) / el if el > 0 else 0
                eta = (len(tasks) - done) / speed if speed > 0 else 0
                print(f"    进度 {done:>4}/{len(tasks)}  "
                      f"新下载={ok}  跳过={skipped}  失败={failed}  "
                      f"已用{el:.0f}s ETA{eta:.0f}s")

    if failed_list:
        with open(out_dir / "failed_downloads.json", "w", encoding="utf-8") as f:
            json.dump(failed_list, f, ensure_ascii=False, indent=2)
        print(f"  失败清单: {out_dir/'failed_downloads.json'}")

    # 回写本地路径到索引
    path_map = {}
    for t in tasks:
        try:
            path_map[t["url"]] = str(t["save_path"].relative_to(out_dir))
        except Exception:
            path_map[t["url"]] = str(t["save_path"])
    for col in collections:
        for item in col["items"]:
            if item["origin_url"] in path_map:
                item["local_origin"] = path_map[item["origin_url"]]
            if item["compress_url"] in path_map:
                item["local_compress"] = path_map[item["compress_url"]]
    index["collections"] = collections
    index["totals"]["collections"] = len(collections)
    with open(index_path, "w", encoding="utf-8") as f:
        json.dump(index, f, ensure_ascii=False, indent=2)

    total_size = 0
    for t in tasks:
        p = t["save_path"]
        if p.exists():
            total_size += p.stat().st_size

    print("\n" + "=" * 64)
    print("✅ 全部完成！")
    print(f"  目录  : {out_dir}")
    print(f"  索引  : {index_path}")
    print(f"  新下载: {ok}    已存在跳过: {skipped}    失败: {failed}")
    print(f"  总大小: {total_size/1024/1024:.1f} MB ({total_size/1024/1024/1024:.2f} GB)")
    print("=" * 64)


if __name__ == "__main__":
    main()
