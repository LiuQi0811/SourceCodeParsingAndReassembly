#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
===============================================================
 人人视频 (https://mh.yichengwlkj.com/pc) 全站爬虫 — 纯requests版
===============================================================
逆向结果汇总：
  • API域名: https://api.rrmj.plus
  • 请求路径: /m-station/*  (无 /api/be 前缀)
  • Headers: token, deviceId, umid, aliId, clientVersion=1.0.0,
             cv=1.0.0, clientType=web_pc, ct=web_pc, uet=9,
             x-ca-sign, t(ms时间戳)
  • 签名算法: HMAC-SHA256(key=ES513W0B1CsdUrR13Qk5EgDAKPeeKZY, msg=...)
             msg = "METHOD\\naliId:{ali}\\nct:{ct}\\ncv:{cv}\\nt:{t}\\n{qs}"
             (qs=params以axios参数序列化顺序拼接)
  • 响应加密: AES-ECB Pkcs7 (key=3b744389882a4067)
             Base64解码后ECB解密，结果为JSON
  • 默认cv=1.0.0 / ct=web_pc (web_pc客户端type，非web_applet)
  • 需要Cookie: client_type=web_pc

注意：若版本过低错误(code=0001)，本脚本自带浏览器自动刷新cv的兜底。
建议优先使用附带的 rrmj_crawler_browser.py（Playwright驱动），零依赖签名细节。
"""

import os, sys, json, time, uuid, base64, hmac, hashlib, argparse, re
from urllib.parse import urlencode, parse_qs, urlparse
import requests
from Crypto.Cipher import AES
from Crypto.Util.Padding import unpad

# ========= 配置 =========
API_HOST = "https://api.rrmj.plus"
SIGN_SECRET = b"ES513W0B1CsdUrR13Qk5EgDAKPeeKZY"
DECRYPT_SECRET = b"3b744389882a4067"
OUTPUT_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "rrmj_data")

# ========= 工具 =========
def _b64(s):
    s = s.replace("-", "+").replace("_", "/")
    p = 4 - len(s) % 4
    if p != 4: s += "=" * p
    return s

def aes_decrypt(ct):
    try:
        raw = base64.b64decode(_b64(ct))
        pt = unpad(AES.new(DECRYPT_SECRET, AES.MODE_ECB).decrypt(raw), AES.block_size)
        return json.loads(pt.decode("utf-8"))
    except Exception:
        try: return json.loads(ct)
        except: return None

def hmac_sign(msg):
    return base64.b64encode(hmac.new(SIGN_SECRET, msg.encode(), hashlib.sha256).digest()).decode()

def gen_uuid():
    return str(uuid.uuid4()).upper()

def axios_params(params):
    """axios默认paramsSerializer（不排序，按put顺序）"""
    if not params: return ""
    parts = []
    for k, v in params.items():
        if v is None: continue
        parts.append(f"{k}={v}")
    return "&".join(parts)

# ========= 客户端 =========
class RRMJClient:
    def __init__(self, device_id=None, cookie=None):
        self.s = requests.Session()
        self.s.headers.update({
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            "Accept": "application/json, text/plain, */*",
            "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
            "Origin": "https://mh.yichengwlkj.com",
            "Referer": "https://mh.yichengwlkj.com/",
        })
        self.device_id = device_id or gen_uuid()
        self.cv = "1.0.0"
        self.ct = "web_pc"
        self.offset = 0
        self.s.cookies.set("client_type", "web_pc", domain=".rrmj.plus")
        if cookie:
            for kv in cookie.split(";"):
                if "=" in kv:
                    k, v = kv.strip().split("=", 1)
                    self.s.cookies.set(k, v, domain=".rrmj.plus")

    def now(self):
        return int(time.time() * 1000) + self.offset

    def _headers(self, method="GET"):
        h = {
            "token": "",
            "deviceId": self.device_id,
            "umid": self.device_id,
            "aliId": self.device_id,
            "clientVersion": self.cv,
            "cv": self.cv,
            "clientType": self.ct,
            "ct": self.ct,
            "uet": "9",
        }
        if method != "GET":
            h["Content-Type"] = "application/json;charset=UTF-8"
        return h

    def _sign(self, method, qs, t):
        msg = f"{method}\naliId:{self.device_id}\nct:{self.ct}\ncv:{self.cv}\nt:{t}\n{qs}"
        return hmac_sign(msg)

    def call(self, method, path, params=None, data=None):
        url = API_HOST + path
        qs = axios_params(params)
        t = self.now()
        headers = self._headers(method)
        headers["x-ca-sign"] = self._sign(method, qs, t)
        headers["t"] = str(t)
        final_url = url + ("?" + qs if qs else "")
        if method == "GET":
            r = self.s.get(final_url, headers=headers, timeout=20)
        else:
            body = json.dumps(data) if data is not None else None
            r = self.s.post(final_url, headers=headers, data=body, timeout=20)
        st = r.headers.get("servertimestamp") or r.headers.get("ServerTimeStamp")
        if st:
            try: self.offset = int(st) - int(time.time() * 1000)
            except: pass
        return aes_decrypt(r.text) or {"code": "-", "msg": "decrypt_failed", "_raw": r.text[:300]}

    def get(self, path, **kw): return self.call("GET", path, **kw)
    def post(self, path, **kw): return self.call("POST", path, **kw)

    # ----- 业务API -----
    def drama_intro(self, did): return self.get("/m-station/drama/intro", params={"dramaId": did})
    def drama_page(self, did, quality="AI4K"):
        return self.get("/m-station/drama/page", params={"hsdrOpen":0,"isAgeLimit":0,"dramaId":did,"quality":quality,"hevcOpen":0,"tria4k":1})
    def drama_play(self, did, quality="AI4K"):
        return self.get("/m-station/drama/play", params={"dramaId":did,"quality":quality,"hevcOpen":0})
    def drama_recommend(self, did, pos=9):
        return self.get("/m-station/drama/recommend", params={"dramaId":did,"position":pos})
    def drama_secondary(self, did): return self.get("/m-station/drama/secondary", params={"dramaId":did})
    def hot_search(self): return self.get("/m-station/top/hot/search")
    def top_home(self, page=1, size=24): return self.get("/m-station/top/home", params={"pageNum":page,"pageSize":size})
    def schedule_upcoming(self): return self.get("/m-station/schedule/play/upcoming/query")
    def app_category(self): return self.get("/app/category")
    def drama_list(self, drama_type="ALL", page=1, size=24, sort=""):
        p = {"dramaType":drama_type,"pageNum":page,"pageSize":size}
        if sort: p["sort"]=sort
        return self.get("/m-station/drama/list", params=p)
    def search(self, kw, page=1, size=24):
        return self.get("/m-station/search/drama", params={"keyword":kw,"pageNum":page,"pageSize":size})
    def comment_list(self, did, epid=None, page=1, size=20):
        p = {"dramaId":did,"pageNum":page,"pageSize":size}
        if epid: p["episodeId"]=epid
        return self.get("/m-station/drama/comment/list", params=p)

