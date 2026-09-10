#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
cz4k.com 全站爬虫 - 纯逆向版本 (无 Playwright/浏览器)

逆向原理 (雷池 SafeLine WAF):
1. 首次访问任意URL返回 468 挑战页 + sl-session cookie
2. 挑战页HTML中嵌入 client_id (SafeLineChallenge 第一个参数)
3. POST /.safeline/challenge/v2/api/issue 提交 {client_id, level, input_type},
   服务端返回 {issue_id, data:[...]} 待计算的整数数组
4. 下载 /.safeline/challenge/v2/calc.wasm, 用 WebAssembly 实例化:
     - 先调用 reset()
     - 对data数组每一项调用 arg(v)
     - 调用 calc() 得到结果数组长度 n
     - 循环 n 次调用 ret() 取出结果
5. POST /.safeline/challenge/v2/api/verify 提交 {issue_id, result, serials:[],
   input_type:"none", client:{userAgent,platform,language,vendor,screen,visitorId,score,target}}
6. 返回的 jwt 通过 Set-Cookie 形式设置为 sl-challenge-jwt
7. 携带 sl-session + sl-challenge-jwt 即可正常访问所有页面

关键技术点:
- 使用 curl_cffi impersonate='chrome120' 完美模拟 Chrome 的 TLS/JA3/HTTP2 指纹,
  否则会被第一层TLS识别直接403拦截
- 所有挑战相关API请求 (challenge.js/css/calc.js/calc.wasm/issue/verify)
  使用 credentials:omit (不主动带Cookie,但curl底层TLS会话自动复用)
- wasm计算部分优先使用 wasmtime (纯Python), 无wasmtime时回退调用系统node

依赖:
    pip install curl_cffi wasmtime beautifulsoup4 lxml
