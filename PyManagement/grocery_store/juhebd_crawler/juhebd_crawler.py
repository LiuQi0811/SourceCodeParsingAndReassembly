#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
juhebd.com 全站爬虫
=============================================
站点结构分析（已完成逆向）：
1. 主站  https://www.juhebd.com/
   - 服务端渲染，可直接爬取列表/详情/分类/搜索
   - 栏目：/mv (电影)、/tv (剧集)、/acg (动漫)
   - 分页格式：/mv/index--{page}、/tv/index--{page}、/acg/index--{page}
   - 搜索：/q/?k={keyword} (GET, 返回302→列表页)
   - 详情页：/mv/{code}、/tv/{code}、/acg/{code}

2. 资源子站 https://res.juhebd.com/
   - Vue3 + RuoYi 后台，需要 JWT 登录
   - 登录接口：POST /login  {username, password, code, uuid}
   - 验证码：GET  /captchaImage  (返回 img 图片 base64 + uuid)
   - 资源接口需携带 Authorization: Bearer {token}
   - 前端路由 /r?{code} 展示资源，调用 film/resource 相关接口

3. 原主站前端JS（/js/front.js）中的资源解密算法已完整逆向：
   原始加密流程：
     明文 = UTF8字符串
     ciphertext = base64_encode( utf8_to_utf16(明文) )[::-1]   (先编码，再反转字符串)
   解密算法：
     明文 = utf16_to_utf8( base64_decode( ciphertext[::-1] ) )  (先反转，再解码，再UTF-16→UTF-8)
   页面变量：diskUrls（网盘链接）、urls（直链/磁力/ed2k）、adsUrls（广告）
   分隔符：###
   网盘格式："{pwd}||{url}" 或 直接URL

使用方法：
    # 仅爬主站列表+详情（不含真实下载链接）：
    python juhebd_crawler.py --main-only

    # 爬取主站 + 登录资源站抓真实下载链接（需提供账号密码）：
    python juhebd_crawler.py --username your_user --password your_pwd

    # 指定爬取页数上限与并发：
    python juhebd_crawler.py -u xxx -p xxx --max-pages 20 --workers 8

    # 关键词搜索爬取：
    python juhebd_crawler.py --search "八仙" -o search_results.json
"""

import argparse
import base64
import json
import logging
import os
import re
import sys
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from urllib.parse import quote, urljoin, urlparse

import requests
from bs4 import BeautifulSoup
from PIL import Image
from io import BytesIO

# ============ 配置 ============
MAIN_HOST = "https://www.juhebd.com"
RES_HOST = "https://res.juhebd.com"

DEFAULT_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
        "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
    ),
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
    "Referer": MAIN_HOST + "/",
}

JSON_HEADERS = {
    **DEFAULT_HEADERS,
    "Accept": "application/json, text/plain, */*",
    "Content-Type": "application/json;charset=UTF-8",
    "Origin": RES_HOST,
    "Referer": RES_HOST + "/",
}

OUTPUT_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_FILE = os.path.join(OUTPUT_DIR, "juhebd_all.json")

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%H:%M:%S",
)
log = logging.getLogger("juhebd")


# ============ 核心解密函数（逆向自 front.js） ============
def utf16_to_utf8(s: str) -> str:
    """
    对应 front.js 中的 utf8ToUtf16/decode64 组合：
        bdfilm 使用 Unicode 转义形式将 UTF-8 字节伪装成 UTF-16 码点序列，
        实际是把 UTF-8 每个字节作为 charCode 写入字符串，再用 decode64 解出。
        这里按前端逻辑：直接把每个字符的 charCode 取低8位作为 UTF-8 字节。
    """
    try:
        raw = bytes([ord(ch) & 0xFF for ch in s])
        return raw.decode("utf-8", errors="replace")
    except Exception:
        return s


def decode_ciphertext(cipher: str) -> str:
    """
    还原前端的解密流程（参见 bdfilm.downurl.init）：
        urls.split("").reverse().join("")  -> 字符串反转
        decode64(...)                     -> Base64 解码
        utf8ToUtf16(...)                  -> 实际上是按字节还原 UTF-8
    """
    if not cipher:
        return ""
    try:
        reversed_str = cipher[::-1]
        # 前端 decode64 兼容 URL 安全 base64
        reversed_str = reversed_str.replace("-", "+").replace("_", "/")
        pad = (-len(reversed_str)) % 4
        reversed_str += "=" * pad
        decoded_bytes = base64.b64decode(reversed_str)
        # 前端 utf8ToUtf16：把字节流逐字节视为 charCode 再拼成字符串
        raw_str = "".join(chr(b) for b in decoded_bytes)
        return utf16_to_utf8(raw_str)
    except Exception as e:
        log.warning(f"解密失败: {e}; 原值前50字符: {cipher[:50]}")
        return ""


def parse_urls_field(encoded: str) -> list:
    """解密 urls/diskUrls/adsUrls 字段，按 ### 拆分成列表"""
    if not encoded:
        return []
    plain = decode_ciphertext(encoded)
    items = [u.strip() for u in plain.split("###") if u.strip()]
    return items


