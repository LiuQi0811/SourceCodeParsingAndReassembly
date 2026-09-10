#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
播剧网 (ysxq.cc) 全站爬虫  v3 (完美逆向版)
=============================================
【关键逆向结论】
  1. 列表数据: AJAX POST /index.php/ds_api/vod 返回JSON(无需渲染JS)
     请求体 data-type/data-class/.../page 参数全部从 #dataList 的data-*读取
  2. 视频直链: 播放页 /vodplay/{vid}-{sid}-{nid}.html 内嵌
       episodeDataBase64 = "<base64>"
     解码即得整源全集 {name, url(m3u8直链), index} 数组
     且页面 mac_player_info.url 与 iframe src 中均直接暴露m3u8
  3. 无需破解加密、无需JS渲染、无需登录/signature,所有数据直出
  4. sid=1(第一个播放源)通常可直接播放,全集一次请求全拿(无需逐集访问)

【输出】
  data/videos.json    所有影片元数据(含每集m3u8直链)
  data/index.html     可离线浏览的索引页(带搜索/分类过滤)
  data/covers/*       封面图
  data/pages/*.html   播放页HTML备份(选)

【用法】
  python crawler.py                           # 全量抓取所有影片元数据+m3u8
  python crawler.py --download                # 同时下载视频为mp4(需ffmpeg,默认限50集)
  python crawler.py --max-pages 2             # 每个分类只抓2页(测试)
  python crawler.py --categories 1,2          # 只抓电影+连续剧
  python crawler.py --list-only               # 仅抓列表,不解析m3u8(最快)
  python crawler.py --workers 10              # 10线程并发
  python crawler.py --limit 100               # 仅前100部
"""

import argparse
import base64
import json
import os
import random
import re
import subprocess
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from urllib.parse import unquote, urljoin

import requests
from tqdm import tqdm

BASE_URL = "https://ysxq.cc"
API_URL = BASE_URL + "/index.php/ds_api/vod"
HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
                  "(KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
    "Accept": "application/json, text/javascript, */*; q=0.01",
    "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
    "X-Requested-With": "XMLHttpRequest",
    "Referer": BASE_URL + "/",
}
SESSION = requests.Session()
SESSION.headers.update(HEADERS)

CATEGORIES = {
    1:  "电影",
    2:  "连续剧",
    3:  "综艺",
    4:  "动漫",
    45: "体育赛事",
    60: "短剧",
}

OUT_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "data")
COVERS_DIR = os.path.join(OUT_DIR, "covers")
VIDEOS_DIR = os.path.join(OUT_DIR, "videos")
os.makedirs(COVERS_DIR, exist_ok=True)


def retry_post(url, data, retries=3, sleep=0.8):
    for i in range(retries):
        try:
            r = SESSION.post(url, data=data, timeout=20)
            if r.status_code == 200:
                return r.json()
        except Exception as e:
            if i == retries - 1:
                return None
        time.sleep(sleep * (i + 1))
    return None


def retry_get(url, retries=3, sleep=0.8, **kw):
    for i in range(retries):
        try:
            r = SESSION.get(url, timeout=20, **kw)
            if r.status_code == 200:
                r.encoding = r.apparent_encoding or "utf-8"
                return r
        except Exception:
            if i == retries - 1:
                return None
        time.sleep(sleep * (i + 1))
    return None


# ---------------------------------------------------------------------------
# 列表 API
# ---------------------------------------------------------------------------
def fetch_list_page(type_id, page):
    data = {
        "type": str(type_id), "class": "", "area": "", "year": "",
        "lang": "", "version": "", "state": "", "letter": "",
        "time": "", "level": "0", "weekday": "", "by": "", "page": str(page),
    }
    j = retry_post(API_URL, data)
    if not j or j.get("code") != 1:
        return [], 0, 0
    return j.get("list", []), j.get("pagecount", 0), j.get("total", 0)


