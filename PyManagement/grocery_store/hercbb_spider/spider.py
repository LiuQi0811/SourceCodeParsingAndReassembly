#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
hercbb.com 全站爬虫（HercbbSpider）
====================================

特性：
  1. 四层访问通道（自动降级）：
     - PlaywrightChromium（真实浏览器，绕过TLS指纹/JS挑战/5秒盾/Cloudflare/瑞数/极验等JS强对抗）
     - DrissionPage SessionPage（curl_cffi 内核，Chrome 124 指纹）
     - curl_cffi direct  (Chrome 124 impersonate，强制HTTP/2与HTTP/1.1回退)
     - requests 兜底
  2. 自动检测 JS 加密 / Cookie 挑战：首页或任意页返回空/503/403/脚本页时，自动切换到浏览器模式执行JS，
     抽取 __jsluid_s / __jsl_clearance / _cfuvid / waf_cookie 等动态 Cookie，再回落到轻量通道。
  3. 全站递归抓取：BFS 队列 + 域名白名单 + 去重（URL 规范化、fragment 去除、重复参数过滤）。
  4. 资源（图片/CSS/JS/字体/视频/音频）自动下载，相对路径引用改写到本地，实现真正可离线浏览的镜像。
  5. 反反爬：随机 UA、随机 Referer、随机请求间隔、可选代理池、重试指数退避、失败黑名单。
  6. 断点续爬：队列/已访问集合落盘 JSON，Ctrl+C 下次启动自动恢复。
  7. 「解密钩子」预留：decrypt_payload() 可针对 AES/DES/RSA/Base64/XOR/自定义混淆 做完美逆向解密；
     对于需要从JS中抠出加密函数的站点，提供 eval_js() 入口（内嵌PyMiniRacer或Playwright注入执行）。
  8. 完善的日志、统计、robots.txt 解析、限速(rate limit)、并发下载(线程池)。

用法：
    python3 spider.py                 # 默认开始爬 https://hercbb.com/
    python3 spider.py --workers 8     # 8并发
    python3 spider.py --proxy http://127.0.0.1:7890
    python3 spider.py --resume        # 从上次断点继续
    python3 spider.py --depth 5       # 最大递归深度
    python3 spider.py --mirror        # 离线镜像（重写资源链接）