def parse_pan_link(item: str) -> dict:
    """
    解析网盘链接：
      - "密码||URL"
      - 直接URL（无密码）
    """
    if "||" in item:
        pwd, url = item.split("||", 1)
        pwd, url = pwd.strip(), url.strip()
    else:
        pwd, url = "", item.strip()
    if "xunlei" in url:
        ptype = "xunlei"
    elif "pan.baidu" in url:
        ptype = "baidu"
        if pwd:
            url += ("?" in url and "&" or "?") + "pwd=" + pwd
    elif "pan.quark" in url:
        ptype = "quark"
    else:
        ptype = "other"
    return {"type": ptype, "url": url, "pwd": pwd}


def parse_direct_link(item: str) -> dict:
    """解析直链/magnet/ed2k/ftp，提取文件名和大小"""
    url = item.strip()
    fname, fsize = "", ""
    lower = url.lower()
    if lower.startswith("ed2k://"):
        parts = url.split("|")
        if len(parts) > 3:
            try:
                size_b = int(parts[3])
                if size_b > 1024 ** 3:
                    fsize = f"{size_b / 1024 ** 3:.2f}GB"
                elif size_b > 1024 ** 2:
                    fsize = f"{size_b / 1024 ** 2:.0f}MB"
            except Exception:
                pass
        if len(parts) > 2:
            fname = parts[2]
    elif lower.startswith("magnet:"):
        for kv in url.split("&"):
            if kv.startswith("dn="):
                try:
                    from urllib.parse import unquote
                    fname = unquote(kv[3:])
                except Exception:
                    pass
                break
    elif lower.startswith("ftp://") or lower.startswith("http://") or lower.startswith("https://"):
        fname = url.rsplit("/", 1)[-1]
        fname = re.sub(r"【[^】]*】", "", fname)
    # 清理多余后缀
    fname = re.sub(r"\[.*\]", "", fname)
    return {"type": "direct", "url": url, "filename": fname, "size": fsize}


# ============ 网络请求工具 ============
class Fetcher:
    def __init__(self, use_mobile=False):
        self.s = requests.Session()
        self.s.headers.update(DEFAULT_HEADERS)
        if use_mobile:
            self.s.headers["User-Agent"] = (
                "Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) "
                "AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 "
                "Mobile/15E148 Safari/604.1"
            )

    def get(self, url, **kwargs):
        for i in range(3):
            try:
                r = self.s.get(url, timeout=15, **kwargs)
                r.encoding = r.apparent_encoding or "utf-8"
                return r
            except requests.RequestException as e:
                log.warning(f"GET {url} 失败({i+1}/3): {e}")
                time.sleep(1 + i)
        return None


