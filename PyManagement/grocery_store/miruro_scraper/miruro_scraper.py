#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Miruro.tv 全站抓取器 (完整逆向解密版)
================================================
逆向成果 (100% 还原前端逻辑):
  1. API 传输层:  POST/GET /api/secure/pipe?e=<base64url>
     - GET 模式:  e = base64url(JSON({path,method,query,body}))
     - 响应 x-obfuscated=2 时:
            base64url_decode -> XOR(PIPE_OBF_KEY,循环) -> gzip -> JSON
  2. PIPE_OBF_KEY   = 71951034f8fbcf53d89db52ceb3dc22c   (16字节 hex)
  3. PROXY_OBF_KEY  = a54d389c18527d9fd3e7f0643e27edbe   (16字节 hex, 视频分片XOR)
  4. 视频代理节点:
       PROXY_A      = https://s1.watami.win/
       PROXY_B      = https://s1.piltover.li/
       Referer      = https://strm.cx
  5. Provider 列表(从__SSR_CONFIG__.streaming提取):
       bee/hop/kiwi/ally/bonk/pewe/moo  (直链native)
       nun/bun/cog/twin/telli           (iframe嵌入)
  6. 备用官方域名: miruro.tv / miruro.to / miruro.bz / miruro.ru
     (miruro.com 是落地页不是流媒体站)

功能:
  --browse        抓取热门榜单 (SSR页面解析, 无需过CF)
  --search KEY    搜索 (SSR解析)
  --info ID       番剧详情 (SSR解析+API)
  --episodes ID   集数列表 (API,需过CF)
  --watch ID EP CAT   获取m3u8 (CAT=sub/dub/ssub)
  --download ID EP CAT  下载整集为mp4 (需ffmpeg)
  --full-site     全站元数据抓取
  --proxy URL     HTTP/SOCKS 代理 (推荐, 规避地域CF)
  --cf-clearance  浏览器复制的cf_clearance cookie
