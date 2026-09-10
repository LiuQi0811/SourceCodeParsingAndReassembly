#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
粤漫之家 (ymvid.com) 全站爬虫
=================================
完美逆向实现：
  - AES-ECB/Pkcs7 解密视频播放地址（密钥: AVSI6788^765idue）
  - Browser-Code 指纹：固定visitorId + 日期 经 AES 加密，作为 cookie 和 header 同时传递
  - m3u8 路径格式: /allocate/playlist/{HEX}/{seriesId}?t={token}&vId={videoId}
  - 剧集列表: 从 <a href="/play/{videoId}/{seriesId}"> 解析每集独立 seriesId
功能：
  - 抓取全站分类→列表→详情→m3u8→ts分片
  - 多线程并发、断点续传、失败重试
  - 输出 JSON 元数据索引
  - 自动生成 ffmpeg 合并脚本
"""

import os
import re
import sys
import json
import time
import random
import hashlib
import logging
import argparse
import threading
from datetime import datetime
from urllib.parse import urljoin
from concurrent.futures import ThreadPoolExecutor, as_completed

import requests
from Crypto.Cipher import AES
from Crypto.Util.Padding import pad, unpad
from bs4 import BeautifulSoup

# ============ 配置 ============
BASE_URL = "https://www.ymvid.com"
AES_KEY = b"AVSI6788^765idue"          # 真实AES密钥（16字节，已逆向验证）
FIXED_VISITOR_ID = "876b666278eabb32c143075c887c20a8"  # 固定visitorId（MD5格式，服务端不校验真实性）
DEFAULT_UA = ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
              "(KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36")

TIMEOUT = 30
RETRY = 3

# 分类映射（来自站点导航）
CATEGORIES = {
    1: "粤语动画",
    2: "国语动画",
    4: "连载动画",
}

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%H:%M:%S",
)
log = logging.getLogger("ymvid")


# ============ 加密 / 指纹 ============

def aes_ecb_encrypt_hex(plaintext: str) -> str:
    """AES-ECB/PKCS7 加密 → hex 大写（与网站 encryptByAES 一致）。"""
    cipher = AES.new(AES_KEY, AES.MODE_ECB)
    ct = cipher.encrypt(pad(plaintext.encode("utf-8"), AES.block_size))
    return ct.hex().upper()


def aes_ecb_decrypt_hex(cipher_hex: str) -> str:
    """AES-ECB/PKCS7 解密，hex 密文 → 明文。"""
    cipher = AES.new(AES_KEY, AES.MODE_ECB)
    ct = bytes.fromhex(cipher_hex)
    return unpad(cipher.decrypt(ct), AES.block_size).decode("utf-8")


def gen_browser_code(visitor_id: str = FIXED_VISITOR_ID) -> str:
    """
    生成 Browser-Code：
      网站逻辑: AES_ECB(visitorId + "_" + YYYY-MM-DD)
      存 localStorage + cookie（key: browser-code），并作为 XHR header。
    """
    date_str = datetime.now().strftime("%Y-%m-%d")
    return aes_ecb_encrypt_hex(f"{visitor_id}_{date_str}")


# ============ HTTP 会话 ============

class YmvidSession:
    def __init__(self):
        self.s = requests.Session()
        self.s.headers.update({
            "User-Agent": DEFAULT_UA,
            "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
        })
        self.browser_code = gen_browser_code()
        # 先访问首页，在cookie里种下bc，让服务端session接受
        self._init_session()

    def _init_session(self):
        self.s.cookies.set("browser-code", self.browser_code, domain="www.ymvid.com")
        self.s.headers.update({
            "X-Client-Type": "web",
            "Browser-Code": self.browser_code,
        })
        try:
            self.s.get(BASE_URL + "/", timeout=TIMEOUT)
        except Exception as e:
            log.warning(f"初始化首页访问失败: {e}")

    def _check_refresh_bc(self):
        """跨天时刷新bc"""
        expected = gen_browser_code()
        if expected != self.browser_code:
            self.browser_code = expected
            self.s.cookies.set("browser-code", self.browser_code, domain="www.ymvid.com")
            self.s.headers["Browser-Code"] = self.browser_code

    def get(self, path_or_url: str, referer: str = None, **kwargs) -> requests.Response:
        self._check_refresh_bc()
        url = path_or_url if path_or_url.startswith("http") else BASE_URL + path_or_url
        headers = {}
        if referer:
            headers["Referer"] = referer
        for attempt in range(RETRY):
            try:
                resp = self.s.get(url, timeout=TIMEOUT, headers=headers, **kwargs)
                if resp.status_code == 403:
                    # bc 可能失效，重建session
                    log.warning("403，重建session...")
                    self._init_session()
                    time.sleep(1)
                    continue
                return resp
            except requests.RequestException as e:
                log.warning(f"GET {url} 失败({attempt+1}/{RETRY}): {e}")
                time.sleep(2 ** attempt + random.random())
        raise RuntimeError(f"GET {url} 反复失败")

    def get_media(self, url: str, referer: str = BASE_URL + "/") -> requests.Response:
        """下载 m3u8/ts/封面等媒体资源"""
        headers = {
            "Accept": "*/*",
            "Referer": referer,
        }
        for attempt in range(RETRY):
            try:
                resp = self.s.get(url, timeout=TIMEOUT, headers=headers)
                return resp
            except requests.RequestException as e:
                log.warning(f"GET {url} 失败({attempt+1}/{RETRY}): {e}")
                time.sleep(2 ** attempt)
        raise RuntimeError(f"GET {url} 反复失败")


# ============ 解析逻辑 ============

def parse_list_page(html: str):
    """解析列表页，返回 (视频列表, 总页数)"""
    soup = BeautifulSoup(html, "html.parser")
    videos = []
    seen = set()
    # 列表项结构：div.grid-content 包含一个封面a(.img-container>a)和一个标题a(.title>a)，
    # 都指向同一个/play/xxx。优先从 .grid-content 容器整体解析。
    for item in soup.select("div.grid-content, .article-item, .video-item, li.article"):
        a_list = item.find_all("a", href=re.compile(r"/play/\d+"))
        if not a_list:
            continue
        # 封面链接（第一个，通常在.img-container）
        cover_a = a_list[0]
        href = cover_a.get("href", "")
        m = re.search(r"/play/(\d+)", href)
        if not m:
            continue
        vid = m.group(1)
        if vid in seen:
            continue
        seen.add(vid)
        # 标题：从 .title > a 取，或 alt 属性，或 title 属性
        title = ""
        title_a = item.select_one(".title a")
        if title_a:
            title = title_a.get_text(strip=True) or title_a.get("title", "")
        if not title:
            img = item.find("img")
            if img:
                title = img.get("alt", "")
        if not title:
            for a in a_list:
                t = a.get("title") or a.get_text(strip=True)
                if t and not re.match(r"^(粤语|国语|全\d+集|更新到\d+集|连载)$", t):
                    title = t
                    break
        title = title.strip() or vid
        # 封面图
        cover = ""
        img = item.find("img")
        if img:
            cover = img.get("data-src") or img.get("src") or img.get("data-original") or ""
            if cover and cover.startswith("//"):
                cover = "https:" + cover
        # 剧集信息（.tag + .tips，如 "粤语" "全50集"）
        tags = [s.get_text(strip=True) for s in item.select(".tag, .tips") if s.get_text(strip=True)]
        episode_info = " ".join(tags)
        videos.append({
            "id": vid,
            "title": title,
            "cover": cover,
            "episode_info": episode_info,
            "url": BASE_URL + f"/play/{vid}",
        })
    # 总页数
    total_pages = 1
    page_text = soup.get_text()
    m = re.search(r"(\d+)\s*/\s*(\d+)", page_text)
    if m:
        total_pages = int(m.group(2))
    else:
        nums = []
        for pl in soup.select("ul.pagination li a, .page a, .pagination a, nav a"):
            n = re.search(r"[?&]page=(\d+)", pl.get("href", ""))
            if n:
                nums.append(int(n.group(1)))
        if nums:
            total_pages = max(nums)
    return videos, total_pages


def parse_detail_page(html: str, vid: str):
    """解析播放/详情页"""
    soup = BeautifulSoup(html, "html.parser")
    title = ""
    h1 = soup.find("h1")
    if h1:
        title = h1.get_text(strip=True)
    # 加密 input
    enc_input = soup.select_one(".section-content > input")
    enc_value = enc_input.get("value", "") if enc_input else ""
    # 剧集列表
    episodes = []
    seen_sid = set()
    for a in soup.select(".play-list a, .episode-list a, .ep-list a"):
        href = a.get("href", "")
        text = a.get_text(strip=True)
        data_num = a.get("data-num", "")
        # 剧集链接格式: /play/7055/118887
        m = re.match(r"/play/\d+/(\d+)", href)
        if not m:
            m = re.match(r"/play/(\d+)/(\d+)", href)
            # href 可能是全路径
            m2 = re.search(r"/play/\d+/(\d+)", href)
            if m2:
                sid = m2.group(1)
            else:
                continue
        else:
            sid = m.group(1)
        if sid in seen_sid:
            continue
        seen_sid.add(sid)
        episodes.append({
            "name": text or f"EP{len(episodes)+1:02d}",
            "href": urljoin(BASE_URL, href),
            "series_id": sid,
            "data_num": data_num,
        })
    # 描述
    desc = ""
    for sel in [".section-detail-main .desc", ".detail-desc", ".summary",
                ".intro", ".video-desc", ".content"]:
        el = soup.select_one(sel)
        if el:
            desc = el.get_text(" ", strip=True)
            break
    # 封面
    cover = ""
    og = soup.find("meta", property="og:image")
    if og:
        cover = og.get("content", "")
    # 视频封面
    if not cover:
        img = soup.select_one(".player-section img, .poster img, .video-cover img")
        if img:
            cover = img.get("src") or img.get("data-src") or ""
    # 分类/标签
    tags = []
    for tag in soup.select(".tags a, .tag-list a, .breadcrumb a"):
        t = tag.get_text(strip=True)
        if t and t not in ["首页", "粵漫之家", "粤漫之家"]:
            tags.append(t)
    return {
        "id": vid,
        "title": title,
        "enc_value": enc_value,
        "episodes": episodes,
        "description": desc,
        "cover": cover,
        "tags": tags,
    }


def get_playlist_url(enc_value: str, series_id: str, video_id: str) -> str:
    """
    解密 enc_value 并拼出 m3u8 URL：
      dec = decrypt(input.value)   # 形如 "/allocate/playlist/HEX?t=TOKEN"
      url = base + "/" + seriesId + "?t=" + TOKEN + "&vId=" + videoId
    """
    if not enc_value:
        return ""
    try:
        dec = aes_ecb_decrypt_hex(enc_value)
    except Exception as e:
        log.error(f"解密失败: {e}")
        return ""
    if "?t=" not in dec:
        return BASE_URL + dec
    base, t = dec.split("?t=", 1)
    return f"{BASE_URL}{base}/{series_id}?t={t}&vId={video_id}"


# ============ m3u8 下载 ============

def sanitize_filename(name: str) -> str:
    name = re.sub(r'[\\/:*?"<>|\r\n\t]', "_", name)
    name = name.strip(" .")
    return name[:180] if name else "unnamed"


def download_m3u8(session: YmvidSession, m3u8_url: str, save_dir: str,
                  video_name: str, max_workers: int = 8) -> str:
    """下载 m3u8 和所有 ts 分片到 save_dir/video_name/"""
    out_dir = os.path.join(save_dir, sanitize_filename(video_name))
    os.makedirs(out_dir, exist_ok=True)
    m3u8_local = os.path.join(out_dir, "index.m3u8")
    ts_dir = os.path.join(out_dir, "segments")
    os.makedirs(ts_dir, exist_ok=True)

    if os.path.exists(m3u8_local):
        # 已下载过，检查是否完整
        try:
            with open(m3u8_local, "r", encoding="utf-8") as f:
                existing = f.read()
            if "#EXTM3U" in existing and len(existing) > 100:
                # 检查分片数量
                ts_count = sum(1 for ln in existing.splitlines()
                               if ln.startswith("segments/") and ln.endswith(".ts"))
                if ts_count > 0 and all(
                    os.path.exists(os.path.join(out_dir, ln.strip()))
                    for ln in existing.splitlines()
                    if ln.startswith("segments/") and ln.endswith(".ts")
                ):
                    log.info(f"[跳过] {video_name} 已下载")
                    return out_dir
        except Exception:
            pass

    log.info(f"[m3u8] {m3u8_url}")
    resp = session.get_media(m3u8_url, referer=m3u8_url)
    if resp.status_code != 200 or not resp.text.strip():
        log.warning(f"[m3u8] 获取失败 status={resp.status_code}")
        return ""
    content = resp.text
    if "#EXTM3U" not in content:
        # 可能是主 m3u8（多码率），递归第一个子 m3u8
        sub = re.findall(r"^(?!#).+\.m3u8[^\s]*$", content, re.MULTILINE)
        if sub:
            sub_url = urljoin(m3u8_url, sub[0].strip())
            log.info(f"[m3u8] 主列表，转向 {sub_url}")
            return download_m3u8(session, sub_url, save_dir, video_name, max_workers)
        log.warning(f"[m3u8] 非标准m3u8，内容前200字符: {content[:200]}")
        return ""

    # 解析分片
    segments = []
    local_lines = []
    seg_idx = 0
    key_data_cache = {}
    current_key = None

    for line in content.splitlines():
        if line.startswith("#EXT-X-KEY:"):
            km = re.search(r'URI="([^"]+)"', line)
            iv_m = re.search(r'IV=0x([0-9A-Fa-f]+)', line)
            if km:
                key_uri = urljoin(m3u8_url, km.group(1))
                if key_uri not in key_data_cache:
                    try:
                        kr = session.get_media(key_uri, referer=m3u8_url)
                        key_data_cache[key_uri] = kr.content
                    except Exception:
                        key_data_cache[key_uri] = b""
                current_key = {
                    "uri": key_uri,
                    "iv": bytes.fromhex(iv_m.group(1)) if iv_m else None,
                }
            local_lines.append(line)
        elif line.startswith("#") or line.strip() == "":
            local_lines.append(line)
        else:
            seg_url = urljoin(m3u8_url, line.strip())
            seg_name = f"seg_{seg_idx:05d}.ts"
            seg_path = os.path.join(ts_dir, seg_name)
            segments.append({"url": seg_url, "path": seg_path, "name": seg_name})
            local_lines.append(f"segments/{seg_name}")
            seg_idx += 1

    with open(m3u8_local, "w", encoding="utf-8") as f:
        f.write("\n".join(local_lines))

    # 保存 key 文件（如果有 AES-128 加密）
    for key_uri, key_data in key_data_cache.items():
        if key_data:
            key_name = hashlib.md5(key_uri.encode()).hexdigest()[:12] + ".key"
            with open(os.path.join(out_dir, key_name), "wb") as f:
                f.write(key_data)
            # 替换 m3u8 里的 URI 为本地 key
            content_local = open(m3u8_local, "r", encoding="utf-8").read()
            content_local = content_local.replace(key_uri, key_name)
            with open(m3u8_local, "w", encoding="utf-8") as f:
                f.write(content_local)

    log.info(f"[m3u8] {len(segments)} 个分片，{max_workers} 线程下载")

    lock = threading.Lock()
    done = [0]
    failed = []

    def _dl(seg):
        if os.path.exists(seg["path"]) and os.path.getsize(seg["path"]) > 0:
            with lock:
                done[0] += 1
            return True
        for a in range(RETRY):
            try:
                r = session.get_media(seg["url"], referer=m3u8_url)
                if r.status_code != 200 or len(r.content) == 0:
                    raise RuntimeError(f"HTTP {r.status_code}")
                with open(seg["path"], "wb") as f:
                    f.write(r.content)
                with lock:
                    done[0] += 1
                    if done[0] % 50 == 0 or done[0] == len(segments):
                        log.info(f"[下载] {done[0]}/{len(segments)}")
                return True
            except Exception as e:
                time.sleep(1 + a)
        with lock:
            failed.append(seg)
        return False

    with ThreadPoolExecutor(max_workers=max_workers) as ex:
        list(ex.map(_dl, segments))
    if failed:
        log.warning(f"{len(failed)} 个分片失败，重试一次")
        for s in failed:
            _dl(s)

    # 生成 ffmpeg 合并脚本
    safe_name = sanitize_filename(video_name)
    merge_sh = os.path.join(out_dir, "merge.sh")
    merge_bat = os.path.join(out_dir, "merge.bat")
    concat_list = os.path.join(out_dir, "concat_list.txt")
    with open(concat_list, "w", encoding="utf-8") as f:
        for seg in segments:
            f.write(f"file 'segments/{seg['name']}'\n")
    with open(merge_sh, "w", encoding="utf-8") as f:
        f.write("#!/bin/bash\n")
        f.write('cd "$(dirname "$0")"\n')
        f.write("# 使用 ffmpeg 解密+合并（推荐，支持 AES-128 HLS 加密）:\n")
        f.write(f'ffmpeg -allowed_extensions ALL -i index.m3u8 -c copy "../{safe_name}.mp4"\n')
        f.write("# 若视频未加密，也可直接拼接:\n")
        f.write(f'# ffmpeg -f concat -safe 0 -i concat_list.txt -c copy "../{safe_name}.mp4"\n')
    with open(merge_bat, "w", encoding="utf-8") as f:
        f.write("@echo off\r\n")
        f.write("cd /d %~dp0\r\n")
        f.write(f'ffmpeg -allowed_extensions ALL -i index.m3u8 -c copy "..\\{safe_name}.mp4"\r\n')
        f.write("pause\r\n")
    os.chmod(merge_sh, 0o755)
    log.info(f"[完成] {out_dir}")
    return out_dir


def download_cover(session: YmvidSession, cover_url: str, save_path: str):
    """下载封面图"""
    if not cover_url:
        return
    try:
        if os.path.exists(save_path):
            return
        r = session.get_media(cover_url)
        if r.status_code == 200 and len(r.content) > 100:
            with open(save_path, "wb") as f:
                f.write(r.content)
    except Exception as e:
        log.debug(f"封面下载失败: {e}")


# ============ 主爬虫 ============

class YmvidCrawler:
    def __init__(self, output_dir: str = "./ymvid_downloads",
                 max_workers: int = 2, download_videos: bool = True,
                 categories=None, start_page: int = 1, end_page=None,
                 ts_workers: int = 8, max_episodes: int = None):
        self.session = YmvidSession()
        self.output_dir = os.path.abspath(output_dir)
        self.max_workers = max_workers
        self.download_videos = download_videos
        self.ts_workers = ts_workers
        self.categories = categories or [1]
        self.start_page = start_page
        self.end_page = end_page
        self.max_episodes = max_episodes  # 每部动画最多下载多少集（None=全部）
        self.video_dir = os.path.join(self.output_dir, "videos")
        os.makedirs(self.video_dir, exist_ok=True)
        self.index = {
            "site": BASE_URL,
            "crawled_at": datetime.now().isoformat(),
            "categories": {},
            "videos": [],
        }
        self.index_lock = threading.Lock()

    def save_index(self):
        path = os.path.join(self.output_dir, "index.json")
        with open(path, "w", encoding="utf-8") as f:
            json.dump(self.index, f, ensure_ascii=False, indent=2)

    def crawl_list(self, cat_id: int):
        log.info(f"===== 分类 {cat_id} ({CATEGORIES.get(cat_id,'?')}) =====")
        url = f"/list/{cat_id}/c{cat_id}-s0-v0-l0-t0-y0/time_desc"
        resp = self.session.get(url, referer=BASE_URL + "/")
        videos, total_pages = parse_list_page(resp.text)
        log.info(f"首页解析到 {len(videos)} 个视频，共 {total_pages} 页")
        if self.end_page:
            total_pages = min(total_pages, self.end_page)
        for v in videos:
            v["category"] = CATEGORIES.get(cat_id, str(cat_id))
            v["category_id"] = cat_id
        yield from videos
        for page in range(max(2, self.start_page), total_pages + 1):
            time.sleep(random.uniform(0.8, 2.0))
            try:
                resp = self.session.get(f"{url}?page={page}", referer=BASE_URL + url)
                vlist, _ = parse_list_page(resp.text)
                log.info(f"第 {page}/{total_pages} 页：{len(vlist)} 个视频")
                for v in vlist:
                    v["category"] = CATEGORIES.get(cat_id, str(cat_id))
                    v["category_id"] = cat_id
                yield from vlist
            except Exception as e:
                log.error(f"第 {page} 页失败: {e}")

    def crawl_video(self, vinfo: dict) -> dict:
        vid = vinfo["id"]
        try:
            resp = self.session.get(vinfo["url"], referer=BASE_URL + "/")
            detail = parse_detail_page(resp.text, vid)
        except Exception as e:
            log.error(f"[{vid}] 详情页失败: {e}")
            return vinfo
        vinfo.update(detail)
        log.info(f"[{vid}] 《{detail['title']}》共 {len(detail['episodes'])} 集")

        cat_dir = os.path.join(self.video_dir, sanitize_filename(vinfo.get("category", "default")))
        series_dir = os.path.join(cat_dir, sanitize_filename(detail["title"] or vid))
        os.makedirs(series_dir, exist_ok=True)

        # 下载封面
        if detail.get("cover"):
            ext = os.path.splitext(detail["cover"].split("?")[0])[1] or ".jpg"
            cover_path = os.path.join(series_dir, f"cover{ext}")
            download_cover(self.session, detail["cover"], cover_path)
            vinfo["cover_local"] = cover_path

        if not self.download_videos:
            # 保存元数据
            meta_path = os.path.join(series_dir, "meta.json")
            with open(meta_path, "w", encoding="utf-8") as f:
                json.dump(vinfo, f, ensure_ascii=False, indent=2)
            return vinfo

        saved_eps = []
        eps = detail["episodes"]
        if self.max_episodes:
            eps = eps[: self.max_episodes]
        for idx, ep in enumerate(eps, start=1):
            ep_name = ep.get("name") or f"EP{idx:03d}"
            try:
                if idx == 1:
                    ep_detail = detail
                    ep_enc = detail["enc_value"]
                else:
                    time.sleep(random.uniform(0.8, 1.8))
                    er = self.session.get(ep["href"], referer=vinfo["url"])
                    ep_detail = parse_detail_page(er.text, vid)
                    ep_enc = ep_detail["enc_value"]
                m3u8_url = get_playlist_url(ep_enc, ep["series_id"], vid)
                if not m3u8_url:
                    log.warning(f"[{vid}] {ep_name} 无法获取m3u8")
                    continue
                log.info(f"[{vid}] {ep_name}: {m3u8_url[:80]}...")
                saved = download_m3u8(
                    self.session, m3u8_url, series_dir,
                    f"EP{idx:03d}_{sanitize_filename(ep_name)}",
                    max_workers=self.ts_workers,
                )
                if saved:
                    saved_eps.append({
                        "ep_index": idx,
                        "ep_name": ep_name,
                        "series_id": ep["series_id"],
                        "dir": saved,
                        "m3u8_url": m3u8_url,
                    })
                time.sleep(random.uniform(0.5, 1.2))
            except Exception as e:
                log.error(f"[{vid}] {ep_name} 下载失败: {e}")
        vinfo["saved_episodes"] = saved_eps
        # 保存每部动画的元数据
        meta_path = os.path.join(series_dir, "meta.json")
        with open(meta_path, "w", encoding="utf-8") as f:
            json.dump(vinfo, f, ensure_ascii=False, indent=2)
        return vinfo

    def run(self):
        log.info(f"输出目录: {self.output_dir}")
        all_videos = []
        for cat in self.categories:
            for v in self.crawl_list(cat):
                all_videos.append(v)
        log.info(f"共发现 {len(all_videos)} 个视频，开始并发处理 ({self.max_workers} 线程)")

        with ThreadPoolExecutor(max_workers=self.max_workers) as ex:
            futures = {ex.submit(self.crawl_video, v): v for v in all_videos}
            for fut in as_completed(futures):
                try:
                    r = fut.result()
                    with self.index_lock:
                        self.index["videos"].append(r)
                        if len(self.index["videos"]) % 3 == 0:
                            self.save_index()
                except Exception as e:
                    log.error(f"处理异常: {e}")
        # 分类统计
        for cat in self.categories:
            self.index["categories"][str(cat)] = {
                "name": CATEGORIES.get(cat, str(cat)),
                "count": sum(1 for v in self.index["videos"] if v.get("category_id") == cat),
            }
        self.save_index()
        log.info(f"✅ 全部完成！共处理 {len(self.index['videos'])} 个视频")
        log.info(f"索引文件: {os.path.join(self.output_dir, 'index.json')}")


# ============ CLI ============

def main():
    parser = argparse.ArgumentParser(
        description="粤漫之家 (ymvid.com) 全站爬虫 - AES完美逆向版",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
示例:
  # 单视频测试
  python ymvid_crawler.py --single 7055
  # 抓取粤语动画第1-2页（仅元数据）
  python ymvid_crawler.py -c 1 --start-page 1 --end-page 2 --meta-only
  # 全站抓取粤语动画（每部最多下3集，先试跑）
  python ymvid_crawler.py -c 1 -w 2 -t 8 --max-episodes 3
  # 完整全站抓取（粤语+国语）
  python ymvid_crawler.py -c 1,2,4 -w 2 -t 8
        """)
    parser.add_argument("-o", "--output", default="./ymvid_downloads", help="输出目录")
    parser.add_argument("-c", "--categories", default="1",
                        help="分类ID，逗号分隔 (1=粤语动画,2=国语动画,4=连载动画) 默认:1")
    parser.add_argument("-w", "--workers", type=int, default=2, help="视频并发数 (默认2)")
    parser.add_argument("-t", "--ts-workers", type=int, default=8, help="ts分片并发线程数 (默认8)")
    parser.add_argument("--start-page", type=int, default=1, help="列表起始页 (默认1)")
    parser.add_argument("--end-page", type=int, default=None, help="列表结束页 (默认全部)")
    parser.add_argument("--meta-only", action="store_true", help="只抓元数据，不下载视频")
    parser.add_argument("--max-episodes", type=int, default=None,
                        help="每部动画最多下载多少集（先测试时建议设3）")
    parser.add_argument("--single", type=str, default=None,
                        help="只抓单个视频，传入 /play/xxx 的URL或ID")
    args = parser.parse_args()

    cats = [int(x.strip()) for x in args.categories.split(",") if x.strip().isdigit()]

    crawler = YmvidCrawler(
        output_dir=args.output,
        max_workers=args.workers,
        download_videos=not args.meta_only,
        categories=cats,
        start_page=args.start_page,
        end_page=args.end_page,
        ts_workers=args.ts_workers,
        max_episodes=args.max_episodes,
    )

    if args.single:
        m = re.search(r"/play/(\d+)", args.single)
        vid = m.group(1) if m else args.single.strip("/")
        vinfo = {"id": vid, "url": f"{BASE_URL}/play/{vid}", "category": "single"}
        result = crawler.crawl_video(vinfo)
        crawler.index["videos"].append(result)
        crawler.save_index()
        print(json.dumps({
            "title": result.get("title"),
            "episodes": len(result.get("episodes", [])),
            "saved": len(result.get("saved_episodes", [])),
            "dir": os.path.join(crawler.output_dir, "videos"),
        }, ensure_ascii=False, indent=2))
        return

    crawler.run()


if __name__ == "__main__":
    main()