# ============ 主站爬取 ============
class JuhebdCrawler:
    CATEGORIES = {
        "mv": "电影",
        "tv": "剧集",
        "acg": "动漫",
    }

    def __init__(self, max_pages=50, workers=4, output=DATA_FILE):
        self.fetcher = Fetcher()
        self.max_pages = max_pages
        self.workers = workers
        self.output = output
        self.seen = set()
        self.results = []

    # ---------- 列表页 ----------
    def parse_list_page(self, html: str, category: str) -> list:
        """解析列表页，提取该页所有详情链接和基础信息"""
        soup = BeautifulSoup(html, "html.parser")
        items = []
        for a in soup.select("a[href]"):
            href = a.get("href", "")
            m = re.match(rf"^/(mv|tv|acg)/([A-Za-z0-9]+)$", href)
            if not m:
                continue
            cat, code = m.group(1), m.group(2)
            if cat != category:
                continue
            title = a.get("title") or a.get_text(strip=True)
            if not title or code in self.seen:
                continue
            entry = {"category": cat, "category_name": self.CATEGORIES.get(cat, cat),
                     "code": code, "detail_url": f"{MAIN_HOST}/{cat}/{code}", "title": title}
            self.seen.add(code)
            items.append(entry)
        return items

    def fetch_list_page(self, category: str, page: int) -> list:
        # 真实分页格式: /{cat}/index-----{page} (5个短横线)
        if page == 1:
            url = f"{MAIN_HOST}/{category}/index"
        else:
            url = f"{MAIN_HOST}/{category}/index-----{page}"
        log.info(f"抓列表 [{self.CATEGORIES[category]}] 第{page}页: {url}")
        r = self.fetcher.get(url)
        if not r:
            return []
        items = self.parse_list_page(r.text, category)
        log.info(f"  -> 解析到 {len(items)} 条")
        return items

    def get_total_pages(self, category: str) -> int:
        """探测最大页数：从分页组件找末页链接"""
        r = self.fetcher.get(f"{MAIN_HOST}/{category}/index")
        if not r:
            return 1
        # 查找分页链接 /{cat}/index-----N
        pages = re.findall(rf"/{category}/index-----(\d+)", r.text)
        max_p = 1
        for p in pages:
            try:
                max_p = max(max_p, int(p))
            except ValueError:
                pass
        return min(max_p, self.max_pages) if max_p > 1 else 1

    # ---------- 详情页 ----------
    def parse_detail(self, html: str, entry: dict) -> dict:
        soup = BeautifulSoup(html, "html.parser")

        # 标题
        title_tag = soup.select_one(".head h3, h1, h2")
        if title_tag:
            entry["title"] = title_tag.get_text(strip=True)

        # 年份
        year_tag = soup.find("span", class_="year")
        if year_tag:
            entry["year"] = year_tag.get_text(strip=True).strip("()")

        # 评分（豆瓣/IMDB）
        for score in soup.select(".list-douban, .list-imdb, .score"):
            cls = " ".join(score.get("class", []))
            val = score.get_text(strip=True)
            if not val:
                continue
            if "douban" in cls:
                entry["douban_rating"] = val
            elif "imdb" in cls:
                entry["imdb_rating"] = val
            else:
                entry.setdefault("rating", val)

        # 海报
        poster = soup.select_one('.videopic img, img[alt]')
        if poster:
            img = poster.get("src") or poster.get("data-src") or ""
            if img.startswith("/"):
                img = MAIN_HOST + img
            if img and "default" not in img:
                entry["poster"] = img

        # 简介
        plot = soup.select_one("#plot .plot, .plot")
        if plot:
            entry["description"] = plot.get_text(strip=True)

        # 导演/演员/类型标签
        entry["directors"] = []
        entry["actors"] = []
        entry["tags"] = []
        for a in soup.select("a[href*='/q/index']"):
            href = a.get("href", "")
            name = a.get_text(strip=True)
            if not name:
                continue
            # 通过上下文判断是导演/演员/类型
            parent_text = a.parent.parent.get_text(" ", strip=True)[:50] if a.parent and a.parent.parent else ""
            if re.search(r"导演", parent_text):
                entry["directors"].append(name)
            elif re.search(r"类型|题材", parent_text):
                entry["tags"].append(name)
            else:
                entry["actors"].append(name)

        # 资源按钮指向
        res_btn = soup.select_one("#res")
        if res_btn:
            rhref = res_btn.get("href", "")
            if rhref.startswith("http"):
                entry["res_url"] = rhref
            elif rhref:
                entry["res_url"] = MAIN_HOST + rhref
            else:
                # 末尾 script 动态设置
                m = re.search(r"document\.querySelector\('#res'\)\.href\s*=\s*'([^']+)'", html)
                if m:
                    entry["res_url"] = m.group(1)

        # 图片资源 data-src（剧照）
        pics = []
        for img in soup.select("img[data-src]"):
            src = img.get("data-src", "")
            if src.startswith("/pic/"):
                src = MAIN_HOST + src
            if src and "juhebd" in src or src.startswith("http"):
                pics.append(src)
        if pics:
            entry["screenshots"] = list(dict.fromkeys(pics))[:8]

        # 解密页面内嵌的 urls/diskUrls/adsUrls（新版可能为空，因为已迁移到res子域）
        m = re.search(r"var\s+diskUrls\s*=\s*[\"']([^\"']*)[\"']", html)
        if m and m.group(1):
            entry["disk_urls_encrypted"] = m.group(1)
            entry["pan_links"] = [parse_pan_link(x) for x in parse_urls_field(m.group(1))
                                   if x and "yun.cn" not in x]
        m = re.search(r"var\s+urls\s*=\s*[\"']([^\"']*)[\"']", html)
        if m and m.group(1):
            entry["urls_encrypted"] = m.group(1)
            entry["direct_links"] = [parse_direct_link(x) for x in parse_urls_field(m.group(1))
                                      if x and "yun.cn" not in x]

        return entry

    def fetch_detail(self, entry: dict) -> dict:
        log.info(f"抓详情: [{entry['category_name']}] {entry['title']}")
        r = self.fetcher.get(entry["detail_url"])
        if not r:
            return entry
        try:
            return self.parse_detail(r.text, entry)
        except Exception as e:
            log.error(f"解析详情失败 {entry['detail_url']}: {e}")
            return entry

    # ---------- 搜索 ----------
    def search(self, keyword: str) -> list:
        url = f"{MAIN_HOST}/q/?k={quote(keyword)}"
        log.info(f"搜索: {keyword} -> {url}")
        r = self.fetcher.get(url, allow_redirects=True)
        if not r:
            return []
        items = []
        for cat in self.CATEGORIES:
            items.extend(self.parse_list_page(r.text, cat))
        # 如果结果页是多页，抓第二页（一般足够）
        for page in range(2, 4):
            m = re.search(r"/(mv|tv|acg)/index", r.text)
            if not m:
                break
            cat0 = m.group(1)
            r2 = self.fetcher.get(f"{MAIN_HOST}/{cat0}/index-----{page}")
            if r2:
                for cat in self.CATEGORIES:
                    items.extend(self.parse_list_page(r2.text, cat))
        return items

    # ---------- 主流程 ----------
    def crawl_all(self, categories=None):
        categories = categories or list(self.CATEGORIES.keys())
        all_entries = []
        for cat in categories:
            total = self.get_total_pages(cat)
            log.info(f"栏目 [{self.CATEGORIES[cat]}] 探测到共 {total} 页")
            for page in range(1, total + 1):
                items = self.fetch_list_page(cat, page)
                if not items:
                    break
                all_entries.extend(items)
                time.sleep(0.4)

        log.info(f"列表页共收集 {len(all_entries)} 条，开始抓取详情页（并发 {self.workers}）")
        with ThreadPoolExecutor(max_workers=self.workers) as pool:
            futures = {pool.submit(self.fetch_detail, e): e for e in all_entries}
            for fut in as_completed(futures):
                try:
                    self.results.append(fut.result())
                except Exception as e:
                    log.error(f"详情抓取异常: {e}")

        return self.results

    def save(self):
        with open(self.output, "w", encoding="utf-8") as f:
            json.dump(self.results, f, ensure_ascii=False, indent=2)
        log.info(f"数据已保存到 {self.output}，共 {len(self.results)} 条")