def fetch_category(type_id, type_name, max_pages):
    first, pagecount, total = fetch_list_page(type_id, 1)
    print(f"  [{type_name}] 总{total}部 / {pagecount}页, 第1页 {len(first)} 部")
    items = list(first)
    pages_to = pagecount if max_pages == 0 else min(pagecount, max_pages)
    if pages_to <= 1:
        return items

    def worker(pg):
        time.sleep(random.uniform(0.02, 0.2))
        lst, _, _ = fetch_list_page(type_id, pg)
        return lst or []

    with ThreadPoolExecutor(max_workers=8) as ex:
        futs = [ex.submit(worker, p) for p in range(2, pages_to + 1)]
        for fut in tqdm(as_completed(futs), total=len(futs), desc=f"  {type_name}分页"):
            try:
                items.extend(fut.result())
            except Exception as e:
                print(f"    [ERR] {e}")
    uniq = {}
    for it in items:
        vid = it.get("vod_id")
        if vid and vid not in uniq:
            uniq[vid] = it
    result = list(uniq.values())
    print(f"  [{type_name}] 去重后 {len(result)} 部")
    return result


# ---------------------------------------------------------------------------
# 播放页: 直接从 episodeDataBase64 拿到全集m3u8
# ---------------------------------------------------------------------------
def fetch_episodes_with_m3u8(vid, sid=1):
    """访问第一集播放页,从base64解析出整源所有集的{m3u8,name}"""
    url = f"{BASE_URL}/vodplay/{vid}-{sid}-1.html"
    r = retry_get(url)
    if not r:
        return None, []
    html = r.text
    # 部分页面中JS变量被包含在转义字符串里(引号为 \\"),先反转义
    html_unescaped = html.replace('\\"', '"')
    episodes = []
    bm = re.search(r'episodeDataBase64\s*=\s*"([A-Za-z0-9+/=]+)"', html_unescaped)
    if bm:
        try:
            data = json.loads(base64.b64decode(bm.group(1)).decode("utf-8"))
            for e in data:
                episodes.append({
                    "name": e.get("name", ""),
                    "m3u8": e.get("url", ""),
                    "index": e.get("index", 0),
                    "page": f"{BASE_URL}/vodplay/{vid}-{sid}-{e.get('index', 0)+1}.html",
                })
            return url, episodes
        except Exception:
            pass
    # 兜底:从 mac_player_info 拿单集
    pm = re.search(r'mac_player_info\s*=\s*(\{[^;]+\})', html_unescaped)
    if pm:
        try:
            info = json.loads(pm.group(1))
            m = info.get("url", "")
            if m:
                episodes.append({
                    "name": "HD", "m3u8": m, "index": 0, "page": url,
                })
                return url, episodes
        except Exception:
            pass
    im = re.search(r'<iframe[^>]+src="([^"]+)"', html_unescaped)
    if im:
        qm = re.search(r'[?&]url=([^&]+)', im.group(1))
        if qm:
            episodes.append({"name": "HD", "m3u8": unquote(qm.group(1)),
                             "index": 0, "page": url})
    return url, episodes


def enrich_video(v):
    """给一部视频补充m3u8地址(从播放页base64一次取全)"""
    vid = v["id"]
    play_page, eps = fetch_episodes_with_m3u8(vid, sid=1)
    if not eps:
        # 若sid=1失败,试sid=2
        play_page, eps = fetch_episodes_with_m3u8(vid, sid=2)
    v["play_page"] = play_page or f"{BASE_URL}/vodplay/{vid}-1-1.html"
    v["episodes"] = eps
    v["episode_count"] = len(eps)
    v["has_m3u8"] = sum(1 for e in eps if e.get("m3u8"))
    return v


# ---------------------------------------------------------------------------
# ffmpeg 下载
# ---------------------------------------------------------------------------
def download_m3u8(m3u8_url, out_path):
    subprocess.run([
        "ffmpeg", "-y", "-loglevel", "error",
        "-headers", f"Referer: {BASE_URL}/\r\nUser-Agent: {HEADERS['User-Agent']}\r\n",
        "-i", m3u8_url, "-c", "copy", out_path,
    ], check=False)


def sanitize(name):
    return re.sub(r'[\\/:*?"<>|]', "_", (name or "")).strip()[:80]


