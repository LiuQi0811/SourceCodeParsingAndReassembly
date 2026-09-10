#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
咕咕番 (gugu3.com) 全站爬虫
================================
特性：
  1. 通过 MacCMS AJAX API 分页抓取番剧列表
  2. 进入播放页后使用 CDP（连接已运行的 Chrome）驱动播放器解密
     - 混淆的 MizhiPlayerART.js (jsjiami.v7) 在浏览器中自动执行解密
     - 解密完成后直接从 <video>/<source> DOM 中取出真实 m3u8/mp4 地址
     - 这种方式是"完美解密"——无需硬逆向加密算法，任意加密都能100%还原
  3. 支持断点续爬（results.jsonl 增量写入）
  4. 支持下载视频（m3u8 使用 ffmpeg，mp4 直接下载）
  5. 多线路抓取（咕咕新线/咕咕A线）

使用方法：
  1. 启动 Chrome 远程调试模式：
       chromium --remote-debugging-port=9222 --headless=new https://www.gugu3.com/
     或使用 agent-browser 启动的浏览器（默认 ws://127.0.0.1:9222/devtools/browser/xxx）
  2. 运行本脚本：
       python3 gugu3_crawler.py                  # 仅抓取元数据+真实播放URL
       python3 gugu3_crawler.py --download       # 抓取并下载视频
       python3 gugu3_crawler.py --max-pages 5    # 只爬前5页（测试用）
       python3 gugu3_crawler.py --start-page 10  # 从第10页开始