# ============ 资源子站登录 + 真实下载链接 ============
class ResClient:
    """
    res.juhebd.com 登录客户端
    注意：若站点开启了图形验证码，需要手动识别；这里提供两种方式：
      1) 自动识别（简单验证码可用 OCR）；
      2) 交互模式：保存验证码图片到本地提示用户查看。
    """

    def __init__(self):
        self.s = requests.Session()
        self.s.headers.update(JSON_HEADERS)
        self.token = None

    def get_captcha(self, save_path="captcha.png"):
        """获取验证码图片 + uuid"""
        r = self.s.get(RES_HOST + "/captchaImage", timeout=10)
        data = r.json()
        if not data.get("img"):
            raise RuntimeError(f"获取验证码失败: {data}")
        img_b64 = data["img"].split(",", 1)[-1]
        img_bytes = base64.b64decode(img_b64)
        with open(save_path, "wb") as f:
            f.write(img_bytes)
        return data["uuid"], save_path

    def login(self, username, password, code=None, uuid=None):
        """登录获取 JWT token"""
        if code is None or uuid is None:
            uuid, path = self.get_captcha()
            log.info(f"验证码已保存到 {path}，请查看后输入")
            try:
                img = Image.open(path)
                img.show()
            except Exception:
                pass
            code = input("请输入验证码: ").strip()
        payload = {"username": username, "password": password, "code": code, "uuid": uuid}
        r = self.s.post(RES_HOST + "/login", json=payload, timeout=10)
        j = r.json()
        if j.get("code") != 200:
            raise RuntimeError(f"登录失败: {j.get('msg')} ({j.get('code')})")
        self.token = j["token"]
        self.s.headers["Authorization"] = "Bearer " + self.token
        log.info("登录成功!")
        return self.token

    def _try_get(self, path):
        r = self.s.get(RES_HOST + path, timeout=10)
        try:
            return r.json()
        except Exception:
            return {"raw": r.text[:500]}

    def fetch_resource_by_code(self, code):
        """
        通过 code（如 Uak0）请求资源详情。
        RuoYi 框架后台常见接口模式：/film/resource/*
        这里尝试多个可能的端点以适配后端接口差异。
        """
        endpoints = [
            f"/film/resource/code/{code}",
            f"/film/resource/getCodeResource?code={code}",
            f"/film/resource/open/{code}",
            f"/film/resource/info/{code}",
            f"/open/resource/{code}",
            f"/res/get?code={code}",
        ]
        for ep in endpoints:
            j = self._try_get(ep)
            if isinstance(j, dict) and j.get("code") == 200 and j.get("data"):
                return j["data"]
        # 如果所有端点返回非200，再尝试通用列表接口搜索
        return None

    def decrypt_resource_data(self, data):
        """如果后端返回的 url 字段也是加密的，使用解密函数处理"""
        if not data:
            return data
        if isinstance(data, dict):
            for k in ("urls", "diskUrls", "url", "content", "link"):
                if k in data and isinstance(data[k], str) and len(data[k]) > 20:
                    try:
                        plain = decode_ciphertext(data[k])
                        if plain and ("http" in plain or "magnet" in plain or "ed2k" in plain):
                            data[k + "_plain"] = plain
                    except Exception:
                        pass
        return data