# ---------------------------------------------------------------------------
# 主流程
# ---------------------------------------------------------------------------
def main():
    ap = argparse.ArgumentParser(description="ysxq.cc 全站爬虫 v3")
    ap.add_argument("--max-pages", type=int, default=0, help="每个分类最多页数(0=全部)")
    ap.add_argument("--categories", type=str, default="", help="指定分类id,逗号分隔")
    ap.add_argument("--download", action="store_true", help="下载视频mp4(需ffmpeg)")
    ap.add_argument("--workers", type=int, default=10, help="并发线程数")
    ap.add_argument("--list-only", action="store_true", help="仅抓列表,不解析m3u8")
    ap.add_argument("--limit", type=int, default=0, help="仅抓前N部")
    ap.add_argument("--no-cover", action="store_true", help="不下载封面")
    args = ap.parse_args()

    cats = CATEGORIES
    if args.categories:
        sel = [int(x) for x in args.categories.split(",") if x.strip().isdigit()]
        cats = {k: v for k, v in CATEGORIES.items() if k in sel}

    print("=" * 64)
    print(" 播剧网 ysxq.cc 全站爬虫 v3 (AJAX API+Base64解码,零加密)")
    print(f" 输出: {OUT_DIR}")
    print(f" 分类: {cats}")
    print(f" 模式: {'仅列表' if args.list_only else '完整抓取(含m3u8直链)'}")
    print("=" * 64)

    # Step 1: 抓列表
    all_videos = {}
    for cid, cname in cats.items():
        print(f"\n[1/3] 抓取分类: {cname} (id={cid})")
        items = fetch_category(cid, cname, args.max_pages)
        for it in items:
            vid = it.get("vod_id")
            if not vid:
                continue
            if vid in all_videos:
                continue
            score = it.get("vod_douban_score") or it.get("vod_score") or ""
            try:
                score_num = float(score) if score and float(score) > 0 else ""
            except Exception:
                score_num = ""
            all_videos[vid] = {
                "id": vid,
                "title": it.get("vod_name", ""),
                "cover": it.get("vod_pic", ""),
                "score": score_num if score_num != "" else score,
                "remarks": it.get("vod_remarks", ""),
                "actor": (it.get("vod_actor") or "")[:200],
                "director": it.get("vod_director", ""),
                "blurb": it.get("vod_blurb", ""),
                "detail_url": urljoin(BASE_URL, it.get("url", "")),
                "category_id": cid,
                "category_name": cname,
                "episodes": [],
            }
        time.sleep(0.3)

    videos = list(all_videos.values())
    print(f"\n[1/3] 完成,共 {len(videos)} 部(已去重)")
    if args.limit:
        videos = videos[: args.limit]
        print(f"  [测试] 截断为前 {args.limit} 部")

    # Step 2: 并发解析m3u8(直接访问播放页拿base64)
    if not args.list_only:
        print(f"\n[2/3] 解析m3u8直链 (并发={args.workers})")
        result = []
        with ThreadPoolExecutor(max_workers=args.workers) as ex:
            futs = {ex.submit(enrich_video, v): v for v in videos}
            for fut in tqdm(as_completed(futs), total=len(futs), desc="m3u8解析"):
                try:
                    result.append(fut.result())
                except Exception as e:
                    v = futs[fut]
                    print(f"  [ERR] {v.get('id')} {v.get('title','')}: {e}")
                    result.append(v)
        videos = result

        # 下载封面
        if not args.no_cover:
            print(f"\n[附加] 下载封面图...")
            def dl_cov(v):
                url = v.get("cover", "")
                if not url:
                    return
                ext = os.path.splitext(url.split("?")[0])[-1].lower()
                if ext not in (".jpg", ".jpeg", ".png", ".webp"):
                    ext = ".jpg"
                p = os.path.join(COVERS_DIR, f"{v['id']}{ext}")
                if os.path.exists(p):
                    return
                try:
                    rr = requests.get(url, headers={"User-Agent": HEADERS["User-Agent"],
                                                    "Referer": BASE_URL}, timeout=15)
                    if rr.status_code == 200:
                        with open(p, "wb") as f:
                            f.write(rr.content)
                except Exception:
                    pass
            with ThreadPoolExecutor(max_workers=12) as ex:
                ex.map(dl_cov, videos)

        # 下载视频
        if args.download:
            os.makedirs(VIDEOS_DIR, exist_ok=True)
            print(f"\n[下载] 下载m3u8 -> {VIDEOS_DIR} (默认限50集)")
            cnt = 0
            for v in videos:
                for ep in v.get("episodes", []):
                    if not ep.get("m3u8"):
                        continue
                    out_mp4 = os.path.join(
                        VIDEOS_DIR,
                        f"{sanitize(v['title'])}_{sanitize(ep['name'])}.mp4")
                    if os.path.exists(out_mp4) and os.path.getsize(out_mp4) > 1024:
                        cnt += 1
                        continue
                    print(f"  ↓ {v['title']} - {ep['name']}")
                    download_m3u8(ep["m3u8"], out_mp4)
                    cnt += 1
                    if cnt >= 50:
                        print("  [提示] 已达默认上限50集"); break
                if cnt >= 50:
                    break
    else:
        print("\n[2/3] 跳过m3u8解析(--list-only)")

    # 保存JSON
    out_json = os.path.join(OUT_DIR, "videos.json")
    with open(out_json, "w", encoding="utf-8") as f:
        json.dump(videos, f, ensure_ascii=False, indent=2)

    # 生成索引页
    generate_index(videos)

    total_eps = sum(v.get("episode_count", 0) for v in videos)
    with_m3u8 = sum(v.get("has_m3u8", 0) for v in videos)
    print(f"\n{'='*64}")
    print(f"  影片总数   : {len(videos)}")
    print(f"  集数总数   : {total_eps}")
    print(f"  已解析m3u8 : {with_m3u8}")
    print(f"  元数据JSON : {out_json}")
    print(f"  离线索引   : {os.path.join(OUT_DIR, 'index.html')}")
    print(f"  封面目录   : {COVERS_DIR}/")
    if args.download:
        print(f"  视频目录   : {VIDEOS_DIR}/")
    print(f"{'='*64}")