"""

import argparse
import base64
import gzip
import json
import os
import re
import shutil
import subprocess
import sys
import time
from pathlib import Path
from urllib.parse import urlencode, urlparse

import requests

# ======================= 静态密钥 (从 env2.js 逆向) =======================
PIPE_OBF_KEY  = bytes.fromhex("71951034f8fbcf53d89db52ceb3dc22c")
PROXY_OBF_KEY = bytes.fromhex("a54d389c18527d9fd3e7f0643e27edbe")
PROXIES = ("https://s1.watami.win/", "https://s1.piltover.li/")
REFERER_ORIGIN = "https://strm.cx"

MIRURO_DOMAINS = [
    "https://www.miruro.tv",
    "https://www.miruro.to",
    "https://www.miruro.bz",
    "https://www.miruro.ru",
]

UA = ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36")


# ====================================================================
#                         核心解密原语
# ====================================================================
def b64url_encode(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).decode().rstrip("=")


def b64url_decode(s: str) -> bytes:
    s = s.replace("-", "+").replace("_", "/")
    pad = len(s) % 4
    if pad:
        s += "=" * (4 - pad)
    return base64.b64decode(s)


def xor_bytes(data: bytes, key: bytes) -> bytes:
    """循环 XOR —— Miruro API 响应与代理视频分片共用此算法"""
    klen = len(key)
    return bytes(b ^ key[i % klen] for i, b in enumerate(data))


def decrypt_pipe_payload(text: str) -> bytes:
    """解密 x-obfuscated=2 的 pipe 响应体: b64url -> XOR -> gzip"""
    raw = b64url_decode(text)
    raw = xor_bytes(raw, PIPE_OBF_KEY)
    if raw[:2] == b"\x1f\x8b":
        raw = gzip.decompress(raw)
    return raw


def decrypt_segment(data: bytes) -> bytes:
    """解密被代理XOR过的 m4s/ts 视频分片"""
    return xor_bytes(data, PROXY_OBF_KEY)


# ====================================================================
#                   Miruro 客户端 (加密API模式)
# ====================================================================
class MiruroClient:
    def __init__(self, domain=None, proxy=None, cf_clearance=None, user_agent=None):
        self.domain = domain or MIRURO_DOMAINS[0]
        self.s = requests.Session()
        self.s.headers.update({
            "User-Agent": user_agent or UA,
            "Accept": "application/json, text/plain, */*",
            "Accept-Language": "en-US,en;q=0.9",
            "Accept-Encoding": "gzip, deflate, br",
            "Origin": self.domain,
            "Referer": self.domain + "/",
            "Sec-Ch-Ua": '"Chromium";v="131", "Google Chrome";v="131", "Not?A_Brand";v="99"',
            "Sec-Ch-Ua-Mobile": "?0",
            "Sec-Ch-Ua-Platform": '"Windows"',
            "Sec-Fetch-Dest": "empty",
            "Sec-Fetch-Mode": "cors",
            "Sec-Fetch-Site": "same-origin",
        })
        if proxy:
            self.s.proxies = {"http": proxy, "https": proxy}
        if cf_clearance:
            self.s.cookies.set(
                "cf_clearance", cf_clearance,
                domain=urlparse(self.domain).hostname, path="/",
            )
        self._pick_domain()

    def _pick_domain(self):
        """自动挑选一个 /health 返回200的域名"""
        for d in [self.domain] + [x for x in MIRURO_DOMAINS if x != self.domain]:
            try:
                r = self.s.get(d + "/health", timeout=8,
                               headers={"Accept": "text/plain"})
                ct = r.headers.get("content-type", "")
                if r.status_code == 200 and "html" not in ct:
                    self.domain = d
                    self.s.headers["Origin"] = d
                    self.s.headers["Referer"] = d + "/"
                    print(f"[+] API可达域名: {d}")
                    return
            except Exception:
                continue
        print(f"[!] 当前IP被Cloudflare拦截(所有域名), 需配合 --proxy 或 --cf-clearance。"
              f"将继续尝试 {self.domain}")

    def _pipe(self, path, query=None, method="GET", body=None):
        payload = {"path": path, "method": method,
                   "query": query or {}, "body": body}
        e = b64url_encode(json.dumps(payload, separators=(",", ":")).encode())
        url = f"{self.domain}/api/secure/pipe?e={e}"
        r = self.s.get(url, timeout=25)
        if r.status_code != 200:
            if r.status_code in (403, 503) or "cloudflare" in r.text.lower()[:2000]:
                raise RuntimeError(
                    f"Cloudflare 拦截 HTTP {r.status_code}。"
                    f"解决方案:\n  1) 加 --proxy http://127.0.0.1:7890 使用代理\n"
                    f"  2) 从浏览器复制 cf_clearance cookie 通过 --cf-clearance 传入")
            raise RuntimeError(f"API错误 {r.status_code}: {r.text[:300]}")
        xobf = r.headers.get("x-obfuscated")
        if xobf == "2":
            return json.loads(decrypt_pipe_payload(r.text).decode("utf-8"))
        ct = r.headers.get("content-type", "")
        if "json" in ct:
            return r.json()
        return r.text

    # ------- 业务接口 -------
    def config(self):             return self._pipe("config")
    def schedule(self, date=None):
        q = {}
        if date: q["date"] = date
        return self._pipe("schedule", q)
    def search_browse(self, sort="TRENDING_DESC", page=1, per_page=30, **kw):
        return self._pipe("search/browse", {"sort":sort,"page":page,"perPage":per_page, **kw})
    def search(self, query, page=1, per_page=30):
        return self._pipe("search", {"query":query,"page":page,"perPage":per_page})
    def info(self, aid):          return self._pipe(f"info/{aid}")
    def episodes(self, aid, provider="kiwi", dub=False):
        return self._pipe(f"episodes/{aid}",
                          {"provider":provider, "dub": str(dub).lower()})
    def sources(self, episode_id, provider="kiwi", category="sub"):
        t = int(time.time() // 600) * 600
        return self._pipe("sources", {
            "episodeId": episode_id, "provider": provider,
            "category": category, "live": "true", "_t": t,
        })


# ====================================================================
#            SSR HTML 抓取 (免Cloudflare, 因为首页HTML能直连)
# ====================================================================
class SSRClient:
    """直接请求 Miruro 的 SSR 页面, 解析 __SSR_CONFIG__ / JSON-LD / 内嵌数据"""

    def __init__(self, domain=None, proxy=None, user_agent=None):
        self.domain = domain or MIRURO_DOMAINS[0]
        self.s = requests.Session()
        self.s.headers.update({
            "User-Agent": user_agent or UA,
            "Accept": ("text/html,application/xhtml+xml,application/xml;"
                       "q=0.9,image/avif,image/webp,*/*;q=0.8"),
            "Accept-Language": "en-US,en;q=0.9",
        })
        if proxy:
            self.s.proxies = {"http": proxy, "https": proxy}

    def _get_html(self, path):
        # 轮询域名
        errs = []
        for d in [self.domain] + [x for x in MIRURO_DOMAINS if x != self.domain]:
            try:
                r = self.s.get(d + path, timeout=20)
                if r.status_code == 200 and "<html" in r.text[:500].lower():
                    self.domain = d
                    return r.text
                errs.append(f"{d} -> {r.status_code}")
            except Exception as e:
                errs.append(f"{d} -> {e}")
        raise RuntimeError("所有域名均无法访问: " + " | ".join(errs))

    @staticmethod
    def _extract_ssr_config(html):
        m = re.search(r"window\.__SSR_CONFIG__\s*=\s*(\{.*?\})\s*</script>", html, re.S)
        if m:
            try:
                # 注意 __SSR_CONFIG__.mk 字段是 base64 编码的monkey配置, 解析时容忍一下
                return json.loads(m.group(1))
            except Exception:
                pass
        return None

    @staticmethod
    def _extract_jsonld(html):
        out = []
        for m in re.finditer(r'<script type="application/ld\+json">(.+?)</script>',
                             html, re.S):
            try:
                out.append(json.loads(m.group(1)))
            except Exception:
                pass
        return out

    def trending(self):
        """从首页JSON-LD解析Trending列表"""
        html = self._get_html("/")
        for ld in self._extract_jsonld(html):
            if isinstance(ld, dict) and ld.get("@type") == "ItemList" \
                    and "Trending" in (ld.get("name") or ""):
                return ld.get("itemListElement", [])
            if isinstance(ld, list):
                for x in ld:
                    if isinstance(x, dict) and x.get("@type") == "ItemList" \
                            and "Trending" in (x.get("name") or ""):
                        return x.get("itemListElement", [])
        # 也从<nav aria-label="Trending">里兜底
        items = re.findall(
            r'<a href="(https://www\.miruro\.[a-z]+/info/\d+/[^"]+)"[^>]*>([^<]+)</a>',
            html)
        return [{"url": u, "name": n} for u, n in items if "/info/" in u]

    def search(self, keyword):
        html = self._get_html(f"/search?query={requests.utils.quote(keyword)}")
        # SSR搜索页会直接把首批结果写入JSON-LD或script中
        return self._extract_jsonld(html)

    def info(self, aid):
        """从 /info/<id>/<slug> 页面解析番剧SSR信息"""
        # 先尝试访问该URL (从trending里拿到的完整URL)
        html = self._get_html(f"/info/{aid}/x")
        # 尝试解析页面标题 / og:*
        info = {"id": aid}
        m = re.search(r'<title>([^<]+)</title>', html)
        if m: info["title"] = m.group(1).replace(" · Watch Anime Online Free · Stream Sub & Dub in HD", "")
        m = re.search(r'property="og:description" content="([^"]+)"', html)
        if m: info["description"] = m.group(1)
        m = re.search(r'property="og:image" content="([^"]+)"', html)
        if m: info["image"] = m.group(1)
        # 提取 __SSR_CONFIG__ 里可能带的流媒体配置
        cfg = self._extract_ssr_config(html)
        if cfg:
            info["_config"] = {k: v for k, v in cfg.items() if k in
                               ("streaming", "providerOrder")}
        return info


# ====================================================================
#                   视频分片解密下载器
# ====================================================================
class VideoDownloader:
    """下载 m3u8 并自动解密 XOR 分片, 调用 ffmpeg 合成 mp4"""

    def __init__(self, out_dir="./downloads", proxy=None):
        self.out_dir = Path(out_dir)
        self.out_dir.mkdir(parents=True, exist_ok=True)
        self.s = requests.Session()
        self.s.headers.update({
            "User-Agent": UA,
            "Referer": REFERER_ORIGIN + "/",
            "Origin": REFERER_ORIGIN,
        })
        if proxy:
            self.s.proxies = {"http": proxy, "https": proxy}

    @staticmethod
    def _looks_like_media(b: bytes) -> bool:
        """判断是否已是合法媒体 (不需要再XOR解密)"""
        if len(b) < 4:
            return False
        heads = {b[:1], b[:2], b[:3], b[:4]}
        return bool({b"\x47", b"\x1f\x8b"} & heads) or b[:4] == b"ftyp" \
            or b[:3] == b"ID3" or b.startswith(b"\x00\x00\x00")

    def download_m3u8(self, m3u8_url: str, title: str = "video") -> Path:
        print(f"[*] 解析 m3u8: {m3u8_url}")
        try:
            master = self.s.get(m3u8_url, timeout=20).text
        except Exception as e:
            raise RuntimeError(f"无法下载m3u8主清单: {e}")

        streams = re.findall(r"^(#EXT-X-STREAM-INF[^\n]*)\n([^\n]+)", master, re.M)
        base = m3u8_url.rsplit("/", 1)[0] + "/"
        if streams:
            best = max(streams, key=lambda x: int(
                re.search(r"BANDWIDTH=(\d+)", x[0]).group(1)))
            playlist_url = best[1]
            if not playlist_url.startswith("http"):
                playlist_url = base + playlist_url
            print(f"    ↳ 选择最高码率: {playlist_url}")
        else:
            playlist_url = m3u8_url

        pl = self.s.get(playlist_url, timeout=20).text
        segs = [l.strip() for l in pl.splitlines()
                if l.strip() and not l.startswith("#")]
        key_m = re.search(r'#EXT-X-KEY:METHOD=AES-128,URI="([^"]+)"', pl)
        key_uri = key_m.group(1) if key_m else None
        if key_uri and not key_uri.startswith("http"):
            key_uri = playlist_url.rsplit("/", 1)[0] + "/" + key_uri
            print(f"    HLS-AES128 key: {key_uri} (交给ffmpeg处理)")

        print(f"[+] {len(segs)} 个分片, 开始下载/XOR解密...")
        seg_dir = self.out_dir / _sanitize(title)
        if seg_dir.exists():
            shutil.rmtree(seg_dir)
        seg_dir.mkdir(parents=True)

        seg_files = []
        for i, su in enumerate(segs, 1):
            if not su.startswith("http"):
                su = playlist_url.rsplit("/", 1)[0] + "/" + su
            data = self.s.get(su, timeout=30).content
            # 非媒体头 -> 做XOR解密 (Miruro代理对segments统一XOR)
            if not self._looks_like_media(data):
                data = decrypt_segment(data)
            ext = "ts" if data[:1] == b"\x47" else "m4s"
            fp = seg_dir / f"seg_{i:05d}.{ext}"
            fp.write_bytes(data)
            seg_files.append(fp)
            if i % 20 == 0 or i == len(segs):
                print(f"    进度: {i}/{len(segs)}")

        # 写本地 m3u8
        local_pl = seg_dir / "playlist.m3u8"
        with local_pl.open("w", encoding="utf-8") as f:
            f.write("#EXTM3U\n#EXT-X-VERSION:3\n")
            if key_uri:
                f.write(f'#EXT-X-KEY:METHOD=AES-128,URI="{key_uri}"\n')
            f.write("#EXT-X-TARGETDURATION:10\n")
            for fp in seg_files:
                # 粗略6秒一片
                f.write(f"#EXTINF:6.0,\n{fp.name}\n")
            f.write("#EXT-X-ENDLIST\n")

        out_mp4 = self.out_dir / f"{_sanitize(title)}.mp4"
        if shutil.which("ffmpeg"):
            print(f"[*] ffmpeg 合并 -> {out_mp4}")
            subprocess.run(
                ["ffmpeg", "-y", "-hide_banner", "-loglevel", "error",
                 "-allowed_extensions", "ALL", "-protocol_whitelist",
                 "file,http,https,tcp,tls,crypto",
                 "-i", str(local_pl), "-c", "copy", str(out_mp4)],
                check=True)
            shutil.rmtree(seg_dir)
            print(f"[√] 已保存: {out_mp4.resolve()}")
            return out_mp4
        print("[!] 未检测到ffmpeg, 原始分片保存在:", seg_dir.resolve())
        return seg_dir


def _sanitize(s: str) -> str:
    return re.sub(r"[^\w\-.\u4e00-\u9fa5 ]+", "_", s).strip() or "video"


# ====================================================================
#                            CLI
# ====================================================================
def _print_json(obj, limit=None):
    s = json.dumps(obj, ensure_ascii=False, indent=2)
    if limit and len(s) > limit:
        print(s[:limit], f"\n... (省略 {len(s)-limit} 字符)")
    else:
        print(s)


def _find_m3u8(obj):
    """在任意嵌套JSON里寻找第一个.m3u8链接"""
    stack = [obj]
    while stack:
        x = stack.pop()
        if isinstance(x, dict):
            u = x.get("url")
            if isinstance(u, str) and ".m3u8" in u:
                return u, x.get("quality")
            stack.extend(x.values())
        elif isinstance(x, list):
            stack.extend(x)
    return None, None


def main():
    ap = argparse.ArgumentParser(
        description="Miruro.tv 全站爬虫 (含完整API逆向+XOR解密)")
    ap.add_argument("--domain", help="指定域名")
    ap.add_argument("--proxy", help="HTTP/SOCKS代理, 如 http://127.0.0.1:7890")
    ap.add_argument("--cf-clearance", help="浏览器cf_clearance cookie")
    ap.add_argument("--user-agent")
    ap.add_argument("--provider", default="kiwi",
                    help="流媒体provider (默认kiwi; 可选kiwi/ally/bonk/bee/hop/moo/pewe)")
    ap.add_argument("--dub", action="store_true")
    ap.add_argument("--out", default="./downloads")
    ap.add_argument("--browse", action="store_true")
    ap.add_argument("--schedule", action="store_true")
    ap.add_argument("--search", metavar="KW")
    ap.add_argument("--info", type=int)
    ap.add_argument("--episodes", type=int)
    ap.add_argument("--watch", nargs=3, metavar=("ID","EP","CAT"))
    ap.add_argument("--download", nargs=3, metavar=("ID","EP","CAT"))
    ap.add_argument("--full-site", action="store_true")
    args = ap.parse_args()

    if not any([args.browse, args.schedule, args.search, args.info,
                args.episodes, args.watch, args.download, args.full_site]):
        args.browse = True

    out_dir = Path(args.out)
    out_dir.mkdir(parents=True, exist_ok=True)

    # ---- SSR 模式 (首页/browse/search/info基础信息, 无需过CF) ----
    ssr = SSRClient(domain=args.domain, proxy=args.proxy, user_agent=args.user_agent)

    if args.browse:
        data = ssr.trending()
        print(f"\n{'='*68}\n  Miruro Trending\n{'='*68}")
        for i, m in enumerate(data, 1):
            name = m.get("name") or "(无标题)"
            url = m.get("url", "")
            mid = url.rsplit("/",2)[-2] if "/info/" in url else ""
            pos = m.get("position", i)
            print(f"  {pos:>2}. [{mid:>6}] {name}")
            print(f"        {url}")
        (out_dir/"trending.json").write_text(
            json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
        print(f"\n[√] 已保存到 {out_dir/'trending.json'}")
        if not any([args.schedule,args.search,args.info,args.episodes,
                    args.watch,args.download,args.full_site]):
            return

    if args.search:
        print(f"[*] 搜索: {args.search}")
        data = ssr.search(args.search)
        _print_json(data)

    if args.info is not None and not (args.episodes or args.watch or args.download):
        info = ssr.info(args.info)
        print(json.dumps(info, ensure_ascii=False, indent=2))
        (out_dir/f"info_{args.info}.json").write_text(
            json.dumps(info, ensure_ascii=False, indent=2), encoding="utf-8")
        # 同步尝试API拿详细数据
        try:
            mc = MiruroClient(domain=args.domain, proxy=args.proxy,
                              cf_clearance=args.cf_clearance,
                              user_agent=args.user_agent)
            full = mc.info(args.info)
            print("\n--- API 详细数据 ---")
            _print_json(full, 2000)
            (out_dir/f"info_{args.info}_full.json").write_text(
                json.dumps(full, ensure_ascii=False, indent=2), encoding="utf-8")
        except Exception as e:
            print(f"(API详细数据获取跳过: {e})")
        return

    if args.full_site:
        print("[*] 全站元数据抓取 (走SSR+API)")
        site_dir = out_dir/"site"
        (site_dir/"anime").mkdir(parents=True, exist_ok=True)
        trending = ssr.trending()
        seen = {}
        for it in trending:
            u = it.get("url","")
            m = re.search(r"/info/(\d+)/", u)
            if m:
                seen[int(m.group(1))] = it
        # TODO: 分页browse需API, 这里给出trending+API搜索结果作为示范
        index = list(seen.values())
        (site_dir/"index.json").write_text(
            json.dumps(index, ensure_ascii=False, indent=2), encoding="utf-8")
        print(f"[√] 初始抓取 {len(index)} 部; 完整爬取需要API可用(加--proxy)")
        return

    # ---- API 模式 (episodes/sources/watch/download, 需过CF) ----
    mc = MiruroClient(domain=args.domain, proxy=args.proxy,
                      cf_clearance=args.cf_clearance, user_agent=args.user_agent)

    if args.schedule:
        data = mc.schedule()
        _print_json(data, 3000)
        (out_dir/"schedule.json").write_text(
            json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
        return

    if args.episodes is not None:
        data = mc.episodes(args.episodes, provider=args.provider, dub=args.dub)
        _print_json(data)
        (out_dir/f"episodes_{args.episodes}_{args.provider}.json").write_text(
            json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
        return

    if args.watch or args.download:
        spec = args.watch or args.download
        aid, ep, cat = int(spec[0]), spec[1], spec[2].lower()
        print(f"[*] 获取集数列表 (id={aid}, provider={args.provider}, cat={cat})")
        eps = mc.episodes(aid, provider=args.provider, dub=(cat == "dub"))
        lst = eps if isinstance(eps, list) else eps.get("episodes",
              eps.get("data", eps.get("results", [])))
        target = None
        for e in lst:
            eid = str(e.get("id") or e.get("episodeId") or "")
            num = e.get("number") or e.get("episode")
            if str(num) == str(ep) or f"${ep}${cat}" in eid \
                    or eid.endswith(f"-episode-{ep}"):
                target = e; break
        if not target and lst:
            try: target = lst[int(ep)-1]
            except Exception: pass
        if not target:
            print("[!] 找不到该集, 原始响应:"); _print_json(eps); return
        eid = target.get("id") or target.get("episodeId")
        title = (target.get("title") or f"anime_{aid}_ep{ep}_{cat}")
        print(f"[*] 请求片源 -> episodeId={eid}")
        src = mc.sources(eid, provider=args.provider, category=cat)
        _print_json(src, 2000)
        (out_dir/f"sources_{aid}_ep{ep}_{cat}.json").write_text(
            json.dumps(src, ensure_ascii=False, indent=2), encoding="utf-8")
        m3u8, quality = _find_m3u8(src)
        if not m3u8:
            print("[!] 响应中未找到m3u8, 详见保存的sources_*.json")
            return
        print(f"\n[√] m3u8: {m3u8}  (quality={quality})")
        # 下载字幕(tracks)若有
        for sk in ("subtitles", "tracks"):
            subs = (src.get(sk) if isinstance(src, dict) else None) or []
            for s in subs:
                if isinstance(s, dict) and s.get("url"):
                    print(f"    字幕: {s.get('label') or s.get('lang')} -> {s['url']}")
        if args.download:
            dl = VideoDownloader(out_dir=str(out_dir), proxy=args.proxy)
            dl.download_m3u8(m3u8, title=f"anime_{aid}_ep{ep}_{cat}")


if __name__ == "__main__":
    main()
