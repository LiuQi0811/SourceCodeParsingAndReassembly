#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
txtxiaoshuo.com 全站小说爬虫
功能：
1. 抓取全部分类下的所有小说元数据（标题、作者、简介、大小、分类、下载链接等）
2. 支持城通网盘(ctfile)下载链接的自动解析与下载
3. 断点续爬、去重、错误重试
4. 元数据保存为JSON/CSV，小说文件按分类保存
5. 无需逆向解密——网站无前端加密，下载密码已在URL参数中

使用方法：
    pip install requests beautifulsoup4 lxml tqdm
    python txtxiaoshuo_spider.py                  # 只抓取元数据
    python txtxiaoshuo_spider.py --download        # 抓取元数据并下载小说
    python txtxiaoshuo_spider.py --category 1      # 只抓取分类1(都市·异能)
    python txtxiaoshuo_spider.py --start-page 1    # 从第1页开始
"""

import os
import re
import sys
import json
import time
import csv
import argparse
import logging
import hashlib
from urllib.parse import urljoin, urlparse, parse_qs, unquote
from datetime import datetime
from concurrent.futures import ThreadPoolExecutor, as_completed

import requests
from bs4 import BeautifulSoup
from tqdm import tqdm

# ============ 配置 ============
BASE_URL = "https://www.txtxiaoshuo.com/"
HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
    "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
    "Accept-Encoding": "gzip, deflate, br",
    "Connection": "keep-alive",
    "Referer": BASE_URL,
}
CTFILE_HEADERS = {
    "User-Agent": HEADERS["User-Agent"],
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "zh-CN,zh;q=0.9",
    "Referer": "https://www.ctfile.com/",
}

# 分类映射（从导航栏获取）
CATEGORIES = {
    1: "都市·异能",
    2: "奇幻·玄幻",
    3: "武侠·仙侠",
    4: "科幻·游戏",
    5: "惊悚·灵异",
    6: "军事·历史",
}

# 输出目录
OUTPUT_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "novels")
os.makedirs(OUTPUT_DIR, exist_ok=True)
for cat_name in CATEGORIES.values():
    os.makedirs(os.path.join(OUTPUT_DIR, cat_name), exist_ok=True)

# 日志配置
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[
        logging.FileHandler(os.path.join(OUTPUT_DIR, "spider.log"), encoding="utf-8"),
        logging.StreamHandler(sys.stdout),
    ]
)
logger = logging.getLogger(__name__)

# 请求Session（复用连接、保持cookie）
session = requests.Session()
session.headers.update(HEADERS)
# 禁用HTTP/3以避免服务器不支持的问题
try:
    from urllib3.util.ssl_ import create_urllib3_context
    import urllib3
    urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)
except:
    pass
# 通过设置适配器强制HTTP/1.1
from requests.adapters import HTTPAdapter
session.mount("https://", HTTPAdapter(max_retries=3))
session.mount("http://", HTTPAdapter(max_retries=3))


def safe_request(url, method="GET", headers=None, params=None, data=None, timeout=30, max_retries=3):
    """带重试机制的安全请求"""
    for attempt in range(max_retries):
        try:
            resp = session.request(
                method, url, headers=headers, params=params, data=data, timeout=timeout
            )
            resp.raise_for_status()
            resp.encoding = resp.apparent_encoding or "utf-8"
            return resp
        except requests.RequestException as e:
            wait = 2 ** attempt
            logger.warning(f"请求失败({attempt+1}/{max_retries}) {url}: {e}, {wait}s后重试...")
            time.sleep(wait)
    logger.error(f"请求最终失败: {url}")
    return None


def get_max_page(category_id):
    """获取分类下的最大页数"""
    url = f"{BASE_URL}?cate={category_id}"
    resp = safe_request(url)
    if not resp:
        return 1
    soup = BeautifulSoup(resp.text, "lxml")
    # 查找分页区域，获取最后一页
    page_links = soup.select("div.pager a, ul.pagination a, .page a")
    max_page = 1
    for a in page_links:
        href = a.get("href", "")
        match = re.search(r"page=(\d+)", href)
        if match:
            page_num = int(match.group(1))
            if page_num > max_page:
                max_page = page_num
        # 也检查文本
        text = a.get_text(strip=True)
        if text.isdigit():
            max_page = max(max_page, int(text))
    # 如果没找到，尝试找"››"末页链接
    last_page = soup.select_one("a:contains('››'), a.end, a.last")
    if last_page:
        href = last_page.get("href", "")
        match = re.search(r"page=(\d+)", href)
        if match:
            max_page = int(match.group(1))
    logger.info(f"分类{CATEGORIES[category_id]} 共 {max_page} 页")
    return max_page


def parse_novel_list_page(category_id, page):
    """解析分类列表页，返回该页所有小说的基本信息列表"""
    url = f"{BASE_URL}?cate={category_id}&page={page}"
    resp = safe_request(url)
    if not resp:
        return []
    soup = BeautifulSoup(resp.text, "lxml")
    novels = []

    # 解析列表项 - 根据网站实际结构
    items = soup.select("ul.list-it li") or soup.select(".list li") or soup.select("article")
    if not items:
        # 备用选择器：所有含小说链接的h2
        items = soup.select("h2")

    for item in items:
        try:
            # 获取标题和链接
            title_link = item.select_one("h2 a") if item.name != "h2" else item.select_one("a")
            if not title_link:
                title_link = item.find("a", href=re.compile(r"\?id=\d+"))
            if not title_link:
                continue

            title_text = title_link.get("title", "") or title_link.get_text(strip=True)
            href = title_link.get("href", "")
            if not href or "?id=" not in href:
                continue
            novel_url = urljoin(BASE_URL, href)
            novel_id_match = re.search(r"id=(\d+)", href)
            novel_id = novel_id_match.group(1) if novel_id_match else hashlib.md5(novel_url.encode()).hexdigest()[:10]

            # 解析标题和作者
            title_text = title_text.strip()
            author = ""
            status = ""
            # 格式: 《书名》（完结全本）作者：作者名
            name_match = re.search(r"《(.+?)》", title_text)
            novel_name = name_match.group(1) if name_match else title_text
            author_match = re.search(r"作者[：:]\s*(.+)$", title_text)
            if author_match:
                author = author_match.group(1).strip()
            if "精校" in title_text:
                status = "精校全本"
            elif "完结" in title_text:
                status = "完结全本"

            # 获取简介段落
            desc_p = item.select_one("p")
            desc_text = desc_p.get_text(strip=True) if desc_p else item.get_text(strip=True)
            file_size = ""
            size_match = re.search(r"文件大小[：:]\s*([\d.]+\s*[KMG]B)", desc_text)
            if size_match:
                file_size = size_match.group(1).strip()
            # 简介内容（去掉书名和大小行）
            intro_match = re.search(r"内容简介[：:]\s*(.+?)\.\.\.", desc_text, re.DOTALL)
            if not intro_match:
                intro_match = re.search(r"内容简介[：:]\s*(.+)$", desc_text, re.DOTALL)
            intro = intro_match.group(1).strip() if intro_match else ""

            # 日期、浏览量
            info_spans = item.select(".info span")
            pub_date = ""
            views = ""
            for span in info_spans:
                text = span.get_text(strip=True)
                # 去掉iconfont私有字符
                text = re.sub(r'[\ue000-\uf8ff]', '', text).strip()
                date_match = re.search(r"\d{4}-\d{2}-\d{2}", text)
                if date_match:
                    pub_date = date_match.group()
                elif text.isdigit():
                    views = text

            novels.append({
                "id": novel_id,
                "name": novel_name,
                "author": author,
                "status": status,
                "file_size": file_size,
                "intro": intro,
                "category_id": category_id,
                "category": CATEGORIES.get(category_id, ""),
                "url": novel_url,
                "pub_date": pub_date,
                "views": views,
                "download_url": "",
                "filename": "",
                "downloaded": False,
            })
        except Exception as e:
            logger.error(f"解析列表项出错: {e}")
            continue

    return novels


def parse_novel_detail(novel):
    """解析小说详情页，获取城通网盘下载链接"""
    resp = safe_request(novel["url"])
    if not resp:
        return novel
    soup = BeautifulSoup(resp.text, "lxml")

    # 查找下载按钮 - 城通网盘链接
    content_div = soup.select_one(".content") or soup.select_one("article") or soup
    download_link = content_div.find("a", href=re.compile(r"ctfile\.com"))
    if download_link:
        novel["download_url"] = download_link.get("href", "")
        logger.info(f"[{novel['name']}] 找到下载链接: {novel['download_url']}")
    else:
        # 尝试所有外链
        for a in soup.find_all("a", href=True):
            href = a["href"]
            if "ctfile.com" in href or "ctfile" in href:
                novel["download_url"] = href
                break

    # 补充/更新详情页可能更完整的信息
    h1 = soup.select_one("h1")
    if h1:
        title_text = h1.get_text(strip=True)
        name_match = re.search(r"《(.+?)》", title_text)
        if name_match:
            novel["name"] = name_match.group(1)
        author_match = re.search(r"作者[：:]\s*(.+)$", title_text)
        if author_match:
            novel["author"] = author_match.group(1).strip()

    # 从正文提取大小信息
    for p in soup.select(".content p"):
        text = p.get_text(strip=True)
        size_match = re.search(r"文件大小[：:]\s*([\d.]+\s*[KMG]B)", text)
        if size_match and not novel["file_size"]:
            novel["file_size"] = size_match.group(1)
        intro_match = re.search(r"内容简介[：:]\s*(.+)", text)
        if intro_match and not novel["intro"]:
            novel["intro"] = intro_match.group(1).strip()

    return novel


# ============ 城通网盘下载模块 ============

def parse_ctfile_download_page(url):
    """
    解析城通网盘分享页面，获取真实下载链接。
    城通网盘普通下载流程：
    1. 访问分享页（带密码参数p=）
    2. 点击"普通下载" -> 触发一个API请求获取临时下载链接
    3. 等待倒计时后出现真实下载地址
    
    返回真实下载URL或None
    """
    # 确保有密码参数
    if "p=" not in url:
        url += ("&" if "?" in url else "?") + "p=txtxiaoshuo"

    resp = safe_request(url, headers=CTFILE_HEADERS)
    if not resp:
        return None, None

    html = resp.text
    # 解析文件名
    filename_match = re.search(r"<h4[^>]*>\s*(?:<[^>]+>)*\s*([^<]+\.(?:txt|zip|rar|7z))", html, re.IGNORECASE)
    filename = filename_match.group(1).strip() if filename_match else None

    # 方法1：直接从页面中提取 file_id 和 user_id，调用API获取下载链接
    # 城通网盘新版API: https://webapi.ctfile.com/getfile.php?fid=xxx&uid=xxx
    uid_match = re.search(r"/f/(\d+)-(\d+)-", url)
    if uid_match:
        uid = uid_match.group(1)
        fid = uid_match.group(2)
    else:
        uid_match = re.search(r"uid[=:]\s*['\"]?(\d+)", html)
        fid_match = re.search(r"fid[=:]\s*['\"]?(\d+)", html)
        uid = uid_match.group(1) if uid_match else None
        fid = fid_match.group(1) if fid_match else None

    if uid and fid:
        # 提取密码
        pass_match = re.search(r"[?&]p=([^&]+)", url)
        password = pass_match.group(1) if pass_match else "txtxiaoshuo"

        # 调用API获取下载信息
        api_url = f"https://webapi.ctfile.com/getfile.php?fid={fid}&uid={uid}&p={password}"
        api_resp = safe_request(api_url, headers={
            **CTFILE_HEADERS,
            "Referer": url,
            "X-Requested-With": "XMLHttpRequest",
            "Accept": "application/json, text/javascript, */*; q=0.01",
        })
        if api_resp:
            try:
                data = api_resp.json()
                logger.debug(f"城通API返回: {json.dumps(data, ensure_ascii=False)[:500]}")
                if data.get("code") == 200 or data.get("file"):
                    file_info = data.get("file", data)
                    downurl = file_info.get("downurl") or file_info.get("vipdurl") or file_info.get("url")
                    if not filename:
                        filename = file_info.get("file_name") or file_info.get("name")
                    if downurl:
                        # 有些返回需要再请求一次跳转
                        return downurl, filename
            except json.JSONDecodeError:
                pass

    # 方法2：从页面中直接找下载链接（有时直接在HTML中）
    # 查找所有可能的下载URL模式
    down_patterns = [
        r'(https?://[^"\'>\s]*(?:d|down|download|file)[^"\'>\s]*\.ctfile\.com[^"\'>\s]*)',
        r'(https?://[^"\'>\s]*ctfile\.com[^"\'>\s]*(?:download|down)[^"\'>\s]*)',
        r'downurl["\s:=]+["\']([^"\']+)["\']',
        r'download_url["\s:=]+["\']([^"\']+)["\']',
    ]
    for pattern in down_patterns:
        match = re.search(pattern, html)
        if match:
            down_url = match.group(1)
            if down_url.startswith("//"):
                down_url = "https:" + down_url
            if not filename:
                fn_match = re.search(r'filename[^=]*=\s*["\']?([^"\';\s&]+)', html)
                if fn_match:
                    filename = unquote(fn_match.group(1))
            return down_url, filename

    # 方法3：使用备用API端点
    if uid and fid:
        # 尝试新版 get_file_info API
        for endpoint in [
            f"https://webapi.ctfile.com/get_file_url.php?uid={uid}&fid={fid}&p={password}",
            f"https://webapi.ctfile.com/file.php?fid={fid}&uid={uid}",
        ]:
            r = safe_request(endpoint, headers={
                **CTFILE_HEADERS,
                "Referer": url,
            })
            if r:
                txt = r.text
                # 可能是JSON或JSONP
                for m in re.finditer(r'(https?://[^"\'\\\s]+)', txt):
                    durl = m.group(1).replace("\\/", "/")
                    if "ctfile" in durl or "download" in durl.lower():
                        return durl, filename
                try:
                    j = json.loads(txt)
                    if isinstance(j, dict):
                        for k in ["downurl", "url", "download_url", "vipdurl"]:
                            if k in j and j[k]:
                                return j[k], j.get("file_name", filename)
                except:
                    pass

    logger.warning(f"未能解析出城通网盘下载链接: {url}")
    return None, filename


def init_ctfile_session():
    """初始化城通网盘session，获取必要的cookies和页面参数"""
    # 这个函数用于获取ctfile的session
    return session


def parse_ctfile_download_page_v2(url):
    """
    解析城通网盘下载链接（v2版本 - 从HTML中提取渲染后的参数）
    由于城通网盘使用前端JS渲染参数，纯HTTP请求需要先获取页面中的动态参数
    
    返回 (download_url, filename) 或 (None, filename)
    """
    # 确保有密码
    if "p=" not in url:
        url += ("&" if "?" in url else "?") + "p=txtxiaoshuo"
    
    # 解析UID/FID/CHK
    uid = fid = file_chk = None
    m = re.search(r'/f/(\d+)-(\d+)-([a-f0-9]+)', url)
    if m:
        uid, fid, chk = m.group(1), m.group(2), m.group(3)
    
    if not uid:
        return None, None

    s = requests.Session()
    s.headers.update(CTFILE_HEADERS)
    resp = s.get(url, timeout=30)
    if not resp or resp.status_code != 200:
        return None, None
    
    html = resp.text
    
    # 提取文件名
    filename = None
    fn_match = re.search(r'<h4[^>]*>(?:<[^>]+>)*\s*([^<]+\.(?:txt|zip|rar|7z|epub|pdf))', html, re.IGNORECASE)
    if fn_match:
        filename = fn_match.group(1).strip()
    
    # 注意：城通网盘新版使用前端JS动态加载下载参数
    # file_chk、verifycode等参数由JS在运行时计算
    # 纯HTTP难以完美模拟（涉及MD5签名、时间戳、广告检测等）
    # 
    # 这里提供两种方案：
    # 1. 如果能从页面中找到硬编码的下载链接
    # 2. 返回分享页URL，配合浏览器扩展/IDM批量下载
    
    # 查找页面中已有的直接链接
    direct_link_patterns = [
        r'(https?://(?:d|dx|down)[^"\'<>\s]+\.ctfile\.com/[^"\'<>\s]+)',
        r'href=["\']([^"\']+\.(?:txt|zip|rar|7z)["\'])',
    ]
    for pattern in direct_link_patterns:
        match = re.search(pattern, html, re.IGNORECASE)
        if match:
            durl = match.group(1).replace("\\/", "")
            return durl, filename
    
    # 返回None表示需要手动/浏览器下载，但链接本身是有效的
    logger.info(f"城通网盘链接有效(密码已在URL中)，可直接用浏览器/IDM打开: {url}")
    return None, filename


def download_from_ctfile(novel, save_dir):
    """
    从城通网盘下载小说文件
    
    注意：城通网盘对非会员下载有严格的JS加密签名校验、广告倒计时、IP限速等措施。
    自动HTTP下载成功率受限时，推荐：
    1. 使用 --metadata-only 只抓取元数据
    2. 将下载链接导入IDM/迅雷等下载器批量下载
    3. 使用浏览器打开链接手动下载（密码已自动填充）
    """
    download_url = novel["download_url"]
    if not download_url:
        return False

    # 确保密码参数存在
    if "p=" not in download_url:
        download_url += ("&" if "?" in download_url else "?") + "p=txtxiaoshuo"
        novel["download_url"] = download_url

    logger.info(f"下载链接: {download_url}")
    logger.info(f"提示: 如自动下载失败，可在浏览器中打开上述链接直接下载(密码已自动填充)")

    # 尝试解析并下载
    down_url, filename = parse_ctfile_download_page_v2(download_url)

    if not filename:
        filename = f"{novel['name']}.txt"

    # 清理文件名
    filename = re.sub(r'[\\/:*?"<>|]', "_", filename)
    if not filename.lower().endswith((".txt", ".zip", ".rar", ".7z")):
        filename += ".txt"

    save_path = os.path.join(save_dir, filename)
    if os.path.exists(save_path) and os.path.getsize(save_path) > 1024:
        logger.info(f"文件已存在，跳过: {filename}")
        novel["filename"] = filename
        novel["downloaded"] = True
        return True

    if down_url:
        # 尝试直接下载
        try:
            resp = requests.get(down_url, headers={
                **CTFILE_HEADERS,
                "Referer": download_url,
            }, stream=True, timeout=60)
            
            total_size = int(resp.headers.get("content-length", 0))
            content_type = resp.headers.get("Content-Type", "")
            
            if total_size > 1024 and "text/html" not in content_type:
                with open(save_path, "wb") as f, tqdm(
                    desc=filename[:20],
                    total=total_size,
                    unit="B",
                    unit_scale=True,
                    unit_divisor=1024,
                ) as bar:
                    for chunk in resp.iter_content(chunk_size=8192):
                        if chunk:
                            f.write(chunk)
                            bar.update(len(chunk))
                
                novel["filename"] = filename
                novel["downloaded"] = True
                logger.info(f"下载完成: {filename}")
                return True
        except Exception as e:
            logger.warning(f"自动下载失败: {e}")
    
    # 如果自动下载失败，保存下载链接到文件
    link_file = os.path.join(save_dir, filename + ".link.txt")
    with open(link_file, "w", encoding="utf-8") as f:
        f.write(f"书名: {novel['name']}\n")
        f.write(f"作者: {novel['author']}\n")
        f.write(f"文件名: {filename}\n")
        f.write(f"下载链接(密码已在URL中): {download_url}\n")
        f.write(f"使用方法: 用浏览器打开链接，点击'普通下载'->'立即下载'即可\n")
    
    novel["filename"] = link_file
    novel["downloaded"] = False
    logger.info(f"已保存下载链接到: {link_file}")
    return False


# ============ 主爬虫逻辑 ============

def load_existing_metadata():
    """加载已爬取的元数据（断点续爬）"""
    meta_path = os.path.join(OUTPUT_DIR, "novels_metadata.json")
    if os.path.exists(meta_path):
        with open(meta_path, "r", encoding="utf-8") as f:
            return json.load(f)
    return {}


def save_metadata(novels_dict):
    """保存元数据到JSON和CSV"""
    json_path = os.path.join(OUTPUT_DIR, "novels_metadata.json")
    csv_path = os.path.join(OUTPUT_DIR, "novels_metadata.csv")

    with open(json_path, "w", encoding="utf-8") as f:
        json.dump(list(novels_dict.values()), f, ensure_ascii=False, indent=2)

    # CSV
    if novels_dict:
        fields = ["id", "name", "author", "status", "file_size", "category",
                   "pub_date", "views", "intro", "url", "download_url",
                   "filename", "downloaded"]
        with open(csv_path, "w", encoding="utf-8-sig", newline="") as f:
            writer = csv.DictWriter(f, fieldnames=fields)
            writer.writeheader()
            for n in novels_dict.values():
                writer.writerow({k: n.get(k, "") for k in fields})

    logger.info(f"元数据已保存: {len(novels_dict)} 本小说")


def crawl_category(category_id, start_page=1, do_download=False, novels_dict=None):
    """爬取单个分类的所有小说"""
    if novels_dict is None:
        novels_dict = {}

    max_page = get_max_page(category_id)
    logger.info(f"开始爬取分类 [{CATEGORIES[category_id]}] 第{start_page}-{max_page}页")

    for page in range(start_page, max_page + 1):
        logger.info(f"正在抓取第 {page}/{max_page} 页...")
        time.sleep(1)  # 礼貌延迟
        novels = parse_novel_list_page(category_id, page)
        logger.info(f"第 {page} 页解析到 {len(novels)} 本小说")

        for novel in novels:
            nid = novel["id"]
            if nid in novels_dict:
                # 已有记录，只更新缺失字段
                for k, v in novel.items():
                    if not novels_dict[nid].get(k) and v:
                        novels_dict[nid][k] = v
                continue

            time.sleep(0.5)
            novel = parse_novel_detail(novel)
            novels_dict[nid] = novel

        # 每5页保存一次
        if page % 5 == 0:
            save_metadata(novels_dict)

    # 分类爬完后保存
    save_metadata(novels_dict)

    # 如果需要下载
    if do_download:
        cat_dir = os.path.join(OUTPUT_DIR, CATEGORIES[category_id])
        to_download = [n for n in novels_dict.values()
                      if n.get("category_id") == category_id and n.get("download_url") and not n.get("downloaded")]
        logger.info(f"分类 [{CATEGORIES[category_id]}] 待下载: {len(to_download)} 本")

        for novel in tqdm(to_download, desc=f"下载{CATEGORIES[category_id]}"):
            time.sleep(2)
            download_from_ctfile(novel, cat_dir)

        save_metadata(novels_dict)

    return novels_dict


def main():
    parser = argparse.ArgumentParser(description="txtxiaoshuo.com 全站小说爬虫")
    parser.add_argument("--download", action="store_true", help="爬取后自动下载小说文件")
    parser.add_argument("--category", type=int, default=0, help="只爬取指定分类(1-6)，0=全部分类")
    parser.add_argument("--start-page", type=int, default=1, help="起始页码")
    parser.add_argument("--workers", type=int, default=1, help="并发线程数（下载时使用）")
    args = parser.parse_args()

    logger.info("=" * 60)
    logger.info("txtxiaoshuo.com 全站爬虫启动")
    logger.info(f"下载模式: {'是' if args.download else '否(仅元数据)'}")
    logger.info(f"输出目录: {OUTPUT_DIR}")
    logger.info("=" * 60)

    # 加载已有数据
    novels_dict = load_existing_metadata()
    logger.info(f"已存在元数据: {len(novels_dict)} 本")

    # 确定要爬取的分类
    if args.category > 0:
        categories = [args.category]
    else:
        categories = list(CATEGORIES.keys())

    # 爬取每个分类
    for cat_id in categories:
        novels_dict = crawl_category(
            cat_id,
            start_page=args.start_page if cat_id == args.category else 1,
            do_download=args.download,
            novels_dict=novels_dict,
        )

    # 最终保存
    save_metadata(novels_dict)

    # 统计
    total = len(novels_dict)
    downloaded = sum(1 for n in novels_dict.values() if n.get("downloaded"))
    has_link = sum(1 for n in novels_dict.values() if n.get("download_url"))
    logger.info("=" * 60)
    logger.info(f"爬取完成! 共收录 {total} 本小说")
    logger.info(f"  - 有下载链接: {has_link} 本")
    logger.info(f"  - 已下载: {downloaded} 本")
    logger.info(f"元数据文件: {os.path.join(OUTPUT_DIR, 'novels_metadata.json')}")
    logger.info(f"CSV文件: {os.path.join(OUTPUT_DIR, 'novels_metadata.csv')}")
    logger.info(f"小说保存目录: {OUTPUT_DIR}")
    logger.info("=" * 60)


if __name__ == "__main__":
    main()
