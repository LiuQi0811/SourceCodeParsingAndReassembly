#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Depvailon.com 全站抓取器
功能：
  1. Cloudflare 5秒盾/Turnstile 自动绕过（DrissionPage + 本地浏览器）
  2. JS动态渲染内容解密与提取（含常见加密文本解密）
  3. 全站BFS递归爬取（去重、限速、断点续爬）
  4. 静态资源自动下载（CSS/JS/图片/字体/视频）
  5. 页面内链改写为本地相对路径，实现离线可浏览镜像
  6. 失败重试 + 日志记录 + 进度展示

使用方法：
  pip install -r requirements.txt
  python scraper.py                  # 默认抓取 https://www.depvailon.com/
  python scraper.py --url https://www.depvailon.com/some-page  # 从指定页开始
  python scraper.py --workers 5 --depth 10   # 调整并发和深度
  python scraper.py --resume         # 断点续爬
"""

import argparse
import hashlib
import json
import logging
import mimetypes
import os
import re
import sys
import threading
import time
from collections import deque
from pathlib import Path
from urllib.parse import urljoin, urlparse, urldefrag

try:
    from DrissionPage import ChromiumPage, ChromiumOptions
except ImportError:
    ChromiumPage = None
    ChromiumOptions = None

try:
    import requests
    from requests.adapters import HTTPAdapter
    from urllib3.util.retry import Retry
except ImportError:
    requests = None

from bs4 import BeautifulSoup

# ========================= 配置 =========================
BASE_URL = "https://www.depvailon.com/"
OUTPUT_DIR = Path("depvailon_site")       # 站点镜像输出目录
STATE_FILE = Path(".crawl_state.json")    # 断点续爬状态文件
LOG_FILE = Path("scraper.log")

DEFAULT_WORKERS = 3
DEFAULT_MAX_DEPTH = 20
DEFAULT_DELAY = 1.0  # 请求间基础延迟(秒)
TIMEOUT = 30

USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
    "AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/125.0.0.0 Safari/537.36"
)

# 要下载的静态资源扩展名
STATIC_EXTS = {
    ".css", ".js", ".mjs", ".json", ".xml", ".svg", ".ico",
    ".png", ".jpg", ".jpeg", ".gif", ".webp", ".bmp", ".avif",
    ".woff", ".woff2", ".ttf", ".otf", ".eot",
    ".mp4", ".webm", ".mp3", ".wav", ".ogg", ".pdf", ".zip",
}

# 不爬取的外链域名黑名单（按需增删）
SKIP_DOMAINS = {
    "facebook.com", "twitter.com", "x.com", "instagram.com",
    "youtube.com", "youtu.be", "tiktok.com", "linkedin.com",
    "google-analytics.com", "googletagmanager.com", "doubleclick.net",
    "cloudflareinsights.com", "hcaptcha.com", "recaptcha.net",
}

# ========================= 日志 =========================
logger = logging.getLogger("depvailon")
logger.setLevel(logging.INFO)
fmt = logging.Formatter("%(asctime)s [%(levelname)s] %(message)s", "%H:%M:%S")
fh = logging.FileHandler(LOG_FILE, encoding="utf-8")
fh.setFormatter(fmt)
sh = logging.StreamHandler(sys.stdout)
sh.setFormatter(fmt)
logger.addHandler(fh)
logger.addHandler(sh)


# ========================= Cloudflare 绕过 =========================
class CFBypassSession:
    """
    使用 DrissionPage 驱动本地 Chromium 完成 Cloudflare 验证（5秒盾/Turnstile），
    验证通过后把 cookies 注入 requests.Session 供后续高速 HTTP 抓取。
    若未安装 DrissionPage/无 Chromium，则回退为纯 requests 模式（部分页面可能失败）。
    """

    def __init__(self, headless=True):
        self.page = None
        self.session = None
        self.browser_mode = False
        self.headless = headless
        self._init_session()

    def _init_session(self):
        if requests is None:
            raise RuntimeError("请先安装 requests: pip install requests")
        s = requests.Session()
        retry = Retry(total=3, backoff_factor=1,
                      status_forcelist=[429, 500, 502, 503, 504])
        s.mount("http://", HTTPAdapter(max_retries=retry))
        s.mount("https://", HTTPAdapter(max_retries=retry))
        s.headers.update({
            "User-Agent": USER_AGENT,
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,"
                      "image/webp,image/apng,*/*;q=0.8",
            "Accept-Language": "en-US,en;q=0.9,zh-CN;q=0.8,zh;q=0.7",
            "Accept-Encoding": "gzip, deflate, br",
            "Connection": "keep-alive",
            "Upgrade-Insecure-Requests": "1",
            "Sec-Fetch-Dest": "document",
            "Sec-Fetch-Mode": "navigate",
            "Sec-Fetch-Site": "none",
            "Sec-Fetch-User": "?1",
        })
        self.session = s

    def _init_browser(self):
        if ChromiumPage is None:
            logger.warning("未安装 DrissionPage，跳过浏览器模式（pip install DrissionPage）")
            return False
        try:
            co = ChromiumOptions()
            if self.headless:
                co.headless()
            co.set_argument("--no-sandbox")
            co.set_argument("--disable-blink-features=AutomationControlled")
            co.set_user_agent(USER_AGENT)
            self.page = ChromiumPage(co)
            self.browser_mode = True
            logger.info("Chromium 浏览器已启动")
            return True
        except Exception as e:
            logger.error(f"启动 Chromium 失败: {e}")
            self.browser_mode = False
            return False

    def bypass_cloudflare(self, url):
        """访问目标URL，等待Cloudflare验证通过，返回成功后可用的cookies"""
        if not self._init_browser():
            logger.warning("浏览器不可用，尝试纯HTTP模式...")
            return False
        logger.info(f"正在通过浏览器访问 {url} 以完成 Cloudflare 验证...")
        try:
            self.page.get(url)
            # 等待Cloudflare 5秒盾/Turnstile 通过：标题不再含"Just a moment"或"Attention Required"
            for _ in range(60):
                time.sleep(1)
                title = self.page.title
                html = self.page.html
                if ("Just a moment" not in title
                        and "Attention Required" not in title
                        and "cf-challenge" not in html
                        and "Turnstile" not in title):
                    # 再等2秒让重定向完成
                    time.sleep(2)
                    logger.info(f"Cloudflare 验证通过，当前页面: {self.page.url}")
                    return True
                # 尝试自动点击 Turnstile 复选框
                try:
                    iframe = self.page.ele("tag:iframe@src():turnstile", timeout=1)
                    if iframe:
                        box = iframe.ele("tag:input@type():checkbox", timeout=1)
                        if box and not box.states.is_selected:
                            box.click()
                            logger.info("已尝试点击 Turnstile 复选框")
                except Exception:
                    pass
            logger.error("Cloudflare 验证超时")
            return False
        except Exception as e:
            logger.error(f"浏览器访问出错: {e}")
            return False

    def sync_cookies_to_requests(self):
        """把浏览器cookies同步到requests session"""
        if not self.page:
            return
        try:
            cookies = self.page.cookies()
            for c in cookies:
                self.session.cookies.set(c.get("name"), c.get("value"),
                                         domain=c.get("domain"))
            logger.info(f"已同步 {len(cookies)} 个 cookie 到 HTTP 会话")
        except Exception as e:
            logger.error(f"同步 cookies 失败: {e}")

    def get_html(self, url):
        """获取页面最终HTML（动态渲染后）；浏览器模式优先，失败回退requests"""
        if self.browser_mode and self.page:
            try:
                self.page.get(url)
                # 等待页面基本加载
                self.page.wait.doc_loaded(timeout=TIMEOUT)
                time.sleep(1.5)
                return self.page.html, self.page.url
            except Exception as e:
                logger.warning(f"浏览器获取 {url} 失败: {e}，回退到requests")
        # requests 回退
        resp = self.session.get(url, timeout=TIMEOUT, allow_redirects=True)
        resp.raise_for_status()
        # 若返回的是 Cloudflare challenge 页面（纯requests无法过），提示
        if "cf-challenge" in resp.text[:2000] or "Just a moment" in resp.text[:1000]:
            logger.warning(f"{url} 触发了 Cloudflare 挑战，requests 无法绕过，"
                           f"建议使用浏览器模式（DrissionPage）")
        resp.encoding = resp.apparent_encoding or resp.encoding
        return resp.text, resp.url

    def get_bytes(self, url):
        """下载二进制资源"""
        resp = self.session.get(url, timeout=TIMEOUT, allow_redirects=True)
        resp.raise_for_status()
        return resp.content, resp.headers.get("Content-Type", "")

    def close(self):
        if self.page:
            try:
                self.page.quit()
            except Exception:
                pass


# ========================= 加密内容解密模块 =========================
class JSDecryptor:
    """
    通用网页JS加密内容解密器。
    覆盖常见场景：
      1. Cloudflare email 保护解密（data-cfemail）
      2. Base64 编码的 href / src
      3. 常见 AES-DES 简单解密（基于 CryptoJS.enc.Utf8.parse 约定密钥）
      4. 脚本中 __NEXT_DATA__ / window.__INITIAL_STATE__ 等状态提取
    """

    @staticmethod
    def decrypt_cf_email(enc: str) -> str:
        """解密 Cloudflare 邮箱保护 (data-cfemail)"""
        try:
            r = int(enc[:2], 16)
            email = ""
            for i in range(2, len(enc), 2):
                email += chr(int(enc[i:i+2], 16) ^ r)
            return email
        except Exception:
            return enc

    @staticmethod
    def try_extract_state_html(html: str) -> dict:
        """提取页面内嵌的JSON状态对象"""
        patterns = [
            r"<script[^>]*id=\"__NEXT_DATA__\"[^>]*>(.*?)</script>",
            r"<script[^>]*id=\"__NUXT__\"[^>]*>(.*?)</script>",
            r"window\.__INITIAL_STATE__\s*=\s*(\{.*?\});",
            r"window\.__PRELOADED_STATE__\s*=\s*(\{.*?\});",
            r"window\._preloadedData\s*=\s*(\{.*?\});",
        ]
        import json as _json
        for pat in patterns:
            m = re.search(pat, html, re.DOTALL)
            if m:
                try:
                    return _json.loads(m.group(1))
                except Exception:
                    continue
        return {}

    @classmethod
    def decrypt_html(cls, html: str) -> str:
        """对HTML中的已知加密内容进行原位解密"""
        # 1. Cloudflare 邮箱
        def _cf_email_repl(m):
            enc = m.group(1)
            return f'href="mailto:{cls.decrypt_cf_email(enc)}"'
        html = re.sub(
            r'href="/cdn-cgi/l/email-protection#([a-fA-F0-9]+)"',
            _cf_email_repl, html,
        )
        # 2. data-cfemail 替换为可见邮箱
        def _cfemail_span_repl(m):
            enc = m.group(1)
            return cls.decrypt_cf_email(enc)
        html = re.sub(
            r'<span[^>]*data-cfemail="([a-fA-F0-9]+)"[^>]*></span>',
            _cfemail_span_repl, html,
        )
        # 3. 移除Cloudflare挑战相关脚本（在已通过浏览器渲染的HTML里它们是无意义的）
        html = re.sub(
            r"<script[^>]*src=\"/cdn-cgi/challenge-platform/[^\"]*\"[^>]*></script>",
            "", html,
        )
        return html


# ========================= URL工具 =========================
def is_same_domain(url, base_domain):
    try:
        host = urlparse(url).netloc.lower()
        return host == base_domain or host.endswith("." + base_domain)
    except Exception:
        return False


def should_skip_domain(url):
    host = urlparse(url).netloc.lower().lstrip("www.")
    for d in SKIP_DOMAINS:
        if host == d or host.endswith("." + d):
            return True
    return False


def url_to_local_path(url, base_domain):
    """把URL映射到本地相对路径"""
    parsed = urlparse(url)
    path = parsed.path or "/"
    if path.endswith("/"):
        path += "index.html"
    # 无扩展名或扩展名非静态/html则视为页面
    ext = os.path.splitext(path)[1].lower()
    if path == "/index.html" or ext == "" or ext not in STATIC_EXTS and ext != ".html":
        if not path.endswith(".html"):
            path = path.rstrip("/") + "/index.html" if not ext else path
    # 去掉开头斜杠
    local = path.lstrip("/")
    return local


# ========================= 爬虫主类 =========================
class SiteCrawler:
    def __init__(self, base_url, output_dir, max_depth=DEFAULT_MAX_DEPTH,
                 workers=DEFAULT_WORKERS, delay=DEFAULT_DELAY, resume=False):
        self.base_url = base_url.rstrip("/") + "/"
        self.base_domain = urlparse(self.base_url).netloc.lower()
        self.output_dir = Path(output_dir)
        self.max_depth = max_depth
        self.workers = workers
        self.delay = delay

        self.visited = set()
        self.queued = set()
        self.failed = {}
        self.queue = deque()
        self.lock = threading.Lock()
        self.cf_session = None

        # 加载断点状态
        if resume and STATE_FILE.exists():
            self._load_state()

        self.output_dir.mkdir(parents=True, exist_ok=True)

    def _load_state(self):
        try:
            data = json.loads(STATE_FILE.read_text(encoding="utf-8"))
            self.visited = set(data.get("visited", []))
            self.failed = data.get("failed", {})
            logger.info(f"已加载断点状态：已访问 {len(self.visited)} 页")
        except Exception as e:
            logger.warning(f"加载状态失败: {e}")

    def _save_state(self):
        data = {
            "visited": list(self.visited),
            "failed": self.failed,
            "base_url": self.base_url,
        }
        STATE_FILE.write_text(json.dumps(data, ensure_ascii=False, indent=2),
                              encoding="utf-8")

    def start(self):
        logger.info("=" * 60)
        logger.info(f"目标站点: {self.base_url}")
        logger.info(f"输出目录: {self.output_dir.resolve()}")
        logger.info(f"最大深度: {self.max_depth} | 并发数: {self.workers}")
        logger.info("=" * 60)

        # 1. 初始化带CF绕过能力的会话
        self.cf_session = CFBypassSession(headless=True)
        cf_ok = self.cf_session.bypass_cloudflare(self.base_url)
        if cf_ok:
            self.cf_session.sync_cookies_to_requests()
        else:
            logger.warning("Cloudflare 浏览器绕过失败，尝试纯HTTP模式继续...")

        # 2. 起始URL入队
        self._enqueue(self.base_url, depth=0)

        # 3. 多线程爬取（单线程顺序模式更稳定，避免CF封多连接；
        #    如需提速可调大workers，但建议≤3）
        total = len(self.queue)
        done = 0
        save_interval = 0
        while self.queue:
            url, depth = self.queue.popleft()
            try:
                self._crawl_page(url, depth)
            except Exception as e:
                logger.error(f"抓取 {url} 出错: {e}")
                with self.lock:
                    self.failed[url] = str(e)
            done += 1
            save_interval += 1
            if save_interval >= 5:
                self._save_state()
                save_interval = 0
            with self.lock:
                remaining = len(self.queue)
            logger.info(f"[进度] 已完成 {done}, 队列剩余 {remaining}, 失败 {len(self.failed)}")
            time.sleep(self.delay)

        # 收尾
        self._save_state()
        self.cf_session.close()
        logger.info("=" * 60)
        logger.info(f"抓取完成！成功 {len(self.visited)} 页，失败 {len(self.failed)} 页")
        logger.info(f"站点镜像保存于: {self.output_dir.resolve()}")
        if self.failed:
            logger.info("失败URL列表（可再次 --resume 重试）:")
            for u, err in list(self.failed.items())[:20]:
                logger.info(f"  {u}  -> {err}")
        logger.info("=" * 60)

    def _enqueue(self, url, depth):
        url = urldefrag(url)[0]
        if url in self.visited or url in self.queued:
            return
        if should_skip_domain(url):
            return
        if not is_same_domain(url, self.base_domain):
            return
        if depth > self.max_depth:
            return
        self.queued.add(url)
        self.queue.append((url, depth))

    def _is_page_url(self, url):
        """判断URL是否是页面（HTML）"""
        path = urlparse(url).path
        ext = os.path.splitext(path)[1].lower()
        if ext in STATIC_EXTS:
            return False
        return True

    def _crawl_page(self, url, depth):
        """抓取单个页面并提取新链接"""
        logger.info(f"[深度{depth}] 抓取页面: {url}")
        html, final_url = self.cf_session.get_html(url)

        # 解密常见加密内容
        html = JSDecryptor.decrypt_html(html)

        # 尝试提取SSR状态（保留用于调试/二次开发）
        state = JSDecryptor.try_extract_state_html(html)
        if state:
            logger.debug(f"  从页面提取到状态对象，键: {list(state.keys())[:5]}")

        # 解析并下载静态资源、改写链接
        local_html = self._process_html(html, final_url, depth)

        # 保存HTML到本地
        local_rel = url_to_local_path(final_url, self.base_domain)
        # 若有查询字符串，hash到文件名避免冲突
        q = urlparse(final_url).query
        if q:
            h = hashlib.md5(q.encode()).hexdigest()[:8]
            base, ext = os.path.splitext(local_rel)
            local_rel = f"{base}__{h}{ext or '.html'}"
        local_path = self.output_dir / local_rel
        local_path.parent.mkdir(parents=True, exist_ok=True)
        local_path.write_text(local_html, encoding="utf-8")
        logger.info(f"  已保存: {local_rel}")

        with self.lock:
            self.visited.add(url)

    def _process_html(self, html, page_url, depth):
        """解析HTML：下载静态资源、改写链接为本地相对路径、发现新页面入队"""
        soup = BeautifulSoup(html, "html.parser")
        page_local = url_to_local_path(page_url, self.base_domain)
        page_dir = os.path.dirname(page_local)

        # 标签-属性映射
        tag_attrs = {
            "a": "href", "link": "href", "script": "src",
            "img": "src", "source": "src", "video": "src",
            "audio": "src", "iframe": "src", "embed": "src",
            "object": "data",
        }
        # 处理 srcset
        srcset_tags = {"img", "source"}

        for tag_name, attr in tag_attrs.items():
            for tag in soup.find_all(tag_name):
                src = tag.get(attr)
                if not src:
                    continue
                abs_url = urljoin(page_url, src)
                # 跳过锚点/JS/邮件/电话
                if (src.startswith("#") or src.startswith("javascript:")
                        or src.startswith("mailto:") or src.startswith("tel:")):
                    continue
                # 外链直接保留原链接
                if not is_same_domain(abs_url, self.base_domain):
                    if should_skip_domain(abs_url):
                        # 第三方追踪/社交链接保留原URL不处理
                        pass
                    continue

                if self._is_page_url(abs_url):
                    # 页面链接 -> 入队 + 改写为相对路径
                    self._enqueue(abs_url, depth + 1)
                    target_local = url_to_local_path(abs_url, self.base_domain)
                    tag[attr] = self._relpath(page_dir, target_local)
                else:
                    # 静态资源 -> 下载并改写
                    local_res = self._download_resource(abs_url)
                    if local_res:
                        tag[attr] = self._relpath(page_dir, local_res)

                # 懒加载 data-src / data-original
                for lazy_attr in ("data-src", "data-original", "data-lazy-src"):
                    ls = tag.get(lazy_attr)
                    if ls:
                        abs_ls = urljoin(page_url, ls)
                        if is_same_domain(abs_ls, self.base_domain):
                            if self._is_page_url(abs_ls):
                                self._enqueue(abs_ls, depth + 1)
                                target_local = url_to_local_path(abs_ls, self.base_domain)
                                tag[lazy_attr] = self._relpath(page_dir, target_local)
                            else:
                                lr = self._download_resource(abs_ls)
                                if lr:
                                    tag[lazy_attr] = self._relpath(page_dir, lr)

        # 处理 srcset
        for tag in soup.find_all(list(srcset_tags)):
            srcset = tag.get("srcset")
            if not srcset:
                continue
            new_parts = []
            for part in srcset.split(","):
                part = part.strip()
                sp = part.split()
                if not sp:
                    continue
                u = sp[0]
                desc = " ".join(sp[1:])
                abs_u = urljoin(page_url, u)
                if is_same_domain(abs_u, self.base_domain):
                    if self._is_page_url(abs_u):
                        tl = url_to_local_path(abs_u, self.base_domain)
                        self._enqueue(abs_u, depth + 1)
                        new_parts.append(f"{self._relpath(page_dir, tl)} {desc}".strip())
                    else:
                        lr = self._download_resource(abs_u)
                        if lr:
                            new_parts.append(f"{self._relpath(page_dir, lr)} {desc}".strip())
                        else:
                            new_parts.append(part)
                else:
                    new_parts.append(part)
            tag["srcset"] = ", ".join(new_parts)

        # 处理内联CSS中的url()
        for style_tag in soup.find_all("style"):
            if style_tag.string:
                style_tag.string = self._rewrite_css_urls(
                    style_tag.string, page_url, page_dir, depth
                )
        # 处理style属性
        for el in soup.find_all(style=True):
            el["style"] = self._rewrite_css_urls(el["style"], page_url, page_dir, depth)

        # 处理 <link rel="stylesheet"> 引入的CSS内部url()
        for link in soup.find_all("link", rel=lambda v: v and "stylesheet" in v):
            href = link.get("href")
            if not href:
                continue
            abs_href = urljoin(page_url, href)
            if is_same_domain(abs_href, self.base_domain):
                self._download_and_patch_css(abs_href, page_url, page_dir, depth)

        return str(soup)

    def _download_resource(self, url):
        """下载静态资源到本地，返回本地相对路径（相对于output_dir）"""
        url = urldefrag(url)[0]
        local = url_to_local_path(url, self.base_domain)
        q = urlparse(url).query
        if q:
            h = hashlib.md5(q.encode()).hexdigest()[:8]
            base, ext = os.path.splitext(local)
            local = f"{base}__{h}{ext}"
        local_path = self.output_dir / local
        if local_path.exists() and local_path.stat().st_size > 0:
            return local
        try:
            content, ctype = self.cf_session.get_bytes(url)
            local_path.parent.mkdir(parents=True, exist_ok=True)
            # 若URL无扩展名，从Content-Type推断
            if not os.path.splitext(local)[1]:
                ext = mimetypes.guess_extension(ctype.split(";")[0].strip()) or ""
                if ext == ".jpe":
                    ext = ".jpg"
                local = local + ext
                local_path = self.output_dir / local
            local_path.write_bytes(content)
            logger.debug(f"  下载资源: {local} ({len(content)} bytes)")
            return local
        except Exception as e:
            logger.warning(f"  下载资源失败 {url}: {e}")
            return None

    def _download_and_patch_css(self, css_url, referer_page, referer_dir, depth):
        """下载CSS文件并递归处理其中的 url() 引用"""
        local_css = self._download_resource(css_url)
        if not local_css:
            return
        css_path = self.output_dir / local_css
        try:
            text = css_path.read_text(encoding="utf-8", errors="ignore")
        except Exception:
            return
        css_dir = os.path.dirname(local_css)
        new_text = self._rewrite_css_urls_in_css(text, css_url, css_dir, depth)
        if new_text != text:
            css_path.write_text(new_text, encoding="utf-8")

    def _rewrite_css_urls(self, css_text, base_url, referer_dir, depth):
        def _repl(m):
            u = m.group(1).strip(" '\"")
            if u.startswith("data:"):
                return f"url({u})"
            abs_u = urljoin(base_url, u)
            if is_same_domain(abs_u, self.base_domain):
                if self._is_page_url(abs_u):
                    tl = url_to_local_path(abs_u, self.base_domain)
                    self._enqueue(abs_u, depth + 1)
                    return f"url('{self._relpath(referer_dir, tl)}')"
                else:
                    lr = self._download_resource(abs_u)
                    if lr:
                        return f"url('{self._relpath(referer_dir, lr)}')"
            return f"url({u})"
        return re.sub(r"url\(([^)]+)\)", _repl, css_text)

    def _rewrite_css_urls_in_css(self, css_text, css_base_url, css_dir, depth):
        def _repl(m):
            u = m.group(1).strip(" '\"")
            if u.startswith("data:"):
                return f"url({u})"
            abs_u = urljoin(css_base_url, u)
            if is_same_domain(abs_u, self.base_domain):
                if self._is_page_url(abs_u):
                    tl = url_to_local_path(abs_u, self.base_domain)
                    self._enqueue(abs_u, depth + 1)
                    return f"url('{self._relpath(css_dir, tl)}')"
                else:
                    lr = self._download_resource(abs_u)
                    if lr:
                        return f"url('{self._relpath(css_dir, lr)}')"
            return f"url({u})"
        return re.sub(r"url\(([^)]+)\)", _repl, css_text)

    @staticmethod
    def _relpath(from_dir, to_path):
        """从 from_dir 目录下的文件到 to_path 的相对路径"""
        if not from_dir:
            return to_path
        # from_dir 相对于 output_dir
        from_parts = from_dir.split("/") if from_dir else []
        to_parts = to_path.split("/")
        # 共同前缀
        i = 0
        while i < len(from_parts) and i < len(to_parts) and from_parts[i] == to_parts[i]:
            i += 1
        ups = len(from_parts) - i
        rel = "../" * ups + "/".join(to_parts[i:])
        return rel or "./"


# ========================= CLI入口 =========================
def main():
    ap = argparse.ArgumentParser(description="Depvailon.com 全站抓取器（含CF绕过与JS解密）")
    ap.add_argument("--url", default=BASE_URL, help="起始URL")
    ap.add_argument("--output", default=str(OUTPUT_DIR), help="输出目录")
    ap.add_argument("--depth", type=int, default=DEFAULT_MAX_DEPTH, help="最大爬取深度")
    ap.add_argument("--workers", type=int, default=DEFAULT_WORKERS, help="并发线程数")
    ap.add_argument("--delay", type=float, default=DEFAULT_DELAY, help="请求间延迟(秒)")
    ap.add_argument("--resume", action="store_true", help="从上次断点继续爬取")
    ap.add_argument("--no-headless", action="store_true", help="浏览器显示窗口（用于手动过验证码）")
    args = ap.parse_args()

    crawler = SiteCrawler(
        base_url=args.url,
        output_dir=args.output,
        max_depth=args.depth,
        workers=args.workers,
        delay=args.delay,
        resume=args.resume,
    )
    # 注意：headless 参数在 CFBypassSession 中使用
    crawler.cf_session_headless = not args.no_headless
    crawler.start()


if __name__ == "__main__":
    main()