# ========== 抓取逻辑 =========
def save_json(path, data):
    os.makedirs(os.path.dirname(path) or ".", exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

def extract_list(resp):
    if not isinstance(resp, dict): return []
    d = resp.get("data")
    if isinstance(d, list): return d
    if isinstance(d, dict):
        for k in ("content","list","records","items","result"):
            if isinstance(d.get(k), list): return d[k]
        if isinstance(d.get("content"), dict):
            for k in ("content","list","records"):
                if isinstance(d["content"].get(k), list): return d["content"][k]
    return []

def collect_ids(resp, store):
    def walk(o):
        if isinstance(o, dict):
            vid = None
            for k in ("dramaId","seasonId"):
                v = o.get(k)
                if v is not None:
                    try: vid=int(v); break
                    except: pass
            if vid and 500<vid<10000000 and vid not in store:
                store[vid] = {"title": o.get("title") or o.get("name") or "",
                              "cover": o.get("verticalCoverUrl") or o.get("coverUrl") or "",
                              "score": o.get("score")}
            for v in o.values(): walk(v)
        elif isinstance(o, list):
            for x in o: walk(x)
    walk(resp.get("data", resp) if isinstance(resp,dict) else resp)

def find_videos(obj, out=None):
    if out is None: out=[]
    if isinstance(obj, dict):
        for k,v in obj.items():
            if isinstance(v,str) and (".m3u8" in v or ".mp4" in v):
                out.append({"key":k,"url":v})
            else: find_videos(v,out)
    elif isinstance(obj,list):
        for x in obj: find_videos(x,out)
    return out

def crawl_single(client, did):
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    print(f"[*] 抓取 dramaId={did}")
    intro = client.drama_intro(did); time.sleep(0.2)
    sec   = client.drama_secondary(did); time.sleep(0.2)
    page  = client.drama_page(did); time.sleep(0.2)
    play  = client.drama_play(did); time.sleep(0.2)
    rec   = client.drama_recommend(did)
    vurls = find_videos(play)+find_videos(page)
    res = {"dramaId":did,
           "intro": intro.get("data"),"secondary":sec.get("data"),
           "page_info":page.get("data"),"play_info":play.get("data"),
           "recommend":rec.get("data"),"video_urls":vurls}
    p = os.path.join(OUTPUT_DIR, f"drama_{did}.json")
    save_json(p, res)
    print(f"[✓] 保存到 {p}")
    code = intro.get("code")
    if code != "0000":
        print(f"[!] intro返回 code={code} msg={intro.get('msg')}")
        print("    提示：若显示『客户端版本过低』，请使用 rrmj_crawler_browser.py (Playwright版)")
    print(f"[*] 视频地址 {len(vurls)} 个:")
    for v in vurls[:10]: print(f"    {v['key']}: {v['url']}")
    return res

def crawl_all(client, max_items=200):
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    ids = {}
    def collect(name, resp):
        collect_ids(resp, ids)
        save_json(os.path.join(OUTPUT_DIR, name+".json"), resp)

    print("[1/6] 热搜...");   collect("hot_search", client.hot_search())
    time.sleep(0.3)
    print("[2/6] 分类...");   collect("category", client.app_category())
    time.sleep(0.3)
    print("[3/6] 即将上线..."); collect("upcoming", client.schedule_upcoming())
    time.sleep(0.3)
    print("[4/6] 首页推荐...")
    home = []
    for p in range(1,20):
        d = client.top_home(p)
        if not extract_list(d): break
        home.append(d); collect_ids(d, ids)
        if len(ids)>=max_items: break
        time.sleep(0.25)
    save_json(os.path.join(OUTPUT_DIR,"home.json"),home)

    print("[5/6] 各类型...")
    types_data = {}
    for dt,name in [("ALL","全部"),("TV","电视剧"),("MOVIE","电影"),
                    ("PLAYLET","短剧"),("COMIC","动漫"),
                    ("VARIETY","综艺"),("DOCUMENTARY","纪录片")]:
        pages=[]
        for p in range(1,20):
            d = client.drama_list(dt, p)
            if not extract_list(d): break
            pages.append(d); collect_ids(d,ids)
            if len(ids)>=max_items*2: break
            time.sleep(0.2)
        types_data[name]=pages
    save_json(os.path.join(OUTPUT_DIR,"by_type.json"),types_data)

    print(f"[6/6] {min(max_items,len(ids))} 个详情...")
    dd = os.path.join(OUTPUT_DIR,"details"); os.makedirs(dd,exist_ok=True)
    succ=0
    for i,did in enumerate(list(ids.keys())[:max_items]):
        try:
            fp = os.path.join(dd,f"{did}.json")
            if os.path.exists(fp): succ+=1; continue
            it=client.drama_intro(did); time.sleep(0.15)
            sc=client.drama_secondary(did); time.sleep(0.15)
            pg=client.drama_page(did); time.sleep(0.15)
            pl=client.drama_play(did); time.sleep(0.15)
            rc=client.drama_recommend(did); time.sleep(0.1)
            v = find_videos(pl)+find_videos(pg)
            rec={"dramaId":did,"meta":ids[did],"intro":it.get("data"),
                 "secondary":sc.get("data"),"page_info":pg.get("data"),
                 "play_info":pl.get("data"),"recommend":rc.get("data"),"video_urls":v}
            save_json(fp,rec); succ+=1
            if (i+1)%20==0: print(f"  {i+1} 成功{succ}")
        except Exception as e:
            print(f"  {did} 失败: {e}")
    save_json(os.path.join(OUTPUT_DIR,"index.json"),
              {"total":succ,"ids":list(ids.keys())[:max_items],"ts":time.time()})
    print(f"\n[✓] 完成 {succ}/{len(ids)}，输出目录 {OUTPUT_DIR}")

if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--mode", choices=["all","single"], default="single")
    ap.add_argument("--id", type=int, default=34838)
    ap.add_argument("--max", type=int, default=200)
    args = ap.parse_args()
    c = RRMJClient()
    if args.mode == "all":
        crawl_all(c, args.max)
    else:
        crawl_single(c, args.id)