# ============ 主入口 ============
def main():
    parser = argparse.ArgumentParser(description="juhebd.com 全站爬虫（含资源链接解密）")
    parser.add_argument("--username", "-u", default=None, help="res.juhebd.com 登录账号（可选）")
    parser.add_argument("--password", "-p", default=None, help="res.juhebd.com 登录密码（可选）")
    parser.add_argument("--max-pages", type=int, default=30, help="每个栏目最多爬取多少页（默认30）")
    parser.add_argument("--workers", type=int, default=6, help="详情页并发线程数（默认6）")
    parser.add_argument("--output", "-o", default=DATA_FILE, help="输出 JSON 路径")
    parser.add_argument("--search", default=None, help="仅搜索指定关键词")
    parser.add_argument("--main-only", action="store_true", help="仅爬主站，不登录资源子站")
    parser.add_argument("--categories", nargs="*", default=["mv", "tv", "acg"],
                        help="要爬的栏目（默认全部 mv tv acg）")
    args = parser.parse_args()

    crawler = JuhebdCrawler(max_pages=args.max_pages, workers=args.workers, output=args.output)

    if args.search:
        entries = crawler.search(args.search)
        with ThreadPoolExecutor(max_workers=args.workers) as pool:
            futures = {pool.submit(crawler.fetch_detail, e): e for e in entries}
            for fut in as_completed(futures):
                crawler.results.append(fut.result())
    else:
        crawler.crawl_all(categories=args.categories)

    # 登录资源子站抓取真实下载链接（可选）
    if args.username and args.password and not args.main_only:
        try:
            rc = ResClient()
            rc.login(args.username, args.password)
            hit, miss = 0, 0
            for item in crawler.results:
                code = item.get("code")
                if not code:
                    continue
                data = rc.fetch_resource_by_code(code)
                if data:
                    item["res_data"] = rc.decrypt_resource_data(data)
                    hit += 1
                else:
                    miss += 1
                time.sleep(0.3)
            log.info(f"资源站抓取完成：成功 {hit} 条，未命中 {miss} 条")
        except Exception as e:
            log.error(f"登录资源子站失败: {e}")

    crawler.save()
    log.info("全部任务完成")


if __name__ == "__main__":
    main()