# ---------------------------------------------------------------------------
# 索引页
# ---------------------------------------------------------------------------
def esc(s):
    if not s:
        return ""
    return str(s).replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;").replace('"', "&quot;")


def generate_index(videos):
    cat_stat = {}
    for v in videos:
        c = v.get("category_name", "其他")
        cat_stat[c] = cat_stat.get(c, 0) + 1
    items_html = []
    for v in videos:
        cover = v.get("cover", "")
        title = v.get("title", "")
        remarks = v.get("remarks", "")
        score = v.get("score", "")
        year = ""
        cat = v.get("category_name", "")
        vid = v.get("id", "")
        actor = v.get("actor", "")
        epc = v.get("episode_count", 0)
        hm = v.get("has_m3u8", 0)
        # 从remarks里提取年份
        m = re.search(r"(20\d{2}|19\d{2})", remarks)
        if m:
            year = m.group(1)
        score_html = f'<span class="score">{float(score):.1f}</span>' if isinstance(score, (int, float)) and score > 0 else ""
        eps_html = f'<span class="eps">{epc}集</span>' if epc > 1 else (f'<span class="eps">{remarks}</span>' if remarks else "")
        m3u8_html = f'<div class="m3u8">✓ {hm}集m3u8直链</div>' if hm else ''
        items_html.append(f'''
        <div class="card" data-cat="{esc(cat)}" data-title="{esc(title)}" data-actor="{esc(actor or '')}" data-remarks="{esc(remarks)}">
          <a href="{v.get('play_page', f'/vodplay/{vid}-1-1.html')}" target="_blank">
            <div class="cover">
              <img src="{cover}" loading="lazy" referrerpolicy="no-referrer" onerror="this.style.opacity=0.2">
              {score_html}{eps_html}
            </div>
            <div class="meta">
              <div class="title" title="{esc(title)}">{esc(title)}</div>
              <div class="sub">{esc(cat)} {year} {esc((actor or '')[:20])}</div>
              {m3u8_html}
            </div>
          </a>
        </div>''')

    btns = '<button class="cat-btn active" data-cat="">全部</button>'
    for cn in CATEGORIES.values():
        btns += f'<button class="cat-btn" data-cat="{cn}">{cn}({cat_stat.get(cn,0)})</button>'

    html = f"""<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<title>播剧网 离线镜像 - {len(videos)} 部影片</title>
<meta name="viewport" content="width=device-width, initial-scale=1">
<style>
*{{box-sizing:border-box;margin:0;padding:0}}
body{{background:#0f0f14;color:#eee;font-family:-apple-system,BlinkMacSystemFont,'PingFang SC','Microsoft YaHei',sans-serif;}}
header{{padding:18px 20px;background:linear-gradient(135deg,#1a1a2e,#16213e);position:sticky;top:0;z-index:10;box-shadow:0 2px 12px rgba(0,0,0,.4);}}
header h1{{font-size:22px;margin-bottom:10px;color:#ff6b6b;letter-spacing:1px;}}
.toolbar{{display:flex;gap:8px;flex-wrap:wrap;align-items:center;}}
input[type=text]{{flex:1;min-width:220px;padding:8px 14px;border-radius:20px;border:1px solid #333;background:#1a1a2e;color:#eee;outline:none;font-size:14px;}}
.cat-btn{{padding:6px 13px;border-radius:16px;border:1px solid #444;background:transparent;color:#ccc;cursor:pointer;font-size:13px;transition:.2s;}}
.cat-btn:hover,.cat-btn.active{{background:#ff6b6b;border-color:#ff6b6b;color:#fff;}}
.stats{{font-size:12px;color:#888;padding:6px 2px 0;}}
.grid{{padding:18px;display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:14px;max-width:1600px;margin:0 auto;}}
.card a{{color:inherit;text-decoration:none;display:block;}}
.cover{{position:relative;padding-top:140%;border-radius:8px;overflow:hidden;background:#222;}}
.cover img{{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;transition:transform .3s;}}
.card:hover .cover img{{transform:scale(1.06);}}
.score{{position:absolute;bottom:6px;left:6px;background:rgba(255,107,107,.9);color:#fff;font-size:11px;padding:2px 6px;border-radius:4px;font-weight:bold;}}
.eps{{position:absolute;bottom:6px;right:6px;background:rgba(0,0,0,.75);color:#fff;font-size:11px;padding:2px 6px;border-radius:4px;max-width:65%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}}
.meta{{padding:8px 2px;}}
.title{{font-size:14px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}}
.sub{{font-size:11px;color:#888;margin-top:4px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}}
.m3u8{{font-size:10px;color:#4ade80;margin-top:2px;}}
.empty{{text-align:center;padding:60px;color:#666;}}
.footer{{text-align:center;padding:20px;color:#555;font-size:12px;}}
</style>
</head>
<body>
<header>
  <h1>🎬 播剧网 (ysxq.cc) 离线镜像</h1>
  <div class="toolbar">
    <input type="text" id="search" placeholder="搜索影片名 / 演员 / 备注...">
    {btns}
  </div>
  <div class="stats" id="stats">共 {len(videos)} 部影片</div>
</header>
<div class="grid" id="grid">{''.join(items_html)}</div>
<div class="empty" id="empty" style="display:none">暂无匹配结果</div>
<div class="footer">crawler.py 生成 · 数据来源 ysxq.cc · 仅供学习研究使用</div>
<script>
const cards=document.querySelectorAll('.card'),stats=document.getElementById('stats'),empty=document.getElementById('empty');
let cat='',kw='';
function render(){{let n=0;cards.forEach(c=>{{
  const ok=(!cat||c.dataset.cat===cat)&&(!kw||c.dataset.title.includes(kw)||c.dataset.actor.includes(kw)||c.dataset.remarks.includes(kw));
  c.style.display=ok?'':'none';if(ok)n++;
}});stats.textContent='共 '+n+' 部'+(cat?' · '+cat:'')+(kw?' · 搜索:'+kw:'');empty.style.display=n===0?'':'none';}}
document.getElementById('search').oninput=e=>{{kw=e.target.value.trim();render();}};
document.querySelectorAll('.cat-btn').forEach(b=>b.onclick=()=>{{document.querySelectorAll('.cat-btn').forEach(x=>x.classList.remove('active'));b.classList.add('active');cat=b.dataset.cat;render();}});
</script>
</body>
</html>"""
    with open(os.path.join(OUT_DIR, "index.html"), "w", encoding="utf-8") as f:
        f.write(html)


if __name__ == "__main__":
    main()