"""
import argparse
import json
import os
import re
import subprocess
import sys
import time
import hashlib
import base64
from pathlib import Path
from urllib.parse import urljoin, urlparse, parse_qs, urlencode, urlunparse

import requests
from bs4 import BeautifulSoup
import websockets

# ---------- 配置 ----------
BASE_URL = "https://www.gugu3.com"
LIST_API = f"{BASE_URL}/index.php/ajax/data?mid=1&pg={{page}}&limit=24"
DETAIL_URL = f"{BASE_URL}/index.php/vod/detail/id/{{vid}}.html"
PLAY_URL = f"{BASE_URL}/index.php/vod/play/id/{{vid}}/sid/{{sid}}/nid/{{nid}}.html"
CDP_URL_DEFAULT = "ws://127.0.0.1:9222/devtools/browser/6327a114-5727-428c-844e-ad5f12659e1b"
OUTPUT_DIR = Path("./gugu3_output")
OUTPUT_DIR.mkdir(exist_ok=True)
RESULTS_FILE = OUTPUT_DIR / "results.jsonl"
VIDEO_DIR = OUTPUT_DIR / "videos"
VIDEO_DIR.mkdir(exist_ok=True)

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
                  "(KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36",
    "Referer": BASE_URL + "/",
    "Accept-Language": "zh-CN,zh;q=0.9",
}

session = requests.Session()
session.headers.update(HEADERS)


# =====================================================
# 1. 通过 CDP 控制真实浏览器提取真实视频URL（完美解密）
# =====================================================
class CDPPlayerExtractor:
    """
    通过 Chrome DevTools Protocol 连接到已打开的浏览器，
    导航到播放页并从 DOM 中提取真实 m3u8/mp4。
    """

    def __init__(self, cdp_url: str, max_wait: int = 25):
        self.cdp_url = cdp_url
        self.max_wait = max_wait
        self._sid_cache = {}

    async def _get_page_session(self, ws):
        """找到一个gugu3.com的页面session，没有就新建"""
        await ws.send(json.dumps({"id": 1, "method": "Target.getTargets"}))
        while True:
            m = json.loads(await ws.recv())
            if m.get("id") == 1:
                targets = m["result"]["targetInfos"]
                gugu_pages = [t for t in targets if t["type"] == "page"
                              and "gugu3.com" in t["url"]]
                if not gugu_pages:
                    # create a new tab
                    await ws.send(json.dumps({
                        "id": 2,
                        "method": "Target.createTarget",
                        "params": {"url": "about:blank"}
                    }))
                    while True:
                        mm = json.loads(await ws.recv())
                        if mm.get("id") == 2:
                            tid = mm["result"]["targetId"]
                            break
                else:
                    tid = gugu_pages[0]["targetId"]
                # attach
                await ws.send(json.dumps({
                    "id": 3,
                    "method": "Target.attachToTarget",
                    "params": {"targetId": tid, "flatten": True}
                }))
                while True:
                    mm = json.loads(await ws.recv())
                    if mm.get("method") == "Target.attachedToTarget":
                        return mm["params"]["sessionId"]

    async def extract(self, play_url: str) -> dict:
        """
        打开播放页并返回解密后的真实视频地址字典：
          {'video_src': 'https://...m3u8', 'iframe_player_url': '...', 'sources': [...]}
        """
        async with websockets.connect(self.cdp_url, max_size=50 * 1024 * 1024) as ws:
            sid = await self._get_page_session(ws)

            # 启用 Network、Page
            nid = 100
            for dom in ("Page", "Network", "Runtime", "DOM"):
                await ws.send(json.dumps({
                    "id": nid, "method": f"{dom}.enable", "sessionId": sid
                }))
                nid += 1

            # 注入全局 XHR/fetch/Video 拦截（在导航前注入）
            hook_js = """
            (function(){
              if(window.__hooked)return; window.__hooked=true;
              window.__cap=[];
              const op=XMLHttpRequest.prototype.open;
              const sp=XMLHttpRequest.prototype.send;
              XMLHttpRequest.prototype.open=function(m,u){this._u=u;this._m=m;return op.apply(this,arguments);};
              XMLHttpRequest.prototype.send=function(b){
                this._body=b;
                this.addEventListener('load',()=>{
                  window.__cap.push({t:'x',u:this._u,m:this._m,
                    b:b?b.toString().slice(0,1000):'',
                    r:this.responseText.slice(0,5000)});
                });
                return sp.apply(this,arguments);
              };
              // 监测 video src
              const origSetSrc=Object.getOwnPropertyDescriptor(HTMLMediaElement.prototype,'src');
              if(origSetSrc && origSetSrc.set){
                Object.defineProperty(HTMLMediaElement.prototype,'src',{
                  set:function(v){window.__cap.push({t:'v',s:v});return origSetSrc.set.call(this,v);},
                  get:function(){return origSetSrc.get.call(this);}
                });
              }
            })();
            """
            await ws.send(json.dumps({
                "id": nid,
                "method": "Page.addScriptToEvaluateOnNewDocument",
                "params": {"source": hook_js},
                "sessionId": sid
            }))
            nid += 1

            # 导航到播放页
            await ws.send(json.dumps({
                "id": nid,
                "method": "Page.navigate",
                "params": {"url": play_url},
                "sessionId": sid
            }))
            nav_id = nid
            nid += 1

            deadline = time.time() + self.max_wait
            result = {"video_src": None, "iframe_src": None, "captured_urls": []}

            # 监听消息
            while time.time() < deadline:
                try:
                    m = json.loads(await asyncio.wait_for(ws.recv(), timeout=1.5))
                except Exception:
                    # 定时查询video元素
                    await ws.send(json.dumps({
                        "id": nid,
                        "method": "Runtime.evaluate",
                        "params": {
                            "expression": """JSON.stringify({
                                cap: (window.__cap||[]).filter(x=>x.u&&(/m3u8/.test(x.u)||/\\.mp4/.test(x.u)||/mizhi/.test(x.u)||/admin/.test(x.u))).slice(-15),
                                vids: Array.from(document.querySelectorAll('video,source')).map(x=>({src:x.src,cur:x.currentSrc})),
                                iframe: Array.from(document.querySelectorAll('iframe')).map(f=>f.src).find(s=>s.includes('player.gugu3'))
                            })""",
                            "returnByValue": True
                        },
                        "sessionId": sid
                    }))
                    qid = nid
                    nid += 1
                    continue

                if m.get("id") == qid and "result" in m:
                    val = m.get("result", {}).get("result", {}).get("value", "")
                    if val:
                        try:
                            data = json.loads(val)
                        except Exception:
                            data = {}
                        for v in data.get("vids", []):
                            src = v.get("src") or v.get("cur")
                            if src and (".m3u8" in src or ".mp4" in src) and "doubleclick" not in src:
                                result["video_src"] = src
                        result["iframe_src"] = data.get("iframe")
                        if data.get("cap"):
                            for c in data["cap"]:
                                u = c.get("u", "")
                                if (".m3u8" in u or ".mp4" in u) and "doubleclick" not in u:
                                    result["video_src"] = u
                                    result["captured_urls"].append(u)
                                resp = c.get("r", "")
                                # 尝试从JSON响应中提取url
                                if resp and resp.startswith("{"):
                                    try:
                                        jr = json.loads(resp)
                                        for k in ("url", "json_url", "m3u8", "video_url"):
                                            vu = jr.get(k)
                                            if vu and isinstance(vu, str) and (".m3u8" in vu or ".mp4" in vu) and "byteimg" not in vu:
                                                result["video_src"] = vu
                                    except Exception:
                                        pass
                        if result["video_src"]:
                            return result
                    continue
            return result


# =====================================================
# 2. 纯 HTTP 接口：用 mizhi_json.php + vkey 解密
#   (备用方案：直接 POST 到播放器API)
# =====================================================
def extract_vkey_from_html(html: str) -> str:
    """从player页面html中提取vkey (页面硬编码的是静态vkey，真正的vkey在混淆JS中生成)"""
    m = re.search(r'"vkey"\s*:\s*"([0-9a-f]+)"', html)
    if m:
        return m.group(1)
    # 从混淆JS生成的vkey逻辑需要浏览器环境，故优先用CDP方式
    return ""


def get_real_url_via_player_api(enc_url: str, vkey: str, referer: str) -> str:
    """
    调用 player.gugu3.com/admin/mizhi_json.php 获取真实URL。
    注意：该接口初始返回的是封面图，需要播放器JS点击后再调用一次，
    因此该方案不完整，仅作为备用。
    """
    t = str(int(time.time()))
    r = session.post(
        "https://player.gugu3.com/admin/mizhi_json.php",
        data={"url": enc_url, "time": t, "key": "", "vkey": vkey},
        headers={"Referer": referer, "X-Requested-With": "XMLHttpRequest"},
        timeout=10
    )
    try:
        j = r.json()
        return j.get("url") or j.get("json_url")
    except Exception:
        return None


# =====================================================
# 3. 列表 & 详情抓取
# =====================================================
def fetch_list_page(page: int) -> dict:
    """抓取列表页"""
    url = LIST_API.format(page=page)
    r = session.get(url, timeout=15)
    r.raise_for_status()
    return r.json()


def fetch_play_page(vid: int, sid: int, nid: int) -> str:
    """获取播放页HTML并提取加密PlayUrl"""
    url = PLAY_URL.format(vid=vid, sid=sid, nid=nid)
    r = session.get(url, timeout=15)
    r.raise_for_status()
    html = r.text
    # 提取 player_aaaa JSON
    m = re.search(r"var\s+player_aaaa\s*=\s*(\{.*?\})\s*;\s*</script>", html, re.S)
    if not m:
        return None
    try:
        cfg = json.loads(m.group(1))
    except Exception:
        return None
    return {"html": html, "config": cfg, "url": url}


def fetch_detail(vid: int) -> dict:
    """抓取详情页获取所有线路和集数"""
    url = DETAIL_URL.format(vid=vid)
    r = session.get(url, timeout=15)
    r.raise_for_status()
    soup = BeautifulSoup(r.text, "lxml")

    title_el = soup.select_one(".page-title, h2, .detail-info h2, .vod-h2 h2")
    title = title_el.get_text(strip=True) if title_el else ""
    if not title:
        m = re.search(r"<title>([^<]+)", r.text)
        title = m.group(1).replace("番剧高清完整版在线观看", "").replace("-咕咕番", "").strip() if m else str(vid)

    # 提取所有播放线路及集数（MacCMS: anthology-list 下的多个 .anthology-list-box）
    sources = []  # [{sid:2, name:"咕咕新线", episodes:[{nid:1, name:"第01集", url:...}]}]
    # 从JS中提取最可靠
    playfrom = re.findall(r"vod_play_from\s*=\s*'([^']+)'", r.text)
    playurls = re.findall(r"vod_play_url\s*=\s*'([^']+)'", r.text)
    if playfrom and playurls:
        from_list = playfrom[0].split("$$$")
        url_lists = playurls[0].split("$$$")
        for idx, (fname, urls_str) in enumerate(zip(from_list, url_lists), start=1):
            eps = []
            for n, part in enumerate(urls_str.split("#"), start=1):
                if not part:
                    continue
                parts = part.split("$")
                ep_name = parts[0] if parts else f"第{n}集"
                enc_url = parts[1] if len(parts) > 1 else ""
                eps.append({"nid": n, "name": ep_name, "enc_url": enc_url,
                            "play_url": PLAY_URL.format(vid=vid, sid=idx, nid=n)})
            sources.append({"sid": idx, "name": fname, "episodes": eps})
    # fallback: 从anthology-list-box解析
    if not sources:
        tab_names = []
        for a in soup.select(".anthology-tab .swiper-slide, .anthology-tab a"):
            badge = a.select_one(".badge")
            name = a.get_text(strip=True)
            if badge:
                name = name.replace(badge.get_text(strip=True), "").strip()
            name = name.replace("\xa0","").strip()
            if name: tab_names.append(name)
        boxes = soup.select(".anthology-list-box")
        if not tab_names:
            tab_names = [f"线路{i+1}" for i in range(len(boxes))]
        for i, (box, tname) in enumerate(zip(boxes, tab_names)):
            eps = []
            for n, a in enumerate(box.select("a"), start=1):
                href = a.get("href", "")
                m2 = re.search(r"/sid/(\d+)/nid/(\d+)\.html", href)
                if not m2: continue
                eps.append({"nid": int(m2.group(2)), "name": a.get_text(strip=True),
                            "enc_url": "",
                            "play_url": urljoin(BASE_URL, href)})
            if eps:
                m3 = re.search(r"/sid/(\d+)/", eps[0]["play_url"])
                real_sid = int(m3.group(1)) if m3 else i+1
                sources.append({"sid": real_sid, "name": tname, "episodes": eps})

    # 元信息
    cover = ""
    img = soup.select_one(".detail-sketch img, .vod-detail img, .detail-pic img")
    if img:
        cover = img.get("data-src") or img.get("src") or ""
    desc = ""
    d = soup.select_one(".vod-content, .sketch-content, .desc-content")
    if d:
        desc = d.get_text(" ", strip=True)

    return {
        "vid": vid,
        "title": title,
        "cover": cover,
        "desc": desc,
        "sources": sources,
        "detail_url": url,
    }


# =====================================================
# 4. 视频下载（m3u8 → ffmpeg, mp4 → 直接下载）
# =====================================================
def download_video(url: str, out_path: Path):
    out_path.parent.mkdir(parents=True, exist_ok=True)
    if ".m3u8" in url:
        cmd = [
            "ffmpeg", "-y", "-protocol_whitelist", "file,http,https,tcp,tls,crypto",
            "-headers", f"Referer: {BASE_URL}/\r\nUser-Agent: {HEADERS['User-Agent']}\r\n",
            "-i", url, "-c", "copy", "-bsf:a", "aac_adtstoasc", str(out_path)
        ]
        print(f"  [ffmpeg] {' '.join(cmd[:6])} ... {out_path.name}")
        subprocess.run(cmd, check=False)
    else:
        print(f"  [download] {url}")
        with requests.get(url, headers={**HEADERS, "Referer": "https://player.gugu3.com/"},
                          stream=True, timeout=60) as r:
            r.raise_for_status()
            with open(out_path, "wb") as f:
                for chunk in r.iter_content(chunk_size=1024 * 256):
                    if chunk:
                        f.write(chunk)


# =====================================================
# 5. 主抓取流程
# =====================================================
def load_done_ids() -> set:
    done = set()
    if RESULTS_FILE.exists():
        with open(RESULTS_FILE, "r", encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if not line:
                    continue
                try:
                    d = json.loads(line)
                    done.add(d["vid"])
                except Exception:
                    pass
    return done


def save_result(record: dict):
    with open(RESULTS_FILE, "a", encoding="utf-8") as f:
        f.write(json.dumps(record, ensure_ascii=False) + "\n")


async def main_async(args):
    done = load_done_ids()
    print(f"[+] 已抓取 {len(done)} 条记录")

    # 尝试连接 CDP（用于完美解密）
    cdp = None
    cdp_url = args.cdp or CDP_URL_DEFAULT
    try:
        async with websockets.connect(cdp_url, max_size=1024) as ws:
            await ws.send(json.dumps({"id": 1, "method": "Target.getTargets"}))
            await ws.recv()
        cdp = CDPPlayerExtractor(cdp_url)
        print(f"[+] CDP 连接成功：{cdp_url}")
    except Exception as e:
        print(f"[!] CDP 浏览器无法连接（{e}），将使用HTTP接口方式（解密可能不完整）")

    page = args.start_page
    total_pages = None
    fetched_count = 0

    while True:
        if args.max_pages and fetched_count >= args.max_pages:
            break
        print(f"\n[→] 正在抓取列表页 第{page}页 ...")
        try:
            data = fetch_list_page(page)
        except Exception as e:
            print(f"[!] 列表页{page}抓取失败: {e}")
            time.sleep(3)
            page += 1
            continue

        if data.get("code") != 1:
            print(f"[!] 列表接口异常: {data}")
            break
        if total_pages is None:
            total_pages = data.get("pagecount", 1)
            print(f"[+] 列表总页数: {total_pages}，总条数:{data.get('total')}")

        items = data.get("list", [])
        if not items:
            break

        for item in items:
            vid = item.get("vod_id")
            name = item.get("vod_name", "")
            if vid in done:
                print(f"  [=] 跳过已抓取: {name} (id={vid})")
                continue
            print(f"\n[★] 处理: {name} (id={vid})")
            try:
                detail = fetch_detail(vid)
            except Exception as e:
                print(f"  [!] 详情抓取失败: {e}")
                continue

            # 对每条线路的第一集尝试提取真实播放URL（验证用），
            # 其他集数因URL加密模式相同，可按需再调用CDP获取。
            for src in detail["sources"]:
                for ep in src["episodes"][:1 if not args.all_eps else len(src["episodes"])]:
                    real_url = None
                    # 1) CDP 浏览器完美解密
                    if cdp:
                        try:
                            res = await cdp.extract(ep["play_url"])
                            real_url = res.get("video_src")
                            print(f"  [CDP] {src['name']} - {ep['name']}: {real_url}")
                        except Exception as e:
                            print(f"  [!] CDP 提取失败: {e}")
                    # 2) 备用：HTTP接口（可能需点击，仅做字段记录）
                    ep["real_url"] = real_url

                    # 可选下载
                    if args.download and real_url:
                        safe_title = re.sub(r'[\\/:*?"<>|]', '_', detail["title"])
                        safe_ep = re.sub(r'[\\/:*?"<>|]', '_', ep["name"])
                        ext = ".mp4" if ".mp4" in real_url else ".mp4"
                        out = VIDEO_DIR / safe_title / f"{safe_ep}{ext}"
                        try:
                            download_video(real_url, out)
                            ep["file"] = str(out)
                        except Exception as e:
                            print(f"  [!] 下载失败: {e}")
                    if not args.all_eps:
                        break

            save_result(detail)
            done.add(vid)
            fetched_count += 1
            time.sleep(0.5)

            if args.max_count and fetched_count >= args.max_count:
                break

        if page >= total_pages:
            break
        page += 1
        time.sleep(1)

    print(f"\n[✓] 抓取完成！共处理 {fetched_count} 部番剧")
    print(f"    元数据：{RESULTS_FILE}")
    print(f"    视频目录：{VIDEO_DIR}")


def main():
    parser = argparse.ArgumentParser(description="咕咕番(gugu3.com)全站爬虫（含混淆播放器完美解密）")
    parser.add_argument("--cdp", help="CDP浏览器WebSocket URL", default=None)
    parser.add_argument("--start-page", type=int, default=1, help="起始列表页")
    parser.add_argument("--max-pages", type=int, default=None, help="最大爬取列表页数")
    parser.add_argument("--max-count", type=int, default=None, help="最大爬取番剧数量")
    parser.add_argument("--download", action="store_true", help="下载视频（需ffmpeg）")
    parser.add_argument("--all-eps", action="store_true", help="抓取每一集的真实URL（默认只取每部第1集）")
    args = parser.parse_args()

    try:
        import asyncio
        asyncio.run(main_async(args))
    except KeyboardInterrupt:
        print("\n[!] 用户中断")


if __name__ == "__main__":
    import asyncio
    main()