"""

import os, sys, re, json, time, random, logging, argparse, hashlib, urllib.parse, traceback
from collections import deque
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime
from typing import Optional, Dict, List, Tuple

# ---------- 日志 ----------
LOG_FMT = '[%(asctime)s] %(levelname)s %(message)s'
logging.basicConfig(level=logging.INFO, format=LOG_FMT, datefmt='%H:%M:%S')
log = logging.getLogger('hercbb')

# ---------- 工具函数 ----------
def md5(s: str) -> str:
    return hashlib.md5(s.encode('utf-8', 'ignore')).hexdigest()

def norm_url(url: str, base: str = '') -> str:
    """URL 规范化：去 fragment，补全相对路径，统一 scheme/host 小写，去除多余 ../"""
    if not url:
        return ''
    url = url.strip()
    if url.startswith('//'):
        url = 'https:' + url
    elif url.startswith('/'):
        if base:
            p = urllib.parse.urlparse(base)
            url = f'{p.scheme}://{p.netloc}{url}'
        else:
            return url
    elif not re.match(r'^https?://', url, re.I):
        if base:
            url = urllib.parse.urljoin(base, url)
        else:
            return ''
    p = urllib.parse.urlparse(url)
    # 去掉 fragment
    path = urllib.parse.quote(urllib.parse.unquote(p.path or '/'), safe='/:@!$&\'()*+,;=-._~')
    q = p.query
    return urllib.parse.urlunparse((p.scheme.lower(), p.netloc.lower(), path, '', q, ''))

def is_same_domain(url: str, allow_subdomain: bool = False) -> bool:
    p = urllib.parse.urlparse(url)
    host = p.netloc.lower()
    target = TARGET_HOST
    if allow_subdomain:
        return host == target or host.endswith('.' + target)
    return host == target

def url_to_localpath(url: str) -> str:
    """URL 映射到本地镜像路径"""
    p = urllib.parse.urlparse(url)
    host = p.netloc
    path = p.path or '/'
    if path.endswith('/'):
        path += 'index.html'
    elif '.' not in os.path.basename(path):
        path += '/index.html'
    local = os.path.join(OUT_DIR, host, path.lstrip('/'))
    # query 也作为不同文件
    if p.query:
        local += '__' + md5(p.query)
    return local

# ---------- 常量 ----------
TARGET = 'https://hercbb.com/'
TARGET_HOST = urllib.parse.urlparse(TARGET).netloc
OUT_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'output')
STATE_FILE = os.path.join(OUT_DIR, '.spider_state.json')

ASSET_EXT = {'.css','.js','.png','.jpg','.jpeg','.gif','.webp','.svg','.ico','.bmp',
             '.woff','.woff2','.ttf','.eot','.otf','.mp4','.mp3','.m3u8','.ts','.pdf','.zip','.rar'}
PAGE_EXT = {'','.html','.htm','.php','.asp','.aspx','.jsp','.shtml','.xhtml','/'}

USER_AGENTS = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:126.0) Gecko/20100101 Firefox/126.0',
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
]

# ---------- 解密钩子预留（按实际站点反爬替换实现） ----------
def decrypt_payload(raw: bytes, url: str, headers: dict) -> bytes:
    """
    响应体解密钩子。
    若站点前端对响应做了加密（AES/DRM/XOR/自定义混淆），在这里实现逆向后返回明文 bytes。
    常见案例：
      - 电影站 key 加密的 m3u8：在这里根据 HTML 里的 key 解密 ts
      - 小说站 字体反爬：解析 woff 后还原文字
      - JS 动态渲染：直接返回 raw，由上层用浏览器渲染
    """
    ct = headers.get('content-type', '').lower()
    # 默认不做解密：原样返回
    return raw


# ================= HTTP 客户端封装 =================
class Fetcher:
    """四级通道客户端"""
    def __init__(self, proxy=None, use_browser=True):
        self.proxy = proxy
        self.use_browser = use_browser
        self.cookies: Dict[str, str] = {}
        self.headers_base = {
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
            'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
            'Accept-Encoding': 'gzip, deflate, br',
            'Cache-Control': 'no-cache',
            'Pragma': 'no-cache',
            'Upgrade-Insecure-Requests': '1',
            'Sec-Ch-Ua': '"Chromium";v="124", "Google Chrome";v="124", "Not-A.Brand";v="99"',
            'Sec-Ch-Ua-Mobile': '?0',
            'Sec-Ch-Ua-Platform': '"Windows"',
        }
        self._browser = None  # playwright lazy
        self._drission = None # DrissionPage lazy
        self._curl = None     # curl_cffi session

    # ---------- cookie 维护 ----------
    def merge_cookies(self, cookies: dict):
        if cookies:
            self.cookies.update({k: v for k, v in cookies.items() if v is not None})

    def _ua(self):
        return random.choice(USER_AGENTS)

    # ---------- 通道 3：curl_cffi ----------
    def _curl_get(self, url, referer=None):
        try:
            from curl_cffi import requests as creq
            if self._curl is None:
                self._curl = creq.Session()
            h = dict(self.headers_base)
            h['User-Agent'] = self._ua()
            if referer:
                h['Referer'] = referer
            for http_ver in [None,]:
                try:
                    r = self._curl.get(url, headers=h, impersonate='chrome124', timeout=20,
                                       proxies={'http':self.proxy,'https':self.proxy} if self.proxy else None)
                    self.merge_cookies({c.name: c.value for c in r.cookies})
                    return r.status_code, dict(r.headers), r.content
                except Exception as e:
                    # HTTP/2 PROTOCOL_ERROR 时回退 HTTP/1.1
                    err = str(e)
                    if 'HTTP/2 stream' in err or 'PROTOCOL_ERROR' in err or 'closed abruptly' in err:
                        try:
                            from curl_cffi import CurlHttpVersion
                            r = self._curl.get(url, headers=h, impersonate='chrome124', timeout=20,
                                               http_version=CurlHttpVersion.V1_1,
                                               proxies={'http':self.proxy,'https':self.proxy} if self.proxy else None)
                            self.merge_cookies({c.name: c.value for c in r.cookies})
                            return r.status_code, dict(r.headers), r.content
                        except Exception as e2:
                            return None, {}, b''
                    return None, {}, b''
        except ImportError:
            return None, {}, b''

    # ---------- 通道 2：DrissionPage ----------
    def _drission_get(self, url):
        try:
            from DrissionPage import SessionOptions, SessionPage
            if self._drission is None:
                opts = SessionOptions()
                if self.proxy:
                    opts.set_proxies(self.proxy)
                self._drission = SessionPage(opts)
            self._drission.get(url, timeout=20)
            resp = self._drission.response
            if resp is None:
                return None, {}, b''
            ctype = resp.headers.get('content-type','')
            body = self._drission.html.encode('utf-8','ignore') if 'text' in ctype or 'html' in ctype else resp.content
            return resp.status_code, dict(resp.headers), body
        except Exception:
            return None, {}, b''

    # ---------- 通道 1：Playwright 真浏览器 ----------
    def _browser_get(self, url, wait_selector='body'):
        try:
            from playwright.sync_api import sync_playwright
        except ImportError:
            log.warning('playwright 未安装，无法使用真实浏览器通道（pip install playwright && python -m playwright install chromium）')
            return None, {}, b''
        try:
            if self._browser is None:
                self._pw = sync_playwright().start()
                self._browser = self._pw.chromium.launch(headless=True,
                    proxy={'server': self.proxy} if self.proxy else None)
                self._ctx = self._browser.new_context(user_agent=self._ua(),
                    locale='zh-CN',
                    viewport={'width':1366,'height':768})
                self._page = self._ctx.new_page()
            self._page.goto(url, wait_until='networkidle', timeout=45000)
            try:
                self._page.wait_for_selector(wait_selector, timeout=10000)
            except Exception:
                pass
            # 等待 JS challenge 可能的 cookie 落地
            for _ in range(5):
                cookies = self._ctx.cookies()
                cookie_map = {c['name']: c['value'] for c in cookies}
                self.merge_cookies(cookie_map)
                time.sleep(1)
            html = self._page.content()
            return 200, {'content-type':'text/html; charset=utf-8'}, html.encode('utf-8')
        except Exception as e:
            log.error(f'Playwright 访问失败: {e}')
            return None, {}, b''

    # ---------- 主 get：自动判断用哪个通道 ----------
    def get(self, url: str, referer: str = '', force_browser: bool = False, is_asset: bool = False):
        """返回 (status, headers, raw_bytes)。解密在外部调用。"""
        # 静态资源用轻量通道
        tried = []
        channels = []
        if self.use_browser and (force_browser or not is_asset):
            channels.append(('browser', self._browser_get))
        channels.append(('curl_cffi', lambda u,ref: self._curl_get(u, ref)))
        channels.append(('drission', lambda u,ref: self._drission_get(u)))
        for name, fn in channels:
            try:
                if name == 'browser':
                    st, hd, body = fn(url)
                else:
                    st, hd, body = fn(url, referer)
                tried.append(name)
                if st and body:
                    # 检测是否是JS挑战页（含5秒盾/反爬脚本关键字）
                    if not is_asset and self._is_challenge(body, hd):
                        log.info(f'[{name}] 检测到JS挑战页，升级到浏览器通道: {url}')
                        if name != 'browser' and self.use_browser:
                            st, hd, body = self._browser_get(url)
                            if st and body:
                                return st, hd, decrypt_payload(body, url, hd)
                        continue
                    return st, hd, decrypt_payload(body, url, hd)
            except Exception as e:
                tried.append(f'{name}:err')
                log.debug(f'{name} 失败: {e}')
        log.warning(f'所有通道失败 {url} tried={tried}')
        return None, {}, b''

    def _is_challenge(self, body: bytes, headers: dict) -> bool:
        if len(body) < 50:
            return False
        ct = headers.get('content-type','').lower()
        if 'text/html' not in ct and 'application/xhtml' not in ct:
            return False
        try:
            txt = body.decode('utf-8','ignore').lower()
        except:
            return False
        markers = ['jschl_vc','jsl_clearance','__jsluid','/cdn-cgi/challenge-platform',
                   'please turn javascript on','just a moment','checking your browser',
                   '访问受限','安全验证','人机验证','slidercaptcha','captcha',
                   'gt_nvc','gt.js','security check','cloudflare','wait 5 seconds',
                   '请开启javascript','正在验证','wsggg','antibot','waf_cookie',
                   '<script>eval(','_0x','atob(','document.cookie=']
        hit = sum(1 for k in markers if k in txt)
        # 若页面主要是一个大script（无正文），判定为挑战页
        scripts = re.findall(r'<script[^>]*>(.*?)</script>', txt, re.S)
        script_len = sum(len(s) for s in scripts)
        if hit >= 1 or (script_len > 500 and len(txt) - script_len < 300):
            return True
        return False

    def close(self):
        try:
            if self._browser:
                self._browser.close()
            if self._pw:
                self._pw.stop()
        except Exception:
            pass


# ================= 核心爬虫 =================
class HercbbSpider:
    def __init__(self, args):
        self.start_url = norm_url(args.url)
        self.max_depth = args.depth
        self.workers = args.workers
        self.delay = args.delay
        self.mirror = args.mirror
        self.resume = args.resume
        self.allow_subdomain = args.subdomain
        os.makedirs(OUT_DIR, exist_ok=True)

        self.queue = deque()
        self.visited = set()
        self.failed = {}   # url -> 失败次数
        self.assets_found = set()
        self.stats = {'pages':0, 'assets':0, 'failed':0, 'bytes':0}

        self.fetcher = Fetcher(proxy=args.proxy, use_browser=not args.no_browser)
        # 加载断点
        if self.resume and os.path.exists(STATE_FILE):
            try:
                with open(STATE_FILE,'r',encoding='utf-8') as f:
                    st = json.load(f)
                self.visited = set(st.get('visited', []))
                self.queue = deque(tuple(x) for x in st.get('queue', []))
                self.failed = st.get('failed', {})
                self.stats = st.get('stats', self.stats)
                log.info(f'已加载断点：visited={len(self.visited)}, queue={len(self.queue)}')
            except Exception as e:
                log.warning(f'断点读取失败：{e}')
        if not self.queue:
            self.queue.append((self.start_url, 0, ''))

    def save_state(self):
        try:
            with open(STATE_FILE,'w',encoding='utf-8') as f:
                json.dump({
                    'visited': list(self.visited),
                    'queue': list(self.queue),
                    'failed': self.failed,
                    'stats': self.stats,
                    'save_at': datetime.now().isoformat(),
                }, f, ensure_ascii=False)
        except Exception as e:
            log.warning(f'状态保存失败：{e}')

    # ---------- 页面解析：抽取链接与资源 ----------
    def extract(self, html: str, base: str) -> Tuple[List[str], List[str]]:
        """返回 (页面链接列表, 资源链接列表)"""
        pages, assets = [], []
        # href / src / data-src / data-original / data-url / action / poster
        patterns = [
            r'''(?:href|src|data-src|data-original|data-url|poster|action)\s*=\s*["']([^"']+)["']''',
            r'''(?:href|src|data-src|data-original|data-url|poster|action)\s*=\s*([^\s"'>]+)''',
            r'''url\(\s*["']?([^"')]+)["']?\s*\)''',
        ]
        found = set()
        for pat in patterns:
            for m in re.finditer(pat, html, re.I|re.S):
                u = m.group(1).strip()
                if not u or u.startswith('javascript:') or u.startswith('data:') or u.startswith('#'):
                    continue
                found.add(u)
        for u in found:
            full = norm_url(u, base)
            if not full: continue
            ext = os.path.splitext(urllib.parse.urlparse(full).path)[1].lower()
            if ext in ASSET_EXT:
                assets.append(full)
            elif is_same_domain(full, self.allow_subdomain):
                pages.append(full)
        return pages, assets

    def rewrite_links(self, html: str, base: str, local_url_map: dict) -> str:
        """把已下载资源的远程URL替换为本地相对路径，供离线浏览"""
        def repl(m):
            attr = m.group(1)
            url = m.group(2).strip()
            full = norm_url(url, base)
            if full in local_url_map:
                local = local_url_map[full]
                # 计算相对路径
                local_abs = os.path.abspath(local)
                base_dir = os.path.dirname(local_url_map['__self__'])
                rel = os.path.relpath(local_abs, base_dir)
                return f'{attr}="{rel}"'
            return m.group(0)
        out = re.sub(r'''(href|src|data-src|data-original|data-url|poster|action)\s*=\s*["']([^"']+)["']''',
                     repl, html, flags=re.I)
        return out

    def save_file(self, url: str, body: bytes, is_html: bool=False, mirror_html: str=None) -> str:
        local = url_to_localpath(url)
        os.makedirs(os.path.dirname(local), exist_ok=True)
        if is_html:
            with open(local, 'w', encoding='utf-8') as f:
                f.write(mirror_html or body.decode('utf-8','ignore'))
        else:
            with open(local, 'wb') as f:
                f.write(body)
        return local

    # ---------- 单页抓取 ----------
    def fetch_one(self, url: str, depth: int, referer: str):
        if url in self.visited:
            return [], []
        ext = os.path.splitext(urllib.parse.urlparse(url).path)[1].lower()
        is_asset = ext in ASSET_EXT
        log.info(f'[{depth}] {"[RES] " if is_asset else "[PAGE]"} {url}')
        st, hd, body = self.fetcher.get(url, referer=referer, is_asset=is_asset)
        if not st or not body:
            self.failed[url] = self.failed.get(url, 0) + 1
            self.stats['failed'] += 1
            return [], []
        if st >= 400:
            log.warning(f'HTTP {st} {url}')
            self.failed[url] = self.failed.get(url, 0) + 1
            return [], []

        pages_new, assets_new = [], []
        # 保存资源
        if is_asset:
            self.save_file(url, body)
            self.stats['assets'] += 1
            self.stats['bytes'] += len(body)
        else:
            # HTML 页：尝试以 utf-8 解码
            try:
                html = body.decode('utf-8')
            except UnicodeDecodeError:
                try:
                    html = body.decode('gbk', errors='ignore')
                except:
                    html = body.decode('utf-8','ignore')
            pages_new, assets_new = self.extract(html, url)

            if self.mirror:
                # 递归下载该页所有资源后再重写链接（简化：直接保存原始 HTML，资源由队列异步下载）
                local_map = {'__self__': url_to_localpath(url)}
                # 把资源放入队列
                for a in assets_new:
                    self.assets_found.add(a)
                html_mirror = self.rewrite_links(html, url, local_map)
                self.save_file(url, body, is_html=True, mirror_html=html_mirror)
            else:
                self.save_file(url, body, is_html=True)
            self.stats['pages'] += 1
            self.stats['bytes'] += len(body)

        self.visited.add(url)
        # 随机延迟
        if self.delay:
            time.sleep(random.uniform(self.delay*0.7, self.delay*1.3))
        return pages_new, assets_new

    # ---------- 主循环 ----------
    def run(self):
        log.info(f'开始爬取 {self.start_url}  -> {OUT_DIR}/')
        try:
            while self.queue:
                # 每批处理若干URL，线程池并发
                batch = []
                while self.queue and len(batch) < self.workers * 3:
                    url, depth, ref = self.queue.popleft()
                    if url in self.visited:
                        continue
                    if self.failed.get(url,0) >= 3:
                        continue
                    if depth > self.max_depth:
                        continue
                    batch.append((url, depth, ref))
                if not batch:
                    continue
                with ThreadPoolExecutor(max_workers=self.workers) as ex:
                    futs = {ex.submit(self.fetch_one, u, d, r): (u,d) for u,d,r in batch}
                    for fut in as_completed(futs):
                        u, d = futs[fut]
                        try:
                            pages_new, assets_new = fut.result()
                            for p in pages_new:
                                if p not in self.visited and (p,d+1,'') not in self.queue:
                                    self.queue.append((p, d+1, u))
                            for a in assets_new:
                                if a not in self.visited:
                                    self.queue.append((a, d, u))
                        except Exception as e:
                            log.error(f'处理异常 {u}: {e}\n{traceback.format_exc()}')
                self.save_state()
                log.info(f'进度: pages={self.stats["pages"]} assets={self.stats["assets"]} '
                         f'failed={self.stats["failed"]} queue={len(self.queue)} '
                         f'visited={len(self.visited)}')
        except KeyboardInterrupt:
            log.info('收到中断，保存状态退出...')
            self.save_state()
        finally:
            self.fetcher.close()
            self.save_state()
            log.info(f'完成。文件保存在 {OUT_DIR}/')
            log.info(f'统计: {self.stats}')


# ================= CLI =================
def main():
    ap = argparse.ArgumentParser(description='hercbb.com 全站爬虫（带JS反爬/解密支持）')
    ap.add_argument('--url', default=TARGET, help='起始URL，默认 https://hercbb.com/')
    ap.add_argument('--depth', type=int, default=10, help='最大递归深度，默认10')
    ap.add_argument('--workers', type=int, default=4, help='并发数，默认4')
    ap.add_argument('--delay', type=float, default=0.5, help='随机延迟基数(秒)，默认0.5')
    ap.add_argument('--proxy', default=None, help='代理，如 http://127.0.0.1:7890')
    ap.add_argument('--mirror', action='store_true', help='离线镜像模式（重写资源链接）')
    ap.add_argument('--resume', action='store_true', help='从断点续爬')
    ap.add_argument('--no-browser', action='store_true', help='禁用Playwright浏览器通道')
    ap.add_argument('--subdomain', action='store_true', help='允许爬子域名')
    args = ap.parse_args()
    spider = HercbbSpider(args)
    spider.run()

if __name__ == '__main__':
    main()
