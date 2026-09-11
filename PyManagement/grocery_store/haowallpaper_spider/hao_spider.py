#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
哲风壁纸 (haowallpaper.com) 全站爬虫
=============================================
【完美逆向说明】

1. API AES-128-CBC (PKCS7):
   Key=b"68zhehao2O776519"  IV=b"aa176b7519e84710"
   明文JSON -> AES加密 -> hex串 -> base64, 作为 query 的 data 参数.
   响应的 data 字段反向解密.

2. 匿名 token: 未登录时请求头必须带 token: ack:<32位hex随机串>,
   否则 401 未授权.

3. ALTCHA PoW 反爬:
   GET  /pc/certify/challenge -> {challenge, salt, maxnumber, signature...}
   找 0<=n<=maxnumber 使 SHA256(salt+str(n))==challenge (本地0.2秒可解)
   POST /pc/certify/verify  body={payload: base64(紧凑JSON)}
   成功后必须复用同一Session再请求 getCompleteUrl 才能拿到 down.haowallpaper.com 直链.
   直链带 zfsign 时效签名, 拿到立即下载.

用法:
  python3 hao_spider.py                       # 默认第1页起爬, 保存 ./wallpapers
  python3 hao_spider.py --start 1 --end 10    # 爬1~10页
  python3 hao_spider.py --only-list           # 仅元数据
  python3 hao_spider.py --delay 1.0 --out ./w # 慢一点/指定目录