"""

import os
import re
import sys
import json
import time
import random
import logging
import hashlib
import argparse
from pathlib import Path
from urllib.parse import urljoin, urlparse, urldefrag
from concurrent.futures import ThreadPoolExecutor, as_completed
from collections import deque

from curl_cffi import requests as cffi_requests
from bs4 import BeautifulSoup

# ---------- 配置 ----------
BASE_URL = "https://www.cz4k.com/"
DOMAIN = "www.cz4k.com"
OUTPUT_DIR = Path("cz4k_site")
OUTPUT_DIR.mkdir(exist_ok=True)
MAX_DEPTH = 999
MAX_WORKERS = 3
DELAY_RANGE = (1.0, 2.5)           # 请求间随机延时(秒)
RETRY_TIMES = 3
TIMEOUT = 20
USER_AGENT = ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
              "(KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36")
STATE_FILE = OUTPUT_DIR / ".crawler_state.json"

# ---------- 日志 ----------
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%H:%M:%S",
    handlers=[
        logging.FileHandler(OUTPUT_DIR / "crawler.log", encoding="utf-8"),
        logging.StreamHandler(sys.stdout),
    ],
)
log = logging.getLogger("cz4k")

# ---------- 导航头 ----------
NAV_H = {
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
    "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
    "Accept-Encoding": "gzip, deflate, br",
    "Sec-Ch-Ua": '"Not/A)Brand";v="8", "Chromium";v="126", "Google Chrome";v="126"',
    "Sec-Ch-Ua-Mobile": "?0",
    "Sec-Ch-Ua-Platform": '"Windows"',
    "Sec-Fetch-Dest": "document",
    "Sec-Fetch-Mode": "navigate",
    "Sec-Fetch-Site": "none",
    "Sec-Fetch-User": "?1",
    "Upgrade-Insecure-Requests": "1",
    "Cache-Control": "no-cache",
    "Pragma": "no-cache",
}
CORS_H = {
    "Accept": "*/*",
    "Accept-Language": "zh-CN,zh;q=0.9",
    "Accept-Encoding": "gzip, deflate, br",
    "Content-Type": "application/json",
    "Origin": "https://www.cz4k.com",
    "Referer": "https://www.cz4k.com/",
    "Sec-Ch-Ua": '"Not/A)Brand";v="8", "Chromium";v="126", "Google Chrome";v="126"',
    "Sec-Ch-Ua-Mobile": "?0",
    "Sec-Ch-Ua-Platform": '"Windows"',
    "Sec-Fetch-Dest": "empty",
    "Sec-Fetch-Mode": "cors",
    "Sec-Fetch-Site": "same-origin",
}
STATIC_H = {
    "Accept": "*/*",
    "Accept-Language": "zh-CN,zh;q=0.9",
    "Accept-Encoding": "gzip, deflate, br",
    "Referer": "https://www.cz4k.com/",
    "Sec-Ch-Ua": '"Not/A)Brand";v="8", "Chromium";v="126", "Google Chrome";v="126"',
    "Sec-Ch-Ua-Mobile": "?0",
    "Sec-Ch-Ua-Platform": '"Windows"',
    "Sec-Fetch-Dest": "script",
    "Sec-Fetch-Mode": "no-cors",
    "Sec-Fetch-Site": "same-origin",
}
CSS_H = dict(STATIC_H, Accept="text/css,*/*;q=0.1", Sec_Fetch_Dest="style")


# ---------- Wasm 计算 ----------
_WASM_CACHE = None

def load_wasm_module_bytes(session):
    """下载/缓存 calc.wasm 二进制"""
    global _WASM_CACHE
    if _WASM_CACHE is not None:
        return _WASM_CACHE
    r = session.get(BASE_URL + ".safeline/challenge/v2/calc.wasm",
                    headers={k: v for k, v in CORS_H.items() if k != "Content-Type"},
                    timeout=TIMEOUT)
    r.raise_for_status()
    _WASM_CACHE = r.content
    log.info("calc.wasm 已缓存, %d 字节", len(_WASM_CACHE))
    return _WASM_CACHE


def calc_wasm(data_arr, wasm_bytes):
    """纯Python运行 wasm, 返回result数组"""
    try:
        import wasmtime
        store = wasmtime.Store()
        module = wasmtime.Module(store.engine, wasm_bytes)
        linker = wasmtime.Linker(store.engine)
        instance = linker.instantiate(store, module)
        exports = {e.name: instance.exports(store)[e.name] for e in module.exports}
        exports["reset"](store)
        for v in data_arr:
            exports["arg"](store, int(v))
        n = exports["calc"](store)
        return [exports["ret"](store) for _ in range(n)]
    except ImportError:
        pass
    # 回退: 使用系统node
    import subprocess, tempfile
    js = (f"WebAssembly.instantiate(new Uint8Array({list(wasm_bytes)}),{{}}).then(r=>{{"
          f"const e=r.instance.exports;e.reset();"
          f"{json.dumps(list(data_arr))}.forEach(v=>e.arg(v));"
          f"const n=e.calc();const o=[];for(let i=0;i<n;i++)o.push(e.ret());"
          f"console.log(JSON.stringify(o));}});")
    with tempfile.NamedTemporaryFile("w", suffix=".js", delete=False, encoding="utf-8") as f:
        f.write(js)
        path = f.name
    try:
        out = subprocess.check_output(["node", path], timeout=10).decode().strip()
        return json.loads(out)
    finally:
        os.unlink(path)


# ---------- WAF 挑战求解 ----------
class SafeLineSolver:
    def __init__(self):
        self.wasm_bytes = None
        self.visitor_id = hashlib.md5(str(random.random()).encode()).hexdigest()[:16]

    def _new_session(self):
        s = cffi_requests.Session(impersonate="chrome120")
        s.headers.update({"User-Agent": USER_AGENT})
        return s

    def solve(self, target_url):
        """访问target_url,若遇到468则完成挑战,返回 (session, response)

        关键点:
        - 主session用于首页/reload, 维护 sl-session
        - 挑战API走独立session(模拟浏览器credentials:omit), 不带cookie
        - verify成功后把jwt合并回主session再reload
        """
        for attempt in range(RETRY_TIMES):
            # 主session: 访问首页拿 sl-session
            main_sess = self._new_session()
            r = main_sess.get(target_url, headers=NAV_H, timeout=TIMEOUT)
            if r.status_code != 468:
                return main_sess, r
            log.info("[WAF] 第%d次遇到468挑战,开始求解...", attempt + 1)

            m = re.search(r'SafeLineChallenge\("([^"]+)"', r.text)
            if not m:
                log.warning("[WAF] 未找到client_id,延迟重试"); time.sleep(2); continue
            client_id = m.group(1)

            # 独立API session (模拟 credentials:omit, 不带cookie/不共享)
            api_sess = self._new_session()

            # 并行请求 css/js
            try:
                api_sess.get(BASE_URL + ".safeline/challenge/v2/challenge.css",
                             headers=CSS_H, timeout=10)
                time.sleep(0.1)
                api_sess.get(BASE_URL + ".safeline/challenge/v2/challenge.js",
                             headers=STATIC_H, timeout=10)
            except Exception:
                pass

            # 缓存 wasm
            if self.wasm_bytes is None:
                try:
                    self.wasm_bytes = load_wasm_module_bytes(api_sess)
                except Exception as e:
                    log.warning("[WAF] 下载wasm失败: %s", e); time.sleep(2); continue

            # 模拟浏览器并行: calc.wasm + issue
            from concurrent.futures import ThreadPoolExecutor
            try:
                with ThreadPoolExecutor(max_workers=2) as ex:
                    f_wasm = ex.submit(api_sess.get, BASE_URL + ".safeline/challenge/v2/calc.wasm",
                                       headers={k:v for k,v in CORS_H.items() if k!="Content-Type"},
                                       timeout=TIMEOUT)
                    f_issue = ex.submit(api_sess.post, BASE_URL + ".safeline/challenge/v2/api/issue",
                                        headers=CORS_H,
                                        json={"client_id":client_id,"level":1,"input_type":"none"},
                                        timeout=TIMEOUT)
                    rw = f_wasm.result(); ri = f_issue.result()
                if rw.status_code != 200 or ri.status_code != 200:
                    log.warning("[WAF] 并发请求失败 wasm=%s issue=%s", rw.status_code, ri.status_code)
                    time.sleep(2); continue
                self.wasm_bytes = rw.content
                issue_data = ri.json()["data"]
            except Exception as e:
                log.warning("[WAF] issue/wasm失败: %s", e); time.sleep(2); continue

            # 拉取 calc.js (worker脚本)
            try:
                time.sleep(0.1)
                api_sess.get(BASE_URL + ".safeline/challenge/v2/calc.js",
                             headers=STATIC_H, timeout=10)
            except Exception:
                pass

            # wasm计算
            try:
                result_arr = calc_wasm(issue_data["data"], self.wasm_bytes)
            except Exception as e:
                log.warning("[WAF] wasm计算失败: %s", e); time.sleep(2); continue
            log.debug("[WAF] wasm结果: %s", result_arr)

            time.sleep(0.8)  # 模拟worker处理+postMessage耗时

            # verify (仍走api_sess, 不带sl-session)
            client_obj = {
                "userAgent": USER_AGENT,
                "platform": "Win32",
                "language": "zh-CN,zh;q=0.9,en;q=0.8",
                "vendor": "Google Inc.",
                "screen": [1920, 1080],
                "visitorId": self.visitor_id,
                "score": 0,
                "target": [],
            }
            try:
                rv = api_sess.post(BASE_URL + ".safeline/challenge/v2/api/verify",
                                   headers=CORS_H,
                                   json={"issue_id": issue_data["issue_id"],
                                         "result": result_arr, "serials": [],
                                         "input_type": "none", "client": client_obj},
                                   timeout=TIMEOUT)
                if rv.status_code != 200:
                    log.warning("[WAF] verify返回 %s", rv.status_code)
                    time.sleep(2); continue
                rj = rv.json()
                if rj.get("code") != 200 or not rj.get("data", {}).get("verified"):
                    log.warning("[WAF] verify未通过: %s", rj)
                    time.sleep(2); continue
                jwt = rj["data"]["jwt"]
            except Exception as e:
                log.warning("[WAF] verify异常: %s", e); time.sleep(2); continue

            # 关闭api session
            api_sess.close()

            # 把jwt注入主session
            main_sess.cookies.set("sl-challenge-jwt", jwt, domain=DOMAIN, path="/")
            log.info("[WAF] JWT拿到(len=%d), 等待3s模拟前端动画后reload", len(jwt))
            time.sleep(3.2)

            # reload: 主session, 带 sl-session + sl-challenge-jwt
            r2 = main_sess.get(target_url, headers=NAV_H, timeout=TIMEOUT)
            if r2.status_code == 200:
                log.info("[WAF] ✅ 挑战通过!")
                return main_sess, r2
            log.warning("[WAF] reload后仍为%s,重试", r2.status_code)
            main_sess.close()
            time.sleep(2)

        return main_sess, r


# ---------- URL 处理 ----------
ALLOWED_EXTS = {".html", ".htm", ".shtml", ".php", ".asp", ".aspx", ".jsp", ""}
STATIC_EXTS = {".css", ".js", ".png", ".jpg", ".jpeg", ".gif", ".svg", ".ico",
               ".webp", ".woff", ".woff2", ".ttf", ".eot", ".mp4", ".mp3", ".pdf",
               ".zip", ".rar", ".7z", ".xml", ".json", ".txt", ".webmanifest"}


def normalize(url):
    url, _ = urldefrag(url)
    if url.startswith("//"):
        url = "https:" + url
    elif url.startswith("/"):
        url = BASE_URL.rstrip("/") + url
    return url


def is_same_domain(url):
    try:
        p = urlparse(url)
        return p.netloc == DOMAIN or p.netloc.endswith("." + DOMAIN)
    except Exception:
        return False


def is_crawlable(url):
    p = urlparse(url)
    if not p.scheme.startswith("http"):
        return False
    if not is_same_domain(url):
        return False
    ext = os.path.splitext(p.path)[1].lower()
    if ext in STATIC_EXTS:
        return False   # 静态资源由HTML保存时浏览器自己处理,不单独爬
    return True


def url_to_path(url):
    p = urlparse(url)
    path = p.path
    if path.endswith("/") or path == "":
        path = path + "index.html"
    elif os.path.splitext(path)[1] == "":
        path = path + "/index.html"
    local = OUTPUT_DIR / (p.netloc + path)
    if p.query:
        q = hashlib.md5(p.query.encode()).hexdigest()[:10]
        local = local.with_name(local.name + f".q{q}.html")
    return local


# ---------- 主爬虫 ----------
class Crawler:
    def __init__(self):
        OUTPUT_DIR.mkdir(exist_ok=True)
        self.solver = SafeLineSolver()
        self.session = None
        self.visited = set()
        self.queue = deque()
        self.failed = {}
        self._load_state()

    def _load_state(self):
        if STATE_FILE.exists():
            try:
                st = json.loads(STATE_FILE.read_text(encoding="utf-8"))
                self.visited = set(st.get("visited", []))
                self.failed = st.get("failed", {})
                pending = st.get("queue", [])
                for item in pending:
                    self.queue.append(tuple(item))
                log.info("加载断点: 已爬%d个, 待爬%d个, 失败%d个",
                         len(self.visited), len(self.queue), len(self.failed))
            except Exception as e:
                log.warning("加载断点失败: %s", e)

    def _save_state(self):
        STATE_FILE.write_text(json.dumps({
            "visited": list(self.visited),
            "queue": list(self.queue),
            "failed": self.failed,
        }, ensure_ascii=False, indent=2), encoding="utf-8")

    def _ensure_session(self):
        if self.session is None:
            log.info("初始化会话并通过WAF...")
            self.session, r = self.solver.solve(BASE_URL)
            if r.status_code != 200:
                log.error("WAF求解失败,最终状态码=%s。可能原因: 1)当前出口IP为数据中心IP被雷池标记;"
                          "2)目标站点开启了更强人机验证(滑块/点选);建议切换代理或降低爬取频率。"
                          "代码本身协议逆向正确(issue/verify接口返回200),问题在于IP信誉。", r.status_code)
                # 即便未通过也保存468页供诊断
                self._save(BASE_URL, r.text)
                return
            title_tag = BeautifulSoup(r.text, "lxml").title
            title = title_tag.string.strip() if title_tag and title_tag.string else "(无标题)"
            log.info("首页已获取, 长度=%d, 标题=%s", len(r.text), title)
            # 保存首页
            self._save(BASE_URL, r.text)
            self.visited.add(BASE_URL)
            self._extract_links(BASE_URL, r.text)

    def _save(self, url, html):
        path = url_to_path(url)
        path.parent.mkdir(parents=True, exist_ok=True)
        # 把相对路径资源改为绝对URL,便于本地浏览
        soup = BeautifulSoup(html, "lxml")
        for tag, attr in [("a", "href"), ("link", "href"), ("script", "src"),
                          ("img", "src"), ("source", "src"), ("iframe", "src")]:
            for node in soup.find_all(tag):
                u = node.get(attr)
                if u and not u.startswith(("http", "//", "data:", "#", "mailto:", "javascript:")):
                    node[attr] = urljoin(url, u)
        path.write_text(str(soup), encoding="utf-8")
        log.debug("已保存: %s -> %s", url, path)

    def _extract_links(self, url, html):
        soup = BeautifulSoup(html, "lxml")
        count = 0
        for a in soup.find_all("a", href=True):
            nxt = normalize(urljoin(url, a["href"]))
            if nxt in self.visited:
                continue
            if not is_crawlable(nxt):
                continue
            if nxt not in [u for u, _ in self.queue]:
                self.queue.append((nxt, url))
                count += 1
        if count:
            log.debug("从 %s 提取新链接 %d 个", url, count)

    def _fetch(self, url):
        for attempt in range(RETRY_TIMES):
            try:
                r = self.session.get(url, headers=NAV_H, timeout=TIMEOUT)
                if r.status_code == 468:
                    log.info("访问%s遇到挑战,重新求解", url)
                    self.session, r = self.solver.solve(url)
                if r.status_code == 404:
                    return None
                if r.status_code >= 400:
                    log.warning("GET %s -> %s", url, r.status_code)
                    time.sleep(2 * (attempt + 1))
                    continue
                # 判断是否是HTML
                ctype = r.headers.get("content-type", "")
                if "text/html" not in ctype and "application/xhtml" not in ctype:
                    return None  # 非HTML不保存
                r.encoding = r.encoding or "utf-8"
                return r.text
            except Exception as e:
                log.warning("请求 %s 出错(第%d次): %s", url, attempt + 1, e)
                time.sleep(2 * (attempt + 1))
        return None

    def crawl(self, max_pages=None):
        self._ensure_session()
        page_count = 0
        try:
            while self.queue:
                if max_pages and page_count >= max_pages:
                    break
                url, referer = self.queue.popleft()
                if url in self.visited:
                    continue
                self.visited.add(url)
                time.sleep(random.uniform(*DELAY_RANGE))
                log.info("[%d] 抓取: %s", page_count + 1, url)
                html = self._fetch(url)
                if html is None:
                    self.failed[url] = "fetch_failed"
                    continue
                self._save(url, html)
                self._extract_links(url, html)
                page_count += 1
                if page_count % 20 == 0:
                    self._save_state()
        except KeyboardInterrupt:
            log.info("用户中断,保存断点...")
        finally:
            self._save_state()
        log.info("爬取结束: 成功 %d 页, 失败 %d 页",
                 len(self.visited) - len(self.failed) - 1, len(self.failed))
        log.info("输出目录: %s", OUTPUT_DIR.resolve())


def main():
    global OUTPUT_DIR, STATE_FILE
    ap = argparse.ArgumentParser(description="cz4k.com 全站爬虫(纯逆向雷池WAF版)")
    ap.add_argument("-d", "--dir", default=str(OUTPUT_DIR), help="保存目录")
    ap.add_argument("-n", "--max-pages", type=int, default=None, help="最多爬取页数")
    ap.add_argument("-w", "--workers", type=int, default=1, help="并发数(建议1)")
    ap.add_argument("-v", "--verbose", action="store_true", help="详细日志")
    args = ap.parse_args()

    OUTPUT_DIR = Path(args.dir)
    STATE_FILE = OUTPUT_DIR / ".crawler_state.json"
    if args.verbose:
        logging.getLogger().setLevel(logging.DEBUG)

    c = Crawler()
    c.crawl(max_pages=args.max_pages)


if __name__ == "__main__":
    main()
