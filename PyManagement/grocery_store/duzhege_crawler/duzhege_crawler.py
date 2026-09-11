#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
读者阁(duzhege.cn)全站PDF爬虫
功能：
1. 自动抓取sitemap所有文章链接
2. 解析每篇文章的下载链接（主源+备用源自动切换）
3. 自动重试、断点续传、下载进度显示
4. 按杂志名称分类保存
5. 自动跳过已下载文件
6. 支持多线程并发下载
"""

import os
import re
import time
import json
import random
import requests
from urllib.parse import urljoin, urlparse, unquote
from concurrent.futures import ThreadPoolExecutor, as_completed
from bs4 import BeautifulSoup
from tqdm import tqdm
import logging

# 配置
BASE_URL = "https://duzhege.cn"
SAVE_DIR = "./读者阁PDF"  # 保存目录
MAX_WORKERS = 3  # 并发下载数（不要太大，避免被封）
TIMEOUT = 120  # 单文件下载超时时间(秒)
RETRY_TIMES = 5  # 失败重试次数
RETRY_DELAY = 3  # 重试间隔(秒)
USER_AGENTS = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_2) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Safari/605.1.15",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0"
]

# 日志配置
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler("duzhege_crawler.log", encoding="utf-8"),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

# 会话管理
session = requests.Session()
session.headers.update({
    "Referer": BASE_URL,
    "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8"
})

def get_random_ua():
    return random.choice(USER_AGENTS)

def safe_request(url, method="get", stream=False, **kwargs):
    """带重试的安全请求"""
    headers = kwargs.pop("headers", {})
    headers["User-Agent"] = get_random_ua()
    for i in range(RETRY_TIMES):
        try:
            resp = session.request(method, url, headers=headers, stream=stream, timeout=TIMEOUT, **kwargs)
            if resp.status_code in [403, 429, 502, 503]:
                logger.warning(f"请求被限流({resp.status_code})，等待{RETRY_DELAY*(i+1)}秒后重试: {url}")
                time.sleep(RETRY_DELAY * (i + 1))
                continue
            resp.raise_for_status()
            return resp
        except Exception as e:
            if i == RETRY_TIMES - 1:
                logger.error(f"请求失败({i+1}/{RETRY_TIMES}): {url}, 错误: {str(e)}")
                raise
            time.sleep(RETRY_DELAY * (i + 1))
    return None

def get_all_article_urls():
    """从sitemap获取所有文章URL"""
    logger.info("正在获取站点地图...")
    sitemap_url = urljoin(BASE_URL, "/sitemap.xml")
    resp = safe_request(sitemap_url)
    soup = BeautifulSoup(resp.content, "xml")
    urls = [loc.text for loc in soup.find_all("loc") if loc.text.endswith(".html")]
    # 过滤非文章页
    article_urls = []
    for url in urls:
        if any(x in url for x in [".html", "/posts/"]) and not any(x in url for x in ["predownload", "donate", "about", "page"]):
            article_urls.append(url)
    logger.info(f"共获取到{len(article_urls)}篇文章")
    return article_urls

def parse_article(article_url):
    """解析单篇文章，获取标题和下载链接"""
    try:
        resp = safe_request(article_url)
        soup = BeautifulSoup(resp.text, "html.parser")
        # 获取标题
        title = soup.find("h1").get_text(strip=True) if soup.find("h1") else os.path.basename(article_url).replace(".html", "")
        # 查找所有下载链接
        download_links = []
        for a in soup.find_all("a", href=True):
            href = a["href"]
            text = a.get_text(strip=True)
            # 匹配下载链接
            if "下载" in text or "pdf" in href.lower():
                if href.startswith("http"):
                    download_links.append((text, href))
        # 优先使用备用下载链接，主源有Cloudflare盾
        backup_download = None
        main_download = None
        for text, url in download_links:
            if "备用" in text and "下载" in text:
                backup_download = url
            elif "OneDrive下载" in text or "下载" in text:
                main_download = url
        # 优先用备用源
        download_url = backup_download or main_download
        if not download_url:
            # 尝试从在线阅读链接构造下载链接
            for text, url in download_links:
                if "阅读" in text and "cloud.duzhege.cn" in url:
                    download_url = url.replace("https://cloud.duzhege.cn/", "https://yun.duzhege.cn/d/")
                    break
                elif "阅读" in text and "yun.duzhege.cn" in url:
                    download_url = url.replace("https://yun.duzhege.cn/", "https://yun.duzhege.cn/d/")
                    break
        if not download_url:
            logger.warning(f"未找到下载链接: {title} {article_url}")
            return None
        # 提取分类目录（从面包屑获取）
        category = "未分类"
        breadcrumb = soup.find("div", class_=re.compile("breadcrumb|crumbs|post-crumb"))
        if breadcrumb:
            crumbs = [a.get_text(strip=True) for a in breadcrumb.find_all("a")]
            if len(crumbs) >= 2:
                category = crumbs[1]
        else:
            # 从URL推断
            match = re.match(r"https://duzhege.cn/([a-z_]+)-\d+", article_url)
            if match:
                category_map = {
                    "motto": "格言校园版",
                    "science_fiction_world_t": "科幻世界译文版",
                    "science_fiction_world": "科幻世界",
                    "shanghai_literature": "上海文学",
                    "october_cp": "十月长篇小说",
                    "october": "十月",
                    "overseas_digest_l": "海外文摘文学版",
                    "overseas_digest": "海外文摘",
                    "minifiction_monthly": "微型小说月报",
                    "fiction_monthly_dz": "小说月报大字版",
                    "fiction_monthly_o": "小说月报原创版",
                    "fiction_monthly": "小说月报",
                    "woodpecker": "啄木鸟",
                    "stories": "故事会",
                    "bosom_friend_o": "知音海外版",
                    "bosom_friend": "知音",
                    "shuwu": "书屋",
                    "bcr": "当代长篇小说选刊",
                    "flower_city": "花城",
                    "stories_digest": "故事会文摘版",
                    "dushu": "读书",
                    "folk_literature": "民间文学",
                    "beijing_literature": "北京文学",
                    "qingming": "清明",
                    "jinguichuanqi": "今古传奇",
                    "legendary_folktales": "民间传奇故事",
                    "ertongwenxue_xc": "儿童文学选萃版",
                    "ertongwenxue_gs": "儿童文学故事版",
                    "ertongwenxue_jd": "儿童文学经典版",
                    "xsxk": "小说选刊",
                    "lotus": "芙蓉",
                }
                prefix = match.group(1)
                category = category_map.get(prefix, prefix)
        return {
            "title": title,
            "category": category,
            "download_url": download_url,
            "article_url": article_url
        }
    except Exception as e:
        logger.error(f"解析文章失败 {article_url}: {str(e)}")
        return None

def download_pdf(article_info):
    """下载单个PDF文件"""
    if not article_info:
        return False
    title = article_info["title"]
    category = article_info["category"]
    url = article_info["download_url"]
    # 清理文件名中的非法字符
    safe_title = re.sub(r'[\\/*?:"<>|]', "", title)
    if not safe_title.endswith(".pdf"):
        safe_title += ".pdf"
    # 创建分类目录
    save_path = os.path.join(SAVE_DIR, category)
    os.makedirs(save_path, exist_ok=True)
    file_path = os.path.join(save_path, safe_title)
    # 跳过已下载且大小正常的文件
    if os.path.exists(file_path):
        file_size = os.path.getsize(file_path)
        if file_size > 1024 * 1024:  # 大于1MB认为下载完成
            logger.info(f"已跳过（已存在）: {title}")
            return True
        else:
            logger.info(f"文件损坏或未完成，重新下载: {title}")
            os.remove(file_path)
    logger.info(f"开始下载: {title} -> {os.path.join(category, safe_title)}")
    # 断点续传
    temp_path = file_path + ".part"
    downloaded_size = 0
    if os.path.exists(temp_path):
        downloaded_size = os.path.getsize(temp_path)
    headers = {"Range": f"bytes={downloaded_size}-"} if downloaded_size > 0 else {}
    try:
        resp = safe_request(url, stream=True, headers=headers)
        # 如果服务器不支持断点续传，重新从头下载
        if resp.status_code == 200:
            downloaded_size = 0
            mode = "wb"
        elif resp.status_code == 206:
            mode = "ab"
        else:
            logger.error(f"下载失败，状态码: {resp.status_code}, {title}")
            return False
        total_size = int(resp.headers.get("content-length", 0)) + downloaded_size
        with open(temp_path, mode) as f, tqdm(
            desc=safe_title[:20] + "...",
            total=total_size,
            initial=downloaded_size,
            unit="B",
            unit_scale=True,
            unit_divisor=1024,
            leave=False
        ) as pbar:
            for chunk in resp.iter_content(chunk_size=1024 * 64):
                if chunk:
                    f.write(chunk)
                    pbar.update(len(chunk))
        # 下载完成重命名
        os.rename(temp_path, file_path)
        logger.info(f"下载完成: {title} ({os.path.getsize(file_path)/1024/1024:.1f}MB)")
        return True
    except Exception as e:
        logger.error(f"下载失败 {title}: {str(e)}")
        if os.path.exists(temp_path):
            logger.info(f"保留断点文件，下次可续传: {temp_path}")
        return False

def main():
    # 创建保存目录
    os.makedirs(SAVE_DIR, exist_ok=True)
    logger.info("="*50)
    logger.info("读者阁全站PDF爬虫启动")
    logger.info(f"保存目录: {os.path.abspath(SAVE_DIR)}")
    logger.info(f"并发数: {MAX_WORKERS}")
    logger.info("="*50)
    # 1. 获取所有文章链接
    article_urls = get_all_article_urls()
    # 保存文章列表
    with open("article_list.json", "w", encoding="utf-8") as f:
        json.dump(article_urls, f, ensure_ascii=False, indent=2)
    # 2. 解析所有文章
    logger.info("开始解析文章信息...")
    articles = []
    # 多线程解析
    with ThreadPoolExecutor(max_workers=MAX_WORKERS*2) as executor:
        futures = {executor.submit(parse_article, url): url for url in article_urls}
        for future in tqdm(as_completed(futures), total=len(article_urls), desc="解析文章"):
            result = future.result()
            if result:
                articles.append(result)
    logger.info(f"成功解析{len(articles)}篇可下载文章")
    # 保存解析结果
    with open("articles_info.json", "w", encoding="utf-8") as f:
        json.dump(articles, f, ensure_ascii=False, indent=2)
    # 3. 下载所有PDF
    logger.info(f"开始下载{len(articles)}个PDF文件...")
    success = 0
    failed = 0
    with ThreadPoolExecutor(max_workers=MAX_WORKERS) as executor:
        futures = {executor.submit(download_pdf, article): article for article in articles}
        for future in tqdm(as_completed(futures), total=len(articles), desc="总体进度"):
            if future.result():
                success += 1
            else:
                failed += 1
            # 随机延迟，避免请求过快
            time.sleep(random.uniform(0.5, 2))
    logger.info("="*50)
    logger.info(f"下载任务完成！成功: {success}, 失败: {failed}")
    logger.info(f"文件保存位置: {os.path.abspath(SAVE_DIR)}")
    logger.info(f"失败列表已记录到日志，可重新运行脚本断点续传")
    logger.info("="*50)

if __name__ == "__main__":
    main()