"""

import argparse, base64, hashlib, json, secrets, sys, time
from pathlib import Path
from urllib.parse import urlparse
import requests
from Crypto.Cipher import AES
from Crypto.Util.Padding import pad, unpad

AES_KEY = b"68zhehao2O776519"
AES_IV  = b"aa176b7519e84710"
API_BASE = "https://haowallpaper.com/link"
SITE_BASE = "https://haowallpaper.com"
UA = ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36")


def aes_enc(plaintext: str) -> str:
    c = AES.new(AES_KEY, AES.MODE_CBC, AES_IV)
    ct = c.encrypt(pad(plaintext.encode("utf-8"), AES.block_size))
    return base64.b64encode(bytes.fromhex(ct.hex())).decode("ascii")


def aes_dec(b64: str) -> str:
    raw = base64.b64decode(b64)
    c = AES.new(AES_KEY, AES.MODE_CBC, AES_IV)
    pt = c.decrypt(raw)
    pad_len = pt[-1]
    if 1 <= pad_len <= 16 and all(b == pad_len for b in pt[-pad_len:]):
        pt = pt[:-pad_len]
    return pt.decode("utf-8", errors="replace")


def parse_json(text: str):
    if not text:
        return None
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        pass
    for ch in ("}", "]"):
        i = text.rfind(ch)
        while i > 0:
            try:
                return json.loads(text[:i+1])
            except json.JSONDecodeError:
                i = text.rfind(ch, 0, i)
    raise ValueError("bad json: " + text[:200])


def sha256(s: str) -> str:
    return hashlib.sha256(s.encode("utf-8")).hexdigest()


def solve_pow(salt: str, challenge: str, maxnum: int) -> int:
    for n in range(maxnum + 1):
        if sha256(salt + str(n)) == challenge:
            return n
    raise RuntimeError(f"PoW fail max={maxnum}")


class Spider:
    def __init__(self, out="./wallpapers", only_list=False, delay=0.8):
        self.out = Path(out); self.out.mkdir(parents=True, exist_ok=True)
        self.meta = self.out / "_meta"; self.meta.mkdir(exist_ok=True)
        self.only_list = only_list; self.delay = delay
        self.sess = requests.Session()
        self._refresh()
        self.done = self._load_done()

    def _refresh(self):
        self.token = "ack:" + secrets.token_hex(16)
        self.sess.headers.clear(); self.sess.cookies.clear()
        self.sess.headers.update({
            "User-Agent": UA,
            "Accept": "application/json, text/plain, */*",
            "Accept-Language": "zh-CN,zh;q=0.9",
            "Referer": SITE_BASE + "/",
            "Cache-Control": "no-cache",
            "token": self.token,
        })
        try:
            self.sess.get(SITE_BASE + "/", timeout=10)
            self.get_list(1, 12)
        except Exception as e:
            print(f"[warn] refresh session: {e}", file=sys.stderr)

    def _load_done(self):
        p = self.out / "_downloaded.txt"
        return set(p.read_text(encoding="utf-8").split()) if p.exists() else set()

    def _mark(self, fid):
        with (self.out / "_downloaded.txt").open("a", encoding="utf-8") as f:
            f.write(fid + "\n")
        self.done.add(fid)

    def get_list(self, page, rows=12):
        pl = {"page": page, "rows": rows, "sortType": 3,
              "isFavorites": False, "wpType": None, "lbId": ""}
        r = self.sess.get(API_BASE + "/pc/wallpaper/wallpaperList",
                          params={"data": aes_enc(json.dumps(pl, ensure_ascii=False))}, timeout=15)
        r.raise_for_status()
        j = r.json()
        if j.get("status") != 200:
            raise RuntimeError(f"list err: {j}")
        return parse_json(aes_dec(j["data"]))

    def altcha(self):
        try:
            ch = self.sess.get(API_BASE + "/pc/certify/challenge", timeout=10).json()
            n = solve_pow(ch["salt"], ch["challenge"], ch["maxnumber"])
            obj = {"algorithm": ch["algorithm"], "challenge": ch["challenge"],
                   "number": n, "salt": ch["salt"], "signature": ch["signature"]}
            pb = base64.b64encode(json.dumps(obj, separators=(",", ":")).encode()).decode()
            rr = self.sess.post(API_BASE + "/pc/certify/verify",
                                json={"payload": pb}, timeout=10)
            return rr.json().get("status") == 200
        except Exception as e:
            print(f"  [warn] altcha: {e}", file=sys.stderr)
            return False

    def get_orig_url(self, wtid, retry=4):
        url = f"{API_BASE}/common/file/getCompleteUrl/{wtid}"
        hdrs = {"Referer": f"{SITE_BASE}/homeViewLook/{wtid}"}
        for i in range(retry + 1):
            r = self.sess.get(url, headers=hdrs, timeout=15)
            try:
                j = r.json()
            except Exception:
                return None
            s, msg = j.get("status"), j.get("msg") or ""
            if s == 200:
                return j["data"]
            if s in (305, 3004) or "3004" in msg:
                if i < retry:
                    print(f"  altcha verify (try {i+1})...", file=sys.stderr)
                    if self.altcha():
                        time.sleep(0.6); continue
                    time.sleep(1); continue
            if s == 401:
                print("  401, refresh session...", file=sys.stderr)
                self._refresh(); time.sleep(0.5); continue
            print(f"  getCompleteUrl err: {s} {msg}", file=sys.stderr)
            return None
        return None

    def download_one(self, item):
        wtid, fid = item["wtId"], item["fileId"]
        if fid in self.done:
            return False
        labels = "_".join(item.get("labelList", [])[:3]) or "wallpaper"
        safe = "".join(c for c in labels if c.isalnum() or c in "_-").strip("_") or "wp"
        orig = self.get_orig_url(wtid)
        if not orig:
            print(f"  [FAIL] wtid={wtid}")
            return False
        try:
            r = self.sess.get(orig, timeout=120, stream=True,
                              headers={"Referer": f"{SITE_BASE}/homeViewLook/{wtid}"})
            r.raise_for_status()
            ct = r.headers.get("content-type", "")
            ext = ".jpg"
            if "png" in ct: ext = ".png"
            elif "jpeg" in ct or "jpg" in ct: ext = ".jpg"
            elif "webp" in ct: ext = ".webp"
            elif "mp4" in ct or "video" in ct: ext = ".mp4"
            elif "gif" in ct: ext = ".gif"
            else:
                p = urlparse(orig).path
                ext = ("." + p.rsplit(".",1)[-1]) if "." in p else ".bin"
            fname = f"{fid}_{item.get('rw','')}x{item.get('rh','')}_{safe[:50]}{ext}"
            fpath = self.out / fname
            total = 0
            with fpath.open("wb") as f:
                for chunk in r.iter_content(65536):
                    if chunk:
                        f.write(chunk); total += len(chunk)
            print(f"  [OK] {fname} ({total/1048576:.2f} MB)")
        except Exception as e:
            print(f"  [DL FAIL] wtid={wtid}: {e}", file=sys.stderr)
            return False
        (self.meta / f"{fid}.json").write_text(
            json.dumps(item, ensure_ascii=False, indent=2), encoding="utf-8")
        self._mark(fid)
        return True

    def crawl(self, start=1, end=None):
        page = start; total_pages = None
        while end is None or page <= end:
            print(f"\n===== page {page} =====")
            try:
                data = self.get_list(page, 12)
            except Exception as e:
                print(f"  list fail: {e}, retry in 2s"); time.sleep(2); continue
            total_pages = data.get("pages", total_pages)
            items = data.get("list", [])
            if not items:
                print("  empty, stop."); break
            print(f"  {len(items)} items (~{total_pages} pages / {data.get('total')} total)")
            for it in items:
                if not it.get("fileId"): continue
                tn = {1:"IMG",2:"MOBILE",3:"VIDEO"}.get(it.get("type",1),f"t{it.get('type')}")
                print(f"  - [{tn}] {it.get('rw','')}x{it.get('rh','')} "
                      f"{'/'.join(it.get('labelList',[])[:4])[:60]} ({it.get('fileMb','')})")
                if not self.only_list:
                    try: self.download_one(it)
                    except Exception as e: print(f"    [ex] {e}", file=sys.stderr)
                    time.sleep(self.delay)
            (self.meta / f"page_{page}.json").write_text(
                json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
            page += 1; time.sleep(self.delay)
        print(f"\nDone. Pages to {page-1}, files in: {self.out.resolve()}")


def main():
    ap = argparse.ArgumentParser(description="haowallpaper.com 全站爬虫 —— 完美逆向 AES+token+ALTCHA")
    ap.add_argument("--out", default="./wallpapers")
    ap.add_argument("--start", type=int, default=1)
    ap.add_argument("--end", type=int, default=None)
    ap.add_argument("--only-list", action="store_true")
    ap.add_argument("--delay", type=float, default=0.8)
    args = ap.parse_args()
    if sys.platform == "win32":
        sys.stdout.reconfigure(encoding="utf-8")
    s = Spider(out=args.out, only_list=args.only_list, delay=args.delay)
    try:
        s.crawl(start=args.start, end=args.end)
    except KeyboardInterrupt:
        print("\n[interrupted] progress saved, rerun to resume.")


if __name__ == "__main__":
    main()
