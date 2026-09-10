#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Anime1.me 全站爬蟲下載工具 (完美逆向版)

逆向分析結果：
  - 動畫列表: GET https://anime1.me/animelist.json (JSON, 1900+部)
  - 分類頁:   GET https://anime1.me/?cat={cat}  每個 <article> 含 <video> 標籤
  - 關鍵發現: video 標籤的 data-apireq 屬性是伺服器預簽名的參數
              {"c":cat,"e":ep,"t":timestamp,"p":0,"s":md5_sign}
              s 是伺服器端生成的 MD5 簽名，直接從 HTML 提取即可，
              無需本地逆向計算！
  - 視頻API:  POST https://v.anime1.me/api  body: "d="+urlencoded(apireq_json)
              返回 {"s":[{"src":"//xxx.v.anime1.me/{c}/{e}.mp4","type":"video/mp4"}]}
  - 18+內容: 姊妹站 https://anime1.pw/ 結構完全相同，API 為 v.anime1.pw/api
"""

import argparse, json, os, re, sys, time, urllib.parse
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor, as_completed

import requests
from bs4 import BeautifulSoup

BASE_URL  = "https://anime1.me"
API_URL   = "https://v.anime1.me/api"
LIST_JSON = f"{BASE_URL}/animelist.json"
R18_BASE  = "https://anime1.pw"
R18_API   = "https://v.anime1.pw/api"

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
                  "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Accept-Language": "zh-TW,zh;q=0.9,en;q=0.8",
}
CHUNK = 1024 * 1024

def safe_fn(s):
    s = re.sub(r'[<>:"/\\|?*\x00-\x1f]', "_", s).strip(". ")
    return s[:120]

def fmt_size(n):
    for u in ("B","KB","MB","GB","TB"):
        if n < 1024: return f"{n:.2f}{u}"
        n /= 1024
    return f"{n:.2f}PB"

class Spider:
    def __init__(self, out="./downloads", workers=3, timeout=60,
                 retries=3, delay=0.6, r18=False):
        self.out = Path(out).resolve()
        self.out.mkdir(parents=True, exist_ok=True)
        self.workers = workers
        self.timeout = timeout
        self.retries = retries
        self.delay = delay
        self.r18 = r18
        self.sess = requests.Session()
        self.sess.headers.update(HEADERS)
        self.meta_path = self.out / "metadata.json"
        self.meta = {}

    def _get(self, url, **kw):
        for i in range(self.retries):
            try:
                r = self.sess.get(url, timeout=self.timeout, **kw)
                r.raise_for_status(); return r
            except Exception as e:
                if i == self.retries-1: raise
                time.sleep(self.delay*(i+1))

    def _post(self, url, **kw):
        for i in range(self.retries):
            try:
                r = self.sess.post(url, timeout=self.timeout, **kw)
                r.raise_for_status(); return r
            except Exception as e:
                if i == self.retries-1: raise
                time.sleep(self.delay*(i+1))

    def fetch_list(self):
        print(f"[1/4] 獲取動畫列表 {LIST_JSON}")
        data = self._get(LIST_JSON).json()
        lst = []
        for c,title,ep,y,s,g in data:
            r18_flag = (c == 0)
            real_c = c
            if r18_flag and isinstance(title,str) and "anime1.pw" in title:
                m = re.search(r'cat=(\d+)', title)
                if m: real_c = int(m.group(1))
                tm = re.search(r'>(.+?)</a>', title)
                if tm: title = tm.group(1)
            title = re.sub(r'^🔞\s*','',title)
            lst.append({"cat":real_c,"title":title.strip(),"ep_text":ep,
                        "year":str(y),"season":str(s),"group":str(g),"r18":r18_flag})
        print(f"     共 {len(lst)} 部 (R18={sum(1 for x in lst if x['r18'])})")
        return lst

    def fetch_eps(self, cat, r18=False):
        base = R18_BASE if r18 else BASE_URL
        r = self._get(f"{base}/?cat={cat}")
        soup = BeautifulSoup(r.text, "html.parser")
        eps = []
        for art in soup.find_all("article"):
            h = art.find(["h1","h2","h3"])
            t = h.get_text(strip=True) if h else ""
            a = art.find("a", href=re.compile(r"/(\d+)/?$"))
            pid = int(m.group(1)) if a and (m:=re.search(r'/(\d+)/?$',a["href"])) else None
            v = art.find("video")
            if not v: continue
            ar = v.get("data-apireq","")
            ep = ""
            if ar:
                try: ep = json.loads(urllib.parse.unquote(ar)).get("e","")
                except: pass
            eps.append({"pid":pid,"ep":ep,"title":t,"apireq":ar,
                        "tserver":v.get("data-tserver",""),"vid":v.get("data-vid",""),"r18":r18})
        def ek(e):
            try: return (0,int(e["ep"]))
            except: return (1,str(e["ep"]))
        eps.sort(key=ek)
        return eps

    def resolve(self, apireq, r18=False):
        api = R18_API if r18 else API_URL
        ref = R18_BASE if r18 else BASE_URL
        h = {"Accept":"application/json,*/*;q=0.01",
             "Content-Type":"application/x-www-form-urlencoded; charset=UTF-8",
             "X-Requested-With":"XMLHttpRequest","Origin":ref,"Referer":ref+"/"}
        d = self._post(api, data="d="+apireq, headers=h).json()
        src = d["s"][0]["src"]
        return "https:"+src if src.startswith("//") else src

    def dl_one(self, url, path, ref_base):
        if path.exists():
            try:
                rh = self.sess.head(url, headers={**HEADERS,"Referer":ref_base+"/"},
                                    timeout=self.timeout, allow_redirects=True)
                rs = int(rh.headers.get("Content-Length",0))
                ls = path.stat().st_size
                if rs>0 and ls==rs:
                    print(f"      [skip] {path.name}"); return True
                resume = ls
            except: resume = 0
        else: resume = 0
        h = {**HEADERS,"Referer":ref_base+"/","Accept":"*/*"}
        mode = "ab" if resume>0 else "wb"
        if resume>0: h["Range"]=f"bytes={resume}-"
        for i in range(self.retries):
            try:
                with self.sess.get(url, headers=h, stream=True, timeout=self.timeout) as r:
                    if r.status_code==416: return True
                    r.raise_for_status()
                    tot = int(r.headers.get("Content-Length",0))+resume
                    dn = resume
                    with open(path, mode) as f:
                        for chunk in r.iter_content(CHUNK):
                            if chunk:
                                f.write(chunk); dn += len(chunk)
                                if tot>0:
                                    sys.stdout.write(f"\r      {path.name} {dn*100/tot:.1f}% {fmt_size(dn)}/{fmt_size(tot)}   ")
                                    sys.stdout.flush()
                    sys.stdout.write("\n"); return True
            except Exception as e:
                print(f"\n      [retry {i+1}] {e}")
                time.sleep(self.delay*(i+1))
        print(f"      [FAIL] {path.name}"); return False

    def save_meta(self):
        with open(self.meta_path,"w",encoding="utf-8") as f:
            json.dump(self.meta, f, ensure_ascii=False, indent=2)
        print(f"\n元數據: {self.meta_path}")

    def run(self, cat=None, year=None, season=None, meta_only=False, max_n=None):
        lst = self.fetch_list()
        if cat is not None: lst = [x for x in lst if x["cat"]==cat]
        if year: lst = [x for x in lst if x["year"]==str(year)]
        if season: lst = [x for x in lst if x["season"]==season]
        if not self.r18: lst = [x for x in lst if not x["r18"]]
        if max_n: lst = lst[:max_n]
        print(f"[2/4] 擬處理 {len(lst)} 部"); print("-"*60)
        tot=ok=fail=0
        for i,a in enumerate(lst,1):
            c,t,y,sn,g,r18 = a["cat"],a["title"],a["year"],a["season"],a["group"],a["r18"]
            tag = " [R18]" if r18 else ""
            print(f"[{i}/{len(lst)}] ({c}) {t}{tag}  {y}{sn} {g}")
            try:
                eps = self.fetch_eps(c, r18)
            except Exception as e:
                print(f"      [ERROR] 取集數失敗: {e}"); continue
            print(f"      共 {len(eps)} 集")
            aname = safe_fn(f"[{y}][{sn}][{g or 'NA'}] {t}")
            adir = self.out / aname
            adir.mkdir(exist_ok=True)
            self.meta[str(c)] = {"title":t,"year":y,"season":sn,"group":g,"r18":r18,"dir":str(adir),"episodes":[]}
            for ep in eps:
                tot += 1
                try:
                    vurl = self.resolve(ep["apireq"], r18)
                    refb = R18_BASE if r18 else BASE_URL
                    ename = safe_fn(f"{ep['title']}.mp4")
                    epath = adir / ename
                    print(f"   EP {ep['ep']}: {vurl}")
                    rec = {"ep":ep["ep"],"title":ep["title"],"url":vurl,"file":str(epath)}
                    self.meta[str(c)]["episodes"].append(rec)
                    if not meta_only:
                        if self.dl_one(vurl, epath, refb): ok+=1
                        else: fail+=1
                    else: ok+=1
                    self.save_meta()
                except Exception as e:
                    fail+=1
                    print(f"      EP {ep['ep']} 失敗: {e}")
                time.sleep(self.delay)
        print("="*60)
        print(f"[3/4] 全部處理完成: 總計 {tot} 集, 成功 {ok}, 失敗 {fail}")
        self.save_meta()
        print(f"[4/4] 下載目錄: {self.out}")
        print("="*60)

def main():
    p = argparse.ArgumentParser(description="Anime1.me 全站爬蟲下載器（完美逆向版）")
    p.add_argument("-o","--output",default="./anime1_downloads",help="下載目錄")
    p.add_argument("-j","--workers",type=int,default=3,help="併發數")
    p.add_argument("--cat",type=int,help="僅下載指定分類ID")
    p.add_argument("--year",help="按年份篩選，如 2026")
    p.add_argument("--season",help="按季節篩選，如 夏/冬/春/秋")
    p.add_argument("--r18",action="store_true",help="包含R18(anime1.pw)")
    p.add_argument("--metadata-only",action="store_true",help="僅抓元數據不下載")
    p.add_argument("--max",type=int,help="最多處理幾部作品（測試用）")
    p.add_argument("--timeout",type=int,default=120)
    p.add_argument("--retries",type=int,default=3)
    p.add_argument("--delay",type=float,default=0.8)
    a = p.parse_args()
    s = Spider(out=a.output, workers=a.workers, timeout=a.timeout,
               retries=a.retries, delay=a.delay, r18=a.r18)
    s.run(cat=a.cat, year=a.year, season=a.season,
          meta_only=a.metadata_only, max_n=a.max)

if __name__ == "__main__":
    main()
